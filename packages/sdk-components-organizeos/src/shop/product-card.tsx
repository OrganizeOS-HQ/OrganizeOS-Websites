import {
  forwardRef,
  useContext,
  useRef,
  type ComponentProps,
  type ElementRef,
} from "react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { useMergedRef } from "../form/merge-ref";
import { useShareCodeCarrier } from "../share-code/use-share-code-carrier";

type ProductCardProps = ComponentProps<"div"> & {
  /**
   * The Product row's prop. The row writes the card's own data instead, so it
   * is never stored; a stored value is dropped, never rendered.
   */
  product?: string;
  /** The Product Grid's row prop, dropped here too. */
  show?: string;
};

/**
 * Product Card: the root of the Product Card block (its template:
 * shop/product-card.template.tsx). A `div` that passes every prop through and
 * carries a visitor's share code (`?r=`) on a link inside it to a platform
 * page, as the Share Code Carrier does. It renders the same markup on the
 * server and the client and acts only on a click, on a published page.
 */
export const ProductCard = forwardRef<ElementRef<"div">, ProductCardProps>(
  ({ children, product: _product, show: _show, ...props }, ref) => {
    const { renderer } = useContext(ReactSdkContext);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const mergedRef = useMergedRef(ref, rootRef);
    useShareCodeCarrier({ rootRef, renderer });
    return (
      <div {...props} ref={mergedRef}>
        {children}
      </div>
    );
  }
);

ProductCard.displayName = "ProductCard";
