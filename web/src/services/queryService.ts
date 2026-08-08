import {
  AppItem,
  RowItem,
  Bundle,
  ActiveData,
  AppNameMeta,
} from "@/types/data";

import { simplifyString, slugifyCategory, getAppMeta } from "@/utils";
import { CATEGORY_UNIVERSAL, CATEGORY_LABEL_UNIVERSAL } from "@/constants";
function parseSearchQuery(query: string): string[] {
  return query.trim().split(/\s+/).map(simplifyString).filter(Boolean);
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

  const queryWords = parseSearchQuery(searchQuery);
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
    categories.push({
      key: CATEGORY_UNIVERSAL,
      label: CATEGORY_LABEL_UNIVERSAL,
    });
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

  const queryWords = parseSearchQuery(searchQuery);
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

  const queryWords = parseSearchQuery(searchQuery);
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

  const queryWords = parseSearchQuery(searchQuery);
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
