"""Divider row (5.7, T2's result in lined containers; T10.8).
Relation (T79.7): R1's write is the stored value with one rule added at the caret and nothing else moved,
and the letter typed after undo and redo stands at the start of what follows the rule.
Program form:
  (a) R1's leaves (characters, rules, images, line breaks) are the stored leaves with one rule inserted at
      the caret's leaf position p (the caret R1 holds when Divider is pressed);
  (b) nothing else moved: removing that rule and re-joining the containers split around it (siblings of the
      same tag on each side of the cut, at every level up to the root) gives the stored value back;
  (c) no empty container appears that the stored value does not hold;
  (d) the letter typed after undo and redo is inserted at leaf p + 1 (directly after the rule).
"""
import json, sys
import common as C, ht, pos


def rejoin(tree):
    """all values obtainable by joining split halves around the cut (where the rule stood)"""
    return tree


def strip_rule_and_join(w, p):
    """remove the rule at leaf p of w and merge the two sides back. Returns canonical HTML."""
    tree = ht.parse(w)
    # find path of the rule leaf
    cnt = [0]
    found = []

    def walk(n, path):
        if isinstance(n, str):
            cnt[0] += len(n)
            return
        if n[0] in ht.VOID:
            if cnt[0] == p and n[0] == 'hr':
                found.append(path)
            cnt[0] += 1
            return
        for i, c in enumerate(n[1]):
            walk(c, path + (i,))
    walk(tree, ())
    if not found:
        return None
    path = found[0]
    parent = tree
    for i in path[:-1]:
        parent = parent[1][i]
    idx = path[-1]
    del parent[1][idx]
    # merge the siblings now meeting at idx, recursively down their facing edges
    merge_at(parent[1], idx)
    # a split can also have happened inside the parent's ancestors: merge upward is not needed because
    # the rule's parent holds both halves as siblings.
    return ht.ser(tree)


def merge_at(ch, idx):
    if idx <= 0 or idx >= len(ch):
        return
    L, R = ch[idx - 1], ch[idx]
    if isinstance(L, str) and isinstance(R, str):
        ch[idx - 1] = L + R
        del ch[idx]
        return
    if isinstance(L, str) or isinstance(R, str):
        return
    if L[0] == R[0] and L[0] not in ht.VOID and L[0] in ('ul', 'ol', 'blockquote', 'li', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'code'):
        n = len(L[1])
        L[1].extend(R[1])
        del ch[idx]
        merge_at(L[1], n)


def candidates(w, p):
    """with item and paragraph joins optional: the split may fall between two items (no join of items)"""
    out = set()
    tree = ht.parse(w)
    cnt = [0]
    found = []

    def walk(n, path):
        if isinstance(n, str):
            cnt[0] += len(n)
            return
        if n[0] in ht.VOID:
            if cnt[0] == p and n[0] == 'hr':
                found.append(path)
            cnt[0] += 1
            return
        for i, c in enumerate(n[1]):
            walk(c, path + (i,))
    walk(tree, ())
    if not found:
        return out
    path = found[0]
    import copy
    for depth in range(0, 8):
        t = copy.deepcopy(tree)
        parent = t
        for i in path[:-1]:
            parent = parent[1][i]
        idx = path[-1]
        del parent[1][idx]
        merge_limited(parent[1], idx, depth)
        out.add(ht.ser(t))
    return out


def merge_limited(ch, idx, depth):
    if depth < 0 or idx <= 0 or idx >= len(ch):
        return
    L, R = ch[idx - 1], ch[idx]
    if isinstance(L, str) and isinstance(R, str):
        ch[idx - 1] = L + R
        del ch[idx]
        return
    if isinstance(L, str) or isinstance(R, str):
        return
    if L[0] == R[0] and L[0] not in ht.VOID:
        n = len(L[1])
        L[1].extend(R[1])
        del ch[idx]
        merge_limited(L[1], n, depth - 1)


def check(r):
    tr = C.trace(r)
    i = C.action_index(tr, lambda s: s.startswith('["button","Divider"'))
    if i is None:
        return False, 'no Divider step'
    caret = C.caret_before(tr, i)
    stored = ht.canon(r['stored'])
    w = C.write_of(tr, i)
    if w is None:
        return False, 'no write'
    e = C.ends(caret)
    if len(e) != 1:
        return False, 'caret is a range or node selection: ' + str(caret)[:80]
    # the stored value as R1 holds it at the click: the live value of the step before
    pre = C.lib2.tidy(tr[i - 1].get('live')) if i > 0 else stored
    p = pos.resolve(pre, e[0])
    if p is None:
        return False, 'caret not resolved: ' + e[0][-60:]
    sl = ht.leaves(pre)
    wl = ht.leaves(w)
    if wl != sl[:p] + ['<hr>'] + sl[p:]:
        return False, '(a) leaves: rule not added at the caret alone'
    if ht.canon(pre) not in candidates(w, p):
        return False, '(b) the rule removed and the split joined does not give the stored value'
    if set(ht.empty_containers(ht.parse(w))) - set(ht.empty_containers(ht.parse(pre))):
        return False, '(c) an empty container'
    t = C.typed(tr)
    if t is None:
        return False, 'no typed letter'
    before = C.before_typed_live(tr)
    if ht.canon(before) != ht.canon(w):
        return False, '(d) the value before the letter is not the write'
    kp = C.k_position(before, t[1])
    if kp != p + 1:
        return False, '(d) the letter is not at the start of what follows the rule (at %s, rule at %s)' % (kp, p)
    return True, 'rule at leaf %d; split joined back; letter at %d' % (p, kp)


if __name__ == '__main__':
    fam = [r for r in C.U if r['label'].startswith('5.7 Divider row')]
    import collections
    res = collections.Counter()
    bad = []
    for r in fam:
        ok, why = check(r)
        res[ok] += 1
        if not ok:
            bad.append((r['id'], why))
    print(res)
    for b in bad[:60]:
        print(b)
