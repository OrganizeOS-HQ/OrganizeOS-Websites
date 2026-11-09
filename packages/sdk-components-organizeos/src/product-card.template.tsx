import { ItemIcon } from "@webstudio-is/icons/svg";
import type { TemplateMeta } from "@webstudio-is/template";
import { productCardTemplate } from "./shop/product-card.template";

// One product: the newest, or the one the Product row picks. The insert gives
// the card a Resource of its own and binds the collection and the two lines
// to it (apps/builder insert-organizeos-block.ts).
export const meta: TemplateMeta = {
  category: "hidden",
  label: "Product Card",
  description: "One product from your shop",
  icon: ItemIcon,
  template: productCardTemplate({ label: "Product Card" }),
};
