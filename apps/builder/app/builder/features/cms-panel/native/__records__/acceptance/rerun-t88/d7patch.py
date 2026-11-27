#!/usr/bin/env python3
"""d7patch.py : copies the three sets' engines (SP/acceptance/sets/<set>/src) to SP/rerun-t88/src/<set>
and gives the cmp step D7's normalisation (T85.1): `state` is now the D7 comparison (every `direction`
key and every cms-line with no children left out; toJSON carries no node keys), `stateRaw` keeps the raw one.
Also patches a keys probe lens copy (harness.tsx, eng.tsx) when called as: d7patch.py probe <dir>."""
import os, re, shutil, sys
SP = '/tmp/claude-0/-home-user-OrganizeOS-Websites/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad'
D7 = '''
// D7's state (T85.1, rerun-t88): every "direction" key and every cms-line with no children left out.
const stripD7 = (v: unknown): unknown => {
  if (Array.isArray(v))
    return v
      .filter((c) => !(c && typeof c === "object" && (c as { type?: string }).type === "cms-line" && Array.isArray((c as { children?: unknown[] }).children) && (c as { children: unknown[] }).children.length === 0))
      .map(stripD7);
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) {
      if (k === "direction") continue;
      o[k] = stripD7((v as Record<string, unknown>)[k]);
    }
    return o;
  }
  return v;
};
export const stateD7 = () => JSON.stringify(stripD7(editorOf()!.getEditorState().toJSON()));
'''


def sub1(text, old, new, path):
    if text.count(old) != 1:
        raise SystemExit('pattern count %d in %s: %r' % (text.count(old), path, old[:60]))
    return text.replace(old, new)


def harness(path):
    t = open(path).read()
    anchor = 'export const stateOf = () =>\n  JSON.stringify(editorOf()!.getEditorState().toJSON());\n'
    t = sub1(t, anchor, anchor + D7, path)
    open(path, 'w').write(t)


def engine(path, harnessmod):
    t = open(path).read()
    t = sub1(t, '  stateOf,\n  unmount,\n  type Where,\n} from "./%s";' % harnessmod,
             '  stateOf,\n  stateD7,\n  unmount,\n  type Where,\n} from "./%s";' % harnessmod, path)
    t, n = re.subn(r'const snaps = new Map<string, \{ state: string; caret: string(; html: string)? \}>\(\);',
                   lambda m: 'const snaps = new Map<string, { state: string; d7: string; caret: string%s }>();' % (m.group(1) or ''), t)
    assert n == 1, path
    t = sub1(t, 'snaps.set(step[1], { state: stateOf(), ', 'snaps.set(step[1], { state: stateOf(), d7: stateD7(), ', path)
    t = sub1(t, '          state: snap?.state === stateOf(),\n',
             '          state: snap?.d7 === stateD7(),\n          stateRaw: snap?.state === stateOf(),\n', path)
    open(path, 'w').write(t)


def probe(d):
    harness(d + '/harness.tsx')
    p = d + '/eng.tsx'
    t = open(p).read()
    t = sub1(t, '  stateOf,\n', '  stateOf,\n  stateD7,\n', p)
    t = sub1(t, '    const mountState = stateOf();\n', '    const mountState = stateOf();\n    const mountD7 = stateD7();\n', p)
    t = sub1(t, '    const beforeState = stateOf();\n', '    const beforeState = stateOf();\n    const beforeD7 = stateD7();\n', p)
    t = sub1(t, '      rec.invariant = live === before && stateOf() === beforeState ? true : live === before ? "stateDiffers" : false;\n',
             '      rec.invariant = live === before && stateD7() === beforeD7 ? true : live === before ? "stateDiffers" : false;\n'
             '      rec.invariantRaw = live === before && stateOf() === beforeState ? true : live === before ? "stateDiffers" : false;\n', p)
    t = sub1(t, '    rec.mountStateSame = stateOf() === mountState;\n',
             '    rec.mountStateSame = stateD7() === mountD7;\n    rec.mountStateSameRaw = stateOf() === mountState;\n', p)
    open(p, 'w').write(t)


if len(sys.argv) > 2 and sys.argv[1] == 'probe':
    probe(sys.argv[2])
    sys.exit()
for s in ['keys-phase-1', 'keys-phase-2', 'gap-fill']:
    src = SP + '/acceptance/sets/' + s + '/src'
    dst = SP + '/rerun-t88/src/' + s
    shutil.rmtree(dst, ignore_errors=True)
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns('__pycache__'))
    if s == 'gap-fill':
        harness(dst + '/zzh2-fill-harness.tsx')
        engine(dst + '/zzh2-fill-engine.tsx', 'zzh2-fill-harness')
    else:
        harness(dst + '/harness.tsx')
        engine(dst + '/engine.tsx', 'harness')
    print('patched', s)
