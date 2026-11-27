"""T79.8 (ii): the 574 probe records on one side only between R1 at 0ae275f and R1 now, by file and side,
with each file's record count at both runs and the reason."""
import json, collections
SP = '/tmp/claude-0/-home-user-OrganizeOS-Websites/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad'
d = json.load(open(SP + '/second/probes/pcmp-h0-r1.json'))
rows = {r[0]: r for r in d['rows']}
side = collections.Counter()
for f, rec, key, cls, a, b in d['detail']:
    if cls == 'only base':
        side[(f, '0ae275f only')] += 1
    elif cls == 'only head':
        side[(f, 'R1 now only')] += 1
i3bb = json.load(open(SP + '/sc/i3bb.json'))
REASON = {
    'keys/zzv15-keys-i3fwda': 'the 0ae275f run did not finish (no test summary, exit 0 after 42 s, 280 of 630 records); R1 now finishes (1 passed, 630 records, every 0ae275f record present)',
    'keys/zzv15-keys-i3real': 'the 0ae275f run did not finish (no test summary, 200 of 381 records); R1 now finishes (1 passed, 381 records)',
    'keys/zzv15-keys-i3bb': 'R1 now holds fewer (480) than 0ae275f (513): re-run twice at d20016d (the code of a3bc7d8), both runs finish with 513 records, every key of 0ae275f\'s, the 33 missing records equal to 0ae275f\'s and the 480 equal to the second run\'s; the second run\'s file was short, not R1\'s behaviour',
    'keys/zzv15-keys-i3bwdb': 'R1 now holds 4 more (684) than 0ae275f (680; both runs passed): the four lineB cells of bwd|R|para|contentStart (twin, linkOut, linkIn, code) are recorded at R1 now only; R1 holds every 0ae275f record, so this is not a run that ended early at R1',
    'insert/zzq1-a-BQA-rerun': 'a re-run file made only in the acceptance run (defect 12\'s check); the second run ran each probe file of check 5 once and has no such file',
    'insert/zzq1-a-TAGS-rerun': 'as zzq1-a-BQA-rerun',
}
out = []
for (f, s), n in sorted(side.items()):
    r = rows.get(f)
    out.append({'file': f, 'side': s, 'records': n, 'tests0ae275f': r[1] if r else None, 'testsNow': r[2] if r else None,
                'reason': REASON.get(f, '?')})
print(sum(x['records'] for x in out))
for x in out:
    print(x['records'], x['file'], x['side'], x['reason'][:60])
json.dump(out, open(SP + '/sc/probes_ii.json', 'w'), indent=1)
