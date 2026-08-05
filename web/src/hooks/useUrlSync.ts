import { useState, useEffect, useCallback } from "react";

export type NavigationTabType = "apps" | "bundles" | "whats-new";

const KNOWN_SORTS = new Set(["default", "new", "downloads", "patches", "updated", "hot", "apps", "stars", "alphabetical", "alpha", "abc"]);

function parseSortSlug(slug: string): string {
  const clean = slug.toLowerCase();
  if (clean === "alpha" || clean === "alphabetical" || clean === "abc") return "alphabetical";
  if (["downloads", "patches", "new", "updated", "hot", "apps", "stars"].includes(clean)) return clean;
  return "default";
}

function parseHash(hash: string): { tab: NavigationTabType; category: string; sort: string } {
  const cleanHash = hash.startsWith("#") ? hash.substring(1) : hash;
  if (cleanHash === "whats-new") {
    return { tab: "whats-new", category: "all", sort: "default" };
  }
  if (!cleanHash) {
    return { tab: "apps", category: "all", sort: "default" };
  }

  const parts = cleanHash.split(":");
  const tab: NavigationTabType = parts[0] === "bundles" ? "bundles" : parts[0] === "whats-new" ? "whats-new" : "apps";

  if (tab === "whats-new") {
    return { tab: "whats-new", category: "all", sort: "default" };
  }

  const part1 = parts[1] ? parts[1].toLowerCase() : "";
  const part2 = parts[2] ? parts[2].toLowerCase() : "";

  if (tab === "bundles") {
    return { tab: "bundles", category: "all", sort: parseSortSlug(part1) };
  }

  let category = "all";
  let sort = "default";

  if (!part1) {
    return { tab: "apps", category: "all", sort: "default" };
  }

  if (KNOWN_SORTS.has(part1)) {
    sort = parseSortSlug(part1);
    category = part2 || "all";
  } else {
    category = part1;
    sort = part2 ? parseSortSlug(part2) : "default";
  }

  return { tab: "apps", category, sort };
}

function getSortSlug(sortKey: string): string {
  if (!sortKey || sortKey === "default") return "";
  if (sortKey === "alphabetical") return "alpha";
  return sortKey;
}

function buildHash(tab: NavigationTabType, category: string, sort: string): string {
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

export function useUrlSync() {
  const [activeTab, setActiveTab] = useState<NavigationTabType>("apps");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [appsSort, setAppsSort] = useState<string>("default");
  const [bundlesSort, setBundlesSort] = useState<string>("default");
  const [selectedAppPackageName, setSelectedAppPackageName] = useState<string | null>(null);
  const [popupBundleKey, setPopupBundleKey] = useState<string | null>(null);
  const [popupSearchQuery, setPopupSearchQuery] = useState<string>("");

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
    }

    if (parsedHash.tab === "apps") {
      setAppsSort(parsedHash.sort);
    } else if (parsedHash.tab === "bundles") {
      setBundlesSort(parsedHash.sort);
    }

    setSelectedAppPackageName(searchParameters.get("app"));

    const githubRepository = searchParameters.get("github");
    const gitlabRepository = searchParameters.get("gitlab");
    const isTestBundleUrl = searchParameters.has("test-bundle") || window.location.hash.includes("test-bundle");

    if (!isTestBundleUrl) {
      if (githubRepository) {
        setPopupBundleKey(`github:${githubRepository}`);
      } else if (gitlabRepository) {
        setPopupBundleKey(`gitlab:${gitlabRepository}`);
      } else {
        setPopupBundleKey(null);
      }
    } else {
      setPopupBundleKey(null);
    }

    setPopupSearchQuery(searchParameters.get("patch") || "");
  }, []);

  useEffect(() => {
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    window.addEventListener("hashchange", syncFromUrl);
    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener("hashchange", syncFromUrl);
    };
  }, [syncFromUrl]);

  const updateUrl = useCallback(
    (urlUpdates: { app?: string | null; bundle?: string | null; search?: string; tab?: NavigationTabType; category?: string; sort?: string; whatsNew?: boolean }) => {
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
            const repositorySource = urlUpdates.bundle.substring(0, colonIndex);
            const repositoryPath = urlUpdates.bundle.substring(colonIndex + 1);
            targetUrl.searchParams.set(repositorySource, repositoryPath);
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

      const nextTab = urlUpdates.tab !== undefined ? urlUpdates.tab : activeTab;
      const nextCategory = urlUpdates.category !== undefined ? urlUpdates.category : selectedCategory;

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
