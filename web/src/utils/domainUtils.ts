import { VersionItem, AppNameMeta } from "@/types/data";
import { CATEGORY_LABEL_UNIVERSAL } from "@/constants";
import { decodeHtmlEntities } from "./stringUtils";

export function extractVersions(rawVersionsValue: unknown): VersionItem[] {
  if (!Array.isArray(rawVersionsValue)) return [];
  return (
    rawVersionsValue as Array<{ version?: string; isExperimental?: boolean }>
  )
    .flatMap((item) =>
      item?.version
        ? [
            {
              version: String(item.version),
              isExperimental: !!item.isExperimental,
            },
          ]
        : [],
    )
    .sort((versionA, versionB) =>
      versionB.version.localeCompare(versionA.version, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
}

export function buildBundleUrls(
  source: string | undefined,
  repo: string | undefined,
  isPreRelease: boolean | undefined,
): { repoUrl: string; deepLink: string; changelogUrl: string } {
  if (!repo) return { repoUrl: "", deepLink: "", changelogUrl: "" };

  const repositorySource = source || "github";
  const repoUrl = `https://${repositorySource}.com/${repo}`;
  const deepLinkRepo = isPreRelease
    ? repositorySource === "gitlab"
      ? `${repo}/-/tree/dev`
      : `${repo}/tree/dev`
    : repo;
  return {
    repoUrl,
    deepLink: `https://morphe.software/add-source?${repositorySource}=${deepLinkRepo}`,
    changelogUrl:
      repositorySource === "gitlab"
        ? `${repoUrl}/-/releases`
        : `${repoUrl}/releases`,
  };
}

export function getAppMeta(
  packageName: string,
  namesMap: Record<string, AppNameMeta>,
): {
  appName: string;
  appIcon: string;
  description: string;
  minInstalls: number;
  category: string;
  firstSeen: number;
} {
  const appMeta = namesMap[packageName];
  return {
    appName: appMeta?.name || packageName,
    appIcon: appMeta?.iconUrl || "",
    description: decodeHtmlEntities(appMeta?.description || ""),
    minInstalls: appMeta?.minInstalls || 0,
    category: appMeta?.category || CATEGORY_LABEL_UNIVERSAL,
    firstSeen: appMeta?.firstSeen || 0,
  };
}
