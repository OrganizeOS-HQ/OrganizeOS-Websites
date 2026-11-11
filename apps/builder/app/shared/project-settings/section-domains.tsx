import { useEffect, useRef, useState } from "react";
import { useStore } from "@nanostores/react";
import {
  Flex,
  Grid,
  Link,
  Text,
  Tooltip,
  theme,
  useIsTruncated,
} from "@webstudio-is/design-system";
import { $project } from "~/shared/sync/data-stores";
import { $organizeosSite } from "~/shared/nano-states";
import {
  loadSiteAddresses,
  type SiteAddresses,
  type SiteTarget,
} from "~/builder/features/publish/organizeos-publish-addresses";
import {
  manageDomainsUrlOf,
  newTabLink,
  rowLabel,
} from "~/builder/features/publish/organizeos-publish-targets";
import { sectionSpacing } from "./utils";

/**
 * The Settings dialog's Domains section, OrganizeOS-only: where an org's site
 * is served, read-only. It reads the same addresses the Publish popup does
 * (rest.organizeos-site), names each the way the popup does, and links to the
 * platform, where domains are configured. The dialog offers it only for an
 * org project.
 */

type Row = Pick<SiteTarget, "key" | "host"> & { label?: string };

const rowsOf = (addresses: SiteAddresses): Row[] => {
  const targets = addresses.targets ?? [];
  if (targets.length === 0) {
    return [{ key: addresses.host, host: addresses.host }];
  }
  return targets.map((target) => ({
    key: target.key,
    host: target.host,
    label: rowLabel(target),
  }));
};

const DomainRow = ({ row }: { row: Row }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const truncated = useIsTruncated(hostRef, row.host);
  const host = (
    <Text ref={hostRef} truncate css={{ minWidth: 0 }}>
      {row.host}
    </Text>
  );
  return (
    <Grid
      css={{
        gridTemplateColumns: "minmax(0, 1fr) auto",
        columnGap: theme.spacing[5],
        alignItems: "center",
      }}
    >
      {truncated ? <Tooltip content={row.host}>{host}</Tooltip> : host}
      {row.label === undefined ? (
        <span />
      ) : (
        <Text color="subtle">{row.label}</Text>
      )}
    </Grid>
  );
};

export const SectionDomains = ({
  projectId: projectIdProp,
}: {
  projectId?: string;
}) => {
  const project = useStore($project);
  const site = useStore($organizeosSite);
  const projectId = projectIdProp ?? project?.id;
  const [read, setRead] = useState<
    | { state: "loading" }
    | { state: "failed" }
    | { state: "ready"; addresses: SiteAddresses }
  >({ state: "loading" });

  useEffect(() => {
    if (projectId === undefined) {
      return;
    }
    let mounted = true;
    setRead({ state: "loading" });
    loadSiteAddresses(projectId).then((addresses) => {
      if (mounted === false) {
        return;
      }
      setRead(
        addresses === undefined
          ? { state: "failed" }
          : { state: "ready", addresses }
      );
    });
    return () => {
      mounted = false;
    };
  }, [projectId]);

  const addresses = read.state === "ready" ? read.addresses : undefined;
  const manageDomainsUrl =
    site === undefined ? undefined : manageDomainsUrlOf(site, addresses);

  return (
    <Grid gap={2} css={sectionSpacing}>
      <Text variant="titles">Domains</Text>
      {addresses !== undefined &&
        rowsOf(addresses).map((row) => <DomainRow key={row.key} row={row} />)}
      {read.state === "failed" && (
        <Text color="destructive">Couldn't load domains</Text>
      )}
      {manageDomainsUrl !== undefined && (
        <Flex>
          <Text color="subtle">
            <Link
              href={manageDomainsUrl}
              color="inherit"
              variant="inherit"
              {...newTabLink}
            >
              Manage domains ↗
            </Link>
          </Text>
        </Flex>
      )}
    </Grid>
  );
};
