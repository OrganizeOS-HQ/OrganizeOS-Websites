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
  Tooltip,
} from "@webstudio-is/design-system";
import { TrashIcon, UploadIcon } from "@webstudio-is/icons";
import { isCmsFailure, type CmsImageValue, type CmsSource } from "./cms-source";

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/gif,image/webp";
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024;

const frameStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: theme.spacing[27],
  borderRadius: theme.borderRadius[4],
  border: `1px solid ${cssVar("--border-default")}`,
  background: cssVar("--background-secondary"),
  overflow: "hidden",
  "& img": {
    display: "block",
    maxWidth: "100%",
    maxHeight: "100%",
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
}: {
  id: string;
  source: CmsSource;
  value: unknown;
  disabled?: boolean;
  onChange: (value: CmsImageValue | null) => void;
  onError: (error: string | undefined) => void;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const image = readImage(value);
  const url = typeof image === "string" ? image : image?.url;

  const choose = async (file: File) => {
    if (IMAGE_ACCEPT.split(",").includes(file.type) === false) {
      onError("Not an image");
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      onError("Over 4 MB");
      return;
    }
    onError(undefined);
    setIsUploading(true);
    const [size, uploaded] = await Promise.all([
      measure(file),
      source.uploadImage(file),
    ]);
    setIsUploading(false);
    if (isCmsFailure(uploaded)) {
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
              disabled={disabled || typeof image === "string"}
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
                disabled={disabled}
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
