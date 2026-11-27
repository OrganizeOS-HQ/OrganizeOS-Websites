"""i3bb: R1 re-run at d20016d (twice) against R1 at 0ae275f and the second run's R1 file."""
import json, sys, importlib.util
SP = '/tmp/claude-0/-home-user-OrganizeOS-Websites/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad'
sys.argv = ['x', 'h0', 'r1']
spec = importlib.util.spec_from_file_location('p2', SP + '/second/scripts/pcmp2.py')
src = open(SP + '/second/scripts/pcmp2.py').read()
cut = src.index('\nif __name__') if '\nif __name__' in src else None
ns = {}
exec(compile(src[:src.index('def tests(')], 'pcmp2', 'exec'), ns)
records, keyed, norm = ns['records'], ns['keyed'], ns['norm']
F = '/keys/zzv15-keys-i3bb/out-i3bb.json'
h0 = keyed(records(SP + '/acceptance/probes/out/head' + F))
r1 = keyed(records(SP + '/second/probes/out/r1' + F))
ra = keyed(records(SP + '/sc/probes/out/r1/keys/zzv15-keys-i3bb/out-i3bb.json'))
rb = keyed(records(SP + '/sc/probes/out/r1/keys/zzv15-keys-i3bb-b/out-i3bb.json'))
missing = [k for k in h0 if k not in r1]
print('h0', len(h0), 'second r1', len(r1), 'rerun', len(ra), len(rb), 'missing in second run', len(missing))
print('rerun keys == h0 keys', set(ra) == set(h0), set(rb) == set(h0))
eq = sum(1 for k in missing if json.dumps(norm(ra.get(k)), sort_keys=True) == json.dumps(norm(h0[k]), sort_keys=True))
eqb = sum(1 for k in missing if json.dumps(norm(ra.get(k)), sort_keys=True) == json.dumps(norm(rb.get(k)), sort_keys=True))
same_rest = sum(1 for k in r1 if json.dumps(norm(ra.get(k)), sort_keys=True) == json.dumps(norm(r1[k]), sort_keys=True))
print('the 33 at the rerun equal to 0ae275f', eq, 'rerun a == b', eqb, 'the 480 equal between second run and rerun', same_rest)
print('missing keys sample', missing[:5])
json.dump({'h0': len(h0), 'second': len(r1), 'rerun': [len(ra), len(rb)], 'missing': missing, 'missingEqualTo0ae275f': eq,
           'rerunsAgree': eqb, 'secondRunRecordsEqualToRerun': same_rest}, open(SP + '/sc/i3bb.json', 'w'), indent=1)
