// OrganizeOS fork: the corpus of markup that must not run in a builder
// document, and the check that nothing of it did, shared by the insertion
// path's tests and the canvas components' tests (spec 2026-11-20, 4.6). Not a
// test file by the projects' glob: it runs only through its importers.
import { expect } from "vitest";

export const corpus = {
  inlineScript: "<script>window.__pwned = 1</script><p>ok</p>",
  imgOnerror: '<img src=x onerror="window.__pwned = 1">',
  svgOnload:
    '<svg onload="window.__pwned = 1"><rect width="1" height="1"/></svg>',
  javascriptHref: '<a href="javascript:window.__pwned=1">x</a>',
  dataHref: '<a href="data:text/html,<script>1</script>">x</a>',
  dataImg: '<img src="data:image/svg+xml,<svg onload=alert(1)>">',
  iframeSrcdoc: '<iframe srcdoc="<script>parent.__pwned=1</script>"></iframe>',
  formAction: '<form action="javascript:1"><button>go</button></form>',
  formaction: '<button formaction="javascript:1">go</button>',
  formAttribute: '<input form="f">',
  base: '<base href="https://evil.example/">',
  metaRefresh: '<meta http-equiv="refresh" content="0;url=javascript:1">',
  animate:
    '<svg><a><animate attributeName="href" values="javascript:1"/><text>x</text></a></svg>',
  set: '<svg><a><set attributeName="href" to="javascript:1"/><text>x</text></a></svg>',
  use: "<svg><use href=\"data:image/svg+xml,<svg id='x'/>#x\"/></svg>",
  dataWsId: '<div data-ws-id="root">x</div>',
  globalId: '<img id="cookie" name="getElementById"><a id="__pwned">x</a>',
  styleWithMarkup:
    '<style></style><img src=x onerror="window.__pwned=1"></style>',
  mutation:
    '<svg></p><style><a id="</style><img src=1 onerror=window.__pwned=1>">',
  noscriptMutation:
    '<noscript><p title="</noscript><img src=x onerror=window.__pwned=1>">',
  svgJavascriptLink:
    '<svg><a href="javascript:window.__pwned=1"><text>x</text></a></svg>',
};

/** Two animation frames: an inline handler or SMIL would have run by now. */
export const nextFrames = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

export const assertInert = (
  root: Pick<Element, "querySelector" | "querySelectorAll">
) => {
  expect(
    root.querySelector(
      "script, iframe, frame, object, embed, base, meta, link, form, animate, set, use"
    )
  ).toBeNull();
  for (const element of root.querySelectorAll("*")) {
    for (const { name, value } of element.attributes) {
      expect(name.startsWith("on"), name).toBe(false);
      if (name.startsWith("data-ws-") === false) {
        expect(name.startsWith("data-"), name).toBe(false);
      }
      expect(["srcdoc", "action", "formaction", "form"]).not.toContain(name);
      if (["href", "src", "cite"].includes(name)) {
        expect(value.trim()).not.toMatch(/^(?:javascript|data|vbscript):/i);
      }
    }
  }
  expect((window as { __pwned?: unknown }).__pwned).toBeUndefined();
  expect(typeof document.getElementById).toBe("function");
  expect((window as unknown as Record<string, unknown>).cookie).toBeUndefined();
};

/** The inserted markup holds no data attribute at all, `data-ws-*` included. */
export const assertNoDataAttributes = (
  root: Pick<Element, "querySelector" | "querySelectorAll">
) => {
  for (const element of root.querySelectorAll("*")) {
    for (const { name } of element.attributes) {
      expect(name.startsWith("data-"), name).toBe(false);
    }
  }
};
