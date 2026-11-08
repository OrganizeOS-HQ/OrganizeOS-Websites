import { RepeatGridIcon } from "@webstudio-is/icons/svg";
import type { TemplateMeta } from "@webstudio-is/template";
import { productGridTemplate } from "./shop/product-card.template";

// The org's products as a grid of cards. The template leaves the collection's
// `data` and the three others' `data-ws-show` unbound: the OrganizeOS panel
// binds them to the block's own Products binding when it inserts the block
// (apps/builder insert-organizeos-block.ts).
export const meta: TemplateMeta = {
  category: "hidden",
  label: "Product Grid",
  description: "Your shop's products",
  icon: RepeatGridIcon,
  template: productGridTemplate({ label: "Product Grid" }),
};
