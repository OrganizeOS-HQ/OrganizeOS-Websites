import { expect, test } from "vitest";
import { parseRedirects } from "./redirect-parsers";

test("an import skips a target that may not run while org script is paused", () => {
  const result = parseRedirects(`source,target,status
/a,javascript:void 0,301
/b,JavaScript:void 0,302
/c,data:text/html,x,301
/d,https://example.org/,301`);
  expect(result.redirects).toEqual([
    { old: "/d", new: "https://example.org/", status: 301 },
  ]);
  expect(result.skipped.map((line) => line.reason)).toEqual([
    "address not allowed",
    "address not allowed",
    "address not allowed",
  ]);
});
