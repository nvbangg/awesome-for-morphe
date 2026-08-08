import {
  ActiveData,
  Bundle,
  RowItem,
  AppItem,
  PatchItem,
  CompatibilityItem,
  PackageTarget,
  WhatsNewHistoryItem,
  ActiveStats,
  AppNameMeta,
} from "@/types/data";
import {
  buildBundleUrls,
  getAppMeta,
  extractVersions,
  simplifyString,
  slugifyCategory,
  decodeHtmlEntities,
} from "@/utils";

const universalDefaultTarget: PackageTarget[] = [
  { packageName: "universal", versions: [], isPreRelease: false },
];

const jsonCache = new Map<string, Promise<unknown>>();
let activeDataPromise: Promise<ActiveData> | null = null;

export function fetchJson<T = unknown>(
  url: string | URL,
  defaultFallbackData?: T,
): Promise<T> {
  const cacheKey = url.toString();
  if (!jsonCache.has(cacheKey)) {
    const fetchPromise = (async () => {
      try {
        const response = await fetch(url);
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

export function fetchWhatsNewHistory(): Promise<WhatsNewHistoryItem[]> {
  return fetchJson<WhatsNewHistoryItem[]>("whats-new.json", []);
}

interface BundlesResponseData {
  bundles: Bundle[];
  compatibilities: CompatibilityItem[][];
  store?: Record<string, AppNameMeta>;
}

export function loadInitialData(): Promise<ActiveData> {
  if (activeDataPromise) {
    return activeDataPromise;
  }

  activeDataPromise = (async () => {
    const sourcesData = await fetchJson<BundlesResponseData>("bundles.json", {
      bundles: [],
      compatibilities: [],
      store: {},
    });
    const namesMap = sourcesData.store ?? {};
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

      const bundleObj: Bundle = {
        source: jsonBundle.source,
        repo: jsonBundle.repo,
        name: jsonBundle.name,
        repoDescription: decodeHtmlEntities(jsonBundle.repoDescription),
        avatarUrl: jsonBundle.avatarUrl,
        stars: jsonBundle.stars,
        starsGained7d: jsonBundle.starsGained7d,
        starsGained40d: jsonBundle.starsGained40d,
        updatedAt: jsonBundle.updatedAt,
        firstSeen: jsonBundle.firstSeen,
        appFirstSeen: jsonBundle.appFirstSeen,
        patches: jsonBundle.patches,
        isPreRelease: !!jsonBundle.isPreRelease,

        key: bundleKey,
        patchCount: jsonBundle.patches.length,
        appCount: jsonBundle.appFirstSeen
          ? Object.keys(jsonBundle.appFirstSeen).length
          : 0,
        repoUrl: calculatedUrls.repoUrl,
        deepLink: calculatedUrls.deepLink,
        changelogUrl: calculatedUrls.changelogUrl,
        searchableText: simplifyString(`${jsonBundle.name} ${jsonBundle.repo}`),
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
              patchName: patchItem.name,
              patchDescription: patchItem.description,
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
      whatsNewHistory: [],
      stats,
    };
  })();

  return activeDataPromise;
}
