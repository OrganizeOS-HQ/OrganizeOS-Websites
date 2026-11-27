"""lib2: lib553 for the second comparison (a3bc7d8 against the base, both run afresh).
Sides: base (acceptance/sets/<set>/out/base-*), old (R1 at 0ae275f = acceptance head-*),
new (R1 at 6845516 = t553/sets/<set>/out/r1-*)."""
import json, os, re, glob, sys, collections
from html.parser import HTMLParser
SP = '/tmp/claude-0/-home-user-OrganizeOS-Websites/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad'
A = SP + '/acceptance'
T = SP + '/t553'
OUTT = SP + '/second/out'
os.makedirs(OUTT, exist_ok=True)
SETS = ['toolbar', 'clipboard', 'keys-phase-1', 'keys-phase-2', 'gap-fill', 'paste-matrix', 'paste-sweeps']
UNDO = '{Control>}z{/Control}'
REDO = '{Control>}{Shift>}z{/Shift}{/Control}'
ACT = 'not wrapped in act'
STORED = json.load(open(T + '/cases/stored.json'))


def errs(lst):
    return [e for e in (lst or []) if isinstance(e, str) and ACT not in e and 'ReactDOMTestUtils.act' not in e]


def tidy(h):
    h = (h or '').replace('<hr>', '<hr />').replace('<br>', '<br />')
    return re.sub(r'<img [^>]*>', '<img />', h)


G = SP + '/second'
PATHS = {'base': (G + '/sets/%s/out/base-*.json', 'base-'),   # base 2a96a45, this run
         'r1': (G + '/sets/%s/out/r1-*.json', 'r1-'),        # R1 a3bc7d8, this run
         'b0': (A + '/sets/%s/out/base-*.json', 'base-'),    # base, acceptance run
         'h0': (A + '/sets/%s/out/head-*.json', 'head-'),    # R1 0ae275f, acceptance run
         'h6': (T + '/sets/%s/out/r1-*.json', 'r1-')}        # R1 6845516, first re-run


def path(side, setname):
    return PATHS[side][0] % setname


PORT = re.compile(r'http://localhost:\d+/')


def portnorm(x):
    """the image fixture's URL carries the dev server's port, which varies run to run"""
    if isinstance(x, str):
        return PORT.sub('http://localhost:PORT/', x)
    if isinstance(x, list):
        return [portnorm(v) for v in x]
    if isinstance(x, dict):
        return {k: portnorm(v) for k, v in x.items()}
    return x


def load(side, setname):
    recs = {}
    pre = PATHS[side][1]
    for f in sorted(glob.glob(path(side, setname))):
        batch = os.path.basename(f)[len(pre):-5]
        for r in portnorm(json.load(open(f))):
            key = batch + '::' + str(r.get('id'))
            n = 2
            while key in recs:
                key = batch + '::' + str(r.get('id')) + '#%d' % n; n += 1
            r['_batch'] = batch
            recs[key] = r
    return recs


# ---- lined-container classification (explain.py's tests) ----
BLOCK = {'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'hr', 'p', 'div', 'figure'}
INLINE = {'br', 'a', 'b', 'i', 'strong', 'em', 'img', 'span', 'code', 'u', 's'}


class Mixed(HTMLParser):
    def __init__(s):
        super().__init__(); s.stack = []; s.mixed = False

    def handle_starttag(s, tag, a):
        if s.stack:
            top = s.stack[-1]
            if top[0] in ('li', 'blockquote'):
                if (tag in BLOCK or (top[0] == 'blockquote' and tag in ('ul', 'ol'))) and not (top[0] == 'blockquote' and tag == 'p'):
                    top[2] = True
                if tag in BLOCK and top[0] == 'blockquote' and tag == 'p':
                    top[3] = True
                if tag in INLINE:
                    top[1] = True
        if tag in ('hr', 'br', 'img'):
            return
        s.stack.append([tag, False, False, False])

    def handle_startendtag(s, tag, a):
        s.handle_starttag(tag, a)

    def handle_endtag(s, tag):
        while s.stack:
            t = s.stack.pop()
            if t[0] in ('li', 'blockquote') and t[1] and (t[2] or t[3]):
                s.mixed = True
            if t[0] == tag:
                break

    def handle_data(s, d):
        if d.strip() and s.stack and s.stack[-1][0] in ('li', 'blockquote'):
            s.stack[-1][1] = True


def mixed(html):
    p = Mixed(); p.feed(html or ''); p.close()
    return p.mixed


def lined_stored(stored):
    s = stored or ''
    return bool(mixed(s) or re.search(r'<li>(<br>|<br />)*<(hr|blockquote|pre|h3|h2|div)', s)
                or re.search(r'<blockquote>[^<]|</p>[A-Za-z]', s))


def has_line_node(r):
    """any caret path in the record names a line node"""
    for t in r.get('trace', []) or []:
        c = t.get('caret') or ''
        if 'line' in c.lower():
            return True
    for k in ('caret', 'selCaret', 'typedCaret', 'pasteCaret'):
        if 'line' in str(r.get(k) or '').lower():
            return True
    return False


def stored_of(setname, r):
    if setname.startswith('paste'):
        e = STORED.get(r['_batch'], {}).get(str(r.get('i')))
        return e['stored'] if e else None
    return r.get('html')


# ---- engine records ----
def steps(r):
    out = []
    for t in r.get('trace', []) or []:
        try:
            st = json.loads(t['step'])
        except Exception:
            st = [t['step']]
        out.append((st, t))
    return out


def is_undo(st):
    return st[0] == 'key' and len(st) > 1 and st[1] == UNDO


def is_redo(st):
    return st[0] == 'key' and len(st) > 1 and st[1] == REDO


def is_type(st):
    return st[0] == 'typeK' or (st[0] == 'key' and len(st) > 1 and isinstance(st[1], str) and re.fullmatch(r'[A-Za-z]', st[1]))


def engine_fields(r):
    """undo/redo facts of one engine record; None values where the record has no such step"""
    if r.get('hung'):
        return {'status': 'hung'}
    if r.get('crashed'):
        return {'status': 'crashed', 'crashed': r['crashed'][:200]}
    if r.get('skipped'):
        return {'status': 'skipped'}
    S = steps(r)
    u = next((i for i, (st, t) in enumerate(S) if is_undo(st)), None)
    f = {'status': 'ok'}
    # the write: the last ["an"] before the first undo (or the last one at all)
    ans = [(i, t) for i, (st, t) in enumerate(S) if st[0] == 'an' and (u is None or i < u)]
    if not ans:
        ans = [(i, t) for i, (st, t) in enumerate(S) if st[0] == 'an']
    note = ans[-1][1].get('note') if ans else None
    f['anIndex'] = ans[-1][0] if ans else None
    if isinstance(note, dict) and 'write' in note:
        f['write'] = note['write']; f['fixedPoint'] = note.get('fixedPoint'); f['readOnly'] = note.get('readOnly')
        f['headless'] = note.get('headless')
    elif isinstance(note, dict) and note.get('none'):
        f['write'] = None; f['noWrite'] = True
    else:
        f['write'] = None; f['noAn'] = True
    f['errors'] = errs(r.get('errors')) + [e for st, t in S for e in errs(t.get('newErrors'))]
    f['errors'] = list(dict.fromkeys(f['errors']))
    if u is None:
        f['noUndo'] = True
        return f
    # target snapshot: the first cmp after the first undo
    cm = next(((i, st) for i, (st, t) in enumerate(S) if i > u and st[0] == 'cmp'), None)
    target = cm[1][1] if cm else None
    snapi = None
    if target is not None:
        cands = [i for i, (st, t) in enumerate(S) if i < u and st[0] == 'snap' and st[1] == target]
        snapi = cands[-1] if cands else None
    f['target'] = target
    f['pre'] = S[snapi][1].get('live') if snapi is not None else None
    f['actions'] = [S[i][0][0] + (':' + str(S[i][0][1]) if S[i][0][0] == 'key' else '') for i in range(snapi + 1 if snapi is not None else 0, u)
                    if S[i][0][0] not in ('snap', 'an', 'cmp', 'refocus', 'checkLines')]
    # undo run, redo run
    undos, redos = [], []
    i = u; prevcalls = S[u - 1][1].get('calls', 0) if u > 0 else 0
    phase = 'u'; typed = None; cmps = []
    for j in range(u, len(S)):
        st, t = S[j]
        calls = t.get('calls', 0)
        if is_undo(st) and phase == 'u':
            undos.append({'live': t.get('live'), 'calls': calls - prevcalls})
        elif is_redo(st) and phase in ('u', 'r'):
            phase = 'r'; redos.append({'live': t.get('live'), 'calls': calls - prevcalls})
        elif st[0] in ('cmp', 'snap', 'refocus'):
            if st[0] == 'cmp' and isinstance(t.get('note'), dict):
                n = t['note']
                cmps.append([phase, st[1], n.get('html', n.get('state')), n.get('state')])
        elif is_type(st) and phase == 'r':
            typed = {'live': t.get('live'), 'calls': calls - prevcalls}
            break
        else:
            if phase == 'r' or (phase == 'u' and not is_undo(st)):
                break
        prevcalls = calls
    f['undos'] = undos; f['redos'] = redos; f['typed'] = typed; f['cmps'] = cmps
    pre = f['pre']
    f['undoSteps'] = next((k + 1 for k, x in enumerate(undos) if pre is not None and x['live'] == pre), None)
    return f


# ---- paste-case records ----
def case_fields(r, stored):
    if r.get('hung'):
        return {'status': 'hung'}
    if r.get('crashed'):
        return {'status': 'crashed', 'crashed': r['crashed'][:200]}
    f = {'status': 'ok'}
    w = r.get('written')
    if w is None and 'pasted' in r:  # sweeps E: the edit after a paste
        f['write'] = r.get('after'); f['edit'] = r.get('edit')
    else:
        f['write'] = None if (w is None or w == '(no change)') else w
        f['noWrite'] = w == '(no change)'
    f['changes'] = r.get('changes')
    for k in ('undoState', 'undoDom', 'undoChanges', 'redoOk', 'redoChanges', 'typed', 'typedOk', 'typeChanges',
              'reloadHeadless', 'reloadReadOnly', 'reloadChanges', 'afterUndo', 'undone', 'failed'):
        if k in r:
            f[k] = r[k]
    f['errors'] = errs(r.get('errors'))
    return f


def fields(setname, r):
    if setname.startswith('paste'):
        return case_fields(r, stored_of(setname, r))
    return engine_fields(r)


def undo_sig(setname, f):
    """the undo-relevant fields compared between builds"""
    if f.get('status') != 'ok':
        return {'status': f.get('status')}
    if setname.startswith('paste'):
        return {k: f.get(k) for k in ('undoState', 'undoDom', 'undoChanges', 'redoOk', 'redoChanges', 'typed', 'typedOk',
                                      'typeChanges', 'afterUndo', 'undone')}
    return {'undoSteps': f.get('undoSteps'),
            'undo': [x['live'] for x in f.get('undos', [])], 'undoCalls': [x['calls'] for x in f.get('undos', [])],
            'redo': [x['live'] for x in f.get('redos', [])], 'redoCalls': [x['calls'] for x in f.get('redos', [])],
            'typed': (f.get('typed') or {}).get('live'), 'typedCalls': (f.get('typed') or {}).get('calls'),
            'cmps': f.get('cmps')}
