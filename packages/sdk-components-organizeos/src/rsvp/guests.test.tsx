/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import events from "../__fixtures__/events.json";
import requestFull from "../__fixtures__/rsvps/request-full.json";
import { Guests } from "./guests";
import { fixtureEvent, makeEvent, renderPart } from "./parts-harness";

const [voterDrive, , , canvassLaunch] = events.data;
const withGuests = fixtureEvent(canvassLaunch.id);
const noGuests = fixtureEvent(voterDrive.id);

afterEach(cleanup);

const add = (label = "Add a guest") =>
  fireEvent.click(screen.getByRole("button", { name: label }));

const fill = (name: string, value: string) => {
  const input = document.querySelector(`input[name="${name}"]`);
  if (input === null) {
    throw new Error(`no input ${name}`);
  }
  fireEvent.change(input, { target: { value } });
};

describe("on a published site", () => {
  test("renders nothing when the event takes no guests, or there is no event", () => {
    const first = renderPart(<Guests />, { event: noGuests });
    expect(first.container.innerHTML).toBe("");
    cleanup();
    const second = renderPart(<Guests />, { event: undefined });
    expect(second.container.innerHTML).toBe("");
  });

  test("registers as a guests part even when it renders nothing", () => {
    const view = renderPart(<Guests />, { event: noGuests });
    expect(view.collect("guests")).toEqual([]);
  });

  test("starts with no rows and an Add button", () => {
    const { container } = renderPart(<Guests />, { event: withGuests });
    expect(screen.getByRole("button", { name: "Add a guest" })).toBeTruthy();
    expect(container.querySelectorAll("input")).toHaveLength(0);
    expect(container.querySelector("[data-sample]")).toBeNull();
  });

  test("an added row has a first and a last name input, named by its place", () => {
    renderPart(<Guests />, { event: withGuests });
    add();
    const row = screen.getByRole("group", { name: "Guest 1" });
    const inputs = row.querySelectorAll("input");
    expect(
      Array.from(inputs).map((input) => input.getAttribute("name"))
    ).toEqual(["guests.0.first_name", "guests.0.last_name"]);
    expect(inputs[0].getAttribute("placeholder")).toBe("First name");
    expect(inputs[1].getAttribute("placeholder")).toBe("Last name");
    expect(inputs[0].getAttribute("aria-label")).toBe("Guest 1 first name");
    expect(inputs[1].getAttribute("aria-label")).toBe("Guest 1 last name");
    // a guest is not the registrant: the browser does not fill their name in
    expect(inputs[0].getAttribute("autocomplete")).toBe("off");
    expect(inputs[1].getAttribute("autocomplete")).toBe("off");
    // the endpoint takes 100 characters of a name
    expect(inputs[0].getAttribute("maxlength")).toBe("100");
    expect(inputs[1].getAttribute("maxlength")).toBe("100");
    // and the buttons never submit the form
    expect(
      screen
        .getByRole("button", { name: "Remove (guest 1)" })
        .getAttribute("type")
    ).toBe("button");
    expect(
      screen.getByRole("button", { name: "Add a guest" }).getAttribute("type")
    ).toBe("button");
  });

  test("the labels and placeholders are the designer's", () => {
    renderPart(
      <Guests
        addLabel="Bring someone"
        removeLabel="Drop"
        firstNamePlaceholder="Given name"
        lastNamePlaceholder="Family name"
      />,
      { event: withGuests }
    );
    add("Bring someone");
    expect(screen.getByPlaceholderText("Given name")).toBeTruthy();
    expect(screen.getByPlaceholderText("Family name")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Drop (guest 1)" })).toBeTruthy();
    expect(screen.queryByText("Add a guest")).toBeNull();
  });

  test("the Add button goes at the event's allowance and comes back with a removed row", () => {
    expect(withGuests.maxGuests).toBe(3);
    renderPart(<Guests />, { event: withGuests });
    add();
    add();
    add();
    expect(screen.queryByRole("button", { name: "Add a guest" })).toBeNull();
    expect(screen.getAllByRole("group")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Remove (guest 3)" }));
    expect(screen.getAllByRole("group")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Add a guest" })).toBeTruthy();
  });

  test("removing a row keeps the others' names and renumbers them", () => {
    const view = renderPart(<Guests />, { event: withGuests });
    add();
    add();
    add();
    fill("guests.0.first_name", "Ada");
    fill("guests.0.last_name", "Lovelace");
    fill("guests.1.first_name", "Charles");
    fill("guests.1.last_name", "Babbage");
    fill("guests.2.first_name", "Mary");
    fill("guests.2.last_name", "Somerville");
    fireEvent.click(screen.getByRole("button", { name: "Remove (guest 2)" }));
    const names = Array.from(view.container.querySelectorAll("input")).map(
      (input) => [input.getAttribute("name"), input.value]
    );
    expect(names).toEqual([
      ["guests.0.first_name", "Ada"],
      ["guests.0.last_name", "Lovelace"],
      ["guests.1.first_name", "Mary"],
      ["guests.1.last_name", "Somerville"],
    ]);
    expect(view.collect("guests")).toEqual([
      { first_name: "Ada", last_name: "Lovelace" },
      { first_name: "Mary", last_name: "Somerville" },
    ]);
  });

  test("collect returns the guests of request-full.json", () => {
    const view = renderPart(<Guests />, {
      event: fixtureEvent(requestFull.event_id),
    });
    add();
    fill("guests.0.first_name", requestFull.guests[0].first_name);
    fill("guests.0.last_name", requestFull.guests[0].last_name);
    expect(view.collect("guests")).toEqual(requestFull.guests);
  });

  test("collect leaves out a row that is entirely blank and keeps a half-filled one", () => {
    const view = renderPart(<Guests />, { event: withGuests });
    add();
    add();
    add();
    fill("guests.0.first_name", "Ada");
    fill("guests.0.last_name", "Lovelace");
    // the second row stays blank, or holds only spaces
    fill("guests.1.first_name", "  ");
    // the third has a first name alone: the platform answers it with a message
    fill("guests.2.first_name", "Charles");
    expect(view.collect("guests")).toEqual([
      { first_name: "Ada", last_name: "Lovelace" },
      { first_name: "Charles", last_name: "" },
    ]);
  });

  test("collect is a stable function, so the part registers once", () => {
    const view = renderPart(<Guests />, { event: withGuests });
    expect(view.registered.size).toBe(1);
    const first = Array.from(view.registered.values())[0].collect;
    add();
    fill("guests.0.first_name", "Ada");
    expect(view.registered.size).toBe(1);
    expect(Array.from(view.registered.values())[0].collect).toBe(first);
  });

  test("collect bounds what it returns: the names to 100 characters and the guests to the allowance", () => {
    const view = renderPart(<Guests />, { event: withGuests });
    add();
    // set another way than typing (autofill, say), which maxlength does not stop
    fill("guests.0.first_name", "a".repeat(150));
    fill("guests.0.last_name", "b".repeat(101));
    expect(view.collect("guests")).toEqual([
      { first_name: "a".repeat(100), last_name: "b".repeat(100) },
    ]);
    // the event moves on to an allowance of none: nothing is left to send
    view.rerender(<Guests />, { event: makeEvent({ maxGuests: 0 }) });
    expect(view.collect("guests")).toEqual([]);
    // and to an allowance of one, after three rows
    view.rerender(<Guests />, { event: withGuests });
    add();
    add();
    fill("guests.0.first_name", "Ada");
    fill("guests.1.first_name", "Charles");
    fill("guests.2.first_name", "Mary");
    view.rerender(<Guests />, { event: makeEvent({ maxGuests: 2 }) });
    expect(view.collect("guests")).toHaveLength(2);
    expect(screen.getAllByRole("group")).toHaveLength(2);
  });

  test("a new row takes the focus, and a removed one hands it to the Add button", () => {
    renderPart(<Guests />, { event: withGuests });
    add();
    expect(document.activeElement?.getAttribute("name")).toBe(
      "guests.0.first_name"
    );
    add();
    expect(document.activeElement?.getAttribute("name")).toBe(
      "guests.1.first_name"
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove (guest 1)" }));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Add a guest" })
    );
  });

  test("the preview behaves as the published site", () => {
    const { container } = renderPart(<Guests />, {
      renderer: "preview",
      event: noGuests,
    });
    expect(container.innerHTML).toBe("");
    cleanup();
    renderPart(<Guests />, { renderer: "preview", event: withGuests });
    expect(document.querySelector("[data-sample]")).toBeNull();
    expect(screen.getByRole("button", { name: "Add a guest" })).toBeTruthy();
  });
});

describe("the message", () => {
  test("shows the guests message, marked for styling, and flags the blank names", () => {
    const view = renderPart(<Guests data-testid="part" />, {
      event: withGuests,
      errors: { guests: "Check your guests' names.", email: "elsewhere" },
    });
    // no rows yet: the message still shows
    const message = screen.getByText("Check your guests' names.");
    expect(message.hasAttribute("data-message")).toBe(true);
    expect(message.hasAttribute("data-invalid")).toBe(true);
    expect(screen.getByTestId("part").hasAttribute("data-invalid")).toBe(true);
    expect(screen.queryByText("elsewhere")).toBeNull();
    add();
    fill("guests.0.first_name", "Ada");
    const [first, last] = Array.from(view.container.querySelectorAll("input"));
    // the filled name is fine, the blank one is what the platform refused
    expect(first.hasAttribute("data-invalid")).toBe(false);
    expect(first.getAttribute("aria-invalid")).toBeNull();
    expect(last.hasAttribute("data-invalid")).toBe(true);
    expect(last.getAttribute("aria-invalid")).toBe("true");
    expect(last.getAttribute("aria-describedby")).toBe(message.id);
    expect(first.getAttribute("aria-describedby")).toBe(message.id);
  });

  test("shows no message element, and no marker, without a guests message", () => {
    renderPart(<Guests data-testid="part" />, {
      event: withGuests,
      errors: { first_name: "Enter your first name." },
    });
    expect(document.querySelector("[data-message]")).toBeNull();
    expect(screen.getByTestId("part").hasAttribute("data-invalid")).toBe(false);
  });
});

describe("on the canvas", () => {
  test("always shows one sample row, marked for styling, and the Add button", () => {
    for (const event of [withGuests, noGuests, undefined]) {
      const { container } = renderPart(<Guests data-testid="part" />, {
        renderer: "canvas",
        event,
      });
      const rows = container.querySelectorAll("[data-sample]");
      expect(rows).toHaveLength(1);
      expect(rows[0].querySelectorAll("input")).toHaveLength(2);
      expect(screen.getByRole("button", { name: "Add a guest" })).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Remove (guest 1)" })
      ).toBeTruthy();
      // the part itself is there to select, whatever the event
      expect(screen.getByTestId("part")).toBeTruthy();
      cleanup();
    }
  });

  test("the sample row is inert and collects nothing", () => {
    const view = renderPart(<Guests />, {
      renderer: "canvas",
      event: withGuests,
    });
    const inputs = Array.from(view.container.querySelectorAll("input"));
    expect(inputs.every((input) => input.readOnly)).toBe(true);
    expect(inputs.every((input) => input.value === "")).toBe(true);
    add();
    expect(view.container.querySelectorAll("[data-sample]")).toHaveLength(1);
    expect(view.container.querySelectorAll("input")).toHaveLength(2);
    expect(view.collect("guests")).toEqual([]);
  });
});

describe("when the form is reset", () => {
  test("the rows are gone and collect says so", () => {
    const view = renderPart(
      <form>
        <Guests />
        <button type="reset">Reset</button>
      </form>,
      { event: withGuests }
    );
    add();
    add();
    fill("guests.0.first_name", "Ada");
    fill("guests.1.last_name", "Babbage");
    expect(view.collect("guests")).toHaveLength(2);
    fireEvent.click(screen.getByText("Reset"));
    expect(view.container.querySelectorAll("input")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Add a guest" })).toBeTruthy();
    expect(view.collect("guests")).toEqual([]);
    // and a new row starts blank
    add();
    expect(
      (
        document.querySelector(
          'input[name="guests.0.first_name"]'
        ) as HTMLInputElement
      ).value
    ).toBe("");
  });
});
