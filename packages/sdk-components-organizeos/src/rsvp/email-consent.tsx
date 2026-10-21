import {
  forwardRef,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ElementRef,
} from "react";
import { FormRootContext, useRegisterPart } from "../form/context";
import type { CollectedConsent } from "./context";

type EmailConsentProps = Omit<ComponentProps<"label">, "ref">;

/**
 * Email Consent: an unchecked checkbox named `email_consent`, labelled by the
 * part's own children (the designer's text, which can hold a link). The box
 * is never checked for the visitor: an opt-in is an explicit act. `collect`
 * returns whether it is checked.
 *
 * The children sit in a `span` of their own, and the ref points to it. On the
 * canvas the text is edited in place on the element the ref points to, and the
 * editor replaces everything inside it, so the checkbox stays outside.
 */
export const EmailConsent = forwardRef<ElementRef<"span">, EmailConsentProps>(
  ({ children, ...props }, ref) => {
    const root = useContext(FormRootContext);
    const [checked, setChecked] = useState(false);

    // `collect` is stable, so the part registers once; it reads the latest box.
    const latest = useRef(checked);
    useLayoutEffect(() => {
      latest.current = checked;
    });
    const collect = useCallback((): CollectedConsent => latest.current, []);
    useRegisterPart({ kind: "consent", collect });

    const invalid = root?.fieldErrors.has("email_consent") === true;
    return (
      <label {...props} data-invalid={invalid ? "" : undefined}>
        <input
          type="checkbox"
          name="email_consent"
          value="true"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
          aria-invalid={invalid ? true : undefined}
        />
        <span ref={ref}>{children}</span>
      </label>
    );
  }
);

EmailConsent.displayName = "EmailConsent";
