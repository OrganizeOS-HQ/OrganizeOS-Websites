import { useId, useState, useEffect } from "react";
import { useStore } from "@nanostores/react";
import {
  Grid,
  InputField,
  InfoTooltip,
  Label,
  theme,
  Text,
  Separator,
  Button,
  css,
  Flex,
  IconButton,
  cssVar,
} from "@webstudio-is/design-system";
import { CopyIcon } from "@webstudio-is/icons";
import { getImageAttributes, wsImageLoader } from "@webstudio-is/image";
import type { ProjectMeta } from "@webstudio-is/sdk";
import { ImageControl } from "./image-control";
import { $assets, $project } from "~/shared/sync/data-stores";
import { $projectSettings } from "~/shared/sync/data-stores";
import { sectionSpacing } from "./utils";
import { CodeEditor } from "~/shared/code-editor";
import { CopyToClipboard } from "~/shared/copy-to-clipboard";
import { executeRuntimeMutation } from "~/shared/instance-utils/data";
import { platformName } from "~/shared/branding";
import { orgScriptMayRun } from "@organizeos/site-components/org-script";

const imgStyle = css({
  objectFit: "contain",
  width: 72,
  height: 72,
  borderRadius: theme.borderRadius[4],
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: cssVar("--border-default"),
});

const defaultMetaSettings: ProjectMeta = {
  siteName: "",
  faviconAssetId: "",
  code: "",
};

const saveSetting = <Name extends keyof ProjectMeta>(
  name: keyof ProjectMeta,
  value: ProjectMeta[Name]
) => {
  executeRuntimeMutation({
    id: "projectSettings.update",
    input: { meta: { [name]: value } },
  });
};

export const SectionGeneral = ({ projectId }: { projectId?: string }) => {
  const projectSettings = useStore($projectSettings);
  const project = useStore($project);
  const assets = useStore($assets);
  const [meta, setMeta] = useState(
    () => projectSettings?.meta ?? defaultMetaSettings
  );
  const siteNameId = useId();

  // Update meta when project settings load (important for dashboard mode)
  useEffect(() => {
    if (projectSettings?.meta) {
      setMeta(projectSettings.meta);
    }
  }, [projectSettings?.meta]);

  const asset = assets.get(meta.faviconAssetId ?? "");
  const favIconUrl = asset ? `${asset.name}` : undefined;

  // Use projectId prop if available (dashboard mode), otherwise use project from store (builder mode)
  const effectiveProjectId = projectId ?? project?.id ?? "";

  const handleSave = <Name extends keyof ProjectMeta>(
    name: keyof ProjectMeta
  ) => {
    return (value: ProjectMeta[Name]) => {
      setMeta({ ...meta, [name]: value });
      saveSetting(name, value);
    };
  };

  return (
    <Grid gap={2}>
      <Text variant="titles" css={sectionSpacing}>
        General
      </Text>

      <Grid gap={1} css={sectionSpacing}>
        <Flex gap={1} align="center">
          <Text variant="labels">Project ID:</Text>
          <Text userSelect="text">{effectiveProjectId}</Text>
          <CopyToClipboard text={effectiveProjectId} copyText="Copy ID">
            <IconButton aria-label="Copy ID">
              <CopyIcon aria-hidden />
            </IconButton>
          </CopyToClipboard>
        </Flex>
      </Grid>

      <Grid gap={1} css={sectionSpacing}>
        <Flex gap={1} align="center">
          <Label htmlFor={siteNameId}>Site name</Label>
          <InfoTooltip
            label="About site name"
            content="Used in search results and social previews."
          />
        </Flex>
        <InputField
          id={siteNameId}
          placeholder="Current site name"
          autoFocus={true}
          value={meta.siteName ?? ""}
          onChange={(event) => {
            handleSave("siteName")(event.target.value);
          }}
        />
      </Grid>

      <Grid gap={2} css={sectionSpacing} justify={"start"}>
        <Label>Favicon</Label>
        <Grid flow="column" gap={3}>
          <img
            className={imgStyle()}
            {...getImageAttributes({
              width: 72,
              height: 72,
              src: favIconUrl,
              loader: wsImageLoader,
            })}
          />

          <Grid gap={2}>
            <Text color="subtle">
              Upload a square image to display in browser tabs.
            </Text>
            <ImageControl onAssetIdChange={handleSave("faviconAssetId")}>
              <Button color="primary" css={{ justifySelf: "start" }}>
                Upload
              </Button>
            </ImageControl>
          </Grid>
        </Grid>
      </Grid>

      <Separator />

      <Grid gap={2} css={sectionSpacing}>
        <Label>Custom code</Label>
        {/* OrganizeOS fork: custom code is paused, its field read-only, until
            org sites move to their own domain (docs/ORGANIZEOS-FORK.md
            section 10). What is saved here is kept. */}
        <Text color="subtle">
          {orgScriptMayRun() ? (
            <>
              Custom code and scripts will be added at the end of the
              &lt;head&gt; tag to every page across the published project and
              will run <strong>only</strong> on the published site.
            </>
          ) : (
            `Custom code is paused for now: it isn't added to any page of your published site. Scripts on your site could read the ${platformName} sign-in of people who visit, so it stays off while we make it safe. The code saved here is kept and starts running again when it is.`
          )}
        </Text>
        <CodeEditor
          title="Custom code"
          lang="html"
          readOnly={orgScriptMayRun() === false}
          value={meta.code ?? ""}
          onChange={handleSave("code")}
          onChangeComplete={handleSave("code")}
        />
      </Grid>
    </Grid>
  );
};
