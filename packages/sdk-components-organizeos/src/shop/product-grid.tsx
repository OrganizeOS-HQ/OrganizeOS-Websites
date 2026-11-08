import {
  forwardRef,
  useContext,
  useRef,
  type ComponentProps,
  type CSSProperties,
  type ElementRef,
} from "react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { useMergedRef } from "../form/merge-ref";
import { useShareCodeCarrier } from "../share-code/use-share-code-carrier";

const columnValues = new Set(["2", "3", "4"]);

type ProductGridProps = ComponentProps<"div"> & {
  /** At most this many columns: "2", "3" or "4"; anything else reads as 3. */
  columns?: string;
  /**
   * The Show row's prop. The row writes the collection's data instead, so it
   * is never stored; a stored value is dropped, never rendered.
   */
  show?: string;
  /** The Product Card's row prop, dropped here too. */
  product?: string;
};

/**
 * Product Grid: the root of the Product Grid block (its template:
 * shop/product-card.template.tsx). A `div` that passes every prop through,
 * carries a visitor's share code (`?r=`) on a link inside it to a platform
 * page, as the Share Code Carrier does, and sets `--os-product-columns` to its
 * `columns`, which the template's grid reads. It renders the same markup on
 * the server and the client and acts only on a click, on a published page.
 */
export const ProductGrid = forwardRef<ElementRef<"div">, ProductGridProps>(
  (
    { children, columns, show: _show, product: _product, style, ...props },
    ref
  ) => {
    const { renderer } = useContext(ReactSdkContext);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const mergedRef = useMergedRef(ref, rootRef);
    useShareCodeCarrier({ rootRef, renderer });
    const value =
      typeof columns === "string" && columnValues.has(columns) ? columns : "3";
    return (
      <div
        {...props}
        style={{ ...style, "--os-product-columns": value } as CSSProperties}
        ref={mergedRef}
      >
        {children}
      </div>
    );
  }
);

ProductGrid.displayName = "ProductGrid";
