"""T82.3 item 2 / Q1: undo-vs-base.jsonl's cmps entries against the main run's comparison notes.
A cmps entry is [phase, snapshot, html-or-state, state] (lib2.engine_fields, lines 212 to 215): the third value
is the note's `html` where the engine records one and its `state` otherwise; the fourth is `state`. The note's
`caret` is not in the entry. Both come from the same records (SP/second/sets/<set>/out)."""
import json, gzip, collections, sys
sys.path.insert(0, '/tmp/claude-0/-home-user-OrganizeOS-Websites/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad/second/scripts')
import lib2
P = '/home/user/OrganizeOS-Websites/.claude/worktrees/agent-abb012d24ba04b6c7/apps/builder/app/builder/features/cms-panel/native/__records__/acceptance/second/'
cache = {}
cnt = collections.Counter()
fails = []
for l in gzip.open(P + 'undo-vs-base.jsonl.gz', 'rt'):
    r = json.loads(l)
    s = r['set']
    for side in ('base', 'r1'):
        if (s, side) not in cache:
            cache[(s, side)] = lib2.load(side, s)
        rec = cache[(s, side)].get(r['id'])
        cm = (r.get(side) or {}).get('cmps')
        if not cm or rec is None:
            continue
        f = lib2.engine_fields(rec)
        if f.get('cmps') == cm:
            cnt['entry equals the same run\'s notes'] += len(cm)
        else:
            cnt['differs'] += len(cm)
        notes = [t['note'] for t in rec['trace'] if t['step'].startswith('["cmp"') and isinstance(t.get('note'), dict)]
        for e in cm:
            if side == 'r1' and (e[2] is False or e[3] is False):
                fails.append((s, r['id'], e))
print(dict(cnt))
print('R1 entries with a false value', len(fails), collections.Counter((x[2][0], x[2][1], x[2][2], x[2][3]) for x in fails).most_common(8))
json.dump({'counts': dict(cnt), 'r1False': fails}, open('/tmp/claude-0/-home-user-OrganizeOS-Websites/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad/sc/uvb.json', 'w'), indent=1)
