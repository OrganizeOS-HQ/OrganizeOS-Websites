# Task 22: the grid differences, branch (B) against the head (H, `<base>` 2a96a45)

One line per cell whose `{ write, calls, caret, typed }` (or `<point> placed`) differs. In values, `[` stands for `<ul><li>Pw</li><li>` and `]` for `</li><li>Nw</li></ul>`.
Tags for the points, meeting and node grids were given by rule from the cell (its point, its command, the head's placed caret), not by reading each write against the spec: each is the rule the cell falls under, checked by eye only by class. "UNEXPLAINED" lines stop the task.

## points (277 differences)

- 127: D18
- 41: 5.3 deletes
- 24: D13: Block type acts on the caret's line
- 21: D7
- 18: 5.7: Block type and Link at a point beside a quote (D18)
- 15: D13
- 9: D10
- 8: 5.7: Image at a point beside a quote (D18)
- 8: head flagged: D19
- 4: 5.7: Divider at the start or end of a block in a lined item
- 2: head flagged: console errors

- `QR@0 Backspace` — 5.3 deletes  
  B w=<ul><li>PwQ0w</li><li><hr />] c=1 @text:PwQ0w@2 t=<ul><li>PwkQ0w</li><li><hr />]  
  H w=<ul><li>PwQ0w</li><li><blockquote></blockquote><hr />] c=1 @text:PwQ0w@2 t=<ul><li>PwkQ0w</li><li><blockquote></blockquote><hr />]
- `QR@0 Bold` — D18  
  B w=null c=0 @text:Q0w@0 t=[<blockquote><p><b><strong>k</strong></b>Q0w</p></blockquote><hr />]  
  H w=null c=0 @element:listitem@0 t=[<blockquote><p><b><strong>k</strong></b>Q0w</p></blockquote><hr />]
- `QR@0 Bulleted list` — D18  
  B w=<p>Pw</p><blockquote><p>Q0w</p></blockquote><hr /><p>Nw</p> c=1 @text:Q0w@0 t=<p>Pw</p><blockquote><p>kQ0w</p></blockquote><hr /><p>Nw</p>  
  H w=<p>Pw</p><blockquote><p>Q0w</p></blockquote><hr /><p>Nw</p> c=1 @text:Pw@2 t=<p>Pwk</p><blockquote><p>Q0w</p></blockquote><hr /><p>Nw</p>
- `QR@0 Code` — 5.7: Block type and Link at a point beside a quote (D18)  
  B w=[<blockquote><pre><code>Q0w</code></pre></blockquote><hr />] c=1 @text:Q0w@0 t=[<blockquote><pre><code>kQ0w</code></pre></blockquote><hr />]  
  H w=null c=0 @element:listitem@0 t=[<blockquote><p>kQ0w</p></blockquote><hr />]
- `QR@0 Ctrl+Backspace` — 5.3 deletes  
  B w=<ul><li>PwQ0w</li><li><hr />] c=1 @text:PwQ0w@2 t=<ul><li>PwkQ0w</li><li><hr />]  
  H w=<ul><li>PwQ0w</li><li><blockquote></blockquote><hr />] c=1 @text:PwQ0w@2 t=<ul><li>PwkQ0w</li><li><blockquote></blockquote><hr />]
- `QR@0 Divider` — 5.7: Divider at the start or end of a block in a lined item  
  B w=<ul><li>Pw</li></ul><hr /><ul><li><blockquote><p>Q0w</p></blockquote><hr />] c=1 @text:Q0w@0 t=<ul><li>Pw</li></ul><hr /><ul><li><blockquote><p>kQ0w</p></blockquote><hr />]  
  H w=[</li></ul><hr /><ul><li><blockquote><p>Q0w</p></blockquote><hr />] c=1 @text:Q0w@0 t=[</li></ul><hr /><ul><li><blockquote><p>kQ0w</p></blockquote><hr />]
- `QR@0 Heading 2` — 5.7: Block type and Link at a point beside a quote (D18)  
  B w=[<blockquote><h2>Q0w</h2></blockquote><hr />] c=1 @text:Q0w@0 t=[<blockquote><h2>kQ0w</h2></blockquote><hr />]  
  H w=null c=0 @element:listitem@0 t=[<blockquote><p>kQ0w</p></blockquote><hr />]
- `QR@0 Image` — 5.7: Image at a point beside a quote (D18)  
  B w=[<blockquote><p><img />Q0w</p></blockquote><hr />] c=1 @text:Q0w@0 t=[<blockquote><p><img />kQ0w</p></blockquote><hr />]  
  H w=[<img /><blockquote><p>Q0w</p></blockquote><hr />] c=1 @element:quote@0 t=[<img /><blockquote><p>kQ0w</p></blockquote><hr />]
- `QR@0 Italic` — D18  
  B w=null c=0 @text:Q0w@0 t=[<blockquote><p><i><em>k</em></i>Q0w</p></blockquote><hr />]  
  H w=null c=0 @element:listitem@0 t=[<blockquote><p><i><em>k</em></i>Q0w</p></blockquote><hr />]
- `QR@0 Link` — D18  
  B w=[<blockquote><p><a>Q0w</a></p></blockquote><hr />] c=1 @text:Q0w@0 t=[<blockquote><p>k<a>Q0w</a></p></blockquote><hr />]  
  H w=[<blockquote><p><a>Q0w</a></p></blockquote><hr />] c=1 @element:listitem@0 t=[<blockquote><p>k<a>Q0w</a></p></blockquote><hr />]
- `QR@0 Numbered list` — D18  
  B w=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /></li><li>Nw</li></ol> c=1 @text:Q0w@0 t=<ol><li>Pw</li><li><blockquote><p>kQ0w</p></blockquote><hr /></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /></li><li>Nw</li></ol> c=1 @element:listitem@0 t=<ol><li>Pw</li><li><blockquote><p>kQ0w</p></blockquote><hr /></li><li>Nw</li></ol>
- `QR@0 Paragraph` — D18  
  B w=null c=0 @text:Q0w@0 t=[<blockquote><p>kQ0w</p></blockquote><hr />]  
  H w=null c=0 @element:listitem@0 t=[<blockquote><p>kQ0w</p></blockquote><hr />]
- `QR@0 Quote` — D18  
  B w=null c=0 @text:Q0w@0 t=[<blockquote><p>kQ0w</p></blockquote><hr />]  
  H w=null c=0 @element:listitem@0 t=[<blockquote><p>kQ0w</p></blockquote><hr />]
- `QR@0 Shift+Tab` — D18  
  B w=null c=0 @text:Q0w@0 t=  
  H w=null c=0 @element:listitem@0 t=
- `QR@0 Strikethrough` — D18  
  B w=null c=0 @text:Q0w@0 t=[<blockquote><p><s>k</s>Q0w</p></blockquote><hr />]  
  H w=null c=0 @element:listitem@0 t=[<blockquote><p><s>k</s>Q0w</p></blockquote><hr />]
- `QR@0 Tab` — D18  
  B w=null c=0 @text:Q0w@0 t=  
  H w=null c=0 @element:listitem@0 t=
- `QR@0 Underline` — D18  
  B w=null c=0 @text:Q0w@0 t=[<blockquote><p><u>k</u>Q0w</p></blockquote><hr />]  
  H w=null c=0 @element:listitem@0 t=[<blockquote><p><u>k</u>Q0w</p></blockquote><hr />]
- `QR@0 ime` — D7  
  B w=[<blockquote><p>aQ0w</p></blockquote><hr />] c=2 @text:aQ0w@1 t=[<blockquote><p>akQ0w</p></blockquote><hr />]  
  H w=[<blockquote><p>aQ0w</p></blockquote><hr />] c=3 @text:aQ0w@1 t=[<blockquote><p>akQ0w</p></blockquote><hr />]
- `QR@0 lineBack` — 5.3 deletes  
  B w=<ul><li>PwQ0w</li><li><hr />] c=1 @text:PwQ0w@2 t=<ul><li>PwkQ0w</li><li><hr />]  
  H w=<ul><li>PwQ0w</li><li><blockquote></blockquote><hr />] c=1 @text:PwQ0w@2 t=<ul><li>PwkQ0w</li><li><blockquote></blockquote><hr />]
- `QR@0 placed` — D18  
  B text:Q0w@0  
  H element:listitem@0
- `QR@1 Backspace` — 5.3 deletes  
  B w=[<blockquote><p>Q0</p></blockquote><hr />] c=1 @text:Q0@2 t=[<blockquote><p>Q0k</p></blockquote><hr />]  
  H w=null c=0 @text:Q0w@0 t=[<blockquote><p>kQ0w</p></blockquote><hr />]
- `QR@1 Bold` — D18  
  B w=null c=0 @text:Q0w@3 t=[<blockquote><p>Q0w<b><strong>k</strong></b></p></blockquote><hr />]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w<b><strong>k</strong></b></p></blockquote><hr />]
- `QR@1 Bulleted list` — D18  
  B w=<p>Pw</p><blockquote><p>Q0w</p></blockquote><hr /><p>Nw</p> c=1 @text:Q0w@3 t=<p>Pw</p><blockquote><p>Q0wk</p></blockquote><hr /><p>Nw</p>  
  H w=<p>Pw</p><blockquote><p>Q0w</p></blockquote><hr /><p>Nw</p> c=1 @element:root@3 t=<p>Pw</p><blockquote><p>Q0w</p></blockquote><hr /><p>k</p><p>Nw</p>
- `QR@1 Code` — 5.7: Block type and Link at a point beside a quote (D18)  
  B w=[<blockquote><pre><code>Q0w</code></pre></blockquote><hr />] c=1 @text:Q0w@3 t=[<blockquote><pre><code>Q0wk</code></pre></blockquote><hr />]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote><hr />]
- `QR@1 Ctrl+Backspace` — 5.3 deletes  
  B w=[<blockquote></blockquote><hr />] c=1 @element:paragraph@0 t=[<blockquote><p>k</p></blockquote><hr />]  
  H w=null c=0 @text:Q0w@0 t=[<blockquote><p>kQ0w</p></blockquote><hr />]
- `QR@1 Ctrl+Delete` — D18  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote>] c=1 @text:Nw@0 t=[<blockquote><p>Q0w</p></blockquote></li><li>kNw</li></ul>
- `QR@1 Delete` — D18  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote>]
- `QR@1 Heading 2` — 5.7: Block type and Link at a point beside a quote (D18)  
  B w=[<blockquote><h2>Q0w</h2></blockquote><hr />] c=1 @text:Q0w@3 t=[<blockquote><h2>Q0wk</h2></blockquote><hr />]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote><hr />]
- `QR@1 Image` — 5.7: Image at a point beside a quote (D18)  
  B w=[<blockquote><p>Q0w<img /></p></blockquote><hr />] c=1 @element:paragraph@2 t=[<blockquote><p>Q0w<img />k</p></blockquote><hr />]  
  H w=[<blockquote><p>Q0w</p></blockquote><img /><hr />] c=1 @element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><img />k<hr />]
- `QR@1 Italic` — D18  
  B w=null c=0 @text:Q0w@3 t=[<blockquote><p>Q0w<i><em>k</em></i></p></blockquote><hr />]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w<i><em>k</em></i></p></blockquote><hr />]
- `QR@1 Link` — 5.7: Block type and Link at a point beside a quote (D18)  
  B w=[<blockquote><p><a>Q0w</a></p></blockquote><hr />] c=1 @text:Q0w@3 t=[<blockquote><p><a>Q0w</a>k</p></blockquote><hr />]  
  H w=[<blockquote><p>Q0w</p></blockquote><a><hr /></a>] c=1 @element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><a><hr /></a>k]
- `QR@1 Numbered list` — D18  
  B w=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /></li><li>Nw</li></ol> c=1 @text:Q0w@3 t=<ol><li>Pw</li><li><blockquote><p>Q0wk</p></blockquote><hr /></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /></li><li>Nw</li></ol> c=1 @element:listitem@1 t=<ol><li>Pw</li><li><blockquote><p>Q0wk</p></blockquote><hr /></li><li>Nw</li></ol>
- `QR@1 Paragraph` — D18  
  B w=null c=0 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote><hr />]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote><hr />]
- `QR@1 Quote` — D18  
  B w=null c=0 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote><hr />]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote><hr />]
- `QR@1 Shift+Tab` — D18  
  B w=null c=0 @text:Q0w@3 t=  
  H w=null c=0 @element:listitem@1 t=
- `QR@1 Strikethrough` — D18  
  B w=null c=0 @text:Q0w@3 t=[<blockquote><p>Q0w<s>k</s></p></blockquote><hr />]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w<s>k</s></p></blockquote><hr />]
- `QR@1 Tab` — D18  
  B w=null c=0 @text:Q0w@3 t=  
  H w=null c=0 @element:listitem@1 t=
- `QR@1 Underline` — D18  
  B w=null c=0 @text:Q0w@3 t=[<blockquote><p>Q0w<u>k</u></p></blockquote><hr />]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w<u>k</u></p></blockquote><hr />]
- `QR@1 ime` — head flagged: console errors  
  B w=[<blockquote><p>Q0wa</p></blockquote><hr />] c=2 @text:Q0wa@4 t=[<blockquote><p>Q0wak</p></blockquote><hr />]  
  H w=[<blockquote><p>Q0waa</p></blockquote><hr />] c=3 @text:Q0waa@4|text:Q0waa@5 t=[<blockquote><p>Q0wak</p></blockquote><hr />]
- `QR@1 lineBack` — 5.3 deletes  
  B w=[<blockquote></blockquote><hr />] c=1 @element:paragraph@0 t=[<blockquote><p>k</p></blockquote><hr />]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote><hr />]
- `QR@1 lineForward` — 5.3 deletes  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote><hr />]
- `QR@1 placed` — D18  
  B text:Q0w@3  
  H element:listitem@1
- `QR@2 Backspace` — D18  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote>]
- `QR@2 Code` — D18  
  B w=[<blockquote><p>Q0w</p></blockquote><hr /><pre><code></code></pre>] c=1 @element:code@0 t=[<blockquote><p>Q0w</p></blockquote><hr /><pre><code>k</code></pre>]  
  H w=null c=0 @element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><hr />k]
- `QR@2 Ctrl+Backspace` — 5.3 deletes  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote>]  
  H w=[] c=1 @element:listitem@1|element:quote@0 t=[<blockquote>k</blockquote>]
- `QR@2 Ctrl+Delete` — 5.3 deletes  
  B w=[<blockquote><p>Q0w</p></blockquote><hr />Nw</li></ul> c=1 @text:Nw@0 t=[<blockquote><p>Q0w</p></blockquote><hr />kNw</li></ul>  
  H w=[<blockquote><p>Q0w</p></blockquote>] c=1 @text:Nw@0 t=[<blockquote><p>Q0w</p></blockquote></li><li>kNw</li></ul>
- `QR@2 Delete` — 5.3 deletes  
  B w=[<blockquote><p>Q0w</p></blockquote><hr />Nw</li></ul> c=1 @text:Nw@0 t=[<blockquote><p>Q0w</p></blockquote><hr />kNw</li></ul>  
  H w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote>]
- `QR@2 Heading 2` — D18  
  B w=[<blockquote><p>Q0w</p></blockquote><hr /><h2></h2>] c=1 @element:heading@0 t=[<blockquote><p>Q0w</p></blockquote><hr /><h2>k</h2>]  
  H w=null c=0 @element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><hr />k]
- `QR@2 Link` — D10  
  B w=null c=0 @element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><hr />k]  
  H w=[<blockquote><p>Q0w</p></blockquote><a><hr /></a>] c=1 @element:listitem@3 t=[<blockquote><p>Q0w</p></blockquote><a><hr /></a>]
- `QR@2 Quote` — D18  
  B w=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote></blockquote>] c=1 @element:quote@0 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote>k</blockquote>]  
  H w=null c=0 @element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><hr />k]
- `QR@2 ime` — D7  
  B w=[<blockquote><p>Q0w</p></blockquote><hr />a] c=1 @text:a@1 t=[<blockquote><p>Q0w</p></blockquote><hr />ak]  
  H w=[<blockquote><p>Q0w</p></blockquote><hr />a] c=3 @text:a@1 t=[<blockquote><p>Q0w</p></blockquote><hr />ak]
- `QR@2 lineBack` — 5.3 deletes  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote>]  
  H w=[] c=1 @element:quote@0 t=[<blockquote>k</blockquote>]
- `QR@2 lineForward` — head flagged: D19  
  B w=[<blockquote><p>Q0w</p></blockquote><hr />Nw</li></ul> c=1 @text:Nw@0 t=[<blockquote><p>Q0w</p></blockquote><hr />kNw</li></ul>  
  H w=[<blockquote><p>Q0w</p></blockquote><hr />] c=1 @element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><hr />k]
- `QRQ@0 Backspace` — 5.3 deletes  
  B w=<ul><li>PwQ0w</li><li><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @text:PwQ0w@2 t=<ul><li>PwkQ0w</li><li><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=<ul><li>PwQ0w</li><li><blockquote></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @text:PwQ0w@2 t=<ul><li>PwkQ0w</li><li><blockquote></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@0 Bold` — D18  
  B w=null c=0 @text:Q0w@0 t=[<blockquote><p><b><strong>k</strong></b>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=null c=0 @element:listitem@0 t=[<blockquote><p><b><strong>k</strong></b>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@0 Bulleted list` — D18  
  B w=<p>Pw</p><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote><p>Nw</p> c=1 @text:Q0w@0 t=<p>Pw</p><blockquote><p>kQ0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote><p>Nw</p>  
  H w=<p>Pw</p><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote><p>Nw</p> c=1 @text:Pw@2 t=<p>Pwk</p><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote><p>Nw</p>
- `QRQ@0 Code` — 5.7: Block type and Link at a point beside a quote (D18)  
  B w=[<blockquote><pre><code>Q0w</code></pre></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @text:Q0w@0 t=[<blockquote><pre><code>kQ0w</code></pre></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=null c=0 @element:listitem@0 t=[<blockquote><p>kQ0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@0 Ctrl+Backspace` — 5.3 deletes  
  B w=<ul><li>PwQ0w</li><li><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @text:PwQ0w@2 t=<ul><li>PwkQ0w</li><li><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=<ul><li>PwQ0w</li><li><blockquote></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @text:PwQ0w@2 t=<ul><li>PwkQ0w</li><li><blockquote></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@0 Divider` — 5.7: Divider at the start or end of a block in a lined item  
  B w=<ul><li>Pw</li></ul><hr /><ul><li><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @text:Q0w@0 t=<ul><li>Pw</li></ul><hr /><ul><li><blockquote><p>kQ0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=[</li></ul><hr /><ul><li><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @text:Q0w@0 t=[</li></ul><hr /><ul><li><blockquote><p>kQ0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@0 Heading 2` — 5.7: Block type and Link at a point beside a quote (D18)  
  B w=[<blockquote><h2>Q0w</h2></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @text:Q0w@0 t=[<blockquote><h2>kQ0w</h2></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=null c=0 @element:listitem@0 t=[<blockquote><p>kQ0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@0 Image` — 5.7: Image at a point beside a quote (D18)  
  B w=[<blockquote><p><img />Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @text:Q0w@0 t=[<blockquote><p><img />kQ0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=[<img /><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @element:quote@0 t=[<img /><blockquote><p>kQ0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@0 Italic` — D18  
  B w=null c=0 @text:Q0w@0 t=[<blockquote><p><i><em>k</em></i>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=null c=0 @element:listitem@0 t=[<blockquote><p><i><em>k</em></i>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@0 Link` — D18  
  B w=[<blockquote><p><a>Q0w</a></p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @text:Q0w@0 t=[<blockquote><p>k<a>Q0w</a></p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=[<blockquote><p><a>Q0w</a></p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @element:listitem@0 t=[<blockquote><p>k<a>Q0w</a></p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@0 Numbered list` — D18  
  B w=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ol> c=1 @text:Q0w@0 t=<ol><li>Pw</li><li><blockquote><p>kQ0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ol> c=1 @element:listitem@0 t=<ol><li>Pw</li><li><blockquote><p>kQ0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ol>
- `QRQ@0 Paragraph` — D18  
  B w=null c=0 @text:Q0w@0 t=[<blockquote><p>kQ0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=null c=0 @element:listitem@0 t=[<blockquote><p>kQ0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@0 Quote` — D18  
  B w=null c=0 @text:Q0w@0 t=[<blockquote><p>kQ0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=null c=0 @element:listitem@0 t=[<blockquote><p>kQ0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@0 Shift+Tab` — D18  
  B w=null c=0 @text:Q0w@0 t=  
  H w=null c=0 @element:listitem@0 t=
- `QRQ@0 Strikethrough` — D18  
  B w=null c=0 @text:Q0w@0 t=[<blockquote><p><s>k</s>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=null c=0 @element:listitem@0 t=[<blockquote><p><s>k</s>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@0 Tab` — D18  
  B w=null c=0 @text:Q0w@0 t=  
  H w=null c=0 @element:listitem@0 t=
- `QRQ@0 Underline` — D18  
  B w=null c=0 @text:Q0w@0 t=[<blockquote><p><u>k</u>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=null c=0 @element:listitem@0 t=[<blockquote><p><u>k</u>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@0 ime` — D7  
  B w=[<blockquote><p>aQ0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=2 @text:aQ0w@1 t=[<blockquote><p>akQ0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=[<blockquote><p>aQ0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=3 @text:aQ0w@1 t=[<blockquote><p>akQ0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@0 lineBack` — 5.3 deletes  
  B w=<ul><li>PwQ0w</li><li><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @text:PwQ0w@2 t=<ul><li>PwkQ0w</li><li><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=<ul><li>PwQ0w</li><li><blockquote></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @text:PwQ0w@2 t=<ul><li>PwkQ0w</li><li><blockquote></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@0 placed` — D18  
  B text:Q0w@0  
  H element:listitem@0
- `QRQ@1 Backspace` — 5.3 deletes  
  B w=[<blockquote><p>Q0</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @text:Q0@2 t=[<blockquote><p>Q0k</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=null c=0 @text:Q0w@0 t=[<blockquote><p>kQ0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@1 Bold` — D18  
  B w=null c=0 @text:Q0w@3 t=[<blockquote><p>Q0w<b><strong>k</strong></b></p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w<b><strong>k</strong></b></p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@1 Bulleted list` — D18  
  B w=<p>Pw</p><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote><p>Nw</p> c=1 @text:Q0w@3 t=<p>Pw</p><blockquote><p>Q0wk</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote><p>Nw</p>  
  H w=<p>Pw</p><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote><p>Nw</p> c=1 @element:root@4 t=<p>Pw</p><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote><p>k</p><p>Nw</p>
- `QRQ@1 Code` — 5.7: Block type and Link at a point beside a quote (D18)  
  B w=[<blockquote><pre><code>Q0w</code></pre></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><pre><code>Q0wk</code></pre></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@1 Ctrl+Backspace` — 5.3 deletes  
  B w=[<blockquote></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @element:paragraph@0 t=[<blockquote><p>k</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=null c=0 @text:Q0w@0 t=[<blockquote><p>kQ0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@1 Ctrl+Delete` — D18  
  B w=[<blockquote><p>Q0w</p></blockquote><blockquote><p>Q2w</p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote><blockquote><p>Q2w</p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote><blockquote><p>Q2w</p></blockquote>] c=1 @text:Q2w@0 t=[<blockquote><p>Q0w</p></blockquote><blockquote><p>kQ2w</p></blockquote>]
- `QRQ@1 Delete` — 5.3 deletes  
  B w=[<blockquote><p>Q0w</p></blockquote><blockquote><p>Q2w</p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote><blockquote><p>Q2w</p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote>]
- `QRQ@1 Heading 2` — 5.7: Block type and Link at a point beside a quote (D18)  
  B w=[<blockquote><h2>Q0w</h2></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><h2>Q0wk</h2></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@1 Image` — 5.7: Image at a point beside a quote (D18)  
  B w=[<blockquote><p>Q0w<img /></p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @element:paragraph@2 t=[<blockquote><p>Q0w<img />k</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote><img /><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><img />k<hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@1 Italic` — D18  
  B w=null c=0 @text:Q0w@3 t=[<blockquote><p>Q0w<i><em>k</em></i></p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w<i><em>k</em></i></p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@1 Link` — 5.7: Block type and Link at a point beside a quote (D18)  
  B w=[<blockquote><p><a>Q0w</a></p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><p><a>Q0w</a>k</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote><a><hr /></a><blockquote><p>Q2w</p></blockquote>] c=1 @element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><a><hr /></a><blockquote><p>kQ2w</p></blockquote>]
- `QRQ@1 Numbered list` — D18  
  B w=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ol> c=1 @text:Q0w@3 t=<ol><li>Pw</li><li><blockquote><p>Q0wk</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ol> c=1 @element:listitem@1 t=<ol><li>Pw</li><li><blockquote><p>Q0wk</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ol>
- `QRQ@1 Paragraph` — D18  
  B w=null c=0 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@1 Quote` — D18  
  B w=null c=0 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@1 Shift+Tab` — D18  
  B w=null c=0 @text:Q0w@3 t=  
  H w=null c=0 @element:listitem@1 t=
- `QRQ@1 Strikethrough` — D18  
  B w=null c=0 @text:Q0w@3 t=[<blockquote><p>Q0w<s>k</s></p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w<s>k</s></p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@1 Tab` — D18  
  B w=null c=0 @text:Q0w@3 t=  
  H w=null c=0 @element:listitem@1 t=
- `QRQ@1 Underline` — D18  
  B w=null c=0 @text:Q0w@3 t=[<blockquote><p>Q0w<u>k</u></p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w<u>k</u></p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@1 ime` — head flagged: console errors  
  B w=[<blockquote><p>Q0wa</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=2 @text:Q0wa@4 t=[<blockquote><p>Q0wak</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=[<blockquote><p>Q0waa</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=3 @text:Q0waa@4|text:Q0waa@5 t=[<blockquote><p>Q0wak</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@1 lineBack` — 5.3 deletes  
  B w=[<blockquote></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @element:paragraph@0 t=[<blockquote><p>k</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@1 lineForward` — 5.3 deletes  
  B w=[<blockquote><p>Q0w</p></blockquote><blockquote><p>Q2w</p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote><blockquote><p>Q2w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@1 placed` — D18  
  B text:Q0w@3  
  H element:listitem@1
- `QRQ@2 Backspace` — 5.3 deletes  
  B w=[<blockquote><p>Q0w</p></blockquote><blockquote><p>Q2w</p></blockquote>] c=1 @text:Q2w@0 t=[<blockquote><p>Q0w</p></blockquote><blockquote><p>kQ2w</p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote></blockquote>] c=1 @element:paragraph@0|element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>k</p></blockquote>]
- `QRQ@2 Bold` — D18  
  B w=null c=0 @text:Q2w@0 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p><b><strong>k</strong></b>Q2w</p></blockquote>]  
  H w=null c=0 @element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p><b><strong>k</strong></b>Q2w</p></blockquote>]
- `QRQ@2 Bulleted list` — D18  
  B w=<p>Pw</p><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote><p>Nw</p> c=1 @text:Q2w@0 t=<p>Pw</p><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>kQ2w</p></blockquote><p>Nw</p>  
  H w=<p>Pw</p><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote><p>Nw</p> c=1 @text:Pw@2 t=<p>Pwk</p><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote><p>Nw</p>
- `QRQ@2 Code` — 5.7: Block type and Link at a point beside a quote (D18)  
  B w=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><pre><code>Q2w</code></pre></blockquote>] c=1 @text:Q2w@0 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><pre><code>kQ2w</code></pre></blockquote>]  
  H w=null c=0 @element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>kQ2w</p></blockquote>]
- `QRQ@2 Ctrl+Backspace` — 5.3 deletes  
  B w=[<blockquote><p>Q0w</p></blockquote><blockquote><p>Q2w</p></blockquote>] c=1 @text:Q2w@0 t=[<blockquote><p>Q0w</p></blockquote><blockquote><p>kQ2w</p></blockquote>]  
  H w=[<blockquote><p>Q0wQ2w</p></blockquote><blockquote></blockquote>] c=1 @text:Q0wQ2w@3 t=[<blockquote><p>Q0wkQ2w</p></blockquote><blockquote></blockquote>]
- `QRQ@2 Heading 2` — 5.7: Block type and Link at a point beside a quote (D18)  
  B w=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><h2>Q2w</h2></blockquote>] c=1 @text:Q2w@0 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><h2>kQ2w</h2></blockquote>]  
  H w=null c=0 @element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>kQ2w</p></blockquote>]
- `QRQ@2 Image` — 5.7: Image at a point beside a quote (D18)  
  B w=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p><img />Q2w</p></blockquote>] c=1 @text:Q2w@0 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p><img />kQ2w</p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote><hr /><img /><blockquote><p>Q2w</p></blockquote>] c=1 @element:quote@0 t=[<blockquote><p>Q0w</p></blockquote><hr /><img /><blockquote><p>kQ2w</p></blockquote>]
- `QRQ@2 Italic` — D18  
  B w=null c=0 @text:Q2w@0 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p><i><em>k</em></i>Q2w</p></blockquote>]  
  H w=null c=0 @element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p><i><em>k</em></i>Q2w</p></blockquote>]
- `QRQ@2 Link` — D18  
  B w=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p><a>Q2w</a></p></blockquote>] c=1 @text:Q2w@0 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>k<a>Q2w</a></p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p><a>Q2w</a></p></blockquote>] c=1 @element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>k<a>Q2w</a></p></blockquote>]
- `QRQ@2 Numbered list` — D18  
  B w=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ol> c=1 @text:Q2w@0 t=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>kQ2w</p></blockquote></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ol> c=1 @element:listitem@2 t=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>kQ2w</p></blockquote></li><li>Nw</li></ol>
- `QRQ@2 Paragraph` — D18  
  B w=null c=0 @text:Q2w@0 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>kQ2w</p></blockquote>]  
  H w=null c=0 @element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>kQ2w</p></blockquote>]
- `QRQ@2 Quote` — D18  
  B w=null c=0 @text:Q2w@0 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>kQ2w</p></blockquote>]  
  H w=null c=0 @element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>kQ2w</p></blockquote>]
- `QRQ@2 Shift+Tab` — D18  
  B w=null c=0 @text:Q2w@0 t=  
  H w=null c=0 @element:listitem@2 t=
- `QRQ@2 Strikethrough` — D18  
  B w=null c=0 @text:Q2w@0 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p><s>k</s>Q2w</p></blockquote>]  
  H w=null c=0 @element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p><s>k</s>Q2w</p></blockquote>]
- `QRQ@2 Tab` — D18  
  B w=null c=0 @text:Q2w@0 t=  
  H w=null c=0 @element:listitem@2 t=
- `QRQ@2 Underline` — D18  
  B w=null c=0 @text:Q2w@0 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p><u>k</u>Q2w</p></blockquote>]  
  H w=null c=0 @element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p><u>k</u>Q2w</p></blockquote>]
- `QRQ@2 ime` — D7  
  B w=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>aQ2w</p></blockquote>] c=2 @text:aQ2w@1 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>akQ2w</p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>aQ2w</p></blockquote>] c=3 @text:aQ2w@1 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>akQ2w</p></blockquote>]
- `QRQ@2 lineBack` — 5.3 deletes  
  B w=[<blockquote><p>Q0w</p></blockquote><blockquote><p>Q2w</p></blockquote>] c=1 @text:Q2w@0 t=[<blockquote><p>Q0w</p></blockquote><blockquote><p>kQ2w</p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote></blockquote>] c=1 @element:paragraph@0|element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>k</p></blockquote>]
- `QRQ@2 placed` — D18  
  B text:Q2w@0  
  H element:listitem@2
- `QRQ@3 Bold` — D18  
  B w=null c=0 @text:Q2w@3 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w<b><strong>k</strong></b></p></blockquote>]  
  H w=null c=0 @element:listitem@3 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w<b><strong>k</strong></b></p></blockquote>]
- `QRQ@3 Bulleted list` — D18  
  B w=<p>Pw</p><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote><p>Nw</p> c=1 @text:Q2w@3 t=<p>Pw</p><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2wk</p></blockquote><p>Nw</p>  
  H w=<p>Pw</p><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote><p>Nw</p> c=1 @text:Pw@2 t=<p>Pwk</p><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote><p>Nw</p>
- `QRQ@3 Code` — 5.7: Block type and Link at a point beside a quote (D18)  
  B w=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><pre><code>Q2w</code></pre></blockquote>] c=1 @text:Q2w@3 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><pre><code>Q2wk</code></pre></blockquote>]  
  H w=null c=0 @element:listitem@3 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2wk</p></blockquote>]
- `QRQ@3 Divider` — 5.7: Divider at the start or end of a block in a lined item  
  B w=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote></li></ul><hr /><ul><li>Nw</li></ul> c=1 @text:Nw@0 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote></li></ul><hr /><ul><li>kNw</li></ul>  
  H w=<ul><li>Pw</li></ul><hr /><ul><li><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>] c=1 @text:Q0w@0 t=<ul><li>Pw</li></ul><hr /><ul><li><blockquote><p>kQ0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote>]
- `QRQ@3 Heading 2` — 5.7: Block type and Link at a point beside a quote (D18)  
  B w=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><h2>Q2w</h2></blockquote>] c=1 @text:Q2w@3 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><h2>Q2wk</h2></blockquote>]  
  H w=null c=0 @element:listitem@3 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2wk</p></blockquote>]
- `QRQ@3 Image` — 5.7: Image at a point beside a quote (D18)  
  B w=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w<img /></p></blockquote>] c=1 @element:paragraph@2 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w<img />k</p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote><img />] c=1 @element:listitem@4 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote><img />k]
- `QRQ@3 Italic` — D18  
  B w=null c=0 @text:Q2w@3 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w<i><em>k</em></i></p></blockquote>]  
  H w=null c=0 @element:listitem@3 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w<i><em>k</em></i></p></blockquote>]
- `QRQ@3 Link` — D18  
  B w=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p><a>Q2w</a></p></blockquote>] c=1 @text:Q2w@3 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p><a>Q2w</a>k</p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p><a>Q2w</a></p></blockquote>] c=1 @element:listitem@3 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p><a>Q2w</a>k</p></blockquote>]
- `QRQ@3 Numbered list` — D18  
  B w=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ol> c=1 @text:Q2w@3 t=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2wk</p></blockquote></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ol> c=1 @element:listitem@3 t=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2wk</p></blockquote></li><li>Nw</li></ol>
- `QRQ@3 Paragraph` — D18  
  B w=null c=0 @text:Q2w@3 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2wk</p></blockquote>]  
  H w=null c=0 @element:listitem@3 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2wk</p></blockquote>]
- `QRQ@3 Quote` — D18  
  B w=null c=0 @text:Q2w@3 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2wk</p></blockquote>]  
  H w=null c=0 @element:listitem@3 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2wk</p></blockquote>]
- `QRQ@3 Shift+Tab` — D18  
  B w=null c=0 @text:Q2w@3 t=  
  H w=null c=0 @element:listitem@3 t=
- `QRQ@3 Strikethrough` — D18  
  B w=null c=0 @text:Q2w@3 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w<s>k</s></p></blockquote>]  
  H w=null c=0 @element:listitem@3 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w<s>k</s></p></blockquote>]
- `QRQ@3 Tab` — D18  
  B w=null c=0 @text:Q2w@3 t=  
  H w=null c=0 @element:listitem@3 t=
- `QRQ@3 Underline` — D18  
  B w=null c=0 @text:Q2w@3 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w<u>k</u></p></blockquote>]  
  H w=null c=0 @element:listitem@3 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w<u>k</u></p></blockquote>]
- `QRQ@3 ime` — D7  
  B w=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2wa</p></blockquote>] c=2 @text:Q2wa@4 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2wak</p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2wa</p></blockquote>] c=3 @text:Q2wa@4 t=[<blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2wak</p></blockquote>]
- `QRQ@3 placed` — D18  
  B text:Q2w@3  
  H element:listitem@3
- `RQ@0 Backspace` — head flagged: D19  
  B w=<ul><li>Pw<hr /><blockquote><p>Q1w</p></blockquote>] c=1 @text:Pw@2 t=<ul><li>Pwk<hr /><blockquote><p>Q1w</p></blockquote>]  
  H w=[<hr /><blockquote><p>Q1w</p></blockquote>] c=1 @text:Pw@2 t=<ul><li>Pwk</li><li><hr /><blockquote><p>Q1w</p></blockquote>]
- `RQ@0 Code` — D18  
  B w=[<pre><code></code></pre><hr /><blockquote><p>Q1w</p></blockquote>] c=1 @element:code@0 t=[<pre><code>k</code></pre><hr /><blockquote><p>Q1w</p></blockquote>]  
  H w=null c=0 @element:listitem@0 t=[k<hr /><blockquote><p>Q1w</p></blockquote>]
- `RQ@0 Ctrl+Backspace` — 5.3 deletes  
  B w=<ul><li>Pw<hr /><blockquote><p>Q1w</p></blockquote>] c=1 @text:Pw@2 t=<ul><li>Pwk<hr /><blockquote><p>Q1w</p></blockquote>]  
  H w=<ul><li></li><li><hr /><blockquote><p>Q1w</p></blockquote>] c=1 @element:listitem@0 t=<ul><li>k<hr /><blockquote><p>Q1w</p></blockquote>]
- `RQ@0 Ctrl+Delete` — 5.3 deletes  
  B w=[<blockquote><p>Q1w</p></blockquote>] c=1 @text:Q1w@0 t=[<blockquote><p>kQ1w</p></blockquote>]  
  H w=[] c=1 @element:listitem@0|element:quote@0 t=[<blockquote>k</blockquote>]
- `RQ@0 Delete` — D18  
  B w=[<blockquote><p>Q1w</p></blockquote>] c=1 @text:Q1w@0 t=[<blockquote><p>kQ1w</p></blockquote>]  
  H w=[<blockquote><p>Q1w</p></blockquote>] c=1 @element:listitem@0 t=[<blockquote><p>kQ1w</p></blockquote>]
- `RQ@0 Heading 2` — D18  
  B w=[<h2></h2><hr /><blockquote><p>Q1w</p></blockquote>] c=1 @element:heading@0 t=[<h2>k</h2><hr /><blockquote><p>Q1w</p></blockquote>]  
  H w=null c=0 @element:listitem@0 t=[k<hr /><blockquote><p>Q1w</p></blockquote>]
- `RQ@0 Link` — D10  
  B w=null c=0 @element:listitem@0 t=[k<hr /><blockquote><p>Q1w</p></blockquote>]  
  H w=[<a><hr /></a><blockquote><p>Q1w</p></blockquote>] c=1 @element:listitem@1 t=[<a><hr /></a><blockquote><p>kQ1w</p></blockquote>]
- `RQ@0 Quote` — D18  
  B w=[<blockquote></blockquote><hr /><blockquote><p>Q1w</p></blockquote>] c=1 @element:quote@0 t=[<blockquote>k</blockquote><hr /><blockquote><p>Q1w</p></blockquote>]  
  H w=null c=0 @element:listitem@0 t=[k<hr /><blockquote><p>Q1w</p></blockquote>]
- `RQ@0 ime` — D7  
  B w=[a<hr /><blockquote><p>Q1w</p></blockquote>] c=1 @text:a@1 t=[ak<hr /><blockquote><p>Q1w</p></blockquote>]  
  H w=[a<hr /><blockquote><p>Q1w</p></blockquote>] c=3 @text:a@1 t=[ak<hr /><blockquote><p>Q1w</p></blockquote>]
- `RQ@0 lineForward` — 5.3 deletes  
  B w=[<blockquote><p>Q1w</p></blockquote>] c=1 @text:Q1w@0 t=[<blockquote><p>kQ1w</p></blockquote>]  
  H w=[] c=1 @text: @1 t=[ k<blockquote></blockquote>]
- `RQ@1 Backspace` — 5.3 deletes  
  B w=[<blockquote><p>Q1w</p></blockquote>] c=1 @text:Q1w@0 t=[<blockquote><p>kQ1w</p></blockquote>]  
  H w=[<hr /><blockquote></blockquote>] c=1 @element:paragraph@0|element:listitem@1 t=[<hr /><blockquote><p>k</p></blockquote>]
- `RQ@1 Bold` — D18  
  B w=null c=0 @text:Q1w@0 t=[<hr /><blockquote><p><b><strong>k</strong></b>Q1w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<hr /><blockquote><p><b><strong>k</strong></b>Q1w</p></blockquote>]
- `RQ@1 Bulleted list` — D18  
  B w=<p>Pw</p><hr /><blockquote><p>Q1w</p></blockquote><p>Nw</p> c=1 @text:Q1w@0 t=<p>Pw</p><hr /><blockquote><p>kQ1w</p></blockquote><p>Nw</p>  
  H w=<p>Pw</p><hr /><blockquote><p>Q1w</p></blockquote><p>Nw</p> c=1 @element:root@3 t=<p>Pw</p><hr /><blockquote><p>Q1w</p></blockquote><p>k</p><p>Nw</p>
- `RQ@1 Code` — 5.7: Block type and Link at a point beside a quote (D18)  
  B w=[<hr /><blockquote><pre><code>Q1w</code></pre></blockquote>] c=1 @text:Q1w@0 t=[<hr /><blockquote><pre><code>kQ1w</code></pre></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<hr /><blockquote><p>kQ1w</p></blockquote>]
- `RQ@1 Ctrl+Backspace` — 5.3 deletes  
  B w=[<blockquote><p>Q1w</p></blockquote>] c=1 @text:Q1w@0 t=[<blockquote><p>kQ1w</p></blockquote>]  
  H w=<ul><li>PwQ1w</li><li>] c=1 @text:PwQ1w@2 t=<ul><li>PwkQ1w</li><li>]
- `RQ@1 Heading 2` — 5.7: Block type and Link at a point beside a quote (D18)  
  B w=[<hr /><blockquote><h2>Q1w</h2></blockquote>] c=1 @text:Q1w@0 t=[<hr /><blockquote><h2>kQ1w</h2></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<hr /><blockquote><p>kQ1w</p></blockquote>]
- `RQ@1 Image` — 5.7: Image at a point beside a quote (D18)  
  B w=[<hr /><blockquote><p><img />Q1w</p></blockquote>] c=1 @text:Q1w@0 t=[<hr /><blockquote><p><img />kQ1w</p></blockquote>]  
  H w=[<hr /><img /><blockquote><p>Q1w</p></blockquote>] c=1 @element:quote@0 t=[<hr /><img /><blockquote><p>kQ1w</p></blockquote>]
- `RQ@1 Italic` — D18  
  B w=null c=0 @text:Q1w@0 t=[<hr /><blockquote><p><i><em>k</em></i>Q1w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<hr /><blockquote><p><i><em>k</em></i>Q1w</p></blockquote>]
- `RQ@1 Link` — D18  
  B w=[<hr /><blockquote><p><a>Q1w</a></p></blockquote>] c=1 @text:Q1w@0 t=[<hr /><blockquote><p>k<a>Q1w</a></p></blockquote>]  
  H w=[<hr /><blockquote><p><a>Q1w</a></p></blockquote>] c=1 @element:listitem@1 t=[<hr /><blockquote><p>k<a>Q1w</a></p></blockquote>]
- `RQ@1 Numbered list` — D18  
  B w=<ol><li>Pw</li><li><hr /><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ol> c=1 @text:Q1w@0 t=<ol><li>Pw</li><li><hr /><blockquote><p>kQ1w</p></blockquote></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li><hr /><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ol> c=1 @element:listitem@1 t=<ol><li>Pw</li><li><hr /><blockquote><p>kQ1w</p></blockquote></li><li>Nw</li></ol>
- `RQ@1 Paragraph` — D18  
  B w=null c=0 @text:Q1w@0 t=[<hr /><blockquote><p>kQ1w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<hr /><blockquote><p>kQ1w</p></blockquote>]
- `RQ@1 Quote` — D18  
  B w=null c=0 @text:Q1w@0 t=[<hr /><blockquote><p>kQ1w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<hr /><blockquote><p>kQ1w</p></blockquote>]
- `RQ@1 Shift+Tab` — D18  
  B w=null c=0 @text:Q1w@0 t=  
  H w=null c=0 @element:listitem@1 t=
- `RQ@1 Strikethrough` — D18  
  B w=null c=0 @text:Q1w@0 t=[<hr /><blockquote><p><s>k</s>Q1w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<hr /><blockquote><p><s>k</s>Q1w</p></blockquote>]
- `RQ@1 Tab` — D18  
  B w=null c=0 @text:Q1w@0 t=  
  H w=null c=0 @element:listitem@1 t=
- `RQ@1 Underline` — D18  
  B w=null c=0 @text:Q1w@0 t=[<hr /><blockquote><p><u>k</u>Q1w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<hr /><blockquote><p><u>k</u>Q1w</p></blockquote>]
- `RQ@1 ime` — D7  
  B w=[<hr /><blockquote><p>aQ1w</p></blockquote>] c=2 @text:aQ1w@1 t=[<hr /><blockquote><p>akQ1w</p></blockquote>]  
  H w=[<hr /><blockquote><p>aQ1w</p></blockquote>] c=3 @text:aQ1w@1 t=[<hr /><blockquote><p>akQ1w</p></blockquote>]
- `RQ@1 lineBack` — 5.3 deletes  
  B w=[<blockquote><p>Q1w</p></blockquote>] c=1 @text:Q1w@0 t=[<blockquote><p>kQ1w</p></blockquote>]  
  H w=[<hr /><blockquote></blockquote>] c=1 @element:paragraph@0|element:listitem@1 t=[<hr /><blockquote><p>k</p></blockquote>]
- `RQ@1 placed` — D18  
  B text:Q1w@0  
  H element:listitem@1
- `RQ@2 Bold` — D18  
  B w=null c=0 @text:Q1w@3 t=[<hr /><blockquote><p>Q1w<b><strong>k</strong></b></p></blockquote>]  
  H w=null c=0 @element:listitem@2 t=[<hr /><blockquote><p>Q1w<b><strong>k</strong></b></p></blockquote>]
- `RQ@2 Bulleted list` — D18  
  B w=<p>Pw</p><hr /><blockquote><p>Q1w</p></blockquote><p>Nw</p> c=1 @text:Q1w@3 t=<p>Pw</p><hr /><blockquote><p>Q1wk</p></blockquote><p>Nw</p>  
  H w=<p>Pw</p><hr /><blockquote><p>Q1w</p></blockquote><p>Nw</p> c=1 @text:Pw@2 t=<p>Pwk</p><hr /><blockquote><p>Q1w</p></blockquote><p>Nw</p>
- `RQ@2 Code` — 5.7: Block type and Link at a point beside a quote (D18)  
  B w=[<hr /><blockquote><pre><code>Q1w</code></pre></blockquote>] c=1 @text:Q1w@3 t=[<hr /><blockquote><pre><code>Q1wk</code></pre></blockquote>]  
  H w=null c=0 @element:listitem@2 t=[<hr /><blockquote><p>Q1wk</p></blockquote>]
- `RQ@2 Divider` — 5.7: Divider at the start or end of a block in a lined item  
  B w=[<hr /><blockquote><p>Q1w</p></blockquote></li></ul><hr /><ul><li>Nw</li></ul> c=1 @text:Nw@0 t=[<hr /><blockquote><p>Q1w</p></blockquote></li></ul><hr /><ul><li>kNw</li></ul>  
  H w=<ul><li>Pw</li></ul><hr /><ul><li><hr /><blockquote><p>Q1w</p></blockquote>] c=1 @element:listitem@0 t=<ul><li>Pw</li></ul><hr /><ul><li>k<hr /><blockquote><p>Q1w</p></blockquote>]
- `RQ@2 Heading 2` — 5.7: Block type and Link at a point beside a quote (D18)  
  B w=[<hr /><blockquote><h2>Q1w</h2></blockquote>] c=1 @text:Q1w@3 t=[<hr /><blockquote><h2>Q1wk</h2></blockquote>]  
  H w=null c=0 @element:listitem@2 t=[<hr /><blockquote><p>Q1wk</p></blockquote>]
- `RQ@2 Image` — 5.7: Image at a point beside a quote (D18)  
  B w=[<hr /><blockquote><p>Q1w<img /></p></blockquote>] c=1 @element:paragraph@2 t=[<hr /><blockquote><p>Q1w<img />k</p></blockquote>]  
  H w=[<hr /><blockquote><p>Q1w</p></blockquote><img />] c=1 @element:listitem@3 t=[<hr /><blockquote><p>Q1w</p></blockquote><img />k]
- `RQ@2 Italic` — D18  
  B w=null c=0 @text:Q1w@3 t=[<hr /><blockquote><p>Q1w<i><em>k</em></i></p></blockquote>]  
  H w=null c=0 @element:listitem@2 t=[<hr /><blockquote><p>Q1w<i><em>k</em></i></p></blockquote>]
- `RQ@2 Link` — D18  
  B w=[<hr /><blockquote><p><a>Q1w</a></p></blockquote>] c=1 @text:Q1w@3 t=[<hr /><blockquote><p><a>Q1w</a>k</p></blockquote>]  
  H w=[<hr /><blockquote><p><a>Q1w</a></p></blockquote>] c=1 @element:listitem@2 t=[<hr /><blockquote><p><a>Q1w</a>k</p></blockquote>]
- `RQ@2 Numbered list` — D18  
  B w=<ol><li>Pw</li><li><hr /><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ol> c=1 @text:Q1w@3 t=<ol><li>Pw</li><li><hr /><blockquote><p>Q1wk</p></blockquote></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li><hr /><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ol> c=1 @element:listitem@2 t=<ol><li>Pw</li><li><hr /><blockquote><p>Q1wk</p></blockquote></li><li>Nw</li></ol>
- `RQ@2 Paragraph` — D18  
  B w=null c=0 @text:Q1w@3 t=[<hr /><blockquote><p>Q1wk</p></blockquote>]  
  H w=null c=0 @element:listitem@2 t=[<hr /><blockquote><p>Q1wk</p></blockquote>]
- `RQ@2 Quote` — D18  
  B w=null c=0 @text:Q1w@3 t=[<hr /><blockquote><p>Q1wk</p></blockquote>]  
  H w=null c=0 @element:listitem@2 t=[<hr /><blockquote><p>Q1wk</p></blockquote>]
- `RQ@2 Shift+Tab` — D18  
  B w=null c=0 @text:Q1w@3 t=  
  H w=null c=0 @element:listitem@2 t=
- `RQ@2 Strikethrough` — D18  
  B w=null c=0 @text:Q1w@3 t=[<hr /><blockquote><p>Q1w<s>k</s></p></blockquote>]  
  H w=null c=0 @element:listitem@2 t=[<hr /><blockquote><p>Q1w<s>k</s></p></blockquote>]
- `RQ@2 Tab` — D18  
  B w=null c=0 @text:Q1w@3 t=  
  H w=null c=0 @element:listitem@2 t=
- `RQ@2 Underline` — D18  
  B w=null c=0 @text:Q1w@3 t=[<hr /><blockquote><p>Q1w<u>k</u></p></blockquote>]  
  H w=null c=0 @element:listitem@2 t=[<hr /><blockquote><p>Q1w<u>k</u></p></blockquote>]
- `RQ@2 ime` — D7  
  B w=[<hr /><blockquote><p>Q1wa</p></blockquote>] c=2 @text:Q1wa@4 t=[<hr /><blockquote><p>Q1wak</p></blockquote>]  
  H w=[<hr /><blockquote><p>Q1wa</p></blockquote>] c=3 @text:Q1wa@4 t=[<hr /><blockquote><p>Q1wak</p></blockquote>]
- `RQ@2 placed` — D18  
  B text:Q1w@3  
  H element:listitem@2
- `RR@0 Backspace` — head flagged: D19  
  B w=<ul><li>Pw<hr /><hr />] c=1 @text:Pw@2 t=<ul><li>Pwk<hr /><hr />]  
  H w=[<hr /><hr />] c=1 @text:Pw@2 t=<ul><li>Pwk</li><li><hr /><hr />]
- `RR@0 Code` — D13  
  B w=[<pre><code></code></pre><hr /><hr />] c=1 @element:code@0 t=[<pre><code>k</code></pre><hr /><hr />]  
  H w=null c=0 @element:listitem@0 t=[k<hr /><hr />]
- `RR@0 Ctrl+Backspace` — 5.3 deletes  
  B w=<ul><li>Pw<hr /><hr />] c=1 @text:Pw@2 t=<ul><li>Pwk<hr /><hr />]  
  H w=<ul><li></li><li><hr /><hr />] c=1 @element:listitem@0 t=<ul><li>k<hr /><hr />]
- `RR@0 Heading 2` — D13  
  B w=[<h2></h2><hr /><hr />] c=1 @element:heading@0 t=[<h2>k</h2><hr /><hr />]  
  H w=null c=0 @element:listitem@0 t=[k<hr /><hr />]
- `RR@0 Link` — D10  
  B w=null c=0 @element:listitem@0 t=[k<hr /><hr />]  
  H w=[<a><hr /></a><hr />] c=1 @element:listitem@1 t=[<a><hr /></a>k<hr />]
- `RR@0 Quote` — D13  
  B w=[<blockquote></blockquote><hr /><hr />] c=1 @element:quote@0 t=[<blockquote>k</blockquote><hr /><hr />]  
  H w=null c=0 @element:listitem@0 t=[k<hr /><hr />]
- `RR@0 ime` — D7  
  B w=[a<hr /><hr />] c=1 @text:a@1 t=[ak<hr /><hr />]  
  H w=[a<hr /><hr />] c=3 @text:a@1 t=[ak<hr /><hr />]
- `RR@0 lineForward` — 5.3 deletes  
  B w=[<hr />] c=1 @element:listitem@0 t=[k<hr />]  
  H w=[] c=1 @text: @1 t=[ k]
- `RR@1 Code` — D13  
  B w=[<hr /><pre><code></code></pre><hr />] c=1 @element:code@0 t=[<hr /><pre><code>k</code></pre><hr />]  
  H w=null c=0 @element:listitem@1 t=[<hr />k<hr />]
- `RR@1 Heading 2` — D13  
  B w=[<hr /><h2></h2><hr />] c=1 @element:heading@0 t=[<hr /><h2>k</h2><hr />]  
  H w=null c=0 @element:listitem@1 t=[<hr />k<hr />]
- `RR@1 Link` — D10  
  B w=null c=0 @element:listitem@1 t=[<hr />k<hr />]  
  H w=[<hr /><a><hr /></a>] c=1 @element:listitem@2 t=[<hr /><a><hr /></a>k]
- `RR@1 Quote` — D13  
  B w=[<hr /><blockquote></blockquote><hr />] c=1 @element:quote@0 t=[<hr /><blockquote>k</blockquote><hr />]  
  H w=null c=0 @element:listitem@1 t=[<hr />k<hr />]
- `RR@1 ime` — D7  
  B w=[<hr />a<hr />] c=1 @text:a@1 t=[<hr />ak<hr />]  
  H w=[<hr />a<hr />] c=3 @text:a@1 t=[<hr />ak<hr />]
- `RR@1 lineForward` — 5.3 deletes  
  B w=[<hr />] c=1 @element:listitem@1 t=[<hr />k]  
  H w=[<hr /> ] c=1 @text: @1 t=[<hr /> k]
- `RR@2 Code` — D13  
  B w=[<hr /><hr /><pre><code></code></pre>] c=1 @element:code@0 t=[<hr /><hr /><pre><code>k</code></pre>]  
  H w=null c=0 @element:listitem@2 t=[<hr /><hr />k]
- `RR@2 Ctrl+Delete` — 5.3 deletes  
  B w=[<hr /><hr />Nw</li></ul> c=1 @text:Nw@0 t=[<hr /><hr />kNw</li></ul>  
  H w=[<hr />] c=1 @text:Nw@0 t=[<hr /></li><li>kNw</li></ul>
- `RR@2 Delete` — 5.3 deletes  
  B w=[<hr /><hr />Nw</li></ul> c=1 @text:Nw@0 t=[<hr /><hr />kNw</li></ul>  
  H w=[<hr />] c=1 @element:listitem@1 t=[<hr />k]
- `RR@2 Heading 2` — D13  
  B w=[<hr /><hr /><h2></h2>] c=1 @element:heading@0 t=[<hr /><hr /><h2>k</h2>]  
  H w=null c=0 @element:listitem@2 t=[<hr /><hr />k]
- `RR@2 Link` — D10  
  B w=null c=0 @element:listitem@2 t=[<hr /><hr />k]  
  H w=[<hr /><a><hr /></a>] c=1 @element:listitem@3 t=[<hr /><a><hr /></a>]
- `RR@2 Quote` — D13  
  B w=[<hr /><hr /><blockquote></blockquote>] c=1 @element:quote@0 t=[<hr /><hr /><blockquote>k</blockquote>]  
  H w=null c=0 @element:listitem@2 t=[<hr /><hr />k]
- `RR@2 ime` — D7  
  B w=[<hr /><hr />a] c=1 @text:a@1 t=[<hr /><hr />ak]  
  H w=[<hr /><hr />a] c=3 @text:a@1 t=[<hr /><hr />ak]
- `RR@2 lineForward` — head flagged: D19  
  B w=[<hr /><hr />Nw</li></ul> c=1 @text:Nw@0 t=[<hr /><hr />kNw</li></ul>  
  H w=[<hr /><hr />] c=1 @element:listitem@2 t=[<hr /><hr />k]
- `RT@0 Backspace` — head flagged: D19  
  B w=<ul><li>Pw<hr />T1w] c=1 @text:Pw@2 t=<ul><li>Pwk<hr />T1w]  
  H w=[<hr />T1w] c=1 @text:Pw@2 t=<ul><li>Pwk</li><li><hr />T1w]
- `RT@0 Code` — D13  
  B w=[<pre><code></code></pre><hr />T1w] c=1 @element:code@0 t=[<pre><code>k</code></pre><hr />T1w]  
  H w=null c=0 @element:listitem@0 t=[k<hr />T1w]
- `RT@0 Ctrl+Backspace` — 5.3 deletes  
  B w=<ul><li>Pw<hr />T1w] c=1 @text:Pw@2 t=<ul><li>Pwk<hr />T1w]  
  H w=<ul><li></li><li><hr />T1w] c=1 @element:listitem@0 t=<ul><li>k<hr />T1w]
- `RT@0 Ctrl+Delete` — D18  
  B w=[T1w] c=1 @element:listitem@0 t=[kT1w]  
  H w=[T1w] c=1 @text:T1w@0 t=[kT1w]
- `RT@0 Delete` — D18  
  B w=[T1w] c=1 @element:listitem@0 t=[kT1w]  
  H w=[T1w] c=1 @text:T1w@0 t=[kT1w]
- `RT@0 Heading 2` — D13  
  B w=[<h2></h2><hr />T1w] c=1 @element:heading@0 t=[<h2>k</h2><hr />T1w]  
  H w=null c=0 @element:listitem@0 t=[k<hr />T1w]
- `RT@0 Link` — D10  
  B w=null c=0 @element:listitem@0 t=[k<hr />T1w]  
  H w=[<a><hr /></a>T1w] c=1 @text:T1w@0 t=[<a><hr /></a>kT1w]
- `RT@0 Quote` — D13  
  B w=[<blockquote></blockquote><hr />T1w] c=1 @element:quote@0 t=[<blockquote>k</blockquote><hr />T1w]  
  H w=null c=0 @element:listitem@0 t=[k<hr />T1w]
- `RT@0 ime` — D7  
  B w=[a<hr />T1w] c=1 @text:a@1 t=[ak<hr />T1w]  
  H w=[a<hr />T1w] c=3 @text:a@1 t=[ak<hr />T1w]
- `RT@0 lineForward` — 5.3 deletes  
  B w=[T1w] c=1 @element:listitem@0 t=[kT1w]  
  H w=[ 1w] c=1 @text: 1w@1 t=[ k1w]
- `RT@1 Code` — D13: Block type acts on the caret's line  
  B w=[<hr /><pre><code>T1w</code></pre>] c=1 @text:T1w@0 t=[<hr /><pre><code>kT1w</code></pre>]  
  H w=null c=0 @text:T1w@0 t=[<hr />kT1w]
- `RT@1 Heading 2` — D13: Block type acts on the caret's line  
  B w=[<hr /><h2>T1w</h2>] c=1 @text:T1w@0 t=[<hr /><h2>kT1w</h2>]  
  H w=null c=0 @text:T1w@0 t=[<hr />kT1w]
- `RT@1 Quote` — D13: Block type acts on the caret's line  
  B w=[<hr /><blockquote>T1w</blockquote>] c=1 @text:T1w@0 t=[<hr /><blockquote>kT1w</blockquote>]  
  H w=null c=0 @text:T1w@0 t=[<hr />kT1w]
- `RT@1 ime` — D7  
  B w=[<hr />aT1w] c=2 @text:aT1w@1 t=[<hr />akT1w]  
  H w=[<hr />aT1w] c=3 @text:aT1w@1 t=[<hr />akT1w]
- `RT@2 Code` — D13: Block type acts on the caret's line  
  B w=[<hr /><pre><code>T1w</code></pre>] c=1 @text:T1w@3 t=[<hr /><pre><code>T1wk</code></pre>]  
  H w=null c=0 @text:T1w@3 t=[<hr />T1wk]
- `RT@2 Ctrl+Delete` — head flagged: D19  
  B w=[<hr />T1wNw</li></ul> c=1 @text:T1wNw@3 t=[<hr />T1wkNw</li></ul>  
  H w=[<hr />T1w] c=1 @text:T1w@3 t=[<hr />T1wk]
- `RT@2 Delete` — head flagged: D19  
  B w=[<hr />T1wNw</li></ul> c=1 @text:T1wNw@3 t=[<hr />T1wkNw</li></ul>  
  H w=[<hr />T1w] c=1 @text:T1w@3 t=[<hr />T1wk]
- `RT@2 Heading 2` — D13: Block type acts on the caret's line  
  B w=[<hr /><h2>T1w</h2>] c=1 @text:T1w@3 t=[<hr /><h2>T1wk</h2>]  
  H w=null c=0 @text:T1w@3 t=[<hr />T1wk]
- `RT@2 Quote` — D13: Block type acts on the caret's line  
  B w=[<hr /><blockquote>T1w</blockquote>] c=1 @text:T1w@3 t=[<hr /><blockquote>T1wk</blockquote>]  
  H w=null c=0 @text:T1w@3 t=[<hr />T1wk]
- `RT@2 ime` — D7  
  B w=[<hr />T1wa] c=2 @text:T1wa@4 t=[<hr />T1wak]  
  H w=[<hr />T1wa] c=3 @text:T1wa@4 t=[<hr />T1wak]
- `TR@0 Code` — D13: Block type acts on the caret's line  
  B w=[<pre><code>T0w</code></pre><hr />] c=1 @text:T0w@0 t=[<pre><code>kT0w</code></pre><hr />]  
  H w=<ul><li>Pw</li></ul><pre><code>T0w</code></pre><hr /><ul><li>Nw</li></ul> c=1 @text:T0w@0 t=<ul><li>Pw</li></ul><pre><code>kT0w</code></pre><hr /><ul><li>Nw</li></ul>
- `TR@0 Heading 2` — D13: Block type acts on the caret's line  
  B w=[<h2>T0w</h2><hr />] c=1 @text:T0w@0 t=[<h2>kT0w</h2><hr />]  
  H w=<ul><li>Pw</li></ul><h2>T0w</h2><hr /><ul><li>Nw</li></ul> c=1 @text:T0w@0 t=<ul><li>Pw</li></ul><h2>kT0w</h2><hr /><ul><li>Nw</li></ul>
- `TR@0 Quote` — D13: Block type acts on the caret's line  
  B w=[<blockquote>T0w</blockquote><hr />] c=1 @text:T0w@0 t=[<blockquote>kT0w</blockquote><hr />]  
  H w=<ul><li>Pw</li></ul><blockquote>T0w<hr /></blockquote><ul><li>Nw</li></ul> c=1 @text:T0w@0 t=<ul><li>Pw</li></ul><blockquote>kT0w<hr /></blockquote><ul><li>Nw</li></ul>
- `TR@0 ime` — D7  
  B w=[aT0w<hr />] c=2 @text:aT0w@1 t=[akT0w<hr />]  
  H w=[aT0w<hr />] c=3 @text:aT0w@1 t=[akT0w<hr />]
- `TR@1 Bold` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<b><strong>k</strong></b><hr />]  
  H w=null c=0 @element:listitem@1 t=[T0w<b><strong>k</strong></b><hr />]
- `TR@1 Code` — D13: Block type acts on the caret's line  
  B w=[<pre><code>T0w</code></pre><hr />] c=1 @text:T0w@3 t=[<pre><code>T0wk</code></pre><hr />]  
  H w=<ul><li>Pw</li></ul><pre><code>T0w</code></pre><hr /><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><pre><code>T0w</code></pre><hr /><ul><li>Nw</li></ul>
- `TR@1 Heading 2` — D13: Block type acts on the caret's line  
  B w=[<h2>T0w</h2><hr />] c=1 @text:T0w@3 t=[<h2>T0wk</h2><hr />]  
  H w=<ul><li>Pw</li></ul><h2>T0w</h2><hr /><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><h2>T0w</h2><hr /><ul><li>Nw</li></ul>
- `TR@1 Italic` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<i><em>k</em></i><hr />]  
  H w=null c=0 @element:listitem@1 t=[T0w<i><em>k</em></i><hr />]
- `TR@1 Link` — D10  
  B w=[<a>T0w</a><hr />] c=1 @text:T0w@3 t=[<a>T0w</a>k<hr />]  
  H w=[T0w<a><hr /></a>] c=1 @element:listitem@2 t=[T0w<a><hr /></a>k]
- `TR@1 Numbered list` — D18  
  B w=<ol><li>Pw</li><li>T0w<hr /></li><li>Nw</li></ol> c=1 @text:T0w@3 t=<ol><li>Pw</li><li>T0wk<hr /></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li>T0w<hr /></li><li>Nw</li></ol> c=1 @element:listitem@1 t=<ol><li>Pw</li><li>T0wk<hr /></li><li>Nw</li></ol>
- `TR@1 Paragraph` — D18  
  B w=null c=0 @text:T0w@3 t=[T0wk<hr />]  
  H w=null c=0 @element:listitem@1 t=[T0wk<hr />]
- `TR@1 Quote` — D13: Block type acts on the caret's line  
  B w=[<blockquote>T0w</blockquote><hr />] c=1 @text:T0w@3 t=[<blockquote>T0wk</blockquote><hr />]  
  H w=<ul><li>Pw</li></ul><blockquote>T0w<hr /></blockquote><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><blockquote>T0w<hr /></blockquote><ul><li>Nw</li></ul>
- `TR@1 Shift+Tab` — D18  
  B w=null c=0 @text:T0w@3 t=  
  H w=null c=0 @element:listitem@1 t=
- `TR@1 Strikethrough` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<s>k</s><hr />]  
  H w=null c=0 @element:listitem@1 t=[T0w<s>k</s><hr />]
- `TR@1 Tab` — D18  
  B w=null c=0 @text:T0w@3 t=  
  H w=null c=0 @element:listitem@1 t=
- `TR@1 Underline` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<u>k</u><hr />]  
  H w=null c=0 @element:listitem@1 t=[T0w<u>k</u><hr />]
- `TR@1 cut` — D18  
  B w=null c=0 @text:T0w@3 t=[T0wk<hr />]  
  H w=null c=0 @element:listitem@1 t=[T0wk<hr />]
- `TR@1 ime` — D7  
  B w=[T0wa<hr />] c=2 @text:T0wa@4 t=[T0wak<hr />]  
  H w=[T0wa<hr />] c=3 @text:T0wa@4 t=[T0wak<hr />]
- `TR@1 lineBack` — 5.3 deletes  
  B w=[<hr />] c=1 @element:listitem@0 t=[k<hr />]  
  H w=[ <hr />] c=1 @text: @0 t=[k <hr />]
- `TR@1 lineForward` — 5.3 deletes  
  B w=[T0w] c=1 @text:T0w@3 t=[T0wk]  
  H w=[T0w ] c=1 @text:T0w @4 t=[T0w k]
- `TR@1 placed` — D18  
  B text:T0w@3  
  H element:listitem@1
- `TR@2 Code` — D13  
  B w=[T0w<hr /><pre><code></code></pre>] c=1 @element:code@0 t=[T0w<hr /><pre><code>k</code></pre>]  
  H w=<ul><li>Pw</li></ul><pre><code>T0w</code></pre><hr /><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><pre><code>T0w</code></pre><hr /><ul><li>Nw</li></ul>
- `TR@2 Ctrl+Delete` — 5.3 deletes  
  B w=[T0w<hr />Nw</li></ul> c=1 @text:Nw@0 t=[T0w<hr />kNw</li></ul>  
  H w=[T0wNw</li></ul> c=1 @text:T0wNw@3 t=[T0wkNw</li></ul>
- `TR@2 Delete` — 5.3 deletes  
  B w=[T0w<hr />Nw</li></ul> c=1 @text:Nw@0 t=[T0w<hr />kNw</li></ul>  
  H w=[T0w] c=1 @text:T0w@3 t=[T0wk]
- `TR@2 Heading 2` — D13  
  B w=[T0w<hr /><h2></h2>] c=1 @element:heading@0 t=[T0w<hr /><h2>k</h2>]  
  H w=<ul><li>Pw</li></ul><h2>T0w</h2><hr /><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><h2>T0w</h2><hr /><ul><li>Nw</li></ul>
- `TR@2 Link` — D10  
  B w=null c=0 @element:listitem@2 t=[T0w<hr />k]  
  H w=[T0w<a><hr /></a>] c=1 @element:listitem@3 t=[T0w<a><hr /></a>]
- `TR@2 Quote` — D13  
  B w=[T0w<hr /><blockquote></blockquote>] c=1 @element:quote@0 t=[T0w<hr /><blockquote>k</blockquote>]  
  H w=<ul><li>Pw</li></ul><blockquote>T0w<hr /></blockquote><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><blockquote>T0w<hr /></blockquote><ul><li>Nw</li></ul>
- `TR@2 ime` — D7  
  B w=[T0w<hr />a] c=1 @text:a@1 t=[T0w<hr />ak]  
  H w=[T0w<hr />a] c=3 @text:a@1 t=[T0w<hr />ak]
- `TR@2 lineForward` — head flagged: D19  
  B w=[T0w<hr />Nw</li></ul> c=1 @text:Nw@0 t=[T0w<hr />kNw</li></ul>  
  H w=[T0w<hr />] c=1 @element:listitem@2 t=[T0w<hr />k]
- `TRT@0 Code` — D13: Block type acts on the caret's line  
  B w=[<pre><code>T0w</code></pre><hr />T2w] c=1 @text:T0w@0 t=[<pre><code>kT0w</code></pre><hr />T2w]  
  H w=<ul><li>Pw</li></ul><pre><code>T0wT2w</code></pre><hr /><ul><li>Nw</li></ul> c=1 @text:T0wT2w@0 t=<ul><li>Pw</li></ul><pre><code>kT0wT2w</code></pre><hr /><ul><li>Nw</li></ul>
- `TRT@0 Heading 2` — D13: Block type acts on the caret's line  
  B w=[<h2>T0w</h2><hr />T2w] c=1 @text:T0w@0 t=[<h2>kT0w</h2><hr />T2w]  
  H w=<ul><li>Pw</li></ul><h2>T0w</h2><hr /><h2>T2w</h2><ul><li>Nw</li></ul> c=1 @text:T0w@0 t=<ul><li>Pw</li></ul><h2>kT0w</h2><hr /><h2>T2w</h2><ul><li>Nw</li></ul>
- `TRT@0 Quote` — D13: Block type acts on the caret's line  
  B w=[<blockquote>T0w</blockquote><hr />T2w] c=1 @text:T0w@0 t=[<blockquote>kT0w</blockquote><hr />T2w]  
  H w=<ul><li>Pw</li></ul><blockquote>T0w<hr />T2w</blockquote><ul><li>Nw</li></ul> c=1 @text:T0w@0 t=<ul><li>Pw</li></ul><blockquote>kT0w<hr />T2w</blockquote><ul><li>Nw</li></ul>
- `TRT@0 ime` — D7  
  B w=[aT0w<hr />T2w] c=2 @text:aT0w@1 t=[akT0w<hr />T2w]  
  H w=[aT0w<hr />T2w] c=3 @text:aT0w@1 t=[akT0w<hr />T2w]
- `TRT@1 Bold` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<b><strong>k</strong></b><hr />T2w]  
  H w=null c=0 @element:listitem@1 t=[T0w<b><strong>k</strong></b><hr />T2w]
- `TRT@1 Code` — D13: Block type acts on the caret's line  
  B w=[<pre><code>T0w</code></pre><hr />T2w] c=1 @text:T0w@3 t=[<pre><code>T0wk</code></pre><hr />T2w]  
  H w=<ul><li>Pw</li></ul><pre><code>T0wT2w</code></pre><hr /><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><pre><code>T0wT2w</code></pre><hr /><ul><li>Nw</li></ul>
- `TRT@1 Heading 2` — D13: Block type acts on the caret's line  
  B w=[<h2>T0w</h2><hr />T2w] c=1 @text:T0w@3 t=[<h2>T0wk</h2><hr />T2w]  
  H w=<ul><li>Pw</li></ul><h2>T0w</h2><hr /><h2>T2w</h2><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><h2>T0w</h2><hr /><h2>T2w</h2><ul><li>Nw</li></ul>
- `TRT@1 Italic` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<i><em>k</em></i><hr />T2w]  
  H w=null c=0 @element:listitem@1 t=[T0w<i><em>k</em></i><hr />T2w]
- `TRT@1 Link` — D10  
  B w=[<a>T0w</a><hr />T2w] c=1 @text:T0w@3 t=[<a>T0w</a>k<hr />T2w]  
  H w=[T0w<a><hr /></a>T2w] c=1 @text:T2w@0 t=[T0w<a><hr /></a>kT2w]
- `TRT@1 Numbered list` — D18  
  B w=<ol><li>Pw</li><li>T0w<hr />T2w</li><li>Nw</li></ol> c=1 @text:T0w@3 t=<ol><li>Pw</li><li>T0wk<hr />T2w</li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li>T0w<hr />T2w</li><li>Nw</li></ol> c=1 @element:listitem@1 t=<ol><li>Pw</li><li>T0wk<hr />T2w</li><li>Nw</li></ol>
- `TRT@1 Paragraph` — D18  
  B w=null c=0 @text:T0w@3 t=[T0wk<hr />T2w]  
  H w=null c=0 @element:listitem@1 t=[T0wk<hr />T2w]
- `TRT@1 Quote` — D13: Block type acts on the caret's line  
  B w=[<blockquote>T0w</blockquote><hr />T2w] c=1 @text:T0w@3 t=[<blockquote>T0wk</blockquote><hr />T2w]  
  H w=<ul><li>Pw</li></ul><blockquote>T0w<hr />T2w</blockquote><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><blockquote>T0w<hr />T2w</blockquote><ul><li>Nw</li></ul>
- `TRT@1 Shift+Tab` — D18  
  B w=null c=0 @text:T0w@3 t=  
  H w=null c=0 @element:listitem@1 t=
- `TRT@1 Strikethrough` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<s>k</s><hr />T2w]  
  H w=null c=0 @element:listitem@1 t=[T0w<s>k</s><hr />T2w]
- `TRT@1 Tab` — D18  
  B w=null c=0 @text:T0w@3 t=  
  H w=null c=0 @element:listitem@1 t=
- `TRT@1 Underline` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<u>k</u><hr />T2w]  
  H w=null c=0 @element:listitem@1 t=[T0w<u>k</u><hr />T2w]
- `TRT@1 cut` — D18  
  B w=null c=0 @text:T0w@3 t=[T0wk<hr />T2w]  
  H w=null c=0 @element:listitem@1 t=[T0wk<hr />T2w]
- `TRT@1 ime` — D7  
  B w=[T0wa<hr />T2w] c=2 @text:T0wa@4 t=[T0wak<hr />T2w]  
  H w=[T0wa<hr />T2w] c=3 @text:T0wa@4 t=[T0wak<hr />T2w]
- `TRT@1 lineBack` — 5.3 deletes  
  B w=[<hr />T2w] c=1 @element:listitem@0 t=[k<hr />T2w]  
  H w=[ <hr />T2w] c=1 @text: @0 t=[k <hr />T2w]
- `TRT@1 lineForward` — 5.3 deletes  
  B w=[T0wT2w] c=1 @text:T0wT2w@3 t=[T0wkT2w]  
  H w=[T0w 2w] c=1 @text:T0w 2w@4 t=[T0w k2w]
- `TRT@1 placed` — D18  
  B text:T0w@3  
  H element:listitem@1
- `TRT@2 Code` — D13: Block type acts on the caret's line  
  B w=[T0w<hr /><pre><code>T2w</code></pre>] c=1 @text:T2w@0 t=[T0w<hr /><pre><code>kT2w</code></pre>]  
  H w=<ul><li>Pw</li></ul><pre><code>T0wT2w</code></pre><hr /><ul><li>Nw</li></ul> c=1 @text:T0wT2w@3 t=<ul><li>Pw</li></ul><pre><code>T0wkT2w</code></pre><hr /><ul><li>Nw</li></ul>
- `TRT@2 Heading 2` — D13: Block type acts on the caret's line  
  B w=[T0w<hr /><h2>T2w</h2>] c=1 @text:T2w@0 t=[T0w<hr /><h2>kT2w</h2>]  
  H w=<ul><li>Pw</li></ul><h2>T0w</h2><hr /><h2>T2w</h2><ul><li>Nw</li></ul> c=1 @text:T2w@0 t=<ul><li>Pw</li></ul><h2>T0w</h2><hr /><h2>kT2w</h2><ul><li>Nw</li></ul>
- `TRT@2 Quote` — D13: Block type acts on the caret's line  
  B w=[T0w<hr /><blockquote>T2w</blockquote>] c=1 @text:T2w@0 t=[T0w<hr /><blockquote>kT2w</blockquote>]  
  H w=<ul><li>Pw</li></ul><blockquote>T0w<hr />T2w</blockquote><ul><li>Nw</li></ul> c=1 @text:T2w@0 t=<ul><li>Pw</li></ul><blockquote>T0w<hr />kT2w</blockquote><ul><li>Nw</li></ul>
- `TRT@2 ime` — D7  
  B w=[T0w<hr />aT2w] c=2 @text:aT2w@1 t=[T0w<hr />akT2w]  
  H w=[T0w<hr />aT2w] c=3 @text:aT2w@1 t=[T0w<hr />akT2w]
- `TRT@3 Code` — D13: Block type acts on the caret's line  
  B w=[T0w<hr /><pre><code>T2w</code></pre>] c=1 @text:T2w@3 t=[T0w<hr /><pre><code>T2wk</code></pre>]  
  H w=<ul><li>Pw</li></ul><pre><code>T0wT2w</code></pre><hr /><ul><li>Nw</li></ul> c=1 @text:T0wT2w@6 t=<ul><li>Pw</li></ul><pre><code>T0wT2wk</code></pre><hr /><ul><li>Nw</li></ul>
- `TRT@3 Heading 2` — D13: Block type acts on the caret's line  
  B w=[T0w<hr /><h2>T2w</h2>] c=1 @text:T2w@3 t=[T0w<hr /><h2>T2wk</h2>]  
  H w=<ul><li>Pw</li></ul><h2>T0w</h2><hr /><h2>T2w</h2><ul><li>Nw</li></ul> c=1 @text:T2w@3 t=<ul><li>Pw</li></ul><h2>T0w</h2><hr /><h2>T2wk</h2><ul><li>Nw</li></ul>
- `TRT@3 Quote` — D13: Block type acts on the caret's line  
  B w=[T0w<hr /><blockquote>T2w</blockquote>] c=1 @text:T2w@3 t=[T0w<hr /><blockquote>T2wk</blockquote>]  
  H w=<ul><li>Pw</li></ul><blockquote>T0w<hr />T2w</blockquote><ul><li>Nw</li></ul> c=1 @text:T2w@3 t=<ul><li>Pw</li></ul><blockquote>T0w<hr />T2wk</blockquote><ul><li>Nw</li></ul>
- `TRT@3 ime` — D7  
  B w=[T0w<hr />T2wa] c=2 @text:T2wa@4 t=[T0w<hr />T2wak]  
  H w=[T0w<hr />T2wa] c=3 @text:T2wa@4 t=[T0w<hr />T2wak]

## meeting (241 differences)

- 83: D18: every command starts from the one caret
- 63: D18
- 42: 5.3 deletes
- 34: D13: Block type acts on the caret's line
- 7: head flagged: D19
- 4: UNEXPLAINED
- 3: head flagged: hang
- 2: head flagged: console errors
- 2: D7
- 1: head flagged: D18 step 1

- `AQ el1 Bold` — D18  
  B w=null c=0 @text:Aw@2 t=[<a>Aw</a><b><strong>k</strong></b><blockquote><p>Q1w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<a>Aw</a><b><strong>k</strong></b><blockquote><p>Q1w</p></blockquote>]
- `AQ el1 Bulleted list` — D18: every command starts from the one caret  
  B w=<p>Pw</p><p><a>Aw</a></p><blockquote><p>Q1w</p></blockquote><p>Nw</p> c=1 @text:Aw@2 t=<p>Pw</p><p><a>Aw</a>k</p><blockquote><p>Q1w</p></blockquote><p>Nw</p>  
  H w=<p>Pw</p><p><a>Aw</a></p><blockquote><p>Q1w</p></blockquote><p>Nw</p> c=1 @element:paragraph@1 t=<p>Pw</p><p><a>Aw</a>k</p><blockquote><p>Q1w</p></blockquote><p>Nw</p>
- `AQ el1 Code` — D13: Block type acts on the caret's line  
  B w=[<pre><code>Aw</code></pre><blockquote><p>Q1w</p></blockquote>] c=1 @text:Aw@2 t=[<pre><code>Awk</code></pre><blockquote><p>Q1w</p></blockquote>]  
  H w=<ul><li>Pw</li></ul><pre><code>Aw
  Q1w</code></pre><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><pre><code>Aw
  Q1w</code></pre><ul><li>Nw</li></ul>
- `AQ el1 Ctrl+Backspace` — 5.3 deletes  
  B w=[<blockquote><p>Q1w</p></blockquote>] c=1 @element:listitem@0 t=[k<blockquote><p>Q1w</p></blockquote>]  
  H w=[<blockquote><p>Q1w</p></blockquote>] c=1 @element:quote@0 t=[<blockquote><p>kQ1w</p></blockquote>]
- `AQ el1 Ctrl+Delete` — 5.3 deletes  
  B w=[<a>Aw</a>Q1w] c=1 @text:Q1w@0 t=[<a>Aw</a>kQ1w]  
  H w=[<a>Aw</a><blockquote></blockquote>Q1w] c=1 @text:Aw@2 t=[<a>Aw</a>k<blockquote></blockquote>Q1w]
- `AQ el1 Delete` — 5.3 deletes  
  B w=[<a>Aw</a>Q1w] c=1 @text:Q1w@0 t=[<a>Aw</a>kQ1w]  
  H w=[<a>Aw</a><blockquote></blockquote>Q1w] c=1 @text:Aw@2 t=[<a>Aw</a>k<blockquote></blockquote>Q1w]
- `AQ el1 Enter` — D18: every command starts from the one caret  
  B w=[<a>Aw</a></li><li><blockquote><p>Q1w</p></blockquote>] c=1 @text:Q1w@0 t=[<a>Aw</a></li><li><blockquote><p>kQ1w</p></blockquote>]  
  H w=[<a>Aw</a><blockquote><p></p><p>Q1w</p></blockquote>] c=1 @text:Q1w@0 t=[<a>Aw</a><blockquote><p></p><p>kQ1w</p></blockquote>]
- `AQ el1 Heading 2` — D13: Block type acts on the caret's line  
  B w=[<h2><a>Aw</a></h2><blockquote><p>Q1w</p></blockquote>] c=1 @text:Aw@2 t=[<h2><a>Aw</a>k</h2><blockquote><p>Q1w</p></blockquote>]  
  H w=<ul><li>Pw</li></ul><h2><a>Aw</a></h2><blockquote><p>Q1w</p></blockquote><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><h2><a>Aw</a></h2><blockquote><p>Q1w</p></blockquote><ul><li>Nw</li></ul>
- `AQ el1 Image` — D18: every command starts from the one caret  
  B w=[<a>Aw</a><img /><blockquote><p>Q1w</p></blockquote>] c=1 @element:listitem@2 t=[<a>Aw</a><img />k<blockquote><p>Q1w</p></blockquote>]  
  H w=[<a>Aw</a><img /><blockquote><p>Q1w</p></blockquote>] c=1 @element:quote@0 t=[<a>Aw</a><img /><blockquote><p>kQ1w</p></blockquote>]
- `AQ el1 Italic` — D18  
  B w=null c=0 @text:Aw@2 t=[<a>Aw</a><i><em>k</em></i><blockquote><p>Q1w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<a>Aw</a><i><em>k</em></i><blockquote><p>Q1w</p></blockquote>]
- `AQ el1 Link` — D18: every command starts from the one caret  
  B w=[<a>Aw</a><blockquote><p>Q1w</p></blockquote>] c=1 @text:Aw@2 t=[<a>Aw</a>k<blockquote><p>Q1w</p></blockquote>]  
  H w=[<a>Aw</a><blockquote><p><a>Q1w</a></p></blockquote>] c=1 @element:listitem@1 t=[<a>Aw</a>k<blockquote><p><a>Q1w</a></p></blockquote>]
- `AQ el1 Numbered list` — D18  
  B w=<ol><li>Pw</li><li><a>Aw</a><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ol> c=1 @text:Aw@2 t=<ol><li>Pw</li><li><a>Aw</a>k<blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li><a>Aw</a><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ol> c=1 @element:listitem@1 t=<ol><li>Pw</li><li><a>Aw</a>k<blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ol>
- `AQ el1 Paragraph` — D18  
  B w=null c=0 @text:Aw@2 t=[<a>Aw</a>k<blockquote><p>Q1w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<a>Aw</a>k<blockquote><p>Q1w</p></blockquote>]
- `AQ el1 Quote` — D13: Block type acts on the caret's line  
  B w=[<blockquote><a>Aw</a></blockquote><blockquote><p>Q1w</p></blockquote>] c=1 @text:Aw@2 t=[<blockquote><a>Aw</a>k</blockquote><blockquote><p>Q1w</p></blockquote>]  
  H w=<ul><li>Pw</li></ul><blockquote><a>Aw</a><blockquote><p>Q1w</p></blockquote></blockquote><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><blockquote><a>Aw</a><blockquote><p>Q1w</p></blockquote></blockquote><ul><li>Nw</li></ul>
- `AQ el1 Shift+Enter` — D18: every command starts from the one caret  
  B w=[<a>Aw</a><br /><blockquote><p>Q1w</p></blockquote>] c=1 @element:listitem@2 t=[<a>Aw</a><br />k<blockquote><p>Q1w</p></blockquote>]  
  H w=[<a>Aw</a><blockquote><p><br />Q1w</p></blockquote>] c=1 @text:Q1w@0 t=[<a>Aw</a><blockquote><p><br />kQ1w</p></blockquote>]
- `AQ el1 Shift+Tab` — D18  
  B w=null c=0 @text:Aw@2 t=  
  H w=null c=0 @element:listitem@1 t=
- `AQ el1 Strikethrough` — D18  
  B w=null c=0 @text:Aw@2 t=[<a>Aw</a><s>k</s><blockquote><p>Q1w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<a>Aw</a><s>k</s><blockquote><p>Q1w</p></blockquote>]
- `AQ el1 Tab` — D18  
  B w=null c=0 @text:Aw@2 t=  
  H w=null c=0 @element:listitem@1 t=
- `AQ el1 Underline` — D18  
  B w=null c=0 @text:Aw@2 t=[<a>Aw</a><u>k</u><blockquote><p>Q1w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<a>Aw</a><u>k</u><blockquote><p>Q1w</p></blockquote>]
- `AQ el1 cut` — 5.3 deletes  
  B w=null c=0 @text:Aw@2 t=[<a>Aw</a>k<blockquote><p>Q1w</p></blockquote>]  
  H w=null c=0 @text:Q1w@0 t=[<a>Aw</a><blockquote><p>kQ1w</p></blockquote>]
- `AQ el1 drop` — D18: every command starts from the one caret  
  B w=[<a>Aw</a>Dq<blockquote><p>Q1w</p></blockquote>] c=1 @text:Dq@2 t=[<a>Aw</a>Dqk<blockquote><p>Q1w</p></blockquote>]  
  H w=[<a>Aw</a><blockquote><p>DqQ1w</p></blockquote>] c=1 @text:DqQ1w@2 t=[<a>Aw</a><blockquote><p>DqkQ1w</p></blockquote>]
- `AQ el1 ime` — D18: every command starts from the one caret  
  B w=[<a>Awa</a><blockquote><p>Q1w</p></blockquote>] c=2 @text:Awa@3 t=[<a>Awa</a>k<blockquote><p>Q1w</p></blockquote>]  
  H w=[<a>Aw</a><blockquote><p>aQ1w</p></blockquote>] c=3 @text:aQ1w@1 t=[<a>Aw</a><blockquote><p>akQ1w</p></blockquote>]
- `AQ el1 lineBack` — 5.3 deletes  
  B w=[<blockquote><p>Q1w</p></blockquote>] c=1 @element:listitem@0 t=[k<blockquote><p>Q1w</p></blockquote>]  
  H w=[<blockquote><p>Q1w</p></blockquote>] c=1 @element:quote@0 t=[<blockquote><p>kQ1w</p></blockquote>]
- `AQ el1 lineForward` — 5.3 deletes  
  B w=null c=0 @element:listitem@1 t=[<a>Aw</a>k<blockquote><p>Q1w</p></blockquote>]  
  H w=null c=0 @text:Aw@2 t=[<a>Aw</a>k<blockquote><p>Q1w</p></blockquote>]
- `AQ el1 paste HTML` — D18: every command starts from the one caret  
  B w=[<a>Aw</a>Aq</li></ul><p>Bq</p><blockquote><p>Q1w</p></blockquote><ul><li>Nw</li></ul> c=1 @text:Bq@2 t=[<a>Aw</a>Aq</li></ul><p>Bqk</p><blockquote><p>Q1w</p></blockquote><ul><li>Nw</li></ul>  
  H w=[<a>Aw</a><blockquote><p>Aq</p><p>BqQ1w</p></blockquote>] c=1 @text:BqQ1w@2 t=[<a>Aw</a><blockquote><p>Aq</p><p>BqkQ1w</p></blockquote>]
- `AQ el1 paste own` — D18: every command starts from the one caret  
  B w=[<a>Aw</a>Aq</li></ul><p>Bq</p><blockquote><p>Q1w</p></blockquote><ul><li>Nw</li></ul> c=1 @text:Bq@2 t=[<a>Aw</a>Aq</li></ul><p>Bqk</p><blockquote><p>Q1w</p></blockquote><ul><li>Nw</li></ul>  
  H w=[<a>Aw</a><blockquote><p>Aq</p><p>BqQ1w</p></blockquote>] c=1 @text:BqQ1w@2 t=[<a>Aw</a><blockquote><p>Aq</p><p>BqkQ1w</p></blockquote>]
- `AQ el1 paste text` — D18: every command starts from the one caret  
  B w=[<a>Aw</a>Aq<blockquote><p>Q1w</p></blockquote>] c=1 @text:Aq@2 t=[<a>Aw</a>Aqk<blockquote><p>Q1w</p></blockquote>]  
  H w=[<a>Aw</a><blockquote><p>AqQ1w</p></blockquote>] c=1 @text:AqQ1w@2 t=[<a>Aw</a><blockquote><p>AqkQ1w</p></blockquote>]
- `AQ el1 placed` — D18  
  B text:Aw@2  
  H element:listitem@1
- `BQ el1 Backspace` — 5.3 deletes  
  B w=[<blockquote><p>Q1w</p></blockquote>] c=1 @element:listitem@0 t=[k<blockquote><p>Q1w</p></blockquote>]  
  H w=[<blockquote></blockquote>Q1w] c=1 @text:Q1w@0 t=[<blockquote></blockquote>kQ1w]
- `BQ el1 Code` — D13: Block type acts on the caret's line  
  B w=[<pre><code>
  </code></pre><blockquote><p>Q1w</p></blockquote>] c=1 @element:code@1 t=[<pre><code>
  k</code></pre><blockquote><p>Q1w</p></blockquote>]  
  H w=<ul><li>Pw</li></ul><pre><code>
  Q1w</code></pre><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><pre><code>
  Q1w</code></pre><ul><li>Nw</li></ul>
- `BQ el1 Ctrl+Backspace` — 5.3 deletes  
  B w=[<blockquote><p>Q1w</p></blockquote>] c=1 @element:listitem@0 t=[k<blockquote><p>Q1w</p></blockquote>]  
  H w=null c=0 @text:Q1w@0 t=[<br /><blockquote><p>kQ1w</p></blockquote>]
- `BQ el1 Ctrl+Delete` — 5.3 deletes  
  B w=[<br />Q1w] c=1 @text:Q1w@0 t=[<br />kQ1w]  
  H w=[<br /><blockquote></blockquote>] c=1 @element:paragraph@0 t=[<br /><blockquote><p>k</p></blockquote>]
- `BQ el1 Delete` — 5.3 deletes  
  B w=[<br />Q1w] c=1 @text:Q1w@0 t=[<br />kQ1w]  
  H w=[<br /><blockquote><p>1w</p></blockquote>] c=1 @text:1w@0 t=[<br /><blockquote><p>k1w</p></blockquote>]
- `BQ el1 Enter` — D18: every command starts from the one caret  
  B w=[<br /></li><li><blockquote><p>Q1w</p></blockquote>] c=1 @text:Q1w@0 t=[<br /></li><li><blockquote><p>kQ1w</p></blockquote>]  
  H w=[<br /><blockquote><p></p><p>Q1w</p></blockquote>] c=1 @text:Q1w@0 t=[<br /><blockquote><p></p><p>kQ1w</p></blockquote>]
- `BQ el1 Heading 2` — D13: Block type acts on the caret's line  
  B w=[<h2><br /></h2><blockquote><p>Q1w</p></blockquote>] c=1 @element:heading@1 t=[<h2><br />k</h2><blockquote><p>Q1w</p></blockquote>]  
  H w=<ul><li>Pw</li></ul><h2><br /></h2><blockquote><p>Q1w</p></blockquote><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><h2><br /></h2><blockquote><p>Q1w</p></blockquote><ul><li>Nw</li></ul>
- `BQ el1 Image` — D18: every command starts from the one caret  
  B w=[<br /><img /><blockquote><p>Q1w</p></blockquote>] c=1 @element:listitem@2 t=[<br /><img />k<blockquote><p>Q1w</p></blockquote>]  
  H w=[<br /><img /><blockquote><p>Q1w</p></blockquote>] c=1 @element:quote@0 t=[<br /><img /><blockquote><p>kQ1w</p></blockquote>]
- `BQ el1 Link` — D18: every command starts from the one caret  
  B w=[<br /><blockquote><p>Q1w</p></blockquote>] c=1 @element:listitem@1 t=[<br />k<blockquote><p>Q1w</p></blockquote>]  
  H w=[<br /><blockquote><p><a>Q1w</a></p></blockquote>] c=1 @element:listitem@1 t=[<br />k<blockquote><p><a>Q1w</a></p></blockquote>]
- `BQ el1 Quote` — D13: Block type acts on the caret's line  
  B w=[<blockquote><br /></blockquote><blockquote><p>Q1w</p></blockquote>] c=1 @element:quote@1 t=[<blockquote><br />k</blockquote><blockquote><p>Q1w</p></blockquote>]  
  H w=<ul><li>Pw</li></ul><blockquote><br /><blockquote><p>Q1w</p></blockquote></blockquote><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><blockquote><br /><blockquote><p>Q1w</p></blockquote></blockquote><ul><li>Nw</li></ul>
- `BQ el1 Shift+Enter` — D18: every command starts from the one caret  
  B w=[<br /><br /><blockquote><p>Q1w</p></blockquote>] c=1 @element:listitem@2 t=[<br /><br />k<blockquote><p>Q1w</p></blockquote>]  
  H w=[<br /><blockquote><p><br />Q1w</p></blockquote>] c=1 @text:Q1w@0 t=[<br /><blockquote><p><br />kQ1w</p></blockquote>]
- `BQ el1 cut` — 5.3 deletes  
  B w=null c=0 @element:listitem@1 t=[<br />k<blockquote><p>Q1w</p></blockquote>]  
  H w=null c=0 @text:Q1w@0 t=[<br /><blockquote><p>kQ1w</p></blockquote>]
- `BQ el1 drop` — D18: every command starts from the one caret  
  B w=[<br />Dq<blockquote><p>Q1w</p></blockquote>] c=1 @text:Dq@2 t=[<br />Dqk<blockquote><p>Q1w</p></blockquote>]  
  H w=[<br /><blockquote><p>DqQ1w</p></blockquote>] c=1 @text:DqQ1w@2 t=[<br /><blockquote><p>DqkQ1w</p></blockquote>]
- `BQ el1 ime` — D18: every command starts from the one caret  
  B w=[<br />a<blockquote><p>Q1w</p></blockquote>] c=1 @text:a@1 t=[<br />ak<blockquote><p>Q1w</p></blockquote>]  
  H w=[<br /><blockquote><p>aQ1w</p></blockquote>] c=3 @text:aQ1w@1 t=[<br /><blockquote><p>akQ1w</p></blockquote>]
- `BQ el1 lineBack` — 5.3 deletes  
  B w=[<blockquote><p>Q1w</p></blockquote>] c=1 @element:listitem@0 t=[k<blockquote><p>Q1w</p></blockquote>]  
  H w=[<blockquote></blockquote>Q1w] c=1 @text:Q1w@0 t=[<blockquote></blockquote>kQ1w]
- `BQ el1 lineForward` — 5.3 deletes  
  B w=null c=0 @element:listitem@1 t=[<br />k<blockquote><p>Q1w</p></blockquote>]  
  H w=[<br /><blockquote></blockquote>] c=1 @element:paragraph@0 t=[<br /><blockquote><p>k</p></blockquote>]
- `BQ el1 paste HTML` — D18: every command starts from the one caret  
  B w=[<br />Aq</li></ul><p>Bq</p><blockquote><p>Q1w</p></blockquote><ul><li>Nw</li></ul> c=1 @text:Bq@2 t=[<br />Aq</li></ul><p>Bqk</p><blockquote><p>Q1w</p></blockquote><ul><li>Nw</li></ul>  
  H w=[<br /><blockquote><p>Aq</p><p>BqQ1w</p></blockquote>] c=1 @text:BqQ1w@2 t=[<br /><blockquote><p>Aq</p><p>BqkQ1w</p></blockquote>]
- `BQ el1 paste own` — D18: every command starts from the one caret  
  B w=[<br />Aq</li></ul><p>Bq</p><blockquote><p>Q1w</p></blockquote><ul><li>Nw</li></ul> c=1 @text:Bq@2 t=[<br />Aq</li></ul><p>Bqk</p><blockquote><p>Q1w</p></blockquote><ul><li>Nw</li></ul>  
  H w=[<br /><blockquote><p>Aq</p><p>BqQ1w</p></blockquote>] c=1 @text:BqQ1w@2 t=[<br /><blockquote><p>Aq</p><p>BqkQ1w</p></blockquote>]
- `BQ el1 paste text` — D18: every command starts from the one caret  
  B w=[<br />Aq<blockquote><p>Q1w</p></blockquote>] c=1 @text:Aq@2 t=[<br />Aqk<blockquote><p>Q1w</p></blockquote>]  
  H w=[<br /><blockquote><p>AqQ1w</p></blockquote>] c=1 @text:AqQ1w@2 t=[<br /><blockquote><p>AqkQ1w</p></blockquote>]
- `QA el1 Backspace` — head flagged: D19  
  B w=[<blockquote><p>Q0w<a>Lw</a></p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk<a>Lw</a></p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote><a>Lw</a>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote><a>Lw</a>]
- `QA el1 Bold` — D18  
  B w=null c=0 @text:Lw@0 t=[<blockquote><p>Q0w</p></blockquote><b><strong>k</strong></b><a>Lw</a>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote><b><strong>k</strong></b><a>Lw</a>]
- `QA el1 Bulleted list` — D18: every command starts from the one caret  
  B w=<p>Pw</p><blockquote><p>Q0w</p></blockquote><p><a>Lw</a></p><p>Nw</p> c=1 @text:Lw@0 t=<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>k<a>Lw</a></p><p>Nw</p>  
  H w=<p>Pw</p><blockquote><p>Q0w</p></blockquote><p><a>Lw</a></p><p>Nw</p> c=1 @element:root@3 t=<p>Pw</p><blockquote><p>Q0w</p></blockquote><p><a>Lw</a></p><p>k</p><p>Nw</p>
- `QA el1 Code` — D13: Block type acts on the caret's line  
  B w=[<blockquote><p>Q0w</p></blockquote><pre><code>Lw</code></pre>] c=1 @text:Lw@0 t=[<blockquote><p>Q0w</p></blockquote><pre><code>kLw</code></pre>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote>k<a>Lw</a>]
- `QA el1 Ctrl+Backspace` — head flagged: D19  
  B w=[<blockquote><p>Q0w<a>Lw</a></p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk<a>Lw</a></p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote><a>Lw</a>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote><a>Lw</a>]
- `QA el1 Ctrl+Delete` — 5.3 deletes  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote>k]  
  H w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:quote@1 t=[<blockquote><p>Q0wk</p></blockquote>]
- `QA el1 Enter` — D18: every command starts from the one caret  
  B w=[<blockquote><p>Q0w</p></blockquote></li><li><a>Lw</a>] c=1 @text:Lw@0 t=[<blockquote><p>Q0w</p></blockquote></li><li>k<a>Lw</a>]  
  H w=[<blockquote><p>Q0w</p><p></p></blockquote><a>Lw</a>] c=1 @element:paragraph@0 t=[<blockquote><p>Q0w</p><p>k</p></blockquote><a>Lw</a>]
- `QA el1 Heading 2` — D13: Block type acts on the caret's line  
  B w=[<blockquote><p>Q0w</p></blockquote><h2><a>Lw</a></h2>] c=1 @text:Lw@0 t=[<blockquote><p>Q0w</p></blockquote><h2>k<a>Lw</a></h2>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote>k<a>Lw</a>]
- `QA el1 Italic` — D18  
  B w=null c=0 @text:Lw@0 t=[<blockquote><p>Q0w</p></blockquote><i><em>k</em></i><a>Lw</a>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote><i><em>k</em></i><a>Lw</a>]
- `QA el1 Link` — D18  
  B w=[<blockquote><p>Q0w</p></blockquote><a>Lw</a>] c=1 @text:Lw@0 t=[<blockquote><p>Q0w</p></blockquote>k<a>Lw</a>]  
  H w=[<blockquote><p>Q0w</p></blockquote><a>Lw</a>] c=1 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote>k<a>Lw</a>]
- `QA el1 Numbered list` — D18  
  B w=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><a>Lw</a></li><li>Nw</li></ol> c=1 @text:Lw@0 t=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k<a>Lw</a></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><a>Lw</a></li><li>Nw</li></ol> c=1 @element:listitem@1 t=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k<a>Lw</a></li><li>Nw</li></ol>
- `QA el1 Paragraph` — D18  
  B w=null c=0 @text:Lw@0 t=[<blockquote><p>Q0w</p></blockquote>k<a>Lw</a>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote>k<a>Lw</a>]
- `QA el1 Quote` — D13: Block type acts on the caret's line  
  B w=[<blockquote><p>Q0w</p></blockquote><blockquote><a>Lw</a></blockquote>] c=1 @text:Lw@0 t=[<blockquote><p>Q0w</p></blockquote><blockquote>k<a>Lw</a></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote>k<a>Lw</a>]
- `QA el1 Shift+Enter` — D18: every command starts from the one caret  
  B w=[<blockquote><p>Q0w</p></blockquote><br /><a>Lw</a>] c=1 @text:Lw@0 t=[<blockquote><p>Q0w</p></blockquote><br />k<a>Lw</a>]  
  H w=[<blockquote><p>Q0w<br /></p></blockquote><a>Lw</a>] c=1 @element:paragraph@2 t=[<blockquote><p>Q0w<br />k</p></blockquote><a>Lw</a>]
- `QA el1 Shift+Tab` — D18  
  B w=null c=0 @text:Lw@0 t=  
  H w=null c=0 @element:listitem@1 t=
- `QA el1 Strikethrough` — D18  
  B w=null c=0 @text:Lw@0 t=[<blockquote><p>Q0w</p></blockquote><s>k</s><a>Lw</a>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote><s>k</s><a>Lw</a>]
- `QA el1 Tab` — D18  
  B w=null c=0 @text:Lw@0 t=  
  H w=null c=0 @element:listitem@1 t=
- `QA el1 Underline` — D18  
  B w=null c=0 @text:Lw@0 t=[<blockquote><p>Q0w</p></blockquote><u>k</u><a>Lw</a>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote><u>k</u><a>Lw</a>]
- `QA el1 cut` — 5.3 deletes  
  B w=null c=0 @text:Lw@0 t=[<blockquote><p>Q0w</p></blockquote>k<a>Lw</a>]  
  H w=null c=0 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote><a>Lw</a>]
- `QA el1 drop` — D18: every command starts from the one caret  
  B w=[<blockquote><p>Q0w</p></blockquote>Dq<a>Lw</a>] c=1 @text:Dq@2 t=[<blockquote><p>Q0w</p></blockquote>Dqk<a>Lw</a>]  
  H w=[<blockquote><p>Q0wDq</p></blockquote><a>Lw</a>] c=1 @text:Q0wDq@5 t=[<blockquote><p>Q0wDqk</p></blockquote><a>Lw</a>]
- `QA el1 ime` — head flagged: console errors  
  B w=[<blockquote><p>Q0w</p></blockquote>a<a>Lw</a>] c=1 @text:a@1 t=[<blockquote><p>Q0w</p></blockquote>ak<a>Lw</a>]  
  H w=[<blockquote><p>Q0waa</p></blockquote><a>Lw</a>] c=3 @text:Q0waa@4|text:Q0waa@5 t=[<blockquote><p>Q0wak</p></blockquote><a>Lw</a>]
- `QA el1 lineBack` — head flagged: D19  
  B w=[<blockquote><p>Q0w<a>Lw</a></p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk<a>Lw</a></p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote><a>Lw</a>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote><a>Lw</a>]
- `QA el1 lineForward` — 5.3 deletes  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote>k]  
  H w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:quote@1 t=[<blockquote><p>Q0wk</p></blockquote>]
- `QA el1 paste HTML` — D18: every command starts from the one caret  
  B w=[<blockquote><p>Q0w</p></blockquote>Aq</li></ul><p>Bq<a>Lw</a></p><ul><li>Nw</li></ul> c=1 @text:Bq@2 t=[<blockquote><p>Q0w</p></blockquote>Aq</li></ul><p>Bqk<a>Lw</a></p><ul><li>Nw</li></ul>  
  H w=[<blockquote><p>Q0wAq</p><p>Bq</p></blockquote><a>Lw</a>] c=1 @text:Bq@2 t=[<blockquote><p>Q0wAq</p><p>Bqk</p></blockquote><a>Lw</a>]
- `QA el1 paste own` — D18: every command starts from the one caret  
  B w=[<blockquote><p>Q0w</p></blockquote>Aq</li></ul><p>Bq<a>Lw</a></p><ul><li>Nw</li></ul> c=1 @text:Bq@2 t=[<blockquote><p>Q0w</p></blockquote>Aq</li></ul><p>Bqk<a>Lw</a></p><ul><li>Nw</li></ul>  
  H w=[<blockquote><p>Q0wAq</p><p>Bq</p></blockquote><a>Lw</a>] c=1 @text:Bq@2 t=[<blockquote><p>Q0wAq</p><p>Bqk</p></blockquote><a>Lw</a>]
- `QA el1 paste text` — D18: every command starts from the one caret  
  B w=[<blockquote><p>Q0w</p></blockquote>Aq<a>Lw</a>] c=1 @text:Aq@2 t=[<blockquote><p>Q0w</p></blockquote>Aqk<a>Lw</a>]  
  H w=[<blockquote><p>Q0wAq</p></blockquote><a>Lw</a>] c=1 @text:Q0wAq@5 t=[<blockquote><p>Q0wAqk</p></blockquote><a>Lw</a>]
- `QA el1 placed` — D18  
  B text:Lw@0  
  H element:listitem@1
- `QB el1 Backspace` — 5.3 deletes  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote>]  
  H w=null c=0 @text:Q0w@0 t=[<blockquote><p>kQ0w</p></blockquote><br />]
- `QB el1 Bold` — D18: every command starts from the one caret  
  B w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote><b><strong>k</strong></b><br />]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w<b><strong>k</strong></b></p></blockquote><br />]
- `QB el1 Code` — D13: Block type acts on the caret's line  
  B w=[<blockquote><p>Q0w</p></blockquote><pre><code>
  </code></pre>] c=1 @element:code@0 t=[<blockquote><p>Q0w</p></blockquote><pre><code>k
  </code></pre>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote><br />]
- `QB el1 Ctrl+Backspace` — 5.3 deletes  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote>]  
  H w=null c=0 @text:Q0w@0 t=[<blockquote><p>kQ0w</p></blockquote><br />]
- `QB el1 Ctrl+Delete` — 5.3 deletes  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote>k]  
  H w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote>]
- `QB el1 Delete` — 5.3 deletes  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote>k]  
  H w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote>]
- `QB el1 Enter` — D18: every command starts from the one caret  
  B w=[<blockquote><p>Q0w</p></blockquote></li><li><br />] c=1 @element:listitem@0 t=[<blockquote><p>Q0w</p></blockquote></li><li>k<br />]  
  H w=[<blockquote><p>Q0w</p><p></p></blockquote><br />] c=1 @element:paragraph@0 t=[<blockquote><p>Q0w</p><p>k</p></blockquote><br />]
- `QB el1 Heading 2` — D13: Block type acts on the caret's line  
  B w=[<blockquote><p>Q0w</p></blockquote><h2><br /></h2>] c=1 @element:heading@0 t=[<blockquote><p>Q0w</p></blockquote><h2>k<br /></h2>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote><br />]
- `QB el1 Italic` — D18: every command starts from the one caret  
  B w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote><i><em>k</em></i><br />]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w<i><em>k</em></i></p></blockquote><br />]
- `QB el1 Numbered list` — D18: every command starts from the one caret  
  B w=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><br /></li><li>Nw</li></ol> c=1 @element:listitem@1 t=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k<br /></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><br /></li><li>Nw</li></ol> c=1 @element:listitem@1 t=<ol><li>Pw</li><li><blockquote><p>Q0wk</p></blockquote><br /></li><li>Nw</li></ol>
- `QB el1 Paragraph` — D13: Block type acts on the caret's line  
  B w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote>k<br />]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote><br />]
- `QB el1 Quote` — D13: Block type acts on the caret's line  
  B w=[<blockquote><p>Q0w</p></blockquote><blockquote><br /></blockquote>] c=1 @element:quote@0 t=[<blockquote><p>Q0w</p></blockquote><blockquote>k<br /></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote><br />]
- `QB el1 Shift+Enter` — D18: every command starts from the one caret  
  B w=[<blockquote><p>Q0w</p></blockquote><br /><br />] c=1 @element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><br />k<br />]  
  H w=[<blockquote><p>Q0w<br /></p></blockquote><br />] c=1 @element:paragraph@2 t=[<blockquote><p>Q0w<br />k</p></blockquote><br />]
- `QB el1 Strikethrough` — D18: every command starts from the one caret  
  B w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote><s>k</s><br />]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w<s>k</s></p></blockquote><br />]
- `QB el1 Underline` — D18: every command starts from the one caret  
  B w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote><u>k</u><br />]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w<u>k</u></p></blockquote><br />]
- `QB el1 cut` — 5.3 deletes  
  B w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote>k<br />]  
  H w=null c=0 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote><br />]
- `QB el1 drop` — D18: every command starts from the one caret  
  B w=[<blockquote><p>Q0w</p></blockquote>Dq<br />] c=1 @text:Dq@2 t=[<blockquote><p>Q0w</p></blockquote>Dqk<br />]  
  H w=[<blockquote><p>Q0wDq</p></blockquote><br />] c=1 @text:Q0wDq@5 t=[<blockquote><p>Q0wDqk</p></blockquote><br />]
- `QB el1 ime` — head flagged: console errors  
  B w=[<blockquote><p>Q0w</p></blockquote>a<br />] c=1 @text:a@1 t=[<blockquote><p>Q0w</p></blockquote>ak<br />]  
  H w=[<blockquote><p>Q0waa</p></blockquote><br />] c=3 @text:Q0waa@4|text:Q0waa@5 t=[<blockquote><p>Q0wak</p></blockquote><br />]
- `QB el1 letter` — head flagged: D18 step 1  
  B w=[<blockquote><p>Q0w</p></blockquote>k<br />] c=1 @text:k@1 t=[<blockquote><p>Q0w</p></blockquote>kk<br />]  
  H w=[<blockquote><p>Q0wk</p></blockquote><br />] c=1 @text:Q0wk@4 t=[<blockquote><p>Q0wkk</p></blockquote><br />]
- `QB el1 lineBack` — 5.3 deletes  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote><br />]
- `QB el1 lineForward` — 5.3 deletes  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote>k]  
  H w=null c=0 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote><br />]
- `QB el1 paste HTML` — D18: every command starts from the one caret  
  B w=[<blockquote><p>Q0w</p></blockquote>Aq</li></ul><p>Bq<br /></p><ul><li>Nw</li></ul> c=1 @text:Bq@2 t=[<blockquote><p>Q0w</p></blockquote>Aq</li></ul><p>Bqk<br /></p><ul><li>Nw</li></ul>  
  H w=[<blockquote><p>Q0wAq</p><p>Bq</p></blockquote><br />] c=1 @text:Bq@2 t=[<blockquote><p>Q0wAq</p><p>Bqk</p></blockquote><br />]
- `QB el1 paste own` — D18: every command starts from the one caret  
  B w=[<blockquote><p>Q0w</p></blockquote>Aq</li></ul><p>Bq<br /></p><ul><li>Nw</li></ul> c=1 @text:Bq@2 t=[<blockquote><p>Q0w</p></blockquote>Aq</li></ul><p>Bqk<br /></p><ul><li>Nw</li></ul>  
  H w=[<blockquote><p>Q0wAq</p><p>Bq</p></blockquote><br />] c=1 @text:Bq@2 t=[<blockquote><p>Q0wAq</p><p>Bqk</p></blockquote><br />]
- `QB el1 paste text` — D18: every command starts from the one caret  
  B w=[<blockquote><p>Q0w</p></blockquote>Aq<br />] c=1 @text:Aq@2 t=[<blockquote><p>Q0w</p></blockquote>Aqk<br />]  
  H w=[<blockquote><p>Q0wAq</p></blockquote><br />] c=1 @text:Q0wAq@5 t=[<blockquote><p>Q0wAqk</p></blockquote><br />]
- `QT@1 Backspace` — head flagged: D19  
  B w=[<blockquote><p>Q0wT1w</p></blockquote>] c=1 @text:Q0wT1w@3 t=[<blockquote><p>Q0wkT1w</p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote>T1w] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote>T1w]
- `QT@1 Code` — D13: Block type acts on the caret's line  
  B w=[<blockquote><p>Q0w</p></blockquote><pre><code>T1w</code></pre>] c=1 @text:T1w@0 t=[<blockquote><p>Q0w</p></blockquote><pre><code>kT1w</code></pre>]  
  H w=null c=0 @text:T1w@0 t=[<blockquote><p>Q0w</p></blockquote>kT1w]
- `QT@1 Ctrl+Backspace` — head flagged: D19  
  B w=[<blockquote><p>Q0wT1w</p></blockquote>] c=1 @text:Q0wT1w@3 t=[<blockquote><p>Q0wkT1w</p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote>T1w] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote>T1w]
- `QT@1 Ctrl+Delete` — UNEXPLAINED  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote>k]  
  H w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:quote@1 t=[<blockquote><p>Q0wk</p></blockquote>]
- `QT@1 Heading 2` — D13: Block type acts on the caret's line  
  B w=[<blockquote><p>Q0w</p></blockquote><h2>T1w</h2>] c=1 @text:T1w@0 t=[<blockquote><p>Q0w</p></blockquote><h2>kT1w</h2>]  
  H w=null c=0 @text:T1w@0 t=[<blockquote><p>Q0w</p></blockquote>kT1w]
- `QT@1 Quote` — D13: Block type acts on the caret's line  
  B w=[<blockquote><p>Q0w</p></blockquote><blockquote>T1w</blockquote>] c=1 @text:T1w@0 t=[<blockquote><p>Q0w</p></blockquote><blockquote>kT1w</blockquote>]  
  H w=null c=0 @text:T1w@0 t=[<blockquote><p>Q0w</p></blockquote>kT1w]
- `QT@1 ime` — D7  
  B w=[<blockquote><p>Q0w</p></blockquote>aT1w] c=2 @text:aT1w@1 t=[<blockquote><p>Q0w</p></blockquote>akT1w]  
  H w=[<blockquote><p>Q0w</p></blockquote>aT1w] c=3 @text:aT1w@1 t=[<blockquote><p>Q0w</p></blockquote>akT1w]
- `QT@1 lineBack` — head flagged: D19  
  B w=[<blockquote><p>Q0wT1w</p></blockquote>] c=1 @text:Q0wT1w@3 t=[<blockquote><p>Q0wkT1w</p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote>T1w] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote>T1w]
- `QT@1 lineForward` — UNEXPLAINED  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote>k]  
  H w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:quote@1 t=[<blockquote><p>Q0wk</p></blockquote>]
- `TC@1 Bold` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<b><strong>k</strong></b><pre><code>C1w</code></pre>]  
  H w=null c=0 @element:listitem@1 t=[T0w<b><strong>k</strong></b><pre><code>C1w</code></pre>]
- `TC@1 Code` — D13: Block type acts on the caret's line  
  B w=[<pre><code>T0w</code></pre><pre><code>C1w</code></pre>] c=1 @text:T0w@3 t=[<pre><code>T0wk</code></pre><pre><code>C1w</code></pre>]  
  H w=<ul><li>Pw</li></ul><pre><code>T0w
  C1w</code></pre><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><pre><code>T0w
  C1w</code></pre><ul><li>Nw</li></ul>
- `TC@1 Ctrl+Backspace` — 5.3 deletes  
  B w=[<pre><code>C1w</code></pre>] c=1 @element:listitem@0 t=[k<pre><code>C1w</code></pre>]  
  H w=[<pre><code>C1w</code></pre>] c=1 @text:C1w@0 t=[<pre><code>kC1w</code></pre>]
- `TC@1 Enter` — D18: every command starts from the one caret  
  B w=[T0w</li><li><pre><code>C1w</code></pre>] c=1 @text:C1w@0 t=[T0w</li><li><pre><code>kC1w</code></pre>]  
  H w=[T0w<pre><code>
  C1w</code></pre>] c=1 @text:C1w@0 t=[T0w<pre><code>
  kC1w</code></pre>]
- `TC@1 Heading 2` — D13: Block type acts on the caret's line  
  B w=[<h2>T0w</h2><pre><code>C1w</code></pre>] c=1 @text:T0w@3 t=[<h2>T0wk</h2><pre><code>C1w</code></pre>]  
  H w=<ul><li>Pw</li></ul><h2>T0w</h2><pre><code>C1w</code></pre><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><h2>T0w</h2><pre><code>C1w</code></pre><ul><li>Nw</li></ul>
- `TC@1 Image` — D18: every command starts from the one caret  
  B w=[T0w<img /><pre><code>C1w</code></pre>] c=1 @element:listitem@2 t=[T0w<img />k<pre><code>C1w</code></pre>]  
  H w=[T0w<img /><pre><code>C1w</code></pre>] c=1 @text:C1w@0 t=[T0w<img /><pre><code>kC1w</code></pre>]
- `TC@1 Italic` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<i><em>k</em></i><pre><code>C1w</code></pre>]  
  H w=null c=0 @element:listitem@1 t=[T0w<i><em>k</em></i><pre><code>C1w</code></pre>]
- `TC@1 Link` — head flagged: D19  
  B w=[<a>T0w</a><pre><code>C1w</code></pre>] c=1 @text:T0w@3 t=[<a>T0w</a>k<pre><code>C1w</code></pre>]  
  H w=[T0w<pre><code>C1w</code></pre>] c=1 @element:listitem@1 t=[T0wk<pre><code>C1w</code></pre>]
- `TC@1 Numbered list` — D18  
  B w=<ol><li>Pw</li><li>T0w<pre><code>C1w</code></pre></li><li>Nw</li></ol> c=1 @text:T0w@3 t=<ol><li>Pw</li><li>T0wk<pre><code>C1w</code></pre></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li>T0w<pre><code>C1w</code></pre></li><li>Nw</li></ol> c=1 @element:listitem@1 t=<ol><li>Pw</li><li>T0wk<pre><code>C1w</code></pre></li><li>Nw</li></ol>
- `TC@1 Paragraph` — D18  
  B w=null c=0 @text:T0w@3 t=[T0wk<pre><code>C1w</code></pre>]  
  H w=null c=0 @element:listitem@1 t=[T0wk<pre><code>C1w</code></pre>]
- `TC@1 Quote` — D13: Block type acts on the caret's line  
  B w=[<blockquote>T0w</blockquote><pre><code>C1w</code></pre>] c=1 @text:T0w@3 t=[<blockquote>T0wk</blockquote><pre><code>C1w</code></pre>]  
  H w=<ul><li>Pw</li></ul><blockquote>T0w<pre><code>C1w</code></pre></blockquote><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><blockquote>T0w<pre><code>C1w</code></pre></blockquote><ul><li>Nw</li></ul>
- `TC@1 Shift+Enter` — D18: every command starts from the one caret  
  B w=[T0w<br /><pre><code>C1w</code></pre>] c=1 @element:listitem@2 t=[T0w<br />k<pre><code>C1w</code></pre>]  
  H w=[T0w<pre><code>
  C1w</code></pre>] c=1 @text:C1w@0 t=[T0w<pre><code>
  kC1w</code></pre>]
- `TC@1 Shift+Tab` — D18  
  B w=null c=0 @text:T0w@3 t=  
  H w=null c=0 @element:listitem@1 t=
- `TC@1 Strikethrough` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<s>k</s><pre><code>C1w</code></pre>]  
  H w=null c=0 @element:listitem@1 t=[T0w<s>k</s><pre><code>C1w</code></pre>]
- `TC@1 Tab` — D18  
  B w=null c=0 @text:T0w@3 t=  
  H w=null c=0 @element:listitem@1 t=
- `TC@1 Underline` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<u>k</u><pre><code>C1w</code></pre>]  
  H w=null c=0 @element:listitem@1 t=[T0w<u>k</u><pre><code>C1w</code></pre>]
- `TC@1 cut` — 5.3 deletes  
  B w=null c=0 @text:T0w@3 t=[T0wk<pre><code>C1w</code></pre>]  
  H w=null c=0 @text:C1w@0 t=[T0w<pre><code>kC1w</code></pre>]
- `TC@1 drop` — D18: every command starts from the one caret  
  B w=[T0wDq<pre><code>C1w</code></pre>] c=1 @text:T0wDq@5 t=[T0wDqk<pre><code>C1w</code></pre>]  
  H w=[T0w<pre><code>DqC1w</code></pre>] c=1 @text:DqC1w@2 t=[T0w<pre><code>DqkC1w</code></pre>]
- `TC@1 ime` — D18: every command starts from the one caret  
  B w=[T0wa<pre><code>C1w</code></pre>] c=2 @text:T0wa@4 t=[T0wak<pre><code>C1w</code></pre>]  
  H w=[T0w<pre><code>aC1w</code></pre>] c=3 @text:aC1w@1 t=[T0w<pre><code>akC1w</code></pre>]
- `TC@1 lineBack` — 5.3 deletes  
  B w=[<pre><code>C1w</code></pre>] c=1 @element:listitem@0 t=[k<pre><code>C1w</code></pre>]  
  H w=[<pre><code>C1w</code></pre>] c=1 @text:C1w@0 t=[<pre><code>kC1w</code></pre>]
- `TC@1 paste HTML` — D18: every command starts from the one caret  
  B w=[T0wAq</li></ul><p>Bq</p><pre><code>C1w</code></pre><ul><li>Nw</li></ul> c=1 @text:Bq@2 t=[T0wAq</li></ul><p>Bqk</p><pre><code>C1w</code></pre><ul><li>Nw</li></ul>  
  H w=[T0w<pre><code>AqC1w</code></pre>] c=1 @text:AqC1w@2 t=[T0w<pre><code>AqkC1w</code></pre>]
- `TC@1 paste own` — D18: every command starts from the one caret  
  B w=[T0wAq</li></ul><p>Bq</p><pre><code>C1w</code></pre><ul><li>Nw</li></ul> c=1 @text:Bq@2 t=[T0wAq</li></ul><p>Bqk</p><pre><code>C1w</code></pre><ul><li>Nw</li></ul>  
  H w=[T0w<pre><code>Aq
  BqC1w</code></pre>] c=1 @text:BqC1w@2 t=[T0w<pre><code>Aq
  BqkC1w</code></pre>]
- `TC@1 paste text` — D18: every command starts from the one caret  
  B w=[T0wAq<pre><code>C1w</code></pre>] c=1 @text:T0wAq@5 t=[T0wAqk<pre><code>C1w</code></pre>]  
  H w=[T0w<pre><code>AqC1w</code></pre>] c=1 @text:AqC1w@2 t=[T0w<pre><code>AqkC1w</code></pre>]
- `TC@1 placed` — D18  
  B text:T0w@3  
  H element:listitem@1
- `TH@1 Bold` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<b><strong>k</strong></b><h3>H1w</h3>]  
  H w=null c=0 @element:listitem@1 t=[T0w<b><strong>k</strong></b><h3>H1w</h3>]
- `TH@1 Code` — D13: Block type acts on the caret's line  
  B w=[<pre><code>T0w</code></pre><h3>H1w</h3>] c=1 @text:T0w@3 t=[<pre><code>T0wk</code></pre><h3>H1w</h3>]  
  H w=<ul><li>Pw</li></ul><pre><code>T0w
  H1w</code></pre><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><pre><code>T0w
  H1w</code></pre><ul><li>Nw</li></ul>
- `TH@1 Ctrl+Backspace` — 5.3 deletes  
  B w=[<h3>H1w</h3>] c=1 @element:listitem@0 t=[k<h3>H1w</h3>]  
  H w=[<h3>H1w</h3>] c=1 @text:H1w@0 t=[<h3>kH1w</h3>]
- `TH@1 Enter` — D18: every command starts from the one caret  
  B w=[T0w</li><li><h3>H1w</h3>] c=1 @text:H1w@0 t=[T0w</li><li><h3>kH1w</h3>]  
  H w=[T0w<p></p><h3>H1w</h3>] c=1 @text:H1w@0 t=[T0w<p></p><h3>kH1w</h3>]
- `TH@1 Heading 2` — D13: Block type acts on the caret's line  
  B w=[<h2>T0w</h2><h3>H1w</h3>] c=1 @text:T0w@3 t=[<h2>T0wk</h2><h3>H1w</h3>]  
  H w=<ul><li>Pw</li></ul><h2>T0w</h2><h3>H1w</h3><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><h2>T0w</h2><h3>H1w</h3><ul><li>Nw</li></ul>
- `TH@1 Image` — D18: every command starts from the one caret  
  B w=[T0w<img /><h3>H1w</h3>] c=1 @element:listitem@2 t=[T0w<img />k<h3>H1w</h3>]  
  H w=[T0w<img /><h3>H1w</h3>] c=1 @text:H1w@0 t=[T0w<img /><h3>kH1w</h3>]
- `TH@1 Italic` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<i><em>k</em></i><h3>H1w</h3>]  
  H w=null c=0 @element:listitem@1 t=[T0w<i><em>k</em></i><h3>H1w</h3>]
- `TH@1 Link` — D18: every command starts from the one caret  
  B w=[<a>T0w</a><h3>H1w</h3>] c=1 @text:T0w@3 t=[<a>T0w</a>k<h3>H1w</h3>]  
  H w=[T0w<h3><a>H1w</a></h3>] c=1 @element:listitem@1 t=[T0wk<h3><a>H1w</a></h3>]
- `TH@1 Numbered list` — D18  
  B w=<ol><li>Pw</li><li>T0w<h3>H1w</h3></li><li>Nw</li></ol> c=1 @text:T0w@3 t=<ol><li>Pw</li><li>T0wk<h3>H1w</h3></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li>T0w<h3>H1w</h3></li><li>Nw</li></ol> c=1 @element:listitem@1 t=<ol><li>Pw</li><li>T0wk<h3>H1w</h3></li><li>Nw</li></ol>
- `TH@1 Paragraph` — D18  
  B w=null c=0 @text:T0w@3 t=[T0wk<h3>H1w</h3>]  
  H w=null c=0 @element:listitem@1 t=[T0wk<h3>H1w</h3>]
- `TH@1 Quote` — D13: Block type acts on the caret's line  
  B w=[<blockquote>T0w</blockquote><h3>H1w</h3>] c=1 @text:T0w@3 t=[<blockquote>T0wk</blockquote><h3>H1w</h3>]  
  H w=<ul><li>Pw</li></ul><blockquote>T0w<h3>H1w</h3></blockquote><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><blockquote>T0w<h3>H1w</h3></blockquote><ul><li>Nw</li></ul>
- `TH@1 Shift+Enter` — D18: every command starts from the one caret  
  B w=[T0w<br /><h3>H1w</h3>] c=1 @element:listitem@2 t=[T0w<br />k<h3>H1w</h3>]  
  H w=[T0w<h3><br />H1w</h3>] c=1 @text:H1w@0 t=[T0w<h3><br />kH1w</h3>]
- `TH@1 Shift+Tab` — D18  
  B w=null c=0 @text:T0w@3 t=  
  H w=null c=0 @element:listitem@1 t=
- `TH@1 Strikethrough` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<s>k</s><h3>H1w</h3>]  
  H w=null c=0 @element:listitem@1 t=[T0w<s>k</s><h3>H1w</h3>]
- `TH@1 Tab` — D18  
  B w=null c=0 @text:T0w@3 t=  
  H w=null c=0 @element:listitem@1 t=
- `TH@1 Underline` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<u>k</u><h3>H1w</h3>]  
  H w=null c=0 @element:listitem@1 t=[T0w<u>k</u><h3>H1w</h3>]
- `TH@1 cut` — 5.3 deletes  
  B w=null c=0 @text:T0w@3 t=[T0wk<h3>H1w</h3>]  
  H w=null c=0 @text:H1w@0 t=[T0w<h3>kH1w</h3>]
- `TH@1 drop` — D18: every command starts from the one caret  
  B w=[T0wDq<h3>H1w</h3>] c=1 @text:T0wDq@5 t=[T0wDqk<h3>H1w</h3>]  
  H w=[T0w<p>Dq</p><h3>H1w</h3>] c=1 @text:H1w@0 t=[T0w<p>Dq</p><h3>kH1w</h3>]
- `TH@1 ime` — D18: every command starts from the one caret  
  B w=[T0wa<h3>H1w</h3>] c=2 @text:T0wa@4 t=[T0wak<h3>H1w</h3>]  
  H w=[T0w<h3>aH1w</h3>] c=3 @text:aH1w@1 t=[T0w<h3>akH1w</h3>]
- `TH@1 lineBack` — 5.3 deletes  
  B w=[<h3>H1w</h3>] c=1 @element:listitem@0 t=[k<h3>H1w</h3>]  
  H w=[<h3>H1w</h3>] c=1 @text:H1w@0 t=[<h3>kH1w</h3>]
- `TH@1 paste HTML` — D18: every command starts from the one caret  
  B w=[T0wAq</li></ul><p>Bq</p><h3>H1w</h3><ul><li>Nw</li></ul> c=1 @text:Bq@2 t=[T0wAq</li></ul><p>Bqk</p><h3>H1w</h3><ul><li>Nw</li></ul>  
  H w=[T0w<p>Aq</p><p>Bq</p><h3>H1w</h3>] c=1 @text:H1w@0 t=[T0w<p>Aq</p><p>Bq</p><h3>kH1w</h3>]
- `TH@1 paste own` — D18: every command starts from the one caret  
  B w=[T0wAq</li></ul><p>Bq</p><h3>H1w</h3><ul><li>Nw</li></ul> c=1 @text:Bq@2 t=[T0wAq</li></ul><p>Bqk</p><h3>H1w</h3><ul><li>Nw</li></ul>  
  H w=[T0w<p>Aq</p><p>Bq</p><h3>H1w</h3>] c=1 @text:H1w@0 t=[T0w<p>Aq</p><p>Bq</p><h3>kH1w</h3>]
- `TH@1 paste text` — D18: every command starts from the one caret  
  B w=[T0wAq<h3>H1w</h3>] c=1 @text:T0wAq@5 t=[T0wAqk<h3>H1w</h3>]  
  H w=[T0w<h3>AqH1w</h3>] c=1 @text:AqH1w@2 t=[T0w<h3>AqkH1w</h3>]
- `TH@1 placed` — D18  
  B text:T0w@3  
  H element:listitem@1
- `TQ@1 Bold` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<b><strong>k</strong></b><blockquote><p>Q1w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[T0w<b><strong>k</strong></b><blockquote><p>Q1w</p></blockquote>]
- `TQ@1 Code` — D13: Block type acts on the caret's line  
  B w=[<pre><code>T0w</code></pre><blockquote><p>Q1w</p></blockquote>] c=1 @text:T0w@3 t=[<pre><code>T0wk</code></pre><blockquote><p>Q1w</p></blockquote>]  
  H w=<ul><li>Pw</li></ul><pre><code>T0w
  Q1w</code></pre><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><pre><code>T0w
  Q1w</code></pre><ul><li>Nw</li></ul>
- `TQ@1 Ctrl+Backspace` — 5.3 deletes  
  B w=[<blockquote><p>Q1w</p></blockquote>] c=1 @element:listitem@0 t=[k<blockquote><p>Q1w</p></blockquote>]  
  H w=[<blockquote><p>Q1w</p></blockquote>] c=1 @element:quote@0 t=[<blockquote><p>kQ1w</p></blockquote>]
- `TQ@1 Ctrl+Delete` — 5.3 deletes  
  B w=[T0wQ1w] c=1 @text:T0wQ1w@3 t=[T0wkQ1w]  
  H w=[T0w<blockquote></blockquote>Q1w] c=1 @text:T0w@3 t=[T0wk<blockquote></blockquote>Q1w]
- `TQ@1 Delete` — 5.3 deletes  
  B w=[T0wQ1w] c=1 @text:T0wQ1w@3 t=[T0wkQ1w]  
  H w=[T0w<blockquote></blockquote>Q1w] c=1 @text:T0w@3 t=[T0wk<blockquote></blockquote>Q1w]
- `TQ@1 Enter` — D18: every command starts from the one caret  
  B w=[T0w</li><li><blockquote><p>Q1w</p></blockquote>] c=1 @text:Q1w@0 t=[T0w</li><li><blockquote><p>kQ1w</p></blockquote>]  
  H w=[T0w<blockquote><p></p><p>Q1w</p></blockquote>] c=1 @text:Q1w@0 t=[T0w<blockquote><p></p><p>kQ1w</p></blockquote>]
- `TQ@1 Heading 2` — D13: Block type acts on the caret's line  
  B w=[<h2>T0w</h2><blockquote><p>Q1w</p></blockquote>] c=1 @text:T0w@3 t=[<h2>T0wk</h2><blockquote><p>Q1w</p></blockquote>]  
  H w=<ul><li>Pw</li></ul><h2>T0w</h2><blockquote><p>Q1w</p></blockquote><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><h2>T0w</h2><blockquote><p>Q1w</p></blockquote><ul><li>Nw</li></ul>
- `TQ@1 Image` — D18: every command starts from the one caret  
  B w=[T0w<img /><blockquote><p>Q1w</p></blockquote>] c=1 @element:listitem@2 t=[T0w<img />k<blockquote><p>Q1w</p></blockquote>]  
  H w=[T0w<img /><blockquote><p>Q1w</p></blockquote>] c=1 @element:quote@0 t=[T0w<img /><blockquote><p>kQ1w</p></blockquote>]
- `TQ@1 Italic` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<i><em>k</em></i><blockquote><p>Q1w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[T0w<i><em>k</em></i><blockquote><p>Q1w</p></blockquote>]
- `TQ@1 Link` — D18: every command starts from the one caret  
  B w=[<a>T0w</a><blockquote><p>Q1w</p></blockquote>] c=1 @text:T0w@3 t=[<a>T0w</a>k<blockquote><p>Q1w</p></blockquote>]  
  H w=[T0w<blockquote><p><a>Q1w</a></p></blockquote>] c=1 @element:listitem@1 t=[T0wk<blockquote><p><a>Q1w</a></p></blockquote>]
- `TQ@1 Numbered list` — D18  
  B w=<ol><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ol> c=1 @text:T0w@3 t=<ol><li>Pw</li><li>T0wk<blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ol> c=1 @element:listitem@1 t=<ol><li>Pw</li><li>T0wk<blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ol>
- `TQ@1 Paragraph` — D18  
  B w=null c=0 @text:T0w@3 t=[T0wk<blockquote><p>Q1w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[T0wk<blockquote><p>Q1w</p></blockquote>]
- `TQ@1 Quote` — D13: Block type acts on the caret's line  
  B w=[<blockquote>T0w</blockquote><blockquote><p>Q1w</p></blockquote>] c=1 @text:T0w@3 t=[<blockquote>T0wk</blockquote><blockquote><p>Q1w</p></blockquote>]  
  H w=<ul><li>Pw</li></ul><blockquote>T0w<blockquote><p>Q1w</p></blockquote></blockquote><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><blockquote>T0w<blockquote><p>Q1w</p></blockquote></blockquote><ul><li>Nw</li></ul>
- `TQ@1 Shift+Enter` — D18: every command starts from the one caret  
  B w=[T0w<br /><blockquote><p>Q1w</p></blockquote>] c=1 @element:listitem@2 t=[T0w<br />k<blockquote><p>Q1w</p></blockquote>]  
  H w=[T0w<blockquote><p><br />Q1w</p></blockquote>] c=1 @text:Q1w@0 t=[T0w<blockquote><p><br />kQ1w</p></blockquote>]
- `TQ@1 Shift+Tab` — D18  
  B w=null c=0 @text:T0w@3 t=  
  H w=null c=0 @element:listitem@1 t=
- `TQ@1 Strikethrough` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<s>k</s><blockquote><p>Q1w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[T0w<s>k</s><blockquote><p>Q1w</p></blockquote>]
- `TQ@1 Tab` — D18  
  B w=null c=0 @text:T0w@3 t=  
  H w=null c=0 @element:listitem@1 t=
- `TQ@1 Underline` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<u>k</u><blockquote><p>Q1w</p></blockquote>]  
  H w=null c=0 @element:listitem@1 t=[T0w<u>k</u><blockquote><p>Q1w</p></blockquote>]
- `TQ@1 cut` — 5.3 deletes  
  B w=null c=0 @text:T0w@3 t=[T0wk<blockquote><p>Q1w</p></blockquote>]  
  H w=null c=0 @text:Q1w@0 t=[T0w<blockquote><p>kQ1w</p></blockquote>]
- `TQ@1 drop` — D18: every command starts from the one caret  
  B w=[T0wDq<blockquote><p>Q1w</p></blockquote>] c=1 @text:T0wDq@5 t=[T0wDqk<blockquote><p>Q1w</p></blockquote>]  
  H w=[T0w<blockquote><p>DqQ1w</p></blockquote>] c=1 @text:DqQ1w@2 t=[T0w<blockquote><p>DqkQ1w</p></blockquote>]
- `TQ@1 ime` — D18: every command starts from the one caret  
  B w=[T0wa<blockquote><p>Q1w</p></blockquote>] c=2 @text:T0wa@4 t=[T0wak<blockquote><p>Q1w</p></blockquote>]  
  H w=[T0w<blockquote><p>aQ1w</p></blockquote>] c=3 @text:aQ1w@1 t=[T0w<blockquote><p>akQ1w</p></blockquote>]
- `TQ@1 lineBack` — 5.3 deletes  
  B w=[<blockquote><p>Q1w</p></blockquote>] c=1 @element:listitem@0 t=[k<blockquote><p>Q1w</p></blockquote>]  
  H w=[<blockquote><p>Q1w</p></blockquote>] c=1 @element:quote@0 t=[<blockquote><p>kQ1w</p></blockquote>]
- `TQ@1 paste HTML` — D18: every command starts from the one caret  
  B w=[T0wAq</li></ul><p>Bq</p><blockquote><p>Q1w</p></blockquote><ul><li>Nw</li></ul> c=1 @text:Bq@2 t=[T0wAq</li></ul><p>Bqk</p><blockquote><p>Q1w</p></blockquote><ul><li>Nw</li></ul>  
  H w=[T0w<blockquote><p>Aq</p><p>BqQ1w</p></blockquote>] c=1 @text:BqQ1w@2 t=[T0w<blockquote><p>Aq</p><p>BqkQ1w</p></blockquote>]
- `TQ@1 paste own` — D18: every command starts from the one caret  
  B w=[T0wAq</li></ul><p>Bq</p><blockquote><p>Q1w</p></blockquote><ul><li>Nw</li></ul> c=1 @text:Bq@2 t=[T0wAq</li></ul><p>Bqk</p><blockquote><p>Q1w</p></blockquote><ul><li>Nw</li></ul>  
  H w=[T0w<blockquote><p>Aq</p><p>BqQ1w</p></blockquote>] c=1 @text:BqQ1w@2 t=[T0w<blockquote><p>Aq</p><p>BqkQ1w</p></blockquote>]
- `TQ@1 paste text` — D18: every command starts from the one caret  
  B w=[T0wAq<blockquote><p>Q1w</p></blockquote>] c=1 @text:T0wAq@5 t=[T0wAqk<blockquote><p>Q1w</p></blockquote>]  
  H w=[T0w<blockquote><p>AqQ1w</p></blockquote>] c=1 @text:AqQ1w@2 t=[T0w<blockquote><p>AqkQ1w</p></blockquote>]
- `TQ@1 placed` — D18  
  B text:T0w@3  
  H element:listitem@1
- `TQT el1 Bold` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<b><strong>k</strong></b><blockquote><p>Q1w</p></blockquote>T2w]  
  H w=null c=0 @element:listitem@1 t=[T0w<b><strong>k</strong></b><blockquote><p>Q1w</p></blockquote>T2w]
- `TQT el1 Code` — D13: Block type acts on the caret's line  
  B w=[<pre><code>T0w</code></pre><blockquote><p>Q1w</p></blockquote>T2w] c=1 @text:T0w@3 t=[<pre><code>T0wk</code></pre><blockquote><p>Q1w</p></blockquote>T2w]  
  H w=<ul><li>Pw</li></ul><pre><code>T0w
  Q1w
  T2w</code></pre><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><pre><code>T0w
  Q1w
  T2w</code></pre><ul><li>Nw</li></ul>
- `TQT el1 Ctrl+Backspace` — 5.3 deletes  
  B w=[<blockquote><p>Q1w</p></blockquote>T2w] c=1 @element:listitem@0 t=[k<blockquote><p>Q1w</p></blockquote>T2w]  
  H w=[<blockquote><p>Q1w</p></blockquote>T2w] c=1 @element:quote@0 t=[<blockquote><p>kQ1w</p></blockquote>T2w]
- `TQT el1 Ctrl+Delete` — 5.3 deletes  
  B w=[T0wQ1w<br />T2w] c=1 @text:T0wQ1w@3 t=[T0wkQ1w<br />T2w]  
  H w=[T0w<blockquote></blockquote>T2wQ1w] c=1 @text:T0w@3 t=[T0wk<blockquote></blockquote>T2wQ1w]
- `TQT el1 Delete` — 5.3 deletes  
  B w=[T0wQ1w<br />T2w] c=1 @text:T0wQ1w@3 t=[T0wkQ1w<br />T2w]  
  H w=[T0w<blockquote></blockquote>T2wQ1w] c=1 @text:T0w@3 t=[T0wk<blockquote></blockquote>T2wQ1w]
- `TQT el1 Enter` — D18: every command starts from the one caret  
  B w=[T0w</li><li><blockquote><p>Q1w</p></blockquote>T2w] c=1 @text:Q1w@0 t=[T0w</li><li><blockquote><p>kQ1w</p></blockquote>T2w]  
  H w=[T0w<blockquote><p></p><p>Q1w</p></blockquote>T2w] c=1 @text:Q1w@0 t=[T0w<blockquote><p></p><p>kQ1w</p></blockquote>T2w]
- `TQT el1 Heading 2` — D13: Block type acts on the caret's line  
  B w=[<h2>T0w</h2><blockquote><p>Q1w</p></blockquote>T2w] c=1 @text:T0w@3 t=[<h2>T0wk</h2><blockquote><p>Q1w</p></blockquote>T2w]  
  H w=<ul><li>Pw</li></ul><h2>T0w</h2><blockquote><p>Q1w</p></blockquote><h2>T2w</h2><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><h2>T0w</h2><blockquote><p>Q1w</p></blockquote><h2>T2w</h2><ul><li>Nw</li></ul>
- `TQT el1 Image` — D18: every command starts from the one caret  
  B w=[T0w<img /><blockquote><p>Q1w</p></blockquote>T2w] c=1 @element:listitem@2 t=[T0w<img />k<blockquote><p>Q1w</p></blockquote>T2w]  
  H w=[T0w<img /><blockquote><p>Q1w</p></blockquote>T2w] c=1 @element:quote@0 t=[T0w<img /><blockquote><p>kQ1w</p></blockquote>T2w]
- `TQT el1 Italic` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<i><em>k</em></i><blockquote><p>Q1w</p></blockquote>T2w]  
  H w=null c=0 @element:listitem@1 t=[T0w<i><em>k</em></i><blockquote><p>Q1w</p></blockquote>T2w]
- `TQT el1 Link` — D18: every command starts from the one caret  
  B w=[<a>T0w</a><blockquote><p>Q1w</p></blockquote>T2w] c=1 @text:T0w@3 t=[<a>T0w</a>k<blockquote><p>Q1w</p></blockquote>T2w]  
  H w=[T0w<blockquote><p><a>Q1w</a></p></blockquote>T2w] c=1 @element:listitem@1 t=[T0wk<blockquote><p><a>Q1w</a></p></blockquote>T2w]
- `TQT el1 Numbered list` — D18  
  B w=<ol><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ol> c=1 @text:T0w@3 t=<ol><li>Pw</li><li>T0wk<blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ol> c=1 @element:listitem@1 t=<ol><li>Pw</li><li>T0wk<blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ol>
- `TQT el1 Paragraph` — D18  
  B w=null c=0 @text:T0w@3 t=[T0wk<blockquote><p>Q1w</p></blockquote>T2w]  
  H w=null c=0 @element:listitem@1 t=[T0wk<blockquote><p>Q1w</p></blockquote>T2w]
- `TQT el1 Quote` — D13: Block type acts on the caret's line  
  B w=[<blockquote>T0w</blockquote><blockquote><p>Q1w</p></blockquote>T2w] c=1 @text:T0w@3 t=[<blockquote>T0wk</blockquote><blockquote><p>Q1w</p></blockquote>T2w]  
  H w=<ul><li>Pw</li></ul><blockquote>T0w<blockquote><p>Q1w</p></blockquote>T2w</blockquote><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><blockquote>T0w<blockquote><p>Q1w</p></blockquote>T2w</blockquote><ul><li>Nw</li></ul>
- `TQT el1 Shift+Enter` — D18: every command starts from the one caret  
  B w=[T0w<br /><blockquote><p>Q1w</p></blockquote>T2w] c=1 @element:listitem@2 t=[T0w<br />k<blockquote><p>Q1w</p></blockquote>T2w]  
  H w=[T0w<blockquote><p><br />Q1w</p></blockquote>T2w] c=1 @text:Q1w@0 t=[T0w<blockquote><p><br />kQ1w</p></blockquote>T2w]
- `TQT el1 Shift+Tab` — D18  
  B w=null c=0 @text:T0w@3 t=  
  H w=null c=0 @element:listitem@1 t=
- `TQT el1 Strikethrough` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<s>k</s><blockquote><p>Q1w</p></blockquote>T2w]  
  H w=null c=0 @element:listitem@1 t=[T0w<s>k</s><blockquote><p>Q1w</p></blockquote>T2w]
- `TQT el1 Tab` — D18  
  B w=null c=0 @text:T0w@3 t=  
  H w=null c=0 @element:listitem@1 t=
- `TQT el1 Underline` — D18  
  B w=null c=0 @text:T0w@3 t=[T0w<u>k</u><blockquote><p>Q1w</p></blockquote>T2w]  
  H w=null c=0 @element:listitem@1 t=[T0w<u>k</u><blockquote><p>Q1w</p></blockquote>T2w]
- `TQT el1 cut` — 5.3 deletes  
  B w=null c=0 @text:T0w@3 t=[T0wk<blockquote><p>Q1w</p></blockquote>T2w]  
  H w=null c=0 @text:Q1w@0 t=[T0w<blockquote><p>kQ1w</p></blockquote>T2w]
- `TQT el1 drop` — D18: every command starts from the one caret  
  B w=[T0wDq<blockquote><p>Q1w</p></blockquote>T2w] c=1 @text:T0wDq@5 t=[T0wDqk<blockquote><p>Q1w</p></blockquote>T2w]  
  H w=[T0w<blockquote><p>DqQ1w</p></blockquote>T2w] c=1 @text:DqQ1w@2 t=[T0w<blockquote><p>DqkQ1w</p></blockquote>T2w]
- `TQT el1 ime` — D18: every command starts from the one caret  
  B w=[T0wa<blockquote><p>Q1w</p></blockquote>T2w] c=2 @text:T0wa@4 t=[T0wak<blockquote><p>Q1w</p></blockquote>T2w]  
  H w=[T0w<blockquote><p>aQ1w</p></blockquote>T2w] c=3 @text:aQ1w@1 t=[T0w<blockquote><p>akQ1w</p></blockquote>T2w]
- `TQT el1 lineBack` — 5.3 deletes  
  B w=[<blockquote><p>Q1w</p></blockquote>T2w] c=1 @element:listitem@0 t=[k<blockquote><p>Q1w</p></blockquote>T2w]  
  H w=[<blockquote><p>Q1w</p></blockquote>T2w] c=1 @element:quote@0 t=[<blockquote><p>kQ1w</p></blockquote>T2w]
- `TQT el1 paste HTML` — D18: every command starts from the one caret  
  B w=[T0wAq</li></ul><p>Bq</p><blockquote><p>Q1w</p></blockquote><p>T2w</p><ul><li>Nw</li></ul> c=1 @text:Bq@2 t=[T0wAq</li></ul><p>Bqk</p><blockquote><p>Q1w</p></blockquote><p>T2w</p><ul><li>Nw</li></ul>  
  H w=[T0w<blockquote><p>Aq</p><p>BqQ1w</p></blockquote>T2w] c=1 @text:BqQ1w@2 t=[T0w<blockquote><p>Aq</p><p>BqkQ1w</p></blockquote>T2w]
- `TQT el1 paste own` — D18: every command starts from the one caret  
  B w=[T0wAq</li></ul><p>Bq</p><blockquote><p>Q1w</p></blockquote><p>T2w</p><ul><li>Nw</li></ul> c=1 @text:Bq@2 t=[T0wAq</li></ul><p>Bqk</p><blockquote><p>Q1w</p></blockquote><p>T2w</p><ul><li>Nw</li></ul>  
  H w=[T0w<blockquote><p>Aq</p><p>BqQ1w</p></blockquote>T2w] c=1 @text:BqQ1w@2 t=[T0w<blockquote><p>Aq</p><p>BqkQ1w</p></blockquote>T2w]
- `TQT el1 paste text` — D18: every command starts from the one caret  
  B w=[T0wAq<blockquote><p>Q1w</p></blockquote>T2w] c=1 @text:T0wAq@5 t=[T0wAqk<blockquote><p>Q1w</p></blockquote>T2w]  
  H w=[T0w<blockquote><p>AqQ1w</p></blockquote>T2w] c=1 @text:AqQ1w@2 t=[T0w<blockquote><p>AqkQ1w</p></blockquote>T2w]
- `TQT el1 placed` — D18  
  B text:T0w@3  
  H element:listitem@1
- `TQT el2 Backspace` — head flagged: hang  
  B w=[T0w<blockquote><p>Q1wT2w</p></blockquote>] c=1 @text:Q1wT2w@3 t=[T0w<blockquote><p>Q1wkT2w</p></blockquote>]  
  H {"write": null, "calls": null, "caret": null, "typed": null}
- `TQT el2 Code` — D13: Block type acts on the caret's line  
  B w=[T0w<blockquote><p>Q1w</p></blockquote><pre><code>T2w</code></pre>] c=1 @text:T2w@0 t=[T0w<blockquote><p>Q1w</p></blockquote><pre><code>kT2w</code></pre>]  
  H w=<ul><li>Pw</li></ul><pre><code>T0w
  Q1w
  T2w</code></pre><ul><li>Nw</li></ul> c=1 @text:T2w@0 t=<ul><li>Pw</li></ul><pre><code>T0w
  Q1w
  kT2w</code></pre><ul><li>Nw</li></ul>
- `TQT el2 Ctrl+Backspace` — head flagged: hang  
  B w=[T0w<blockquote><p>Q1wT2w</p></blockquote>] c=1 @text:Q1wT2w@3 t=[T0w<blockquote><p>Q1wkT2w</p></blockquote>]  
  H {"write": null, "calls": null, "caret": null, "typed": null}
- `TQT el2 Ctrl+Delete` — UNEXPLAINED  
  B w=[T0w<blockquote><p>Q1w</p></blockquote>] c=1 @element:listitem@2 t=[T0w<blockquote><p>Q1w</p></blockquote>k]  
  H w=[T0w<blockquote><p>Q1w</p></blockquote>] c=1 @element:quote@1 t=[T0w<blockquote><p>Q1wk</p></blockquote>]
- `TQT el2 Heading 2` — D13: Block type acts on the caret's line  
  B w=[T0w<blockquote><p>Q1w</p></blockquote><h2>T2w</h2>] c=1 @text:T2w@0 t=[T0w<blockquote><p>Q1w</p></blockquote><h2>kT2w</h2>]  
  H w=<ul><li>Pw</li></ul><h2>T0w</h2><blockquote><p>Q1w</p></blockquote><h2>T2w</h2><ul><li>Nw</li></ul> c=1 @text:T2w@0 t=<ul><li>Pw</li></ul><h2>T0w</h2><blockquote><p>Q1w</p></blockquote><h2>kT2w</h2><ul><li>Nw</li></ul>
- `TQT el2 Quote` — D13: Block type acts on the caret's line  
  B w=[T0w<blockquote><p>Q1w</p></blockquote><blockquote>T2w</blockquote>] c=1 @text:T2w@0 t=[T0w<blockquote><p>Q1w</p></blockquote><blockquote>kT2w</blockquote>]  
  H w=<ul><li>Pw</li></ul><blockquote>T0w<blockquote><p>Q1w</p></blockquote>T2w</blockquote><ul><li>Nw</li></ul> c=1 @text:T2w@0 t=<ul><li>Pw</li></ul><blockquote>T0w<blockquote><p>Q1w</p></blockquote>kT2w</blockquote><ul><li>Nw</li></ul>
- `TQT el2 ime` — D7  
  B w=[T0w<blockquote><p>Q1w</p></blockquote>aT2w] c=2 @text:aT2w@1 t=[T0w<blockquote><p>Q1w</p></blockquote>akT2w]  
  H w=[T0w<blockquote><p>Q1w</p></blockquote>aT2w] c=3 @text:aT2w@1 t=[T0w<blockquote><p>Q1w</p></blockquote>akT2w]
- `TQT el2 lineBack` — head flagged: hang  
  B w=[T0w<blockquote><p>Q1wT2w</p></blockquote>] c=1 @text:Q1wT2w@3 t=[T0w<blockquote><p>Q1wkT2w</p></blockquote>]  
  H {"write": null, "calls": null, "caret": null, "typed": null}
- `TQT el2 lineForward` — UNEXPLAINED  
  B w=[T0w<blockquote><p>Q1w</p></blockquote>] c=1 @element:listitem@2 t=[T0w<blockquote><p>Q1w</p></blockquote>k]  
  H w=[T0w<blockquote><p>Q1w</p></blockquote>] c=1 @element:quote@1 t=[T0w<blockquote><p>Q1wk</p></blockquote>]
- `root el1 Bold` — D18  
  B w=null c=0 @text:X1w@3 t=<blockquote>X1w<b><strong>k</strong></b><p>X2w</p></blockquote>  
  H w=null c=0 @element:quote@1 t=<blockquote>X1w<b><strong>k</strong></b><p>X2w</p></blockquote>
- `root el1 Bulleted list` — D18: every command starts from the one caret  
  B w=<ul><li>X1w</li></ul><blockquote><p>X2w</p></blockquote> c=1 @text:X1w@3 t=<ul><li>X1wk</li></ul><blockquote><p>X2w</p></blockquote>  
  H w=<ul><li>X1w</li></ul><p>X2w</p> c=1 @text:X1w@3 t=<ul><li>X1wk</li></ul><p>X2w</p>
- `root el1 Code` — D13: Block type acts on the caret's line  
  B w=<blockquote><pre><code>X1w</code></pre><p>X2w</p></blockquote> c=1 @text:X1w@3 t=<blockquote><pre><code>X1wk</code></pre><p>X2w</p></blockquote>  
  H w=<pre><code>X1w
  X2w</code></pre> c=1 @text:X2w@1 t=<pre><code>X1w
  Xk2w</code></pre>
- `root el1 Ctrl+Backspace` — 5.3 deletes  
  B w=<blockquote><p>X2w</p></blockquote> c=1 @element:quote@0 t=<blockquote>k<p>X2w</p></blockquote>  
  H w=<blockquote><p>X2w</p></blockquote> c=1 @text:X2w@0 t=<blockquote><p>kX2w</p></blockquote>
- `root el1 Enter` — D18: every command starts from the one caret  
  B w=<blockquote>X1w<p></p><p>X2w</p></blockquote> c=1 @element:paragraph@0 t=<blockquote>X1w<p>k</p><p>X2w</p></blockquote>  
  H w=<blockquote>X1w<p></p><p>X2w</p></blockquote> c=1 @text:X2w@0 t=<blockquote>X1w<p></p><p>kX2w</p></blockquote>
- `root el1 Heading 2` — D13: Block type acts on the caret's line  
  B w=<blockquote><h2>X1w</h2><p>X2w</p></blockquote> c=1 @text:X1w@3 t=<blockquote><h2>X1wk</h2><p>X2w</p></blockquote>  
  H w=<h2>X1w</h2><p>X2w</p> c=1 @text:X2w@1 t=<h2>X1w</h2><p>Xk2w</p>
- `root el1 Image` — D18: every command starts from the one caret  
  B w=<blockquote>X1w<img /><p>X2w</p></blockquote> c=1 @element:quote@2 t=<blockquote>X1w<img />k<p>X2w</p></blockquote>  
  H w=<blockquote>X1w<img /><p>X2w</p></blockquote> c=1 @text:X2w@0 t=<blockquote>X1w<img /><p>kX2w</p></blockquote>
- `root el1 Italic` — D18  
  B w=null c=0 @text:X1w@3 t=<blockquote>X1w<i><em>k</em></i><p>X2w</p></blockquote>  
  H w=null c=0 @element:quote@1 t=<blockquote>X1w<i><em>k</em></i><p>X2w</p></blockquote>
- `root el1 Link` — D18: every command starts from the one caret  
  B w=<blockquote><a>X1w</a><p>X2w</p></blockquote> c=1 @text:X1w@3 t=<blockquote><a>X1w</a>k<p>X2w</p></blockquote>  
  H w=<blockquote>X1w<p><a>X2w</a></p></blockquote> c=1 @element:quote@1 t=<blockquote>X1wk<p><a>X2w</a></p></blockquote>
- `root el1 Numbered list` — D18: every command starts from the one caret  
  B w=<ol><li>X1w</li></ol><blockquote><p>X2w</p></blockquote> c=1 @text:X1w@3 t=<ol><li>X1wk</li></ol><blockquote><p>X2w</p></blockquote>  
  H w=<ol><li>X1w</li></ol><p>X2w</p> c=1 @text:X1w@3 t=<ol><li>X1wk</li></ol><p>X2w</p>
- `root el1 Paragraph` — D13: Block type acts on the caret's line  
  B w=<p>X1w</p><p>X2w</p> c=1 @text:X1w@3 t=<p>X1wk</p><p>X2w</p>  
  H w=<p>X1w</p><p>X2w</p> c=1 @text:X2w@1 t=<p>X1w</p><p>Xk2w</p>
- `root el1 Quote` — D18  
  B w=null c=0 @text:X1w@3 t=<blockquote>X1wk<p>X2w</p></blockquote>  
  H w=null c=0 @element:quote@1 t=<blockquote>X1wk<p>X2w</p></blockquote>
- `root el1 Shift+Enter` — D18: every command starts from the one caret  
  B w=<blockquote>X1w<br /><p>X2w</p></blockquote> c=1 @element:quote@2 t=<blockquote>X1w<br />k<p>X2w</p></blockquote>  
  H w=<blockquote>X1w<p><br />X2w</p></blockquote> c=1 @text:X2w@0 t=<blockquote>X1w<p><br />kX2w</p></blockquote>
- `root el1 Shift+Tab` — D18  
  B w=null c=0 @text:X1w@3 t=  
  H w=null c=0 @element:quote@1 t=
- `root el1 Strikethrough` — D18  
  B w=null c=0 @text:X1w@3 t=<blockquote>X1w<s>k</s><p>X2w</p></blockquote>  
  H w=null c=0 @element:quote@1 t=<blockquote>X1w<s>k</s><p>X2w</p></blockquote>
- `root el1 Tab` — D18  
  B w=null c=0 @text:X1w@3 t=  
  H w=null c=0 @element:quote@1 t=
- `root el1 Underline` — D18  
  B w=null c=0 @text:X1w@3 t=<blockquote>X1w<u>k</u><p>X2w</p></blockquote>  
  H w=null c=0 @element:quote@1 t=<blockquote>X1w<u>k</u><p>X2w</p></blockquote>
- `root el1 cut` — 5.3 deletes  
  B w=null c=0 @text:X1w@3 t=<blockquote>X1wk<p>X2w</p></blockquote>  
  H w=null c=0 @text:X2w@0 t=<blockquote>X1w<p>kX2w</p></blockquote>
- `root el1 drop` — D18: every command starts from the one caret  
  B w=<blockquote>X1wDq<p>X2w</p></blockquote> c=1 @text:X1wDq@5 t=<blockquote>X1wDqk<p>X2w</p></blockquote>  
  H w=<blockquote>X1w<p>DqX2w</p></blockquote> c=1 @text:DqX2w@2 t=<blockquote>X1w<p>DqkX2w</p></blockquote>
- `root el1 ime` — D18: every command starts from the one caret  
  B w=<blockquote>X1wa<p>X2w</p></blockquote> c=2 @text:X1wa@4 t=<blockquote>X1wak<p>X2w</p></blockquote>  
  H w=<blockquote>X1w<p>aX2w</p></blockquote> c=3 @text:aX2w@1 t=<blockquote>X1w<p>akX2w</p></blockquote>
- `root el1 lineBack` — 5.3 deletes  
  B w=<blockquote><p>X2w</p></blockquote> c=1 @element:quote@0 t=<blockquote>k<p>X2w</p></blockquote>  
  H w=<blockquote><p>X2w</p></blockquote> c=1 @text:X2w@0 t=<blockquote><p>kX2w</p></blockquote>
- `root el1 paste HTML` — D18: every command starts from the one caret  
  B w=<blockquote>X1wAq</blockquote><p>Bq</p><p>X2w</p> c=1 @text:Bq@2 t=<blockquote>X1wAq</blockquote><p>Bqk</p><p>X2w</p>  
  H w=<blockquote>X1w<p>Aq</p><p>BqX2w</p></blockquote> c=1 @text:BqX2w@2 t=<blockquote>X1w<p>Aq</p><p>BqkX2w</p></blockquote>
- `root el1 paste own` — D18: every command starts from the one caret  
  B w=<blockquote>X1wAq</blockquote><p>Bq</p><p>X2w</p> c=1 @text:Bq@2 t=<blockquote>X1wAq</blockquote><p>Bqk</p><p>X2w</p>  
  H w=<blockquote>X1w<p>Aq</p><p>BqX2w</p></blockquote> c=1 @text:BqX2w@2 t=<blockquote>X1w<p>Aq</p><p>BqkX2w</p></blockquote>
- `root el1 paste text` — D18: every command starts from the one caret  
  B w=<blockquote>X1wAq<p>X2w</p></blockquote> c=1 @text:X1wAq@5 t=<blockquote>X1wAqk<p>X2w</p></blockquote>  
  H w=<blockquote>X1w<p>AqX2w</p></blockquote> c=1 @text:AqX2w@2 t=<blockquote>X1w<p>AqkX2w</p></blockquote>
- `root el1 placed` — D18  
  B text:X1w@3  
  H element:quote@1

## node (104 differences)

- 72: section 9: K8, the letter after a node-selected rule lands after it (D15)
- 10: section 9: F2, a delete at a caret after an image ending its line (5.8)
- 8: FAILING: an onChange with the value unchanged (D7); the head makes none
- 5: D18
- 5: D13: Block type acts on the caret's line
- 4: D7

- `image in QI by code Backspace` — D18  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:quote@1 t=[<blockquote><p>Q0wk</p></blockquote>]
- `image in QI by code Ctrl+Backspace` — FAILING: an onChange with the value unchanged (D7); the head makes none  
  B w=[<blockquote><p>Q0w</p></blockquote><img />] c=1 @node:cms-image t=[<blockquote><p>Q0w</p></blockquote><img />k]  
  H w=null c=0 @node:cms-image t=[<blockquote><p>Q0w</p></blockquote><img />k]
- `image in QI by code Ctrl+Delete` — FAILING: an onChange with the value unchanged (D7); the head makes none  
  B w=[<blockquote><p>Q0w</p></blockquote><img />] c=1 @node:cms-image t=[<blockquote><p>Q0w</p></blockquote><img />k]  
  H w=null c=0 @node:cms-image t=[<blockquote><p>Q0w</p></blockquote><img />k]
- `image in QI by code Delete` — D18  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:quote@1 t=[<blockquote><p>Q0wk</p></blockquote>]
- `image in QI by code cut` — D18  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:quote@1 t=[<blockquote><p>Q0wk</p></blockquote>]
- `image in QI by code ime` — D7  
  B w=[<blockquote><p>Q0w</p></blockquote><img />a] c=1 @text:a@1 t=[<blockquote><p>Q0w</p></blockquote><img />ak]  
  H w=[<blockquote><p>Q0w</p></blockquote><img />a] c=3 @text:a@1 t=[<blockquote><p>Q0w</p></blockquote><img />ak]
- `image in QI by code lineBack` — D18  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote>]
- `image in QI by code lineForward` — D18  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @text:Q0w@3 t=[<blockquote><p>Q0wk</p></blockquote>]  
  H w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote>]
- `image in QI for real Backspace` — section 9: F2, a delete at a caret after an image ending its line (5.8)  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote>k]  
  H w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:listitem@1 t=[<blockquote><p>Q0wk</p></blockquote>]
- `image in QI for real Ctrl+Backspace` — section 9: F2, a delete at a caret after an image ending its line (5.8)  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote>k]  
  H w=[] c=1 @element:listitem@1|element:quote@0 t=[<blockquote>k</blockquote>]
- `image in QI for real Ctrl+Delete` — section 9: F2, a delete at a caret after an image ending its line (5.8)  
  B w=[<blockquote><p>Q0w</p></blockquote><img />Nw</li></ul> c=1 @text:Nw@0 t=[<blockquote><p>Q0w</p></blockquote><img />kNw</li></ul>  
  H w=[<blockquote><p>Q0w</p></blockquote>] c=1 @text:Nw@0 t=[<blockquote><p>Q0w</p></blockquote></li><li>kNw</li></ul>
- `image in QI for real Delete` — section 9: F2, a delete at a caret after an image ending its line (5.8)  
  B w=[<blockquote><p>Q0w</p></blockquote><img />Nw</li></ul> c=1 @text:Nw@0 t=[<blockquote><p>Q0w</p></blockquote><img />kNw</li></ul>  
  H w=[<blockquote><p>Q0w</p></blockquote>] c=1 @text:Nw@0 t=[<blockquote><p>Q0w</p></blockquote></li><li>kNw</li></ul>
- `image in QI for real Heading 2` — D13: Block type acts on the caret's line  
  B w=[<blockquote><p>Q0w</p></blockquote><h2><img /></h2>] c=1 @element:heading@1 t=[<blockquote><p>Q0w</p></blockquote><h2><img />k</h2>]  
  H w=null c=0 @element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><img />k]
- `image in QI for real Quote` — D13: Block type acts on the caret's line  
  B w=[<blockquote><p>Q0w</p></blockquote><blockquote><img /></blockquote>] c=1 @element:quote@1 t=[<blockquote><p>Q0w</p></blockquote><blockquote><img />k</blockquote>]  
  H w=null c=0 @element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><img />k]
- `image in QI for real ime` — D7  
  B w=[<blockquote><p>Q0w</p></blockquote><img />a] c=1 @text:a@1 t=[<blockquote><p>Q0w</p></blockquote><img />ak]  
  H w=[<blockquote><p>Q0w</p></blockquote><img />a] c=3 @text:a@1 t=[<blockquote><p>Q0w</p></blockquote><img />ak]
- `image in QI for real lineBack` — section 9: F2, a delete at a caret after an image ending its line (5.8)  
  B w=[<blockquote><p>Q0w</p></blockquote>] c=1 @element:listitem@1 t=[<blockquote><p>Q0w</p></blockquote>k]  
  H w=[] c=1 @element:quote@0 t=[<blockquote>k</blockquote>]
- `image in QI for real lineForward` — section 9: F2, a delete at a caret after an image ending its line (5.8)  
  B w=null c=0 @element:listitem@2 t=[<blockquote><p>Q0w</p></blockquote><img />k]  
  H w=[<blockquote><p>Q0w</p></blockquote><img /></li><li>w</li></ul> c=1 @text:w@0 t=[<blockquote><p>Q0w</p></blockquote><img /></li><li>kw</li></ul>
- `image in TQI by code Ctrl+Backspace` — FAILING: an onChange with the value unchanged (D7); the head makes none  
  B w=[T0w<blockquote><p>Q1w</p></blockquote>X2w<img />] c=1 @node:cms-image t=[T0w<blockquote><p>Q1w</p></blockquote>X2w<img />k]  
  H w=null c=0 @node:cms-image t=[T0w<blockquote><p>Q1w</p></blockquote>X2w<img />k]
- `image in TQI by code Ctrl+Delete` — FAILING: an onChange with the value unchanged (D7); the head makes none  
  B w=[T0w<blockquote><p>Q1w</p></blockquote>X2w<img />] c=1 @node:cms-image t=[T0w<blockquote><p>Q1w</p></blockquote>X2w<img />k]  
  H w=null c=0 @node:cms-image t=[T0w<blockquote><p>Q1w</p></blockquote>X2w<img />k]
- `image in TQI by code ime` — D7  
  B w=[T0w<blockquote><p>Q1w</p></blockquote>X2w<img />a] c=1 @text:a@1 t=[T0w<blockquote><p>Q1w</p></blockquote>X2w<img />ak]  
  H w=[T0w<blockquote><p>Q1w</p></blockquote>X2w<img />a] c=3 @text:a@1 t=[T0w<blockquote><p>Q1w</p></blockquote>X2w<img />ak]
- `image in TQI for real Code` — D13: Block type acts on the caret's line  
  B w=[T0w<blockquote><p>Q1w</p></blockquote><pre><code>X2w</code></pre><img />] c=1 @text:X2w@3 t=[T0w<blockquote><p>Q1w</p></blockquote><pre><code>X2wk</code></pre><img />]  
  H w=<ul><li>Pw</li></ul><pre><code>T0w
  Q1w
  X2w</code></pre><p><img /></p><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><pre><code>T0w
  Q1w
  X2w</code></pre><p><img /></p><ul><li>Nw</li></ul>
- `image in TQI for real Ctrl+Delete` — section 9: F2, a delete at a caret after an image ending its line (5.8)  
  B w=[T0w<blockquote><p>Q1w</p></blockquote>X2w<img />Nw</li></ul> c=1 @text:Nw@0 t=[T0w<blockquote><p>Q1w</p></blockquote>X2w<img />kNw</li></ul>  
  H w=[T0w<blockquote><p>Q1w</p></blockquote>X2wNw</li></ul> c=1 @text:X2wNw@3 t=[T0w<blockquote><p>Q1w</p></blockquote>X2wkNw</li></ul>
- `image in TQI for real Delete` — section 9: F2, a delete at a caret after an image ending its line (5.8)  
  B w=[T0w<blockquote><p>Q1w</p></blockquote>X2w<img />Nw</li></ul> c=1 @text:Nw@0 t=[T0w<blockquote><p>Q1w</p></blockquote>X2w<img />kNw</li></ul>  
  H w=[T0w<blockquote><p>Q1w</p></blockquote>X2wNw</li></ul> c=1 @text:X2wNw@3 t=[T0w<blockquote><p>Q1w</p></blockquote>X2wkNw</li></ul>
- `image in TQI for real Heading 2` — D13: Block type acts on the caret's line  
  B w=[T0w<blockquote><p>Q1w</p></blockquote><h2>X2w<img /></h2>] c=1 @element:heading@2 t=[T0w<blockquote><p>Q1w</p></blockquote><h2>X2w<img />k</h2>]  
  H w=<ul><li>Pw</li></ul><h2>T0w</h2><blockquote><p>Q1w</p></blockquote><h2>X2w<img /></h2><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><h2>T0w</h2><blockquote><p>Q1w</p></blockquote><h2>X2w<img /></h2><ul><li>Nw</li></ul>
- `image in TQI for real Quote` — D13: Block type acts on the caret's line  
  B w=[T0w<blockquote><p>Q1w</p></blockquote><blockquote>X2w<img /></blockquote>] c=1 @element:quote@2 t=[T0w<blockquote><p>Q1w</p></blockquote><blockquote>X2w<img />k</blockquote>]  
  H w=<ul><li>Pw</li></ul><blockquote>T0w<blockquote><p>Q1w</p></blockquote>X2w<img /></blockquote><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><blockquote>T0w<blockquote><p>Q1w</p></blockquote>X2w<img /></blockquote><ul><li>Nw</li></ul>
- `image in TQI for real ime` — D7  
  B w=[T0w<blockquote><p>Q1w</p></blockquote>X2w<img />a] c=1 @text:a@1 t=[T0w<blockquote><p>Q1w</p></blockquote>X2w<img />ak]  
  H w=[T0w<blockquote><p>Q1w</p></blockquote>X2w<img />a] c=3 @text:a@1 t=[T0w<blockquote><p>Q1w</p></blockquote>X2w<img />ak]
- `image in TQI for real lineBack` — section 9: F2, a delete at a caret after an image ending its line (5.8)  
  B w=[T0w<blockquote><p>Q1w</p></blockquote>] c=1 @element:listitem@2 t=[T0w<blockquote><p>Q1w</p></blockquote>k]  
  H w=[T0w<blockquote><p>Q1w</p></blockquote>] c=1 @element:quote@1 t=[T0w<blockquote><p>Q1wk</p></blockquote>]
- `image in TQI for real lineForward` — section 9: F2, a delete at a caret after an image ending its line (5.8)  
  B w=null c=0 @element:listitem@4 t=[T0w<blockquote><p>Q1w</p></blockquote>X2w<img />k]  
  H w=[T0w<blockquote><p>Q1w</p></blockquote>X2w<img />w</li></ul> c=1 @text:w@0 t=[T0w<blockquote><p>Q1w</p></blockquote>X2w<img />kw</li></ul>
- `rule in TR by code Bold` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR by code Bulleted list` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR by code Ctrl+Backspace` — FAILING: an onChange with the value unchanged (D7); the head makes none  
  B w=[T0w<hr />] c=1 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR by code Ctrl+Delete` — FAILING: an onChange with the value unchanged (D7); the head makes none  
  B w=[T0w<hr />] c=1 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR by code Divider` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR by code Enter` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR by code Image` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=[T0w<hr />]<p><img /></p> c=1 @node:horizontalrule t=[T0w<hr />k]<p><img /></p>  
  H w=[T0w<hr />]<p><img /></p> c=1 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]<p><img /></p>
- `rule in TR by code Italic` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR by code Numbered list` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=<ol><li>Pw</li><li>T0w<hr /></li><li>Nw</li></ol> c=1 @node:horizontalrule t=<ol><li>Pw</li><li>T0w<hr />k</li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li>T0w<hr /></li><li>Nw</li></ol> c=1 @node:horizontalrule t=<ol><li>kPw</li><li>T0w<hr /></li><li>Nw</li></ol>
- `rule in TR by code Shift+Enter` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR by code Strikethrough` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR by code Underline` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR by code drop` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR by code ime` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=<ul><li>aPw</li><li>T0w<hr />] c=1 @node:horizontalrule t=<ul><li>aPw</li><li>T0w<hr />k]  
  H w=<ul><li>aPw</li><li>T0w<hr />] c=1 @node:horizontalrule t=<ul><li>akPw</li><li>T0w<hr />]
- `rule in TR by code letter` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=[T0w<hr />k] c=1 @text:k@1 t=[T0w<hr />kk]  
  H w=<ul><li>kPw</li><li>T0w<hr />] c=1 @node:horizontalrule t=<ul><li>kkPw</li><li>T0w<hr />]
- `rule in TR by code lineBack` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR by code lineForward` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR by code paste text` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=[T0wAq] c=1 @text:T0wAq@5 t=[T0wAqk]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR by code pasteFiles` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR for real Bold` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR for real Bulleted list` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR for real Ctrl+Backspace` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=[T0w<hr />] c=1 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR for real Ctrl+Delete` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=[T0w<hr />] c=1 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR for real Divider` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR for real Enter` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR for real Image` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=[T0w<hr />]<p><img /></p> c=1 @node:horizontalrule t=[T0w<hr />k]<p><img /></p>  
  H w=[T0w<hr />]<p><img /></p> c=1 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]<p><img /></p>
- `rule in TR for real Italic` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR for real Numbered list` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=<ol><li>Pw</li><li>T0w<hr /></li><li>Nw</li></ol> c=1 @node:horizontalrule t=<ol><li>Pw</li><li>T0w<hr />k</li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li>T0w<hr /></li><li>Nw</li></ol> c=1 @node:horizontalrule t=<ol><li>kPw</li><li>T0w<hr /></li><li>Nw</li></ol>
- `rule in TR for real Shift+Enter` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR for real Strikethrough` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR for real Underline` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR for real drop` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR for real ime` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=<ul><li>aPw</li><li>T0w<hr />] c=1 @node:horizontalrule t=<ul><li>aPw</li><li>T0w<hr />k]  
  H w=<ul><li>aPw</li><li>T0w<hr />] c=1 @node:horizontalrule t=<ul><li>akPw</li><li>T0w<hr />]
- `rule in TR for real letter` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=[T0w<hr />k] c=1 @text:k@1 t=[T0w<hr />kk]  
  H w=<ul><li>kPw</li><li>T0w<hr />] c=1 @node:horizontalrule t=<ul><li>kkPw</li><li>T0w<hr />]
- `rule in TR for real lineBack` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR for real lineForward` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR for real paste text` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=[T0wAq] c=1 @text:T0wAq@5 t=[T0wAqk]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TR for real pasteFiles` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />k]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />]
- `rule in TRT by code Bold` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT by code Bulleted list` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT by code Ctrl+Backspace` — FAILING: an onChange with the value unchanged (D7); the head makes none  
  B w=[T0w<hr />T2w] c=1 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT by code Ctrl+Delete` — FAILING: an onChange with the value unchanged (D7); the head makes none  
  B w=[T0w<hr />T2w] c=1 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT by code Divider` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT by code Enter` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT by code Image` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=[T0w<hr />T2w]<p><img /></p> c=1 @node:horizontalrule t=[T0w<hr />kT2w]<p><img /></p>  
  H w=[T0w<hr />T2w]<p><img /></p> c=1 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]<p><img /></p>
- `rule in TRT by code Italic` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT by code Numbered list` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=<ol><li>Pw</li><li>T0w<hr />T2w</li><li>Nw</li></ol> c=1 @node:horizontalrule t=<ol><li>Pw</li><li>T0w<hr />kT2w</li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li>T0w<hr />T2w</li><li>Nw</li></ol> c=1 @node:horizontalrule t=<ol><li>kPw</li><li>T0w<hr />T2w</li><li>Nw</li></ol>
- `rule in TRT by code Shift+Enter` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT by code Strikethrough` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT by code Underline` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT by code drop` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT by code ime` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=<ul><li>aPw</li><li>T0w<hr />T2w] c=1 @node:horizontalrule t=<ul><li>aPw</li><li>T0w<hr />kT2w]  
  H w=<ul><li>aPw</li><li>T0w<hr />T2w] c=1 @node:horizontalrule t=<ul><li>akPw</li><li>T0w<hr />T2w]
- `rule in TRT by code letter` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=[T0w<hr />kT2w] c=1 @text:kT2w@1 t=[T0w<hr />kkT2w]  
  H w=<ul><li>kPw</li><li>T0w<hr />T2w] c=1 @node:horizontalrule t=<ul><li>kkPw</li><li>T0w<hr />T2w]
- `rule in TRT by code lineBack` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT by code lineForward` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT by code paste text` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=[T0wAqT2w] c=1 @text:T0wAqT2w@5 t=[T0wAqkT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT by code pasteFiles` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT for real Bold` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT for real Bulleted list` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT for real Ctrl+Backspace` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=[T0w<hr />T2w] c=1 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT for real Ctrl+Delete` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=[T0w<hr />T2w] c=1 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT for real Divider` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT for real Enter` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT for real Image` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=[T0w<hr />T2w]<p><img /></p> c=1 @node:horizontalrule t=[T0w<hr />kT2w]<p><img /></p>  
  H w=[T0w<hr />T2w]<p><img /></p> c=1 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]<p><img /></p>
- `rule in TRT for real Italic` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT for real Numbered list` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=<ol><li>Pw</li><li>T0w<hr />T2w</li><li>Nw</li></ol> c=1 @node:horizontalrule t=<ol><li>Pw</li><li>T0w<hr />kT2w</li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li>T0w<hr />T2w</li><li>Nw</li></ol> c=1 @node:horizontalrule t=<ol><li>kPw</li><li>T0w<hr />T2w</li><li>Nw</li></ol>
- `rule in TRT for real Shift+Enter` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT for real Strikethrough` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT for real Underline` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT for real drop` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT for real ime` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=<ul><li>aPw</li><li>T0w<hr />T2w] c=1 @node:horizontalrule t=<ul><li>aPw</li><li>T0w<hr />kT2w]  
  H w=<ul><li>aPw</li><li>T0w<hr />T2w] c=1 @node:horizontalrule t=<ul><li>akPw</li><li>T0w<hr />T2w]
- `rule in TRT for real letter` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=[T0w<hr />kT2w] c=1 @text:kT2w@1 t=[T0w<hr />kkT2w]  
  H w=<ul><li>kPw</li><li>T0w<hr />T2w] c=1 @node:horizontalrule t=<ul><li>kkPw</li><li>T0w<hr />T2w]
- `rule in TRT for real lineBack` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT for real lineForward` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT for real paste text` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=[T0wAqT2w] c=1 @text:T0wAqT2w@5 t=[T0wAqkT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]
- `rule in TRT for real pasteFiles` — section 9: K8, the letter after a node-selected rule lands after it (D15)  
  B w=null c=0 @node:horizontalrule t=[T0w<hr />kT2w]  
  H w=null c=0 @node:horizontalrule t=<ul><li>kPw</li><li>T0w<hr />T2w]

## unreached (188 differences)

- 147: UNEXPLAINED (a mixed-container shape, the head's cell not flagged)
- 16: head flagged: not a fixed point
- 13: head flagged: undo does not restore
- 7: head flagged: short: D19
- 5: head flagged: undo does not restore; not a fixed point

- `AR Lw@1 Code` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<pre><code>Lw</code></pre><hr />] c=1 @text:Lw@1 t=[<pre><code>Lkw</code></pre><hr />]  
  H w=<ul><li>Pw</li></ul><pre><code>Lw</code></pre><hr /><ul><li>Nw</li></ul> c=1 @text:Lw@1 t=<ul><li>Pw</li></ul><pre><code>Lkw</code></pre><hr /><ul><li>Nw</li></ul>
- `AR Lw@1 Heading 2` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<h2><a>Lw</a></h2><hr />] c=1 @text:Lw@1 t=[<h2><a>Lkw</a></h2><hr />]  
  H w=<ul><li>Pw</li></ul><h2><a>Lw</a></h2><hr /><ul><li>Nw</li></ul> c=1 @text:Lw@1 t=<ul><li>Pw</li></ul><h2><a>Lkw</a></h2><hr /><ul><li>Nw</li></ul>
- `AR Lw@1 Heading 3` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<h3><a>Lw</a></h3><hr />] c=1 @text:Lw@1 t=[<h3><a>Lkw</a></h3><hr />]  
  H w=<ul><li>Pw</li></ul><h3><a>Lw</a></h3><hr /><ul><li>Nw</li></ul> c=1 @text:Lw@1 t=<ul><li>Pw</li></ul><h3><a>Lkw</a></h3><hr /><ul><li>Nw</li></ul>
- `AR Lw@1 Heading 4` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<h4><a>Lw</a></h4><hr />] c=1 @text:Lw@1 t=[<h4><a>Lkw</a></h4><hr />]  
  H w=<ul><li>Pw</li></ul><h4><a>Lw</a></h4><hr /><ul><li>Nw</li></ul> c=1 @text:Lw@1 t=<ul><li>Pw</li></ul><h4><a>Lkw</a></h4><hr /><ul><li>Nw</li></ul>
- `AR Lw@1 Quote` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<blockquote><a>Lw</a></blockquote><hr />] c=1 @text:Lw@1 t=[<blockquote><a>Lkw</a></blockquote><hr />]  
  H w=<ul><li>Pw</li></ul><blockquote><a>Lw</a><hr /></blockquote><ul><li>Nw</li></ul> c=1 @text:Lw@1 t=<ul><li>Pw</li></ul><blockquote><a>Lkw</a><hr /></blockquote><ul><li>Nw</li></ul>
- `AR Lw@1 ime` — head flagged: undo does not restore  
  B w=[<a>Law</a><hr />] c=2 @text:Law@2 t=[<a>Lakw</a><hr />]  
  H w=[<a>Law</a><hr />] c=3 @text:Law@2 t=[<a>Lakw</a><hr />]
- `AR el2 Code` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<a>Lw</a><hr /><pre><code></code></pre>] c=1 @element:code@0 t=[<a>Lw</a><hr /><pre><code>k</code></pre>]  
  H w=<ul><li>Pw</li></ul><pre><code>Lw</code></pre><hr /><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><pre><code>Lw</code></pre><hr /><ul><li>Nw</li></ul>
- `AR el2 Ctrl+Backspace` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<a>Lw</a>] c=1 @element:listitem@1 t=[<a>Lw</a>k]  
  H w=[] c=1 @element:listitem@0 t=[k]
- `AR el2 Ctrl+Delete` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<a>Lw</a><hr />Nw</li></ul> c=1 @text:Nw@0 t=[<a>Lw</a><hr />kNw</li></ul>  
  H w=[<a>Lw</a>Nw</li></ul> c=1 @text:Nw@0 t=[<a>Lw</a>kNw</li></ul>
- `AR el2 Delete` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<a>Lw</a><hr />Nw</li></ul> c=1 @text:Nw@0 t=[<a>Lw</a><hr />kNw</li></ul>  
  H w=[<a>Lw</a>] c=1 @element:listitem@1 t=[<a>Lw</a>k]
- `AR el2 Heading 2` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<a>Lw</a><hr /><h2></h2>] c=1 @element:heading@0 t=[<a>Lw</a><hr /><h2>k</h2>]  
  H w=<ul><li>Pw</li></ul><h2><a>Lw</a></h2><hr /><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><h2><a>Lw</a></h2><hr /><ul><li>Nw</li></ul>
- `AR el2 Heading 3` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<a>Lw</a><hr /><h3></h3>] c=1 @element:heading@0 t=[<a>Lw</a><hr /><h3>k</h3>]  
  H w=<ul><li>Pw</li></ul><h3><a>Lw</a></h3><hr /><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><h3><a>Lw</a></h3><hr /><ul><li>Nw</li></ul>
- `AR el2 Heading 4` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<a>Lw</a><hr /><h4></h4>] c=1 @element:heading@0 t=[<a>Lw</a><hr /><h4>k</h4>]  
  H w=<ul><li>Pw</li></ul><h4><a>Lw</a></h4><hr /><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><h4><a>Lw</a></h4><hr /><ul><li>Nw</li></ul>
- `AR el2 Link` — head flagged: undo does not restore; not a fixed point  
  B w=null c=0 @element:listitem@2 t=[<a>Lw</a><hr />k]  
  H w=[<a>Lw</a><a><hr /></a>] c=1 @element:listitem@3 t=[<a>Lw</a><a><hr /></a>]
- `AR el2 Quote` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<a>Lw</a><hr /><blockquote></blockquote>] c=1 @element:quote@0 t=[<a>Lw</a><hr /><blockquote>k</blockquote>]  
  H w=<ul><li>Pw</li></ul><blockquote><a>Lw</a><hr /></blockquote><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><blockquote><a>Lw</a><hr /></blockquote><ul><li>Nw</li></ul>
- `AR el2 ime` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<a>Lw</a><hr />a] c=1 @text:a@1 t=[<a>Lw</a><hr />ak]  
  H w=[<a>Lw</a><hr />a] c=3 @text:a@1 t=[<a>Lw</a><hr />ak]
- `AR el2 lineBack` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<a>Lw</a>] c=1 @element:listitem@1 t=[<a>Lw</a>k]  
  H w=[] c=1 @element:listitem@0 t=[k]
- `AR el2 lineForward` — head flagged: short: D19  
  B w=[<a>Lw</a><hr />Nw</li></ul> c=1 @text:Nw@0 t=[<a>Lw</a><hr />kNw</li></ul>  
  H w=[<a>Lw</a><hr />] c=1 @element:listitem@2 t=[<a>Lw</a><hr />k]
- `HQ in item H0w@1 ime` — head flagged: undo does not restore  
  B w=[<blockquote><h3>Ha0w</h3>X1w</blockquote>T2w] c=2 @text:Ha0w@2 t=[<blockquote><h3>Hak0w</h3>X1w</blockquote>T2w]  
  H w=[<blockquote><h3>Ha0w</h3>X1w</blockquote>T2w] c=3 @text:Ha0w@2 t=[<blockquote><h3>Hak0w</h3>X1w</blockquote>T2w]
- `HQ in item el1 Backspace` — head flagged: short: D19  
  B w=[<blockquote><h3>H0wX1w</h3></blockquote>T2w] c=1 @text:H0wX1w@3 t=[<blockquote><h3>H0wkX1w</h3></blockquote>T2w]  
  H w=[<blockquote><h3>H0w</h3>X1w</blockquote>T2w] c=1 @text:H0w@3 t=[<blockquote><h3>H0wk</h3>X1w</blockquote>T2w]
- `HQ in item el1 Code` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<blockquote><h3>H0w</h3><pre><code>X1w</code></pre></blockquote>T2w] c=1 @text:X1w@0 t=[<blockquote><h3>H0w</h3><pre><code>kX1w</code></pre></blockquote>T2w]  
  H w=null c=0 @text:X1w@0 t=[<blockquote><h3>H0w</h3>kX1w</blockquote>T2w]
- `HQ in item el1 Ctrl+Backspace` — head flagged: short: D19  
  B w=[<blockquote><h3>H0wX1w</h3></blockquote>T2w] c=1 @text:H0wX1w@3 t=[<blockquote><h3>H0wkX1w</h3></blockquote>T2w]  
  H w=[<blockquote><h3>H0w</h3>X1w</blockquote>T2w] c=1 @text:H0w@3 t=[<blockquote><h3>H0wk</h3>X1w</blockquote>T2w]
- `HQ in item el1 Ctrl+Delete` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<blockquote><h3>H0w</h3></blockquote>T2w] c=1 @element:quote@1 t=[<blockquote><h3>H0w</h3>k</blockquote>T2w]  
  H w=[<blockquote><h3>H0w</h3></blockquote>T2w] c=1 @text:H0w@3 t=[<blockquote><h3>H0wk</h3></blockquote>T2w]
- `HQ in item el1 Enter` — head flagged: not a fixed point  
  B w=[<blockquote><h3>H0w</h3><br />X1w</blockquote>T2w] c=1 @text:X1w@0 t=[<blockquote><h3>H0w</h3><br />kX1w</blockquote>T2w]  
  H w=[<blockquote><h3>H0w</h3></blockquote><p>X1w</p>T2w] c=1 @text:X1w@0 t=[<blockquote><h3>H0w</h3></blockquote><p>kX1w</p>T2w]
- `HQ in item el1 Heading 2` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<blockquote><h3>H0w</h3><h2>X1w</h2></blockquote>T2w] c=1 @text:X1w@0 t=[<blockquote><h3>H0w</h3><h2>kX1w</h2></blockquote>T2w]  
  H w=null c=0 @text:X1w@0 t=[<blockquote><h3>H0w</h3>kX1w</blockquote>T2w]
- `HQ in item el1 Heading 3` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<blockquote><h3>H0w</h3><h3>X1w</h3></blockquote>T2w] c=1 @text:X1w@0 t=[<blockquote><h3>H0w</h3><h3>kX1w</h3></blockquote>T2w]  
  H w=null c=0 @text:X1w@0 t=[<blockquote><h3>H0w</h3>kX1w</blockquote>T2w]
- `HQ in item el1 Heading 4` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<blockquote><h3>H0w</h3><h4>X1w</h4></blockquote>T2w] c=1 @text:X1w@0 t=[<blockquote><h3>H0w</h3><h4>kX1w</h4></blockquote>T2w]  
  H w=null c=0 @text:X1w@0 t=[<blockquote><h3>H0w</h3>kX1w</blockquote>T2w]
- `HQ in item el1 Paragraph` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<blockquote><h3>H0w</h3>X1w</blockquote>T2w] c=1 @text:X1w@0 t=[<blockquote><h3>H0w</h3>kX1w</blockquote>T2w]  
  H w=null c=0 @text:X1w@0 t=[<blockquote><h3>H0w</h3>kX1w</blockquote>T2w]
- `HQ in item el1 ime` — head flagged: undo does not restore  
  B w=[<blockquote><h3>H0w</h3>aX1w</blockquote>T2w] c=2 @text:aX1w@1 t=[<blockquote><h3>H0w</h3>akX1w</blockquote>T2w]  
  H w=[<blockquote><h3>H0w</h3>aX1w</blockquote>T2w] c=3 @text:aX1w@1 t=[<blockquote><h3>H0w</h3>akX1w</blockquote>T2w]
- `HQ in item el1 lineBack` — head flagged: short: D19  
  B w=[<blockquote><h3>H0wX1w</h3></blockquote>T2w] c=1 @text:H0wX1w@3 t=[<blockquote><h3>H0wkX1w</h3></blockquote>T2w]  
  H w=[<blockquote><h3>H0w</h3>X1w</blockquote>T2w] c=1 @text:H0w@3 t=[<blockquote><h3>H0wk</h3>X1w</blockquote>T2w]
- `HQ in item el1 lineForward` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<blockquote><h3>H0w</h3></blockquote>T2w] c=1 @element:quote@1 t=[<blockquote><h3>H0w</h3>k</blockquote>T2w]  
  H w=[<blockquote><h3>H0w</h3></blockquote>T2w] c=1 @text:H0w@3 t=[<blockquote><h3>H0wk</h3></blockquote>T2w]
- `HQ in item el1 paste HTML` — head flagged: not a fixed point  
  B w=[<blockquote><h3>H0w</h3>Aq</blockquote>BqX1w<br />T2w] c=1 @text:BqX1w@2 t=[<blockquote><h3>H0w</h3>Aq</blockquote>BqkX1w<br />T2w]  
  H w=[<blockquote><h3>H0w</h3>Aq</blockquote><p>BqX1w</p>T2w] c=1 @text:BqX1w@2 t=[<blockquote><h3>H0w</h3>Aq</blockquote><p>BqkX1w</p>T2w]
- `HQ in item el1 paste own` — head flagged: not a fixed point  
  B w=[<blockquote><h3>H0w</h3>Aq</blockquote>BqX1w<br />T2w] c=1 @text:BqX1w@2 t=[<blockquote><h3>H0w</h3>Aq</blockquote>BqkX1w<br />T2w]  
  H w=[<blockquote><h3>H0w</h3>Aq</blockquote><p>BqX1w</p>T2w] c=1 @text:BqX1w@2 t=[<blockquote><h3>H0w</h3>Aq</blockquote><p>BqkX1w</p>T2w]
- `IR el1 Code` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @element:listitem@1 t=[<img />k<hr />]  
  H w=<ul><li>Pw</li></ul><pre><code></code></pre><p><img /></p><hr /><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><pre><code></code></pre><p><img /></p><hr /><ul><li>Nw</li></ul>
- `IR el1 Heading 2` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<h2><img /></h2><hr />] c=1 @element:heading@1 t=[<h2><img />k</h2><hr />]  
  H w=<ul><li>Pw</li></ul><h2><img /></h2><hr /><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><h2><img /></h2><hr /><ul><li>Nw</li></ul>
- `IR el1 Heading 3` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<h3><img /></h3><hr />] c=1 @element:heading@1 t=[<h3><img />k</h3><hr />]  
  H w=<ul><li>Pw</li></ul><h3><img /></h3><hr /><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><h3><img /></h3><hr /><ul><li>Nw</li></ul>
- `IR el1 Heading 4` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<h4><img /></h4><hr />] c=1 @element:heading@1 t=[<h4><img />k</h4><hr />]  
  H w=<ul><li>Pw</li></ul><h4><img /></h4><hr /><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><h4><img /></h4><hr /><ul><li>Nw</li></ul>
- `IR el1 Link` — head flagged: not a fixed point  
  B w=[<img /><hr />] c=1 @element:listitem@1 t=[<img />k<hr />]  
  H w=[<img /><a><hr /></a>] c=1 @element:listitem@2 t=[<img /><a><hr /></a>k]
- `IR el1 Quote` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<blockquote><img /></blockquote><hr />] c=1 @element:quote@1 t=[<blockquote><img />k</blockquote><hr />]  
  H w=<ul><li>Pw</li></ul><blockquote><img /><hr /></blockquote><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><blockquote><img /><hr /></blockquote><ul><li>Nw</li></ul>
- `IR el1 ime` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<img />a<hr />] c=1 @text:a@1 t=[<img />ak<hr />]  
  H w=[<img />a<hr />] c=3 @text:a@1 t=[<img />ak<hr />]
- `IR el1 lineForward` — head flagged: not a fixed point  
  B w=[<img />] c=1 @element:listitem@1 t=[<img />k]  
  H w=[<img /> ] c=1 @text: @1 t=[<img /> k]
- `IR el2 Code` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<img /><hr /><pre><code></code></pre>] c=1 @element:code@0 t=[<img /><hr /><pre><code>k</code></pre>]  
  H w=<ul><li>Pw</li></ul><pre><code></code></pre><p><img /></p><hr /><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><pre><code></code></pre><p><img /></p><hr /><ul><li>Nw</li></ul>
- `IR el2 Ctrl+Delete` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<img /><hr />Nw</li></ul> c=1 @text:Nw@0 t=[<img /><hr />kNw</li></ul>  
  H w=[<img />Nw</li></ul> c=1 @text:Nw@0 t=[<img />kNw</li></ul>
- `IR el2 Delete` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<img /><hr />Nw</li></ul> c=1 @text:Nw@0 t=[<img /><hr />kNw</li></ul>  
  H w=[<img />] c=1 @element:listitem@1 t=[<img />k]
- `IR el2 Heading 2` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<img /><hr /><h2></h2>] c=1 @element:heading@0 t=[<img /><hr /><h2>k</h2>]  
  H w=<ul><li>Pw</li></ul><h2><img /></h2><hr /><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><h2><img /></h2><hr /><ul><li>Nw</li></ul>
- `IR el2 Heading 3` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<img /><hr /><h3></h3>] c=1 @element:heading@0 t=[<img /><hr /><h3>k</h3>]  
  H w=<ul><li>Pw</li></ul><h3><img /></h3><hr /><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><h3><img /></h3><hr /><ul><li>Nw</li></ul>
- `IR el2 Heading 4` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<img /><hr /><h4></h4>] c=1 @element:heading@0 t=[<img /><hr /><h4>k</h4>]  
  H w=<ul><li>Pw</li></ul><h4><img /></h4><hr /><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><h4><img /></h4><hr /><ul><li>Nw</li></ul>
- `IR el2 Link` — head flagged: undo does not restore; not a fixed point  
  B w=null c=0 @element:listitem@2 t=[<img /><hr />k]  
  H w=[<img /><a><hr /></a>] c=1 @element:listitem@3 t=[<img /><a><hr /></a>]
- `IR el2 Quote` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<img /><hr /><blockquote></blockquote>] c=1 @element:quote@0 t=[<img /><hr /><blockquote>k</blockquote>]  
  H w=<ul><li>Pw</li></ul><blockquote><img /><hr /></blockquote><ul><li>Nw</li></ul> c=1 @text:Pw@2 t=<ul><li>Pwk</li></ul><blockquote><img /><hr /></blockquote><ul><li>Nw</li></ul>
- `IR el2 ime` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[<img /><hr />a] c=1 @text:a@1 t=[<img /><hr />ak]  
  H w=[<img /><hr />a] c=3 @text:a@1 t=[<img /><hr />ak]
- `IR el2 lineForward` — head flagged: short: D19  
  B w=[<img /><hr />Nw</li></ul> c=1 @text:Nw@0 t=[<img /><hr />kNw</li></ul>  
  H w=[<img /><hr />] c=1 @element:listitem@2 t=[<img /><hr />k]
- `TQT in item X1w@1 Code` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[T0w<blockquote><pre><code>X1w</code></pre><hr /></blockquote>T2w] c=1 @text:X1w@1 t=[T0w<blockquote><pre><code>Xk1w</code></pre><hr /></blockquote>T2w]  
  H w=[T0w<pre><code>X1w</code></pre><hr />T2w] c=1 @text:X1w@1 t=[T0w<pre><code>Xk1w</code></pre><hr />T2w]
- `TQT in item X1w@1 Enter` — head flagged: not a fixed point  
  B w=[T0w<blockquote>X<p>1w</p><hr /></blockquote>T2w] c=1 @text:1w@0 t=[T0w<blockquote>X<p>k1w</p><hr /></blockquote>T2w]  
  H w=[T0w<blockquote>X</blockquote><p>1w</p><hr />T2w] c=1 @text:1w@0 t=[T0w<blockquote>X</blockquote><p>k1w</p><hr />T2w]
- `TQT in item X1w@1 Heading 2` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[T0w<blockquote><h2>X1w</h2><hr /></blockquote>T2w] c=1 @text:X1w@1 t=[T0w<blockquote><h2>Xk1w</h2><hr /></blockquote>T2w]  
  H w=[T0w<h2>X1w</h2><hr />T2w] c=1 @text:X1w@1 t=[T0w<h2>Xk1w</h2><hr />T2w]
- `TQT in item X1w@1 Heading 3` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[T0w<blockquote><h3>X1w</h3><hr /></blockquote>T2w] c=1 @text:X1w@1 t=[T0w<blockquote><h3>Xk1w</h3><hr /></blockquote>T2w]  
  H w=[T0w<h3>X1w</h3><hr />T2w] c=1 @text:X1w@1 t=[T0w<h3>Xk1w</h3><hr />T2w]
- `TQT in item X1w@1 Heading 4` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[T0w<blockquote><h4>X1w</h4><hr /></blockquote>T2w] c=1 @text:X1w@1 t=[T0w<blockquote><h4>Xk1w</h4><hr /></blockquote>T2w]  
  H w=[T0w<h4>X1w</h4><hr />T2w] c=1 @text:X1w@1 t=[T0w<h4>Xk1w</h4><hr />T2w]
- `TQT in item X1w@1 Paragraph` — head flagged: not a fixed point  
  B w=[T0w<br />X1w<hr />T2w] c=1 @text:X1w@1 t=[T0w<br />Xk1w<hr />T2w]  
  H w=[T0w<p>X1w</p><hr />T2w] c=1 @text:X1w@1 t=[T0w<p>Xk1w</p><hr />T2w]
- `TQT in item X1w@1 ime` — head flagged: undo does not restore  
  B w=[T0w<blockquote>Xa1w<hr /></blockquote>T2w] c=2 @text:Xa1w@2 t=[T0w<blockquote>Xak1w<hr /></blockquote>T2w]  
  H w=[T0w<blockquote>Xa1w<hr /></blockquote>T2w] c=3 @text:Xa1w@2 t=[T0w<blockquote>Xak1w<hr /></blockquote>T2w]
- `TQT in item X1w@1 paste HTML` — head flagged: not a fixed point  
  B w=[T0w<blockquote>XAq</blockquote>Bq1w<hr />T2w] c=1 @text:Bq1w@2 t=[T0w<blockquote>XAq</blockquote>Bqk1w<hr />T2w]  
  H w=[T0w<blockquote>XAq</blockquote><p>Bq1w</p><hr />T2w] c=1 @text:Bq1w@2 t=[T0w<blockquote>XAq</blockquote><p>Bqk1w</p><hr />T2w]
- `TQT in item X1w@1 paste own` — head flagged: not a fixed point  
  B w=[T0w<blockquote>XAq</blockquote>Bq1w<hr />T2w] c=1 @text:Bq1w@2 t=[T0w<blockquote>XAq</blockquote>Bqk1w<hr />T2w]  
  H w=[T0w<blockquote>XAq</blockquote><p>Bq1w</p><hr />T2w] c=1 @text:Bq1w@2 t=[T0w<blockquote>XAq</blockquote><p>Bqk1w</p><hr />T2w]
- `TQT in item el1 Bold` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:X1w@3 t=[T0w<blockquote>X1w<b><strong>k</strong></b><hr /></blockquote>T2w]  
  H w=null c=0 @element:quote@1 t=[T0w<blockquote>X1w<b><strong>k</strong></b><hr /></blockquote>T2w]
- `TQT in item el1 Bulleted list` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<p>Pw</p><p>T0w</p><blockquote>X1w<hr /></blockquote><p>T2w</p><p>Nw</p> c=1 @text:X1w@3 t=<p>Pw</p><p>T0w</p><blockquote>X1wk<hr /></blockquote><p>T2w</p><p>Nw</p>  
  H w=<p>Pw</p><p>T0w</p><blockquote>X1w<hr /></blockquote><p>T2w</p><p>Nw</p> c=1 @element:quote@1 t=<p>Pw</p><p>T0w</p><blockquote>X1wk<hr /></blockquote><p>T2w</p><p>Nw</p>
- `TQT in item el1 Code` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[T0w<blockquote><pre><code>X1w</code></pre><hr /></blockquote>T2w] c=1 @text:X1w@3 t=[T0w<blockquote><pre><code>X1wk</code></pre><hr /></blockquote>T2w]  
  H w=[T0w<pre><code>X1w</code></pre><hr />T2w] c=1 @text:X1w@0 t=[T0w<pre><code>kX1w</code></pre><hr />T2w]
- `TQT in item el1 Enter` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[T0w<blockquote>X1w<p></p><hr /></blockquote>T2w] c=1 @element:paragraph@0 t=[T0w<blockquote>X1w<p>k</p><hr /></blockquote>T2w]  
  H w=[T0w<blockquote>X1w</blockquote><hr />T2w] c=1 @element:quote@1 t=[T0w<blockquote>X1wk</blockquote><hr />T2w]
- `TQT in item el1 Heading 2` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[T0w<blockquote><h2>X1w</h2><hr /></blockquote>T2w] c=1 @text:X1w@3 t=[T0w<blockquote><h2>X1wk</h2><hr /></blockquote>T2w]  
  H w=[T0w<h2>X1w</h2><hr />T2w] c=1 @text:X1w@3 t=[T0w<h2>X1wk</h2><hr />T2w]
- `TQT in item el1 Heading 3` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[T0w<blockquote><h3>X1w</h3><hr /></blockquote>T2w] c=1 @text:X1w@3 t=[T0w<blockquote><h3>X1wk</h3><hr /></blockquote>T2w]  
  H w=[T0w<h3>X1w</h3><hr />T2w] c=1 @text:X1w@3 t=[T0w<h3>X1wk</h3><hr />T2w]
- `TQT in item el1 Heading 4` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[T0w<blockquote><h4>X1w</h4><hr /></blockquote>T2w] c=1 @text:X1w@3 t=[T0w<blockquote><h4>X1wk</h4><hr /></blockquote>T2w]  
  H w=[T0w<h4>X1w</h4><hr />T2w] c=1 @text:X1w@3 t=[T0w<h4>X1wk</h4><hr />T2w]
- `TQT in item el1 Italic` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:X1w@3 t=[T0w<blockquote>X1w<i><em>k</em></i><hr /></blockquote>T2w]  
  H w=null c=0 @element:quote@1 t=[T0w<blockquote>X1w<i><em>k</em></i><hr /></blockquote>T2w]
- `TQT in item el1 Link` — head flagged: not a fixed point  
  B w=[T0w<blockquote><a>X1w</a><hr /></blockquote>T2w] c=1 @text:X1w@3 t=[T0w<blockquote><a>X1w</a>k<hr /></blockquote>T2w]  
  H w=[T0w<blockquote>X1w<a><hr /></a></blockquote>T2w] c=1 @element:quote@2 t=[T0w<blockquote>X1w<a><hr /></a>k</blockquote>T2w]
- `TQT in item el1 Numbered list` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ol><li>Pw</li><li>T0w<blockquote>X1w<hr /></blockquote>T2w</li><li>Nw</li></ol> c=1 @text:X1w@3 t=<ol><li>Pw</li><li>T0w<blockquote>X1wk<hr /></blockquote>T2w</li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li>T0w<blockquote>X1w<hr /></blockquote>T2w</li><li>Nw</li></ol> c=1 @element:quote@1 t=<ol><li>Pw</li><li>T0w<blockquote>X1wk<hr /></blockquote>T2w</li><li>Nw</li></ol>
- `TQT in item el1 Paragraph` — head flagged: not a fixed point  
  B w=[T0w<br />X1w<hr />T2w] c=1 @text:X1w@3 t=[T0w<br />X1wk<hr />T2w]  
  H w=[T0w<p>X1w</p><hr />T2w] c=1 @text:X1w@3 t=[T0w<p>X1wk</p><hr />T2w]
- `TQT in item el1 Quote` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:X1w@3 t=[T0w<blockquote>X1wk<hr /></blockquote>T2w]  
  H w=null c=0 @element:quote@1 t=[T0w<blockquote>X1wk<hr /></blockquote>T2w]
- `TQT in item el1 Shift+Tab` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:X1w@3 t=  
  H w=null c=0 @element:quote@1 t=
- `TQT in item el1 Strikethrough` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:X1w@3 t=[T0w<blockquote>X1w<s>k</s><hr /></blockquote>T2w]  
  H w=null c=0 @element:quote@1 t=[T0w<blockquote>X1w<s>k</s><hr /></blockquote>T2w]
- `TQT in item el1 Tab` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:X1w@3 t=  
  H w=null c=0 @element:quote@1 t=
- `TQT in item el1 Underline` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:X1w@3 t=[T0w<blockquote>X1w<u>k</u><hr /></blockquote>T2w]  
  H w=null c=0 @element:quote@1 t=[T0w<blockquote>X1w<u>k</u><hr /></blockquote>T2w]
- `TQT in item el1 cut` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:X1w@3 t=[T0w<blockquote>X1wk<hr /></blockquote>T2w]  
  H w=null c=0 @element:quote@1 t=[T0w<blockquote>X1wk<hr /></blockquote>T2w]
- `TQT in item el1 ime` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[T0w<blockquote>X1wa<hr /></blockquote>T2w] c=2 @text:X1wa@4 t=[T0w<blockquote>X1wak<hr /></blockquote>T2w]  
  H w=[T0w<blockquote>X1wa<hr /></blockquote>T2w] c=3 @text:X1wa@4 t=[T0w<blockquote>X1wak<hr /></blockquote>T2w]
- `TQT in item el1 lineBack` — head flagged: not a fixed point  
  B w=[T0w<blockquote><hr /></blockquote>T2w] c=1 @element:quote@0 t=[T0w<blockquote>k<hr /></blockquote>T2w]  
  H w=[T0w<blockquote> <hr /></blockquote>T2w] c=1 @text: @0 t=[T0w<blockquote>k <hr /></blockquote>T2w]
- `TQT in item el1 lineForward` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=[T0w<blockquote>X1w</blockquote>T2w] c=1 @text:X1w@3 t=[T0w<blockquote>X1wk</blockquote>T2w]  
  H w=[T0w<blockquote>X1w </blockquote>T2w] c=1 @text:X1w @4 t=[T0w<blockquote>X1w k</blockquote>T2w]
- `TQT in item el1 paste HTML` — head flagged: not a fixed point  
  B w=[T0w<blockquote>X1wAq</blockquote>Bq<hr />T2w] c=1 @text:Bq@2 t=[T0w<blockquote>X1wAq</blockquote>Bqk<hr />T2w]  
  H w=[T0w<blockquote>X1wAq</blockquote><p>Bq</p><hr />T2w] c=1 @text:Bq@2 t=[T0w<blockquote>X1wAq</blockquote><p>Bqk</p><hr />T2w]
- `TQT in item el1 paste own` — head flagged: not a fixed point  
  B w=[T0w<blockquote>X1wAq</blockquote>Bq<hr />T2w] c=1 @text:Bq@2 t=[T0w<blockquote>X1wAq</blockquote>Bqk<hr />T2w]  
  H w=[T0w<blockquote>X1wAq</blockquote><p>Bq</p><hr />T2w] c=1 @text:Bq@2 t=[T0w<blockquote>X1wAq</blockquote><p>Bqk</p><hr />T2w]
- `TRT in quote T1w@1 Code` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<blockquote>X0w<ul><li><pre><code>T1w</code></pre><hr />T2w</li></ul>X3w</blockquote> c=1 @text:T1w@1 t=<blockquote>X0w<ul><li><pre><code>Tk1w</code></pre><hr />T2w</li></ul>X3w</blockquote>  
  H w=<blockquote>X0w<pre><code>T1wT2w</code></pre><hr />X3w</blockquote> c=1 @text:T1wT2w@1 t=<blockquote>X0w<pre><code>Tk1wT2w</code></pre><hr />X3w</blockquote>
- `TRT in quote T1w@1 Heading 2` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<blockquote>X0w<ul><li><h2>T1w</h2><hr />T2w</li></ul>X3w</blockquote> c=1 @text:T1w@1 t=<blockquote>X0w<ul><li><h2>Tk1w</h2><hr />T2w</li></ul>X3w</blockquote>  
  H w=<blockquote>X0w<h2>T1w</h2><hr /><h2>T2w</h2>X3w</blockquote> c=1 @text:T1w@1 t=<blockquote>X0w<h2>Tk1w</h2><hr /><h2>T2w</h2>X3w</blockquote>
- `TRT in quote T1w@1 Heading 3` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<blockquote>X0w<ul><li><h3>T1w</h3><hr />T2w</li></ul>X3w</blockquote> c=1 @text:T1w@1 t=<blockquote>X0w<ul><li><h3>Tk1w</h3><hr />T2w</li></ul>X3w</blockquote>  
  H w=<blockquote>X0w<h3>T1w</h3><hr /><h3>T2w</h3>X3w</blockquote> c=1 @text:T1w@1 t=<blockquote>X0w<h3>Tk1w</h3><hr /><h3>T2w</h3>X3w</blockquote>
- `TRT in quote T1w@1 Heading 4` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<blockquote>X0w<ul><li><h4>T1w</h4><hr />T2w</li></ul>X3w</blockquote> c=1 @text:T1w@1 t=<blockquote>X0w<ul><li><h4>Tk1w</h4><hr />T2w</li></ul>X3w</blockquote>  
  H w=<blockquote>X0w<h4>T1w</h4><hr /><h4>T2w</h4>X3w</blockquote> c=1 @text:T1w@1 t=<blockquote>X0w<h4>Tk1w</h4><hr /><h4>T2w</h4>X3w</blockquote>
- `TRT in quote T1w@1 Paragraph` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:T1w@1 t=<blockquote>X0w<ul><li>Tk1w<hr />T2w</li></ul>X3w</blockquote>  
  H w=<blockquote>X0w<p>T1w</p><hr /><p>T2w</p>X3w</blockquote> c=1 @text:T1w@1 t=<blockquote>X0w<p>Tk1w</p><hr /><p>T2w</p>X3w</blockquote>
- `TRT in quote T1w@1 ime` — head flagged: undo does not restore  
  B w=<blockquote>X0w<ul><li>Ta1w<hr />T2w</li></ul>X3w</blockquote> c=2 @text:Ta1w@2 t=<blockquote>X0w<ul><li>Tak1w<hr />T2w</li></ul>X3w</blockquote>  
  H w=<blockquote>X0w<ul><li>Ta1w<hr />T2w</li></ul>X3w</blockquote> c=3 @text:Ta1w@2 t=<blockquote>X0w<ul><li>Tak1w<hr />T2w</li></ul>X3w</blockquote>
- `TRT in quote el1 Bold` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:T1w@3 t=<blockquote>X0w<ul><li>T1w<b><strong>k</strong></b><hr />T2w</li></ul>X3w</blockquote>  
  H w=null c=0 @element:listitem@1 t=<blockquote>X0w<ul><li>T1w<b><strong>k</strong></b><hr />T2w</li></ul>X3w</blockquote>
- `TRT in quote el1 Code` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<blockquote>X0w<ul><li><pre><code>T1w</code></pre><hr />T2w</li></ul>X3w</blockquote> c=1 @text:T1w@3 t=<blockquote>X0w<ul><li><pre><code>T1wk</code></pre><hr />T2w</li></ul>X3w</blockquote>  
  H w=<blockquote>X0w<pre><code>T1wT2w</code></pre><hr />X3w</blockquote> c=1 @text:T1wT2w@6 t=<blockquote>X0w<pre><code>T1wT2wk</code></pre><hr />X3w</blockquote>
- `TRT in quote el1 Heading 2` — head flagged: undo does not restore  
  B w=<blockquote>X0w<ul><li><h2>T1w</h2><hr />T2w</li></ul>X3w</blockquote> c=1 @text:T1w@3 t=<blockquote>X0w<ul><li><h2>T1wk</h2><hr />T2w</li></ul>X3w</blockquote>  
  H w=<blockquote>X0w<h2>T1w</h2><hr /><h2>T2w</h2>X3w</blockquote> c=1 @element:heading@3 t=<blockquote>X0w<h2>T1w</h2><hr /><h2>T2w</h2>X3w</blockquote>
- `TRT in quote el1 Heading 3` — head flagged: undo does not restore  
  B w=<blockquote>X0w<ul><li><h3>T1w</h3><hr />T2w</li></ul>X3w</blockquote> c=1 @text:T1w@3 t=<blockquote>X0w<ul><li><h3>T1wk</h3><hr />T2w</li></ul>X3w</blockquote>  
  H w=<blockquote>X0w<h3>T1w</h3><hr /><h3>T2w</h3>X3w</blockquote> c=1 @element:heading@3 t=<blockquote>X0w<h3>T1w</h3><hr /><h3>T2w</h3>X3w</blockquote>
- `TRT in quote el1 Heading 4` — head flagged: undo does not restore  
  B w=<blockquote>X0w<ul><li><h4>T1w</h4><hr />T2w</li></ul>X3w</blockquote> c=1 @text:T1w@3 t=<blockquote>X0w<ul><li><h4>T1wk</h4><hr />T2w</li></ul>X3w</blockquote>  
  H w=<blockquote>X0w<h4>T1w</h4><hr /><h4>T2w</h4>X3w</blockquote> c=1 @element:heading@3 t=<blockquote>X0w<h4>T1w</h4><hr /><h4>T2w</h4>X3w</blockquote>
- `TRT in quote el1 Italic` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:T1w@3 t=<blockquote>X0w<ul><li>T1w<i><em>k</em></i><hr />T2w</li></ul>X3w</blockquote>  
  H w=null c=0 @element:listitem@1 t=<blockquote>X0w<ul><li>T1w<i><em>k</em></i><hr />T2w</li></ul>X3w</blockquote>
- `TRT in quote el1 Link` — head flagged: not a fixed point  
  B w=<blockquote>X0w<ul><li><a>T1w</a><hr />T2w</li></ul>X3w</blockquote> c=1 @text:T1w@3 t=<blockquote>X0w<ul><li><a>T1w</a>k<hr />T2w</li></ul>X3w</blockquote>  
  H w=<blockquote>X0w<ul><li>T1w<a><hr /></a>T2w</li></ul>X3w</blockquote> c=1 @text:T2w@0 t=<blockquote>X0w<ul><li>T1w<a><hr /></a>kT2w</li></ul>X3w</blockquote>
- `TRT in quote el1 Numbered list` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<blockquote>X0w<ol><li>T1w<hr />T2w</li></ol>X3w</blockquote> c=1 @text:T1w@3 t=<blockquote>X0w<ol><li>T1wk<hr />T2w</li></ol>X3w</blockquote>  
  H w=<blockquote>X0w<ol><li>T1w<hr />T2w</li></ol>X3w</blockquote> c=1 @element:listitem@1 t=<blockquote>X0w<ol><li>T1wk<hr />T2w</li></ol>X3w</blockquote>
- `TRT in quote el1 Paragraph` — head flagged: undo does not restore  
  B w=null c=0 @text:T1w@3 t=<blockquote>X0w<ul><li>T1wk<hr />T2w</li></ul>X3w</blockquote>  
  H w=<blockquote>X0w<p>T1w</p><hr /><p>T2w</p>X3w</blockquote> c=1 @element:paragraph@3 t=<blockquote>X0w<p>T1w</p><hr /><p>T2w</p>X3w</blockquote>
- `TRT in quote el1 Quote` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:T1w@3 t=<blockquote>X0w<ul><li>T1wk<hr />T2w</li></ul>X3w</blockquote>  
  H w=null c=0 @element:listitem@1 t=<blockquote>X0w<ul><li>T1wk<hr />T2w</li></ul>X3w</blockquote>
- `TRT in quote el1 Shift+Tab` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:T1w@3 t=  
  H w=null c=0 @element:listitem@1 t=
- `TRT in quote el1 Strikethrough` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:T1w@3 t=<blockquote>X0w<ul><li>T1w<s>k</s><hr />T2w</li></ul>X3w</blockquote>  
  H w=null c=0 @element:listitem@1 t=<blockquote>X0w<ul><li>T1w<s>k</s><hr />T2w</li></ul>X3w</blockquote>
- `TRT in quote el1 Tab` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:T1w@3 t=  
  H w=null c=0 @element:listitem@1 t=
- `TRT in quote el1 Underline` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:T1w@3 t=<blockquote>X0w<ul><li>T1w<u>k</u><hr />T2w</li></ul>X3w</blockquote>  
  H w=null c=0 @element:listitem@1 t=<blockquote>X0w<ul><li>T1w<u>k</u><hr />T2w</li></ul>X3w</blockquote>
- `TRT in quote el1 cut` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:T1w@3 t=<blockquote>X0w<ul><li>T1wk<hr />T2w</li></ul>X3w</blockquote>  
  H w=null c=0 @element:listitem@1 t=<blockquote>X0w<ul><li>T1wk<hr />T2w</li></ul>X3w</blockquote>
- `TRT in quote el1 ime` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<blockquote>X0w<ul><li>T1wa<hr />T2w</li></ul>X3w</blockquote> c=2 @text:T1wa@4 t=<blockquote>X0w<ul><li>T1wak<hr />T2w</li></ul>X3w</blockquote>  
  H w=<blockquote>X0w<ul><li>T1wa<hr />T2w</li></ul>X3w</blockquote> c=3 @text:T1wa@4 t=<blockquote>X0w<ul><li>T1wak<hr />T2w</li></ul>X3w</blockquote>
- `TRT in quote el1 lineBack` — head flagged: not a fixed point  
  B w=<blockquote>X0w<ul><li><hr />T2w</li></ul>X3w</blockquote> c=1 @element:listitem@0 t=<blockquote>X0w<ul><li>k<hr />T2w</li></ul>X3w</blockquote>  
  H w=<blockquote>X0w<ul><li> <hr />T2w</li></ul>X3w</blockquote> c=1 @text: @0 t=<blockquote>X0w<ul><li>k <hr />T2w</li></ul>X3w</blockquote>
- `TRT in quote el1 lineForward` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<blockquote>X0w<ul><li>T1wT2w</li></ul>X3w</blockquote> c=1 @text:T1wT2w@3 t=<blockquote>X0w<ul><li>T1wkT2w</li></ul>X3w</blockquote>  
  H w=<blockquote>X0w<ul><li>T1w 2w</li></ul>X3w</blockquote> c=1 @text:T1w 2w@4 t=<blockquote>X0w<ul><li>T1w k2w</li></ul>X3w</blockquote>
- `d2 TR T0w@1 Code` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>Aw[<pre><code>T0w</code></pre><hr />]</li></ul> c=1 @text:T0w@1 t=<ul><li>Aw[<pre><code>Tk0w</code></pre><hr />]</li></ul>  
  H w=<ul><li>Aw<ul><li>Pw</li></ul></li></ul><pre><code>T0w</code></pre><hr /><ul><li><ul><li>Nw</li></ul></li></ul> c=1 @text:T0w@1 t=<ul><li>Aw<ul><li>Pw</li></ul></li></ul><pre><code>Tk0w</code></pre><hr /><ul><li><ul><li>Nw</li></ul></li></ul>
- `d2 TR T0w@1 Heading 2` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>Aw[<h2>T0w</h2><hr />]</li></ul> c=1 @text:T0w@1 t=<ul><li>Aw[<h2>Tk0w</h2><hr />]</li></ul>  
  H w=<ul><li>Aw<ul><li>Pw</li></ul></li></ul><h2>T0w</h2><hr /><ul><li><ul><li>Nw</li></ul></li></ul> c=1 @text:T0w@1 t=<ul><li>Aw<ul><li>Pw</li></ul></li></ul><h2>Tk0w</h2><hr /><ul><li><ul><li>Nw</li></ul></li></ul>
- `d2 TR T0w@1 Heading 3` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>Aw[<h3>T0w</h3><hr />]</li></ul> c=1 @text:T0w@1 t=<ul><li>Aw[<h3>Tk0w</h3><hr />]</li></ul>  
  H w=<ul><li>Aw<ul><li>Pw</li></ul></li></ul><h3>T0w</h3><hr /><ul><li><ul><li>Nw</li></ul></li></ul> c=1 @text:T0w@1 t=<ul><li>Aw<ul><li>Pw</li></ul></li></ul><h3>Tk0w</h3><hr /><ul><li><ul><li>Nw</li></ul></li></ul>
- `d2 TR T0w@1 Heading 4` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>Aw[<h4>T0w</h4><hr />]</li></ul> c=1 @text:T0w@1 t=<ul><li>Aw[<h4>Tk0w</h4><hr />]</li></ul>  
  H w=<ul><li>Aw<ul><li>Pw</li></ul></li></ul><h4>T0w</h4><hr /><ul><li><ul><li>Nw</li></ul></li></ul> c=1 @text:T0w@1 t=<ul><li>Aw<ul><li>Pw</li></ul></li></ul><h4>Tk0w</h4><hr /><ul><li><ul><li>Nw</li></ul></li></ul>
- `d2 TR T0w@1 Quote` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>Aw[<blockquote>T0w</blockquote><hr />]</li></ul> c=1 @text:T0w@1 t=<ul><li>Aw[<blockquote>Tk0w</blockquote><hr />]</li></ul>  
  H w=<ul><li>Aw<ul><li>Pw</li></ul></li></ul><blockquote>T0w<hr /></blockquote><ul><li><ul><li>Nw</li></ul></li></ul> c=1 @text:T0w@1 t=<ul><li>Aw<ul><li>Pw</li></ul></li></ul><blockquote>Tk0w<hr /></blockquote><ul><li><ul><li>Nw</li></ul></li></ul>
- `d2 TR T0w@1 ime` — head flagged: undo does not restore  
  B w=<ul><li>Aw[Ta0w<hr />]</li></ul> c=2 @text:Ta0w@2 t=<ul><li>Aw[Tak0w<hr />]</li></ul>  
  H w=<ul><li>Aw[Ta0w<hr />]</li></ul> c=3 @text:Ta0w@2 t=<ul><li>Aw[Tak0w<hr />]</li></ul>
- `d2 TR el2 Backspace` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>Aw<ul><li>Pw</li></ul></li><li>T0w<hr /><ul><li>Nw</li></ul></li></ul> c=1 @element:listitem@2 t=<ul><li>Aw<ul><li>Pw</li></ul></li><li>T0w<hr />k<ul><li>Nw</li></ul></li></ul>  
  H w=<ul><li>Aw[T0w]</li></ul> c=1 @text:T0w@3 t=<ul><li>Aw[T0wk]</li></ul>
- `d2 TR el2 Code` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>Aw[T0w<hr /><pre><code></code></pre>]</li></ul> c=1 @element:code@0 t=<ul><li>Aw[T0w<hr /><pre><code>k</code></pre>]</li></ul>  
  H w=<ul><li>Aw<ul><li>Pw</li></ul></li></ul><pre><code>T0w</code></pre><hr /><ul><li><ul><li>Nw</li></ul></li></ul> c=1 @text:Pw@2 t=<ul><li>Aw<ul><li>Pwk</li></ul></li></ul><pre><code>T0w</code></pre><hr /><ul><li><ul><li>Nw</li></ul></li></ul>
- `d2 TR el2 Ctrl+Delete` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>Aw[T0w<hr />Nw</li></ul></li></ul> c=1 @text:Nw@0 t=<ul><li>Aw[T0w<hr />kNw</li></ul></li></ul>  
  H w=<ul><li>Aw[T0wNw</li></ul></li></ul> c=1 @text:T0wNw@3 t=<ul><li>Aw[T0wkNw</li></ul></li></ul>
- `d2 TR el2 Delete` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>Aw[T0w<hr />Nw</li></ul></li></ul> c=1 @text:Nw@0 t=<ul><li>Aw[T0w<hr />kNw</li></ul></li></ul>  
  H w=<ul><li>Aw[T0w]</li></ul> c=1 @text:T0w@3 t=<ul><li>Aw[T0wk]</li></ul>
- `d2 TR el2 Heading 2` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>Aw[T0w<hr /><h2></h2>]</li></ul> c=1 @element:heading@0 t=<ul><li>Aw[T0w<hr /><h2>k</h2>]</li></ul>  
  H w=<ul><li>Aw<ul><li>Pw</li></ul></li></ul><h2>T0w</h2><hr /><ul><li><ul><li>Nw</li></ul></li></ul> c=1 @text:Pw@2 t=<ul><li>Aw<ul><li>Pwk</li></ul></li></ul><h2>T0w</h2><hr /><ul><li><ul><li>Nw</li></ul></li></ul>
- `d2 TR el2 Heading 3` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>Aw[T0w<hr /><h3></h3>]</li></ul> c=1 @element:heading@0 t=<ul><li>Aw[T0w<hr /><h3>k</h3>]</li></ul>  
  H w=<ul><li>Aw<ul><li>Pw</li></ul></li></ul><h3>T0w</h3><hr /><ul><li><ul><li>Nw</li></ul></li></ul> c=1 @text:Pw@2 t=<ul><li>Aw<ul><li>Pwk</li></ul></li></ul><h3>T0w</h3><hr /><ul><li><ul><li>Nw</li></ul></li></ul>
- `d2 TR el2 Heading 4` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>Aw[T0w<hr /><h4></h4>]</li></ul> c=1 @element:heading@0 t=<ul><li>Aw[T0w<hr /><h4>k</h4>]</li></ul>  
  H w=<ul><li>Aw<ul><li>Pw</li></ul></li></ul><h4>T0w</h4><hr /><ul><li><ul><li>Nw</li></ul></li></ul> c=1 @text:Pw@2 t=<ul><li>Aw<ul><li>Pwk</li></ul></li></ul><h4>T0w</h4><hr /><ul><li><ul><li>Nw</li></ul></li></ul>
- `d2 TR el2 Link` — head flagged: undo does not restore; not a fixed point  
  B w=null c=0 @element:listitem@2 t=<ul><li>Aw[T0w<hr />k]</li></ul>  
  H w=<ul><li>Aw[T0w<a><hr /></a>]</li></ul> c=1 @element:listitem@3 t=<ul><li>Aw[T0w<a><hr /></a>]</li></ul>
- `d2 TR el2 Quote` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>Aw[T0w<hr /><blockquote></blockquote>]</li></ul> c=1 @element:quote@0 t=<ul><li>Aw[T0w<hr /><blockquote>k</blockquote>]</li></ul>  
  H w=<ul><li>Aw<ul><li>Pw</li></ul></li></ul><blockquote>T0w<hr /></blockquote><ul><li><ul><li>Nw</li></ul></li></ul> c=1 @text:Pw@2 t=<ul><li>Aw<ul><li>Pwk</li></ul></li></ul><blockquote>T0w<hr /></blockquote><ul><li><ul><li>Nw</li></ul></li></ul>
- `d2 TR el2 ime` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>Aw[T0w<hr />a]</li></ul> c=1 @text:a@1 t=<ul><li>Aw[T0w<hr />ak]</li></ul>  
  H w=<ul><li>Aw[T0w<hr />a]</li></ul> c=3 @text:a@1 t=<ul><li>Aw[T0w<hr />ak]</li></ul>
- `d2 TR el2 lineForward` — head flagged: short: D19  
  B w=<ul><li>Aw[T0w<hr />Nw</li></ul></li></ul> c=1 @text:Nw@0 t=<ul><li>Aw[T0w<hr />kNw</li></ul></li></ul>  
  H w=<ul><li>Aw[T0w<hr />]</li></ul> c=1 @element:listitem@2 t=<ul><li>Aw[T0w<hr />k]</li></ul>
- `d6 TQT T0w@1 Code` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><pre><code>T0w</code></pre><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0w@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><pre><code>Tk0w</code></pre><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w</li></ul></li></ul></li></ul></li></ul></li></ul><pre><code>T0w
  Q1w
  T2w</code></pre> c=1 @text:T0w@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w</li></ul></li></ul></li></ul></li></ul></li></ul><pre><code>Tk0w
  Q1w
  T2w</code></pre>
- `d6 TQT T0w@1 Heading 2` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><h2>T0w</h2><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0w@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><h2>Tk0w</h2><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w</li></ul></li></ul></li></ul></li></ul></li></ul><h2>T0w</h2><blockquote><p>Q1w</p></blockquote><h2>T2w</h2> c=1 @text:T0w@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w</li></ul></li></ul></li></ul></li></ul></li></ul><h2>Tk0w</h2><blockquote><p>Q1w</p></blockquote><h2>T2w</h2>
- `d6 TQT T0w@1 Heading 3` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><h3>T0w</h3><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0w@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><h3>Tk0w</h3><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w</li></ul></li></ul></li></ul></li></ul></li></ul><h3>T0w</h3><blockquote><p>Q1w</p></blockquote><h3>T2w</h3> c=1 @text:T0w@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w</li></ul></li></ul></li></ul></li></ul></li></ul><h3>Tk0w</h3><blockquote><p>Q1w</p></blockquote><h3>T2w</h3>
- `d6 TQT T0w@1 Heading 4` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><h4>T0w</h4><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0w@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><h4>Tk0w</h4><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w</li></ul></li></ul></li></ul></li></ul></li></ul><h4>T0w</h4><blockquote><p>Q1w</p></blockquote><h4>T2w</h4> c=1 @text:T0w@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w</li></ul></li></ul></li></ul></li></ul></li></ul><h4>Tk0w</h4><blockquote><p>Q1w</p></blockquote><h4>T2w</h4>
- `d6 TQT T0w@1 Quote` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><blockquote>T0w</blockquote><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0w@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><blockquote>Tk0w</blockquote><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w</li></ul></li></ul></li></ul></li></ul></li></ul><blockquote>T0w<blockquote><p>Q1w</p></blockquote>T2w</blockquote> c=1 @text:T0w@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w</li></ul></li></ul></li></ul></li></ul></li></ul><blockquote>Tk0w<blockquote><p>Q1w</p></blockquote>T2w</blockquote>
- `d6 TQT T0w@1 ime` — head flagged: undo does not restore  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>Ta0w<blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=2 @text:Ta0w@2 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>Tak0w<blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>Ta0w<blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=3 @text:Ta0w@2 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>Tak0w<blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d6 TQT el1 Bold` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:T0w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<b><strong>k</strong></b><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=null c=0 @element:listitem@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<b><strong>k</strong></b><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d6 TQT el1 Code` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><pre><code>T0w</code></pre><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><pre><code>T0wk</code></pre><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w</li></ul></li></ul></li></ul></li></ul></li></ul><pre><code>T0w
  Q1w
  T2w</code></pre> c=1 @text:A5w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5wk</li></ul></li></ul></li></ul></li></ul></li></ul><pre><code>T0w
  Q1w
  T2w</code></pre>
- `d6 TQT el1 Ctrl+Backspace` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @element:listitem@0 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>k<blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @element:quote@0 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><blockquote><p>kQ1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d6 TQT el1 Ctrl+Delete` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wQ1w<br />T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0wQ1w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wkQ1w<br />T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<blockquote></blockquote>T2wQ1w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wk<blockquote></blockquote>T2wQ1w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d6 TQT el1 Delete` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wQ1w<br />T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0wQ1w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wkQ1w<br />T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<blockquote></blockquote>T2wQ1w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wk<blockquote></blockquote>T2wQ1w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d6 TQT el1 Enter` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w</li><li><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:Q1w@0 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w</li><li><blockquote><p>kQ1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<blockquote><p></p><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:Q1w@0 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<blockquote><p></p><p>kQ1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d6 TQT el1 Heading 2` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><h2>T0w</h2><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><h2>T0wk</h2><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w</li></ul></li></ul></li></ul></li></ul></li></ul><h2>T0w</h2><blockquote><p>Q1w</p></blockquote><h2>T2w</h2> c=1 @text:A5w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5wk</li></ul></li></ul></li></ul></li></ul></li></ul><h2>T0w</h2><blockquote><p>Q1w</p></blockquote><h2>T2w</h2>
- `d6 TQT el1 Heading 3` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><h3>T0w</h3><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><h3>T0wk</h3><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w</li></ul></li></ul></li></ul></li></ul></li></ul><h3>T0w</h3><blockquote><p>Q1w</p></blockquote><h3>T2w</h3> c=1 @text:A5w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5wk</li></ul></li></ul></li></ul></li></ul></li></ul><h3>T0w</h3><blockquote><p>Q1w</p></blockquote><h3>T2w</h3>
- `d6 TQT el1 Heading 4` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><h4>T0w</h4><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><h4>T0wk</h4><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w</li></ul></li></ul></li></ul></li></ul></li></ul><h4>T0w</h4><blockquote><p>Q1w</p></blockquote><h4>T2w</h4> c=1 @text:A5w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5wk</li></ul></li></ul></li></ul></li></ul></li></ul><h4>T0w</h4><blockquote><p>Q1w</p></blockquote><h4>T2w</h4>
- `d6 TQT el1 Image` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<img /><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @element:listitem@2 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<img />k<blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<img /><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @element:quote@0 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<img /><blockquote><p>kQ1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d6 TQT el1 Italic` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:T0w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<i><em>k</em></i><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=null c=0 @element:listitem@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<i><em>k</em></i><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d6 TQT el1 Link` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><a>T0w</a><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><a>T0w</a>k<blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<blockquote><p><a>Q1w</a></p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @element:listitem@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wk<blockquote><p><a>Q1w</a></p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d6 TQT el1 Numbered list` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ol><li>T0w<blockquote><p>Q1w</p></blockquote>T2w</li></ol></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ol><li>T0wk<blockquote><p>Q1w</p></blockquote>T2w</li></ol></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ol><li>T0w<blockquote><p>Q1w</p></blockquote>T2w</li></ol></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @element:listitem@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ol><li>T0wk<blockquote><p>Q1w</p></blockquote>T2w</li></ol></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d6 TQT el1 Paragraph` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:T0w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wk<blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=null c=0 @element:listitem@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wk<blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d6 TQT el1 Quote` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><blockquote>T0w</blockquote><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><blockquote>T0wk</blockquote><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w</li></ul></li></ul></li></ul></li></ul></li></ul><blockquote>T0w<blockquote><p>Q1w</p></blockquote>T2w</blockquote> c=1 @text:A5w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5wk</li></ul></li></ul></li></ul></li></ul></li></ul><blockquote>T0w<blockquote><p>Q1w</p></blockquote>T2w</blockquote>
- `d6 TQT el1 Shift+Enter` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<br /><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @element:listitem@2 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<br />k<blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<blockquote><p><br />Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:Q1w@0 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<blockquote><p><br />kQ1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d6 TQT el1 Shift+Tab` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:T0w@3 t=  
  H w=null c=0 @element:listitem@1 t=
- `d6 TQT el1 Strikethrough` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:T0w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<s>k</s><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=null c=0 @element:listitem@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<s>k</s><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d6 TQT el1 Tab` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:T0w@3 t=  
  H w=null c=0 @element:listitem@1 t=
- `d6 TQT el1 Underline` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:T0w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<u>k</u><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=null c=0 @element:listitem@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<u>k</u><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d6 TQT el1 cut` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @text:T0w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wk<blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=null c=0 @text:Q1w@0 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<blockquote><p>kQ1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d6 TQT el1 drop` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wDq<blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0wDq@5 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wDqk<blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<blockquote><p>DqQ1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:DqQ1w@2 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<blockquote><p>DqkQ1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d6 TQT el1 ime` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wa<blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=2 @text:T0wa@4 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wak<blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<blockquote><p>aQ1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=3 @text:aQ1w@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<blockquote><p>akQ1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d6 TQT el1 lineBack` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @element:listitem@0 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>k<blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @element:quote@0 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li><blockquote><p>kQ1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d6 TQT el1 paste HTML` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wAq</li></ul></li><li>Bq</li></ul></li></ul></li></ul></li></ul></li></ul><blockquote><p>Q1w</p></blockquote><p>T2w</p> c=1 @text:Bq@2 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wAq</li></ul></li><li>Bqk</li></ul></li></ul></li></ul></li></ul></li></ul><blockquote><p>Q1w</p></blockquote><p>T2w</p>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<blockquote><p>Aq</p><p>BqQ1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:BqQ1w@2 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<blockquote><p>Aq</p><p>BqkQ1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d6 TQT el1 paste own` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wAq</li></ul></li><li>Bq</li></ul></li></ul></li></ul></li></ul></li></ul><blockquote><p>Q1w</p></blockquote><p>T2w</p> c=1 @text:Bq@2 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wAq</li></ul></li><li>Bqk</li></ul></li></ul></li></ul></li></ul></li></ul><blockquote><p>Q1w</p></blockquote><p>T2w</p>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<blockquote><p>Aq</p><p>BqQ1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:BqQ1w@2 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<blockquote><p>Aq</p><p>BqkQ1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d6 TQT el1 paste text` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wAq<blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0wAq@5 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wAqk<blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<blockquote><p>AqQ1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:AqQ1w@2 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0w<blockquote><p>AqkQ1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d7 TR T0w@1 Code` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li><pre><code>T0w</code></pre><hr /></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0w@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li><pre><code>Tk0w</code></pre><hr /></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul><pre><code>T0w</code></pre><hr /> c=1 @text:T0w@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul><pre><code>Tk0w</code></pre><hr />
- `d7 TR T0w@1 Heading 2` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li><h2>T0w</h2><hr /></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0w@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li><h2>Tk0w</h2><hr /></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul><h2>T0w</h2><hr /> c=1 @text:T0w@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul><h2>Tk0w</h2><hr />
- `d7 TR T0w@1 Heading 3` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li><h3>T0w</h3><hr /></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0w@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li><h3>Tk0w</h3><hr /></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul><h3>T0w</h3><hr /> c=1 @text:T0w@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul><h3>Tk0w</h3><hr />
- `d7 TR T0w@1 Heading 4` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li><h4>T0w</h4><hr /></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0w@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li><h4>Tk0w</h4><hr /></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul><h4>T0w</h4><hr /> c=1 @text:T0w@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul><h4>Tk0w</h4><hr />
- `d7 TR T0w@1 Quote` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w</li><li><hr /></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0w@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>Tk0w</li><li><hr /></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul><blockquote>T0w<hr /></blockquote> c=1 @text:T0w@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul><blockquote>Tk0w<hr /></blockquote>
- `d7 TR T0w@1 ime` — head flagged: undo does not restore  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>Ta0w<hr /></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=2 @text:Ta0w@2 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>Tak0w<hr /></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>Ta0w<hr /></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=3 @text:Ta0w@2 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>Tak0w<hr /></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d7 TR el2 Backspace` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w</li><li>T0w<hr /></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @element:listitem@2 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w</li><li>T0w<hr />k</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0wk</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d7 TR el2 Code` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w<hr /><pre><code></code></pre></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @element:code@0 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w<hr /><pre><code>k</code></pre></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul><pre><code>T0w</code></pre><hr /> c=1 @text:A6w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6wk</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul><pre><code>T0w</code></pre><hr />
- `d7 TR el2 Ctrl+Delete` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @element:listitem@2 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w<hr />k</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0wk</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d7 TR el2 Delete` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=null c=0 @element:listitem@2 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w<hr />k</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:T0w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0wk</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d7 TR el2 Heading 2` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w<hr /><h2></h2></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @element:heading@0 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w<hr /><h2>k</h2></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul><h2>T0w</h2><hr /> c=1 @text:A6w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6wk</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul><h2>T0w</h2><hr />
- `d7 TR el2 Heading 3` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w<hr /><h3></h3></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @element:heading@0 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w<hr /><h3>k</h3></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul><h3>T0w</h3><hr /> c=1 @text:A6w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6wk</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul><h3>T0w</h3><hr />
- `d7 TR el2 Heading 4` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w<hr /><h4></h4></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @element:heading@0 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w<hr /><h4>k</h4></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul><h4>T0w</h4><hr /> c=1 @text:A6w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6wk</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul><h4>T0w</h4><hr />
- `d7 TR el2 Link` — head flagged: undo does not restore; not a fixed point  
  B w=null c=0 @element:listitem@2 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w<hr />k</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w<a><hr /></a></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @element:listitem@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w<a><hr /></a></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `d7 TR el2 Quote` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w<hr /></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @element:listitem@2 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w<hr />k</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul><blockquote>T0w<hr /></blockquote> c=1 @text:A6w@3 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6wk</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul><blockquote>T0w<hr /></blockquote>
- `d7 TR el2 ime` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w<hr />a</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=1 @text:a@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w<hr />ak</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>  
  H w=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w<hr />a</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> c=3 @text:a@1 t=<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>A6w<ul><li>T0w<hr />ak</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
- `ol TR T0w@1 Code` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ol><li>Pw</li><li><pre><code>T0w</code></pre><hr /></li><li>Nw</li></ol> c=1 @text:T0w@1 t=<ol><li>Pw</li><li><pre><code>Tk0w</code></pre><hr /></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li></ol><pre><code>T0w</code></pre><hr /><ol><li>Nw</li></ol> c=1 @text:T0w@1 t=<ol><li>Pw</li></ol><pre><code>Tk0w</code></pre><hr /><ol><li>Nw</li></ol>
- `ol TR T0w@1 Heading 2` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ol><li>Pw</li><li><h2>T0w</h2><hr /></li><li>Nw</li></ol> c=1 @text:T0w@1 t=<ol><li>Pw</li><li><h2>Tk0w</h2><hr /></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li></ol><h2>T0w</h2><hr /><ol><li>Nw</li></ol> c=1 @text:T0w@1 t=<ol><li>Pw</li></ol><h2>Tk0w</h2><hr /><ol><li>Nw</li></ol>
- `ol TR T0w@1 Heading 3` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ol><li>Pw</li><li><h3>T0w</h3><hr /></li><li>Nw</li></ol> c=1 @text:T0w@1 t=<ol><li>Pw</li><li><h3>Tk0w</h3><hr /></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li></ol><h3>T0w</h3><hr /><ol><li>Nw</li></ol> c=1 @text:T0w@1 t=<ol><li>Pw</li></ol><h3>Tk0w</h3><hr /><ol><li>Nw</li></ol>
- `ol TR T0w@1 Heading 4` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ol><li>Pw</li><li><h4>T0w</h4><hr /></li><li>Nw</li></ol> c=1 @text:T0w@1 t=<ol><li>Pw</li><li><h4>Tk0w</h4><hr /></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li></ol><h4>T0w</h4><hr /><ol><li>Nw</li></ol> c=1 @text:T0w@1 t=<ol><li>Pw</li></ol><h4>Tk0w</h4><hr /><ol><li>Nw</li></ol>
- `ol TR T0w@1 Quote` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ol><li>Pw</li><li><blockquote>T0w</blockquote><hr /></li><li>Nw</li></ol> c=1 @text:T0w@1 t=<ol><li>Pw</li><li><blockquote>Tk0w</blockquote><hr /></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li></ol><blockquote>T0w<hr /></blockquote><ol><li>Nw</li></ol> c=1 @text:T0w@1 t=<ol><li>Pw</li></ol><blockquote>Tk0w<hr /></blockquote><ol><li>Nw</li></ol>
- `ol TR T0w@1 ime` — head flagged: undo does not restore  
  B w=<ol><li>Pw</li><li>Ta0w<hr /></li><li>Nw</li></ol> c=2 @text:Ta0w@2 t=<ol><li>Pw</li><li>Tak0w<hr /></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li>Ta0w<hr /></li><li>Nw</li></ol> c=3 @text:Ta0w@2 t=<ol><li>Pw</li><li>Tak0w<hr /></li><li>Nw</li></ol>
- `ol TR el2 Code` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ol><li>Pw</li><li>T0w<hr /><pre><code></code></pre></li><li>Nw</li></ol> c=1 @element:code@0 t=<ol><li>Pw</li><li>T0w<hr /><pre><code>k</code></pre></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li></ol><pre><code>T0w</code></pre><hr /><ol><li>Nw</li></ol> c=1 @text:Pw@2 t=<ol><li>Pwk</li></ol><pre><code>T0w</code></pre><hr /><ol><li>Nw</li></ol>
- `ol TR el2 Ctrl+Delete` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ol><li>Pw</li><li>T0w<hr />Nw</li></ol> c=1 @text:Nw@0 t=<ol><li>Pw</li><li>T0w<hr />kNw</li></ol>  
  H w=<ol><li>Pw</li><li>T0wNw</li></ol> c=1 @text:T0wNw@3 t=<ol><li>Pw</li><li>T0wkNw</li></ol>
- `ol TR el2 Delete` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ol><li>Pw</li><li>T0w<hr />Nw</li></ol> c=1 @text:Nw@0 t=<ol><li>Pw</li><li>T0w<hr />kNw</li></ol>  
  H w=<ol><li>Pw</li><li>T0w</li><li>Nw</li></ol> c=1 @text:T0w@3 t=<ol><li>Pw</li><li>T0wk</li><li>Nw</li></ol>
- `ol TR el2 Heading 2` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ol><li>Pw</li><li>T0w<hr /><h2></h2></li><li>Nw</li></ol> c=1 @element:heading@0 t=<ol><li>Pw</li><li>T0w<hr /><h2>k</h2></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li></ol><h2>T0w</h2><hr /><ol><li>Nw</li></ol> c=1 @text:Pw@2 t=<ol><li>Pwk</li></ol><h2>T0w</h2><hr /><ol><li>Nw</li></ol>
- `ol TR el2 Heading 3` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ol><li>Pw</li><li>T0w<hr /><h3></h3></li><li>Nw</li></ol> c=1 @element:heading@0 t=<ol><li>Pw</li><li>T0w<hr /><h3>k</h3></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li></ol><h3>T0w</h3><hr /><ol><li>Nw</li></ol> c=1 @text:Pw@2 t=<ol><li>Pwk</li></ol><h3>T0w</h3><hr /><ol><li>Nw</li></ol>
- `ol TR el2 Heading 4` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ol><li>Pw</li><li>T0w<hr /><h4></h4></li><li>Nw</li></ol> c=1 @element:heading@0 t=<ol><li>Pw</li><li>T0w<hr /><h4>k</h4></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li></ol><h4>T0w</h4><hr /><ol><li>Nw</li></ol> c=1 @text:Pw@2 t=<ol><li>Pwk</li></ol><h4>T0w</h4><hr /><ol><li>Nw</li></ol>
- `ol TR el2 Link` — head flagged: undo does not restore; not a fixed point  
  B w=null c=0 @element:listitem@2 t=<ol><li>Pw</li><li>T0w<hr />k</li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li>T0w<a><hr /></a></li><li>Nw</li></ol> c=1 @element:listitem@3 t=<ol><li>Pw</li><li>T0w<a><hr /></a></li><li>Nw</li></ol>
- `ol TR el2 Quote` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ol><li>Pw</li><li>T0w<hr /><blockquote></blockquote></li><li>Nw</li></ol> c=1 @element:quote@0 t=<ol><li>Pw</li><li>T0w<hr /><blockquote>k</blockquote></li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li></ol><blockquote>T0w<hr /></blockquote><ol><li>Nw</li></ol> c=1 @text:Pw@2 t=<ol><li>Pwk</li></ol><blockquote>T0w<hr /></blockquote><ol><li>Nw</li></ol>
- `ol TR el2 ime` — UNEXPLAINED (a mixed-container shape, the head's cell not flagged)  
  B w=<ol><li>Pw</li><li>T0w<hr />a</li><li>Nw</li></ol> c=1 @text:a@1 t=<ol><li>Pw</li><li>T0w<hr />ak</li><li>Nw</li></ol>  
  H w=<ol><li>Pw</li><li>T0w<hr />a</li><li>Nw</li></ol> c=3 @text:a@1 t=<ol><li>Pw</li><li>T0w<hr />ak</li><li>Nw</li></ol>
- `ol TR el2 lineForward` — head flagged: short: D19  
  B w=<ol><li>Pw</li><li>T0w<hr />Nw</li></ol> c=1 @text:Nw@0 t=<ol><li>Pw</li><li>T0w<hr />kNw</li></ol>  
  H w=<ol><li>Pw</li><li>T0w<hr /></li><li>Nw</li></ol> c=1 @element:listitem@2 t=<ol><li>Pw</li><li>T0w<hr />k</li><li>Nw</li></ol>
