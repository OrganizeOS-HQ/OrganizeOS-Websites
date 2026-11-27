"""Block type over a range (D2 by line, D1 for ordinary content: the head's conversion).
Relation, per leaf (each character, rule and image; line breaks aside, D3):
  - a unit is what Block type converts: in a lined item or a lined quote each line and each block child
    (a quote's paragraph counts as the block); an ordinary list item (without its nested list); a root block;
  - a unit converts when it meets the range (its ends included);
  - the leaves of the write are the stored leaves in the same order (no loss, no reorder);
  - a leaf whose unit does not convert keeps its chain of containers (tag names from the root);
  - a leaf whose unit converts has: in a lined container, its chain with the new block added around the line
    or put in place of the unit's block, the item and every container above it kept (D2: in place, inside its
    container); in an ordinary item or a root block, the new block at the root (the head's conversion: the
    item leaves its list, D1);
  - the letter typed after undo and redo stands inside an element of the action's tag.
"""
import common as C, ht, pos

TAG = {'H2': ['h2'], 'Qt': ['blockquote'], 'Cd': ['pre', 'code'], 'P': [], 'Paragraph': []}
BLK = {'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre'}


def is_block(c):
    return not isinstance(c, str) and c[0] in pos.BLOCKS


def leaf_info(html):
    """[(leaf, chain(tuple of tags), unit_id, kind)] for every leaf except line breaks and code new lines"""
    out = []
    uid = [0]

    def new_unit():
        uid[0] += 1
        return uid[0]

    def walk(n, chain, unit, kind):
        if isinstance(n, str):
            for ch in n:
                if ch != '\n':
                    out.append((ch, tuple(chain), unit, kind))
            return
        t = n[0]
        if t == 'br':
            return
        if t in ('hr', 'img'):
            out.append(('<' + t + '>', tuple(chain), unit, kind))
            return
        kids = n[1]
        if t == '#root':
            for c in kids:
                if is_block(c) and c[0] not in ('ul', 'ol', 'blockquote'):
                    walk(c, chain + [c[0]] if c[0] not in ('hr',) else chain, new_unit(), 'root', ) if c[0] != 'hr' else walk(c, chain, new_unit(), 'root')
                elif not isinstance(c, str) and c[0] in ('ul', 'ol', 'blockquote'):
                    walk_container(c, chain)
                else:
                    walk(c, chain, new_unit(), 'root')
            return
        for c in kids:
            walk(c, chain + ([c[0]] if not isinstance(c, str) and c[0] not in ('hr', 'img', 'br') and False else []), unit, kind)

    def walk_inline(c, chain, unit, kind):
        if isinstance(c, str) or c[0] in ('hr', 'img', 'br'):
            walk(c, chain, unit, kind)
        else:
            for x in c[1]:
                walk_inline(x, chain + [c[0]], unit, kind)

    def walk_container(n, chain, lp=()):
        t = n[0]
        ch = chain + [t]
        if t in ('ul', 'ol'):
            for li in n[1]:
                if isinstance(li, str):
                    continue
                walk_container(li, ch, lp)
            return
        kids = n[1]
        if t == 'li':
            lined = any(is_block(c) and not (not isinstance(c, str) and c[0] in ('ul', 'ol')) for c in kids)
        else:
            lined = any(is_block(c) for c in kids)
        if not lined:
            # ordinary item (or a quote holding only text): one unit; nested lists are containers of their own
            u = new_unit()
            for c in kids:
                if not isinstance(c, str) and c[0] in ('ul', 'ol'):
                    walk_container(c, ch, lp)
                else:
                    walk_inline(c, ch, u, ('ordinary', tuple(lp)))
            return
        run = None
        for c in kids:
            if not isinstance(c, str) and c[0] in ('ul', 'ol'):
                # in Lexical a list nested in an item stands in an item of its own (an ordinary nested
                # item); a list in a quote of a lined item is a block of that item (5.7, T70.1)
                run = None
                walk_container(c, ch, ch if t == 'blockquote' else lp)
            elif not isinstance(c, str) and c[0] == 'blockquote':
                run = None
                walk_container(c, ch, ch)
            elif is_block(c):
                run = None
                if c[0] == 'hr':
                    walk_inline(c, ch, new_unit(), 'rule')
                else:
                    u = new_unit()
                    for x in c[1]:
                        walk_inline(x, ch + [c[0]], u, 'block')
            else:
                if run is None:
                    run = new_unit()
                walk_inline(c, ch, run, 'line')
    walk(ht.parse(html), [], 0, 'root')
    return out


def expected_chain(chain, kind, tag):
    if kind == 'line':
        return chain + tuple(tag)
    if kind == 'block':
        base = chain[:-1]
        if chain[-1] == 'code' and len(chain) > 1 and chain[-2] == 'pre':
            base = chain[:-2]
        return base + tuple(tag)
    if isinstance(kind, tuple):
        return tuple(kind[1]) + (tuple(tag) if tag else ('p',))
    if kind in ('ordinary', 'root'):
        return tuple(tag) if tag else ('p',)
    return chain


def check(r):
    tr = C.trace(r)
    i = C.action_index(tr, lambda s: s.startswith('["block"'))
    if i is None:
        return False, 'no block step'
    tag = TAG.get(r['id'].split('|')[-1])
    if tag is None:
        return None, 'action not a block type'
    caret = C.caret_before(tr, i)
    e = C.ends(caret)
    pre = C.lib2.tidy(tr[i - 1].get('live'))
    w = C.write_of(tr, i)
    ps = [pos.resolve(pre, x) for x in e]
    if None in ps:
        return False, 'caret not resolved: ' + str(caret)[-80:]
    a, b = min(ps), max(ps)
    # leaf positions in the br-less, newline-less sequence
    full = ht.leaves(pre)
    idx = [j for j, x in enumerate(full) if x not in ('<br>', '\n')]
    A = sum(1 for j in idx if j < a)
    B = sum(1 for j in idx if j < b)
    P = leaf_info(pre)
    Wl = leaf_info(w)
    if [x[0] for x in P] != [x[0] for x in Wl]:
        return False, '(leaves) not the stored leaves in order'
    conv = set()
    # the units of the two ends: a text point is in its text's unit; an element point is in the unit of
    # the first leaf after it, or of the last leaf before it at its element's end
    def end_unit(pt, q):
        import re as _re
        m = _re.search(r'@(text|element):(\d+)(?:"(.*)")?$', pt)
        kind = m.group(1)
        k = sum(1 for j in idx if j < q)
        if kind == 'text':
            txt = m.group(3) or ''
            off = int(m.group(2))
            k2 = k if off < len(txt) else k - 1
        else:
            if not pos.exists(pre, pt):
                return None   # an empty caret line: a unit of its own with no leaves
            k2 = k if k < len(P) else k - 1
        if 0 <= k2 < len(P):
            return P[k2][2]
        return None
    for pt, q in zip(e, ps):
        u = end_unit(pt, q)
        if u is not None:
            conv.add(u)
    for j, x in enumerate(P):
        if A <= j < B and x[3] not in ('rule',):
            conv.add(x[2])
    conv = {u for u in conv if not any(x[2] == u and x[3] == 'rule' for x in P)}
    # a unit with no leaves inside the range but holding a point at its end
    for j, (x, y) in enumerate(zip(P, Wl)):
        want = expected_chain(x[1], x[3], tag) if x[2] in conv else x[1]
        if x[3] == 'rule' and x[2] not in conv:
            want = x[1]
        if y[1] != want:
            return False, 'leaf %d %r: chain %s, expected %s (%s, %s)' % (j, x[0], '/'.join(y[1]), '/'.join(want), x[3], 'converted' if x[2] in conv else 'kept')
    t = C.typed(tr)
    if t is None:
        return False, 'no typed letter'
    if tag:
        kpos = [j for j, x in enumerate(leaf_info(t[1])) if x[0] == 'k']
        Lk = leaf_info(t[1])
        if not kpos or tag[0] not in Lk[kpos[0]][1]:
            return False, 'the letter is not inside a %s' % tag[0]
    return True, 'every unit the range meets converted (lined: in place; ordinary: the head\'s, to the root); the rest unchanged; the letter in the new block'


if __name__ == '__main__':
    import collections, sys
    fam = [r for r in C.U if any(r['label'].startswith(x) for x in (
        'by class (to confirm per record): D2: Block type', 'by class (to confirm per record): D13',
        'D2 (P7', 'D2 with map 2', 'by class (to confirm per record): D2 / D13'))]
    mode = sys.argv[1] if len(sys.argv) > 1 else 'range'
    res = collections.Counter()
    bad = []
    for r in fam:
        tr = C.trace(r)
        i = C.action_index(tr, lambda s: s.startswith('["block"'))
        cr = C.caret_before(tr, i) if i is not None else None
        isr = cr is not None and ' -> ' in cr
        if mode == 'range' and not isr:
            continue
        try:
            ok, why = check(r)
        except Exception as ex:
            ok, why = False, 'exception ' + repr(ex)[:100]
        res[(r['label'][:30], ok)] += 1
        if ok is False:
            bad.append((r['id'], why))
    for k, v in sorted(res.items(), key=str):
        print(v, k)
    for x in bad[:int(sys.argv[2]) if len(sys.argv) > 2 else 40]:
        print(x)
