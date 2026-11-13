import { useEffect } from "react";
import { atom } from "nanostores";
import { useStore } from "@nanostores/react";
import { loadSiteAddresses } from "./organizeos-publish-addresses";

/**
 * OrganizeOS fork: the origin an org project's page address is built on
 * (`https://<main host or built-in host>`), from the same read the Publish
 * dialog uses. Read once per project and kept: the address bar asks on every
 * render, so the answer is cached by project id, and two asks for a project
 * share one request. A failed read is no origin (undefined), never a guess,
 * and the next mount asks again.
 */

type OriginState = { status: "ready"; origin: string } | { status: "failed" };

export const $siteOrigins = atom<Record<string, OriginState>>({});

const inflight = new Map<string, Promise<void>>();

const httpsOrigin = (value: string): string | undefined => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : undefined;
  } catch {
    return;
  }
};

/** Reads the project's origin unless it is known or already being read. */
export const loadSiteOrigin = (projectId: string): Promise<void> => {
  if ($siteOrigins.get()[projectId]?.status === "ready") {
    return Promise.resolve();
  }
  const pending = inflight.get(projectId);
  if (pending !== undefined) {
    return pending;
  }
  const request = loadSiteAddresses(projectId)
    .then((addresses) => {
      const origin =
        addresses === undefined ? undefined : httpsOrigin(addresses.origin);
      $siteOrigins.set({
        ...$siteOrigins.get(),
        [projectId]:
          origin === undefined
            ? { status: "failed" }
            : { status: "ready", origin },
      });
    })
    .finally(() => {
      inflight.delete(projectId);
    });
  inflight.set(projectId, request);
  return request;
};

export const resetSiteOrigins = () => {
  inflight.clear();
  $siteOrigins.set({});
};

/**
 * The project's origin, undefined while the read is pending or after it
 * failed, and with no project id (a project that is not an org's).
 */
export const useSiteOrigin = (
  projectId: string | undefined
): string | undefined => {
  const origins = useStore($siteOrigins);
  useEffect(() => {
    if (projectId !== undefined) {
      loadSiteOrigin(projectId);
    }
  }, [projectId]);
  const state = projectId === undefined ? undefined : origins[projectId];
  return state?.status === "ready" ? state.origin : undefined;
};
