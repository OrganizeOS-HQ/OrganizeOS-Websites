import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  ComboboxAnchor,
  ComboboxContent,
  ComboboxListbox,
  ComboboxListboxItem,
  ComboboxRoot,
  ComboboxScrollArea,
  css,
  cssVar,
  Flex,
  Grid,
  InputField,
  NestedInputButton,
  SmallIconButton,
  theme,
  useCombobox,
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

/**
 * Titles of referenced items, read through E5 by id. An id E5 answered
 * without is `onUnresolvedChange`'s: an item that no longer exists.
 */
const useReferenceTitles = (
  source: CmsSource,
  collectionId: string,
  ids: readonly string[],
  onUnresolvedChange?: (ids: string[]) => void
) => {
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [dropped, setDropped] = useState<ReadonlySet<string>>(() => new Set());
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
          const found = new Set(result.items.map((item) => item.id));
          const gone = ids.filter((id) => found.has(id) === false);
          if (gone.length > 0) {
            setDropped((current) => new Set([...current, ...gone]));
          }
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
  // the latest callback: a new one never reports again on its own
  const onUnresolvedRef = useRef(onUnresolvedChange);
  onUnresolvedRef.current = onUnresolvedChange;
  const unresolvedKey = key
    .split(",")
    .filter((id) => dropped.has(id))
    .join(",");
  useEffect(() => {
    onUnresolvedRef.current?.(
      unresolvedKey === "" ? [] : unresolvedKey.split(",")
    );
  }, [unresolvedKey]);
  return { titles, remember };
};

/** A chosen or offered item's title, lower case, for the local match. */
const includesTerm = (item: Option, term: string) =>
  item.title.toLowerCase().includes(term.toLowerCase());

/**
 * A combobox over the target collection's titles (4.3.3): before a term,
 * its first page (E3, read when the field first takes the focus); with one,
 * E5's matches. Until E5 answers a term, the first page is matched locally.
 */
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
  const [firstPage, setFirstPage] = useState<CmsSearchResult[] | undefined>(
    undefined
  );
  const [found, setFound] = useState<
    { q: string; items: CmsSearchResult[] } | undefined
  >(undefined);
  // An answer arrived: the open list is drawn again from it.
  const [answers, setAnswers] = useState(0);
  const [reopen, setReopen] = useState(false);
  const fieldElement = useRef<HTMLDivElement | null>(null);
  const firstPageAsked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Only the newest search's answer lands: an older one never overwrites it.
  const sequence = useRef(0);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      clearTimeout(timer.current);
      sequence.current += 1;
    };
  }, []);

  // another target collection starts over
  useEffect(() => {
    firstPageAsked.current = false;
    setFirstPage(undefined);
    setFound(undefined);
  }, [source, collectionId]);

  const loadFirstPage = () => {
    if (firstPageAsked.current) {
      return;
    }
    firstPageAsked.current = true;
    void source.listItems(collectionId, { page: 1 }).then((result) => {
      if (isMounted.current === false) {
        return;
      }
      if (isCmsFailure(result)) {
        // the next focus asks again
        firstPageAsked.current = false;
        return;
      }
      setFirstPage(
        result.items.map(({ id, title, status }) => ({ id, title, status }))
      );
      setAnswers((current) => current + 1);
    });
  };

  const search = (q: string) => {
    sequence.current += 1;
    const current = sequence.current;
    void source.searchItems(collectionId, { q }).then((result) => {
      if (current !== sequence.current || isCmsFailure(result)) {
        return;
      }
      setFound({ q, items: result.items });
      setAnswers((count) => count + 1);
    });
  };

  const offered = (items: readonly CmsSearchResult[]) =>
    items.filter((item) => excludeIds.includes(item.id) === false);

  /** What the list offers for `query`: E5's answer for it, if any. */
  const itemsFor = (query: string): Option[] => {
    const term = query.trim();
    if (term === "") {
      return offered(firstPage ?? []);
    }
    if (found?.q === term) {
      return offered(found.items);
    }
    return offered(firstPage ?? []).filter((item) => includesTerm(item, term));
  };

  const combobox = useCombobox<Option>({
    value: input ?? selected,
    itemToString: (item) => item?.title ?? "",
    getItems: () => itemsFor(input?.title ?? ""),
    match: (query) => itemsFor(query),
    onChange: (text) => {
      clearTimeout(timer.current);
      if (text === undefined) {
        setInput(undefined);
        return;
      }
      setInput({ title: text });
      const term = text.trim();
      if (term === "") {
        // a cleared term: any search still in flight is dropped
        sequence.current += 1;
        return;
      }
      timer.current = setTimeout(() => search(term), 200);
    },
    onItemSelect: (item) => {
      setInput(undefined);
      const match = [...(firstPage ?? []), ...(found?.items ?? [])].find(
        (result) => result.id === item.id
      );
      if (match !== undefined) {
        onSelect(match);
      }
    },
  });

  // An answer for the field holding the focus draws the list again: the menu closes
  // and opens, which reads the items afresh.
  const menu = useRef(combobox);
  menu.current = combobox;
  useEffect(() => {
    if (
      answers === 0 ||
      fieldElement.current?.contains(document.activeElement) !== true
    ) {
      return;
    }
    if (menu.current.isOpen) {
      menu.current.closeMenu();
      setReopen(true);
    } else {
      menu.current.openMenu();
    }
  }, [answers]);
  const { isOpen, openMenu } = combobox;
  useEffect(() => {
    if (reopen && isOpen === false) {
      setReopen(false);
      openMenu();
    }
  }, [reopen, isOpen, openMenu]);

  const inputProps = combobox.getInputProps();
  return (
    <ComboboxRoot open={combobox.isOpen}>
      <Box {...combobox.getComboboxProps()}>
        <ComboboxAnchor>
          <InputField
            {...inputProps}
            // downshift gives the input its own id; the label's htmlFor is
            // written onto the element, and the group's aria-labelledby
            // names it as well
            containerRef={fieldElement}
            inputRef={(element) => {
              if (element !== null && id !== undefined) {
                element.id = id;
              }
            }}
            placeholder={placeholder}
            color={color}
            disabled={disabled}
            onFocus={loadFirstPage}
            // always a suffix: a field that gained one would mount its
            // input again and lose the focus
            suffix={
              suffix ?? (
                <Flex>
                  <NestedInputButton {...combobox.getToggleButtonProps()} />
                </Flex>
              )
            }
          />
        </ComboboxAnchor>
        <ComboboxContent>
          <ComboboxListbox {...combobox.getMenuProps()}>
            <ComboboxScrollArea>
              {combobox.isOpen &&
                combobox.items.map((item, index) => (
                  <ComboboxListboxItem
                    selectable={false}
                    {...combobox.getItemProps({ item, index })}
                    key={item.id ?? index}
                  >
                    {item.title}
                  </ComboboxListboxItem>
                ))}
            </ComboboxScrollArea>
          </ComboboxListbox>
        </ComboboxContent>
      </Box>
    </ComboboxRoot>
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
  onUnresolvedChange,
}: {
  id: string;
  source: CmsSource;
  collectionId: string;
  value: unknown;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: string | null) => void;
  /** The chosen id, when E5 no longer finds its item. */
  onUnresolvedChange?: (ids: string[]) => void;
}) => {
  const selectedId =
    typeof value === "string" && value !== "" ? value : undefined;
  const { titles, remember } = useReferenceTitles(
    source,
    collectionId,
    selectedId === undefined ? [] : [selectedId],
    onUnresolvedChange
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
  onUnresolvedChange,
}: {
  id: string;
  source: CmsSource;
  collectionId: string;
  value: unknown;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: string[]) => void;
  /** The chosen ids whose items E5 no longer finds. */
  onUnresolvedChange?: (ids: string[]) => void;
}) => {
  const ids = Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
  const { titles, remember } = useReferenceTitles(
    source,
    collectionId,
    ids,
    onUnresolvedChange
  );
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
