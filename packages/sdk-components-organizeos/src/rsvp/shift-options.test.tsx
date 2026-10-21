/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import events from "../__fixtures__/events.json";
import requestFull from "../__fixtures__/rsvps/request-full.json";
import responseRoleFull from "../__fixtures__/rsvps/response-role-full.json";
import type { RsvpShift } from "./events-data";
import { fixtureEvent, makeEvent, renderPart } from "./parts-harness";
import { formatShiftTime, ShiftOptions } from "./shift-options";

const [voterDrive, , , canvassLaunch] = events.data;
const launch = fixtureEvent(canvassLaunch.id);
const [morning, afternoon] = launch.shifts;
const canvasserId = requestFull.shift_role_id;
const driverId = responseRoleFull.body.open_roles[0].id;

afterEach(cleanup);

/** Text as a browser shows it: every kind of space a plain space. */
const flat = (text: string | null | undefined) =>
  (text ?? "").replace(/\s+/g, " ").trim();

const shiftBox = (title: string) =>
  screen.getByRole("checkbox", { name: new RegExp(title) }) as HTMLInputElement;

const roleBox = (name: string) =>
  screen.getByRole("radio", { name }) as HTMLInputElement;

const makeShift = (
  id: string,
  overrides: Partial<RsvpShift> = {}
): RsvpShift => ({
  id,
  title: `Shift ${id}`,
  description: null,
  startTime: "2026-11-21T15:00:00+00:00",
  endTime: "2026-11-21T18:00:00+00:00",
  full: false,
  roles: [],
  ...overrides,
});

const role = (id: string, name: string, full = false) => ({
  id,
  name,
  description: null,
  full,
});

describe("formatShiftTime", () => {
  const start = "2026-11-21T19:00:00+00:00";
  const end = "2026-11-21T22:00:00+00:00";

  test("a range on one day names the day once and the zone once, in the event's zone", () => {
    expect(formatShiftTime(start, end, "America/Denver")).toBe(
      "Sat, Nov 21, 12:00 PM – 3:00 PM MST"
    );
    // the same instants an hour later on the east coast's clock (EST)
    expect(formatShiftTime(start, end, "America/New_York")).toBe(
      "Sat, Nov 21, 2:00 PM – 5:00 PM EST"
    );
  });

  test("a range that crosses midnight in the event's zone names both days", () => {
    expect(
      formatShiftTime(
        "2026-11-21T22:00:00+00:00",
        "2026-11-22T09:00:00+00:00",
        "America/Denver"
      )
    ).toBe("Sat, Nov 21, 3:00 PM – Sun, Nov 22, 2:00 AM MST");
  });

  test("a range that crosses midnight in UTC only is still one day in the event's zone", () => {
    expect(
      formatShiftTime(
        "2026-11-21T22:00:00+00:00",
        "2026-11-22T03:00:00+00:00",
        "America/Denver"
      )
    ).toBe("Sat, Nov 21, 3:00 PM – 8:00 PM MST");
  });

  test("the day is the event's, not the viewer's or UTC's", () => {
    // 02:00 UTC on the 22nd is still the 21st in Denver
    expect(
      formatShiftTime("2026-11-22T02:00:00+00:00", null, "America/Denver")
    ).toBe("Sat, Nov 21, 7:00 PM MST");
  });

  test("a shift with no end shows its start alone", () => {
    expect(formatShiftTime(start, null, "America/Denver")).toBe(
      "Sat, Nov 21, 12:00 PM MST"
    );
    expect(formatShiftTime(start, "not a date", "America/Denver")).toBe(
      "Sat, Nov 21, 12:00 PM MST"
    );
  });

  test("a shift with no readable start shows no time", () => {
    expect(formatShiftTime(null, end, "America/Denver")).toBeUndefined();
    expect(
      formatShiftTime("not a date", end, "America/Denver")
    ).toBeUndefined();
  });

  test("a missing or unknown zone reads as UTC, as the Time element does", () => {
    for (const zone of [null, "", "Mars/Olympus_Mons", "UTC"]) {
      expect(formatShiftTime(start, end, zone), String(zone)).toBe(
        "Sat, Nov 21, 7:00 PM – 10:00 PM UTC"
      );
    }
  });

  test("a zone given as an offset still reads", () => {
    expect(formatShiftTime(start, end, "+05:30")).toMatch(/12:30 AM – 3:30 AM/);
  });

  test("keeps to plain spaces, so the server's text and the browser's are the same", async () => {
    // Some ICU builds put a narrow no-break space before AM and PM and others
    // a plain space. Today's engines patch it to a plain one, so the engine is
    // made to emit the narrow one, in a fresh copy of the module (it keeps its
    // formatters by zone).
    const Real = Intl.DateTimeFormat;
    class Narrow {
      private real: Intl.DateTimeFormat;
      constructor(locale?: string, options?: Intl.DateTimeFormatOptions) {
        this.real = new Real(locale, options);
      }
      format(date: Date) {
        return this.real.format(date).replace(/ ([AP]M)/g, "\u202f$1");
      }
    }
    vi.resetModules();
    vi.stubGlobal(
      "Intl",
      Object.create(Intl, { DateTimeFormat: { value: Narrow } })
    );
    try {
      // the stand-in does what it is meant to
      expect(
        new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          timeZone: "UTC",
        }).format(new Date(start))
      ).toContain("\u202f");
      const fresh = await import("./shift-options");
      expect(fresh.formatShiftTime(start, end, "America/Denver")).toBe(
        "Sat, Nov 21, 12:00 PM – 3:00 PM MST"
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("on a published site", () => {
  test("lists a checkbox per shift, in the event's order, named for the endpoint", () => {
    const view = renderPart(<ShiftOptions />, { event: launch });
    const boxes = Array.from(
      view.container.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"]'
      )
    );
    expect(boxes.map((box) => box.value)).toEqual([morning.id, afternoon.id]);
    expect(boxes.every((box) => box.name === "shift_ids")).toBe(true);
    expect(view.container.querySelector('input[type="radio"]')).toBeNull();
  });

  test("shows each shift's title and its time range in the event's zone", () => {
    renderPart(<ShiftOptions />, { event: launch });
    expect(
      flat(
        screen.getByText("Afternoon canvass").parentElement?.textContent ?? ""
      )
    ).toBe("Afternoon canvass Sat, Nov 21, 12:00 PM – 3:00 PM MST");
    expect(
      flat(screen.getByText("Morning canvass").parentElement?.textContent ?? "")
    ).toBe("Morning canvass Sat, Nov 21, 8:00 AM – 11:00 AM MST");
    // a shift in another zone reads in that zone
    cleanup();
    renderPart(<ShiftOptions />, {
      event: makeEvent({
        timezone: "America/New_York",
        shifts: [
          makeShift("s1", {
            title: "Doors",
            startTime: "2026-11-21T19:00:00+00:00",
            endTime: "2026-11-21T22:00:00+00:00",
          }),
        ],
      }),
    });
    expect(flat(screen.getByText("Doors").parentElement?.textContent)).toBe(
      "Doors Sat, Nov 21, 2:00 PM – 5:00 PM EST"
    );
  });

  test("a shift with no readable time shows its title alone", () => {
    renderPart(<ShiftOptions />, {
      event: makeEvent({
        shifts: [makeShift("s1", { title: "Anytime", startTime: null })],
      }),
    });
    expect(flat(screen.getByText("Anytime").parentElement?.textContent)).toBe(
      "Anytime"
    );
  });

  test("a full shift is disabled and carries data-full; an open one does not", () => {
    const view = renderPart(<ShiftOptions />, { event: launch });
    expect(shiftBox("Morning canvass").disabled).toBe(true);
    expect(shiftBox("Afternoon canvass").disabled).toBe(false);
    const full = view.container.querySelectorAll("[data-full]");
    expect(full).toHaveLength(1);
    expect(full[0].contains(shiftBox("Morning canvass"))).toBe(true);
    expect(full[0].contains(shiftBox("Afternoon canvass"))).toBe(false);
    // a disabled box cannot be ticked
    fireEvent.click(shiftBox("Morning canvass"));
    expect(shiftBox("Morning canvass").checked).toBe(false);
    expect(view.collect("shifts")).toEqual({ shift_ids: [] });
  });

  test("the part carries data-full when every shift is full, and not otherwise", () => {
    const allFull = makeEvent({
      shifts: [
        makeShift("s1", { full: true }),
        makeShift("s2", { full: true }),
      ],
    });
    renderPart(<ShiftOptions data-testid="part" />, { event: allFull });
    expect(screen.getByTestId("part").hasAttribute("data-full")).toBe(true);
    cleanup();
    renderPart(<ShiftOptions data-testid="part" />, { event: launch });
    expect(screen.getByTestId("part").hasAttribute("data-full")).toBe(false);
  });

  test("ticking the one shift with roles shows its roles as a radio group", () => {
    renderPart(<ShiftOptions />, { event: launch });
    expect(screen.queryByRole("radiogroup")).toBeNull();
    fireEvent.click(shiftBox("Afternoon canvass"));
    const group = screen.getByRole("radiogroup", {
      name: "Role for Afternoon canvass",
    });
    const radios = Array.from(group.querySelectorAll("input"));
    expect(radios.map((radio) => radio.value)).toEqual([canvasserId, driverId]);
    expect(radios.every((radio) => radio.name === "shift_role_id")).toBe(true);
    // the data marks Driver full: it cannot be picked, and says so
    expect(roleBox("Canvasser").disabled).toBe(false);
    expect(roleBox("Driver").disabled).toBe(true);
    expect(roleBox("Driver").closest("[data-full]")).not.toBeNull();
    expect(roleBox("Canvasser").closest("[data-full]")).toBeNull();
  });

  test("collect returns the shifts and the role of request-full.json", () => {
    const view = renderPart(<ShiftOptions />, {
      event: fixtureEvent(requestFull.event_id),
    });
    fireEvent.click(shiftBox("Afternoon canvass"));
    fireEvent.click(roleBox("Canvasser"));
    expect(roleBox("Canvasser").checked).toBe(true);
    expect(view.collect("shifts")).toEqual({
      shift_ids: requestFull.shift_ids,
      shift_role_id: requestFull.shift_role_id,
    });
  });

  test("unticking the shift removes the roles, and the role with them", () => {
    const view = renderPart(<ShiftOptions />, { event: launch });
    fireEvent.click(shiftBox("Afternoon canvass"));
    fireEvent.click(roleBox("Canvasser"));
    fireEvent.click(shiftBox("Afternoon canvass"));
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(view.collect("shifts")).toEqual({ shift_ids: [] });
    // ticking it again does not bring the old role back
    fireEvent.click(shiftBox("Afternoon canvass"));
    expect(roleBox("Canvasser").checked).toBe(false);
    expect(view.collect("shifts")).toEqual({ shift_ids: [afternoon.id] });
  });

  test("a role belongs to its shift: moving to another shift drops it", () => {
    const event = makeEvent({
      shifts: [
        makeShift("a", {
          title: "Shift A",
          roles: [role("a1", "Lead"), role("a2", "Helper")],
        }),
        makeShift("b", { title: "Shift B", roles: [role("b1", "Greeter")] }),
      ],
    });
    const view = renderPart(<ShiftOptions />, { event });
    fireEvent.click(shiftBox("Shift A"));
    fireEvent.click(roleBox("Lead"));
    fireEvent.click(shiftBox("Shift A"));
    fireEvent.click(shiftBox("Shift B"));
    expect(
      screen.getByRole("radiogroup", { name: "Role for Shift B" })
    ).toBeTruthy();
    expect(roleBox("Greeter").checked).toBe(false);
    expect(view.collect("shifts")).toEqual({ shift_ids: ["b"] });
  });

  test("with two shifts ticked there is no role group, and no role is sent", () => {
    const event = makeEvent({
      shifts: [
        makeShift("a", { title: "Shift A", roles: [role("a1", "Lead")] }),
        makeShift("b", { title: "Shift B", roles: [role("b1", "Greeter")] }),
      ],
    });
    const view = renderPart(<ShiftOptions />, { event });
    fireEvent.click(shiftBox("Shift A"));
    fireEvent.click(roleBox("Lead"));
    fireEvent.click(shiftBox("Shift B"));
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(view.collect("shifts")).toEqual({ shift_ids: ["a", "b"] });
  });

  test("a shift with no roles shows no role group", () => {
    const view = renderPart(<ShiftOptions />, {
      event: makeEvent({ shifts: [makeShift("a", { title: "Shift A" })] }),
    });
    fireEvent.click(shiftBox("Shift A"));
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(view.collect("shifts")).toEqual({ shift_ids: ["a"] });
  });

  test("shift ids come back in the event's order, whatever order they were ticked in", () => {
    const event = makeEvent({
      shifts: [makeShift("a"), makeShift("b"), makeShift("c")],
    });
    const view = renderPart(<ShiftOptions />, { event });
    fireEvent.click(shiftBox("Shift c"));
    fireEvent.click(shiftBox("Shift a"));
    expect(view.collect("shifts")).toEqual({ shift_ids: ["a", "c"] });
  });

  test("collect is a stable function, so the part registers once", () => {
    const view = renderPart(<ShiftOptions />, { event: launch });
    const first = Array.from(view.registered.values())[0].collect;
    fireEvent.click(shiftBox("Afternoon canvass"));
    fireEvent.click(roleBox("Canvasser"));
    expect(view.registered.size).toBe(1);
    expect(Array.from(view.registered.values())[0].collect).toBe(first);
  });

  test("at most 50 shifts can be ticked, the most the endpoint takes: the rest are disabled", () => {
    const shifts = Array.from({ length: 60 }, (_, index) =>
      makeShift(`s${String(index).padStart(2, "0")}`)
    );
    const view = renderPart(<ShiftOptions />, {
      event: makeEvent({ shifts }),
    });
    for (const box of screen.getAllByRole("checkbox")) {
      // a visitor cannot click a disabled box
      if (!(box as HTMLInputElement).disabled) {
        fireEvent.click(box);
      }
    }
    const sent = view.collect("shifts") as { shift_ids: string[] };
    expect(sent.shift_ids).toHaveLength(50);
    expect(sent.shift_ids[0]).toBe("s00");
    expect(sent.shift_ids[49]).toBe("s49");
    // what is shown ticked is what is sent: the 51st is not left looking ticked
    expect(shiftBox("Shift s49").checked).toBe(true);
    expect(shiftBox("Shift s50").checked).toBe(false);
    expect(shiftBox("Shift s50").disabled).toBe(true);
    expect(
      screen
        .getAllByRole("checkbox")
        .filter((box) => (box as HTMLInputElement).checked)
    ).toHaveLength(50);
    // the ticked ones stay enabled, so one can be unticked to make room
    expect(shiftBox("Shift s49").disabled).toBe(false);
    // a full shift is the data's, not the limit's
    expect(
      shiftBox("Shift s50").closest("[data-full]")?.hasAttribute("data-full")
    ).toBeFalsy();
    fireEvent.click(shiftBox("Shift s00"));
    expect(shiftBox("Shift s50").disabled).toBe(false);
    fireEvent.click(shiftBox("Shift s50"));
    const next = view.collect("shifts") as { shift_ids: string[] };
    expect(next.shift_ids).toHaveLength(50);
    expect(next.shift_ids).toContain("s50");
    expect(next.shift_ids).not.toContain("s00");
  });

  test("a shift that the data now says is full is shown unticked and not sent", () => {
    const view = renderPart(<ShiftOptions />, { event: launch });
    fireEvent.click(shiftBox("Afternoon canvass"));
    const nowFull = {
      ...launch,
      shifts: [morning, { ...afternoon, full: true }],
    };
    view.rerender(<ShiftOptions />, { event: nowFull });
    expect(shiftBox("Afternoon canvass").checked).toBe(false);
    expect(shiftBox("Afternoon canvass").disabled).toBe(true);
    expect(view.collect("shifts")).toEqual({ shift_ids: [] });
  });

  test("a shift that is gone from the data is not sent", () => {
    const view = renderPart(<ShiftOptions />, { event: launch });
    fireEvent.click(shiftBox("Afternoon canvass"));
    view.rerender(<ShiftOptions />, {
      event: { ...launch, shifts: [morning] },
    });
    expect(view.collect("shifts")).toEqual({ shift_ids: [] });
  });

  test("renders nothing for an event with no shifts, or no event", () => {
    const first = renderPart(<ShiftOptions />, {
      event: fixtureEvent(voterDrive.id),
    });
    expect(first.container.innerHTML).toBe("");
    // and still registers, with nothing to collect
    expect(first.collect("shifts")).toEqual({ shift_ids: [] });
    cleanup();
    const second = renderPart(<ShiftOptions />, { event: undefined });
    expect(second.container.innerHTML).toBe("");
  });

  test("the preview behaves as the published site", () => {
    const { container } = renderPart(<ShiftOptions />, {
      renderer: "preview",
      event: fixtureEvent(voterDrive.id),
    });
    expect(container.innerHTML).toBe("");
  });

  test("passes the designer's props to its element", () => {
    renderPart(<ShiftOptions className="shifts" data-testid="part" />, {
      event: launch,
    });
    expect(screen.getByTestId("part").className).toBe("shifts");
  });
});

describe("the roles a role_full answer found", () => {
  const pick = () => {
    const view = renderPart(<ShiftOptions />, { event: launch });
    fireEvent.click(shiftBox("Afternoon canvass"));
    return view;
  };

  test("a role the answer found full is disabled, whatever the data says", () => {
    const view = pick();
    fireEvent.click(roleBox("Canvasser"));
    view.rerender(<ShiftOptions />, {
      event: launch,
      fullRoleIds: [canvasserId],
      openRoleIds: [driverId],
    });
    expect(roleBox("Canvasser").disabled).toBe(true);
    // and the role the visitor had picked is no longer picked or sent
    expect(roleBox("Canvasser").checked).toBe(false);
    expect(view.collect("shifts")).toEqual({ shift_ids: [afternoon.id] });
  });

  test("a role the answer found with room is enabled, though the snapshot says full", () => {
    // the data marks Driver full; the answer to request-full.json lists it open
    const view = pick();
    expect(roleBox("Driver").disabled).toBe(true);
    view.rerender(<ShiftOptions />, {
      event: launch,
      fullRoleIds: [canvasserId],
      openRoleIds: [driverId],
    });
    expect(roleBox("Driver").disabled).toBe(false);
    fireEvent.click(roleBox("Driver"));
    expect(view.collect("shifts")).toEqual({
      shift_ids: [afternoon.id],
      shift_role_id: driverId,
    });
  });

  test("an answer that lists no open role disables them all", () => {
    const view = pick();
    view.rerender(<ShiftOptions />, {
      event: launch,
      fullRoleIds: [canvasserId, driverId],
    });
    expect(roleBox("Canvasser").disabled).toBe(true);
    expect(roleBox("Driver").disabled).toBe(true);
  });

  test("a role the answer says nothing about follows the data", () => {
    const view = pick();
    view.rerender(<ShiftOptions />, {
      event: launch,
      fullRoleIds: [canvasserId],
    });
    expect(roleBox("Driver").disabled).toBe(true);
  });
});

describe("the messages", () => {
  test("show the shift and role messages, marked for styling, and flag the controls", () => {
    const view = renderPart(<ShiftOptions data-testid="part" />, {
      event: launch,
      errors: {
        shift_ids: "Check the shifts you picked.",
        shift_role_id: "That role just filled. Pick another.",
        guests: "elsewhere",
      },
    });
    fireEvent.click(shiftBox("Afternoon canvass"));
    const shiftMessage = screen.getByText("Check the shifts you picked.");
    const roleMessage = screen.getByText(
      "That role just filled. Pick another."
    );
    for (const message of [shiftMessage, roleMessage]) {
      expect(message.hasAttribute("data-message")).toBe(true);
      expect(message.hasAttribute("data-invalid")).toBe(true);
    }
    expect(screen.queryByText("elsewhere")).toBeNull();
    expect(screen.getByTestId("part").hasAttribute("data-invalid")).toBe(true);
    const boxes = view.container.querySelectorAll('input[type="checkbox"]');
    for (const box of boxes) {
      expect(box.getAttribute("aria-invalid")).toBe("true");
      expect(box.hasAttribute("data-invalid")).toBe(true);
      expect(box.getAttribute("aria-describedby")).toBe(shiftMessage.id);
    }
    const group = screen.getByRole("radiogroup");
    expect(group.getAttribute("aria-invalid")).toBe("true");
    expect(group.hasAttribute("data-invalid")).toBe(true);
    expect(group.getAttribute("aria-describedby")).toBe(roleMessage.id);
    expect(shiftMessage.id).not.toBe(roleMessage.id);
  });

  test("a role message alone marks the role group and not the shifts", () => {
    renderPart(<ShiftOptions />, {
      event: launch,
      errors: { shift_role_id: "That role just filled. Pick another." },
    });
    fireEvent.click(shiftBox("Afternoon canvass"));
    expect(shiftBox("Afternoon canvass").hasAttribute("aria-invalid")).toBe(
      false
    );
    expect(screen.getByRole("radiogroup").getAttribute("aria-invalid")).toBe(
      "true"
    );
  });

  test("without a message there is no message element and no marker", () => {
    renderPart(<ShiftOptions data-testid="part" />, {
      event: launch,
      errors: { email: "Enter a valid email address." },
    });
    expect(document.querySelector("[data-message]")).toBeNull();
    expect(screen.getByTestId("part").hasAttribute("data-invalid")).toBe(false);
  });
});

describe("on the canvas", () => {
  test("shows the event's shifts as it would live, and never data-sample", () => {
    const { container } = renderPart(<ShiftOptions data-testid="part" />, {
      renderer: "canvas",
      event: launch,
    });
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(
      2
    );
    expect(container.querySelector("[data-sample]")).toBeNull();
  });

  test("is there to select when the event has no shifts or there is no event", () => {
    for (const event of [fixtureEvent(voterDrive.id), undefined]) {
      renderPart(<ShiftOptions data-testid="part" />, {
        renderer: "canvas",
        event,
      });
      expect(screen.getByTestId("part")).toBeTruthy();
      cleanup();
    }
  });
});

describe("when the form is reset", () => {
  const Form = () => (
    <form>
      <ShiftOptions />
      <button type="reset">Reset</button>
    </form>
  );

  test("the shifts are unticked, the role is dropped and collect says so", () => {
    // The browser unticks the boxes without an onChange, so what collect
    // says has to follow the reset.
    const view = renderPart(<Form />, { event: launch });
    fireEvent.click(shiftBox("Afternoon canvass"));
    fireEvent.click(roleBox("Canvasser"));
    expect(view.collect("shifts")).toEqual({
      shift_ids: [afternoon.id],
      shift_role_id: canvasserId,
    });
    fireEvent.click(screen.getByText("Reset"));
    expect(shiftBox("Afternoon canvass").checked).toBe(false);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(view.collect("shifts")).toEqual({ shift_ids: [] });
    // ticking again starts from nothing: no role comes back with the shift
    fireEvent.click(shiftBox("Afternoon canvass"));
    expect(roleBox("Canvasser").checked).toBe(false);
    expect(view.collect("shifts")).toEqual({ shift_ids: [afternoon.id] });
  });

  test("several ticked shifts are all unticked", () => {
    const event = makeEvent({
      shifts: [makeShift("a"), makeShift("b"), makeShift("c")],
    });
    const view = renderPart(<Form />, { event });
    fireEvent.click(shiftBox("Shift a"));
    fireEvent.click(shiftBox("Shift c"));
    expect(view.collect("shifts")).toEqual({ shift_ids: ["a", "c"] });
    fireEvent.click(screen.getByText("Reset"));
    expect(
      screen
        .getAllByRole("checkbox")
        .some((box) => (box as HTMLInputElement).checked)
    ).toBe(false);
    expect(view.collect("shifts")).toEqual({ shift_ids: [] });
  });

  test("a part that was not in a form is not harmed by one around it elsewhere", () => {
    const view = renderPart(
      <>
        <ShiftOptions />
        <form>
          <button type="reset">Reset</button>
        </form>
      </>,
      { event: launch }
    );
    fireEvent.click(shiftBox("Afternoon canvass"));
    fireEvent.click(screen.getByText("Reset"));
    expect(view.collect("shifts")).toEqual({ shift_ids: [afternoon.id] });
  });
});
