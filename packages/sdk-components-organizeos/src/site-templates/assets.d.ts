// The package's tsconfig has no vite/client types, so the image and font
// imports a template makes are declared here, and only in the form
// `?url&no-inline` (`import url from "./photo.jpg?url&no-inline"`). Vite
// inlines a small file as a `data:` URL, which the apply routine cannot
// upload by URL; `&no-inline` keeps every file at a URL on the builder's own
// origin. The bare `?url` form is left undeclared, so a template that imports
// one does not typecheck.

declare module "*.jpg?url&no-inline" {
  const url: string;
  export default url;
}

declare module "*.jpeg?url&no-inline" {
  const url: string;
  export default url;
}

declare module "*.png?url&no-inline" {
  const url: string;
  export default url;
}

declare module "*.webp?url&no-inline" {
  const url: string;
  export default url;
}

declare module "*.woff2?url&no-inline" {
  const url: string;
  export default url;
}
