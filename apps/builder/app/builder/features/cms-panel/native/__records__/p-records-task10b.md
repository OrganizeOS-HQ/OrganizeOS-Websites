# Task 10 follow-up (T25.1): an image clicked, Escape, then Delete or Backspace, then k

Driver: `mount(stored)`, real `userEvent.click` on the img, Escape, the key, then `k`. Branch = 02e0f5d (lines project); `<base>` = 2a96a45 (rich-text project, kit copied in and removed; worktree clean). IMG = the kit's stored image tag.

## Measurements

| cell                          | build  | after click       | after Escape         | write after key                                                           | caret                | typed (k)                 | caret after k    |
| ----------------------------- | ------ | ----------------- | -------------------- | ------------------------------------------------------------------------- | -------------------- | ------------------------- | ---------------- |
| `<p>Aw IMG Bw</p>`, Delete    | base   | none              | `text: Bw@0`         | `<p>Aw <img />Bw</p>`                                                     | `text:Bw@0`          | `<p>Aw <img />kBw</p>`    | `text:kBw@1`     |
| same                          | branch | none              | `text: Bw@0`         | `<p>Aw <img />Bw</p>`                                                     | `text:Bw@0`          | `<p>Aw <img />kBw</p>`    | `text:kBw@1`     |
| `<p>Aw IMG Bw</p>`, Backspace | base   | none              | `text: Bw@0`         | `<p>Aw  Bw</p>`                                                           | `text:Aw  Bw@3`      | `<p>Aw k Bw</p>`          | `text:Aw k Bw@4` |
| same                          | branch | identical to base |                      |                                                                           |                      |                           |                  |
| `LI(Q(Q0w) IMG)`, Delete      | base   | none              | `element:listitem@2` | `W(<li>Q(Q0w)</li>)` (M27's ruled write)                                  | `text:Nw@0`          | `...<li>kNw</li>...`      | `text:kNw@1`     |
| same                          | branch | none              | `element:listitem@2` | `<ul><li>Pw</li><li>Q(Q0w)<img />Nw</li></ul>` (image kept, Nw joined in) | `text:Nw@0`          | `...<img />kNw</li></ul>` | `text:kNw@1`     |
| `LI(Q(Q0w) IMG)`, Backspace   | base   | none              | `element:listitem@2` | `W(<li>Q(Q0w)</li>)`                                                      | `element:listitem@1` | `W(<li>Q(Q0wk)</li>)`     | `text:Q0wk@4`    |
| same                          | branch | none              | `element:listitem@2` | `W(<li>Q(Q0w)</li>)`                                                      | `element:listitem@1` | `W(<li>Q(Q0w)k</li>)`     | `text:k@1`       |

## Findings

1. Ordinary content: the branch equals `<base>` in every column. The carry did not regress it.
2. T25.1's premise does not hold at `<base>`. Today's editor does NOT leave the image node-selected after Escape. Its popover's close (`onCloseAutoFocus`, closed by key) puts a caret right after the image (`$caretBeside(node, false)`), at `<base>` as on the branch. So at `<base>`, Delete after Escape in ordinary content removes the space after the image and keeps the image.
3. If the close restored the node selection, as T25.1 asks, ordinary content would differ from `<base>`: Delete would remove the image. Not built, pending a re-ruling.
4. Lined cell, Delete: the branch keeps the image and joins the next item into it. This is the carry difference M27's ruling names: `<base>` gives M27's ruled write from the same caret after the image. Task 14 owns that delete. Not pinned here.
5. Lined cell, Backspace: the same write as `<base>`. The next letter differs: `<base>` puts it in the quote (`Q0wk`); the branch puts it in a line after the quote (C2/T24.1's caret, `</blockquote>k`).

## Question

Should the Escape close keep `<base>`'s caret after the image (no change), or select the image node, which differs from `<base>` in ordinary content? Pinned now: the ordinary cells with `<base>`'s writes (they pass unchanged).
