import { afterEach, expect, test, vi } from "vitest";
import { navigateTo, navigationTarget } from "./navigate";

// In node, with a window that has only what navigate.ts reads: jsdom's
// location cannot be spied on, and it cannot navigate.
const origin = "https://acme.organizeos.org";

const onPage = (path: string) => {
  const url = new URL(path, origin);
  const assign = vi.fn();
  vi.stubGlobal("window", {
    location: {
      href: url.href,
      origin: url.origin,
      search: url.search,
      assign,
    },
  });
  return assign;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

test("keeps an http(s) target and refuses javascript: and data:", () => {
  const assign = onPage("/get-involved");
  expect(navigationTarget("/thank-you")).toBe(`${origin}/thank-you`);
  expect(navigationTarget("thank-you?a=1#top")).toBe(
    `${origin}/thank-you?a=1#top`
  );
  expect(navigationTarget("https://elsewhere.example/x?y=1")).toBe(
    "https://elsewhere.example/x?y=1"
  );
  expect(navigationTarget("http://elsewhere.example/")).toBe(
    "http://elsewhere.example/"
  );
  for (const href of [
    "javascript:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<p>hi</p>",
    "mailto:ada@example.org",
    "http://[",
  ]) {
    expect(navigationTarget(href), href).toBeUndefined();
    expect(navigateTo(href), href).toBe(false);
  }
  expect(assign).not.toHaveBeenCalled();
  expect(navigateTo("/thank-you")).toBe(true);
  expect(assign).toHaveBeenCalledWith(`${origin}/thank-you`);
  expect(assign).toHaveBeenCalledTimes(1);
});

test("adds the page's code to a same-origin platform page", () => {
  const assign = onPage("/get-involved?r=Code234567");
  expect(navigationTarget("/donate/spring-drive")).toBe(
    `${origin}/donate/spring-drive?r=Code234567`
  );
  expect(navigationTarget("/join/")).toBe(`${origin}/join/?r=Code234567`);
  expect(
    navigationTarget(`${origin}/events/weekly-phone-bank?ref=x#details`)
  ).toBe(`${origin}/events/weekly-phone-bank?ref=x&r=Code234567#details`);
  expect(navigateTo("/checkout/success")).toBe(true);
  expect(assign).toHaveBeenCalledWith(
    `${origin}/checkout/success?r=Code234567`
  );
});

test("leaves a site page, another origin, a target that already has r, and a page without a code alone", () => {
  onPage("/get-involved?r=Code234567");
  expect(navigationTarget("/thank-you")).toBe(`${origin}/thank-you`);
  expect(navigationTarget("/unsubscribe")).toBe(`${origin}/unsubscribe`);
  expect(navigationTarget("https://events.organizeos.org/acme/x")).toBe(
    "https://events.organizeos.org/acme/x"
  );
  expect(navigationTarget("http://acme.organizeos.org/donate")).toBe(
    "http://acme.organizeos.org/donate"
  );
  expect(navigationTarget("/join?r=Other23456")).toBe(
    `${origin}/join?r=Other23456`
  );
  for (const page of ["/get-involved", "/get-involved?r=bad"]) {
    onPage(page);
    expect(navigationTarget("/donate"), page).toBe(`${origin}/donate`);
  }
});
