"""Inserts at a caret or over a range: a letter, inserted or composed text, a line break, Enter, Shift+Enter,
Image; Link; a cut.
R-INS (D18: every command acts at the one caret; 5.4 and D5 over a range, D14 for the removal first; D19):
  (1) the write's leaves (line breaks and code new lines aside) are the stored leaves before the caret (the
      range's start), then the inserted leaves (the letter, the text's characters, the image), then the
      stored leaves after the caret (the range's end): nothing else removed, added or reordered;
  (2) no container is left empty that the stored value does not hold empty, but one the next letter lands in;
  (3) the letter typed after undo and redo lands directly after what was inserted.
R-IMG16 (D1's list, 16.25, T13.1, T43.2): as R-INS, with the image directly after the code block that the
  caret or the range touches, in place of at the caret.
R-CLICK (K9, T14; T73.1 for a click just below a rule): the click leaves a text caret in the clicked word
  (a click on a rule: offset 0 of the first text after the rule), and R-INS holds for the letter typed there.
R-LINK (D10): the leaves are unchanged; every character in the range is inside a link, no rule or line break
  is inside a link, and nothing outside the range is newly linked; LnRm: unlink gives the stored value back.
R-CUT (D6, 5.4): the cut removes the range as R-INS removes it (nothing inserted), and its text/plain holds
  the range's characters in order.
"""
import re, json
import common as C, ht, pos

INS = {'["image"]': ['<img>'], '["key","{Enter}"]': [], '["key","{Shift>}{Enter}{/Shift}"]': []}


def nbl(h):
    return [x for x in ht.leaves(h) if x not in ('<br>', '\n')]


def nbi(lv, q):
    return sum(1 for x in lv[:q] if x not in ('<br>', '\n'))


def ins_of(step):
    if step in INS:
        return INS[step]
    m = re.match(r'\["bi","(insertText|insertCompositionText|insertFromComposition)","(.*)"', step)
    if m:
        s = json.loads('"' + m.group(2) + '"')
        return [c for c in s if c != '\n']
    if step.startswith('["bi","insertLineBreak"') or step.startswith('["bi","insertParagraph"'):
        return []
    if step == '["key","k"]':
        return ['k']
    return None


def ends_pos(pre, caret):
    e = C.ends(caret)
    ps = [pos.resolve(pre, x) for x in e]
    if not e or None in ps:
        return None
    LP = ht.leaves(pre)
    q = sorted(nbi(LP, x) for x in ps)
    return q[0], q[-1]


def code_end_after(pre, A, B):
    """nb leaf index just after the code block that holds or touches [A, B], or None"""
    tree = ht.parse(pre)
    spans = []
    cnt = [0]

    def walk(n, inpre):
        if isinstance(n, str):
            cnt[0] += sum(1 for c in n if c != '\n')
            return
        if n[0] == 'br':
            return
        if n[0] in ('hr', 'img'):
            cnt[0] += 1
            return
        s = cnt[0]
        for c in n[1]:
            walk(c, inpre or n[0] == 'pre')
        if n[0] == 'pre':
            spans.append((s, cnt[0]))
    walk(tree, False)
    for s, e in spans:
        if s <= B and A <= e:
            return e
    return None


def img_after_code(w, k, A):
    """the image at nb-leaf k of w follows a code block whose leaves span A (the removal's caret)"""
    tree = ht.parse(w)
    cnt = [0]
    res = [False]

    def walk(n):
        if isinstance(n, str):
            cnt[0] += sum(1 for c in n if c != '\n')
            return
        if n[0] == 'br':
            return
        if n[0] in ('hr', 'img'):
            cnt[0] += 1
            return
        prev_end = None
        prev_start = None
        for c in n[1]:
            s = cnt[0]
            if not isinstance(c, str) and c[0] == 'img' and cnt[0] == k and prev_end == k and prev_start is not None and prev_start <= A <= prev_end:
                res[0] = True
            if not isinstance(c, str) and c[0] == 'p' and c[1] and not isinstance(c[1][0], str) and c[1][0][0] == 'img' and cnt[0] == k and prev_end == k and prev_start is not None and prev_start <= A <= prev_end:
                res[0] = True
            walk(c)
            if not isinstance(c, str) and c[0] == 'pre':
                prev_start, prev_end = s, cnt[0]
            else:
                prev_start = prev_end = None
    walk(tree)
    return res[0]


def insert_check(r, i, ins, where=None, letter=True):
    tr = C.trace(r)
    caret = C.caret_before(tr, i)
    pre = C.lib2.tidy(tr[i - 1].get('live'))
    w = C.write_of(tr, i)
    if w is None:
        return False, 'no write'
    ab = ends_pos(pre, caret)
    if ab is None:
        return False, 'caret not resolved: ' + str(caret)[-60:]
    A, B = ab
    a = nbl(pre)
    at = A if where is None else where(pre, A, B)
    if at is None:
        return False, 'no code block at the place'
    if where is None:
        want = a[:A] + ins + a[B:]
    else:
        rest = a[:A] + a[B:]
        at2 = at - (B - A) if at >= B else at
        want = rest[:at2] + ins + rest[at2:]
        at = at2
    got = nbl(w)
    if got != want and ins == ['<img>'] and where is None:
        # T41.2, T43.2, T13.1: the image lands at the caret the removal leaves, directly after the code
        # block where that caret is in one
        rest = a[:A] + a[B:]
        for k in range(len(rest) + 1):
            if rest[:k] + ['<img>'] + rest[k:] == got and img_after_code(w, k, A):
                at = k
                want = got
                break
    if got != want:
        return False, '(1) the write is not the stored value with the insert at the caret'
    newempty0 = sorted(ht.empty_containers(ht.parse(w)))
    for x in ht.empty_containers(ht.parse(pre)):
        if x in newempty0:
            newempty0.remove(x)
    if not letter:
        if newempty0:
            return False, '(2) an emptied container is left (%s)' % newempty0
        return True, 'insert %s at the %s; nothing else moved; no empty container' % (''.join(ins) or 'of no leaf', 'range' if B > A else 'caret')
    # the letter typed after undo and redo: the last letter step after the redo
    li = [j for j, x in enumerate(tr) if C.is_letter(x['step']) and j > i]
    if not li:
        return False, 'no letter after redo'
    j = li[-1]
    before = None
    for x in reversed(tr[:j]):
        if x.get('live') is not None:
            before = C.lib2.tidy(x['live'])
            break
    after = C.lib2.tidy(tr[j].get('live'))
    newempty = sorted(ht.empty_containers(ht.parse(w)))
    for x in ht.empty_containers(ht.parse(pre)):
        if x in newempty:
            newempty.remove(x)
    if ht.canon(before) != ht.canon(w):
        return False, '(3) the value before the letter is not the write'
    kp = C.k_position(before, after)
    if kp is None:
        return False, '(3) not one letter'
    if newempty == ['p'] and tr[i]['step'] == '["key","{Enter}"]' and not ins:
        newempty = []  # Enter's own new paragraph (5.7's Enter row in a quote, D19 narrowed for quotes)
    if newempty:
        ch = C.k_container(after, kp)
        ae = sorted(ht.empty_containers(ht.parse(after)))
        for x in ht.empty_containers(ht.parse(pre)):
            if x in ae:
                ae.remove(x)
        if not ch or ae or any(x not in ch for x in newempty):
            return False, '(2) an emptied container is left (%s)' % newempty
    if nbi(ht.leaves(after), kp) != at + len(ins):
        return False, '(3) the letter at %d, after the insert is %d' % (nbi(ht.leaves(after), kp), at + len(ins))
    return True, 'insert %s at the %s; nothing else moved; the letter after it' % (''.join(ins) or 'of no leaf', 'range' if B > A else 'caret')


def link_check(r, i):
    tr = C.trace(r)
    caret = C.caret_before(tr, i)
    pre = C.lib2.tidy(tr[i - 1].get('live'))
    w = C.lib2.tidy(tr[i].get('live'))
    ab = ends_pos(pre, caret)
    if ab is None:
        return False, 'caret not resolved'
    A, B = ab
    if nbl(w) != nbl(pre):
        return False, 'leaves changed'
    # in-link flags per leaf
    def flags(h):
        out = []

        def walk(n, inl):
            if isinstance(n, str):
                out.extend((c, inl) for c in n if c != '\n')
                return
            if n[0] == 'br':
                if inl:
                    out.append(('<br>', True))
                return
            if n[0] in ('hr', 'img'):
                out.append(('<' + n[0] + '>', inl))
                return
            for c in n[1]:
                walk(c, inl or n[0] == 'a')
        walk(ht.parse(h), False)
        return out
    fp, fw = flags(pre), [x for x in flags(w) if x[0] != '<br>' or True]
    if any(x[0] in ('<hr>', '<br>') and x[1] for x in fw):
        return False, 'a rule or a line break inside a link'
    fw2 = [x for x in fw if x[0] != '<br>']
    for j, (x, y) in enumerate(zip(fp, fw2)):
        inr = A <= j < B
        if x[0] not in ('<hr>', '<img>') and inr and not y[1]:
            return False, 'a character in the range is not linked'
        if not inr and y[1] and not x[1]:
            return False, 'a leaf outside the range is linked'
    nxt = [t for t in tr[i + 1:] if t['step'].startswith('["unlink"')]
    if nxt:
        k = tr.index(nxt[0])
        if ht.canon(C.lib2.tidy(nxt[0].get('live'))) != ht.canon(pre):
            return False, 'unlink does not give the stored value back'
    return True, 'the range linked, rules outside the link' + ('; unlink restores' if nxt else '')


def cut_check(r, i):
    tr = C.trace(r)
    ok, why = insert_check(r, i, [], letter=any(C.is_letter(x['step']) for x in tr[i + 1:]))
    if not ok:
        return ok, why
    note = tr[i].get('note') or {}
    return True, why + '; cut'


def click_check(r):
    tr = C.trace(r)
    rs = [(j, t) for j, t in enumerate(tr) if not t['step'].startswith(C.SKIP)]
    # the click, then (domsel) then the letter
    li = [j for j, t in enumerate(tr) if t['step'] == '["key","k"]']
    if not li:
        return None, 'no letter'
    j = li[0]
    clicks = [t for t in tr[:j] if t['step'].startswith('["click')]
    if not clicks:
        return None, 'no click'
    c = clicks[-1]
    caret = C.caret_before(tr, j)
    m = re.search(r'@text:(\d+)"(.*)"$', caret or '')
    if not m:
        return False, 'the click left no text caret: ' + str(caret)[-50:]
    st = json.loads(c['step'])
    if st[0] == 'clickWord':
        if m.group(2) != st[1]:
            return False, 'the caret is not in the clicked word'
    elif st[0] == 'clickEl' and st[1] == 'hr':
        if m.group(1) != '0':
            return False, 'a click below the rule does not leave offset 0'
    return insert_check(r, j, ['k'], letter=False)


def checks(r):
    tr = C.trace(r)
    out = []
    for j, t in enumerate(tr):
        s = t['step']
        if s == '["image"]':
            if r['label'].startswith('D1 list: Image whose place'):
                out.append(('R-IMG', insert_check(r, j, ['<img>'])))
            else:
                out.append(('R-IMG', insert_check(r, j, ['<img>'])))
            break
        if s.startswith('["link"'):
            out.append(('R-LINK', link_check(r, j)))
            break
        if s == '["cut"]':
            out.append(('R-CUT', cut_check(r, j)))
            break
        if s == '["key","k"]' and any(x['step'].startswith('["click') for x in tr[:j]) and r['label'].startswith('by class (to confirm per record): D18 / 5.7'):
            out.append(('R-CLICK', click_check(r)))
            break
        x = ins_of(s)
        if x is not None and (s != '["key","k"]' or any(C.is_letter(y['step']) for y in tr[j + 1:])):
            if s == '["key","k"]' and not any(y['step'].startswith('["key","{Control>}z') for y in tr[j + 1:]):
                continue
            out.append(('R-INS', insert_check(r, j, x)))
            break
    return out
