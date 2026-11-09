import {
  ws,
  css,
  expression,
  token,
  Token,
  Parameter,
  PlaceholderValue,
} from "@webstudio-is/template";
import { $, organizeos } from "../shared/proxy";
import { cardToken } from "../events/event-card.template";

// Template-only JSX: the pieces of the Product Grid and Product Card
// templates. Nothing here is a component, and `components.ts` never reaches
// this file, so a published site's copy of the package does not carry it.

// A product's image: a square block the card's width, cropped to fill it, so a
// grid's cards line up whatever each image's own ratio. A token, so a
// template sets a ratio of its own.
export const productImageToken = token(
  "OS Product Image",
  css`
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 1 / 1;
    object-fit: cover;
  `
);

// A product's title: the site's heading font, with no fallback, as the
// events cards' titles.
export const productTitleToken = token(
  "OS Product Title",
  css`
    font-family: var(--font-heading);
    margin: 0;
  `
);

// A product's price line: "From" (when its variants are priced differently)
// beside the amount.
export const productPriceToken = token(
  "OS Product Price",
  css`
    display: inline-flex;
    column-gap: 0.25em;
    margin: 0;
  `
);

// The line a shop block shows when there are no products, and the one it
// shows when the read failed. It declares nothing, as "OS Event Note": the
// lines keep the browser's paragraph and the site's text colour. Built with
// `new Token`, since token(name) alone references a token the project must
// already have.
export const productNoteToken = new Token("OS Product Note", []);

// The grid's "Shop all" link: the events cards' link, a 44px tap target in the
// text colour, underlined and bolder (see "OS Event Link").
export const productLinkToken = token(
  "OS Product Link",
  css`
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding-top: calc((44px - 1lh) / 2);
    padding-bottom: calc((44px - 1lh) / 2);
    margin-top: calc((1lh - 44px) / 2);
    margin-bottom: calc((1lh - 44px) / 2);
    color: var(--text, #18181b);
    font-weight: 600;
    text-decoration-line: underline;
  `
);

/**
 * One product, as a function of the collection's parameter: the
 * `GET /v1/products` item (`slug`, `title`, `image_url`, `price_from_cents`,
 * `price_varies`, `currency`). Shared by both blocks.
 *
 * The whole card is a link to the product's page on the site's own host,
 * `/shop/{slug}`, which the platform serves; the site has no route there, so
 * the click is a document navigation (`reloadDocument`). A bound address
 * whose fixed start decides the scheme is published while org script is
 * paused (docs/ORGANIZEOS-FORK.md section 10); the item's `url` alone would
 * not be. It wears "OS Card", shared with the events cards.
 *
 * The image shows only for a product with one (`image_url` is null
 * otherwise); "From" only when `price_varies` is true. No element here has a
 * `ws:id`: the insert binds by the root's children, and a fixed id would
 * repeat in a second placement.
 */
export const productCard = (product: Parameter) => (
  <ws.element
    ws:tag="a"
    ws:label="Product"
    ws:style={css`
      text-decoration-line: none;
    `}
    ws:tokens={[cardToken]}
    href={expression`"/shop/" + ${product}.slug`}
    reloadDocument={true}
  >
    <$.Image
      ws:label="Image"
      ws:tokens={[productImageToken]}
      src={expression`${product}.image_url`}
      alt={expression`${product}.title`}
      ws:show={expression`(${product}.image_url ?? "") !== ""`}
    />
    <ws.element ws:tag="h3" ws:label="Title" ws:tokens={[productTitleToken]}>
      {expression`${product}.title`}
    </ws.element>
    <ws.element ws:tag="p" ws:label="Price" ws:tokens={[productPriceToken]}>
      <ws.element
        ws:tag="span"
        ws:label="From"
        ws:show={expression`${product}.price_varies === true`}
      >
        {new PlaceholderValue("From")}
      </ws.element>
      <organizeos.Price
        ws:label="Amount"
        cents={expression`${product}.price_from_cents`}
        currency={expression`${product}.currency`}
      />
    </ws.element>
  </ws.element>
);

/**
 * The Product Grid: the org's products, newest first, as a grid of cards in
 * at most `columns` columns (the root's `--os-product-columns`), never
 * narrower than 200px, then a line for no products, a line for a read that
 * failed, and "Shop all" to the storefront, `/shop`. The insert
 * (apps/builder insert-organizeos-block.ts) binds the collection's `data` and
 * the three others' `data-ws-show` to the block's own Products binding, by
 * the `ws:id`s given here ("products", "empty", "unavailable", "shop-all").
 *
 * The root carries a visitor's share code (`?r=`) on a card and on "Shop
 * all", on the published site.
 */
export const productGridTemplate = ({ label }: { label: string }) => {
  const product = new Parameter("product");
  return (
    <organizeos.ProductGrid
      ws:label={label}
      columns="3"
      ws:style={css`
        display: grid;
        gap: 24px;
        grid-template-columns: repeat(
          auto-fill,
          minmax(
            max(
              200px,
              calc(
                (100% - (var(--os-product-columns, 3) - 1) * 24px) /
                  var(--os-product-columns, 3)
              )
            ),
            1fr
          )
        );
      `}
    >
      <ws.collection ws:id="products" ws:label="Products" item={product}>
        {productCard(product)}
      </ws.collection>
      <ws.element
        ws:tag="p"
        ws:id="empty"
        ws:label="No products"
        ws:style={css`
          grid-column: 1 / -1;
        `}
        ws:tokens={[productNoteToken]}
      >
        {new PlaceholderValue("No products yet.")}
      </ws.element>
      <ws.element
        ws:tag="p"
        ws:id="unavailable"
        ws:label="Products unavailable"
        ws:style={css`
          grid-column: 1 / -1;
        `}
        ws:tokens={[productNoteToken]}
      >
        {new PlaceholderValue("Products are unavailable right now.")}
      </ws.element>
      <ws.element
        ws:tag="a"
        ws:id="shop-all"
        ws:label="Shop all"
        ws:style={css`
          grid-column: 1 / -1;
        `}
        ws:tokens={[productLinkToken]}
        href="/shop"
        reloadDocument={true}
      >
        {new PlaceholderValue("Shop all")}
      </ws.element>
    </organizeos.ProductGrid>
  );
};

/**
 * The Product Card: one product, the newest or the one the Product row picks,
 * then a line for a product that is not available and a line for a read that
 * failed. The insert binds the collection's `data` (the first product of the
 * card's own read) and the two lines' `data-ws-show`, by the `ws:id`s given
 * here ("product", "empty", "unavailable").
 */
export const productCardTemplate = ({ label }: { label: string }) => {
  const product = new Parameter("product");
  return (
    <organizeos.ProductCard
      ws:label={label}
      ws:style={css`
        display: block;
      `}
    >
      <ws.collection ws:id="product" ws:label="Products" item={product}>
        {productCard(product)}
      </ws.collection>
      <ws.element
        ws:tag="p"
        ws:id="empty"
        ws:label="No product"
        ws:tokens={[productNoteToken]}
      >
        {new PlaceholderValue("This product is not available.")}
      </ws.element>
      <ws.element
        ws:tag="p"
        ws:id="unavailable"
        ws:label="Products unavailable"
        ws:tokens={[productNoteToken]}
      >
        {new PlaceholderValue("Products are unavailable right now.")}
      </ws.element>
    </organizeos.ProductCard>
  );
};
