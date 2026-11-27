"""T79.8 (iii): the probe records that exist at R1 only (no base counterpart, the base's runs ended at the
600 s kill), each read for its lens's own invariant fields at R1.
Invariant fields, wherever they stand in a record (the probes' own checks):
  inv            'ok' or a 'none-*' answer (no change, nothing to check) passes; anything else fails;
  redoOk, undoRestores, undoBack, pasteRestores, restores, fixedPoint: True passes, False fails;
  errors, kerr, thrown, newErrors: empty or false passes, anything else fails.
A record holding none of these has no invariant of its own."""
import json, collections, os
SP = '/tmp/claude-0/-home-user-OrganizeOS-Websites/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad'
src = open(SP + '/second/scripts/pcmp2.py').read()
ns = {}
exec(compile(src[:src.index('def tests(')], 'pcmp2', 'exec'), ns)
records, keyed = ns['records'], ns['keyed']
db = json.load(open(SP + '/second/probes/pcmp-base-r1.json'))
TRUE = {'redoOk', 'undoRestores', 'undoBack', 'pasteRestores', 'restores', 'fixedPoint'}
EMPTY = {'errors', 'kerr', 'thrown', 'newErrors'}


def scan(v, found):
    if isinstance(v, dict):
        for k, x in v.items():
            if k == 'inv' and not isinstance(x, (dict, list)):
                found.append(('inv', x is None or str(x) == 'ok' or str(x).startswith('none')))
            elif k in TRUE and isinstance(x, bool):
                found.append((k, x))
            elif k in EMPTY:
                found.append((k, not x))
            scan(x, found)
    elif isinstance(v, list):
        for x in v:
            scan(x, found)


cache = {}
cnt = collections.Counter()
per = collections.Counter()
fails = []
for f, rec, key, cls, a, b in db['detail']:
    if cls != 'only head':
        continue
    p = SP + '/second/probes/out/r1/' + f + '/' + rec
    if p not in cache:
        cache[p] = keyed(records(p)) if os.path.exists(p) else {}
    v = cache[p].get(str(key))
    if v is None:
        cnt['record not found'] += 1
        continue
    found = []
    scan(v, found)
    if not found:
        st = 'no invariant of its own'
    elif all(ok for _, ok in found):
        st = 'passes'
    else:
        st = 'fails'
        fails.append((f, rec, str(key), [k for k, ok in found if not ok]))
    cnt[st] += 1
    per[(f.split('/')[0], st)] += 1
print(dict(cnt))
for k, v in sorted(per.items()):
    print(v, k)
print(len(fails))
for x in fails[:20]:
    print(x)
json.dump({'counts': dict(cnt), 'byLens': {'%s|%s' % k: v for k, v in per.items()}, 'fails': fails}, open(SP + '/sc/probes_iii.json', 'w'), indent=1)
