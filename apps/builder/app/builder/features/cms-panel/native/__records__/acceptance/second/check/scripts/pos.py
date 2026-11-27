"""Map a recorded caret (Lexical path @ text:N "string" or @ element:N) to a position in the
leaf sequence of an HTML value (ht.tokens with line breaks kept)."""
import re
import ht

BLOCKS = {'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'hr', 'p', 'ul', 'ol', 'div', 'figure'}
LEX = {'ul': 'list', 'ol': 'list', 'li': 'listitem', 'p': 'paragraph', 'blockquote': 'quote',
       'pre': 'code', 'hr': 'horizontalrule', 'img': 'image', 'br': 'linebreak', 'a': 'link'}
INLINE_FMT = {'b', 'i', 'strong', 'em', 'u', 's', 'span', 'sub', 'sup'}


def lexname(tag):
    if tag in LEX:
        return LEX[tag]
    if re.match(r'h[1-6]$', tag):
        return 'heading'
    return tag


def is_block(c):
    return not isinstance(c, str) and c[0] in BLOCKS


def lex_tree(n):
    """build [name, children, html_node] with cms-line nodes around inline runs of lined containers"""
    if isinstance(n, str):
        return ['text', [], n]
    tag = n[0]
    if tag == 'pre':
        # <pre><code>..</code></pre> is one code node holding the code's children
        inner = n[1][0][1] if n[1] and not isinstance(n[1][0], str) and n[1][0][0] == 'code' else n[1]
        return ['code', [lex_tree(c) for c in _flat(inner)], n]
    kids = _flat(n[1])
    if tag in ('ul', 'ol'):
        # Lexical holds a nested list in a list item of its own after the item's other content
        items = []
        for c in kids:
            if not isinstance(c, str) and c[0] == 'li':
                cc = _flat(c[1])
                lists = [x for x in cc if not isinstance(x, str) and x[0] in ('ul', 'ol')]
                rest = [x for x in cc if not (not isinstance(x, str) and x[0] in ('ul', 'ol'))]
                if lists and rest:
                    items.append(lex_tree(['li', rest]))
                    for L in lists:
                        items.append(['listitem', [lex_tree(L)], None])
                    continue
            items.append(lex_tree(c))
        return ['list', items, n]
    if tag in ('li', 'blockquote') and any(is_block(c) for c in kids) and any(not is_block(c) for c in kids):
        out = []
        run = []
        for c in kids:
            if is_block(c):
                if run:
                    out.append(['cms-line', [lex_tree(x) for x in run], None])
                    run = []
                out.append(lex_tree(c))
            else:
                run.append(c)
        if run:
            out.append(['cms-line', [lex_tree(x) for x in run], None])
        return [lexname(tag), out, n]
    return [lexname(tag) if tag != '#root' else 'root', [lex_tree(c) for c in kids], n]


def _flat(ch):
    """text formats are text nodes"""
    out = []
    for c in ch:
        if not isinstance(c, str) and c[0] in INLINE_FMT:
            out.extend(_flat(c[1]))
        else:
            out.append(c)
    return out


def ntok(l):
    if l[0] == 'text':
        return len(l[2])
    if l[0] in ('linebreak', 'horizontalrule', 'image'):
        return 1
    return sum(ntok(c) for c in l[1])


def exists(html, caret):
    """whether every node on the caret's path is in the value (an empty caret line is not)"""
    m = re.match(r'(.*)@(text|element):(\d+)', caret or '')
    if not m:
        return False
    node = lex_tree(ht.parse(html))
    for p in m.group(1).split('/')[1:]:
        mm = re.match(r'([\w-]+)\[(\d+)\]', p)
        if not mm:
            return False
        i = int(mm.group(2))
        if i >= len(node[1]) or node[1][i][0] != mm.group(1):
            return False
        node = node[1][i]
    return True


def resolve(html, caret):
    """position (int) in ht.tokens(parse(html)) or None"""
    if not caret or caret.startswith('nodes:') or caret == 'null':
        return None
    m = re.match(r'(.*)@(text|element):(\d+)', caret)
    if not m:
        return None
    path, kind, off = m.group(1), m.group(2), int(m.group(3))
    lt = lex_tree(ht.parse(html))
    parts = path.split('/')
    if parts[0] != 'root':
        return None
    node = lt
    pos = 0
    for p in parts[1:]:
        mm = re.match(r'([\w-]+)\[(\d+)\]', p)
        if not mm:
            return None
        name, i = mm.group(1), int(mm.group(2))
        if i >= len(node[1]) or node[1][i][0] != name:
            # a caret line not in the HTML (an empty line): position at index i
            if name == 'cms-line' and i <= len(node[1]):
                pos += sum(ntok(c) for c in node[1][:i])
                return pos
            return None
        pos += sum(ntok(c) for c in node[1][:i])
        node = node[1][i]
    if kind == 'text':
        return pos + off
    return pos + sum(ntok(c) for c in node[1][:off])
