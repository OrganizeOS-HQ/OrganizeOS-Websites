import { atom } from "nanostores";
import { useStore } from "@nanostores/react";
import {
  Flex,
  Collapsible,
  SectionTitle,
  SectionTitleLabel,
  SectionTitleButton,
  Separator,
  theme,
} from "@webstudio-is/design-system";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { PlusIcon } from "@webstudio-is/icons";
import type { Simplify } from "type-fest";

type Label = string;

type State = {
  [label: string]: boolean;
};

// Preserves the open/close state even when component gets unmounted
const $state = atom<State>({});

// OrganizeOS fork: sections that start closed (CSS preview, the style panel's
// Advanced); opening every section ("*") leaves them as the person left them
const defaultClosed = new Set<Label>();

type HandleOpenState = (
  label: Label,
  isOpenForced?: boolean,
  // OrganizeOS fork: the state before the person opens or closes the section
  defaultOpen?: boolean
) => [boolean, (value: boolean) => void];

const CollapsibleSectionContext = createContext<
  | undefined
  | {
      handleOpenState: HandleOpenState;
    }
>(undefined);

export const CollapsibleProvider = ({
  children,
  accordion,
  initialOpen,
}: {
  children: ReactNode;
  accordion?: boolean;
  initialOpen?: Label;
}) => {
  const state = useStore($state);
  useEffect(() => {
    const nextState = { ...$state.get() };

    if (initialOpen === "*") {
      for (const key in nextState) {
        // OrganizeOS fork: a section that starts closed keeps its own state
        if (defaultClosed.has(key)) {
          continue;
        }
        nextState[key] = true;
      }
      $state.set(nextState);
      return;
    }

    if (accordion) {
      for (const key in nextState) {
        nextState[key] = false;
      }
    }

    if (initialOpen) {
      nextState[initialOpen] = true;
    }
    $state.set(nextState);
  }, [accordion, initialOpen]);

  const handleOpenState: HandleOpenState = useCallback(
    (label, isOpenForced, defaultOpen) => {
      const nextState = { ...state };
      if (nextState[label] === undefined) {
        // OrganizeOS fork: defaultOpen
        nextState[label] = accordion ? false : (defaultOpen ?? true);
      }

      const setIsOpen = (isOpen: boolean) => {
        if (accordion) {
          for (const key in nextState) {
            nextState[key] = false;
          }
        }
        nextState[label] = isOpen;
        $state.set(nextState);
      };

      return [isOpenForced ?? nextState[label], setIsOpen];
    },
    [state, accordion]
  );

  return (
    <CollapsibleSectionContext.Provider value={{ handleOpenState }}>
      {children}
    </CollapsibleSectionContext.Provider>
  );
};

export const useOpenState: HandleOpenState = (label, isOpen, defaultOpen) => {
  const context = useContext(CollapsibleSectionContext);
  // OrganizeOS fork: defaultOpen
  if (defaultOpen === false) {
    defaultClosed.add(label);
  } else if (defaultOpen === true) {
    defaultClosed.delete(label);
  }
  const localState = useState(isOpen ?? defaultOpen ?? true);
  if (context === undefined) {
    return localState;
  }
  return context.handleOpenState(label, isOpen, defaultOpen);
};

type CollapsibleSectionBaseProps = {
  trigger?: ReactNode;
  children: ReactNode;
  fullWidth?: boolean;
  showSeparator?: boolean;
  label?: string;
  isOpen?: boolean;
  onOpenChange?: (value: boolean) => void;
};

export const CollapsibleSectionRoot = ({
  label,
  trigger,
  children,
  fullWidth = false,
  showSeparator = true,
  isOpen,
  onOpenChange,
}: CollapsibleSectionBaseProps) => {
  return (
    <Collapsible.Root defaultOpen open={isOpen} onOpenChange={onOpenChange}>
      <Collapsible.Trigger asChild>
        {trigger ?? (
          <SectionTitle>
            <SectionTitleLabel>{label ?? ""}</SectionTitleLabel>
          </SectionTitle>
        )}
      </Collapsible.Trigger>

      <Collapsible.Content asChild>
        <Flex
          gap="2"
          direction="column"
          css={{
            pb: theme.panel.paddingBlock,
            px: fullWidth ? 0 : theme.panel.paddingInline,
            paddingTop: 0,
            "&:empty": { display: "none" },
          }}
        >
          {children}
        </Flex>
      </Collapsible.Content>
      {showSeparator && <Separator />}
    </Collapsible.Root>
  );
};

type CollapsibleSectionProps = Simplify<
  Omit<CollapsibleSectionBaseProps, "onOpenChange"> & {
    label: Label;
    // OrganizeOS fork: the state before the person opens or closes it
    defaultOpen?: boolean;
  }
>;

export const CollapsibleSection = (props: CollapsibleSectionProps) => {
  const { label, trigger, children, fullWidth, showSeparator } = props;
  const [isOpen, setIsOpen] = useOpenState(
    label,
    props.isOpen,
    props.defaultOpen
  );
  return (
    <CollapsibleSectionRoot
      label={label}
      trigger={trigger}
      fullWidth={fullWidth}
      showSeparator={showSeparator}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
    >
      {children}
    </CollapsibleSectionRoot>
  );
};

export const CollapsibleSectionWithAddButton = ({
  onAdd,
  hasItems = true,
  ...props
}: Omit<CollapsibleSectionProps, "trigger" | "categoryProps"> & {
  onAdd?: () => void;

  /**
   * If set to `true`, dots aren't shown,
   * but still affects how isOpen is treated and whether onAdd is called on open.
   */
  hasItems?: boolean | ComponentProps<typeof SectionTitle>["dots"];
}) => {
  const { label, children } = props;
  const [isOpen, setIsOpen] = useOpenState(label, props.isOpen);

  const isEmpty =
    hasItems === false || (Array.isArray(hasItems) && hasItems.length === 0);

  // If it's open but empty, we want it to look as closed
  const isOpenFinal = isOpen && isEmpty === false;

  return (
    <CollapsibleSectionRoot
      label={label}
      fullWidth={props.fullWidth}
      showSeparator={props.showSeparator}
      isOpen={isOpenFinal}
      onOpenChange={(nextIsOpen) => {
        setIsOpen(nextIsOpen);
        if (isEmpty) {
          onAdd?.();
        }
      }}
      trigger={
        <SectionTitle
          dots={Array.isArray(hasItems) ? hasItems : []}
          suffix={
            onAdd ? (
              <SectionTitleButton
                prefix={<PlusIcon />}
                onClick={() => {
                  if (isOpenFinal === false) {
                    setIsOpen(true);
                  }
                  onAdd();
                }}
              />
            ) : undefined
          }
        >
          <SectionTitleLabel>{props.label}</SectionTitleLabel>
        </SectionTitle>
      }
    >
      {children}
    </CollapsibleSectionRoot>
  );
};
