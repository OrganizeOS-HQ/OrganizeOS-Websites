import { useCallback, useEffect, useRef, useState } from "react";
import {
  Combobox,
  cssVar,
  Flex,
  Grid,
  NestedInputButton,
  SmallIconButton,
  Text,
  theme,
  Tooltip,
} from "@webstudio-is/design-system";
import { XIcon, XSmallIcon } from "@webstudio-is/icons";
import {
  isCmsFailure,
  type CmsSearchResult,
  type CmsSource,
} from "./cms-source";

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
    void source.searchItems(collectionId, { ids: missing }).then((result) => {
      if (isCurrent && isCmsFailure(result) === false) {
        setTitles((current) => ({
          ...current,
          ...Object.fromEntries(
            result.items.map((item) => [item.id, item.title])
          ),
        }));
      }
    });
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

  const search = useCallback(
    (q: string) => {
      void source.searchItems(collectionId, { q }).then((result) => {
        if (isCmsFailure(result) === false) {
          setResults(result.items);
        }
      });
    },
    [source, collectionId]
  );

  useEffect(() => {
    search("");
    return () => clearTimeout(timer.current);
  }, [search]);

  return (
    <Combobox<Option>
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
        <Flex
          key={itemId}
          align="center"
          gap="1"
          data-cms-reference={itemId}
          css={{
            height: theme.sizes.controlHeight,
            paddingLeft: theme.spacing[3],
            paddingRight: theme.spacing[2],
            borderRadius: theme.borderRadius[4],
            background: cssVar("--background-secondary"),
          }}
        >
          <Tooltip content={titles[itemId] ?? ""} delayDuration={600}>
            <Text truncate css={{ flexGrow: 1 }}>
              {titles[itemId] ?? ""}
            </Text>
          </Tooltip>
          {disabled !== true && (
            <SmallIconButton
              aria-label={`Remove ${titles[itemId] ?? "item"}`}
              icon={<XSmallIcon />}
              onClick={() => onChange(ids.filter((entry) => entry !== itemId))}
            />
          )}
        </Flex>
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
