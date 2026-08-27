import { useState, useEffect, useCallback } from "react";
import { VALID_APP_SORTS, VALID_BUNDLE_SORTS } from "@/services";
import { DEFAULT_TAB } from "@/constants";

export type NavigationTabType = "apps" | "bundles" | "whats-new";

function parseTabSegments(
  segments: string[],
  validSorts: Set<string>,
): { category: string; sort: string } {
  const firstSegment = segments[0] || "";
  const secondSegment = segments[1] || "";

  const isFirstSegmentSort = validSorts.has(firstSegment);
  const category = (isFirstSegmentSort ? secondSegment : firstSegment) || "all";
  const sort = isFirstSegmentSort
    ? firstSegment
    : validSorts.has(secondSegment)
      ? secondSegment
      : "default";

  return { category, sort };
}

function parseHash(hash: string): {
  tab: NavigationTabType;
  category: string;
  sort: string;
} {
  const cleanHash = hash.replace(/^#/, "").toLowerCase();
  if (!cleanHash) {
    return { tab: DEFAULT_TAB, category: "all", sort: "default" };
  }

  const parts = cleanHash.split(":");
  const firstPart = parts[0];

  if (firstPart === "whats-new") {
    return { tab: "whats-new", category: "all", sort: "default" };
  }

  if (firstPart === "bundles") {
    const { category, sort } = parseTabSegments(
      parts.slice(1),
      VALID_BUNDLE_SORTS,
    );
    return { tab: "bundles", category, sort };
  }

  if (firstPart === "apps") {
    const { category, sort } = parseTabSegments(
      parts.slice(1),
      VALID_APP_SORTS,
    );
    return { tab: "apps", category, sort };
  }

  return { tab: DEFAULT_TAB, category: "all", sort: "default" };
}

function getSortSlug(sortKey: string): string {
  if (!sortKey || sortKey === "default") return "";
  return sortKey;
}

function buildHash(
  tab: NavigationTabType,
  category: string,
  sort: string,
): string {
  if (tab === "whats-new") return "#whats-new";

  const categorySlug = category && category !== "all" ? category : "";
  const sortSlug = getSortSlug(sort);

  return [`#${tab}`, categorySlug, sortSlug].filter(Boolean).join(":");
}

function getInitState() {
  if (typeof window === "undefined") {
    return {
      activeTab: DEFAULT_TAB,
      appsCategory: "all",
      bundlesCategory: "all",
      appsSort: "default",
      bundlesSort: "default",
      selectedAppPackageName: null as string | null,
      popupBundleKey: null as string | null,
      popupSearchQuery: "",
    };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const parsedHash = parseHash(window.location.hash);

  const activeTab = parsedHash.tab;
  const appsCategory = parsedHash.tab === "apps" ? parsedHash.category : "all";
  const bundlesCategory =
    parsedHash.tab === "bundles" ? parsedHash.category : "all";

  const appsSort = parsedHash.tab === "apps" ? parsedHash.sort : "default";
  const bundlesSort =
    parsedHash.tab === "bundles" ? parsedHash.sort : "default";

  const selectedAppPackageName = searchParams.get("app");

  const githubRepo = searchParams.get("github");
  const gitlabRepo = searchParams.get("gitlab");
  const isTestBundleUrl =
    searchParams.has("test-bundle") ||
    window.location.hash.includes("test-bundle");

  let popupBundleKey: string | null = null;
  if (!isTestBundleUrl) {
    if (githubRepo) {
      popupBundleKey = `github:${githubRepo}`;
    } else if (gitlabRepo) {
      popupBundleKey = `gitlab:${gitlabRepo}`;
    } else {
      popupBundleKey = null;
    }
  }

  const popupSearchQuery = searchParams.get("patch") || "";

  return {
    activeTab,
    appsCategory,
    bundlesCategory,
    appsSort,
    bundlesSort,
    selectedAppPackageName,
    popupBundleKey,
    popupSearchQuery,
  };
}

export function useUrlSync() {
  const [initState] = useState(getInitState);

  const [activeTab, setActiveTab] = useState<NavigationTabType>(
    initState.activeTab,
  );
  const [appsCategory, setAppsCategory] = useState(initState.appsCategory);
  const [bundlesCategory, setBundlesCategory] = useState(
    initState.bundlesCategory,
  );
  const [appsSort, setAppsSort] = useState(initState.appsSort);
  const [bundlesSort, setBundlesSort] = useState(initState.bundlesSort);
  const [selectedAppPackageName, setSelectedAppPackageName] = useState<
    string | null
  >(initState.selectedAppPackageName);
  const [popupBundleKey, setPopupBundleKey] = useState<string | null>(
    initState.popupBundleKey,
  );
  const [popupSearchQuery, setPopupSearchQuery] = useState(
    initState.popupSearchQuery,
  );

  const selectedCategory =
    activeTab === "bundles" ? bundlesCategory : appsCategory;
  const sortOrder = activeTab === "bundles" ? bundlesSort : appsSort;

  const syncFromUrl = useCallback(() => {
    if (typeof window === "undefined") return;

    if (/%2F/i.test(window.location.search)) {
      const cleanSearchUrl = window.location.href.replace(/%2F/gi, "/");
      window.history.replaceState(null, "", cleanSearchUrl);
    }

    const nextState = getInitState();

    setActiveTab(nextState.activeTab);
    setAppsCategory(nextState.appsCategory);
    setBundlesCategory(nextState.bundlesCategory);
    setAppsSort(nextState.appsSort);
    setBundlesSort(nextState.bundlesSort);
    setSelectedAppPackageName(nextState.selectedAppPackageName);
    setPopupBundleKey(nextState.popupBundleKey);
    setPopupSearchQuery(nextState.popupSearchQuery);
  }, []);

  useEffect(() => {
    window.addEventListener("popstate", syncFromUrl);
    window.addEventListener("hashchange", syncFromUrl);
    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener("hashchange", syncFromUrl);
    };
  }, [syncFromUrl]);

  const updateUrl = useCallback(
    (urlUpdates: {
      app?: string | null;
      bundle?: string | null;
      search?: string;
      tab?: NavigationTabType;
      category?: string;
      sort?: string;
    }) => {
      if (typeof window === "undefined") return;

      const targetUrl = new URL(window.location.href);

      if (urlUpdates.app !== undefined) {
        if (urlUpdates.app) {
          targetUrl.searchParams.set("app", urlUpdates.app);
        } else {
          targetUrl.searchParams.delete("app");
        }
      }

      if (urlUpdates.bundle !== undefined) {
        if (urlUpdates.bundle) {
          const [source, repo] = urlUpdates.bundle.split(":");
          if (source && repo) {
            targetUrl.searchParams.set(source, repo);
          }
        } else {
          targetUrl.searchParams.delete("github");
          targetUrl.searchParams.delete("gitlab");
        }
      }

      if (urlUpdates.search !== undefined) {
        if (urlUpdates.search) {
          targetUrl.searchParams.set("patch", urlUpdates.search);
        } else {
          targetUrl.searchParams.delete("patch");
        }
      }

      let nextTab = activeTab;
      let nextCategory =
        activeTab === "bundles" ? bundlesCategory : appsCategory;
      let nextSort = activeTab === "bundles" ? bundlesSort : appsSort;

      if (urlUpdates.tab !== undefined) {
        nextTab = urlUpdates.tab;
        setActiveTab(urlUpdates.tab);
        nextCategory =
          urlUpdates.tab === "bundles" ? bundlesCategory : appsCategory;
        nextSort = urlUpdates.tab === "bundles" ? bundlesSort : appsSort;
      }

      if (urlUpdates.category !== undefined) {
        nextCategory = urlUpdates.category;
        if (nextTab === "apps") {
          setAppsCategory(urlUpdates.category);
        } else if (nextTab === "bundles") {
          setBundlesCategory(urlUpdates.category);
        }
      }

      if (urlUpdates.sort !== undefined) {
        nextSort = urlUpdates.sort;
        if (nextTab === "apps") {
          setAppsSort(urlUpdates.sort);
        } else if (nextTab === "bundles") {
          setBundlesSort(urlUpdates.sort);
        }
      }

      targetUrl.hash = buildHash(nextTab, nextCategory, nextSort);

      const formattedUrlString = targetUrl.toString().replace(/%2F/gi, "/");
      window.history.pushState(null, "", formattedUrlString);
      syncFromUrl();
    },
    [
      syncFromUrl,
      activeTab,
      appsCategory,
      bundlesCategory,
      appsSort,
      bundlesSort,
    ],
  );

  return {
    activeTab,
    selectedCategory,
    sortOrder,
    selectedAppPackageName,
    popupBundleKey,
    popupSearchQuery,
    updateUrl,
  };
}
