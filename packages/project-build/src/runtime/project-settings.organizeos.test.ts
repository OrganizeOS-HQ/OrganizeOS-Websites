// OrganizeOS fork: a redirect target passes the rule for addresses that may
// run while org script is paused (docs/ORGANIZEOS-FORK.md section 10)
import { expect, test } from "vitest";
import type { BuilderState } from "../state/builder-state";
import {
  createRedirect,
  setRedirects,
  updateRedirect,
  validateRedirectTarget,
} from "./project-settings";

const state = () =>
  ({
    pages: { redirects: [{ old: "/old", new: "/new", status: "301" }] },
  }) as unknown as BuilderState;

const refusedTargets = [
  "javascript:void 0",
  "JavaScript:void 0",
  " java\tscript:void 0",
  "data:text/html,x",
];

test.each(refusedTargets)("validateRedirectTarget refuses %s", (target) => {
  expect(validateRedirectTarget({ target })).toEqual([
    "This address is not allowed.",
  ]);
});

test("validateRedirectTarget accepts a path and a web address", () => {
  expect(validateRedirectTarget({ target: "/new" })).toEqual([]);
  expect(validateRedirectTarget({ target: "https://example.org/" })).toEqual(
    []
  );
});

test.each(refusedTargets)(
  "the redirect operations refuse the target %s",
  (target) => {
    expect(() =>
      createRedirect(state(), { old: "/from", new: target })
    ).toThrow("This address is not allowed.");
    expect(() =>
      updateRedirect(state(), { old: "/old", values: { new: target } })
    ).toThrow("This address is not allowed.");
    expect(() =>
      setRedirects(state(), { redirects: [{ old: "/from", new: target }] })
    ).toThrow("This address is not allowed.");
  }
);

test("the redirect operations accept a web address", () => {
  expect(
    createRedirect(state(), { old: "/from", new: "https://example.org/" })
  ).toMatchObject({ kind: "mutation" });
});
