import {
  forwardRef,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ElementRef,
  type ReactNode,
} from "react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { FormRootContext, useRegisterPart } from "../form/context";
import { useMergedRef } from "../form/merge-ref";
import { useFormReset } from "../form/use-form-reset";
import { useRsvpContext, type CollectedAnswers } from "./context";
import type { RsvpQuestion } from "./events-data";

/** The most characters of an answer the endpoint's body takes. */
const maxAnswerLength = 5000;

/** The most answers the endpoint's body takes. */
const maxAnswers = 100;

/** The most a text or textarea control takes while typing, as Website Lite's. */
const maxTypedLength = 2000;

/**
 * What a visitor has put in a control: text for the typed, date, number and
 * select questions, the options ticked for a multiselect, a box for a checkbox.
 */
type Answer = string | string[] | boolean;

type Draft = Readonly<Record<string, Answer>>;

const distinct = (options: readonly string[]) => Array.from(new Set(options));

/**
 * Whether a multiselect with these options ticked, in the question's option
 * order, is too long to send whole.
 */
const isTooLong = (chosen: readonly string[]) =>
  JSON.stringify(chosen).length > maxAnswerLength;

/**
 * A multiselect as a JSON array in the question's option order. The boxes stop
 * taking options before the array is too long to send, so the cut here, at an
 * option so that it stays a list, is for what they could not stop: options
 * ticked before the script ran, or an event whose options changed under an
 * answer.
 */
const serializeChosen = (
  question: RsvpQuestion,
  answer: Answer | undefined
) => {
  const ticked = Array.isArray(answer) ? answer : [];
  let chosen = distinct(question.options).filter((option) =>
    ticked.includes(option)
  );
  while (chosen.length > 0 && isTooLong(chosen)) {
    chosen = chosen.slice(0, -1);
  }
  return chosen;
};

/**
 * A number the way the endpoint reads one: digits with an optional sign and
 * fraction. A number input also takes an exponent ("1e3"), which the endpoint
 * refuses, so one is written out. A value that cannot be written out as exactly
 * the same number (one too small to tell from zero, say) is left as typed, for
 * the platform to refuse.
 */
const toPlainDecimal = (value: string) => {
  if (!/e/i.test(value)) {
    return value;
  }
  const number = Number(value);
  const plain = number.toLocaleString("en-US", {
    useGrouping: false,
    maximumFractionDigits: 20,
  });
  return Number(plain) === number ? plain : value;
};

/**
 * One answer the way Website Lite sends it (plan decision 12): a multiselect as
 * a JSON array of strings, a checkbox as "true" or "false", anything else as
 * typed. Undefined leaves the question out: a blank optional answer is no
 * answer. A blank required one is sent as it is, so the platform names the
 * question and the visitor sees the message under it.
 */
const serializeAnswer = (
  question: RsvpQuestion,
  answer: Answer | undefined
): string | undefined => {
  switch (question.type) {
    case "checkbox":
      if (answer === true) {
        return "true";
      }
      return question.required ? "false" : undefined;
    case "multiselect": {
      const chosen = serializeChosen(question, answer);
      if (chosen.length === 0) {
        return question.required ? "[]" : undefined;
      }
      return JSON.stringify(chosen);
    }
    case "select": {
      const value =
        typeof answer === "string" && question.options.includes(answer)
          ? answer
          : "";
      return value === "" && !question.required ? undefined : value;
    }
    default: {
      const value = typeof answer === "string" ? answer : "";
      if (value.trim() === "" && !question.required) {
        return;
      }
      const sent = question.type === "number" ? toPlainDecimal(value) : value;
      return sent.slice(0, maxAnswerLength);
    }
  }
};

/**
 * The answers to send, by question id and in the event's order. Past the 100
 * the endpoint takes, the required questions' answers are kept first: cutting in
 * the event's order could drop a required one every time, and the platform would
 * name it missing however often the visitor filled it in.
 */
const serializeAnswers = (
  questions: readonly RsvpQuestion[],
  draft: Draft
): CollectedAnswers => {
  const serialized: { question: RsvpQuestion; value: string }[] = [];
  for (const question of questions) {
    const value = serializeAnswer(question, draft[question.id]);
    if (value !== undefined) {
      serialized.push({ question, value });
    }
  }
  let kept = serialized;
  if (serialized.length > maxAnswers) {
    const first = new Set(
      [
        ...serialized.filter((item) => item.question.required),
        ...serialized.filter((item) => !item.question.required),
      ].slice(0, maxAnswers)
    );
    kept = serialized.filter((item) => first.has(item));
  }
  const answers: CollectedAnswers = {};
  for (const { question, value } of kept) {
    answers[question.id] = value;
  }
  return answers;
};

const QuestionGroup = ({
  question,
  answer,
  error,
  onChange,
}: {
  question: RsvpQuestion;
  answer: Answer | undefined;
  error: string | undefined;
  onChange: (answer: Answer) => void;
}) => {
  const baseId = useId();
  const controlId = `${baseId}control`;
  const labelId = `${baseId}label`;
  const helpId = `${baseId}help`;
  const messageId = `${baseId}message`;
  const name = `answers.${question.id}`;
  const options = distinct(question.options);
  // A multiselect is several boxes: `required` on each would make every one
  // mandatory, so its requirement stays with the marker and the platform.
  const isGroup =
    question.type === "multiselect" || question.type === "checkbox";
  const nativeRequired = question.required && question.type !== "multiselect";
  const describedBy =
    [
      question.helpText === null ? undefined : helpId,
      error === undefined ? undefined : messageId,
    ]
      .filter((id) => id !== undefined)
      .join(" ") || undefined;
  const invalid =
    error === undefined ? {} : { "aria-invalid": true, "data-invalid": "" };
  const typed = typeof answer === "string" ? answer : "";

  let control: ReactNode;
  switch (question.type) {
    case "textarea":
      control = (
        <textarea
          id={controlId}
          name={name}
          value={typed}
          maxLength={maxTypedLength}
          required={nativeRequired}
          aria-describedby={describedBy}
          {...invalid}
          onChange={(event) => onChange(event.target.value)}
        />
      );
      break;
    case "select":
      control = (
        <select
          id={controlId}
          name={name}
          value={typed}
          required={nativeRequired}
          aria-describedby={describedBy}
          {...invalid}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Select...</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
      break;
    case "multiselect": {
      const ticked = Array.isArray(answer) ? answer : [];
      // an option that would make the answer too long to send is not offered,
      // or it would look ticked and not be sent
      const wouldOverflow = (option: string) =>
        isTooLong(
          options.filter((item) => ticked.includes(item) || item === option)
        );
      control = (
        <div
          role="group"
          aria-labelledby={labelId}
          aria-describedby={describedBy}
        >
          {options.map((option) => (
            <label key={option}>
              <input
                type="checkbox"
                name={name}
                value={option}
                checked={ticked.includes(option)}
                disabled={!ticked.includes(option) && wouldOverflow(option)}
                {...invalid}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...ticked, option]
                      : ticked.filter((item) => item !== option)
                  )
                }
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      );
      break;
    }
    case "checkbox":
      control = (
        <div
          role="group"
          aria-labelledby={labelId}
          aria-describedby={describedBy}
        >
          <label>
            <input
              type="checkbox"
              name={name}
              value="true"
              checked={answer === true}
              required={nativeRequired}
              {...invalid}
              onChange={(event) => onChange(event.target.checked)}
            />
            <span>Yes</span>
          </label>
        </div>
      );
      break;
    default:
      control = (
        <input
          id={controlId}
          type={
            question.type === "number"
              ? "number"
              : question.type === "date"
                ? "date"
                : "text"
          }
          // a number is any decimal, not a whole one
          step={question.type === "number" ? "any" : undefined}
          name={name}
          value={typed}
          maxLength={question.type === "text" ? maxTypedLength : undefined}
          required={nativeRequired}
          aria-describedby={describedBy}
          {...invalid}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }

  const label = (
    <>
      {question.label}
      {question.required && (
        // Said by the control's own `required` where it has one; a multiselect
        // has none, so there the marker is how the requirement is announced.
        <span data-required="" aria-hidden={nativeRequired ? true : undefined}>
          {" *"}
        </span>
      )}
    </>
  );

  return (
    <div
      data-question=""
      data-type={question.type}
      data-invalid={error === undefined ? undefined : ""}
    >
      {isGroup ? (
        <div id={labelId}>{label}</div>
      ) : (
        <label htmlFor={controlId}>{label}</label>
      )}
      {question.helpText !== null && (
        <div id={helpId} data-help="">
          {question.helpText}
        </div>
      )}
      {control}
      {error !== undefined && (
        <div id={messageId} data-message="" data-invalid="">
          {error}
        </div>
      )}
    </div>
  );
};

type QuestionsProps = ComponentProps<"div">;

/**
 * Questions: the event's registration questions, each with its label, help
 * text, required marker, a control for its type and a message for the platform's
 * refusal of its answer. Renders nothing for an event with no questions, except
 * on the canvas, where the part is always there to select. A form reset clears
 * the answers. A multiselect stops offering options once the answer would be too
 * long to send. Answers already in the page when it hydrates (a browser restoring
 * the form, or a visitor who got there first) are kept. `collect` returns the
 * answers by question id, serialized as Website Lite sends them, without the
 * blank optional ones.
 */
export const Questions = forwardRef<ElementRef<"div">, QuestionsProps>(
  (
    // The part's children are `ws:descendant` instances, which style the
    // controls through their selectors and draw nothing themselves.
    { children: _children, ...props },
    ref
  ) => {
    const { renderer } = useContext(ReactSdkContext);
    const root = useContext(FormRootContext);
    const event = useRsvpContext()?.event;
    const questions = event?.questions ?? [];
    const [draft, setDraft] = useState<Draft>({});
    const ownRef = useRef<HTMLDivElement | null>(null);
    const mergedRef = useMergedRef(ref, ownRef);
    // a browser's reset puts a checkbox or a select back without an onChange
    const listRef = useFormReset<HTMLDivElement>(() => setDraft({}), mergedRef);

    // `collect` is stable, so the part registers once; it reads the latest
    // questions and answers.
    const latest = useRef({ questions, draft });
    useLayoutEffect(() => {
      latest.current = { questions, draft };
    });
    // React keeps what a hydrated control holds and fires no onChange, so an
    // answer entered before the script ran (a click that came first, or the
    // browser restoring the form) is in the page and not in the draft, and
    // would be shown and not sent. This runs after the hydration commit, while
    // the controls still hold it, and finds nothing on a client render. It
    // lists the controls and compares their names, so an id is never built
    // into a selector.
    useLayoutEffect(() => {
      const element = ownRef.current;
      if (element === null) {
        return;
      }
      const all = Array.from(
        element.querySelectorAll<HTMLInputElement>("input, select, textarea")
      );
      const restored: Record<string, Answer> = {};
      for (const question of latest.current.questions) {
        const controls = all.filter(
          (control) => control.name === `answers.${question.id}`
        );
        if (question.type === "multiselect") {
          const ticked = controls
            .filter((box) => box.checked)
            .map((box) => box.value);
          if (ticked.length > 0) {
            // the boxes past what can be sent are put back by the render this causes
            restored[question.id] = serializeChosen(question, ticked);
          }
        } else if (question.type === "checkbox") {
          if (controls[0]?.checked === true) {
            restored[question.id] = true;
          }
        } else if (controls[0] !== undefined && controls[0].value !== "") {
          restored[question.id] = controls[0].value;
        }
      }
      if (Object.keys(restored).length > 0) {
        setDraft(restored);
      }
    }, []);
    const collect = useCallback(
      () => serializeAnswers(latest.current.questions, latest.current.draft),
      []
    );
    useRegisterPart({ kind: "questions", collect });

    if (renderer !== "canvas" && questions.length === 0) {
      return null;
    }

    const messages = questions.map((question) =>
      root?.fieldErrors.get(`answers.${question.id}`)
    );
    return (
      <div
        {...props}
        ref={listRef}
        data-invalid={
          messages.some((message) => message !== undefined) ? "" : undefined
        }
      >
        {questions.map((question, index) => (
          <QuestionGroup
            key={question.id}
            question={question}
            answer={draft[question.id]}
            error={messages[index]}
            onChange={(answer) =>
              setDraft((previous) => ({ ...previous, [question.id]: answer }))
            }
          />
        ))}
      </div>
    );
  }
);

Questions.displayName = "Questions";
