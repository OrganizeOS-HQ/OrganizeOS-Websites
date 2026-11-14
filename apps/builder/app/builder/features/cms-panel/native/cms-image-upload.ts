/**
 * One image upload through E9, with the image field's checks (spec 4.6):
 * JPEG, PNG, GIF or WebP, at most 4 MB, measured in the browser. The image
 * field and the rich text field's Image both use it.
 */
import { getRefusal, type CmsRefusal } from "./cms-logic";
import {
  CMS_IMAGE_MAX_BYTES,
  CMS_IMAGE_TYPES,
  isCmsFailure,
  type CmsSource,
} from "./cms-source";

/** The file chooser's `accept`: E9's four types. */
export const CMS_IMAGE_ACCEPT = Object.keys(CMS_IMAGE_TYPES).join(",");

export type CmsImageUploadError = "Not an image" | "Over 4 MB" | "Not uploaded";

export type CmsImageUploadResult =
  | {
      ok: true;
      url: string;
      path: string;
      width: number | null;
      height: number | null;
    }
  | { ok: false; error: CmsImageUploadError }
  | { ok: false; refusal: CmsRefusal }
  | { ok: false; toast: "forbidden" | "plan" };

/** The checks made before any upload; undefined when the file passes. */
export const checkCmsImageFile = (
  file: File
): "Not an image" | "Over 4 MB" | undefined => {
  if (CMS_IMAGE_TYPES[file.type] === undefined) {
    return "Not an image";
  }
  if (file.size > CMS_IMAGE_MAX_BYTES) {
    return "Over 4 MB";
  }
};

/** Width and height, measured in the browser from the chosen file. */
const measure = (file: File) =>
  new Promise<{ width: number | null; height: number | null }>((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve({ width: null, height: null });
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });

/**
 * The checks first, then the measure and E9 in parallel. Never throws: a
 * source that throws reads as `unavailable`.
 */
export const uploadCmsImage = async (
  source: Pick<CmsSource, "uploadImage">,
  file: File
): Promise<CmsImageUploadResult> => {
  const refused = checkCmsImageFile(file);
  if (refused !== undefined) {
    return { ok: false, error: refused };
  }
  let size: Awaited<ReturnType<typeof measure>>;
  let uploaded: Awaited<ReturnType<CmsSource["uploadImage"]>>;
  try {
    [size, uploaded] = await Promise.all([
      measure(file),
      source.uploadImage(file),
    ]);
  } catch {
    size = { width: null, height: null };
    uploaded = { error: "unavailable" };
  }
  if (isCmsFailure(uploaded)) {
    const refusal = getRefusal(uploaded.error, "write");
    if (refusal !== undefined) {
      return { ok: false, refusal };
    }
    // a write refused for access or plan: the editor's write toast
    if (uploaded.error === "forbidden" || uploaded.error === "plan") {
      return { ok: false, toast: uploaded.error };
    }
    return {
      ok: false,
      error: uploaded.error === "invalid" ? "Not an image" : "Not uploaded",
    };
  }
  return { ok: true, url: uploaded.url, path: uploaded.path, ...size };
};
