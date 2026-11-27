"""A small HTML tree for the field's written values.
A node is [tag, children] (a list); a text is a str. Void tags: hr, br, img."""
from html.parser import HTMLParser
import re

VOID = {'hr', 'br', 'img'}


class _P(HTMLParser):
    def __init__(s):
        super().__init__(convert_charrefs=True)
        s.root = ['#root', []]
        s.stack = [s.root]

    def handle_starttag(s, tag, attrs):
        a = dict(attrs)
        n = [tag, []]
        if tag == 'a':
            n.append(a.get('href'))
        s.stack[-1][1].append(n)
        if tag not in VOID:
            s.stack.append(n)

    def handle_startendtag(s, tag, attrs):
        a = dict(attrs)
        n = [tag, []]
        s.stack[-1][1].append(n)

    def handle_endtag(s, tag):
        if tag in VOID:
            return
        for i in range(len(s.stack) - 1, 0, -1):
            if s.stack[i][0] == tag:
                del s.stack[i:]
                return

    def handle_data(s, d):
        ch = s.stack[-1][1]
        if ch and isinstance(ch[-1], str):
            ch[-1] += d
        else:
            ch.append(d)


def parse(h):
    p = _P()
    p.feed(h or '')
    p.close()
    return p.root


def ser(n):
    if isinstance(n, str):
        return n
    t, ch = n[0], n[1]
    inner = ''.join(ser(c) for c in ch)
    if t == '#root':
        return inner
    if t in VOID:
        return '<%s />' % t
    if t == 'a':
        return '<a>%s</a>' % inner
    return '<%s>%s</%s>' % (t, inner, t)


def canon(h):
    return ser(parse(h))


def tokens(n, out=None, keep_br=True):
    """leaf content in document order: each character, 'hr', 'img', 'br'"""
    if out is None:
        out = []
    if isinstance(n, str):
        out.extend(list(n))
        return out
    if n[0] in VOID:
        if n[0] != 'br' or keep_br:
            out.append('<' + n[0] + '>')
        return out
    for c in n[1]:
        tokens(c, out, keep_br)
    return out


def words(h):
    return re.findall(r'[A-Za-z0-9]+', re.sub(r'<[^>]*>', ' ', h or ''))


def leaves(h, keep_br=True):
    return tokens(parse(h), keep_br=keep_br)


def unwrap(n, tags):
    """replace every element whose tag is in tags by its children"""
    if isinstance(n, str):
        return n
    ch = []
    for c in n[1]:
        c2 = unwrap(c, tags)
        if not isinstance(c2, str) and c2[0] in tags:
            ch.extend(c2[1])
        else:
            ch.append(c2)
    # merge adjacent text
    m = []
    for c in ch:
        if isinstance(c, str) and m and isinstance(m[-1], str):
            m[-1] += c
        else:
            m.append(c)
    return [n[0], m] + n[2:]


def drop(n, tags):
    """remove every element whose tag is in tags (with its content)"""
    if isinstance(n, str):
        return n
    ch = []
    for c in n[1]:
        if not isinstance(c, str) and c[0] in tags:
            continue
        ch.append(drop(c, tags))
    m = []
    for c in ch:
        if isinstance(c, str) and m and isinstance(m[-1], str):
            m[-1] += c
        else:
            m.append(c)
    return [n[0], m] + n[2:]


def count(n, tag):
    if isinstance(n, str):
        return 0
    return (1 if n[0] == tag else 0) + sum(count(c, tag) for c in n[1])


def elements(n, path=()):
    """yield (path, node) for every element"""
    if isinstance(n, str):
        return
    yield path, n
    for i, c in enumerate(n[1]):
        yield from elements(c, path + (i,))


def empty_containers(n):
    """elements that hold nothing (no text, no void child) other than void tags themselves"""
    out = []
    for p, e in elements(n):
        if e[0] in VOID or e[0] == '#root':
            continue
        if not tokens(e):
            out.append(e[0])
    return out
