"""Shared access for the checkers: R1's record of each differing record, its action step, caret before
the action, write, and the letter typed after redo."""
import json, re
import ld, lib2, ht, pos

U = ld.u1652()
F = ld.full()
SKIP = ('["snap"', '["an"', '["cmp"')


def trace(r, side='r1'):
    return (F[(r['set'], r['id'], side)] or {}).get('trace') or []


def real_steps(tr):
    return [t for t in tr if not t['step'].startswith(SKIP)]


def action_index(tr, pred):
    for i, t in enumerate(tr):
        if pred(t['step']):
            return i
    return None


def caret_before(tr, i):
    """the caret of the last step before index i"""
    for t in reversed(tr[:i]):
        if t.get('caret') is not None:
            return t['caret']
    return None


def write_of(tr, i):
    """the live value after the action at index i (the first note's write after it)"""
    for t in tr[i + 1:]:
        if not t['step'].startswith(SKIP):
            break
        if t['step'].startswith('["an"'):
            n = t.get('note')
            if isinstance(n, dict) and n.get('write'):
                return lib2.tidy(n['write'])
            return lib2.tidy(t.get('live'))
    return lib2.tidy(tr[i].get('live'))


def is_letter(s):
    return s.startswith('["typeK"') or s == '["key","k"]'


def typed(tr):
    """(caret before the letter, live after the letter) for the letter typed after undo and redo"""
    for i, t in enumerate(tr):
        if is_letter(t['step']):
            return caret_before(tr, i), lib2.tidy(t.get('live'))
    return None


def before_typed_live(tr):
    for i, t in enumerate(tr):
        if is_letter(t['step']):
            for x in reversed(tr[:i]):
                if x.get('live') is not None:
                    return lib2.tidy(x['live'])
    return None


def ends(caret):
    if caret is None:
        return []
    return caret.split(' -> ')


def k_position(before, after):
    """leaf index of a single inserted 'k' (after vs before), or None"""
    a = ht.leaves(before)
    b = ht.leaves(after)
    if len(b) != len(a) + 1:
        return None
    for i in range(len(b)):
        if i >= len(a) or a[i] != b[i]:
            if b[i] == 'k' and b[i + 1:] == a[i:]:
                return i
            return None
    return None


def k_container(after, kpos):
    """the chain of tags (outermost first) holding the leaf at kpos in after"""
    tree = ht.parse(after)
    out = []

    def walk(n, chain, cnt):
        if isinstance(n, str):
            if cnt[0] <= kpos < cnt[0] + len(n):
                out.append(chain)
            cnt[0] += len(n)
            return
        if n[0] in ht.VOID:
            cnt[0] += 1
            return
        for c in n[1]:
            walk(c, chain + [n[0]], cnt)
    walk(tree, [], [0])
    return out[0] if out else None
