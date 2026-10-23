/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import events from "../__fixtures__/events.json";
import requestFull from "../__fixtures__/rsvps/request-full.json";
import type { RsvpQuestion } from "./events-data";
import { fixtureEvent, makeEvent, renderPart } from "./parts-harness";
import { Questions } from "./questions";

const [voterDrive, , , canvassLaunch] = events.data;
const launch = fixtureEvent(canvassLaunch.id);
const [howHeard, anything, years, trainingDate, tShirt, languages, conduct] =
  launch.questions;

afterEach(cleanup);

const makeQuestion = (
  id: string,
  overrides: Partial<RsvpQuestion> = {}
): RsvpQuestion => ({
  id,
  label: `Question ${id}`,
  helpText: null,
  type: "text",
  required: false,
  options: [],
  ...overrides,
});

/** The control a question is named after, by the name it submits under. */
const control = (container: HTMLElement, questionId: string) => {
  const found = container.querySelectorAll<HTMLInputElement>(
    `[name="answers.${questionId}"]`
  );
  if (found.length === 0) {
    throw new Error(`no control for ${questionId}`);
  }
  return found[0];
};

const set = (container: HTMLElement, questionId: string, value: string) =>
  fireEvent.change(control(container, questionId), { target: { value } });

const tick = (name: RegExp | string) =>
  fireEvent.click(screen.getByRole("checkbox", { name }));

const questionOf = (container: HTMLElement, questionId: string) => {
  const found = control(container, questionId).closest("[data-question]");
  if (found === null) {
    throw new Error(`no question around ${questionId}`);
  }
  return found as HTMLElement;
};

describe("on a published site", () => {
  test("asks every question, in the event's order, each with its label", () => {
    const { container } = renderPart(<Questions />, { event: launch });
    const asked = Array.from(container.querySelectorAll("[data-question]"));
    expect(asked).toHaveLength(7);
    expect(asked.map((item) => item.getAttribute("data-type"))).toEqual([
      "text",
      "textarea",
      "number",
      "date",
      "select",
      "multiselect",
      "checkbox",
    ]);
    expect(screen.getByLabelText(/^How did you hear about us\?/)).toBe(
      control(container, howHeard.id)
    );
  });

  test("the control follows the question's type", () => {
    const { container } = renderPart(<Questions />, { event: launch });
    const text = control(container, howHeard.id);
    expect(text.tagName).toBe("INPUT");
    expect(text.getAttribute("type")).toBe("text");
    expect(control(container, anything.id).tagName).toBe("TEXTAREA");
    expect(control(container, years.id).getAttribute("type")).toBe("number");
    expect(control(container, years.id).getAttribute("step")).toBe("any");
    expect(control(container, trainingDate.id).getAttribute("type")).toBe(
      "date"
    );
    const select = control(container, tShirt.id);
    expect(select.tagName).toBe("SELECT");
    expect(
      Array.from((select as unknown as HTMLSelectElement).options).map(
        (option) => option.value
      )
    ).toEqual(["", "S", "M", "L", "XL"]);
    expect(
      (select as unknown as HTMLSelectElement).options[0].textContent
    ).toBe("Select...");
    // a multiselect is a checkbox for each option, in a labelled group
    const languagesGroup = screen.getByRole("group", {
      name: /^Languages you speak/,
    });
    expect(
      within(languagesGroup)
        .getAllByRole("checkbox")
        .map((box) => [box.getAttribute("name"), box.getAttribute("value")])
    ).toEqual([
      [`answers.${languages.id}`, "English"],
      [`answers.${languages.id}`, "Spanish"],
      [`answers.${languages.id}`, "Mandarin"],
    ]);
    expect(
      within(languagesGroup).getByRole("checkbox", { name: "Spanish" })
    ).toBeTruthy();
    // and a checkbox question is one Yes box under the question
    const conductGroup = screen.getByRole("group", {
      name: /code of conduct/,
    });
    const yes = within(conductGroup).getByRole("checkbox", { name: "Yes" });
    expect(yes.getAttribute("name")).toBe(`answers.${conduct.id}`);
  });

  test("marks the required questions, and sets required on a control that can carry it", () => {
    const { container } = renderPart(<Questions />, { event: launch });
    const markers = container.querySelectorAll("[data-required]");
    expect(markers).toHaveLength(2);
    for (const marker of markers) {
      expect(marker.getAttribute("aria-hidden")).toBe("true");
      expect(marker.textContent).toBe(" *");
    }
    expect(
      questionOf(container, tShirt.id).querySelector("[data-required]")
    ).not.toBeNull();
    expect(
      questionOf(container, conduct.id).querySelector("[data-required]")
    ).not.toBeNull();
    expect(
      questionOf(container, howHeard.id).querySelector("[data-required]")
    ).toBeNull();
    expect(control(container, tShirt.id).hasAttribute("required")).toBe(true);
    expect(control(container, conduct.id).hasAttribute("required")).toBe(true);
    expect(control(container, howHeard.id).hasAttribute("required")).toBe(
      false
    );
    // the marker is not part of a control's name
    expect(screen.getByRole("combobox", { name: "T-shirt size" })).toBeTruthy();
  });

  test("a required multiselect leaves required off its boxes: every one would have to be ticked", () => {
    const event = makeEvent({
      questions: [
        makeQuestion("m", {
          type: "multiselect",
          required: true,
          options: ["A", "B"],
        }),
      ],
    });
    const { container } = renderPart(<Questions />, { event });
    for (const box of container.querySelectorAll("input")) {
      expect(box.hasAttribute("required")).toBe(false);
    }
    // no control carries the requirement, so the marker is how it is announced
    const marker = container.querySelector("[data-required]");
    expect(marker).not.toBeNull();
    expect(marker?.hasAttribute("aria-hidden")).toBe(false);
    expect(screen.getByRole("group", { name: "Question m *" })).toBeTruthy();
  });

  test("shows the help text and ties it to the control", () => {
    const { container } = renderPart(<Questions />, { event: launch });
    const help = screen.getByText(
      "Access needs, dietary needs, or anything else."
    );
    expect(help.hasAttribute("data-help")).toBe(true);
    expect(
      control(container, anything.id).getAttribute("aria-describedby")
    ).toBe(help.id);
    // a question with none has no help element
    expect(
      questionOf(container, howHeard.id).querySelector("[data-help]")
    ).toBeNull();
    expect(
      control(container, howHeard.id).hasAttribute("aria-describedby")
    ).toBe(false);
    // a group's help is the group's description
    const unisex = screen.getByText("Unisex sizing.");
    expect(control(container, tShirt.id).getAttribute("aria-describedby")).toBe(
      unisex.id
    );
  });

  test("text and textarea stop at 2000 characters", () => {
    const { container } = renderPart(<Questions />, { event: launch });
    expect(control(container, howHeard.id).getAttribute("maxlength")).toBe(
      "2000"
    );
    expect(control(container, anything.id).getAttribute("maxlength")).toBe(
      "2000"
    );
  });

  test("collect returns the answers of request-full.json, serialized as Website Lite sends them", () => {
    const { container, collect } = renderPart(<Questions />, {
      event: fixtureEvent(requestFull.event_id),
    });
    for (const [questionId, answer] of Object.entries(requestFull.answers)) {
      if (questionId === languages.id) {
        for (const option of JSON.parse(answer) as string[]) {
          tick(option);
        }
      } else if (questionId === conduct.id) {
        tick("Yes");
      } else {
        set(container, questionId, answer);
      }
    }
    expect(collect("questions")).toEqual(requestFull.answers);
    // the multiselect is a JSON array of strings, the checkbox "true"
    const answers = collect("questions") as Record<string, string>;
    expect(answers[languages.id]).toBe('["English","Spanish"]');
    expect(answers[conduct.id]).toBe("true");
  });

  test("collect leaves out a blank optional answer and keeps a blank required one", () => {
    const { collect } = renderPart(<Questions />, { event: launch });
    // nothing answered: only the two required questions are sent, empty
    expect(collect("questions")).toEqual({
      [tShirt.id]: "",
      [conduct.id]: "false",
    });
  });

  test("an unticked optional checkbox is no answer; a ticked one is true", () => {
    const event = makeEvent({
      questions: [makeQuestion("c", { type: "checkbox" })],
    });
    const { collect } = renderPart(<Questions />, { event });
    expect(collect("questions")).toEqual({});
    tick("Yes");
    expect(collect("questions")).toEqual({ c: "true" });
    tick("Yes");
    expect(collect("questions")).toEqual({});
  });

  test("a multiselect is sent in the question's option order, whatever order it was ticked in", () => {
    const { collect } = renderPart(<Questions />, { event: launch });
    tick("Mandarin");
    tick("English");
    expect((collect("questions") as Record<string, string>)[languages.id]).toBe(
      '["English","Mandarin"]'
    );
    tick("English");
    tick("Mandarin");
    // nothing ticked: an optional multiselect is no answer
    expect(collect("questions")).not.toHaveProperty(languages.id);
  });

  test("a required multiselect with nothing ticked is sent as an empty list", () => {
    const event = makeEvent({
      questions: [
        makeQuestion("m", {
          type: "multiselect",
          required: true,
          options: ["A", "B"],
        }),
      ],
    });
    const { collect } = renderPart(<Questions />, { event });
    expect(collect("questions")).toEqual({ m: "[]" });
    tick("B");
    expect(collect("questions")).toEqual({ m: '["B"]' });
  });

  test("typed text is sent as typed; spaces alone are no optional answer, and are kept for a required one", () => {
    const event = makeEvent({
      questions: [
        makeQuestion("a"),
        makeQuestion("b"),
        makeQuestion("r", { required: true }),
      ],
    });
    const { container, collect } = renderPart(<Questions />, { event });
    set(container, "a", "  Ada ");
    set(container, "b", "   ");
    set(container, "r", "  ");
    expect(collect("questions")).toEqual({ a: "  Ada ", r: "  " });
  });

  test("a number is sent as a plain decimal: the browser accepts an exponent the platform refuses", () => {
    const event = makeEvent({
      questions: [makeQuestion("n", { type: "number" })],
    });
    const { container, collect } = renderPart(<Questions />, { event });
    const answers: [string, string][] = [
      ["1e3", "1000"],
      ["1E3", "1000"],
      ["-2.5e2", "-250"],
      ["1.5e-3", "0.0015"],
      // already plain: sent as typed
      ["12.50", "12.50"],
      ["-3", "-3"],
      [".5", ".5"],
    ];
    for (const [typed, sent] of answers) {
      set(container, "n", typed);
      expect(collect("questions")).toEqual({ n: sent });
    }
  });

  test("a number with an exponent is written out digit for digit: what a double cannot hold is not rounded or lost", () => {
    const event = makeEvent({
      questions: [makeQuestion("n", { type: "number" })],
    });
    const { container, collect } = renderPart(<Questions />, { event });
    const answers: [string, string][] = [
      ["1e-30", "0.000000000000000000000000000001"],
      // past a double's range, and still exactly the number typed
      ["1e-400", `0.${"0".repeat(399)}1`],
      ["-1e-400", `-0.${"0".repeat(399)}1`],
      // past a double's 17 digits
      ["123456789012345678901e0", "123456789012345678901"],
      ["1.00000000000000000001e0", "1.00000000000000000001"],
      ["1.5e-3", "0.0015"],
      ["100e-2", "1"],
      [".5e1", "5"],
      ["0e5", "0"],
      // a number input holds only a number a double can tell from infinity, so
      // 1e400 never reaches the part; one that fits a double is written whole
      ["1e300", `1${"0".repeat(300)}`],
    ];
    for (const [typed, sent] of answers) {
      set(container, "n", typed);
      expect(collect("questions")).toEqual({ n: sent });
    }
  });

  test("a number that cannot be written out in the 5000 characters the endpoint takes is sent as typed, never cut or changed", () => {
    const event = makeEvent({
      questions: [makeQuestion("n", { type: "number" })],
    });
    const { container, collect } = renderPart(<Questions />, { event });
    // written out it would be 5001 characters (a double calls it 0)
    set(container, "n", "1e-4999");
    expect(collect("questions")).toEqual({ n: "1e-4999" });
    // and one place less fits, to the character
    set(container, "n", "1e-4998");
    expect(collect("questions")).toEqual({ n: `0.${"0".repeat(4997)}1` });
    // plain, and too long: cut it and it would be another number
    const long = `0.${"0".repeat(5500)}1`;
    set(container, "n", long);
    expect(collect("questions")).toEqual({ n: long });
  });

  test("a select answer that is not an option any more is no answer", () => {
    const event = makeEvent({
      questions: [makeQuestion("s", { type: "select", options: ["S", "M"] })],
    });
    const view = renderPart(<Questions />, { event });
    set(view.container, "s", "M");
    expect(view.collect("questions")).toEqual({ s: "M" });
    view.rerender(<Questions />, {
      event: makeEvent({
        questions: [makeQuestion("s", { type: "select", options: ["S"] })],
      }),
    });
    expect(view.collect("questions")).toEqual({});
  });

  test("collect bounds what it returns: 5000 characters an answer and 100 answers", () => {
    const { container, collect } = renderPart(<Questions />, {
      event: makeEvent({
        questions: [makeQuestion("long", { type: "textarea" })],
      }),
    });
    // set another way than typing, which maxlength does not stop
    set(container, "long", "x".repeat(6000));
    expect((collect("questions") as Record<string, string>).long).toHaveLength(
      5000
    );
    cleanup();
    const many = renderPart(<Questions />, {
      event: makeEvent({
        questions: Array.from({ length: 120 }, (_, index) =>
          makeQuestion(`q${String(index).padStart(3, "0")}`, { required: true })
        ),
      }),
    });
    const sent = Object.keys(many.collect("questions") as object);
    expect(sent).toHaveLength(100);
    expect(sent[0]).toBe("q000");
    expect(sent[99]).toBe("q099");
  });

  test("past 100 answers the required ones are kept first, so the platform is never told one is missing", () => {
    // 110 optional answers and a required question after them: cutting at
    // 100 in the event's order would drop the required one every time.
    const ids = Array.from(
      { length: 120 },
      (_, index) => `q${String(index).padStart(3, "0")}`
    );
    const { container, collect } = renderPart(<Questions />, {
      event: makeEvent({
        questions: ids.map((id, index) =>
          makeQuestion(id, { required: index === 110 || index === 115 })
        ),
      }),
    });
    for (const id of ids.slice(0, 110)) {
      set(container, id, "yes");
    }
    set(container, "q110", "needed");
    const sent = collect("questions") as Record<string, string>;
    const keys = Object.keys(sent);
    expect(keys).toHaveLength(100);
    // both required ones, one answered and one blank
    expect(sent.q110).toBe("needed");
    expect(sent.q115).toBe("");
    // the rest are the first optional ones, still in the event's order
    expect(keys.slice(0, 98)).toEqual(ids.slice(0, 98));
    expect(keys.slice(98)).toEqual(["q110", "q115"]);
    expect(sent.q097).toBe("yes");
    expect(sent).not.toHaveProperty("q098");
  });

  test("100 answers or fewer are sent whole, required or not", () => {
    const ids = Array.from({ length: 100 }, (_, index) => `q${index}`);
    const { container, collect } = renderPart(<Questions />, {
      event: makeEvent({
        questions: ids.map((id, index) =>
          makeQuestion(id, { required: index === 99 })
        ),
      }),
    });
    for (const id of ids.slice(0, 99)) {
      set(container, id, "yes");
    }
    expect(Object.keys(collect("questions") as object)).toEqual(ids);
  });

  test("a multiselect stops taking options once the answer would be too long to send: what is ticked is what is sent", () => {
    // 600 characters each: eight fit in the 5000 the endpoint takes, a ninth does not
    const options = Array.from({ length: 10 }, (_, index) =>
      `${index}`.repeat(600)
    );
    const { collect } = renderPart(<Questions />, {
      event: makeEvent({
        questions: [makeQuestion("m", { type: "multiselect", options })],
      }),
    });
    for (const box of screen.getAllByRole("checkbox")) {
      // a visitor cannot click a disabled box
      if (!(box as HTMLInputElement).disabled) {
        fireEvent.click(box);
      }
    }
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    const sent = (collect("questions") as Record<string, string>).m;
    expect(sent.length).toBeLessThanOrEqual(5000);
    const parsed = JSON.parse(sent) as string[];
    expect(parsed).toEqual(options.slice(0, 8));
    // every box that shows ticked is in the list, and the first that would not fit is not
    expect(boxes.filter((box) => box.checked).map((box) => box.value)).toEqual(
      parsed
    );
    expect(boxes[8].checked).toBe(false);
    expect(boxes[8].disabled).toBe(true);
    // the ticked ones stay enabled, so one can be unticked to make room
    expect(boxes[7].disabled).toBe(false);
    fireEvent.click(boxes[0]);
    expect(boxes[8].disabled).toBe(false);
    fireEvent.click(boxes[8]);
    const next = JSON.parse(
      (collect("questions") as Record<string, string>).m
    ) as string[];
    expect(next).toEqual(options.slice(1, 9));
    expect(boxes[9].disabled).toBe(true);
  });

  test("an option too long to ever be sent is not offered", () => {
    const { collect } = renderPart(<Questions />, {
      event: makeEvent({
        questions: [
          makeQuestion("m", {
            type: "multiselect",
            options: ["a".repeat(5000), "fine"],
          }),
        ],
      }),
    });
    const [long, fine] = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(long.disabled).toBe(true);
    expect(fine.disabled).toBe(false);
    fireEvent.click(fine);
    expect(collect("questions")).toEqual({ m: '["fine"]' });
  });

  test("collect is a stable function, so the part registers once", () => {
    const view = renderPart(<Questions />, { event: launch });
    const first = Array.from(view.registered.values())[0].collect;
    set(view.container, howHeard.id, "A friend");
    tick("Spanish");
    expect(view.registered.size).toBe(1);
    expect(Array.from(view.registered.values())[0].collect).toBe(first);
  });

  test("renders nothing for an event with no questions, or no event, but still registers", () => {
    const first = renderPart(<Questions />, {
      event: fixtureEvent(voterDrive.id),
    });
    expect(first.container.innerHTML).toBe("");
    expect(first.collect("questions")).toEqual({});
    cleanup();
    const second = renderPart(<Questions />, { event: undefined });
    expect(second.container.innerHTML).toBe("");
  });

  test("the preview behaves as the published site", () => {
    const { container } = renderPart(<Questions />, {
      renderer: "preview",
      event: fixtureEvent(voterDrive.id),
    });
    expect(container.innerHTML).toBe("");
  });

  test("passes the designer's props to its element", () => {
    renderPart(<Questions className="asks" data-testid="part" />, {
      event: launch,
    });
    expect(screen.getByTestId("part").className).toBe("asks");
  });
});

describe("the messages", () => {
  const errors = {
    [`answers.${tShirt.id}`]: "Check this answer.",
    [`answers.${conduct.id}`]: "Check this answer.",
    guests: "elsewhere",
  };

  test("show under the question the platform refused, marked for styling, and flag its control", () => {
    const { container } = renderPart(<Questions data-testid="part" />, {
      event: launch,
      errors: { [`answers.${tShirt.id}`]: "Check this answer." },
    });
    const tShirtQuestion = questionOf(container, tShirt.id);
    const message = within(tShirtQuestion).getByText("Check this answer.");
    expect(message.hasAttribute("data-message")).toBe(true);
    expect(message.hasAttribute("data-invalid")).toBe(true);
    expect(tShirtQuestion.hasAttribute("data-invalid")).toBe(true);
    const select = control(container, tShirt.id);
    expect(select.getAttribute("aria-invalid")).toBe("true");
    expect(select.hasAttribute("data-invalid")).toBe(true);
    // the help text and the message both describe it
    const unisex = screen.getByText("Unisex sizing.");
    expect(select.getAttribute("aria-describedby")).toBe(
      `${unisex.id} ${message.id}`
    );
    expect(screen.getByTestId("part").hasAttribute("data-invalid")).toBe(true);
    // the other questions are untouched
    expect(
      questionOf(container, howHeard.id).hasAttribute("data-invalid")
    ).toBe(false);
    expect(container.querySelectorAll("[data-message]")).toHaveLength(1);
  });

  test("a group question is flagged on the group, and the message is in it", () => {
    const { container } = renderPart(<Questions />, {
      event: launch,
      errors,
    });
    expect(screen.queryByText("elsewhere")).toBeNull();
    const group = screen.getByRole("group", { name: /code of conduct/ });
    const question = questionOf(container, conduct.id);
    const message = question.querySelector("[data-message]");
    expect(message).not.toBeNull();
    expect(question.hasAttribute("data-invalid")).toBe(true);
    expect(group.getAttribute("aria-describedby")).toBe(message?.id);
    // the boxes carry the invalid state; a group role cannot
    const yes = within(group).getByRole("checkbox", { name: "Yes" });
    expect(yes.getAttribute("aria-invalid")).toBe("true");
    expect(yes.hasAttribute("data-invalid")).toBe(true);
    expect(group.hasAttribute("aria-invalid")).toBe(false);
  });

  test("without a message for any question there is no message element and no marker", () => {
    renderPart(<Questions data-testid="part" />, {
      event: launch,
      errors: { email: "Enter a valid email address." },
    });
    expect(document.querySelector("[data-message]")).toBeNull();
    expect(document.querySelector("[data-invalid]")).toBeNull();
  });
});

describe("on the canvas", () => {
  test("shows the event's questions as it would live", () => {
    const { container } = renderPart(<Questions />, {
      renderer: "canvas",
      event: launch,
    });
    expect(container.querySelectorAll("[data-question]")).toHaveLength(7);
  });

  test("is there to select when the event has no questions or there is no event", () => {
    for (const event of [fixtureEvent(voterDrive.id), undefined]) {
      renderPart(<Questions data-testid="part" />, {
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
      <Questions />
      <button type="reset">Reset</button>
    </form>
  );

  test("every control goes back to blank and collect says so", () => {
    // The browser puts a checkbox or a select back to its default without an
    // onChange, so what collect says has to follow the reset.
    const view = renderPart(<Form />, { event: launch });
    const { container, collect } = view;
    set(container, howHeard.id, "A friend");
    set(container, years.id, "4");
    set(container, tShirt.id, "M");
    tick("Mandarin");
    tick("Yes");
    expect(collect("questions")).toMatchObject({
      [howHeard.id]: "A friend",
      [years.id]: "4",
      [tShirt.id]: "M",
      [languages.id]: '["Mandarin"]',
      [conduct.id]: "true",
    });
    fireEvent.click(screen.getByText("Reset"));
    expect((control(container, howHeard.id) as HTMLInputElement).value).toBe(
      ""
    );
    expect(
      (control(container, tShirt.id) as unknown as HTMLSelectElement).value
    ).toBe("");
    expect((control(container, conduct.id) as HTMLInputElement).checked).toBe(
      false
    );
    expect(
      (screen.getByRole("checkbox", { name: "Mandarin" }) as HTMLInputElement)
        .checked
    ).toBe(false);
    // only the required questions are sent, blank, for the platform to name
    expect(collect("questions")).toEqual({
      [tShirt.id]: "",
      [conduct.id]: "false",
    });
  });
});
