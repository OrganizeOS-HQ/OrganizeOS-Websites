/**
 * The products of a `GET /v1/products` body (`{ data: [...] }`), as the
 * builder's Product row lists them: each product's id and title, in the
 * list's order (newest first). Lenient: an entry with no string id, a blank or
 * padded id, or an id already listed is skipped, and a blank title reads
 * "Untitled product". Anything that is not such a body (an error body, `{}`,
 * the text of an HTML page) reads as no products.
 *
 * Its own export (`@organizeos/site-components/products-data`), so the builder
 * reads it without the package's components or templates.
 */
export type ProductOption = { id: string; title: string };

export const untitledProduct = "Untitled product";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Array.isArray(value) === false;

export const parseProductsData = (body: unknown): ProductOption[] => {
  if (isRecord(body) === false || Array.isArray(body.data) === false) {
    return [];
  }
  const seen = new Set<string>();
  const products: ProductOption[] = [];
  for (const entry of body.data as unknown[]) {
    if (isRecord(entry) === false) {
      continue;
    }
    const { id, title } = entry;
    if (
      typeof id !== "string" ||
      id === "" ||
      id.trim() !== id ||
      seen.has(id)
    ) {
      continue;
    }
    seen.add(id);
    products.push({
      id,
      title:
        typeof title === "string" && title.trim() !== ""
          ? title
          : untitledProduct,
    });
  }
  return products;
};
