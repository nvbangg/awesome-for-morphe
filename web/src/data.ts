export interface PatchOption {
  key?: string;
  title?: string;
  description?: string;
}

export interface CompatibilityItem {
  packageName?: string;
  isPreRelease?: boolean;
  targets?: Array<{ version?: string; isExperimental?: boolean }>;
}

export interface PatchItem {
  name?: string;
  description?: string;
  default?: boolean;
  options?: PatchOption[];
  isPreRelease?: boolean;
  compatiblePackagesKey?: number;
}

export interface Bundle {
  source: string;
  repo: string;
  name: string;
  repoDescription: string;
  avatarUrl: string;
  stars: number;
  starsGained7d: number;
  starsGained40d: number;
  updatedAt: number;
  firstSeen: number;
  appFirstSeen: Record<string, number>;
  patches: PatchItem[];
  isPreRelease: boolean;
  isTest?: boolean;

  key: string;
  patchCount: number;
  appCount: number;
  repoUrl: string;
  deepLink: string;
  changelogUrl: string;
  searchableText: string;
}

export interface VersionItem {
  version: string;
  isExperimental: boolean;
}

export interface PackageTarget {
  packageName: string;
  isPreRelease: boolean;
  versions: VersionItem[];
}

export interface RowItem {
  id: string;
  bundleKey: string;
  patchName: string;
  patchDescription: string;
  packageName: string;
  isAppPreRelease: boolean;
  isPatchPreRelease: boolean;
  versions: VersionItem[];
  searchPatchesText: string;
  options?: PatchOption[];
  default?: boolean;
}

export interface AppNameMeta {
  name?: string;
  iconUrl?: string;
  description?: string;
  minInstalls?: number;
  category?: string;
  firstSeen?: number;
}

export interface AppItem {
  packageName: string;
  appName: string;
  appIcon: string;
  description: string;
  minInstalls: number;
  category: string;
  firstSeen: number;
  patchCount: number;
  categorySlug: string;
  searchableText: string;
}

export interface WhatsNewAppChange {
  patches: string[];
  isNew?: boolean;
  appName?: string;
}

export interface WhatsNewBundleChange {
  source: string;
  repo: string;
  apps: Record<string, WhatsNewAppChange>;
  isNew?: boolean;
}

export interface WhatsNewHistoryItem {
  date: string;
  bundles: Record<string, WhatsNewBundleChange>;
}

export interface ActiveStats {
  bundlesCount: number;
  patchesCount: number;
  appsCount: number;
}

export interface ActiveData {
  bundles: Bundle[];
  rows: RowItem[];
  appItems: AppItem[];
  bundleMap: Record<string, Bundle>;
  namesMap: Record<string, AppNameMeta>;
  appPatchesMap: Record<string, RowItem[]>;
  bundlePatchesMap: Record<string, RowItem[]>;
  whatsNewHistory: WhatsNewHistoryItem[];
  stats: ActiveStats;
}

const jsonCache = new Map<string, Promise<unknown>>();
let activeDataPromise: Promise<ActiveData> | null = null;
const universalDefaultTarget: PackageTarget[] = [
  { packageName: "universal", versions: [], isPreRelease: false },
];

export function simplifyString(inputString: string | null | undefined): string {
  return inputString
    ? inputString
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
    : "";
}

function decodeHtmlEntities(str: string | null | undefined): string {
  return str
    ? str
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
    : "";
}

export function slugifyCategory(category: string): string {
  return category
    ? category
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    : "not-on-google-play";
}

function extractVersions(rawVersionsValue: unknown): VersionItem[] {
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

export function fetchJson<T = unknown>(
  url: string | URL,
  defaultFallbackData?: T,
): Promise<T> {
  const cacheKey = url.toString();
  if (!jsonCache.has(cacheKey)) {
    const fetchPromise = (async () => {
      try {
        const response = await fetch(url, { cache: "no-cache" });
        if (!response.ok)
          throw new Error(`Failed to load ${url}: ${response.status}`);
        return (await response.json()) as T;
      } catch (error) {
        jsonCache.delete(cacheKey);
        if (defaultFallbackData !== undefined) return defaultFallbackData;
        throw error;
      }
    })();
    jsonCache.set(cacheKey, fetchPromise);
  }
  return jsonCache.get(cacheKey) as Promise<T>;
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
    appName:
      packageName === "universal" ? "Any app" : appMeta?.name || packageName,
    appIcon: appMeta?.iconUrl || "",
    description: decodeHtmlEntities(appMeta?.description || ""),
    minInstalls: appMeta?.minInstalls || 0,
    category:
      appMeta?.category ||
      (packageName === "universal" ? "" : "Not on Google Play"),
    firstSeen: appMeta?.firstSeen || 0,
  };
}

export function getAppItems(
  appItems: AppItem[],
  searchQuery = "",
  sortOrder = "default",
  categoryFilter = "all",
): AppItem[] {
  let appList = appItems;

  if (categoryFilter && categoryFilter !== "all") {
    appList = appList.filter(
      (appItem) => appItem.categorySlug === categoryFilter,
    );
  }

  const queryWords = searchQuery
    .trim()
    .split(/\s+/)
    .map(simplifyString)
    .filter(Boolean);
  if (queryWords.length > 0) {
    appList = appList.filter((appItem) =>
      queryWords.every((word) => appItem.searchableText.includes(word)),
    );
  }

  appList = [...appList];

  const compareAppFallback = (appItemA: AppItem, appItemB: AppItem): number => {
    const firstSeenDiff = appItemA.firstSeen - appItemB.firstSeen;
    if (firstSeenDiff !== 0) return firstSeenDiff;
    return appItemA.appName.localeCompare(appItemB.appName);
  };

  appList.sort((appItemA, appItemB) => {
    if (
      (appItemA.packageName === "universal") !==
      (appItemB.packageName === "universal")
    ) {
      return appItemA.packageName === "universal" ? 1 : -1;
    }

    if (sortOrder === "new") {
      return (
        appItemB.firstSeen - appItemA.firstSeen ||
        compareAppFallback(appItemA, appItemB)
      );
    }
    if (sortOrder === "patches") {
      return (
        appItemB.patchCount - appItemA.patchCount ||
        compareAppFallback(appItemA, appItemB)
      );
    }
    if (
      sortOrder === "alphabetical" ||
      sortOrder === "alpha" ||
      sortOrder === "abc"
    ) {
      return (
        appItemA.appName.localeCompare(appItemB.appName) ||
        compareAppFallback(appItemA, appItemB)
      );
    }
    return (
      appItemB.minInstalls - appItemA.minInstalls ||
      compareAppFallback(appItemA, appItemB)
    );
  });

  return appList;
}

export function getAvailableCategories(
  rowItems: RowItem[],
  namesMap: Record<string, AppNameMeta>,
): { key: string; label: string }[] {
  const categoriesSet = new Set<string>();
  let hasNotOnGooglePlay = false;

  const seenPackages = new Set<string>();
  for (const rowItem of rowItems) {
    const packageName = rowItem.packageName;
    if (seenPackages.has(packageName)) continue;
    seenPackages.add(packageName);

    const category = namesMap[packageName]?.category || "";
    if (category) {
      categoriesSet.add(category);
    } else {
      hasNotOnGooglePlay = true;
    }
  }

  const categories: { key: string; label: string }[] = [
    { key: "all", label: "All categories" },
  ];

  if (hasNotOnGooglePlay) {
    categories.push({ key: "not-on-google-play", label: "Not on Google Play" });
  }

  const sortedCategories = Array.from(categoriesSet).sort((a, b) =>
    a.localeCompare(b),
  );
  for (const category of sortedCategories) {
    categories.push({
      key: slugifyCategory(category),
      label: category,
    });
  }

  return categories;
}

export function getFilteredBundles(
  bundles: Bundle[],
  searchQuery = "",
  sortOrder = "default",
): Bundle[] {
  let bundleList = bundles;

  const queryWords = searchQuery
    .trim()
    .split(/\s+/)
    .map(simplifyString)
    .filter(Boolean);
  if (queryWords.length > 0) {
    bundleList = bundleList.filter((bundleItem) =>
      queryWords.every((word) => bundleItem.searchableText.includes(word)),
    );
  }

  bundleList = [...bundleList];

  const compareBundleFallback = (
    bundleItemA: Bundle,
    bundleItemB: Bundle,
  ): number => {
    const updatedAtDiff = bundleItemB.updatedAt - bundleItemA.updatedAt;
    if (updatedAtDiff !== 0) return updatedAtDiff;
    return bundleItemA.name.localeCompare(bundleItemB.name);
  };

  const compareHotBundle = (
    bundleItemA: Bundle,
    bundleItemB: Bundle,
  ): number => {
    const stars7dDiff = bundleItemB.starsGained7d - bundleItemA.starsGained7d;
    if (stars7dDiff !== 0) return stars7dDiff;

    const stars40dDiff =
      bundleItemB.starsGained40d - bundleItemA.starsGained40d;
    if (stars40dDiff !== 0) return stars40dDiff;

    const starsDiff = bundleItemB.stars - bundleItemA.stars;
    if (starsDiff !== 0) return starsDiff;

    return compareBundleFallback(bundleItemA, bundleItemB);
  };

  if (sortOrder === "new") {
    bundleList.sort(
      (bundleItemA, bundleItemB) =>
        bundleItemB.firstSeen - bundleItemA.firstSeen ||
        compareBundleFallback(bundleItemA, bundleItemB),
    );
  } else if (sortOrder === "updated") {
    bundleList.sort(
      (bundleItemA, bundleItemB) =>
        bundleItemB.updatedAt - bundleItemA.updatedAt ||
        compareBundleFallback(bundleItemA, bundleItemB),
    );
  } else if (sortOrder === "stars") {
    bundleList.sort(
      (bundleItemA, bundleItemB) =>
        bundleItemB.stars - bundleItemA.stars ||
        compareBundleFallback(bundleItemA, bundleItemB),
    );
  } else if (sortOrder === "apps") {
    bundleList.sort(
      (bundleItemA, bundleItemB) =>
        bundleItemB.appCount - bundleItemA.appCount ||
        compareBundleFallback(bundleItemA, bundleItemB),
    );
  } else if (sortOrder === "patches") {
    bundleList.sort(
      (bundleItemA, bundleItemB) =>
        bundleItemB.patchCount - bundleItemA.patchCount ||
        compareBundleFallback(bundleItemA, bundleItemB),
    );
  } else if (sortOrder === "alphabetical" || sortOrder === "abc") {
    bundleList.sort(
      (bundleItemA, bundleItemB) =>
        bundleItemA.name.localeCompare(bundleItemB.name) ||
        compareBundleFallback(bundleItemA, bundleItemB),
    );
  } else {
    bundleList.sort(compareHotBundle);
  }

  return bundleList;
}

export function loadInitialData(): Promise<ActiveData> {
  if (activeDataPromise) {
    return activeDataPromise;
  }

  activeDataPromise = (async () => {
    const [namesMap, sourcesData, whatsNewHistory] = await Promise.all([
      fetchJson<Record<string, AppNameMeta>>("apps.json", {}),
      fetchJson<{ bundles: Bundle[]; compatibilities: CompatibilityItem[][] }>(
        "bundles.json",
        { bundles: [], compatibilities: [] },
      ),
      fetchJson<WhatsNewHistoryItem[]>("whats-new.json", []),
    ]);
    const jsonBundles = sourcesData.bundles ?? [];
    const compatibilitiesList = sourcesData.compatibilities ?? [];

    const bundleList: Bundle[] = [];
    const rows: RowItem[] = [];

    for (const jsonBundle of jsonBundles) {
      if (!jsonBundle.patches) continue;

      const bundleKey = `${jsonBundle.source}:${jsonBundle.repo}`;
      const calculatedUrls = buildBundleUrls(
        jsonBundle.source,
        jsonBundle.repo,
        jsonBundle.isPreRelease,
      );
      const updatedAt = jsonBundle.updatedAt || 0;
      const appFirstSeen = jsonBundle.appFirstSeen || {};
      const patches = jsonBundle.patches || [];

      const bundleObj: Bundle = {
        source: jsonBundle.source || "",
        repo: jsonBundle.repo || "",
        name: jsonBundle.name || jsonBundle.repo || "",
        repoDescription: decodeHtmlEntities(jsonBundle.repoDescription || ""),
        avatarUrl: jsonBundle.avatarUrl || "",
        stars: jsonBundle.stars || 0,
        starsGained7d: jsonBundle.starsGained7d || 0,
        starsGained40d: jsonBundle.starsGained40d || 0,
        updatedAt,
        firstSeen: jsonBundle.firstSeen || updatedAt,
        appFirstSeen,
        patches,
        isPreRelease: !!jsonBundle.isPreRelease,

        key: bundleKey,
        patchCount: patches.length,
        appCount: Object.keys(appFirstSeen).length,
        repoUrl: calculatedUrls.repoUrl,
        deepLink: calculatedUrls.deepLink,
        changelogUrl: calculatedUrls.changelogUrl,
        searchableText: simplifyString(
          `${jsonBundle.name || jsonBundle.repo || ""} ${jsonBundle.repo || ""}`,
        ),
      };

      bundleList.push(bundleObj);

      const patchRows = bundleObj.patches.flatMap(
        (patchItem: PatchItem, patchIndex: number) => {
          const patchId = `${bundleKey}:${patchIndex}`;
          const compatiblePackages =
            patchItem.compatiblePackagesKey !== undefined
              ? compatibilitiesList[patchItem.compatiblePackagesKey]
              : undefined;

          let packageTargetRows: PackageTarget[] = universalDefaultTarget;
          if (Array.isArray(compatiblePackages)) {
            const mappedTargetRows = compatiblePackages.flatMap(
              (compatibilityItem: CompatibilityItem) =>
                compatibilityItem?.packageName
                  ? [
                      {
                        packageName: compatibilityItem.packageName,
                        isPreRelease: !!compatibilityItem.isPreRelease,
                        versions: extractVersions(compatibilityItem.targets),
                      },
                    ]
                  : [],
            );
            if (mappedTargetRows.length > 0)
              packageTargetRows = mappedTargetRows;
          }

          const searchParts = [patchItem.name, patchItem.description];
          if (Array.isArray(patchItem.options)) {
            patchItem.options.forEach((patchOption) =>
              searchParts.push(
                patchOption.title,
                patchOption.key,
                patchOption.description,
              ),
            );
          }
          const searchPatchesText = simplifyString(
            searchParts.filter(Boolean).join(" "),
          );

          return packageTargetRows.map((targetPackage, targetIndex) => {
            const packageName = targetPackage.packageName ?? "universal";

            return {
              id: `${patchId}:${targetIndex}`,
              bundleKey,
              patchName: patchItem.name ?? "",
              patchDescription: patchItem.description ?? "",
              packageName,
              isAppPreRelease: !!targetPackage.isPreRelease,
              isPatchPreRelease: !!patchItem.isPreRelease,
              versions: targetPackage.versions,
              searchPatchesText,
              options: patchItem.options,
              default: patchItem.default,
            };
          });
        },
      );

      rows.push(...patchRows);
    }

    const appPatchesMap: Record<string, RowItem[]> = {};
    const bundlePatchesMap: Record<string, RowItem[]> = {};

    for (const rowItem of rows) {
      const packageName = rowItem.packageName;
      if (!appPatchesMap[packageName]) appPatchesMap[packageName] = [];
      appPatchesMap[packageName].push(rowItem);

      const bundleKeyLower = rowItem.bundleKey.toLowerCase();
      if (!bundlePatchesMap[bundleKeyLower])
        bundlePatchesMap[bundleKeyLower] = [];
      bundlePatchesMap[bundleKeyLower].push(rowItem);
    }

    const bundleMap: Record<string, Bundle> = {};
    for (const bundle of bundleList) {
      bundleMap[bundle.key.toLowerCase()] = bundle;
    }

    const appMap = new Map<string, AppItem>();
    for (const rowItem of rows) {
      const packageName = rowItem.packageName;
      const existingApp = appMap.get(packageName);
      if (!existingApp) {
        const appMeta = getAppMeta(packageName, namesMap);
        const categorySlug = slugifyCategory(appMeta.category);
        const searchableText = simplifyString(
          `${appMeta.appName} ${packageName} ${appMeta.description}`,
        );
        appMap.set(packageName, {
          packageName,
          appName: appMeta.appName,
          appIcon: appMeta.appIcon,
          description: appMeta.description,
          minInstalls: appMeta.minInstalls,
          category: appMeta.category,
          firstSeen: appMeta.firstSeen,
          patchCount: 1,
          categorySlug,
          searchableText,
        });
      } else {
        existingApp.patchCount += 1;
      }
    }
    const appItems = Array.from(appMap.values());

    const stats: ActiveStats = {
      bundlesCount: bundleList.length,
      patchesCount: rows.length,
      appsCount: appItems.filter(
        (appItem) => appItem.packageName !== "universal",
      ).length,
    };

    return {
      bundles: bundleList,
      rows,
      appItems,
      bundleMap,
      namesMap,
      appPatchesMap,
      bundlePatchesMap,
      whatsNewHistory,
      stats,
    };
  })();

  return activeDataPromise;
}

export interface BundleGroupData {
  bundleKey: string;
  bundleMeta: Bundle;
  patches: RowItem[];
}

export function getAppBundleGroups(
  activeData: ActiveData,
  packageName: string,
  searchQuery: string,
): BundleGroupData[] {
  const rawPatches = activeData.appPatchesMap[packageName] || [];
  if (rawPatches.length === 0) return [];

  const queryWords = searchQuery
    .trim()
    .split(/\s+/)
    .map(simplifyString)
    .filter(Boolean);
  const filteredPatches =
    queryWords.length > 0
      ? rawPatches.filter((patchItem: RowItem) => {
          const bundleKeyLower = patchItem.bundleKey.toLowerCase();
          const bundleMetadata = activeData.bundleMap[bundleKeyLower];
          const bundleNameClean = simplifyString(bundleMetadata?.name);
          const bundleRepoClean = simplifyString(bundleMetadata?.repo);

          return queryWords.every(
            (word) =>
              patchItem.searchPatchesText.includes(word) ||
              bundleNameClean.includes(word) ||
              bundleRepoClean.includes(word),
          );
        })
      : rawPatches;

  const groupedPatchesMap = new Map<string, RowItem[]>();
  for (const patchItem of filteredPatches) {
    const bundleKey = patchItem.bundleKey.toLowerCase();
    const patches = groupedPatchesMap.get(bundleKey) ?? [];
    patches.push(patchItem);
    groupedPatchesMap.set(bundleKey, patches);
  }

  const bundleGroupList: BundleGroupData[] = [];
  for (const [bundleKey, patches] of groupedPatchesMap.entries()) {
    const bundleMetadata = activeData.bundleMap[bundleKey];
    if (bundleMetadata) {
      bundleGroupList.push({ bundleKey, bundleMeta: bundleMetadata, patches });
    }
  }

  bundleGroupList.sort((groupA, groupB) => {
    const starsDiff = groupB.bundleMeta.stars - groupA.bundleMeta.stars;
    if (starsDiff !== 0) return starsDiff;
    return groupA.bundleMeta.name.localeCompare(
      groupB.bundleMeta.name,
      undefined,
      { sensitivity: "base" },
    );
  });

  return bundleGroupList;
}

export interface AppGroupData {
  packageName: string;
  appMeta: {
    appName: string;
    appIcon: string;
    description: string;
    minInstalls: number;
    category: string;
    firstSeen: number;
  };
  patches: RowItem[];
}

export function getBundleAppGroups(
  activeData: ActiveData,
  bundleKey: string,
  searchQuery: string,
): AppGroupData[] {
  const bundleKeyLower = bundleKey.toLowerCase();
  const filteredPatches = activeData.bundlePatchesMap[bundleKeyLower] || [];
  if (filteredPatches.length === 0) return [];

  const queryWords = searchQuery
    .trim()
    .split(/\s+/)
    .map(simplifyString)
    .filter(Boolean);
  const searchedPatches =
    queryWords.length > 0
      ? filteredPatches.filter((patchItem: RowItem) => {
          const appMeta = getAppMeta(
            patchItem.packageName,
            activeData.namesMap,
          );
          const appNameClean = simplifyString(appMeta.appName);
          const packageNameClean = simplifyString(patchItem.packageName);

          return queryWords.every(
            (word) =>
              patchItem.searchPatchesText.includes(word) ||
              packageNameClean.includes(word) ||
              appNameClean.includes(word),
          );
        })
      : filteredPatches;

  const groupedPatchesMap = new Map<string, RowItem[]>();
  for (const patchItem of searchedPatches) {
    const packageName = patchItem.packageName;
    const patches = groupedPatchesMap.get(packageName) ?? [];
    patches.push(patchItem);
    groupedPatchesMap.set(packageName, patches);
  }

  const appGroupList: AppGroupData[] = [];
  for (const [packageName, patches] of groupedPatchesMap.entries()) {
    const appMeta = getAppMeta(packageName, activeData.namesMap);
    appGroupList.push({ packageName, appMeta, patches });
  }

  appGroupList.sort((groupA, groupB) => {
    if (
      (groupA.packageName === "universal") !==
      (groupB.packageName === "universal")
    ) {
      return groupA.packageName === "universal" ? 1 : -1;
    }
    return groupA.appMeta.appName.localeCompare(
      groupB.appMeta.appName,
      undefined,
      { sensitivity: "base" },
    );
  });

  return appGroupList;
}
