"""q2drive.py <side base|r1> <set> <ids.json>: re-run records of one set through that set's own engine, patched so
that every cmp note also gives D7's equality (`d7`: every `direction` and every empty line left out; toJSON
holds no node keys), the first raw difference and the first D7 difference. timeout 600."""
import json, os, subprocess, sys, shutil, glob, re
SP = '/tmp/claude-0/-home-user-OrganizeOS-Websites/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad'
A = SP + '/acceptance'
N = 'apps/builder/app/builder/features/cms-panel/native'
side, setname, idsf = sys.argv[1:4]
W = {'r1': '/home/user/OrganizeOS-Websites/.claude/worktrees/agent-abb012d24ba04b6c7', 'base': SP + '/r1-base'}[side]
ENGINE = 'zzh2-fill-engine' if setname == 'gap-fill' else 'engine'
SUB = 'zzacc-gap-fill' if setname == 'gap-fill' else 'zzq2-' + setname
D = W + '/' + N + '/' + SUB
SRC = A + '/sets/' + setname + '/src'
OUT = SP + '/sc/q2run/out'
os.makedirs(OUT, exist_ok=True)
shutil.rmtree(D, ignore_errors=True)
os.makedirs(D)
for f in os.listdir(SRC):
    if ((f.endswith('.tsx') or f.endswith('.ts')) and not f.endswith('.test.tsx')) or f.endswith('.png'):
        shutil.copy(SRC + '/' + f, D + '/' + f)
p = D + '/' + ENGINE + '.tsx'
s = open(p).read()
old = 'state: snap?.state === stateOf(),'
assert s.count(old) == 1, s.count(old)
s = s.replace(old, old + ' d7: d7Norm(snap?.state) === d7Norm(stateOf()), rawDiff: firstDiff(snap?.state, stateOf()), d7Diff: firstDiff(d7Norm(snap?.state), d7Norm(stateOf())),')
helper = open(SP + '/sc/d7helper.ts').read()
i = s.index('export const runAll')
s = s[:i] + helper + s[i:]
open(p, 'w').write(s)
want = json.load(open(idsf))
batch = []
for b, i in want:
    src = json.load(open(A + '/sets/%s/gen/batch-%s.json' % (setname, b)))
    hit = [x for x in src if x['id'] == i]
    assert hit, (b, i)
    batch.append(hit[0])
json.dump(batch, open(D + '/batch-q2.json', 'w'))
test = SUB + '-q2.test.tsx'
open(D + '/' + test, 'w').write('''// scratch, never committed
import { test } from "vitest";
import { runAll } from "./%s";
import batch from "./batch-q2.json";

test("q2", async () => {
  await runAll("q2", batch as never, 0);
}, 7_200_000);
''' % ENGINE)
env = dict(os.environ, PLAYWRIGHT_BROWSERS_PATH='/home/user/pw-browsers')
env.pop('VITE_LINES_OFF', None)
log = open(OUT + '/log-%s-%s.txt' % (side, setname), 'w')
rc = subprocess.run(['timeout', '-s', 'KILL', '600', 'pnpm', '--filter', '@webstudio-is/builder', 'exec', 'vitest', 'run',
                     '--project', 'core-browser-builder-cms', 'app/builder/features/cms-panel/native/%s/%s' % (SUB, test)],
                    cwd=W, env=env, stdout=log, stderr=subprocess.STDOUT).returncode
records = []
for f in sorted(glob.glob(D + '/out-q2-r*.json')):
    records += json.load(open(f))
json.dump(records, open(OUT + '/%s-%s.json' % (side, setname), 'w'))
shutil.rmtree(D, ignore_errors=True)
print('DONE', side, setname, 'rc', rc, 'records', len(records), 'of', len(batch))
