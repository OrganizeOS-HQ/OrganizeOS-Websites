"""R-PASTE (D14, 5.4, D5; D4 for the paste at the caret; T38 for plain text of several lines): the range is
removed first and the paste lands at the caret the removal leaves: the write's leaves (line breaks aside) are
the stored leaves before the range, the pasted leaves, the stored leaves after it; the next key typed lands
directly after the pasted content."""
import json, re
import common as C, ht
from chk_more import nbl, ends_pos

ACTS = ('["paste"', '["drop"', '["pasteCopied"', '["dropCopied"')


def check(r, j):
    tr = C.trace(r)
    st = json.loads(tr[j]['step'])
    if st[0] in ('paste', 'drop'):
        d = st[1] if len(st) > 1 and isinstance(st[1], dict) else {}
        if d.get('text/html') is not None:
            ins = [x for x in ht.leaves(d['text/html']) if x not in ('<br>', '\n')]
        elif d.get('text/plain') is not None:
            ins = [c for c in d['text/plain'] if c != '\n']
        else:
            return False, 'no data'
    else:
        rr = [k for k in range(j) if tr[k]['step'].startswith('["copy"')]
        if not rr:
            return False, 'no copy'
        cpre = C.lib2.tidy(tr[rr[-1]].get('live'))
        ab = ends_pos(cpre, tr[rr[-1]].get('caret'))
        if ab is None:
            return False, 'copy range not resolved'
        ins = nbl(cpre)[ab[0]:ab[1]]
    caret = C.caret_before(tr, j)
    pre = C.lib2.tidy(tr[j - 1].get('live'))
    w = C.lib2.tidy(tr[j].get('live'))
    if caret and caret.startswith('nodes:') and 'horizontalrule' in caret.rsplit('/', 1)[-1]:
        # D15: with a rule selected a paste that inserts something replaces the rule
        import chk_walk
        q = chk_walk.node_pos(pre, caret)
        if q is None:
            return False, 'rule not resolved'
        from chk_more import nbi
        A = nbi(ht.leaves(pre), q - 1)
        B = A + 1
        ab = (A, B)
    else:
        ab = ends_pos(pre, caret)
    if ab is None:
        return False, 'caret not resolved: ' + str(caret)[-50:]
    A, B = ab
    a = nbl(pre)
    if nbl(w) != a[:A] + ins + a[B:]:
        return False, 'the write is not the stored value less the range with the pasted content at its start'
    ks = [k for k in range(j + 1, len(tr)) if re.match(r'\["key","[A-Z]"\]$', tr[k]['step'])]
    if ks:
        k = ks[-1]
        letter = json.loads(tr[k]['step'])[1]
        before = None
        for x in reversed(tr[:k]):
            if x.get('live') is not None:
                before = C.lib2.tidy(x['live'])
                break
        if ht.canon(before) != ht.canon(w):
            return False, 'the value before the key is not the write'
        if nbl(C.lib2.tidy(tr[k].get('live'))) != nbl(w)[:A + len(ins)] + [letter] + nbl(w)[A + len(ins):]:
            return False, 'the key does not land directly after the pasted content'
    return True, 'range removed, the pasted content at its start, nothing else moved; the next key after it'


def checks(r):
    tr = C.trace(r)
    for j, t in enumerate(tr):
        if t['step'].startswith(ACTS):
            return [('R-PASTE', check(r, j))]
    return []
