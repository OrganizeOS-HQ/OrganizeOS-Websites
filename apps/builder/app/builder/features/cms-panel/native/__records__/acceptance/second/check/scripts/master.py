"""Run every program check over the 1,652 records; write outcomes."""
import json, collections, sys
import common as C
import chk_divider, chk_blocktype, chk_btrange, chk_removal
EXTRA = []
try:
    import chk_more
    EXTRA.append(chk_more)
    import chk_paste
    EXTRA.append(chk_paste)
except ImportError:
    pass

REL = {
    'divider': 'R-DIV',
    'blocktype': 'R-BT',
    'btrange': 'R-BTR',
    'removal': 'R-RM',
}


def run(r):
    tr = C.trace(r)
    steps = [t['step'] for t in tr]
    out = []
    if any(s.startswith('["button","Divider"') for s in steps):
        out.append(('R-DIV', chk_divider.check(r)))
    if any(s.startswith('["block"') for s in steps):
        i = C.action_index(tr, lambda s: s.startswith('["block"'))
        cr = C.caret_before(tr, i)
        if cr and ' -> ' in cr:
            out.append(('R-BTR', chk_btrange.check(r)))
        else:
            out.append(('R-BT', chk_blocktype.check(r)))
    if any(s.startswith('["button","Numbered list') or s.startswith('["button","Bulleted list') for s in steps):
        import chk_list
        out.append(('R-LIST', chk_list.check(r)))
    if any(s.startswith('["walk"') for s in steps):
        import chk_walk
        out.append(('R-WALK', chk_walk.check(r)))
    if any(s in chk_removal.KEYS for s in steps):
        out.append(('R-RM', chk_removal.check(r)))
    for m in EXTRA:
        for rel, res in m.checks(r):
            out.append((rel, res))
    return out


if __name__ == '__main__':
    res = {}
    for r in C.U:
        try:
            o = run(r)
        except Exception as ex:
            o = [('ERR', (False, repr(ex)[:120]))]
        o = [(rel, (ok, why)) for rel, (ok, why) in o if ok is not None]
        res[(r['set'], r['id'])] = o
    json.dump({'%s\t%s' % k: v for k, v in res.items()}, open(C.ld.HERE + '/master.json', 'w'))
    cnt = collections.Counter()
    for r in C.U:
        o = res[(r['set'], r['id'])]
        st = 'confirmed' if o and o[0][1][0] else ('not confirmed' if o else 'unchecked')
        cnt[st] += 1
    print(cnt)
    left = collections.Counter()
    for r in C.U:
        o = res[(r['set'], r['id'])]
        if not o:
            left[(r['label'][:55], r['id'].split('|')[-1][:12])] += 1
    for k, v in left.most_common(int(sys.argv[1]) if len(sys.argv) > 1 else 60):
        print(v, k)
