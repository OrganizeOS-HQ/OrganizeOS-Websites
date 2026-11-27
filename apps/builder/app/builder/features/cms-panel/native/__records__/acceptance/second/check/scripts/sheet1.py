"""one-line read sheet: sheet1.py <from> <to>"""
import sys, json, re
import common as C
m = json.load(open(C.ld.HERE + '/master.json'))
left = [r for r in C.U if not (m['%s\t%s' % (r['set'], r['id'])] and m['%s\t%s' % (r['set'], r['id'])][0][1][0])]
a, b = int(sys.argv[1]), int(sys.argv[2])


def cs(c):
    c = c or ''
    c = re.sub(r'root/|list\[(\d)\]/', '', c)
    c = c.replace('listitem', 'i').replace('cms-line', 'L').replace('paragraph', 'p').replace('quote', 'q').replace('text', 't')
    return c[-34:]


for n, r in enumerate(left[a:b], a):
    print('#%d %s|%s S=%s' % (n, r['set'][:4], r['id'], C.lib2.tidy(r['stored'])))
    for side in ('base', 'r1'):
        tr = C.trace(r, side)
        rs = [t for t in tr if not t['step'].startswith(C.SKIP) and not t['step'].startswith('["key","{Control>}z') and not t['step'].startswith('["key","{Control>}{Shift>}z') and not t['step'].startswith('["refocus') and not t['step'].startswith('["domsel')]
        seq = ['%s[%s]%s' % (t['step'][:30], cs(t.get('caret')), t.get('calls')) for t in rs]
        x = C.F[(r['set'], r['id'], side)] or {}
        lv = [C.lib2.tidy(t.get('live')) for t in rs]
        uniq = []
        for v in lv:
            if not uniq or uniq[-1] != v:
                uniq.append(v)
        print('  %s %s' % (side[0].upper(), ' / '.join(seq)))
        print('    vals: ' + ' >> '.join(uniq[1:] if len(uniq) > 1 else uniq))
        if not tr:
            print('    rec: ' + json.dumps({k: x.get(k) for k in ('final', 'calls', 'fixedPoint', 'hung', 'errors') if k in x})[:400])
