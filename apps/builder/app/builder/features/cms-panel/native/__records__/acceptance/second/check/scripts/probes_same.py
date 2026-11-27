"""T79.8: probe records unchanged at both builds since the acceptance run (base now = base at the acceptance
run, and R1 a3bc7d8 = R1 0ae275f), with pcmp2's normalisation (timing keys dropped)."""
import json, os, glob, collections
SP = '/tmp/claude-0/-home-user-OrganizeOS-Websites/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad'
src = open(SP + '/second/scripts/pcmp2.py').read()
ns = {}
exec(compile(src[:src.index('def tests(')], 'pcmp2', 'exec'), ns)
records, keyed, norm = ns['records'], ns['keyed'], ns['norm']
SIDES = {'base': SP + '/second/probes/out/base', 'r1': SP + '/second/probes/out/r1',
         'b0': SP + '/acceptance/probes/out/base', 'h0': SP + '/acceptance/probes/out/head'}


def load(side, fdir):
    out = {}
    for p in sorted(glob.glob(SIDES[side] + '/' + fdir + '/*')):
        b = os.path.basename(p)
        if not (b.endswith('.json') or b.endswith('.jsonl')):
            continue
        for k, v in keyed(records(p)).items():
            out[(b, k)] = json.dumps(norm(v), sort_keys=True)
    return out


fdirs = sorted({os.path.relpath(p, SIDES['r1']) for p in glob.glob(SIDES['r1'] + '/*/*')})
cnt = collections.Counter()
for fd in fdirs:
    S = {s: load(s, fd) for s in SIDES}
    for k in S['r1']:
        if k in S['base'] and k in S['b0'] and k in S['h0']:
            same = S['base'][k] == S['b0'][k] and S['r1'][k] == S['h0'][k]
            cnt['in all four runs'] += 1
            cnt['unchanged at both builds' if same else 'changed at a build'] += 1
            if same:
                cnt['unchanged, and equal base against R1' if S['base'][k] == S['r1'][k] else 'unchanged, base and R1 differ'] += 1
print(dict(cnt))
json.dump(dict(cnt), open(SP + '/sc/probes_same.json', 'w'), indent=1)
