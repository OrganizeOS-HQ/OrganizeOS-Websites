import { useCallback, useEffect, useRef, useState } from "react";
import {
  Combobox,
  css,
  cssVar,
  Flex,
  Grid,
  NestedInputButton,
  SmallIconButton,
  theme,
} from "@webstudio-is/design-system";
import { XIcon } from "@webstudio-is/icons";
import { chunk } from "./cms-logic";
import {
  CMS_SEARCH_IDS_MAX,
  isCmsFailure,
  type CmsSearchResult,
  type CmsSource,
} from "./cms-source";
import { TruncatedText } from "./truncated-text";

/** A chosen item: a list row, filled only on hover, not an input. */
const chosenRowStyle = css({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing[3],
  minHeight: theme.sizes.controlHeight,
  paddingLeft: theme.spacing[3],
  paddingRight: theme.spacing[2],
  borderRadius: theme.borderRadius[4],
  "&:hover, &:focus-within": {
    background: cssVar("--overlay-interaction-hover"),
  },
});

type Option = { id?: string; title: string };

/** Titles of referenced items, read through E5 by id. */
const useReferenceTitles = (
  source: CmsSource,
  collectionId: string,
  ids: readonly string[]
) => {
  const [titles, setTitles] = useState<Record<string, string>>({});
  // A cache, not an input: the effect reads it without depending on it.
  const titlesRef = useRef(titles);
  titlesRef.current = titles;
  const key = ids.join(",");
  useEffect(() => {
    const missing = key
      .split(",")
      .filter((id) => id !== "" && titlesRef.current[id] === undefined);
    if (missing.length === 0) {
      return;
    }
    let isCurrent = true;
    // E5 takes at most 100 ids; a multi-reference holds up to 200
    for (const ids of chunk(missing, CMS_SEARCH_IDS_MAX)) {
      void source.searchItems(collectionId, { ids }).then((result) => {
        if (isCurrent && isCmsFailure(result) === false) {
          setTitles((current) => ({
            ...current,
            ...Object.fromEntries(
              result.items.map((item) => [item.id, item.title])
            ),
          }));
        }
      });
    }
    return () => {
      isCurrent = false;
    };
  }, [source, collectionId, key]);
  const remember = useCallback((item: CmsSearchResult) => {
    setTitles((current) => ({ ...current, [item.id]: item.title }));
  }, []);
  return { titles, remember };
};

/** A `Combobox` over the target collection's titles (E5). */
const ReferencePicker = ({
  id,
  source,
  collectionId,
  selected,
  excludeIds = [],
  disabled,
  color,
  placeholder,
  suffix,
  onSelect,
}: {
  id?: string;
  source: CmsSource;
  collectionId: string;
  selected: Option | null;
  excludeIds?: readonly string[];
  disabled?: boolean;
  color?: "error";
  placeholder?: string;
  suffix?: JSX.Element;
  onSelect: (item: CmsSearchResult) => void;
}) => {
  const [input, setInput] = useState<Option | undefined>(undefined);
  const [results, setResults] = useState<CmsSearchResult[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Only the newest search's answer lands: an older one never overwrites it.
  const sequence = useRef(0);

  const search = useCallback(
    (q: string) => {
      sequence.current += 1;
      const current = sequence.current;
      // `q: ""` lists the first 20 (the seam's contract for E5)
      void source.searchItems(collectionId, { q }).then((result) => {
        if (current === sequence.current && isCmsFailure(result) === false) {
          setResults(result.items);
        }
      });
    },
    [source, collectionId]
  );

  useEffect(() => {
    search("");
    return () => {
      clearTimeout(timer.current);
      // an answer after unmount is dropped
      sequence.current += 1;
    };
  }, [search]);

  return (
    <Combobox<Option>
      // Combobox takes no id; downshift gives the input its own, so the
      // label's htmlFor is written onto the element. The group's
      // aria-labelledby names it as well.
      inputRef={(element) => {
        if (element !== null && id !== undefined) {
          element.id = id;
        }
      }}
      value={input ?? selected}
      disabled={disabled}
      color={color}
      placeholder={placeholder}
      suffix={suffix}
      itemToString={(item) => item?.title ?? ""}
      getItems={() =>
        results.filter(
          (item) => excludeIds.includes(item.id) === false
        ) as Option[]
      }
      match={(query, items) =>
        items.filter((item) =>
          item.title.toLowerCase().includes(query.trim().toLowerCase())
        )
      }
      onChange={(text) => {
        if (text === undefined) {
          setInput(undefined);
          return;
        }
        setInput({ title: text });
        clearTimeout(timer.current);
        timer.current = setTimeout(() => search(text.trim()), 200);
      }}
      onItemSelect={(item) => {
        setInput(undefined);
        const match = results.find((result) => result.id === item.id);
        if (match !== undefined) {
          onSelect(match);
        }
      }}
    />
  );
};

export const ReferenceField = ({
  id,
  source,
  collectionId,
  value,
  disabled,
  invalid,
  onChange,
}: {
  id: string;
  source: CmsSource;
  collectionId: string;
  value: unknown;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: string | null) => void;
}) => {
  const selectedId =
    typeof value === "string" && value !== "" ? value : undefined;
  const { titles, remember } = useReferenceTitles(
    source,
    collectionId,
    selectedId === undefined ? [] : [selectedId]
  );
  const selected =
    selectedId === undefined
      ? null
      : { id: selectedId, title: titles[selectedId] ?? "" };
  return (
    <ReferencePicker
      id={id}
      source={source}
      collectionId={collectionId}
      selected={selected}
      disabled={disabled}
      color={invalid ? "error" : undefined}
      placeholder="Choose an item"
      suffix={
        selectedId !== undefined && disabled !== true ? (
          <Flex align="center">
            <NestedInputButton
              aria-label="Clear"
              onClick={() => onChange(null)}
            >
              <XIcon />
            </NestedInputButton>
          </Flex>
        ) : undefined
      }
      onSelect={(item) => {
        remember(item);
        onChange(item.id);
      }}
    />
  );
};

/**
 * The chosen titles in order, each with a remove button, then a picker to
 * add one. Reordering waits for slice 2.
 */
export const MultiReferenceField = ({
  id,
  source,
  collectionId,
  value,
  disabled,
  invalid,
  onChange,
}: {
  id: string;
  source: CmsSource;
  collectionId: string;
  value: unknown;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: string[]) => void;
}) => {
  const ids = Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
  const { titles, remember } = useReferenceTitles(source, collectionId, ids);
  return (
    <Grid gap="1">
      {ids.map((itemId) => (
        <div
          key={itemId}
          className={chosenRowStyle()}
          data-cms-reference={itemId}
        >
          <TruncatedText css={{ flexGrow: 1 }}>
            {titles[itemId] ?? ""}
          </TruncatedText>
          {disabled !== true && (
            <SmallIconButton
              aria-label={`Remove ${titles[itemId] ?? "item"}`}
              icon={<XIcon />}
              onClick={() => onChange(ids.filter((entry) => entry !== itemId))}
            />
          )}
        </div>
      ))}
      {disabled !== true && (
        <ReferencePicker
          id={id}
          source={source}
          collectionId={collectionId}
          selected={null}
          excludeIds={ids}
          color={invalid ? "error" : undefined}
          placeholder="Add an item"
          onSelect={(item) => {
            remember(item);
            onChange([...ids, item.id]);
          }}
        />
      )}
    </Grid>
  );
};
