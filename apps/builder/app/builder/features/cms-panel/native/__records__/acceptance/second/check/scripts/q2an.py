"""T82.3 item 2: for each record where undo-vs-base.jsonl gives R1 a false comparison, the re-run's D7 equality at
every comparison step (q2drive.py's patched engines), and the first D7 difference where there is one."""
import json, glob, collections
SP = '/tmp/claude-0/-home-user-OrganizeOS-Websites/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad'
out = {}
cnt = collections.Counter()
for p in sorted(glob.glob(SP + '/sc/q2run/out/r1-*.json')):
    s = p.split('/r1-')[1][:-5]
    for r in json.load(open(p)):
        steps = [t for t in r.get('trace', []) if t['step'].startswith('["cmp"')]
        row = []
        for t in steps:
            n = t.get('note') or {}
            row.append({'cmp': t['step'], 'state': n.get('state'), 'd7': n.get('d7'), 'caret': n.get('caret'), 'html': n.get('html'),
                        'firstRawDiff': n.get('rawDiff'), 'firstD7Diff': n.get('d7Diff')})
        bad = [x for x in row if x['d7'] is False]
        rawfalse = [x for x in row if x['state'] is False]
        k = 'D7-equal at every comparison' if not bad else 'a D7 difference'
        cnt[k] += 1
        cnt['caret false at R1'] += 1 if any(x['caret'] is False for x in row) else 0
        out['%s\t%s' % (s, r['id'])] = {'cmps': row, 'verdict': k, 'hung': r.get('hung')}
        if bad:
            print(s, r['id'], [(x['cmp'], (x['firstD7Diff'] or '')[100:260]) for x in bad][:1])
print(dict(cnt))
json.dump(out, open(SP + '/sc/q2an.json', 'w'), indent=1)
