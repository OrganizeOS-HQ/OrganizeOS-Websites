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
import { getToastText, type CmsRefusal } from "./cms-logic";
import type { CmsImageValue, CmsSource } from "./cms-source";
import {
  CMS_IMAGE_ACCEPT,
  checkCmsImageFile,
  uploadCmsImage,
} from "./cms-image-upload";

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
    const refused = checkCmsImageFile(file);
    if (refused !== undefined) {
      onError(refused);
      return;
    }
    onError(undefined);
    setIsUploading(true);
    onBusyChange?.(true);
    const uploaded = await uploadCmsImage(source, file);
    setIsUploading(false);
    onBusyChange?.(false);
    if (uploaded.ok === false) {
      if ("refusal" in uploaded) {
        if (onRefusal !== undefined) {
          onRefusal(uploaded.refusal);
          return;
        }
        onError("Not uploaded");
        return;
      }
      if ("toast" in uploaded) {
        toast.error(getToastText(uploaded.toast));
        return;
      }
      onError(uploaded.error);
      return;
    }
    onChange({
      url: uploaded.url,
      path: uploaded.path,
      alt: typeof image === "object" ? image.alt : "",
      width: uploaded.width,
      height: uploaded.height,
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
        accept={CMS_IMAGE_ACCEPT}
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
