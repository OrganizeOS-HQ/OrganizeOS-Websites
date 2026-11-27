"""T82.4: the second check's 23 label corrections, applied after expl2.py's 14 (C1 to C14) as K1 to K23.
The values stand; only the label changes. Writes labels-t82.jsonl.gz (set, id, label before, label after,
correction) and prints the count per correction."""
import gzip, json, re, collections, sys
P = '/home/user/OrganizeOS-Websites/.claude/worktrees/agent-abb012d24ba04b6c7/apps/builder/app/builder/features/cms-panel/native/__records__/acceptance/second/'
recs = [json.loads(l) for l in gzip.open(P + 'differences.jsonl.gz', 'rt')]


def m(r, pat, s=None):
    return (s is None or r['set'] == s) and re.search(pat, r['id']) is not None


RULES = [
    ('K1', 'D13 with T71.2 (the caret stays where its line was, beside the rule) and T65.3 (<hr /><p>k</p>); for a ruleClick before a leading rule, T70.5 (under D13, at the caret before the rule)',
     lambda r: r['set'] == 'toolbar' and r['id'].split('|')[-1] in ('UL', 'OL') and r['id'].split('|')[-2] in ('ruleClick', 'liEnd') and 'list buttons' in r['label']),
    ('K2', "D1's emptied entry (the build leaves no quote, item or list it emptied); both undos restore (T62.5)",
     lambda r: m(r, r'^p4::C13 parent text->nested', 'clipboard')),
    ('K3', "D1's focus entry (keyboard focus stays in the editor after a toolbar control closes)",
     lambda r: m(r, r'g5\|blockNoRefocus\|(REFI|ROOT)', 'gap-fill')),
    ('K4', "D1's F12 with 15.2 for undo; T67.2 and the composition-start entry for the counts; the shared lost b is T70.12",
     lambda r: m(r, r'g4\|compose\|(REFI|REFP|ROOT)\|T0w@1\|', 'gap-fill')),
    ('K5', "D1's composition-start entry (T67.2, T72.2)",
     lambda r: m(r, r'g4\|compose\|ROOT\|afterRule\|', 'gap-fill')),
    ('K6', "map 1 group 11 at the base's click; 5.3's arrow stop on the rule (T80.1)",
     lambda r: m(r, r'g5\|blur\|QTR', 'gap-fill')),
    ('K7', "T80.1: map 1 group 11 at the base's click; the arrow's stop on the rule and the next press to the line after it (5.3, D13, D15); the counts are T67.2's",
     lambda r: m(r, r'g4\|compose\|QTR\|afterRule\|', 'gap-fill')),
    ('K8', "T80.2: map 1 group 11 at the base's click (K9); R1's click leaves the caret where clicked; the write is the head's at that caret",
     lambda r: m(r, r'g4\|replace\|QTR\|T1w', 'gap-fill')),
    ('K9', 'T80.3: two calls stand (the repeat is withheld, D7)',
     lambda r: m(r, r"g4\|compose\|TQT\|Q1w@1\|'a\\nb'", 'gap-fill')),
    ('K10', "T80.4: the post snapshot's caret is none at the base after the drag and a text point after its redo; the same caret under D1",
     lambda r: m(r, r'g6\|(I1root-q|I2li|I5root-p)\|arrow\|drag', 'gap-fill')),
    ('K11', 'T56.1 (D3 second case; K5\'s missing join at the base) for g5 undo5 QT; T56.2 (no onChange at a no-op undo or redo) for g6 I1root-q click P',
     lambda r: m(r, r'g5\|undo5\|QT$|g6\|I1root-q\|click\|P$', 'gap-fill')),
    ('K12', "map 1 group 11 at the base's shift-click; 5.4 and D5 for the letter (T55.4)",
     lambda r: r['set'] == 'toolbar' and r['id'].endswith('|B') and re.search(r'\|(QBR|QTR|QTQ|r-QxLy|QxLy)\|[^|]*->', r['id']) is not None),
    ('K13', "D3's third case with T68.1 (the separator and the empty line's own break)",
     lambda r: m(r, r'^k3::ul-d1\|(TCB|THB)\|((C1w|H1w)@start\|BS|R:own [^|]*\|BS|R:own [^|]*\|type|T0w@end\|DEL)$|^k3::ul-d1\|TQB\|R:own [^|]*\|type$', 'keys-phase-1')),
    ('K14', 'T70.11 with T76.2 (the caret is Q0w@3; k gives Q0wk; Backspace gives Q0)',
     lambda r: m(r, r'^n2::.*\|rightQ\|(k|BS)$', 'keys-phase-2')),
    ('K15', "D1's same caret (an item point and a line point at the same place); D13 for liEnd",
     lambda r: m(r, r'^n2::ul-d1\|QBR\|liEnd\|k$', 'keys-phase-2') or (m(r, r'^n2::.*\|afterBr0\|', 'keys-phase-2') and 'empty block' in r['label'] and r['writeBase'] == r['writeR1'])),
    ('K16', "D1's bar plus T70.9 measurement 14 by form (the paragraph-after-the-line form accepted for top-QpTB; low confidence: the twin is not measured for this shape)",
     lambda r: m(r, r'^n2::top-QrTB\|afterBr0\|ins \\n\\n$', 'keys-phase-2')),
    ('K17', "D1's emptied entry (5.4)",
     lambda r: r['set'] == 'paste-sweeps' and 'dlim' in r['id'] and re.search(r'(ol HT|ol T|quote ul HT|ul HT)', r['id']) is not None),
    ('K18', "T29.2 for k3 TRL walk Right; map 1 group 11 at the base's click with T29.1 and T29.2 for k2 QQR and QTR walk Left",
     lambda r: m(r, r'^k3::ul-d1\|TRL\|walk Right$|^k2::ul-d1\|(QQR|QTR)\|walk Left$', 'keys-phase-1')),
    ('K19', 'T56.3 to T56.5',
     lambda r: r['set'] == 'paste-sweeps' and '(no join)' in r['id']),
    ('K20', "D1's fourth entry, F2 (Delete just after an ending image)",
     lambda r: m(r, r'g6\|(I1root-q|I2li|I5root-p)\|click\|Del', 'gap-fill')),
    ('K21', 'the seventh entry as T43.2 restates it (the image lands at the caret the removal leaves)',
     lambda r: m(r, r'^R::ul-d1\|r-C\|Pw->C0w\|Im$', 'toolbar')),
    ('K22', "the 'same write; R1's letter leaves one line break' class (D3 third case)",
     lambda r: r['label'].startswith("D1's bar: the head's typed letter after undo and redo loses structure") and r['check'] == 'not confirmed'),
    ('K23', "5.3: ArrowLeft at the start of its first text, where a rule directly precedes it, node-selects that rule (the 8); D1's same caret for k3 TBQ walk Left",
     lambda r: m(r, r'^(k0::ul-d1\|RQ|k1::ul-d1\|BRQ|k2::ul-d1\|QRQ|k3::ul-d1\|(RQB|RQL|RQQ|RQT|RRQ|TBQ))\|walk Left$', 'keys-phase-1')),
]
out = []
cnt = collections.Counter()
for r in recs:
    for k, lab, f in RULES:
        if f(r):
            out.append({'set': r['set'], 'id': r['id'], 'labelBefore': r['label'], 'label': lab, 'correction': k})
            cnt[k] += 1
            break
for k, _, _ in RULES:
    print(k, cnt[k])
print('records relabelled', len(out))
dest = sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/-home-user-OrganizeOS-Websites/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad/sc/labels-t82.jsonl.gz'
with gzip.open(dest, 'wt') as fh:
    for o in out:
        fh.write(json.dumps(o) + '\n')
