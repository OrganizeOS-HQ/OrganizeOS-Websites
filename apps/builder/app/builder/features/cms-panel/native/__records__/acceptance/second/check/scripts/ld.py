import sys, json, pickle, os
sys.path.insert(0, '/tmp/claude-0/-home-user-OrganizeOS-Websites/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad/second/scripts')
import lib2
HERE = os.path.dirname(os.path.abspath(__file__))


def full():
    p = HERE + '/full.pkl'
    if os.path.exists(p):
        return pickle.load(open(p, 'rb'))
    u = json.load(open(HERE + '/u1652.json'))
    need = {}
    for r in u:
        need.setdefault(r['set'], set()).add(r['id'])
    out = {}
    for s, ids in need.items():
        for side in ('base', 'r1'):
            recs = lib2.load(side, s)
            for k in ids:
                out[(s, k, side)] = recs.get(k)
    pickle.dump(out, open(p, 'wb'))
    return out


def short(r):
    if r is None:
        return 'NONE'
    o = []
    for t in r.get('trace', []) or []:
        o.append('  %-34s c=%-55s on=%s | %s' % (t['step'][:34], (t.get('caret') or '')[-55:], t.get('calls'), lib2.tidy(t.get('live'))))
    return '\n'.join(o)
