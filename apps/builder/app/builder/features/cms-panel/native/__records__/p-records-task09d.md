# P records, Task 9 review fixes

## P9-3: Delete after the kit's imageNode() on an image that follows a quote in an item

- Stored: `LI(<blockquote><p>Q0w</p></blockquote>IMG)`.
- Place: `imageNode()` (a real click on the image, then Escape), then Delete.
- Action: a letter (`k`).
- Branch (fc0ffbf plus this commit's fixes): the last write is `<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><img />kNw</li></ul>`. The image stays, and Nw's item joins the middle item, with the letter before Nw. So after Escape the image is not node-selected: the caret is after the image, and Delete at the item's end joins the next item.
- Check 2 group C (C2) names this input's result: "after a clicked image is deleted the caret is at the end of the content directly before it, here the quote's end", so a letter writes `W(<li><blockquote><p>Q0wk</p></blockquote></li>)`.
- `<base>`: not measured (the image-after-quote shape is lined only on the branch). Not caused by this commit: the exemption only touches lines that hold the caret before a removal.
- Question: is the click-and-Escape input meant to keep the image node-selected? If so, this is a defect for the owning task (Task 16, node selections, or Task 14), and Delete should remove the image. If not, check 2's input is "a click on the image, then Delete" with no Escape.
- Not pinned. The review's "removal that did not hold the caret" test uses a direct node selection (`nodeSelect("cms-image")`) and Delete. That gives check 2's write, `W(<li><blockquote><p>Q0wk</p></blockquote></li>)`.
