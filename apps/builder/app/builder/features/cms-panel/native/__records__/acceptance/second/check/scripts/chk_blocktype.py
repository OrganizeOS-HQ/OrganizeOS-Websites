"""Block type in place (D2, D13; T45.12's P7; map 2 T6, TS1, T10).
Relation (T79.7, caret form): R1's write is the stored value with only the action's block tags added around
the run that holds the caret, D3's line breaks aside; every text, rule and image stands in the stored order;
the letter typed next stands inside the new block.
Program form, at R1's caret when the button is pressed:
  (a) the leaves without line breaks are the stored value's, in order;
  (b) the letter typed after undo and redo is inserted at the caret's leaf position, inside an element of
      the action's tag (h2 / blockquote / pre) that the stored value does not hold there (the new block);
  (c) unwrapping that new block in the write, and in the stored value the paragraph, heading or code block
      the caret stood in (the run's old block, which the new one replaces), gives the same tree, line
      breaks aside: no container is added, removed or moved anywhere else.
Range form (Block type over a range, the "D2" range records): checked by chk_blocktype_range.py.
"""
import copy
import common as C, ht, pos

TAG = {'H2': 'h2', 'Qt': 'blockquote', 'Cd': 'pre', 'Paragraph': 'p'}
BLK = {'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'code'}


def act_of(r):
    a = r['id'].split('|')[-1]
    return a


def step_pred(s):
    return s.startswith('["block"')


def path_of_leaf(tree, p):
    """element path (list of nodes, outermost first) holding the insertion point p, preferring the text
    the point is in or at the end of"""
    best = []
    cnt = [0]

    def walk(n, chain):
        if isinstance(n, str):
            if cnt[0] <= p <= cnt[0] + len(n) and not best:
                best.append(chain)
            cnt[0] += len(n)
            return
        if n[0] in ht.VOID:
            cnt[0] += 1
            return
        if not n[1] and cnt[0] == p and not best and n[0] != '#root':
            best.append(chain + [n])
        for c in n[1]:
            walk(c, chain + [n])
    walk(tree, [])
    return best[0] if best else None


def unwrap_node(tree, target):
    """replace the node object target by its children"""
    def rec(n):
        if isinstance(n, str):
            return
        out = []
        for c in n[1]:
            if c is target:
                kids = c[1]
                if c[0] == 'pre' and kids and not isinstance(kids[0], str) and kids[0][0] == 'code':
                    kids = kids[0][1]
                out.extend(kids)
            else:
                rec(c)
                out.append(c)
        m = []
        for c in out:
            if isinstance(c, str) and m and isinstance(m[-1], str):
                m[-1] += c
            else:
                m.append(c)
        n[1][:] = m
    rec(tree)
    return tree


def remove_leaf(h, q):
    """remove the character leaf at index q"""
    tree = ht.parse(h)
    cnt = [0]
    done = [False]

    def rec(n):
        for j, c in enumerate(n[1]):
            if done[0]:
                return
            if isinstance(c, str):
                if cnt[0] <= q < cnt[0] + len(c):
                    k = q - cnt[0]
                    n[1][j] = c[:k] + c[k + 1:]
                    done[0] = True
                    return
                cnt[0] += len(c)
            elif c[0] in ht.VOID:
                cnt[0] += 1
            else:
                rec(c)
    rec(tree)
    return ht.ser(tree)


def nobr(h):
    return ht.ser(ht.drop(ht.parse(h), {'br'}))


def check(r):
    tr = C.trace(r)
    i = C.action_index(tr, step_pred)
    if i is None:
        return False, 'no block step'
    tag = TAG.get(act_of(r))
    caret = C.caret_before(tr, i)
    e = C.ends(caret)
    if len(e) != 1:
        return None, 'range'
    pre = C.lib2.tidy(tr[i - 1].get('live'))
    w = C.write_of(tr, i)
    p = pos.resolve(pre, e[0])
    if p is None:
        return False, 'caret not resolved: ' + str(e[0])[-60:]
    def lv(h):
        return [x for x in ht.leaves(h, keep_br=False) if x != '\n']
    if lv(w) == lv(pre) and C.lib2.tidy(w) == C.lib2.tidy(pre) and tr[i].get('calls') == tr[i - 1].get('calls') and tag == 'blockquote':
        chain0 = path_of_leaf(ht.parse(pre), p) or []
        if any(n[0] == 'blockquote' for n in chain0):
            return True, 'T45.4: Quote in a quote of a lined item changes nothing and fires no onChange'
    if lv(w) != lv(pre):
        return False, '(a) leaves differ'
    t = C.typed(tr)
    if t is None:
        return False, 'no typed letter'
    before = C.before_typed_live(tr)
    if ht.canon(before) != ht.canon(w):
        return False, '(b) the value before the letter is not the write'
    kp = C.k_position(before, t[1])
    if kp is None:
        return False, '(b) no single letter'
    # the letter's leaf position in the write without br must equal the caret's in pre without br
    def nb_index(h, q):
        lv = ht.leaves(h)
        return sum(1 for x in lv[:q] if x not in ('<br>', '\n'))
    if nb_index(before, kp) != nb_index(pre, p):
        return False, '(b) the letter is not at the caret (%d vs %d)' % (nb_index(before, kp), nb_index(pre, p))
    if tag == 'p' or tag is None:
        return None, 'Paragraph'
    # the letter's chain in the value after the letter (an empty new block holds the letter there)
    ft = ht.parse(t[1])
    chain = path_of_leaf(ft, kp + 1)
    if chain is None:
        return False, '(b) letter not found'
    newb = [n for n in chain if n[0] == tag]
    if not newb:
        return False, '(b) the letter is not inside a %s' % tag
    E = newb[-1]
    w2 = unwrap_node(ft, E)
    got = ht.ser(w2)
    # remove the letter
    lvs = ht.leaves(got)
    got = remove_leaf(got, kp)
    pt = ht.parse(pre)
    cands = [ht.ser(pt)]
    t2 = ht.parse(pre)
    ch2 = path_of_leaf(t2, p) or []
    o2 = [n for n in ch2 if n[0] in BLK]
    o2 = [n for n in o2 if n[0] == 'pre'] or o2
    if o2:
        cands.append(ht.ser(unwrap_node(t2, o2[-1])))

    def nn(h):
        return nobr(h).replace('\n', '')
    got = nn(got)
    if got in [nn(c) for c in cands]:
        return True, 'new %s around the caret run; the rest unchanged' % tag
    return False, '(c) unwrapping the new block does not give the stored value: %s vs %s' % (got, [nobr(c) for c in cands])


if __name__ == '__main__':
    import collections, sys
    pre = sys.argv[1] if len(sys.argv) > 1 else ''
    fam = [r for r in C.U if any(r['label'].startswith(x) for x in (
        'by class (to confirm per record): D2: Block type', 'by class (to confirm per record): D13',
        'D2 (P7', 'D2 with map 2', 'by class (to confirm per record): D2 / D13'))]
    res = collections.Counter()
    bad = []
    for r in fam:
        try:
            ok, why = check(r)
        except Exception as ex:
            ok, why = False, 'exception ' + repr(ex)[:80]
        res[(r['label'][:30], ok)] += 1
        if ok is False:
            bad.append((r['id'], why))
    for k, v in sorted(res.items(), key=str):
        print(v, k)
    for b in bad[:int(sys.argv[2]) if len(sys.argv) > 2 else 40]:
        print(b)
