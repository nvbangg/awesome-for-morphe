export interface PatchOption {
  key: string;
  title: string;
  description: string;
}

export interface CompatibilityItem {
  packageName?: string;
  isPreRelease?: boolean;
  targets?: Array<{ version?: string; isExperimental?: boolean }>;
}

export interface PatchItem {
  name: string;
  description: string;
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
  name: string;
  iconUrl: string;
  description: string;
  minInstalls: number;
  category: string;
  firstSeen: number;
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
  apps?: Record<string, WhatsNewAppChange>;
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
