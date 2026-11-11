import type { FunctionComponent } from "react";
import { useStore } from "@nanostores/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  theme,
  ScrollAreaNative,
  Flex,
  List,
  ListItem,
  Text,
  rawTheme,
  cssVar,
  InsetList,
  InsetListItem,
} from "@webstudio-is/design-system";
import { SpinnerIcon } from "@webstudio-is/icons";
import {
  $openProjectSettings,
  type SectionName,
} from "~/shared/nano-states/project-settings";
import { $isDesignMode, $organizeosSite } from "~/shared/nano-states";
import { leftPanelWidth, rightPanelWidth } from "./utils";
import { SectionGeneral } from "./section-general";
import { SectionEmails } from "./section-emails";
import { SectionAgents } from "./section-agents";
import { SectionAuth } from "./section-auth";
import { SectionHeaders } from "./section-headers";
import { SectionRedirects } from "./section-redirects";
import { SectionPublish } from "./section-publish";
import { SectionBackups } from "./section-backups";
import { titleCase } from "title-case";
import { SectionDomains } from "./section-domains";

// OrganizeOS fork: no "marketplace" section. Upstream's submits the project to
// the Webstudio template marketplace for review; this deployment has no
// marketplace and no reviewer, so the section offered an action that goes
// nowhere and flipped marketplaceApprovalStatus on the way.
const sections = new Map<
  SectionName,
  FunctionComponent<{ projectId?: string }>
>([
  ["general", SectionGeneral],
  ["emails", SectionEmails],
  ["agents", SectionAgents],
  ["redirects", SectionRedirects],
  ["publish", SectionPublish],
  ["backups", SectionBackups],
  ["auth", SectionAuth],
  ["headers", SectionHeaders],
] as const);

const sectionLabels = new Map<SectionName, string>([
  ["auth", "Authentication"],
]);

// OrganizeOS fork: the dialog's sections for an org project, in this order,
// with plain names, and the org-only Domains section. Upstream's Agents and
// Publish sections are not offered to an org (owner decision D1); an org
// publishes from its own Publish popup. A project no org owns keeps upstream's
// list, with the same names and without Domains. The visible list drives both
// the left list and whether the dialog opens, so asking for a section the
// project does not offer opens nothing
// (docs/superpowers/specs/2026-11-11-builder-settings-screen-design.md).
const organizeosSectionOrder: SectionName[] = [
  "general",
  "domains",
  "emails",
  "redirects",
  "auth",
  "headers",
  "backups",
];

const organizeosSectionLabels = new Map<SectionName, string>([
  ["general", "General"],
  ["domains", "Domains"],
  ["emails", "Form emails"],
  ["redirects", "Redirects"],
  ["auth", "Page passwords"],
  ["headers", "Headers"],
  ["backups", "Published versions"],
  ["agents", "Agents"],
  ["publish", "Publish"],
]);

const organizeosSections = new Map<
  SectionName,
  FunctionComponent<{ projectId?: string }>
>([...sections, ["domains", SectionDomains]]);

const useOrganizeosVisibleSections = (): SectionName[] => {
  const isOrganizeosSite = useStore($organizeosSite) !== undefined;
  return isOrganizeosSite
    ? organizeosSectionOrder
    : Array.from(sections.keys());
};

const organizeosSectionLabel = (name: SectionName) =>
  organizeosSectionLabels.get(name) ??
  sectionLabels.get(name) ??
  titleCase(name);

export const ProjectSettingsDialog = ({
  currentSection,
  onSectionChange,
  onOpenChange,
  projectId,
  status = "loaded",
}: {
  currentSection?: SectionName;
  onSectionChange?: (section: SectionName) => void;
  onOpenChange?: (isOpen: boolean) => void;
  projectId?: string;
  status?: "idle" | "loading" | "loaded";
}) => {
  const isDesignMode = useStore($isDesignMode);
  // OrganizeOS fork: the sections this project offers, Domains included for
  // an org (see organizeosSectionOrder).
  const visibleSections = useOrganizeosVisibleSections();
  const SectionComponent =
    currentSection && visibleSections.includes(currentSection)
      ? organizeosSections.get(currentSection)
      : undefined;

  return (
    <Dialog
      draggable
      // OrganizeOS fork: opens only for a section this project offers.
      open={visibleSections.includes(currentSection!)}
      onOpenChange={onOpenChange}
    >
      <DialogContent
        width={
          Number.parseInt(leftPanelWidth, 10) +
          Number.parseInt(rightPanelWidth, 10)
        }
        height={Number.parseInt(rawTheme.spacing[35], 10)}
        data-floating-panel-container
      >
        <fieldset style={{ display: "contents" }} disabled={!isDesignMode}>
          <Flex grow>
            <List asChild>
              <InsetList
                css={{
                  width: leftPanelWidth,
                  borderRight: `1px solid  ${cssVar("--border-default")}`,
                }}
              >
                {/* OrganizeOS fork: the visible list, with plain names. */}
                {visibleSections.map((name, index) => {
                  return (
                    <ListItem
                      current={currentSection === name}
                      asChild
                      index={index}
                      key={name}
                      onSelect={() => {
                        onSectionChange?.(name);
                      }}
                    >
                      <InsetListItem>
                        <Text variant="labels" truncate>
                          {organizeosSectionLabel(name)}
                        </Text>
                      </InsetListItem>
                    </ListItem>
                  );
                })}
              </InsetList>
            </List>
            <ScrollAreaNative css={{ width: "100%" }}>
              {status === "loading" ? (
                <Flex justify="center" align="center" css={{ minHeight: 400 }}>
                  <SpinnerIcon size={rawTheme.spacing[15]} />
                </Flex>
              ) : (
                <Grid
                  gap={2}
                  css={{
                    paddingBlock: theme.spacing[5],
                    minHeight: currentSection === "agents" ? "100%" : undefined,
                  }}
                >
                  {SectionComponent && (
                    <SectionComponent projectId={projectId} />
                  )}
                </Grid>
              )}
            </ScrollAreaNative>
          </Flex>
          {/* Title is at the end intentionally,
           * to make the close button last in the tab order
           */}
          {/* OrganizeOS fork: the dialog's plain name (spec D3). */}
          <DialogTitle>Settings</DialogTitle>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};

export const ProjectSettings = () => {
  const currentSection = useStore($openProjectSettings);

  return (
    <ProjectSettingsDialog
      currentSection={currentSection}
      onSectionChange={$openProjectSettings.set}
      onOpenChange={(open) => {
        $openProjectSettings.set(open ? "general" : undefined);
      }}
    />
  );
};
