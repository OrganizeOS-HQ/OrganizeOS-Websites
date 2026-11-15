/**
 * @vitest-environment jsdom
 */
import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { DonationForm, DonationFrame } from "./donation-form";

const ORG = "0b5c1a2e-3f4d-4e5a-8b6c-7d8e9f0a1b2c";

const tree = (
  <DonationForm
    target="general"
    organizationId={ORG}
    platformOrigin="https://app.organizeos.org"
    afterGift="message"
    state="ready"
  >
    <DonationFrame />
  </DonationForm>
);

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

test("server HTML has no frame", () => {
  const html = renderToString(tree);
  expect(html).not.toContain("<iframe");
  expect(html).toContain('data-donation-frame="placeholder"');
  expect(html).toContain("height:640px");
});

test("hydration matches, and the frame mounts after it", async () => {
  const container = document.createElement("div");
  container.innerHTML = renderToString(tree);
  document.body.append(container);
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  await act(async () => {
    hydrateRoot(container, tree);
  });
  expect(errors).not.toHaveBeenCalled();
  expect(container.querySelector("iframe")).not.toBeNull();
});
