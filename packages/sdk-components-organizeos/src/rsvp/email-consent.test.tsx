/**
 * @vitest-environment jsdom
 */
import { createRef } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { EmailConsent } from "./email-consent";
import { fixtureEvent, renderPart } from "./parts-harness";
import events from "../__fixtures__/events.json";

const launch = fixtureEvent(events.data[3].id);

afterEach(cleanup);

const text = "Also email me news from this organization";

describe("Email Consent", () => {
  test("is an unchecked checkbox named email_consent, labelled by the part's own children", () => {
    renderPart(<EmailConsent>{text}</EmailConsent>, { event: launch });
    const box = screen.getByLabelText(text) as HTMLInputElement;
    expect(box.type).toBe("checkbox");
    expect(box.name).toBe("email_consent");
    expect(box.checked).toBe(false);
    expect(box.closest("label")?.textContent).toBe(text);
  });

  test("collect says whether the box is checked", () => {
    const view = renderPart(<EmailConsent>{text}</EmailConsent>, {
      event: launch,
    });
    expect(view.collect("consent")).toBe(false);
    fireEvent.click(screen.getByLabelText(text));
    expect(view.collect("consent")).toBe(true);
    fireEvent.click(screen.getByLabelText(text));
    expect(view.collect("consent")).toBe(false);
  });

  test("collect is a stable function, so the part registers once", () => {
    const view = renderPart(<EmailConsent>{text}</EmailConsent>);
    const first = Array.from(view.registered.values())[0].collect;
    fireEvent.click(screen.getByLabelText(text));
    expect(view.registered.size).toBe(1);
    expect(Array.from(view.registered.values())[0].collect).toBe(first);
    expect(Array.from(view.registered.values())[0].kind).toBe("consent");
  });

  test("keeps its text in an element of its own, which is the one its ref points to", () => {
    // The canvas edits the text in place on the element the ref points to
    // and replaces what is inside it: the checkbox must not be in there.
    const ref = createRef<HTMLSpanElement>();
    renderPart(
      <EmailConsent ref={ref} className="consent" data-testid="part">
        {text}
      </EmailConsent>
    );
    const part = screen.getByTestId("part");
    expect(part.tagName).toBe("LABEL");
    expect(part.className).toBe("consent");
    expect(ref.current?.tagName).toBe("SPAN");
    expect(ref.current?.textContent).toBe(text);
    expect(ref.current?.querySelector("input")).toBeNull();
    expect(part.contains(ref.current)).toBe(true);
  });

  test("takes links and other elements as its text", () => {
    renderPart(
      <EmailConsent>
        Email me, and see the <a href="/privacy">privacy policy</a>
      </EmailConsent>
    );
    expect(screen.getByRole("link", { name: "privacy policy" })).toBeTruthy();
    expect(screen.getByRole("checkbox").closest("label")?.textContent).toBe(
      "Email me, and see the privacy policy"
    );
  });

  test("works with no event, on the canvas and in the preview", () => {
    for (const renderer of ["canvas", "preview", undefined] as const) {
      renderPart(<EmailConsent>{text}</EmailConsent>, { renderer });
      expect(screen.getByLabelText(text)).toBeTruthy();
      cleanup();
    }
  });

  test("is marked invalid when the platform names it, and not otherwise", () => {
    renderPart(<EmailConsent data-testid="part">{text}</EmailConsent>, {
      errors: { email_consent: "Check this field." },
    });
    expect(screen.getByTestId("part").hasAttribute("data-invalid")).toBe(true);
    expect(screen.getByLabelText(text).getAttribute("aria-invalid")).toBe(
      "true"
    );
    cleanup();
    renderPart(<EmailConsent data-testid="part">{text}</EmailConsent>, {
      errors: { email: "Enter a valid email address." },
    });
    expect(screen.getByTestId("part").hasAttribute("data-invalid")).toBe(false);
    expect(screen.getByLabelText(text).hasAttribute("aria-invalid")).toBe(
      false
    );
  });

  test("a form reset unchecks the box and collect says so", () => {
    // The browser puts the box back to unchecked without an onChange, so what
    // collect says has to come from the box, not from a copy of it.
    const view = renderPart(
      <form>
        <EmailConsent>{text}</EmailConsent>
        <button type="reset">Reset</button>
      </form>,
      { event: launch }
    );
    const box = screen.getByLabelText(text) as HTMLInputElement;
    fireEvent.click(box);
    expect(box.checked).toBe(true);
    expect(view.collect("consent")).toBe(true);
    fireEvent.click(screen.getByText("Reset"));
    expect(box.checked).toBe(false);
    expect(view.collect("consent")).toBe(false);
    // and it can be checked again
    fireEvent.click(box);
    expect(view.collect("consent")).toBe(true);
  });
});
