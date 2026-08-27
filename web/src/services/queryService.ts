import { AppItem, RowItem, Bundle, ActiveData } from "@/types/data";
import { simplifyString, getAppMeta, AppMeta } from "@/utils";
import {
  CATEGORY_UNIVERSAL,
  CATEGORY_LABEL_UNIVERSAL,
  PACKAGE_UNIVERSAL,
} from "@/constants";

function parseSearchQuery(query: string): string[] {
  if (!query) return [];
  const trimmed = query.trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+/).map(simplifyString).filter(Boolean);
}

export function compareUniversalApp(
  appItemA: { packageName?: string },
  appItemB: { packageName?: string },
): number {
  if (
    appItemA.packageName &&
    appItemB.packageName &&
    (appItemA.packageName === PACKAGE_UNIVERSAL) !==
      (appItemB.packageName === PACKAGE_UNIVERSAL)
  ) {
    return appItemA.packageName === PACKAGE_UNIVERSAL ? 1 : -1;
  }
  return 0;
}

export function compareAppFallback(
  appItemA: { firstSeen: number; appName: string },
  appItemB: { firstSeen: number; appName: string },
): number {
  const firstSeenDifference = appItemA.firstSeen - appItemB.firstSeen;
  if (firstSeenDifference !== 0) return firstSeenDifference;
  return appItemA.appName.localeCompare(appItemB.appName);
}

export function compareDefaultApp(
  appItemA: {
    packageName?: string;
    minInstalls: number;
    firstSeen: number;
    appName: string;
  },
  appItemB: {
    packageName?: string;
    minInstalls: number;
    firstSeen: number;
    appName: string;
  },
): number {
  return (
    compareUniversalApp(appItemA, appItemB) ||
    appItemB.minInstalls - appItemA.minInstalls ||
    compareAppFallback(appItemA, appItemB)
  );
}

export function compareBundleFallback(
  bundleItemA: Bundle,
  bundleItemB: Bundle,
): number {
  const updatedAtDifference = bundleItemB.updatedAt - bundleItemA.updatedAt;
  if (updatedAtDifference !== 0) return updatedAtDifference;
  return bundleItemA.name.localeCompare(bundleItemB.name);
}

export function compareDefaultBundle(
  bundleItemA: Bundle,
  bundleItemB: Bundle,
): number {
  const rankA = bundleItemA.hotRank;
  const rankB = bundleItemB.hotRank;

  if (rankA !== null && rankB !== null) {
    const rankDiff = rankA - rankB;
    if (rankDiff !== 0) return rankDiff;
  } else if (rankA !== null) {
    return -1;
  } else if (rankB !== null) {
    return 1;
  }

  return compareBundleFallback(bundleItemA, bundleItemB);
}

const BUNDLE_SORT_KEY_MAP: Record<string, (bundle: Bundle) => number> = {
  new: (bundle) => -bundle.firstSeen,
  updated: (bundle) => -bundle.updatedAt,
  stars: (bundle) => -bundle.stars,
  apps: (bundle) => -bundle.appCount,
  patches: (bundle) => -bundle.patchCount,
};

const APP_SORT_KEY_MAP: Record<string, (app: AppItem) => number> = {
  new: (app) => -app.firstSeen,
  patches: (app) => -app.patchCount,
};

export const VALID_APP_SORTS = new Set([
  ...Object.keys(APP_SORT_KEY_MAP),
  "alpha",
]);

export const VALID_BUNDLE_SORTS = new Set([
  ...Object.keys(BUNDLE_SORT_KEY_MAP),
  "alpha",
]);

export function getAppItems(
  appItems: AppItem[],
  searchQuery = "",
  sortOrder = "default",
  categoryFilter = "all",
): AppItem[] {
  let appList: AppItem[];

  const queryWords = parseSearchQuery(searchQuery);
  const hasCategoryFilter = categoryFilter !== "all";
  const hasSearch = queryWords.length > 0;

  if (hasCategoryFilter || hasSearch) {
    appList = appItems.filter((appItem) => {
      if (hasCategoryFilter && appItem.categorySlug !== categoryFilter) {
        return false;
      }
      if (hasSearch) {
        for (let i = 0; i < queryWords.length; i++) {
          if (!appItem.searchableText.includes(queryWords[i])) return false;
        }
      }
      return true;
    });
  } else {
    appList = [...appItems];
  }

  const appSortKeySelector = APP_SORT_KEY_MAP[sortOrder];
  appList.sort((appItemA, appItemB) => {
    const universalDiff = compareUniversalApp(appItemA, appItemB);
    if (universalDiff !== 0) return universalDiff;

    if (appSortKeySelector) {
      return (
        appSortKeySelector(appItemA) - appSortKeySelector(appItemB) ||
        compareAppFallback(appItemA, appItemB)
      );
    }
    if (sortOrder === "alpha") {
      return (
        appItemA.appName.localeCompare(appItemB.appName) ||
        compareAppFallback(appItemA, appItemB)
      );
    }
    return compareDefaultApp(appItemA, appItemB);
  });

  return appList;
}

export function getAvailableCategories(
  appItems: AppItem[],
): { key: string; label: string }[] {
  const categoriesMap = new Map<string, string>();
  let hasNotOnGooglePlay = false;

  for (const appItem of appItems) {
    if (appItem.categorySlug === CATEGORY_UNIVERSAL) {
      hasNotOnGooglePlay = true;
    } else if (appItem.category) {
      categoriesMap.set(appItem.categorySlug, appItem.category);
    }
  }

  const sortedCategories = Array.from(categoriesMap.entries())
    .sort(([, labelA], [, labelB]) => labelA.localeCompare(labelB))
    .map(([key, label]) => ({ key, label }));

  return [
    { key: "all", label: "All categories" },
    ...(hasNotOnGooglePlay
      ? [{ key: CATEGORY_UNIVERSAL, label: CATEGORY_LABEL_UNIVERSAL }]
      : []),
    ...sortedCategories,
  ];
}

export function getBundleItems(
  bundles: Bundle[],
  searchQuery = "",
  sortOrder = "default",
  categoryFilter = "all",
): Bundle[] {
  let bundleList: Bundle[];

  const queryWords = parseSearchQuery(searchQuery);
  const isOfficialFilter = categoryFilter === "official";
  const isUnofficialFilter = categoryFilter === "unofficial";
  const hasCategoryFilter = isOfficialFilter || isUnofficialFilter;
  const hasSearch = queryWords.length > 0;

  if (hasCategoryFilter || hasSearch) {
    bundleList = bundles.filter((bundleItem) => {
      if (isOfficialFilter && bundleItem.isUnofficial) return false;
      if (isUnofficialFilter && !bundleItem.isUnofficial) return false;

      if (hasSearch) {
        for (let i = 0; i < queryWords.length; i++) {
          if (!bundleItem.searchableText.includes(queryWords[i])) return false;
        }
      }
      return true;
    });
  } else {
    bundleList = [...bundles];
  }

  const bundleSortKeySelector = BUNDLE_SORT_KEY_MAP[sortOrder];
  if (bundleSortKeySelector) {
    bundleList.sort(
      (bundleA, bundleB) =>
        bundleSortKeySelector(bundleA) - bundleSortKeySelector(bundleB) ||
        compareBundleFallback(bundleA, bundleB),
    );
  } else if (sortOrder === "alpha") {
    bundleList.sort(
      (bundleA, bundleB) =>
        bundleA.name.localeCompare(bundleB.name) ||
        compareBundleFallback(bundleA, bundleB),
    );
  } else {
    bundleList.sort(compareDefaultBundle);
  }

  return bundleList;
}

export interface BundleGroupData {
  bundleKey: string;
  bundleMeta: Bundle;
  patches: RowItem[];
  totalPatchCount: number;
}

export function getAppBundleGroups(
  activeData: ActiveData,
  packageName: string,
  searchQuery: string,
): BundleGroupData[] {
  const rawPatches = activeData.appPatchesMap[packageName] || [];
  if (rawPatches.length === 0) return [];

  const rawBundlesMap = new Map<
    string,
    { patches: RowItem[]; bundleMeta: Bundle }
  >();
  for (const patchItem of rawPatches) {
    const bundleKey = patchItem.bundleKey.toLowerCase();
    let group = rawBundlesMap.get(bundleKey);
    if (!group) {
      const bundleMeta = activeData.bundleMap[bundleKey];
      if (!bundleMeta) continue;
      group = { patches: [], bundleMeta };
      rawBundlesMap.set(bundleKey, group);
    }
    group.patches.push(patchItem);
  }

  const queryWords = parseSearchQuery(searchQuery);
  const result: BundleGroupData[] = [];

  for (const [bundleKey, group] of rawBundlesMap.entries()) {
    const totalPatchCount = group.patches.length;
    let filteredPatches = group.patches;

    if (queryWords.length > 0) {
      const bundleNameClean = simplifyString(group.bundleMeta.name);
      const bundleRepoClean = simplifyString(group.bundleMeta.repo);
      const isBundleMatched = queryWords.every(
        (word) =>
          bundleNameClean.includes(word) || bundleRepoClean.includes(word),
      );

      if (!isBundleMatched) {
        filteredPatches = group.patches.filter((patchItem) =>
          queryWords.every((word) =>
            patchItem.searchPatchesText.includes(word),
          ),
        );
      }
    }

    if (filteredPatches.length > 0) {
      result.push({
        bundleKey,
        bundleMeta: group.bundleMeta,
        patches: filteredPatches,
        totalPatchCount,
      });
    }
  }

  return result.sort((groupA, groupB) =>
    compareDefaultBundle(groupA.bundleMeta, groupB.bundleMeta),
  );
}

export interface AppGroupData {
  packageName: string;
  appMeta: AppMeta;
  patches: RowItem[];
  totalPatchCount: number;
}

export function groupPatchesByApp(
  patches: RowItem[],
  activeData: ActiveData,
  searchQuery: string = "",
): AppGroupData[] {
  if (!patches || patches.length === 0) return [];

  const rawAppsMap = new Map<
    string,
    { patches: RowItem[]; appMeta: AppGroupData["appMeta"] }
  >();
  for (const patchItem of patches) {
    const packageName = patchItem.packageName;
    let group = rawAppsMap.get(packageName);
    if (!group) {
      group = {
        patches: [],
        appMeta: getAppMeta(packageName, activeData.namesMap),
      };
      rawAppsMap.set(packageName, group);
    }
    group.patches.push(patchItem);
  }

  const queryWords = parseSearchQuery(searchQuery);
  const result: AppGroupData[] = [];

  for (const [packageName, group] of rawAppsMap.entries()) {
    const totalPatchCount = group.patches.length;
    let filteredPatches = group.patches;

    if (queryWords.length > 0) {
      const appNameClean = simplifyString(group.appMeta.appName);
      const packageNameClean = simplifyString(packageName);
      const isAppMatched = queryWords.every(
        (word) =>
          appNameClean.includes(word) || packageNameClean.includes(word),
      );

      if (!isAppMatched) {
        filteredPatches = group.patches.filter((patchItem) =>
          queryWords.every((word) =>
            patchItem.searchPatchesText.includes(word),
          ),
        );
      }
    }

    if (filteredPatches.length > 0) {
      result.push({
        packageName,
        appMeta: group.appMeta,
        patches: filteredPatches,
        totalPatchCount,
      });
    }
  }

  return result.sort((groupA, groupB) =>
    compareDefaultApp(groupA.appMeta, groupB.appMeta),
  );
}

export function getBundleAppGroups(
  activeData: ActiveData,
  bundleKey: string,
  searchQuery: string,
): AppGroupData[] {
  const bundleKeyLower = bundleKey.toLowerCase();
  const filteredPatches = activeData.bundlePatchesMap[bundleKeyLower] || [];
  return groupPatchesByApp(filteredPatches, activeData, searchQuery);
}
