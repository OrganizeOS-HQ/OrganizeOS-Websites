"""Per-record outcome of T79.7's check over the 1,652 records."""
import json, gzip, collections, sys
import common as C, reads

m = json.load(open(C.ld.HERE + '/master.json'))
out = []
cnt = collections.Counter()
missing = []
for r in C.U:
    k = '%s\t%s' % (r['set'], r['id'])
    o = m[k]
    rec = {'set': r['set'], 'id': r['id'], 'label': r['label'], 'stored': r['stored'],
           'writeBase': r['writeBase'], 'writeR1': r['writeR1']}
    if o and o[0][1][0]:
        rec.update(way=1, relation=o[0][0], verdict='confirmed', detail=o[0][1][1])
    else:
        rd = reads.lookup(r['id'])
        if rd is None:
            missing.append(r['id'])
            rec.update(way=None, verdict='unchecked', detail=None)
        else:
            v, why = rd
            rec.update(way=3 if v == 'explained' else None, verdict={'explained': 'read: explained', 'P': 'P record', 'open': 'open (T79.4)'}[v],
                       relation=None, detail=why, programTried=[(x[0], x[1][1]) for x in o] or None)
            if v == 'P':
                rec['stepsBase'] = [(t['step'], t.get('caret'), t.get('calls'), C.lib2.tidy(t.get('live'))) for t in C.trace(r, 'base') if not t['step'].startswith(C.SKIP)]
                rec['stepsR1'] = [(t['step'], t.get('caret'), t.get('calls'), C.lib2.tidy(t.get('live'))) for t in C.trace(r, 'r1') if not t['step'].startswith(C.SKIP)]
    cnt[(rec['verdict'], rec.get('relation'))] += 1
    out.append(rec)
print('missing', missing)
for k, v in sorted(cnt.items(), key=str):
    print(v, k)
dest = sys.argv[1] if len(sys.argv) > 1 else C.ld.HERE + '/outcomes.jsonl.gz'
with gzip.open(dest, 'wt') as f:
    for rec in out:
        f.write(json.dumps(rec) + '\n')
by = collections.Counter(r['verdict'] for r in out)
print(by)
