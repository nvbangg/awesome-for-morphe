import { VersionItem, AppNameMeta, Bundle } from "@/types/data";
import { CATEGORY_LABEL_UNIVERSAL } from "@/constants";
import { slugifyCategory } from "./stringUtils";

export function extractVersions(rawVersionsValue: unknown): VersionItem[] {
  if (!Array.isArray(rawVersionsValue)) return [];
  return (rawVersionsValue as VersionItem[])
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

  const repoSource = source || "github";
  const repoUrl = `https://${repoSource}.com/${repo}`;
  const deepLinkRepo = isPreRelease
    ? repoSource === "gitlab"
      ? `${repo}/-/tree/dev`
      : `${repo}/tree/dev`
    : repo;
  return {
    repoUrl,
    deepLink: `https://morphe.software/add-source?${repoSource}=${deepLinkRepo}`,
    changelogUrl:
      repoSource === "gitlab" ? `${repoUrl}/-/releases` : `${repoUrl}/releases`,
  };
}

export function getAppMeta(
  packageName: string,
  appNamesMap: Record<string, AppNameMeta>,
): {
  appName: string;
  appIcon: string;
  description: string;
  minInstalls: number;
  category: string;
  categorySlug: string;
  firstSeen: number;
} {
  const appMeta = appNamesMap[packageName];
  return {
    appName: appMeta?.name || packageName,
    appIcon: appMeta?.iconUrl || "",
    description: appMeta?.description || "",
    minInstalls: appMeta?.minInstalls || 0,
    category: appMeta?.category || CATEGORY_LABEL_UNIVERSAL,
    categorySlug: appMeta?.category ? slugifyCategory(appMeta.category) : "",
    firstSeen: appMeta?.firstSeen || 0,
  };
}

export function getBundleMeta(
  bundleKey: string,
  bundleMap: Record<string, Bundle>,
) {
  const lowerKey = bundleKey.toLowerCase();
  const bundle = bundleMap[lowerKey];
  if (!bundle) return null;

  return {
    name: bundle.name || bundle.repo,
    repo: bundle.repo,
    repoUrl: bundle.repoUrl,
    avatarUrl: bundle.avatarUrl,
    deepLink: bundle.deepLink,
    rawKey: bundle.key,
    repoDescription: bundle.repoDescription,
    firstSeen: bundle.firstSeen,
    appFirstSeen: bundle.appFirstSeen,
    isPreRelease: bundle.isPreRelease,
    stars: bundle.stars,
    updatedAt: bundle.updatedAt,
    changelogUrl: bundle.changelogUrl,
    source: bundle.source,
    appCount: bundle.appCount,
    patchCount: bundle.patchCount,
  };
}
