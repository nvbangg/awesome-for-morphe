import { useState, useEffect, useCallback } from "react";
import { VALID_APP_SORTS, VALID_BUNDLE_SORTS } from "@/services";
import { DEFAULT_TAB } from "@/constants";

export type NavigationTabType = "apps" | "bundles" | "whats-new";

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
    const sort = VALID_BUNDLE_SORTS.has(parts[1]) ? parts[1] : "default";
    return { tab: "bundles", category: "all", sort };
  }

  if (firstPart === "apps") {
    const firstSegment = parts[1] || "";
    const secondSegment = parts[2] || "";

    const isFirstSegmentSort = VALID_APP_SORTS.has(firstSegment);
    const category =
      (isFirstSegmentSort ? secondSegment : firstSegment) || "all";
    const sort = isFirstSegmentSort
      ? firstSegment
      : VALID_APP_SORTS.has(secondSegment)
        ? secondSegment
        : "default";

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

  if (tab === "bundles") {
    return sortSlug ? `#bundles:${sortSlug}` : "#bundles";
  }

  if (!categorySlug && !sortSlug) return "#apps";
  if (categorySlug && !sortSlug) return `#apps:${categorySlug}`;
  if (!categorySlug && sortSlug) return `#apps:${sortSlug}`;
  return `#apps:${categorySlug}:${sortSlug}`;
}

function getInitialState() {
  if (typeof window === "undefined") {
    return {
      activeTab: DEFAULT_TAB,
      selectedCategory: "all",
      appsSort: "default",
      bundlesSort: "default",
      selectedAppPackageName: null as string | null,
      popupBundleKey: null as string | null,
      popupSearchQuery: "",
    };
  }

  const searchParameters = new URLSearchParams(window.location.search);
  const parsedHash = parseHash(window.location.hash);

  const activeTab = parsedHash.tab;
  const selectedCategory = parsedHash.category;

  const appsSort = parsedHash.tab === "apps" ? parsedHash.sort : "default";
  const bundlesSort =
    parsedHash.tab === "bundles" ? parsedHash.sort : "default";

  const selectedAppPackageName = searchParameters.get("app");

  const githubRepo = searchParameters.get("github");
  const gitlabRepo = searchParameters.get("gitlab");
  const isTestBundleUrl =
    searchParameters.has("test-bundle") ||
    window.location.hash.includes("test-bundle");

  let popupBundleKey: string | null = null;
  if (!isTestBundleUrl) {
    if (githubRepo) {
      popupBundleKey = `github:${githubRepo}`;
    } else if (gitlabRepo) {
      popupBundleKey = `gitlab:${gitlabRepo}`;
    }
  }

  const popupSearchQuery = searchParameters.get("patch") || "";

  return {
    activeTab,
    selectedCategory,
    appsSort,
    bundlesSort,
    selectedAppPackageName,
    popupBundleKey,
    popupSearchQuery,
  };
}

export function useUrlSync() {
  const [initialState] = useState(getInitialState);

  const [activeTab, setActiveTab] = useState<NavigationTabType>(
    initialState.activeTab,
  );
  const [selectedCategory, setSelectedCategory] = useState(
    initialState.selectedCategory,
  );
  const [appsSort, setAppsSort] = useState(initialState.appsSort);
  const [bundlesSort, setBundlesSort] = useState(initialState.bundlesSort);
  const [selectedAppPackageName, setSelectedAppPackageName] = useState<
    string | null
  >(initialState.selectedAppPackageName);
  const [popupBundleKey, setPopupBundleKey] = useState<string | null>(
    initialState.popupBundleKey,
  );
  const [popupSearchQuery, setPopupSearchQuery] = useState(
    initialState.popupSearchQuery,
  );

  const sortOrder = activeTab === "bundles" ? bundlesSort : appsSort;

  const syncFromUrl = useCallback(() => {
    if (typeof window === "undefined") return;

    if (/%2F/i.test(window.location.search)) {
      const cleanSearchUrl = window.location.href.replace(/%2F/gi, "/");
      window.history.replaceState(null, "", cleanSearchUrl);
    }

    const searchParameters = new URLSearchParams(window.location.search);
    const parsedHash = parseHash(window.location.hash);

    setActiveTab(parsedHash.tab);
    if (parsedHash.tab === "apps") {
      setSelectedCategory(parsedHash.category);
      setAppsSort(parsedHash.sort);
    } else if (parsedHash.tab === "bundles") {
      setBundlesSort(parsedHash.sort);
    }

    setSelectedAppPackageName(searchParameters.get("app"));

    const githubRepo = searchParameters.get("github");
    const gitlabRepo = searchParameters.get("gitlab");
    const isTestBundleUrl =
      searchParameters.has("test-bundle") ||
      window.location.hash.includes("test-bundle");

    if (!isTestBundleUrl) {
      if (githubRepo) {
        setPopupBundleKey(`github:${githubRepo}`);
      } else if (gitlabRepo) {
        setPopupBundleKey(`gitlab:${gitlabRepo}`);
      } else {
        setPopupBundleKey(null);
      }
    } else {
      setPopupBundleKey(null);
    }

    setPopupSearchQuery(searchParameters.get("patch") || "");
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
        targetUrl.searchParams.delete("github");
        targetUrl.searchParams.delete("gitlab");

        if (urlUpdates.bundle) {
          const colonIndex = urlUpdates.bundle.indexOf(":");
          if (colonIndex !== -1) {
            const repoSource = urlUpdates.bundle.substring(0, colonIndex);
            const repoPath = urlUpdates.bundle.substring(colonIndex + 1);
            targetUrl.searchParams.set(repoSource, repoPath);
          }
        }
      }

      if (urlUpdates.search !== undefined) {
        if (urlUpdates.search) {
          targetUrl.searchParams.set("patch", urlUpdates.search);
        } else {
          targetUrl.searchParams.delete("patch");
        }
      }

      const nextTab = urlUpdates.tab ?? activeTab;
      const nextCategory = urlUpdates.category ?? selectedCategory;

      let nextSort = activeTab === "bundles" ? bundlesSort : appsSort;

      if (urlUpdates.sort !== undefined) {
        nextSort = urlUpdates.sort;
        if (nextTab === "apps") {
          setAppsSort(urlUpdates.sort);
        } else if (nextTab === "bundles") {
          setBundlesSort(urlUpdates.sort);
        }
      } else if (urlUpdates.tab !== undefined) {
        if (urlUpdates.tab === "apps") {
          nextSort = appsSort;
        } else if (urlUpdates.tab === "bundles") {
          nextSort = bundlesSort;
        }
      }

      targetUrl.hash = buildHash(nextTab, nextCategory, nextSort);

      const formattedUrlString = targetUrl.toString().replace(/%2F/gi, "/");
      window.history.pushState(null, "", formattedUrlString);
      syncFromUrl();
    },
    [syncFromUrl, activeTab, selectedCategory, appsSort, bundlesSort],
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
