// The package's tsconfig has no vite/client types, so the image imports a
// template's catalog makes (`import url from "./photo.jpg?url"`) are declared
// here.

declare module "*.jpg?url" {
  const url: string;
  export default url;
}

declare module "*.jpeg?url" {
  const url: string;
  export default url;
}

declare module "*.png?url" {
  const url: string;
  export default url;
}

declare module "*.webp?url" {
  const url: string;
  export default url;
}
