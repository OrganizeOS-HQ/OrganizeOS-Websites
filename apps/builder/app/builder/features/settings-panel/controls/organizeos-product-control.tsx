import { useCallback, useEffect, useId, useState } from "react";
import { useStore } from "@nanostores/react";
import {
  Flex,
  Label,
  Select,
  Text,
  Tooltip,
  cssVar,
  theme,
} from "@webstudio-is/design-system";
import type { ProductOption } from "@organizeos/site-components/products-data";
import {
  type ProductRowOption,
  type Show,
  getProductOptions,
  loadCardProducts,
  newestOption,
  readCardProduct,
  readShow,
  showOptions,
  writeCardProduct,
  writeShow,
} from "~/builder/features/organizeos-panel/product-blocks";
import {
  $dataSources,
  $instances,
  $props,
  $resources,
} from "~/shared/sync/data-stores";
import { type ControlProps, VerticalLayout } from "../shared";
import { linkButtonClass } from "./organizeos-record";

/**
 * The Shop blocks' rows (organizeos-controls.tsx): Show on a Product Grid and
 * Product on a Product Card. Options only, at the panel's width; a long
 * product title truncates, with the whole title in a tooltip.
 */

const useBlockData = () => ({
  instances: useStore($instances),
  props: useStore($props),
  dataSources: useStore($dataSources),
  resources: useStore($resources),
});

/** Show: how many of the org's products the grid lists. */
export const ProductShowControl = ({ instanceId }: ControlProps<"text">) => {
  const id = useId();
  const data = useBlockData();
  const value = readShow(instanceId, data);
  return (
    <VerticalLayout label={<Label htmlFor={id}>Show</Label>}>
      <Select<Show>
        fullWidth
        id={id}
        value={value}
        placeholder=""
        options={[...showOptions]}
        onChange={(show) => {
          void writeShow(instanceId, show);
        }}
      />
    </VerticalLayout>
  );
};

type Load =
  | { status: "loading" }
  | { status: "loaded"; products: ProductOption[] }
  | { status: "failed" }
  | { status: "no-block" };

const getOptionKey = (option: ProductRowOption) => `product:${option.value}`;
const getOptionLabel = (option: ProductRowOption) => option.label;

/**
 * Product: Newest, or one of the org's products, read live when the row
 * mounts. Choosing rewrites the card's own Resource (writeCardProduct).
 */
export const ProductCardControl = ({ instanceId }: ControlProps<"text">) => {
  const id = useId();
  const data = useBlockData();
  const [load, setLoad] = useState<Load>({ status: "loading" });

  const read = useCallback(() => {
    setLoad({ status: "loading" });
    let cancelled = false;
    void loadCardProducts(instanceId, {
      instances: $instances.get(),
      props: $props.get(),
      dataSources: $dataSources.get(),
      resources: $resources.get(),
    }).then((products) => {
      if (cancelled === false) {
        setLoad(
          products === undefined
            ? { status: "failed" }
            : products === "no-block"
              ? { status: "no-block" }
              : { status: "loaded", products }
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [instanceId]);

  const picked = readCardProduct(instanceId, data);
  const pickedId = picked?.kind === "product" ? picked.id : undefined;
  // read again when the card's own Resource becomes a products URL (an undo)
  const readable = picked !== undefined;
  useEffect(() => read(), [read, readable]);

  // a pick is "Unavailable product" only once the list loaded without it
  const options =
    load.status === "loaded"
      ? getProductOptions(load.products, pickedId)
      : [newestOption];
  const selected =
    picked === undefined
      ? undefined
      : picked.kind === "newest"
        ? newestOption
        : load.status === "loaded"
          ? options.find((option) => option.value === pickedId)
          : undefined;

  const select = (
    <Select<ProductRowOption>
      fullWidth
      id={id}
      value={selected}
      placeholder=""
      options={options}
      getLabel={getOptionLabel}
      getValue={getOptionKey}
      getItemProps={(option) => ({ textValue: option.label })}
      onChange={(option) => {
        void writeCardProduct(
          instanceId,
          option.value === newestOption.value ? undefined : option.value
        );
      }}
    />
  );

  return (
    <VerticalLayout label={<Label htmlFor={id}>Product</Label>}>
      <Flex direction="column" css={{ gap: theme.spacing[3], minWidth: 0 }}>
        {selected !== undefined && selected !== newestOption ? (
          <Tooltip content={selected.label}>
            <div style={{ minWidth: 0 }}>{select}</div>
          </Tooltip>
        ) : (
          select
        )}
        {load.status === "failed" && (
          <Text
            truncate
            css={{ color: cssVar("--foreground-warning") }}
            data-products-load
          >
            Products didn't load.{" "}
            <button type="button" className={linkButtonClass} onClick={read}>
              Reload
            </button>
          </Text>
        )}
      </Flex>
    </VerticalLayout>
  );
};
