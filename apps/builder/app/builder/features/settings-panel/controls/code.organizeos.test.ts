import { afterEach, describe, expect, test, vi } from "vitest";
import { validateHtml } from "./code";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the HTML Embed code check", () => {
  test("reads the code without putting it into any document", () => {
    const createElement = vi.spyOn(document, "createElement");
    const createHTMLDocument = vi.spyOn(
      document.implementation,
      "createHTMLDocument"
    );
    const parseFromString = vi.spyOn(DOMParser.prototype, "parseFromString");
    const html = `<p class="note">Hello <b>there</b></p><p>`;
    expect(validateHtml(html)?.expected).toBe(
      `<p class="note">Hello <b>there</b></p><p></p>`
    );
    expect(createElement).not.toHaveBeenCalled();
    expect(createHTMLDocument).not.toHaveBeenCalled();
    // only the XML reading of a possible SVG, which runs nothing
    for (const [, type] of parseFromString.mock.calls) {
      expect(type).toBe("application/xml");
    }
  });

  test("still accepts well-formed HTML and SVG", () => {
    expect(validateHtml(`<div class="a"><span>x</span></div>`)).toBeUndefined();
    expect(
      validateHtml(`<svg viewBox="0 0 1 1"><path d="M0 0" /></svg>`)
    ).toBeUndefined();
    expect(validateHtml(`<input disabled>`)).toBeUndefined();
  });

  test("accepts < and > written as entities in an attribute value", () => {
    expect(validateHtml(`<input value="&lt;b&gt;">`)).toBeUndefined();
    expect(
      validateHtml(
        `<div data-tip="a &gt; b" data-html="&lt;b&gt;x&lt;/b&gt;"></div>`
      )
    ).toBeUndefined();
  });

  test("reads the code as an element's content, as upstream's check did", () => {
    // a table row outside a table is dropped, as in a div
    expect(validateHtml(`<tr><td>x</td></tr><br>`)?.expected).toBe("x<br>");
  });

  test("accepts a tracking snippet whose noscript holds markup", () => {
    const snippet = `<script>
  !function(f){f.fbq=function(){}}(window);
  fbq('init', '123456789012345');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=123456789012345&ev=PageView&noscript=1"
/></noscript>`;
    expect(validateHtml(snippet)).toBeUndefined();
    expect(
      validateHtml(`<noscript><a href="?a=1&b=2">Enable JS</a></noscript>`)
    ).toBeUndefined();
  });

  test("still reports broken HTML with the browser's reading of it", () => {
    const error = validateHtml(`<div><span>x</div>`);
    expect(error?.message).toBe("Entered HTML has a validation error.");
    expect(error?.expected).toBe(`<div><span>x</span></div>`);
  });

  test("still refuses code over the size limit", () => {
    expect(validateHtml("a".repeat(50_001))?.message).toBe(
      "The HTML Embed code exceeds 50000 character limit."
    );
  });
});
