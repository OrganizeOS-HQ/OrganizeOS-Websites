"""q1drive.py <side base|r1> <name> <ids.json>
Runs the named scenarios (set, batch, id) through the patched keys engine at one build, under timeout 600."""
import json, os, subprocess, sys, shutil, glob
SP = '/tmp/claude-0/-home-user-OrganizeOS-Websites/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad'
A = SP + '/acceptance'
N = 'apps/builder/app/builder/features/cms-panel/native'
side, name, idsf = sys.argv[1:4]
W = {'r1': '/home/user/OrganizeOS-Websites/.claude/worktrees/agent-abb012d24ba04b6c7', 'base': SP + '/r1-base'}[side]
SUB = 'zzq1-' + name
D = W + '/' + N + '/' + SUB
SRC = SP + '/sc/q1run/src'
OUT = SP + '/sc/q1run/out'
os.makedirs(OUT, exist_ok=True)
os.makedirs(D, exist_ok=True)
for f in os.listdir(SRC):
    shutil.copy(SRC + '/' + f, D + '/' + f)
want = json.load(open(idsf))
batch = []
for s, b, i in want:
    src = json.load(open(A + '/sets/%s/gen/batch-%s.json' % (s, b)))
    hit = [x for x in src if x['id'] == i]
    assert hit, (s, b, i)
    batch.append(hit[0])
json.dump(batch, open(D + '/batch-%s.json' % name, 'w'))
test = SUB + '.test.tsx'
open(D + '/' + test, 'w').write('''// scratch, never committed
import { test } from "vitest";
import { runAll } from "./engine";
import batch from "./batch-%s.json";

test("%s", async () => {
  await runAll("%s", batch as never, 0);
}, 7_200_000);
''' % (name, name, name))
env = dict(os.environ, PLAYWRIGHT_BROWSERS_PATH='/home/user/pw-browsers')
env.pop('VITE_LINES_OFF', None)
log = open(OUT + '/log-%s-%s.txt' % (side, name), 'w')
rc = subprocess.run(['timeout', '-s', 'KILL', '600', 'pnpm', '--filter', '@webstudio-is/builder', 'exec', 'vitest', 'run',
                     '--project', 'core-browser-builder-cms', 'app/builder/features/cms-panel/native/%s/%s' % (SUB, test)],
                    cwd=W, env=env, stdout=log, stderr=subprocess.STDOUT).returncode
records = []
for f in sorted(glob.glob(D + '/out-%s-r*.json' % name)):
    records += json.load(open(f))
json.dump(records, open(OUT + '/%s-%s.json' % (side, name), 'w'))
shutil.rmtree(D, ignore_errors=True)
print('DONE', side, name, 'rc', rc, 'records', len(records), 'of', len(batch))
