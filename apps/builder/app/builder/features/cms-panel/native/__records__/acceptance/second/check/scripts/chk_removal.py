"""Backspace and Delete in a lined container: D3's four joins, D5 and 5.4's removal, D9, D19.
Relation, at R1's caret or range when the key is pressed (leaves: characters, rules, images; line breaks
apart, since D3's third case adds one and its fourth removes one, and D19 keeps an empty paragraph as a
line of one break):
  collapsed caret:
    (1) the key removes at most one leaf, and only the one directly beside the caret in its direction
        (a character, a rule, an image: D9, D3's first case), or a line break there (D3's fourth case),
        and moves no other leaf: the write's leaves are the stored ones in order less that one;
    (2) where it removes nothing but a join (D3's second and third cases, a block emptied whole), the two
        leaves that meet at the caret stand in one container of the write (they joined);
  range (5.4, D5): the write's leaves are the stored leaves outside the range, in order;
  both: (3) no container is left empty that the stored value does not hold empty (5.4's emptied rule);
        (4) the letter typed after undo and redo lands at the place of the edit: at the caret, one leaf
        back when Backspace removed a character, rule or image; at the range's start.
"""
import re
import common as C, ht, pos

KEYS = {'["key","{Backspace}"]': 'BS', '["key","{Delete}"]': 'DEL'}


def nb(lv):
    return [x for x in lv if x not in ('<br>', '\n')]


def nbi(lv, q):
    return sum(1 for x in lv[:q] if x not in ('<br>', '\n'))


def container_of(html, q, with_br=False):
    """the innermost element (by identity path) holding nb-leaf q (leaf q counting line breaks with_br)"""
    tree = ht.parse(html)
    cnt = [0]
    found = []

    def walk(n, path):
        if isinstance(n, str):
            for ch in n:
                if ch == '\n':
                    continue
                if cnt[0] == q and not found:
                    found.append(path)
                cnt[0] += 1
            return
        if n[0] == 'br' and not with_br:
            return
        if n[0] in ('hr', 'img', 'br'):
            if cnt[0] == q and not found:
                found.append(path)
            cnt[0] += 1
            return
        for i, c in enumerate(n[1]):
            walk(c, path + ((i, c[0] if not isinstance(c, str) else '#t'),))
    walk(tree, ())
    if not found:
        return None
    # drop inline wrappers (a, b, i ...) and text: the container is the nearest non-inline element
    p = list(found[0])
    while p and p[-1][1] in ('a', 'b', 'i', 'strong', 'em', 'u', 's', 'span', 'code', '#t', 'hr', 'img', 'br'):
        p.pop()
    return tuple(p)


def check(r):
    tr = C.trace(r)
    i = C.action_index(tr, lambda s: s in KEYS)
    if i is None:
        return None, 'not a plain Backspace or Delete'
    key = KEYS[tr[i]['step']]
    caret = C.caret_before(tr, i)
    e = C.ends(caret)
    pre = C.lib2.tidy(tr[i - 1].get('live'))
    w = C.write_of(tr, i)
    if w is None:
        return False, 'no write'
    LP, LW = ht.leaves(pre), ht.leaves(w)
    ps = [pos.resolve(pre, x) for x in e]
    if None in ps:
        return False, 'caret not resolved: ' + str(caret)[-70:]
    if len(ps) == 1:
        p = ps[0]
        q = nbi(LP, p)
        a, b = nb(LP), nb(LW)
        removed = False
        if b == a:
            # nothing but line breaks removed or added: a join, or D3's fourth case
            brs = (LP.count('<br>') - LW.count('<br>'), )
            if ht.canon(w) == ht.canon(pre):
                return False, 'the key changed nothing'
            if brs[0] == 0 or brs[0] < 0:
                # a join: the leaves meeting at the caret share a container
                if 0 < q < len(a):
                    joined = container_of(w, q - 1) == container_of(w, q)
                    if not joined and LP.count('<br>') == LW.count('<br>') and 0 < p < len(LP):
                        # the caret stands after a line break: the leaves meeting there, breaks counted
                        joined = container_of(w, p - 1, True) == container_of(w, p, True)
                    if not joined:
                        return False, '(2) the two leaves meeting at the caret are not joined'
            else:
                # one line break removed: it stood directly beside the caret in the key's direction
                side = LP[p - 1] if key == 'BS' and p > 0 else (LP[p] if p < len(LP) else None)
                if side != '<br>' and not (key == 'BS' and '<br>' in LP[max(0, p - 2):p]) and not (key == 'DEL' and '<br>' in LP[p:p + 2]):
                    return False, '(1) a line break went that is not beside the caret'
        elif len(b) == len(a) - 1:
            j = q - 1 if key == 'BS' else q
            if not (0 <= j < len(a)) or a[:j] + a[j + 1:] != b:
                return False, '(1) the leaf removed is not the one beside the caret'
            removed = True
        else:
            return False, '(1) more than one leaf removed or one added (%d -> %d)' % (len(a), len(b))
        kq = q - 1 if (removed and key == 'BS') else q
    else:
        A, B = sorted(nbi(LP, x) for x in ps)
        a, b = nb(LP), nb(LW)
        if a[:A] + a[B:] != b:
            return False, '(range) the write is not the stored value less the range'
        kq = A
    t = C.typed(tr)
    newempty = sorted(ht.empty_containers(ht.parse(w)))
    for x in ht.empty_containers(ht.parse(pre)):
        if x in newempty:
            newempty.remove(x)
    if newempty:
        # D16: the block that holds the caret stays; the letter must land in the one emptied container
        if t is None:
            return False, '(3) an emptied container is left'
        kp0 = C.k_position(C.before_typed_live(tr) or '', t[1])
        ch = C.k_container(t[1], kp0) if kp0 is not None else None
        # every container left empty holds the caret: the letter lands in it and the value after the
        # letter holds no empty container the stored value does not hold
        after_empty = sorted(ht.empty_containers(ht.parse(t[1])))
        for x in ht.empty_containers(ht.parse(pre)):
            if x in after_empty:
                after_empty.remove(x)
        if not ch or after_empty or any(x not in ch for x in newempty):
            return False, '(3) an emptied container is left (%s)' % newempty

    if t is None:
        return False, 'no letter'
    before = C.before_typed_live(tr)
    if ht.canon(before) != ht.canon(w):
        return False, '(4) the value before the letter is not the write'
    kp = C.k_position(before, t[1])
    if kp is None:
        return False, '(4) not one letter'
    if nbi(ht.leaves(t[1]), kp) != kq:
        return False, '(4) the letter is at %d, the edit at %d' % (nbi(ht.leaves(t[1]), kp), kq)
    return True, ('one leaf beside the caret removed' if len(ps) == 1 and removed else ('the range removed' if len(ps) > 1 else 'joined, nothing removed')) + '; nothing emptied left; the letter at the edit'


if __name__ == '__main__':
    import collections, sys
    labs = sys.argv[1].split(';;')
    fam = [r for r in C.U if any(r['label'].startswith(x) for x in labs)]
    res = collections.Counter()
    bad = []
    for r in fam:
        try:
            ok, why = check(r)
        except Exception as ex:
            ok, why = False, 'exception ' + repr(ex)[:100]
        res[ok] += 1
        if ok is False:
            bad.append((r['id'], why))
    print(res)
    c2 = collections.Counter(re.sub(r'\d+', 'N', w)[:60] for _, w in bad)
    print(c2.most_common())
    for x in bad[:int(sys.argv[2]) if len(sys.argv) > 2 else 30]:
        print(x)
