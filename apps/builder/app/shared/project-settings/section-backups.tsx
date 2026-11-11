import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import {
  PanelContent,
  Grid,
  Text,
  Button,
  Select,
  Dialog,
  DialogTitle,
  DialogTrigger,
  DialogContent,
  DialogClose,
  Flex,
  toast,
  ProChip,
} from "@webstudio-is/design-system";
import { nativeClient, trpcClient } from "~/shared/trpc/trpc-client";
import { $project } from "~/shared/sync/data-stores";
import { $permissions } from "~/shared/nano-states";
import { sectionSpacing } from "./utils";
// OrganizeOS fork: the plan chip replaces the upgrade banner.
import { planBadgeLabel } from "~/shared/branding";

const formatPublishDate = (date: string) => {
  try {
    const formatter = new Intl.DateTimeFormat("en", {
      dateStyle: "long",
      timeStyle: "short",
    });
    return formatter.format(new Date(date));
  } catch {
    return date;
  }
};

export const SectionBackups = ({
  projectId: projectIdProp,
}: {
  projectId?: string;
}) => {
  const { canRestoreBackups } = useStore($permissions);
  const { data, load } = trpcClient.project.publishedBuilds.useQuery();
  const project = useStore($project);
  const projectId = projectIdProp ?? project?.id ?? "";

  useEffect(() => {
    load({ projectId });
  }, [load, projectId]);
  const options = data?.success ? data.data : [];
  const [backupBuild = options.at(0), setBackupBuild] = useState<
    undefined | (typeof options)[number]
  >();
  const restore = async () => {
    if (!backupBuild?.buildId) {
      return;
    }
    const result = await nativeClient.project.restoreDevelopmentBuild.mutate({
      projectId,
      fromBuildId: backupBuild.buildId,
    });
    if (result.success) {
      location.reload();
      return;
    }
    toast.error(result.error);
  };

  return (
    <Grid gap={2} css={sectionSpacing}>
      {/* OrganizeOS fork: a plain name, with the plan chip instead of the
          upgrade banner (builder UI rule, fork CLAUDE.md). */}
      <Flex align="center" gap={1}>
        <Text variant="titles">Published versions</Text>
        {canRestoreBackups === false && <ProChip>{planBadgeLabel}</ProChip>}
      </Flex>
      <Select
        placeholder="No backups"
        options={options}
        getValue={(option) => option.buildId ?? ""}
        getLabel={(option) => {
          if (!option.createdAt) {
            return;
          }
          // OrganizeOS fork: the date only, without the domains.
          return formatPublishDate(option.createdAt);
        }}
        value={backupBuild}
        onChange={setBackupBuild}
      />
      <Dialog>
        <DialogTrigger asChild>
          <Button
            color="primary"
            css={{ justifySelf: "start" }}
            disabled={canRestoreBackups === false || options.length === 0}
          >
            Restore
          </Button>
        </DialogTrigger>
        <DialogContent width={320}>
          <DialogTitle>Restore published version</DialogTitle>
          <PanelContent as={Flex} direction="column" gap={2}>
            {/* OrganizeOS fork: plain wording. */}
            <Text>Restore the site to this published version?</Text>
            {backupBuild?.createdAt && (
              <Text color="destructive">
                All changes made after{" "}
                {formatPublishDate(backupBuild.createdAt)} will be lost.
              </Text>
            )}
            <Flex gap="2" justify="end">
              <DialogClose>
                <Button color="ghost">Cancel</Button>
              </DialogClose>
              <DialogClose>
                <Button color="destructive" onClick={restore}>
                  Restore
                </Button>
              </DialogClose>
            </Flex>
          </PanelContent>
        </DialogContent>
      </Dialog>
    </Grid>
  );
};
