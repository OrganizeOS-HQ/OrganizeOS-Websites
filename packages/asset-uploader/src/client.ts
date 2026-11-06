import type { AssetData, AssetDataOverride } from "./utils/get-asset-data";

export type AssetReadRange = { offset: number; length: number };

export type AssetInfoFallback = {
  width: number;
  height: number;
  format: string;
};

export const validateAssetReadRange = (range: AssetReadRange) => {
  const end = range.offset + range.length;
  if (
    Number.isSafeInteger(range.offset) === false ||
    range.offset < 0 ||
    Number.isSafeInteger(range.length) === false ||
    range.length <= 0 ||
    Number.isSafeInteger(end) === false
  ) {
    throw new Error("Asset read range is invalid");
  }
};

export type AssetObjectWriter = {
  uploadFile: (
    name: string,
    type: string,
    data: AsyncIterable<Uint8Array>,
    assetInfoFallback: AssetInfoFallback | undefined,
    assetDataOverride?: AssetDataOverride
  ) => Promise<AssetData>;
};

export type AssetObjectReader = {
  readFile: (
    name: string,
    range?: AssetReadRange
  ) => Promise<{
    data: AsyncIterable<Uint8Array>;
    contentLength?: number;
  }>;
  /**
   * Streams an uploaded file back as storage answered, `range` passed through
   * as a Range header, or resolves to undefined when there is no such file.
   * Only clients whose files live off the server have one: the /cgi routes
   * read the fs client's directory themselves.
   */
  readFileResponse?: (
    name: string,
    init: { range?: string }
  ) => Promise<Response | undefined>;
};

export type AssetObjectStore = AssetObjectWriter & AssetObjectReader;
