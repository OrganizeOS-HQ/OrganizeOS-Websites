import { useRef, useState } from "react";
import {
  Button,
  css,
  cssVar,
  Flex,
  Grid,
  IconButton,
  InputField,
  Label,
  theme,
  toast,
  Tooltip,
} from "@webstudio-is/design-system";
import { TrashIcon, UploadIcon } from "@webstudio-is/icons";
import { getRefusal, getToastText, type CmsRefusal } from "./cms-logic";
import {
  CMS_IMAGE_MAX_BYTES,
  CMS_IMAGE_TYPES,
  isCmsFailure,
  type CmsImageValue,
  type CmsSource,
} from "./cms-source";

const IMAGE_ACCEPT = Object.keys(CMS_IMAGE_TYPES).join(",");

/** The picture itself, left-aligned, at most 192 px tall: no frame around it. */
const frameStyle = css({
  justifySelf: "start",
  maxWidth: "100%",
  borderRadius: theme.borderRadius[4],
  border: `1px solid ${cssVar("--border-default")}`,
  overflow: "hidden",
  "& img": {
    display: "block",
    maxWidth: "100%",
    maxHeight: theme.spacing[27],
    objectFit: "contain",
  },
});

/** The stored value, or a Lite-era bare URL kept until it is replaced. */
const readImage = (value: unknown): CmsImageValue | string | undefined => {
  if (typeof value === "string" && value !== "") {
    return value;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as CmsImageValue).url === "string" &&
    (value as CmsImageValue).url !== ""
  ) {
    return value as CmsImageValue;
  }
  return undefined;
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

export const ImageField = ({
  id,
  source,
  value,
  disabled,
  onChange,
  onError,
  onBusyChange,
  onRefusal,
}: {
  id: string;
  source: CmsSource;
  value: unknown;
  disabled?: boolean;
  onChange: (value: CmsImageValue | null) => void;
  onError: (error: string | undefined) => void;
  /** True while E9 is in flight: Save and Publish wait for it. */
  onBusyChange?: (busy: boolean) => void;
  /** E9 answered `unauthorized` or `mfa_required`: the screen's line. */
  onRefusal?: (refusal: CmsRefusal) => void;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const image = readImage(value);
  const url = typeof image === "string" ? image : image?.url;

  const choose = async (file: File) => {
    if (CMS_IMAGE_TYPES[file.type] === undefined) {
      onError("Not an image");
      return;
    }
    if (file.size > CMS_IMAGE_MAX_BYTES) {
      onError("Over 4 MB");
      return;
    }
    onError(undefined);
    setIsUploading(true);
    onBusyChange?.(true);
    let size: Awaited<ReturnType<typeof measure>>;
    let uploaded: Awaited<ReturnType<CmsSource["uploadImage"]>>;
    try {
      [size, uploaded] = await Promise.all([
        measure(file),
        source.uploadImage(file),
      ]);
    } catch {
      // a source that throws reads as a lost answer
      size = { width: null, height: null };
      uploaded = { error: "unavailable" };
    } finally {
      setIsUploading(false);
      onBusyChange?.(false);
    }
    if (isCmsFailure(uploaded)) {
      const refusal = getRefusal(uploaded.error, "write");
      if (refusal !== undefined && onRefusal !== undefined) {
        onRefusal(refusal);
        return;
      }
      // a write refused for access or plan: the editor's write toast
      if (uploaded.error === "forbidden" || uploaded.error === "plan") {
        toast.error(getToastText(uploaded.error));
        return;
      }
      onError(uploaded.error === "invalid" ? "Not an image" : "Not uploaded");
      return;
    }
    onChange({
      url: uploaded.url,
      path: uploaded.path,
      alt: typeof image === "object" ? image.alt : "",
      ...size,
    });
  };

  const chooseButton = (
    <Button
      color="neutral"
      prefix={<UploadIcon />}
      disabled={disabled}
      state={isUploading ? "pending" : undefined}
      onClick={() => fileRef.current?.click()}
    >
      Choose
    </Button>
  );

  return (
    <Grid gap="2" data-cms-image>
      <input
        ref={fileRef}
        id={url === undefined ? id : undefined}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file !== undefined) {
            void choose(file);
          }
        }}
      />
      {url === undefined ? (
        <Flex>{chooseButton}</Flex>
      ) : (
        <>
          <div className={frameStyle()}>
            <img src={url} alt={typeof image === "object" ? image.alt : ""} />
          </div>
          <Grid
            align="center"
            gap="2"
            css={{ gridTemplateColumns: "auto minmax(0, 1fr) auto auto" }}
          >
            <Label htmlFor={`${id}-alt`}>Alt</Label>
            <InputField
              id={`${id}-alt`}
              value={typeof image === "object" ? image.alt : ""}
              disabled={disabled || isUploading || typeof image === "string"}
              maxLength={500}
              onChange={(event) => {
                if (typeof image === "object") {
                  onChange({ ...image, alt: event.currentTarget.value });
                }
              }}
            />
            {chooseButton}
            <Tooltip content="Remove">
              <IconButton
                aria-label="Remove"
                disabled={disabled || isUploading}
                onClick={() => onChange(null)}
              >
                <TrashIcon />
              </IconButton>
            </Tooltip>
          </Grid>
        </>
      )}
    </Grid>
  );
};
