import { useState } from "react";
import { useStore } from "@nanostores/react";
import { ZodError } from "zod";
import {
  Flex,
  Grid,
  InfoTooltip,
  ProChip,
  Text,
  Tooltip,
} from "@webstudio-is/design-system";
import {
  customResponseHeader,
  customResponseHeaderKey,
  editCustomResponseHeaders,
  type CustomResponseHeader,
} from "@webstudio-is/sdk";
import { validatePathnamePattern } from "@webstudio-is/wsauth";
import { $pages, $projectSettings } from "~/shared/sync/data-stores";
import { $permissions } from "~/shared/nano-states";
import { executeRuntimeMutation } from "~/shared/instance-utils/data";
import {
  ProjectSettingsDeleteRuleButton,
  ProjectSettingsRuleList,
} from "./rule-list";
import {
  getResponseHeaderName,
  getResponseHeaderValueSuggestions,
  responseHeaderNames,
} from "./response-header-suggestions";
import { getExistingRoutePaths, sectionSpacing } from "./utils";
import { planBadgeLabel } from "~/shared/branding";

// OrganizeOS fork: the sdk's platform-header message names Webstudio Cloud
const organizeosIssueMessage = (message: string) =>
  message === "This header is managed by Webstudio Cloud"
    ? "This header is managed by the platform."
    : message;

export const SectionHeaders = ({
  executeMutation = executeRuntimeMutation,
}: {
  projectId?: string;
  executeMutation?: (
    args: Parameters<typeof executeRuntimeMutation>[0]
  ) => ReturnType<typeof executeRuntimeMutation>;
} = {}) => {
  const { allowDynamicData } = useStore($permissions);
  const settings = useStore($projectSettings);
  const pages = useStore($pages);
  const [saveError, setSaveError] = useState("");
  const configured = settings?.meta.customHeaders ?? [];
  const routeSuggestions = [
    ...new Set(["/*", "/", ...Array.from(getExistingRoutePaths(pages)).sort()]),
  ];

  const save = (
    next: CustomResponseHeader | undefined,
    previousKey: string
  ) => {
    let headers: CustomResponseHeader[];
    try {
      headers = editCustomResponseHeaders(
        $projectSettings.get()?.meta.customHeaders ?? [],
        previousKey,
        next
      );
    } catch (error) {
      setSaveError(
        error instanceof ZodError
          ? error.issues
              // OrganizeOS fork: the platform, not Webstudio Cloud
              .map((issue) => organizeosIssueMessage(issue.message))
              .join(". ")
          : "Invalid response header"
      );
      return false;
    }
    try {
      const mutation = executeMutation({
        id: "projectSettings.update",
        input: {
          meta: { customHeaders: headers.length ? headers : null },
        },
      });
      if (mutation !== undefined) {
        setSaveError("");
        return true;
      }
    } catch {
      // Keep the form values or existing row available for retry.
    }
    setSaveError("Changes could not be saved. Please try again.");
    return false;
  };

  return (
    <Grid gap={3} css={sectionSpacing}>
      <Flex align="center" gap={1}>
        <Text variant="titles">Headers</Text>
        {/* OrganizeOS fork: plan copy names no Webstudio tier, service or
            pricing page (planBadgeLabel) */}
        {allowDynamicData === false && <ProChip>{planBadgeLabel}</ProChip>}
        {/* OrganizeOS fork: a one-line tooltip; the chip says what the plan
            lacks, and the form refuses a platform-managed header with its own
            message (builder UI rule, fork CLAUDE.md). */}
        <InfoTooltip
          label="About response headers"
          content={
            <Text>
              /* is every path, / the root. The last matching rule wins.
            </Text>
          }
        />
      </Flex>
      {saveError && <Text color="destructive">{saveError}</Text>}
      <ProjectSettingsRuleList
        fields={[
          {
            name: "route",
            placeholder: "/* or /private/*",
            suggestions: routeSuggestions,
          },
          {
            name: "name",
            placeholder: "Header name",
            suggestions: responseHeaderNames,
          },
          {
            name: "value",
            placeholder: "Header value",
            suggestions: (values) =>
              getResponseHeaderValueSuggestions(values.name ?? ""),
          },
        ]}
        validate={(values) => {
          const route = values.route?.trim() ?? "";
          const name = values.name?.trim() ?? "";
          const value = values.value?.trim() ?? "";
          const errors: Record<string, string[]> = {};
          const routeError = validatePathnamePattern(route);
          if (routeError) {
            errors.route = [routeError];
          }
          if (value === "") {
            errors.value = ["Enter a header value"];
          }
          const result = customResponseHeader.safeParse({
            route,
            name,
            value,
          });
          if (!result.success) {
            for (const issue of result.error.issues) {
              const field = String(issue.path[0] ?? "value");
              (errors[field] ??= []).push(
                // OrganizeOS fork: the platform, not Webstudio Cloud
                organizeosIssueMessage(issue.message)
              );
            }
          }
          return errors;
        }}
        onSubmit={(values) => {
          const route = values.route.trim();
          const value = values.value?.trim() ?? "";
          const name =
            getResponseHeaderName(values.name.trim()) ?? values.name.trim();
          const next: CustomResponseHeader = {
            ...(route === "/*" ? {} : { route }),
            name,
            value,
          };
          return save(next, customResponseHeaderKey({ route, name }));
        }}
        columns="1fr 1.5fr 1.5fr"
        columnLabels={["Path", "Header", "Value"]}
        label="Response header rules"
        rules={configured.map((header) => {
          const route = header.route ?? "/*";
          const key = customResponseHeaderKey(header);
          return {
            key,
            values: [
              <Tooltip content={route} key="route">
                <Text truncate>{route}</Text>
              </Tooltip>,
              <Tooltip content={header.name} key="name">
                <Text truncate>{header.name}</Text>
              </Tooltip>,
              <Tooltip content={header.value} key="value">
                <Text truncate>{header.value}</Text>
              </Tooltip>,
            ],
            actions: (
              <ProjectSettingsDeleteRuleButton
                label={`Remove ${header.name} for ${route}`}
                description={`${header.name} for ${route}`}
                onDelete={() => save(undefined, key)}
              />
            ),
          };
        })}
      />
    </Grid>
  );
};
