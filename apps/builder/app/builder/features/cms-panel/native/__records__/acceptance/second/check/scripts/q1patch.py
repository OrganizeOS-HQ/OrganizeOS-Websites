import shutil, os
SP = '/tmp/claude-0/-home-user-OrganizeOS-Websites/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad'
D = SP + '/sc/q1run/src'
os.makedirs(D, exist_ok=True)
for f in ('engine.tsx', 'harness.tsx'):
    shutil.copy(SP + '/acceptance/sets/keys-phase-2/src/' + f, D + '/' + f)
p = D + '/engine.tsx'
s = open(p).read()
old = '''        note = {
          state: snap?.state === stateOf(),
          caret: snap?.caret === selInfo(),
        };'''
new = '''        const nowState = stateOf();
        note = {
          state: snap?.state === nowState,
          caret: snap?.caret === selInfo(),
          d7: d7Norm(snap?.state) === d7Norm(nowState),
          rawDiff: firstDiff(snap?.state, nowState),
          d7Diff: firstDiff(d7Norm(snap?.state), d7Norm(nowState)),
          snapCaret: snap?.caret,
          nowCaret: selInfo(),
        };'''
assert old in s
s = s.replace(old, new)
helper = '''
// zzq1: D7's equality (direction left out, empty lines left out) and the first raw difference
const d7Strip = (n: unknown): unknown => {
  if (Array.isArray(n)) {
    return n
      .filter(
        (c) =>
          !(
            c &&
            typeof c === "object" &&
            (c as { type?: string }).type === "cms-line" &&
            Array.isArray((c as { children?: unknown[] }).children) &&
            (c as { children: unknown[] }).children.length === 0
          ),
      )
      .map(d7Strip);
  }
  if (n && typeof n === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(n)) {
      if (k === "direction") continue;
      o[k] = d7Strip(v);
    }
    return o;
  }
  return n;
};
const d7Norm = (s: string | undefined) =>
  s === undefined ? "" : JSON.stringify(d7Strip(JSON.parse(s)));
const firstDiff = (a: string | undefined, b: string | undefined) => {
  if (a === undefined || b === undefined) return "missing";
  if (a === b) return "";
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return a.slice(Math.max(0, i - 150), i + 150) + " || " + b.slice(Math.max(0, i - 150), i + 150);
};
'''
i = s.index('export const runAll')
s = s[:i] + helper + s[i:]
open(p, 'w').write(s)
print('patched')
