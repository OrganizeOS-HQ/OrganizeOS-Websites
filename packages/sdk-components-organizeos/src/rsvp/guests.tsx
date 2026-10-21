import {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ElementRef,
} from "react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { FormRootContext, useRegisterPart } from "../form/context";
import { useMergedRef } from "../form/merge-ref";
import { useRsvpContext, type CollectedGuests } from "./context";

/** The most characters the endpoint takes of a guest's first or last name. */
const maxNameLength = 100;

type Row = { key: number; firstName: string; lastName: string };

const isBlank = (value: string) => value.trim() === "";

type GuestsProps = ComponentProps<"div"> & {
  /** The Add button's text. */
  addLabel?: string;
  /** The Remove button's text. */
  removeLabel?: string;
  firstNamePlaceholder?: string;
  lastNamePlaceholder?: string;
};

/**
 * Guests: the RSVP Form's guest rows. A row is a first and a last name, the
 * most the endpoint takes of a guest; a Remove button sits on each, and the Add
 * button goes at the event's allowance (`max_guests`). It renders nothing for an
 * event that takes no guests. On the canvas it always renders one sample row,
 * marked `data-sample`, so the part can be styled whatever the event is.
 * `collect` returns the rows that are not entirely blank.
 */
export const Guests = forwardRef<ElementRef<"div">, GuestsProps>(
  (
    {
      addLabel = "Add a guest",
      removeLabel = "Remove",
      firstNamePlaceholder = "First name",
      lastNamePlaceholder = "Last name",
      // The part's children are `ws:descendant` instances, which style the
      // inputs and buttons through their selectors and draw nothing themselves.
      children: _children,
      ...props
    },
    ref
  ) => {
    const { renderer } = useContext(ReactSdkContext);
    const root = useContext(FormRootContext);
    const event = useRsvpContext()?.event;
    const messageId = `${useId()}message`;
    const isCanvas = renderer === "canvas";
    const maxGuests = event?.maxGuests ?? 0;

    const [rows, setRows] = useState<readonly Row[]>([]);
    const lastKey = useRef(0);
    // A smaller allowance than the rows made (the event's data moved on) cuts
    // the rows from the end: what is shown is what is sent.
    const shown = isCanvas
      ? [{ key: -1, firstName: "", lastName: "" }]
      : rows.slice(0, maxGuests);

    // `collect` is stable, so the part registers once; it reads the latest
    // rows and allowance.
    const latest = useRef({ rows: shown });
    useLayoutEffect(() => {
      latest.current = { rows: isCanvas ? [] : shown };
    });
    const collect = useCallback((): CollectedGuests => {
      return latest.current.rows
        .filter((row) => !(isBlank(row.firstName) && isBlank(row.lastName)))
        .map((row) => ({
          first_name: row.firstName.slice(0, maxNameLength),
          last_name: row.lastName.slice(0, maxNameLength),
        }));
    }, []);
    useRegisterPart({ kind: "guests", collect });

    // A new row takes the focus; a removed one hands it to the Add button,
    // which is where the visitor was.
    const addRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLDivElement | null>(null);
    const mergedRef = useMergedRef(ref, listRef);
    const focusNext = useRef<"row" | "add">();
    useEffect(() => {
      const target = focusNext.current;
      focusNext.current = undefined;
      if (target === "add") {
        addRef.current?.focus();
      } else if (target === "row") {
        const inputs = listRef.current?.querySelectorAll("input");
        inputs?.item(inputs.length - 2)?.focus();
      }
    });

    if (!isCanvas && maxGuests === 0) {
      return null;
    }

    const message = root?.fieldErrors.get("guests");
    const setName = (
      key: number,
      name: "firstName" | "lastName",
      value: string
    ) =>
      setRows((previous) =>
        previous.map((row) =>
          row.key === key ? { ...row, [name]: value } : row
        )
      );
    const addRow = () => {
      lastKey.current += 1;
      const key = lastKey.current;
      focusNext.current = "row";
      setRows((previous) => [
        ...previous.slice(0, maxGuests),
        { key, firstName: "", lastName: "" },
      ]);
    };
    const removeRow = (key: number) => {
      focusNext.current = "add";
      setRows((previous) => previous.filter((row) => row.key !== key));
    };

    const nameInput = (
      row: Row,
      index: number,
      name: "firstName" | "lastName"
    ) => {
      const isFirst = name === "firstName";
      const value = isFirst ? row.firstName : row.lastName;
      const flagged = message !== undefined && !isCanvas && isBlank(value);
      return (
        <input
          type="text"
          name={`guests.${index}.${isFirst ? "first_name" : "last_name"}`}
          aria-label={`Guest ${index + 1} ${isFirst ? "first" : "last"} name`}
          placeholder={isFirst ? firstNamePlaceholder : lastNamePlaceholder}
          autoComplete="off"
          maxLength={maxNameLength}
          // The canvas row is a sample to style, not a form to fill in.
          readOnly={isCanvas}
          tabIndex={isCanvas ? -1 : undefined}
          value={value}
          onChange={(event) => setName(row.key, name, event.target.value)}
          aria-describedby={message === undefined ? undefined : messageId}
          aria-invalid={flagged ? true : undefined}
          data-invalid={flagged ? "" : undefined}
        />
      );
    };

    return (
      <div
        {...props}
        ref={mergedRef}
        data-invalid={message === undefined ? undefined : ""}
      >
        {shown.map((row, index) => (
          <div
            key={row.key}
            role="group"
            aria-label={`Guest ${index + 1}`}
            data-sample={isCanvas ? "" : undefined}
          >
            {nameInput(row, index, "firstName")}
            {nameInput(row, index, "lastName")}
            <button
              type="button"
              aria-label={`${removeLabel} (guest ${index + 1})`}
              onClick={isCanvas ? undefined : () => removeRow(row.key)}
            >
              {removeLabel}
            </button>
          </div>
        ))}
        {(isCanvas || shown.length < maxGuests) && (
          <button
            type="button"
            ref={addRef}
            onClick={isCanvas ? undefined : addRow}
          >
            {addLabel}
          </button>
        )}
        {message !== undefined && (
          <div id={messageId} data-message="" data-invalid="">
            {message}
          </div>
        )}
      </div>
    );
  }
);

Guests.displayName = "Guests";
