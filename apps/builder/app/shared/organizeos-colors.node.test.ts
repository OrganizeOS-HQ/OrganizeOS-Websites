import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// Read as text: routes/_ui.tsx imports server modules. An upstream merge that
// rewrites its links fails here instead of shipping upstream's blue.
const ui = readFileSync(
  fileURLToPath(new URL("../routes/_ui.tsx", import.meta.url)),
  "utf8"
);

describe("the OrganizeOS colours stylesheet", () => {
  test("is imported as a URL from shared/organizeos-colors.css", () => {
    expect(ui).toContain(
      'import organizeosColorsCss from "~/shared/organizeos-colors.css?url";'
    );
  });

  test("is linked after the design system's global.css, so its accent wins", () => {
    const links = ui.slice(ui.indexOf("export const links"));
    const global = links.indexOf(
      '{ rel: "stylesheet", href: designSystemGlobalCss }'
    );
    const organizeos = links.indexOf(
      '{ rel: "stylesheet", href: organizeosColorsCss }'
    );
    expect(global).toBeGreaterThan(-1);
    expect(organizeos).toBeGreaterThan(global);
  });

  test("sets the accent alone, on the document root", () => {
    const css = readFileSync(
      fileURLToPath(new URL("./organizeos-colors.css", import.meta.url)),
      "utf8"
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css.replace(/\s+/g, " ").trim()).toBe(
      ":root { --theme-color-accent: #23a997; }"
    );
  });
});
