"""R-WALK (K8, T29.2, 16.17; D15; D18 step 1): an arrow walk at R1
  (a) its stops move one way through the document: their leaf positions never step back against the
      walk's direction, and no text stop (text and offset) repeats (no cycle back, K8);
  (b) at every stop where a letter was typed, the letter lands at the stop: at a node-selected rule or
      image directly after the node (D15), at a caret at its leaf position (D18), and nothing else changes.
"""
import re, json
import common as C, ht, pos, chk_more as M


def node_pos(html, caret):
    """leaf index just after a node-selected rule or image"""
    m = re.match(r'nodes:(.*)$', caret)
    if not m:
        return None
    path = m.group(1)
    parent, last = path.rsplit('/', 1)
    mm = re.match(r'([\w-]+)\[(\d+)\]', last)
    p = pos.resolve(html, '%s@element:%s' % (parent, mm.group(2)))
    return None if p is None else p + 1


def check(r):
    tr = C.trace(r)
    ws = [t for t in tr if t['step'].startswith('["walk"')]
    if not ws:
        return None, 'no walk'
    st = json.loads(ws[0]['step'])
    right = 'Right' in st[1] or 'Down' in st[1]
    stops = ws[0].get('note') or []
    html = C.lib2.tidy(r['stored'])
    pre = C.lib2.tidy(tr[0].get('live')) or html
    lastp = None
    seen = set()
    for s in stops:
        c = s.get('c') or ''
        if c.startswith('nodes:'):
            p = node_pos(pre, c)
            p0 = None if p is None else p - 1
        else:
            p = pos.resolve(pre, c)
            p0 = p
            m = re.search(r'@text:(\d+)"(.*)"$', c)
            if m:
                key = (m.group(2), m.group(1))
                if key in seen:
                    return False, '(a) a text stop repeats: %s' % (key,)
                seen.add(key)
        if p0 is None:
            return False, '(a) stop not resolved: ' + c[-50:]
        if lastp is not None and ((right and p0 < lastp) or (not right and p0 > lastp)):
            return False, '(a) the walk steps back at %s' % c[-50:]
        lastp = p0
        if 'k' in s and s['k']:
            a = M.nbl(pre)
            q = M.nbi(ht.leaves(pre), p)
            if M.nbl(C.lib2.tidy(s['k'])) != a[:q] + ['k'] + a[q:]:
                return False, '(b) the letter at stop %s does not land there' % c[-50:]
    return True, 'one way, no stop repeated; every letter at its stop (after a selected node)'
