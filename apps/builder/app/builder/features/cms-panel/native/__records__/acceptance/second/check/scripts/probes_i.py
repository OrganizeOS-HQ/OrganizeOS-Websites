"""T79.8 (i): the probe fields that changed at R1 between 0ae275f and a3bc7d8 (2,082 differing fields, the
other 574 rows of the comparison being one-side records), classified by program.
Unit: a record is (file, record file, key) for the lenses whose rows are cells (keys, nav, insert), and
(file, record file) for the lenses whose rows are a record's fields (clip, comp, comp-skeptic, hist).
Classes, in order:
  timing only           every differing field is a duration (ms, cutMs, pasteMs, copyMs, kms);
  defects 4 and 5       keys bwd|..|heading|code|.. and ..|heading|contentStart|link..: R1 now makes 0 calls
                        and no write (T59.2, T63's ruled value);
  defect 7              the composition-start character only: R1's values now hold no U+200B (T63, T72);
  defect 12             insert zzq1 B QA: undo keeps the earlier edit, redo restores the join (T58, P26-1);
  now equal to the base the record now equals the base's (it is not in the base-against-R1 differences):
                        the fixes of defects 1, 6, 9, 10 and 11 rule the base's value (T65.1, T63, T68);
  read                  the rest, read one by one (probes_i_reads.json)."""
import json, re, collections
SP = '/tmp/claude-0/-home-user-OrganizeOS-Websites/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad'
d = json.load(open(SP + '/second/probes/pcmp-h0-r1.json'))
db = json.load(open(SP + '/second/probes/pcmp-base-r1.json'))
TIME = re.compile(r'(^|[a-z])(ms|Ms)$|^ms$|^kms$')
CELL = {'keys', 'nav', 'insert', 'code', 'code-skeptic', 'clip-skeptic'}
basediff = set()
for row in db['detail']:
    f, rec, key = row[0], row[1], row[2]
    basediff.add((f, rec, str(key)))
    basediff.add((f, rec))


def unit(f, rec, key):
    return (f, rec, str(key)) if f.split('/')[0] in CELL else (f, rec)


recs = collections.OrderedDict()
fields = 0
for f, rec, key, cls, a, b in d['detail']:
    if cls.startswith('only'):
        continue
    fields += 1
    recs.setdefault(unit(f, rec, key), []).append((str(key), cls, a, b))


def has200b(x):
    return '​' in json.dumps(x, ensure_ascii=False)


def calls0(b):
    v = b.get('v', b) if isinstance(b, dict) else b
    return isinstance(v, dict) and v.get('calls') == 0 and not v.get('write')


def classify(u, rows):
    f = u[0]
    lens = f.split('/')[0]
    keys = [k for k, _, _, _ in rows]
    nontime = [r for r in rows if not TIME.search(r[0])]
    if not nontime:
        return 'timing only', True
    if lens == 'keys' and all(r[0].startswith('bwd|') and '|heading|' in r[0] for r in nontime):
        return 'defects 4 and 5', all(calls0(r[3]) for r in nontime)
    if all('composition-start' in r[1] for r in nontime):
        return 'defect 7', not any(has200b(r[3]) for r in nontime)
    if lens == 'insert':
        return 'defect 12', None
    if u not in basediff or all((u[0], u[1], r[0]) not in basediff for r in nontime):
        return 'now equal to the base', True
    sub = set()
    for k, c, a, b in nontime:
        sub.add(field_class(u, k, a, b))
    sub.discard('instrumentation')
    if len(sub) == 1 and 'read' not in sub:
        return sub.pop(), True
    if not sub:
        return 'instrumentation', True
    return 'read', None


def plain_of(x):
    v = x.get('v', x) if isinstance(x, dict) else x
    if isinstance(v, dict):
        if 'plain' in v:
            return v['plain']
        if isinstance(v.get('clip'), dict):
            return v['clip'].get('plain')
    return None


def field_class(u, k, a, b):
    """per field: instrumentation (sizes, call lists, stack lines), defect 1's new line, defect 6's count,
    defect 11, equal to the base now, or read"""
    va = a.get('v', a) if isinstance(a, dict) else a
    vb = b.get('v', b) if isinstance(b, dict) else b
    if (u[0], u[1], k) not in basediff:
        return 'now equal to the base'
    if k == 'state' and isinstance(va, int) and isinstance(vb, int):
        return 'instrumentation'
    if k in ('copyCalls', 'cutCalls') or (isinstance(va, dict) and set(va) == {'calls'} and isinstance(vb, dict) and set(vb) == {'calls'}):
        return 'instrumentation'
    if k == 'errors' and isinstance(va, list) and isinstance(vb, list) and [str(x).split(' @@ ')[0] for x in va] == [str(x).split(' @@ ')[0] for x in vb]:
        return 'instrumentation'
    pa, pb = plain_of(a), plain_of(b)
    if isinstance(pa, str) and isinstance(pb, str) and pb == '\n' + pa:
        return 'defect 1 (F7: the new line between the block and the line)'
    if isinstance(va, dict) and 'stops' in va and isinstance(vb, dict):
        sa, sb = va['stops'], vb.get('stops', [])
        if len(sa) == len(sb) and all(x.get('after') == y.get('after') and (y.get('clip') == x.get('clip') or y.get('clip') == '\n' + (x.get('clip') or '')) for x, y in zip(sa, sb)):
            return 'defect 1 (F7: the new line between the block and the line)'
    if k in ('inv', 'log', 'allRaw') and u[0].startswith(('comp/', 'comp-skeptic/')):
        return 'defect 6 (T63, T67.2: the composition hands out its composed values; the last value equal)'
    if k in ('copyShape', 'afterPaste', 'pasteRestores', 'lastValue'):
        return 'defect 11 (T68: copyShape t, the paste back restores)'
    return 'read'


out = []
cnt = collections.Counter()
for u, rows in recs.items():
    c, ok = classify(u, rows)
    cnt[(c, ok)] += 1
    out.append({'unit': list(u), 'class': c, 'ok': ok, 'fields': rows})
print('fields', fields, 'units', len(recs))
for k, v in sorted(cnt.items(), key=str):
    print(v, k)
json.dump(out, open(SP + '/sc/probes_i.json', 'w'))
rd = [o for o in out if o['class'] == 'read']
c2 = collections.Counter((o['unit'][0], tuple(sorted({x[0] for x in o['fields'] if not TIME.search(x[0])}))[:3]) for o in rd)
for k, v in c2.most_common(40):
    print(v, k)
