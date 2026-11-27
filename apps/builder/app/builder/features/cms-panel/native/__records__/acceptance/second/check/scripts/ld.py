import sys, json, pickle, os, gzip, types
HERE = os.path.dirname(os.path.abspath(__file__))
SCRATCH = '/tmp/claude-0/-home-user-OrganizeOS-Websites/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad/second/scripts'
if os.path.isdir(SCRATCH):
    # the session's scratch directory: the second comparison's own lib2 and raw records
    sys.path.insert(0, SCRATCH)
    import lib2
else:
    # packaged: lib2.py beside this file (a copy of SCRATCH/lib2.py), its stored-value table read from
    # lib2-stored.json.gz in place of SP/t553/cases/stored.json, and no output directory made under SP
    src = open(HERE + '/lib2.py').read()
    src = src.replace("os.makedirs(OUTT, exist_ok=True)", "")
    src = src.replace("STORED = json.load(open(T + '/cases/stored.json'))",
                      "STORED = json.load(gzip.open(%r, 'rt'))" % (HERE + '/lib2-stored.json.gz'))
    lib2 = types.ModuleType('lib2')
    lib2.__file__ = HERE + '/lib2.py'
    lib2.gzip = gzip
    exec(compile('import gzip\n' + src, HERE + '/lib2.py', 'exec'), lib2.__dict__)
    sys.modules['lib2'] = lib2


def u1652():
    p = HERE + '/u1652.json'
    if os.path.exists(p):
        return json.load(open(p))
    return json.load(gzip.open(p + '.gz', 'rt'))


def full():
    p = HERE + '/full.pkl'
    if os.path.exists(p):
        return pickle.load(open(p, 'rb'))
    g = HERE + '/traces-1652.json.gz'
    if os.path.exists(g):
        # both builds' records of the 1,652, as full() built them from SP/second/: [set, id, side, record]
        return {(s, i, side): rec for s, i, side, rec in json.load(gzip.open(g, 'rt'))}
    u = u1652()
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
