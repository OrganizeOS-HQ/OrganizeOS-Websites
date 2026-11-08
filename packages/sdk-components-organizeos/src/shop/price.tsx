import { forwardRef, type ComponentProps, type ElementRef } from "react";

/**
 * Integer cents as money, in US English: 1800 in USD is "$18.00". Undefined
 * for cents that are not a safe integer of 0 or more, or a currency `Intl`
 * does not know.
 */
export const formatPrice = (
  cents: unknown,
  currency: unknown
): undefined | string => {
  if (
    typeof cents !== "number" ||
    Number.isSafeInteger(cents) === false ||
    cents < 0 ||
    typeof currency !== "string"
  ) {
    return;
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(cents / 100);
  } catch {
    return;
  }
};

type PriceProps = ComponentProps<"span"> & {
  /** The price in integer cents (the product's `price_from_cents`). */
  cents?: number;
  /** An ISO 4217 code; the products read sends `USD`. */
  currency?: string;
};

/**
 * Price: a `span` that renders a price in integer cents as money, as
 * upstream's Time renders a date. A value it cannot format renders the span
 * empty, so the instance stays on the canvas to select. It renders the same
 * markup on the server and the client.
 */
export const Price = forwardRef<ElementRef<"span">, PriceProps>(
  ({ cents, currency = "USD", children: _children, ...props }, ref) => (
    <span {...props} ref={ref}>
      {formatPrice(cents, currency)}
    </span>
  )
);

Price.displayName = "Price";
