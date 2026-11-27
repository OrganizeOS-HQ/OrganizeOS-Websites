import json, gzip, sys, re
sys.path.insert(0, '/tmp/claude-0/-home-user-OrganizeOS-Websites/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad/acceptance')
import ld, lib2
D = '/home/user/OrganizeOS-Websites/.claude/worktrees/agent-abb012d24ba04b6c7/apps/builder/app/builder/features/cms-panel/native/__records__/acceptance/second/'
recs = [json.loads(l) for l in gzip.open(D + 'differences.jsonl.gz', 'rt')]
sel = [r for r in recs if (('undo' in r['r1Flags'] and 'undo' not in r['baseFlags']) or ('redo' in r['r1Flags'] and 'redo' not in r['baseFlags']))]
print(len(sel))
import collections
print(collections.Counter(r['label'][:60] for r in sel))
cache = {}
out = []
for r in sel:
    s = r['set']
    for side in ('base', 'r1'):
        if (s, side) not in cache:
            cache[(s, side)] = lib2.load(side, s)
    row = {'set': s, 'id': r['id'], 'label': r['label'], 'stored': r['stored'], 'baseFlags': r['baseFlags'], 'r1Flags': r['r1Flags']}
    for side in ('base', 'r1'):
        x = cache[(s, side)].get(r['id'])
        if x is None:
            row[side] = None
            continue
        if 'trace' in x:
            st = []
            for t in x['trace']:
                if t['step'].startswith('["key","{Control>}') or t['step'].startswith('["cmp"') or t['step'].startswith('["an"]') or t['step'].startswith('["snap","m"') or t['step'].startswith('["snap","pre"'):
                    st.append({'step': t['step'], 'calls': t.get('calls'), 'caret': t.get('caret'), 'live': lib2.tidy(t.get('live')), 'note': t.get('note')})
            row[side] = st
        else:
            row[side] = {k: x.get(k) for k in ('undoState', 'undoDom', 'redoOk', 'undone', 'redone', 'written', 'afterUndo', 'afterRedo', 'undoHtml', 'redoHtml') if k in x}
            row[side + 'Keys'] = sorted(x.keys())
    out.append(row)
json.dump(out, open(ld.HERE + '/q1.json', 'w'), indent=1)
