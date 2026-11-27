"""R-LIST (D2: the list buttons act on the line's item, as on an ordinary item's text; Lexical's list commands):
  - the other list type: every list that directly holds an item the caret or range is in takes the new
    tag, and nothing else changes;
  - the same type at a caret (list off): the list that holds the caret's item is taken apart: each item's
    text and lines become paragraphs at the list's place, each block of a lined item stands there as it was,
    nothing else changes;
  - the letter typed after undo and redo lands at the caret (or replaces the range, 5.4).
"""
import copy
import common as C, ht, pos, chk_more as M

ACT = {'OL': 'ol', 'UL': 'ul'}


def item_lists(pre, ps):
    """identity of the list elements that directly hold the items holding the given leaf positions"""
    tree = ht.parse(pre)
    hits = []
    for p in ps:
        cnt = [0]
        found = []

        def walk(n, chain):
            if isinstance(n, str):
                if cnt[0] <= p <= cnt[0] + len(n) and not found:
                    found.append(chain)
                cnt[0] += len(n)
                return
            if n[0] in ht.VOID:
                if cnt[0] == p and not found:
                    found.append(chain)
                cnt[0] += 1
                return
            for c in n[1]:
                walk(c, chain + [n])
        walk(tree, [])
        if found:
            lists = [x for x in found[0] if x[0] in ('ul', 'ol')]
            if lists:
                hits.append(lists[-1])
    return tree, hits


def list_off(tree, L):
    def rec(n):
        if isinstance(n, str):
            return
        out = []
        for c in n[1]:
            if c is L:
                for li in c[1]:
                    if isinstance(li, str):
                        continue
                    run = []
                    for x in li[1]:
                        if not isinstance(x, str) and x[0] in pos.BLOCKS:
                            if run:
                                out.append(['p', run])
                                run = []
                            out.append(x)
                        else:
                            run.append(x)
                    if run or not li[1]:
                        out.append(['p', run])
            else:
                rec(c)
                out.append(c)
        n[1][:] = out
    rec(tree)
    return tree


def check(r):
    tr = C.trace(r)
    i = C.action_index(tr, lambda s: s.startswith('["button","Numbered list') or s.startswith('["button","Bulleted list'))
    if i is None:
        return None, 'no list button'
    want = 'ol' if 'Numbered' in tr[i]['step'] else 'ul'
    caret = C.caret_before(tr, i)
    e = C.ends(caret)
    pre = C.lib2.tidy(tr[i - 1].get('live'))
    w = C.write_of(tr, i)
    ps = [pos.resolve(pre, x) for x in e]
    if None in ps or not e:
        return False, 'caret not resolved: ' + str(caret)[-60:]
    tree, lists = item_lists(pre, ps if len(ps) == 1 else list(range(min(ps), max(ps) + 1)))
    if not lists:
        return False, 'the caret is in no list'
    uniq = []
    for L in lists:
        if not any(L is x for x in uniq):
            uniq.append(L)
    if all(L[0] != want for L in uniq):
        for L in uniq:
            L[0] = want
        exp = ht.ser(tree)
        kind = 'list type changed'
    elif len(ps) == 1 and len(uniq) == 1:
        exp = ht.ser(list_off(tree, uniq[0]))
        kind = 'list off'
    else:
        return False, 'list off over a range: not covered by the program'
    if ht.canon(w) != ht.canon(exp):
        return False, '%s: the write is not the expected %s' % (kind, exp)
    t = C.typed(tr)
    if t is None:
        return False, 'no letter'
    before = C.before_typed_live(tr)
    if ht.canon(before) != ht.canon(w):
        return False, 'the value before the letter is not the write'
    A, B = M.ends_pos(pre, caret)
    a = M.nbl(w)
    if M.nbl(t[1]) != a[:A] + ['k'] + a[B:]:
        return False, 'the letter does not land at the caret (or replace the range)'
    return True, kind + ' for the list that holds the caret\'s item; the letter at the caret'
