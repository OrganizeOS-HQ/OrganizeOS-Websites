import { expect, test } from "vitest";
import { isPlatformServedPath } from "./platform-paths";

test.each(["/join", "/join/x", "/events/abc", "/donate/abc", "/giving/manage"])(
  "%s is served by the platform",
  (path) => {
    expect(isPlatformServedPath(path)).toBe(true);
  }
);

test.each(["/join-us", "/events", "/give", "/"])(
  "%s is not served by the platform",
  (path) => {
    expect(isPlatformServedPath(path)).toBe(false);
  }
);
