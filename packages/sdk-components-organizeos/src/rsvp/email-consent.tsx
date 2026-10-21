import {
  forwardRef,
  useCallback,
  useContext,
  useRef,
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
 * returns whether it is checked, read from the box itself as Field Input reads
 * its input: a form reset unchecks the box without an `onChange`, and a copy of
 * it in state would go on saying it is checked.
 *
 * The children sit in a `span` of their own, and the ref points to it. On the
 * canvas the text is edited in place on the element the ref points to, and the
 * editor replaces everything inside it, so the checkbox stays outside.
 */
export const EmailConsent = forwardRef<ElementRef<"span">, EmailConsentProps>(
  ({ children, ...props }, ref) => {
    const root = useContext(FormRootContext);
    const boxRef = useRef<HTMLInputElement>(null);

    // `collect` is stable, so the part registers once; it reads the box.
    const collect = useCallback(
      (): CollectedConsent => boxRef.current?.checked === true,
      []
    );
    useRegisterPart({ kind: "consent", collect });

    const invalid = root?.fieldErrors.has("email_consent") === true;
    return (
      <label {...props} data-invalid={invalid ? "" : undefined}>
        <input
          ref={boxRef}
          type="checkbox"
          name="email_consent"
          value="true"
          defaultChecked={false}
          aria-invalid={invalid ? true : undefined}
        />
        <span ref={ref}>{children}</span>
      </label>
    );
  }
);

EmailConsent.displayName = "EmailConsent";
