/**
 * The native CMS screen of slice 1 (OrganizeOS design
 * docs/superpowers/specs/2026-11-07-native-cms-in-the-builder-design.md,
 * 4.3): the collections column, then the items view or the item editor.
 *
 * Its state is local (D10): React state, and `$cmsNativeDirty`
 * (`cms-native-stores.ts`) for the window's `beforeunload`. Nothing here
 * reads or writes the build's stores; the host (`cms-native-screen.tsx`)
 * passes the door's `CmsSource`, the catalog join and the collection actions
 * in. It takes its callbacks as props, so this folder imports cms-panel.tsx
 * for types only.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useStore } from "@nanostores/react";
import {
  Box,
  Button,
  cssVar,
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogTitle,
  styled,
  toast,
} from "@webstudio-is/design-system";
import type { CmsDeepLink } from "../cms-panel";
import {
  getClassicDeepLink,
  getRefusal,
  getToastText,
  type CmsRefusal,
} from "./cms-logic";
import {
  adoptApplied,
  defaultListState,
  keepSelection,
  listKey,
  toItemsQuery,
  type CmsListState,
} from "./cms-list-logic";
import { $cmsNativeDirty, $cmsNativeRefresh } from "./cms-native-stores";
import {
  isCmsFailure,
  type CmsAccess,
  type CmsCollection,
  type CmsCollectionSummary,
  type CmsErrorCode,
  type CmsField,
  type CmsItem,
  type CmsItemsPage,
  type CmsSource,
} from "./cms-source";
import { CollectionsColumn } from "./collections-column";
import { ItemEditor } from "./item-editor";
import { ItemsView } from "./items-view";
import { RefusalLine, type CmsLineKind } from "./refusal-line";
import { createReorderState } from "./reorder-state";

export type CmsScreenView = {
  collectionId?: string;
  /** null: a new item. Absent: the items view. */
  itemId?: string | null;
  page?: number;
  query?: string;
  /** The list's filter and sort; the selection always starts empty. */
  list?: Pick<CmsListState, "status" | "sort" | "direction" | "option">;
};

export type CmsScreenProps = {
  /** Undefined without a project: the column title only, and no call. */
  source: CmsSource | undefined;
  /** The classic frame shows in its place (display: none). */
  hidden: boolean;
  /**
   * Shown to the person. Each change from false to true after the first is
   * a reopen (4.3.1, 4.7).
   */
  isVisible: boolean;
  /** Hides the overlay; never discards anything. */
  onClose: () => void;
  onShowClassic: (deepLink: CmsDeepLink) => void;
  /** The builder menu's "Back to OrganizeOS" address, for sign-in lines. */
  homeUrl?: string;
  /** Leaves the builder for `homeUrl`. */
  navigate?: (url: string) => void;
  /** After a write: the collection's canvas requests are invalidated (4.7). */
  onItemWritten?: (collectionSlug: string, item?: CmsItem) => void;
  /** Where to open; stories only. */
  initialView?: CmsScreenView;
  /**
   * The build's side of the column (4.5), for E1's collections: given only
   * where the collection actions are allowed; undefined until the build's
   * catalog has resolved.
   */
  catalogSlots?: (
    collections: readonly CmsCollectionSummary[]
  ) => CmsCatalogSlots | undefined;
};

/** What the column draws from the build's catalog (4.5). */
export type CmsCatalogSlots = {
  /** A row's "..." menu; null for a collection with no catalog Resource. */
  renderActions: (collection: CmsCollectionSummary) => ReactNode;
  /** The line under a row; null when its item page is not stale. */
  renderStaleLine: (collection: CmsCollectionSummary) => ReactNode;
  /** The orphan rows at the column's foot. */
  footer: ReactNode;
};

const Root = styled("div", {
  width: "100%",
  height: "100%",
  outline: "none",
  color: cssVar("--foreground-primary"),
});

const Main = styled("div", {
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  minWidth: 0,
  height: "100%",
});

const isSameAccess = (left: CmsAccess, right: CmsAccess) =>
  left.canEdit === right.canEdit &&
  left.canPublish === right.canPublish &&
  left.canManageSettings === right.canManageSettings;

/**
 * A read's failure (4.3.4): a read made while the editor holds unsaved values
 * maps as a write, so `forbidden` and `plan` are the toast ("toast") and the
 * editor keeps its values; `unauthorized` and `mfa_required` keep their
 * lines. Undefined: no refusal.
 */
const mapReadFailure = (
  code: CmsErrorCode
): CmsRefusal | "toast" | undefined => {
  const isDirty = $cmsNativeDirty.get();
  const refusal = getRefusal(code, isDirty ? "write" : "load");
  if (refusal === undefined && getRefusal(code, "load") !== undefined) {
    // one toast for the reads of one refetch
    toast.error(getToastText(code), { id: `cms-read-${code}` });
    return "toast";
  }
  return refusal;
};

/** What showed the screen's line: E0 and E1, the editor, E2 or E3. */
type LineCause = "load" | "editor" | "detail" | "page";

const defaultNavigate = (url: string) => {
  window.location.assign(url);
};

/**
 * Tells a background refetch from a foreground fetch: a fetch whose
 * foreground inputs (`key`) and source are those of the last fetch was asked
 * for only by a reopen or a refresh.
 */
const useIsBackgroundFetch = () => {
  const last = useRef<{ source: CmsSource; key: string } | undefined>(
    undefined
  );
  return useCallback((source: CmsSource, key: string) => {
    const isBackground =
      last.current?.source === source && last.current.key === key;
    last.current = { source, key };
    return isBackground;
  }, []);
};

export const CmsScreen = forwardRef<HTMLDivElement, CmsScreenProps>(
  (
    {
      source,
      hidden,
      isVisible,
      onClose,
      onShowClassic,
      homeUrl,
      navigate = defaultNavigate,
      onItemWritten,
      initialView,
      catalogSlots,
    },
    ref
  ) => {
    const [access, setAccess] = useState<CmsAccess | undefined>(undefined);
    const [line, setLine] = useState<CmsLineKind | undefined>(undefined);
    // The read whose refusal shows the line; that read's next answer
    // clears it. E0 and E1 also clear the editor's.
    const lineCause = useRef<LineCause | undefined>(undefined);
    const showLine = useCallback((kind: CmsLineKind, cause: LineCause) => {
      lineCause.current = cause;
      setLine(kind);
    }, []);
    const clearLine = useCallback((cause: Exclude<LineCause, "editor">) => {
      const current = lineCause.current;
      if (
        current === cause ||
        (cause === "load" && (current === "editor" || current === undefined))
      ) {
        lineCause.current = undefined;
        setLine(undefined);
      }
    }, []);
    const onEditorRefusal = useCallback(
      (refusal: CmsRefusal) => showLine(refusal, "editor"),
      [showLine]
    );
    const [collections, setCollections] = useState<CmsCollectionSummary[]>([]);
    const [collectionId, setCollectionId] = useState(initialView?.collectionId);
    const [itemId, setItemId] = useState(initialView?.itemId);
    const [page, setPage] = useState(initialView?.page ?? 1);
    const [query, setQuery] = useState(initialView?.query ?? "");
    // The filter, sort and selection of the open collection: one value,
    // keyed by the collection id and read as the defaults for any other
    // (W3-D1). `selectCollection` and the reset effect are not edited.
    const [listState, setListState] = useState<CmsListState>(() => ({
      ...defaultListState(initialView?.collectionId),
      ...(initialView?.list ?? {}),
    }));
    const list =
      listState.collectionId === collectionId
        ? listState
        : defaultListState(collectionId);
    // The latest list state, for E3's effect, which reruns on the list's key
    // only: a selection change asks E3 nothing.
    const listStateRef = useRef(listState);
    listStateRef.current = listState;
    const openListKey = listKey(list);
    // Bumped on every E3 answer for the current key, success or failure; a
    // reorder's wait reads it (Task 18).
    const [pageAnswer, setPageAnswer] = useState({ count: 0, ok: true });
    // The items table's reorder state, kept while the table remounts (an
    // item visit, the page line); other views read whether an E13 is in
    // flight from it.
    const [reorderState] = useState(createReorderState);
    reorderState.notePageAnswer(pageAnswer.count);
    const [itemsPage, setItemsPage] = useState<CmsItemsPage | undefined>(
      undefined
    );
    const [detail, setDetail] = useState<CmsCollection | undefined>(undefined);
    const [detailFailed, setDetailFailed] = useState(false);
    const [detailAttempt, setDetailAttempt] = useState(0);
    const [pageFailed, setPageFailed] = useState(false);
    // The collection whose E3 failed with no page drawn, so its line shows:
    // a failed E2 there adds no toast.
    const pageLineFor = useRef<string | undefined>(undefined);
    // The toast a failed E2 showed with no fields drawn, and its collection.
    const detailToast = useRef<
      { collectionId: string; id: string } | undefined
    >(undefined);
    const [pageAttempt, setPageAttempt] = useState(0);
    const [isEditorDirty, setIsEditorDirty] = useState(false);
    const [pending, setPending] = useState<
      { run: () => void; movesFocus: boolean } | undefined
    >(undefined);
    // Discard's action that moves the focus, run once the dialog has closed
    // so the dialog neither keeps nor returns the focus.
    const runOnDialogClose = useRef<(() => void) | undefined>(undefined);
    const [attempt, setAttempt] = useState(0);
    // A new editor for each item opened; a created item keeps its editor.
    const [editorSession, setEditorSession] = useState(0);
    const [listVersion, setListVersion] = useState(0);
    const [focusBack, setFocusBack] = useState(false);
    const [returnFocusItemId, setReturnFocusItemId] = useState<
      string | undefined
    >(undefined);
    // The item the editor's Delete removed: the list focuses its first other
    // row, else New item (W3-D6).
    const [deletedItemId, setDeletedItemId] = useState<string | undefined>(
      undefined
    );
    // The times the screen has been shown: the first is the open, each
    // later one a reopen.
    const [opens, setOpens] = useState(0);
    const refresh = useStore($cmsNativeRefresh);
    const refreshAtMount = useRef(refresh);
    const keepEditingRef = useRef<HTMLButtonElement>(null);
    const isReady = access !== undefined;
    const isLoadBackground = useIsBackgroundFetch();
    const isDetailBackground = useIsBackgroundFetch();
    const isPageBackground = useIsBackgroundFetch();
    // read at E3's answer: whether a page is drawn to keep
    const hasItemsPage = useRef(false);
    hasItemsPage.current = itemsPage !== undefined;
    // read at E2's answer: the collection whose fields are drawn
    const drawnDetailId = useRef<string | undefined>(undefined);
    drawnDetailId.current = detail?.id;
    // set when E2 (or the schema refresh) answers, read at E3's answer: the
    // fields loaded for a collection, so a missing-column check does not race
    // E2's own answer on the first load
    const loadedFields = useRef<{ id: string; fields: CmsField[] } | undefined>(
      undefined
    );
    // The column keys an E3 answer asked the schema refresh for and that the
    // refresh did not supply, so the same still-missing key is not asked
    // again. A key the fields now carry, or another collection, clears it.
    const refreshedMissing = useRef<Set<string>>(new Set());
    const refetchFieldsRef = useRef<(() => Promise<void>) | undefined>(
      undefined
    );
    // The field keys (columns, filter field, option key) the last E3
    // answer named, and its collection.
    const drawnPageWanted = useRef<
      { collectionId: string; wanted: string[] } | undefined
    >(undefined);
    // The collection whose foreground E2 failed with no fields drawn: its
    // next E3 answer asks for the fields once more.
    const detailFailedFor = useRef<string | undefined>(undefined);
    // read when a schema refresh answers: the collection open now
    const openCollectionId = useRef(collectionId);
    openCollectionId.current = collectionId;
    // read when E2 fails: whether the editor shows, so its line is the one
    const isItemOpen = useRef(false);
    isItemOpen.current = itemId !== undefined;
    const applyLoadedFields = (loaded: CmsCollection) => {
      if (loadedFields.current?.id !== loaded.id) {
        refreshedMissing.current = new Set();
      }
      loadedFields.current = { id: loaded.id, fields: loaded.fields };
      for (const field of loaded.fields) {
        refreshedMissing.current.delete(field.key);
      }
    };
    // The collection, search, page number, list key and filter and sort of
    // the page drawn.
    const drawnPage = useRef<
      | {
          collectionId: string;
          query: string;
          page: number;
          listKey: string;
          list: Pick<CmsListState, "status" | "sort" | "direction" | "option">;
        }
      | undefined
    >(undefined);
    // The E3 inputs whose answer is already drawn: a page E3 answered in
    // place of the one asked for.
    const adoptedPageKey = useRef<string | undefined>(undefined);

    useEffect(() => {
      if (isVisible) {
        setOpens((current) => current + 1);
      }
    }, [isVisible]);

    // E0 and E1, on open, on each reopen and on Retry (which reads E2 and
    // E3 again too).
    useEffect(() => {
      if (source === undefined || opens === 0) {
        return;
      }
      const isBackground = isLoadBackground(source, String(attempt));
      const effect = { isCurrent: true };
      // a function: narrowing would outlive the awaits
      const isStale = () => effect.isCurrent === false;
      // A refusal always shows its line; any other failure only on a
      // fetch the person asked for, so a background one changes nothing.
      const onFailure = (error: CmsErrorCode) => {
        const refusal = mapReadFailure(error);
        if (refusal === "toast") {
          return;
        }
        if (refusal !== undefined) {
          showLine(refusal, "load");
        } else if (isBackground === false) {
          showLine("unavailable", "load");
        }
      };
      const load = async () => {
        const accessResult = await source.getAccess();
        if (isStale()) {
          return;
        }
        if (isCmsFailure(accessResult)) {
          onFailure(accessResult.error);
          return;
        }
        const listResult = await source.listCollections();
        if (isStale()) {
          return;
        }
        if (isCmsFailure(listResult)) {
          onFailure(listResult.error);
          return;
        }
        clearLine("load");
        // with no collection, no E2 or E3 is left to clear their line
        if (listResult.collections.length === 0) {
          lineCause.current = undefined;
          setLine(undefined);
        }
        setAccess((current) =>
          current !== undefined && isSameAccess(current, accessResult)
            ? current
            : accessResult
        );
        setCollections(listResult.collections);
      };
      void load();
      return () => {
        effect.isCurrent = false;
      };
    }, [source, attempt, opens, isLoadBackground, showLine, clearLine]);

    // E1 alone after each write, here or in the classic frame, silently.
    useEffect(() => {
      if (source === undefined || isReady === false) {
        return;
      }
      if (listVersion === 0 && refresh === refreshAtMount.current) {
        return;
      }
      let isCurrent = true;
      void source.listCollections().then((result) => {
        if (isCurrent && isCmsFailure(result) === false) {
          setCollections(result.collections);
        }
      });
      return () => {
        isCurrent = false;
      };
    }, [source, isReady, listVersion, refresh]);

    // The open collection is a listed one. While an item is open it stays,
    // listed or not, so its editor and edits stay; the first collection
    // opens once the editor closes.
    useEffect(() => {
      if (isReady === false || itemId !== undefined) {
        return;
      }
      if (collections.some((entry) => entry.id === collectionId)) {
        return;
      }
      const first = collections[0]?.id;
      if (first === collectionId) {
        return;
      }
      setItemsPage(undefined);
      setDetail(undefined);
      setPage(1);
      setQuery("");
      setCollectionId(first);
    }, [isReady, itemId, collectionId, collections]);

    // E2: the open collection's fields.
    useEffect(() => {
      if (
        source === undefined ||
        collectionId === undefined ||
        isReady === false
      ) {
        return;
      }
      const isBackground = isDetailBackground(
        source,
        JSON.stringify([collectionId, detailAttempt, attempt])
      );
      let isCurrent = true;
      if (isBackground === false) {
        setDetailFailed(false);
      }
      void source.getCollection(collectionId).then((result) => {
        if (isCurrent === false) {
          return;
        }
        if (isCmsFailure(result)) {
          const refusal = mapReadFailure(result.error);
          if (refusal === "toast") {
            return;
          }
          if (refusal !== undefined) {
            showLine(refusal, "detail");
          } else if (isBackground === false) {
            // with this collection's fields drawn, the editor and its edits
            // stay, with the toast (one for the reads of one Retry); with
            // none, the line
            if (drawnDetailId.current === collectionId) {
              toast.error(getToastText(result.error), {
                id: `cms-read-${result.error}`,
              });
            } else {
              setDetailFailed(true);
              detailFailedFor.current = collectionId;
              refreshedMissing.current = new Set();
              // fields loaded on an earlier visit are not this answer's: the
              // next E3 answer asks for them again
              if (loadedFields.current?.id === collectionId) {
                loadedFields.current = undefined;
              }
              // this collection's page answered first: its field keys ask
              // for the fields once more now
              const answered = drawnPageWanted.current;
              if (
                answered !== undefined &&
                answered.collectionId === collectionId &&
                answered.wanted.length > 0
              ) {
                for (const entry of answered.wanted) {
                  refreshedMissing.current.add(entry);
                }
                void refetchFieldsRef.current?.();
              }
              // the list has no line for it: the toast, unless E3's line
              // shows, and its next E3 answer asks for the fields again
              if (
                isItemOpen.current === false &&
                pageLineFor.current !== collectionId
              ) {
                const id = `cms-read-${result.error}`;
                detailToast.current = { collectionId, id };
                toast.error(getToastText(result.error), { id });
              }
            }
          }
          return;
        }
        clearLine("detail");
        setDetailFailed(false);
        detailFailedFor.current = undefined;
        detailToast.current = undefined;
        applyLoadedFields(result.collection);
        setDetail(result.collection);
      });
      return () => {
        isCurrent = false;
      };
    }, [
      source,
      collectionId,
      isReady,
      detailAttempt,
      attempt,
      opens,
      refresh,
      isDetailBackground,
      showLine,
      clearLine,
    ]);

    // E3: the open page of items.
    useEffect(() => {
      if (
        source === undefined ||
        collectionId === undefined ||
        isReady === false
      ) {
        return;
      }
      // the open collection's list state, or the defaults for any other
      const effectList =
        listStateRef.current.collectionId === collectionId
          ? listStateRef.current
          : defaultListState(collectionId);
      const currentListKey = listKey(effectList);
      const keyFor = (pageNumber: number, forListKey: string) =>
        JSON.stringify([
          collectionId,
          pageNumber,
          query,
          listVersion,
          pageAttempt,
          attempt,
          forListKey,
        ]);
      const key = keyFor(page, currentListKey);
      const isBackground = isPageBackground(source, key);
      // the page E3 answered in place of the one asked for is drawn already
      if (adoptedPageKey.current === key) {
        adoptedPageKey.current = undefined;
        return;
      }
      adoptedPageKey.current = undefined;
      let isCurrent = true;
      if (isBackground === false) {
        setPageFailed(false);
        pageLineFor.current = undefined;
      }
      void source
        .listItems(collectionId, toItemsQuery(effectList, query, page))
        .then((result) => {
          if (isCurrent === false) {
            return;
          }
          // every answer for the current key is counted, success or failure
          setPageAnswer((current) => ({
            count: current.count + 1,
            ok: isCmsFailure(result) === false,
          }));
          if (isCmsFailure(result)) {
            const refusal = mapReadFailure(result.error);
            if (refusal === "toast") {
              return;
            }
            if (refusal !== undefined) {
              showLine(refusal, "page");
            } else if (isBackground === false) {
              // a page on screen stays, with the toast; with none drawn,
              // the line and its Retry (4.3.4)
              if (hasItemsPage.current) {
                // a filter or sort a platform without slice 2's keys refuses
                // as invalid is a passing state, not the person's input
                const text =
                  result.error === "invalid" &&
                  currentListKey !== listKey(defaultListState(collectionId))
                    ? getToastText("unavailable")
                    : getToastText(result.error);
                toast.error(text, { id: `cms-read-${result.error}` });
                // a failed page, filter or sort change goes back to the
                // drawn page number and list state, unread, so the pager and
                // the menus show what the rows on screen are (6.1); a failed
                // search keeps the page it asked for
                const drawn = drawnPage.current;
                if (
                  drawn !== undefined &&
                  drawn.collectionId === collectionId &&
                  drawn.query === query &&
                  (drawn.listKey !== currentListKey || drawn.page !== page)
                ) {
                  adoptedPageKey.current = keyFor(drawn.page, drawn.listKey);
                  if (drawn.listKey !== currentListKey) {
                    setListState((current) =>
                      current.collectionId === collectionId
                        ? { ...current, ...drawn.list }
                        : current
                    );
                  }
                  if (drawn.page !== page) {
                    setPage(drawn.page);
                  }
                }
              } else {
                setPageFailed(true);
                pageLineFor.current = collectionId;
                // the line says what a failed E2's toast said
                if (detailToast.current?.collectionId === collectionId) {
                  toast.dismiss(detailToast.current.id);
                  detailToast.current = undefined;
                }
              }
            }
            return;
          }
          clearLine("page");
          setPageFailed(false);
          pageLineFor.current = undefined;
          setItemsPage(result);
          {
            const drawnList = adoptApplied(effectList, result.applied);
            drawnPage.current = {
              collectionId,
              query,
              page: result.page,
              listKey: listKey(drawnList),
              list: {
                status: drawnList.status,
                sort: drawnList.sort,
                direction: drawnList.direction,
                option: drawnList.option,
              },
            };
          }
          // the answer's applied filter and sort are adopted without a
          // second E3; the selection keeps only the rows still shown
          const nextListKey = listKey(adoptApplied(effectList, result.applied));
          // adopting the answer's page (a page past the end answers the last
          // one, A4) or its applied filter and sort moves the key the effect
          // reads, so the next run is skipped: its data is already drawn and
          // no second E3 is asked
          if (nextListKey !== currentListKey || result.page !== page) {
            adoptedPageKey.current = keyFor(result.page, nextListKey);
          }
          setListState((current) => {
            const base =
              current.collectionId === collectionId ? current : effectList;
            const adopted = adoptApplied(base, result.applied);
            const kept = keepSelection(adopted.selected, result.items);
            const next =
              kept.size === adopted.selected.size
                ? adopted
                : { ...adopted, selected: kept };
            // the state now belongs to this collection, so another's is
            // never kept for when it opens again
            return next === current ? current : next;
          });
          if (result.page !== page) {
            setPage(result.page);
          }
          // a columns, filterField or option key the cached fields lack
          // refreshes the schema once (6.1), only while this collection's
          // fields are loaded
          // a collection whose E2 failed has none: every key is missing
          const wanted = [
            ...result.columns,
            result.filterField,
            result.applied.optionKey,
          ].filter((entry): entry is string => typeof entry === "string");
          drawnPageWanted.current = { collectionId, wanted };
          const fieldsLoaded = loadedFields.current?.id === collectionId;
          if (fieldsLoaded || detailFailedFor.current === collectionId) {
            const have = new Set(
              fieldsLoaded
                ? (loadedFields.current?.fields ?? []).map((field) => field.key)
                : []
            );
            const missing = wanted.filter((entry) => have.has(entry) === false);
            if (
              missing.some(
                (entry) => refreshedMissing.current.has(entry) === false
              )
            ) {
              for (const entry of missing) {
                refreshedMissing.current.add(entry);
              }
              void refetchFieldsRef.current?.();
            }
          }
        });
      return () => {
        isCurrent = false;
      };
    }, [
      source,
      collectionId,
      isReady,
      page,
      query,
      openListKey,
      listVersion,
      pageAttempt,
      attempt,
      opens,
      refresh,
      isPageBackground,
      showLine,
      clearLine,
    ]);

    useEffect(() => {
      $cmsNativeDirty.set(isEditorDirty);
    }, [isEditorDirty]);
    useEffect(() => () => $cmsNativeDirty.set(false), []);

    /**
     * The unsaved guard: back, another item or collection, Classic CMS.
     * `movesFocus`: after Discard, the action runs once the dialog has
     * closed.
     */
    const guard = (run: () => void, { movesFocus = false } = {}) => {
      if (isEditorDirty) {
        setPending({ run, movesFocus });
        return;
      }
      run();
    };

    // The open collection's summary. An open editor keeps the last one E1
    // gave, so a refetch that no longer lists it never unmounts the editor.
    const listedCollection = collections.find(
      (entry) => entry.id === collectionId
    );
    const lastCollection = useRef<CmsCollectionSummary | undefined>(undefined);
    if (listedCollection !== undefined) {
      lastCollection.current = listedCollection;
    }
    const collection =
      listedCollection ??
      (itemId !== undefined && lastCollection.current?.id === collectionId
        ? lastCollection.current
        : undefined);

    // While the editor's Save, Publish, Discard changes, Unpublish, Archive
    // or Restore runs (every call and the read after), Back, another
    // collection and Classic CMS wait for it to end, then run the guard on
    // what it left.
    const [isEditorBusy, setIsEditorBusy] = useState(false);
    const isEditorBusyRef = useRef(false);
    isEditorBusyRef.current = isEditorBusy;
    const afterEditorBusy = useRef<(() => void) | undefined>(undefined);
    const whenEditorIdle = (run: () => void) => {
      if (isEditorBusyRef.current) {
        afterEditorBusy.current = run;
        return;
      }
      run();
    };
    useEffect(() => {
      const run = afterEditorBusy.current;
      if (isEditorBusy || run === undefined) {
        return;
      }
      afterEditorBusy.current = undefined;
      run();
    }, [isEditorBusy]);
    const onEditorBusyChange = useCallback((busy: boolean, stay?: boolean) => {
      // an error the editor shows keeps it open: what waited is dropped
      if (busy === false && stay === true) {
        afterEditorBusy.current = undefined;
      }
      setIsEditorBusy(busy);
    }, []);

    const selectCollectionNow = (nextId: string) =>
      guard(() => {
        setIsEditorDirty(false);
        if (nextId !== collectionId) {
          setItemsPage(undefined);
          setDetail(undefined);
        }
        setCollectionId(nextId);
        setItemId(undefined);
        setPage(1);
        setQuery("");
        setReturnFocusItemId(undefined);
        setDeletedItemId(undefined);
      });

    const openItem = (nextId: string | null) => {
      // Back shows the list selection-free (5.1.5)
      setListState((current) =>
        current.selected.size === 0
          ? current
          : { ...current, selected: new Set<string>() }
      );
      setEditorSession((current) => current + 1);
      setFocusBack(true);
      setReturnFocusItemId(undefined);
      setDeletedItemId(undefined);
      setItemId(nextId);
    };

    const closeEditorNow = () =>
      guard(() => {
        setIsEditorDirty(false);
        setReturnFocusItemId(itemId ?? undefined);
        setItemId(undefined);
      });

    const onDirtyChange = useCallback((dirty: boolean) => {
      setIsEditorDirty(dirty);
    }, []);
    const onDeletedFocused = useCallback(() => {
      setDeletedItemId(undefined);
    }, []);

    /**
     * A write refused for the shape of its data: the open collection's
     * fields are read again, in the background, so the next Save sends the
     * current keys. A failure changes nothing on screen but a refusal's line.
     */
    const refetchFields = async () => {
      if (source === undefined || collectionId === undefined) {
        return;
      }
      const result = await source.getCollection(collectionId);
      // another collection opened meanwhile: this answer is not its
      if (openCollectionId.current !== collectionId) {
        return;
      }
      if (isCmsFailure(result)) {
        const refusal = mapReadFailure(result.error);
        if (refusal !== undefined && refusal !== "toast") {
          showLine(refusal, "detail");
        }
        return;
      }
      if (result.collection.id !== collectionId) {
        return;
      }
      clearLine("detail");
      setDetailFailed(false);
      detailFailedFor.current = undefined;
      detailToast.current = undefined;
      applyLoadedFields(result.collection);
      setDetail((current) =>
        current === undefined || current.id === result.collection.id
          ? result.collection
          : current
      );
    };
    // the latest refetchFields, so the E3 effect can run it without taking it
    // as a dependency (it is rebuilt each render)
    refetchFieldsRef.current = refetchFields;

    const onWritten = (item?: CmsItem) => {
      setListVersion((current) => current + 1);
      if (collection !== undefined) {
        onItemWritten?.(collection.slug, item);
      }
    };

    // The editor's Delete: the editor closes without the guard, the lists
    // refetch under the open filter, and the canvas invalidates. The deleted
    // row no longer takes the focus back: the table's first row does.
    const onDeleted = () => {
      setIsEditorDirty(false);
      $cmsNativeDirty.set(false);
      setReturnFocusItemId(undefined);
      setDeletedItemId(itemId ?? undefined);
      setItemId(undefined);
      onWritten();
    };

    // The list's filter, sort or selection changed (Tasks 16 to 18): a filter
    // or sort change goes back to page 1; the E3 effect refetches.
    const onListChange = (next: CmsListState) => {
      const sortChanged =
        next.status !== list.status ||
        next.sort !== list.sort ||
        next.direction !== list.direction ||
        (next.option?.key ?? null) !== (list.option?.key ?? null) ||
        (next.option?.value ?? null) !== (list.option?.value ?? null);
      setListState(next);
      if (sortChanged) {
        setPage(1);
        setReturnFocusItemId(undefined);
      }
    };

    /**
     * Classic CMS (4.6), from the column's menu or a read-only rich text:
     * the guard, then the frame on what is open here.
     */
    const showClassicNow = () =>
      guard(() => onShowClassic(getClassicDeepLink(collection, itemId)), {
        movesFocus: true,
      });

    // the latest of each, for a run that waited on the editor
    const nowActions = useRef({
      selectCollectionNow,
      closeEditorNow,
      showClassicNow,
    });
    nowActions.current = {
      selectCollectionNow,
      closeEditorNow,
      showClassicNow,
    };
    const selectCollection = (nextId: string) =>
      whenEditorIdle(() => nowActions.current.selectCollectionNow(nextId));
    const closeEditor = () =>
      whenEditorIdle(() => nowActions.current.closeEditorNow());
    const showClassic = () =>
      whenEditorIdle(() => nowActions.current.showClassicNow());

    /** `unauthorized` (4.3.4): the guard, then this tab to the home address. */
    const onOpenHome =
      homeUrl === undefined
        ? undefined
        : () =>
            guard(() => {
              setIsEditorDirty(false);
              navigate(homeUrl);
            });

    const renderView = () => {
      if (
        source === undefined ||
        access === undefined ||
        collection === undefined
      ) {
        return null;
      }
      if (itemId !== undefined) {
        if (detailFailed) {
          return (
            <RefusalLine
              kind="unavailable"
              onRetry={() => setDetailAttempt((current) => current + 1)}
            />
          );
        }
        if (detail === undefined || detail.id !== collection.id) {
          return null;
        }
        return (
          <ItemEditor
            key={`${detail.id}:${editorSession}`}
            source={source}
            access={access}
            collection={detail}
            itemId={itemId}
            homeUrl={homeUrl}
            focusBack={focusBack}
            refreshKey={opens + refresh}
            onBack={closeEditor}
            onDirtyChange={onDirtyChange}
            onBusyChange={onEditorBusyChange}
            onWritten={onWritten}
            onDeleted={onDeleted}
            onCreated={(item) => setItemId(item.id)}
            onSchemaStale={refetchFields}
            onRefusal={onEditorRefusal}
            onOpenHome={onOpenHome}
            onOpenClassic={showClassic}
          />
        );
      }
      // the drawn page is the one the open search, filter and sort asked for,
      // and its search is empty
      const drawn = drawnPage.current;
      const drawnQueryEmpty =
        drawn !== undefined &&
        drawn.collectionId === collection.id &&
        drawn.query === query &&
        drawn.listKey === openListKey &&
        query.trim() === "";
      if (pageFailed && itemsPage === undefined) {
        return (
          <RefusalLine
            kind="unavailable"
            onRetry={() => setPageAttempt((current) => current + 1)}
          />
        );
      }
      return (
        <ItemsView
          collection={collection}
          page={itemsPage}
          query={query}
          drawnQueryEmpty={drawnQueryEmpty}
          canEdit={access.canEdit}
          canPublish={access.canPublish}
          focusItemId={returnFocusItemId}
          deletedItemId={deletedItemId}
          onDeletedFocused={onDeletedFocused}
          source={source}
          fields={detail?.id === collection.id ? detail.fields : undefined}
          list={list}
          pageAnswer={pageAnswer}
          reorderState={reorderState}
          onListChange={onListChange}
          onListWritten={onWritten}
          onRefusal={onEditorRefusal}
          onQueryChange={(next) => {
            setQuery(next);
            setPage(1);
            setReturnFocusItemId(undefined);
          }}
          onPageChange={(next) => {
            // a page already asked for (its read failed) is asked again
            if (next === page) {
              setPageAttempt((current) => current + 1);
            } else {
              setPage(next);
            }
            setReturnFocusItemId(undefined);
          }}
          onOpenItem={(nextId) => openItem(nextId)}
          onNewItem={() => openItem(null)}
        />
      );
    };

    return (
      <Root
        ref={ref}
        data-cms-native-screen
        // popups that float panels anchor here (4.2.7)
        data-floating-panel-container
        // the overlay focuses the screen on open (4.2.5)
        tabIndex={-1}
        style={{ display: hidden ? "none" : "flex" }}
      >
        <CollectionsColumn
          collections={collections}
          currentCollectionId={line === undefined ? collectionId : undefined}
          slots={isReady ? catalogSlots?.(collections) : undefined}
          onSelectCollection={selectCollection}
          onShowClassic={showClassic}
          onClose={onClose}
        />
        {/* without a source, nothing loads and the main region stays empty */}
        <Main data-cms-native-main>
          {source !== undefined && line !== undefined && (
            <RefusalLine
              kind={line}
              homeUrl={homeUrl}
              onOpenHome={onOpenHome}
              onRetry={() => setAttempt((current) => current + 1)}
            />
          )}
          {/* a refusal on reopen hides the view and keeps its edits */}
          {source !== undefined && (
            <Box
              css={{
                display: line === undefined ? "flex" : "none",
                flexDirection: "column",
                flexGrow: 1,
                minHeight: 0,
              }}
            >
              {renderView()}
            </Box>
          )}
        </Main>
        <Dialog
          open={pending !== undefined}
          onOpenChange={(open) => {
            if (open === false) {
              setPending(undefined);
            }
          }}
        >
          <DialogContent
            width={420}
            aria-describedby={undefined}
            // the safe choice takes the first focus; Discard stays right
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              keepEditingRef.current?.focus();
            }}
            onCloseAutoFocus={(event) => {
              const run = runOnDialogClose.current;
              if (run !== undefined) {
                runOnDialogClose.current = undefined;
                event.preventDefault();
                run();
              }
            }}
          >
            <DialogActions>
              <Button
                color="destructive"
                onClick={() => {
                  const next = pending;
                  setPending(undefined);
                  setIsEditorDirty(false);
                  // cleared before the action runs, so leaving the builder
                  // never meets the unsaved prompt
                  $cmsNativeDirty.set(false);
                  // the editor reads its item again (or opens empty), so an
                  // editor only hidden by the action keeps no discarded edit
                  setFocusBack(false);
                  setEditorSession((current) => current + 1);
                  if (next?.movesFocus) {
                    runOnDialogClose.current = next.run;
                  } else {
                    next?.run();
                  }
                }}
              >
                Discard
              </Button>
              <DialogClose>
                <Button ref={keepEditingRef} color="ghost">
                  Keep editing
                </Button>
              </DialogClose>
            </DialogActions>
            {/* last in the DOM, so the close button is last in tab order */}
            <DialogTitle>Discard unsaved changes?</DialogTitle>
          </DialogContent>
        </Dialog>
      </Root>
    );
  }
);
CmsScreen.displayName = "CmsScreen";
