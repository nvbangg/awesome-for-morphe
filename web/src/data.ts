// Copyright (c) 2026 nvbangg (github.com/nvbangg)

export interface Bundle {
  key: string;
  name?: string;
  source?: string;
  repo?: string;
  isPreRelease?: boolean;
  avatarUrl?: string;
  repoUrl?: string;
  changelogUrl?: string;
  updatedAt?: number;
  createdTimestamp?: number;
  patches?: PatchItem[];
  version?: string;
  appCount?: number;
  stars?: number;
  firstSeen?: string | Date;
  deepLink?: string;
}

export interface PatchOption {
  title?: string;
  key?: string;
  description?: string;
}

export interface CompatibilityItem {
  packageName?: string;
  isPreRelease?: boolean;
  targets?: Array<string | { version?: string; isExperimental?: boolean }>;
}

export interface PatchItem {
  name?: string;
  description?: string;
  options?: PatchOption[];
  use?: boolean;
  default?: boolean;
  isPreRelease?: boolean;
  compatiblePackagesKey?: number;
  compatiblePackages?: CompatibilityItem[];
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
  patchId: string;
  bundleKey: string;
  repo: string;
  bundleVersion: string;
  bundleCreatedAt: number;
  patchName: string;
  description: string;
  packageName: string;
  appName: string;
  appIcon: string;
  isBundlePreRelease: boolean;
  isAppPreRelease: boolean;
  isPatchPreRelease: boolean;
  versions: VersionItem[];
  enabled: boolean;
  options: PatchOption[];
  searchPatchesText: string;
}

export interface AppNameMeta {
  name?: string;
  iconUrl?: string;
}

export interface ActiveData {
  bundles: Bundle[];
  rows: RowItem[];
  bundleMap: Record<string, Bundle>;
  namesMap: Record<string, AppNameMeta | string>;
}

const jsonCache = new Map<string, Promise<unknown>>();
const dataCache = new Map<string, Promise<ActiveData>>();

const simplifyString = (inputString: string | undefined): string =>
  (inputString || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export async function fetchJson<T = unknown>(url: string | URL, data?: T): Promise<T> {
  const key = url.toString();
  if (!jsonCache.has(key)) {
    const fetchPromise = fetch(url, { cache: "no-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load ${new URL(url).pathname}: ${response.status}`);
        return response.json();
      })
      .catch(() => {
        jsonCache.delete(key);
        return data as T;
      });
    jsonCache.set(key, fetchPromise);
  }
  return jsonCache.get(key) as Promise<T>;
}

export function buildBundleUrls(source: string | undefined, repo: string | undefined, isPreRelease: boolean | undefined): { repoUrl: string; deepLink: string; changelogUrl: string } {
  if (!repo) return { repoUrl: "", deepLink: "", changelogUrl: "" };

  const repoUrl = `https://${source}.com/${repo}`;
  let deepLinkRepo = repo;
  if (isPreRelease) {
    deepLinkRepo = source === "gitlab" ? `${repo}/-/tree/dev` : `${repo}/tree/dev`;
  }
  return {
    repoUrl,
    deepLink: `https://morphe.software/add-source?${source}=${deepLinkRepo}`,
    changelogUrl: source === "gitlab" ? `${repoUrl}/-/releases` : `${repoUrl}/releases`,
  };
}

export function appName(packageName: string | undefined, metadata: Record<string, AppNameMeta | string>): string {
  const key = packageName || "universal";
  const meta = metadata[key] || {};

  if (typeof meta === "object" && meta !== null && (meta as AppNameMeta).name) return (meta as AppNameMeta).name!;
  if (typeof meta === "string") return meta;
  if (!packageName) return key;

  const last = packageName.split(".").at(-1) || packageName;
  return last.replace(/[-_]/g, " ").replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function extractVersions(value: unknown): VersionItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .flatMap((item) => {
      if (typeof item === "string") return [{ version: item, isExperimental: false }];
      if (item?.version)
        return [
          {
            version: String(item.version),
            isExperimental: !!item.isExperimental,
          },
        ];
      return [];
    })
    .sort((a, b) =>
      b.version.localeCompare(a.version, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
}

export const loadAppsJson = () => fetchJson<Record<string, AppNameMeta>>("apps.json", {} as Record<string, AppNameMeta>);

export async function loadInitialData(): Promise<ActiveData> {
  if (dataCache.has("latest")) {
    const cachedData = await dataCache.get("latest");
    return cachedData as ActiveData;
  }

  let resolveCache!: (value: ActiveData) => void;
  const cachePromise = new Promise<ActiveData>((resolve) => {
    resolveCache = resolve;
  });
  dataCache.set("latest", cachePromise);

  const [namesMap, sourcesData] = await Promise.all([
    loadAppsJson(),
    fetchJson<{ bundles: Bundle[]; compatibilities: CompatibilityItem[][] }>("bundles.json", { bundles: [], compatibilities: [] }).catch(() => ({ bundles: [], compatibilities: [] })),
  ]);
  const bundlesListRaw = sourcesData.bundles || [];
  const compatibilities = sourcesData.compatibilities || [];

  const bundleList: Bundle[] = [];
  const rows: RowItem[] = [];

  for (const bundleObj of bundlesListRaw) {
    const key = `${bundleObj.source}:${bundleObj.repo}`;
    if (!bundleObj.patches) continue;

    bundleObj.key = key;
    bundleObj.createdTimestamp = bundleObj.updatedAt || 0;
    const uniqueApps = new Set<string>();
    const urls = buildBundleUrls(bundleObj.source, bundleObj.repo, bundleObj.isPreRelease);
    bundleObj.repoUrl = urls.repoUrl;
    bundleObj.deepLink = urls.deepLink;
    bundleObj.changelogUrl = urls.changelogUrl;

    bundleList.push(bundleObj);

    const repo = bundleObj.repo || "";
    const bundleVersion = bundleObj.version || "";
    const bundleCreatedAt = bundleObj.updatedAt || 0;

    const patchRows = bundleObj.patches.flatMap((patch: PatchItem, patchIndex: number) => {
      const patchId = `${key}:${patchIndex}`;

      const compatiblePackages = patch.compatiblePackagesKey !== undefined ? compatibilities[patch.compatiblePackagesKey] : patch.compatiblePackages;

      const universalResult: PackageTarget[] = [{ packageName: "universal", versions: [], isPreRelease: false }];
      let packageRows: PackageTarget[] = universalResult;

      if (Array.isArray(compatiblePackages)) {
        const mapped = compatiblePackages.flatMap((item: CompatibilityItem) =>
          item?.packageName
            ? [
                {
                  packageName: item.packageName,
                  isPreRelease: !!item.isPreRelease,
                  versions: extractVersions(item.targets || []),
                },
              ]
            : [],
        );
        if (mapped.length) packageRows = mapped;
      }

      return packageRows.map((target, targetIndex) => {
        const packageName = target.packageName || "universal";
        uniqueApps.add(packageName);
        const name = appName(packageName, namesMap);
        const options = Array.isArray(patch.options) ? patch.options : [];

        const searchPatchesTextParts = [patch.name, patch.description];
        options.forEach((option: PatchOption) => searchPatchesTextParts.push(option.title, option.key, option.description));
        const searchPatchesText = simplifyString(searchPatchesTextParts.filter(Boolean).join(" "));

        return {
          id: `${patchId}:${targetIndex}`,
          patchId,
          bundleKey: key,
          repo,
          bundleVersion,
          bundleCreatedAt,
          patchName: patch.name || "Unnamed patch",
          description: patch.description || "",
          packageName,
          appName: name,
          appIcon: (namesMap[packageName] as AppNameMeta)?.iconUrl || "",
          isBundlePreRelease: !!bundleObj.isPreRelease,
          isAppPreRelease: !!target.isPreRelease,
          isPatchPreRelease: !!patch.isPreRelease,
          versions: target.versions,
          enabled: patch.use ?? patch.default ?? true,
          options,
          searchPatchesText,
        };
      });
    });

    bundleObj.appCount = uniqueApps.size;
    rows.push(...patchRows);
  }

  const bundleMap: Record<string, Bundle> = {};
  for (const bundle of bundleList) bundleMap[bundle.key.toLowerCase()] = bundle;

  const activeData: ActiveData = {
    bundles: bundleList,
    rows,
    bundleMap,
    namesMap,
  };

  resolveCache(activeData);

  return activeData;
}

export interface FilterOptions {
  query?: string;
  showOptions?: string[];
}

export function filterRows(data: ActiveData, filters: FilterOptions): RowItem[] {
  const searchQueryWords = (filters.query || "").split(/\s+/).map(simplifyString).filter(Boolean);

  let parsedShowOptions = null;
  if (filters.showOptions && filters.showOptions.length > 0) {
    parsedShowOptions = filters.showOptions.map((showOption: string) => {
      if (showOption.startsWith(":")) {
        const parts = showOption.slice(1).split(":");
        return {
          bundle: "",
          app: parts[0] || "",
          patch: parts.length > 1 ? parts.slice(1).join(":") : "",
        };
      }
      const parts = showOption.split(":");
      const bundle = parts.length >= 2 ? `${parts[0]}:${parts[1]}` : parts[0];
      return {
        bundle: bundle,
        app: parts.length >= 3 ? parts[2] : "",
        patch: parts.length > 3 ? parts.slice(3).join(":") : "",
      };
    });
  }

  return data.rows.filter((row) => {
    if (parsedShowOptions) {
      const matched = parsedShowOptions.some((showFilter: { bundle: string; app: string; patch: string }) => {
        if (showFilter.bundle && row.bundleKey.toLowerCase() !== showFilter.bundle.toLowerCase()) return false;

        if (showFilter.app && row.packageName.toLowerCase() !== showFilter.app.toLowerCase()) return false;

        if (showFilter.patch && row.patchName.toLowerCase() !== showFilter.patch.toLowerCase()) return false;

        return true;
      });
      if (!matched) return false;
    }

    if (searchQueryWords.length > 0) {
      if (!searchQueryWords.every((searchWord: string) => row.searchPatchesText.includes(searchWord))) return false;
    }

    return true;
  });
}

export interface DropdownOption {
  value: string;
  label: string;
  icon?: string;
  repo?: string;
}

function buildFilterOptions(
  appMap: Map<string, { label: string; icon: string }>,
  bundleSet: Set<string>,
  namesMap: Record<string, AppNameMeta | string>,
  hasUniversal: boolean,
): { bundleOptions: DropdownOption[]; appOptions: DropdownOption[] } {
  const appOptions: DropdownOption[] = Array.from(appMap.entries())
    .map(([value, { label, icon }]) => ({ value, label, icon }))
    .sort((appA, appB) => appA.label.localeCompare(appB.label) || appA.value.localeCompare(appB.value));

  if (hasUniversal) {
    const meta = namesMap["universal"];
    appOptions.unshift({
      value: "universal",
      label: appName("universal", namesMap),
      icon: (typeof meta === "object" && meta !== null ? (meta as AppNameMeta).iconUrl : "") || "",
    });
  }

  return {
    bundleOptions: Array.from(bundleSet)
      .sort((firstItem: string, secondItem: string) => firstItem.localeCompare(secondItem))
      .map((value: string) => ({ value, label: value })),
    appOptions,
  };
}

export function getFilterOptions(rows: RowItem[], namesMap: Record<string, AppNameMeta | string> = {}): { bundleOptions: DropdownOption[]; appOptions: DropdownOption[] } {
  const appMap = new Map<string, { label: string; icon: string }>();
  const bundleSet = new Set<string>();
  let hasUniversal = false;

  for (const row of rows) {
    bundleSet.add(row.bundleKey);
    if (row.packageName && row.packageName !== "universal") {
      if (!appMap.has(row.packageName)) {
        appMap.set(row.packageName, { label: row.appName, icon: row.appIcon });
      }
    } else {
      hasUniversal = true;
    }
  }

  return buildFilterOptions(appMap, bundleSet, namesMap, hasUniversal);
}

export function summarizeRows(rows: RowItem[]): {
  bundles: number;
  patches: number;
  apps: number;
} {
  const bundles = new Set();
  const patches = new Set();
  const apps = new Set();
  for (const row of rows) {
    bundles.add(row.bundleKey);
    patches.add(row.patchId);
    apps.add(row.packageName);
  }
  return { bundles: bundles.size, patches: patches.size, apps: apps.size };
}
