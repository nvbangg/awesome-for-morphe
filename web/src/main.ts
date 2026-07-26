// Copyright (c) 2026 nvbangg (github.com/nvbangg)

import { createApp, ref, computed, onMounted, watch, reactive, nextTick } from "vue";
import { filterRows, getFilterOptions, loadInitialData, loadAppsJson, summarizeRows, appName, fetchJson } from "./data.js";
import type { ActiveData, RowItem, Bundle, PatchOption, VersionItem, AppNameMeta } from "./data.js";

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

interface AppElement {
  id: string;
  appName: string;
  appIcon?: string;
  packageName?: string;
  versions?: VersionItem[];
  isAppPreRelease?: boolean;
}

interface PatchGroupItem {
  id: string;
  patchName: string;
  description?: string;
  enabled?: boolean;
  options?: PatchOption[];
  apps: AppElement[];
  isPatchPreRelease?: boolean;
}

interface GroupItem {
  key: string;
  bundle: Bundle;
  rows: RowItem[];
  patches: PatchGroupItem[];
  appsList: AppElement[];
}

type HTMLElementWithObserver = HTMLElement & {
  resizeObserver?: ResizeObserver | null;
};

function tokenize(inputString: string) {
  const tokens = [];
  let current = "";
  for (let i = 0; i < inputString.length; i++) {
    const char = inputString[i];
    if (char === '"') {
      let quoted = "";
      i++;
      while (i < inputString.length && inputString[i] !== '"') {
        quoted += inputString[i];
        i++;
      }
      tokens.push({ type: "STRING", value: quoted });
    } else if (["(", ")", ":", ","].includes(char)) {
      if (current.trim()) {
        tokens.push({ type: "LITERAL", value: current.trim() });
        current = "";
      } else if (char === ":") {
        tokens.push({ type: "LITERAL", value: "" });
      }
      tokens.push({ type: char });
    } else {
      current += char;
    }
  }
  if (current.trim()) tokens.push({ type: "LITERAL", value: current.trim() });
  return tokens;
}

// Parses nested filter strings like "bundle:(app:(patch1,patch2))" into an array of paths: ["bundle:app:patch1", "bundle:app:patch2"]
function parseShowTrie(inputString: string) {
  const tokens = tokenize(inputString);
  let pos = 0;
  const results: string[] = [];

  function parseNode(prefixItem: string | null) {
    if (pos >= tokens.length) return;
    if (tokens[pos].type === "(") {
      pos++;
      while (pos < tokens.length && tokens[pos].type !== ")") {
        parseNode(prefixItem);
        if (pos < tokens.length && tokens[pos].type === ",") pos++;
      }
      if (pos < tokens.length && tokens[pos].type === ")") pos++;
    } else {
      const tokenValue = tokens[pos].value;
      pos++;
      const newPrefix = prefixItem ? `${prefixItem}:${tokenValue}` : tokenValue || null;
      if (pos < tokens.length && tokens[pos].type === ":") {
        pos++;
        parseNode(newPrefix);
      } else if (newPrefix) {
        results.push(newPrefix);
      }
    }
  }

  while (pos < tokens.length) {
    parseNode(null);
    if (pos < tokens.length && tokens[pos].type === ",") pos++;
  }
  return results;
}

// Converts a dictionary of paths back into a nested string format for URL storage
const stringifyTrie = (bundlesDict: Record<string, Record<string, string[]>>) => {
  return Object.entries(bundlesDict)
    .map(([bundle, apps]) => {
      if (!apps || Object.keys(apps).length === 0) return bundle;
      const appStrs = Object.entries(apps).map(([app, patches]) => {
        if (!patches || patches.length === 0) return app;
        if (patches.length === 1) return `${app}:${formatPatchName(patches[0])}`;
        return `${app}:(${patches.map(formatPatchName).join(",")})`;
      });
      return appStrs.length === 1 ? `${bundle}:${appStrs[0]}` : `${bundle}:(${appStrs.join(",")})`;
    })
    .join(",");
};

const formatPatchName = (patchName: string) => {
  if (typeof patchName !== "string") return patchName;
  return /[:,()]/.test(patchName) ? `"${patchName}"` : patchName;
};

function useListUI(namespace: string = "") {
  const expandedOptions = reactive(new Set<string>());
  const expandedAppLists = reactive(new Set<string>());
  const overflowingAppLists = reactive(new Set<string>());
  const expandedVersions = reactive(new Set<string>());
  const appListRefs = new Map<string, HTMLElementWithObserver>();
  const touchStartX = ref<number>(0);
  const touchStartY = ref<number>(0);

  const toggleOptions = (id: string) => (expandedOptions.has(id) ? expandedOptions.delete(id) : expandedOptions.add(id));
  const toggleVersions = (id: string) => (expandedVersions.has(id) ? expandedVersions.delete(id) : expandedVersions.add(id));

  // Checks if the app list wraps to multiple lines in grid view to show the "Expand apps" button
  const checkOverflow = (element: HTMLElementWithObserver | null | undefined, key: string) => {
    if (!element) return;
    const wasExpanded = expandedAppLists.has(key);
    if (wasExpanded) {
      element.classList.add("flex-nowrap", "overflow-x-auto");
      element.classList.remove("flex-wrap");
    }
    const isOverflowing = element.scrollWidth > Math.ceil(element.clientWidth) + 2;
    if (wasExpanded) {
      element.classList.remove("flex-nowrap", "overflow-x-auto");
      element.classList.add("flex-wrap");
    }

    if (isOverflowing) {
      overflowingAppLists.add(key);
    } else {
      overflowingAppLists.delete(key);
      if (wasExpanded) expandedAppLists.delete(key);
    }
  };

  const setupOverflowObserver = (element: HTMLElementWithObserver | null | undefined, key: string) => {
    if (element) {
      appListRefs.set(key, element);
      if (!element.resizeObserver) {
        const observer = new ResizeObserver(() => checkOverflow(element, key));
        observer.observe(element);
        element.resizeObserver = observer;
      }
      checkOverflow(element, key);
    } else {
      const oldElement = appListRefs.get(key);
      if (oldElement?.resizeObserver) {
        oldElement.resizeObserver.disconnect();
        oldElement.resizeObserver = null;
      }
      appListRefs.delete(key);
    }
  };

  const toggleAppList = (id: string) => {
    expandedAppLists.has(id) ? expandedAppLists.delete(id) : expandedAppLists.add(id);
    setTimeout(() => {
      const element = appListRefs.get(id);
      if (element) checkOverflow(element, id);
    }, 50);
  };

  const collapseBundle = (groupItem: GroupItem) => {
    expandedAppLists.delete(groupItem.key);
    if (groupItem.appsList) {
      groupItem.appsList.forEach((appItem: AppElement) => expandedOptions.delete(`${namespace}app_${groupItem.key}_${appItem.id}`));
    }
    if (groupItem.patches) {
      groupItem.patches.forEach((patch: PatchGroupItem) => {
        expandedOptions.delete(patch.id);
        if (patch.apps) patch.apps.forEach((appElement: AppElement) => expandedVersions.delete(appElement.id));
      });
    }
  };

  const selectApp = (groupKey: string, clickedApp: AppElement, appsList: AppElement[]) => {
    const clickedKey = `${namespace}app_${groupKey}_${clickedApp.id}`;
    const isCurrentlyExpanded = expandedOptions.has(clickedKey);

    if (namespace !== "popup_") {
      appsList.forEach((appItem) => {
        const key = `${namespace}app_${groupKey}_${appItem.id}`;
        if (key !== clickedKey && expandedOptions.has(key)) expandedOptions.delete(key);
      });
      if (!isCurrentlyExpanded) {
        expandedOptions.add(clickedKey);
        nextTick(() => {
          const buttonElement = document.getElementById(`tab_${namespace}${groupKey}_${clickedApp.id}`);
          if (buttonElement?.parentElement) {
            const container = buttonElement.parentElement;
            if (expandedAppLists.has(groupKey)) return;
            container.scrollTo({
              left: buttonElement.offsetLeft - container.clientWidth / 2 + buttonElement.offsetWidth / 2,
              behavior: "smooth",
            });
          }
        });
      } else {
        expandedOptions.delete(clickedKey);
      }
    } else {
      isCurrentlyExpanded ? expandedOptions.delete(clickedKey) : expandedOptions.add(clickedKey);
    }
  };

  const handleTouchStart = (event: TouchEvent) => {
    if (event.touches?.length > 0) {
      touchStartX.value = event.touches[0].clientX;
      touchStartY.value = event.touches[0].clientY;
    }
  };

  const handleTouchEnd = (event: TouchEvent, groupKey: string, currentApp: AppElement, appsList: AppElement[]) => {
    if (!event.changedTouches?.length) return;
    const deltaX = event.changedTouches[0].clientX - touchStartX.value;
    const deltaY = event.changedTouches[0].clientY - touchStartY.value;

    if (Math.abs(deltaX) > 60 && Math.abs(deltaY) < 40) {
      const currentIndex = appsList.findIndex((app) => app.id === currentApp.id);
      if (currentIndex !== -1) {
        if (deltaX < 0 && currentIndex < appsList.length - 1) {
          selectApp(groupKey, appsList[currentIndex + 1], appsList);
        } else if (deltaX > 0 && currentIndex > 0) {
          selectApp(groupKey, appsList[currentIndex - 1], appsList);
        }
      }
    }
  };

  const clearState = () => {
    expandedOptions.clear();
    expandedAppLists.clear();
    expandedVersions.clear();
  };

  return {
    expandedOptions,
    expandedAppLists,
    overflowingAppLists,
    expandedVersions,
    toggleOptions,
    toggleVersions,
    setupOverflowObserver,
    toggleAppList,
    selectApp,
    handleTouchStart,
    handleTouchEnd,
    clearState,
    collapseBundle,
  };
}

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

function safeUpdateHistory(url: string, push: boolean = false) {
  try {
    push ? history.pushState(null, "", url) : history.replaceState(null, "", url);
  } catch (error) {}
}

const app = createApp({
  setup() {
    const sortBundlesHelper = (firstBundle: Bundle | undefined, secondBundle: Bundle | undefined, firstKey: string, secondKey: string, order: string) => {
      if (order === "apps") {
        const appsA = firstBundle?.appCount || 0;
        const appsB = secondBundle?.appCount || 0;
        if (appsA !== appsB) return appsB - appsA;
      }
      if (order === "latest") {
        const dateA = firstBundle?.createdTimestamp || 0;
        const dateB = secondBundle?.createdTimestamp || 0;
        if (dateA !== dateB) return dateB - dateA;
      }
      if (order === "stars") {
        const starsA = firstBundle?.stars || 0;
        const starsB = secondBundle?.stars || 0;
        if (starsA !== starsB) return starsB - starsA;
      }
      return firstKey.localeCompare(secondKey);
    };

    const query = ref<string>("");
    const bundle = ref<string>("");
    const app = ref<string>("");
    const showOptions = ref<string[]>([]);
    const sortOrder = ref<string>("stars");
    const isTwoColumns = ref<boolean>(new URLSearchParams(location.search).get("view") !== "list");

    const popupBundleKey = ref<string | null>(null);
    const popupSearchQuery = ref<string>("");

    const activeData = ref<ActiveData | null>(null);
    const isLoading = ref<boolean>(true);
    const errorMsg = ref("");

    const localQuery = ref(query.value);
    const localBundleSearch = ref("");
    const localAppSearch = ref("");
    const localPopupSearchQuery = ref(popupSearchQuery.value);

    watch(query, (val) => {
      if (val !== localQuery.value) localQuery.value = val;
    });
    watch(popupSearchQuery, (val) => {
      if (val !== localPopupSearchQuery.value) localPopupSearchQuery.value = val;
    });

    const updateQuery = debounce((val: string) => {
      query.value = val;
    }, 200);
    const updatePopupSearchQuery = debounce((val: string) => {
      popupSearchQuery.value = val;
    }, 200);

    watch(localQuery, (val) => updateQuery(val));
    watch(localPopupSearchQuery, (val) => updatePopupSearchQuery(val));

    const isWhatsNewView = ref<boolean>(false);
    const whatsNewHighlights = ref<string[]>([]);
    const rawShowParam = ref<string>("");

    const buildUrlString = (targetHash?: string) => {
      const urlParts: string[] = [];
      if (query.value) urlParts.push(`q=${encodeURIComponent(query.value)}`);
      if (bundle.value) urlParts.push(`bundle=${encodeURIComponent(bundle.value)}`);
      if (app.value) urlParts.push(`app=${encodeURIComponent(app.value)}`);

      if (showOptions.value.length > 0) {
        const showStr = isWhatsNewView.value && rawShowParam.value ? rawShowParam.value : showOptions.value.join(",");
        const firstColon = showStr.indexOf(":");
        if (firstColon > 0) {
          const source = showStr.substring(0, firstColon);
          const rest = showStr.substring(firstColon + 1);
          urlParts.push(`${source}=${encodeURIComponent(rest).replace(/%3A/g, ":").replace(/%2C/g, ",").replace(/%28/g, "(").replace(/%29/g, ")").replace(/%2F/g, "/")}`);
        }
      }
      if (popupSearchQuery.value) urlParts.push(`pq=${encodeURIComponent(popupSearchQuery.value)}`);
      if (sortOrder.value !== "stars") urlParts.push(`sort=${sortOrder.value}`);
      if (!isTwoColumns.value) urlParts.push("view=list");

      const queryString = urlParts.join("&");
      return `${location.pathname}${queryString ? "?" + queryString : ""}${targetHash || ""}`;
    };

    let isSyncing = false;
    function syncFromUrl(searchStr: string) {
      isSyncing = true;
      const params = new URLSearchParams(searchStr);

      let hadNewParam = false;
      if (params.has("new")) {
        params.delete("new");
        hadNewParam = true;
        isWhatsNewView.value = true;
      } else {
        isWhatsNewView.value = location.hash === "#whats-new";
      }

      let urlChanged = false;
      const validParams = ["q", "sort", "view", "pq", "bundle", "app", "github", "gitlab"];
      for (const key of Array.from(params.keys())) {
        if (!validParams.includes(key)) {
          params.delete(key);
          urlChanged = true;
        }
      }

      const validSortOrders = ["stars", "latest", "apps"];
      if (params.has("sort") && !validSortOrders.includes(params.get("sort") || "")) {
        params.delete("sort");
        urlChanged = true;
      }
      if (params.has("view") && params.get("view") !== "list") {
        params.delete("view");
        urlChanged = true;
      }

      if (urlChanged) {
        const newSearch = params.toString();
        const targetHash = isWhatsNewView.value ? "#whats-new" : location.hash === "#whats-new" ? "" : location.hash;
        safeUpdateHistory(`${location.pathname}${newSearch ? "?" + newSearch : ""}${targetHash || ""}`);
      }

      query.value = params.get("q") || "";
      sortOrder.value = params.get("sort") || "stars";
      isTwoColumns.value = params.get("view") !== "list";
      popupSearchQuery.value = params.get("pq") || "";
      bundle.value = params.get("bundle") || "";
      app.value = params.get("app") || "";

      let rawParam = params.get("github");
      let source = "github";
      if (!rawParam) {
        rawParam = params.get("gitlab");
        source = "gitlab";
      }

      let showArr: string[] = [];
      let foundValidPopup = false;

      if (rawParam) {
        rawShowParam.value = decodeURIComponent(`${source}:${rawParam}`);
        showArr = parseShowTrie(rawShowParam.value);
        const bundlesInShow = new Set(
          showArr
            .map((item) => {
              const parts = item.split(":");
              return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : null;
            })
            .filter(Boolean) as string[],
        );

        if (bundlesInShow.size === 1) {
          foundValidPopup = true;
          showOptions.value = showArr;
          const targetBundle = Array.from(bundlesInShow)[0];
          if (popupBundleKey.value !== targetBundle) {
            popupBundleKey.value = targetBundle;
            document.body.style.overflow = "hidden";
          }
        } else {
          params.delete("github");
          params.delete("gitlab");
          safeUpdateHistory(`${location.pathname}?${params.toString().replace(/=&/g, "&").replace(/=$/, "")}#whats-new`);
          nextTick(() => {
            isSyncing = false;
            syncFromUrl(location.search);
          });
          return;
        }
      }

      if (!foundValidPopup) {
        showOptions.value = [];
        if (popupBundleKey.value) {
          popupBundleKey.value = null;
          document.body.style.overflow = "";
        }
      }

      whatsNewHighlights.value = isWhatsNewView.value && showOptions.value.length > 0 ? showOptions.value : [];

      nextTick(() => {
        if (hadNewParam) safeUpdateHistory(buildUrlString("#whats-new"));
        isSyncing = false;
      });
    }

    onMounted(async () => {
      syncFromUrl(location.search);
      if (isWhatsNewView.value && popupBundleKey.value) {
        await loadData();
        if (whatsNewHistory.value.length === 0) loadWhatsNewData();
      } else if (isWhatsNewView.value) {
        if (whatsNewHistory.value.length === 0) await loadWhatsNewData();
        if (!activeData.value) loadData();
      } else {
        await loadData();
        if (whatsNewHistory.value.length === 0) loadWhatsNewData();
      }
      window.addEventListener("popstate", () => syncFromUrl(location.search));
      window.addEventListener("hashchange", () => syncFromUrl(location.search));
      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && popupBundleKey.value) closePopup();
      });
    });

    watch(popupSearchQuery, () => {
      if (!isSyncing) safeUpdateHistory(buildUrlString(location.hash));
    });

    watch([query, bundle, app, sortOrder, isTwoColumns, showOptions], (newValues, oldValues) => {
      if (!isSyncing && oldValues?.some((value) => value !== undefined)) isWhatsNewView.value = false;
      if (isSyncing) return;

      const targetHash = isWhatsNewView.value ? "#whats-new" : location.hash === "#whats-new" ? "" : location.hash;
      const newUrl = buildUrlString(targetHash);

      if (location.pathname + location.search + location.hash !== newUrl) {
        if (!oldValues) {
          safeUpdateHistory(newUrl);
        } else {
          const otherChanged = oldValues[1] !== newValues[1] || oldValues[2] !== newValues[2] || oldValues[3] !== newValues[3] || JSON.stringify(oldValues[5]) !== JSON.stringify(newValues[5]);
          safeUpdateHistory(newUrl, otherChanged);
        }
      }
    });

    const loadData = async () => {
      isLoading.value = true;
      errorMsg.value = "";
      try {
        activeData.value = await loadInitialData();
        isLoading.value = false;
      } catch (error) {
        if (error instanceof Error) errorMsg.value = error.message;
        else errorMsg.value = String(error);
        isLoading.value = false;
      }
    };

    const whatsNewHistory = ref<unknown[]>([]);
    const whatsNewAppsData = ref<Record<string, AppNameMeta>>({});
    const isWhatsNewLoading = ref<boolean>(false);

    const loadWhatsNewData = async () => {
      isWhatsNewLoading.value = true;
      try {
        const [data, appsMeta] = await Promise.all([fetchJson<unknown[]>("whats-new.json", []), loadAppsJson()]);
        whatsNewAppsData.value = { ...appsMeta };
        whatsNewHistory.value = Array.isArray(data) ? data : [];
      } catch (err) {
        console.error("Failed to load what's new data", err);
      } finally {
        isWhatsNewLoading.value = false;
      }
    };

    const navigateToWhatsNewShow = (trieStr: string) => {
      const firstColon = trieStr.indexOf(":");
      if (firstColon <= 0) return;

      const source = trieStr.substring(0, firstColon);
      const rest = trieStr.substring(firstColon + 1);

      const encodedShow = encodeURIComponent(rest).replace(/%3A/g, ":").replace(/%2C/g, ",").replace(/%28/g, "(").replace(/%29/g, ")").replace(/%2F/g, "/");
      const params = new URLSearchParams(location.search);
      const urlParts: string[] = [];
      if (params.get("sort") && params.get("sort") !== "stars") urlParts.push(`sort=${params.get("sort")}`);
      if (params.get("view") === "list") urlParts.push("view=list");
      urlParts.push(`${source}=${encodedShow}`);

      const newUrl = `${location.pathname}?${urlParts.join("&")}#whats-new`;
      try {
        history.pushState(null, "", newUrl);
      } catch (error) {}
      syncFromUrl(`?${urlParts.join("&")}`);
    };

    interface WhatsNewApp {
      isNew?: boolean;
      patches?: string[];
    }
    interface WhatsNewBundle {
      source?: string;
      repo?: string;
      isNew?: boolean;
      apps?: Record<string, WhatsNewApp>;
    }

    const getFullBundleKey = (bundleKey: string, bundleData: WhatsNewBundle): string => {
      if (bundleData?.source && bundleData?.repo) {
        return `${bundleData.source}:${bundleData.repo}`;
      }
      return bundleKey;
    };

    const openBundlePopup = (bundleKey: string, bundleData: WhatsNewBundle) => {
      const fullKey = getFullBundleKey(bundleKey, bundleData);
      if (!bundleData || bundleData.isNew) return navigateToWhatsNewShow(fullKey);
      const bundleChanges: Record<string, string[]> = {};
      for (const [packageName, data] of Object.entries<WhatsNewApp>(bundleData.apps || {})) {
        bundleChanges[packageName] = data.isNew ? [] : [...(data.patches || [])].sort();
      }
      navigateToWhatsNewShow(stringifyTrie({ [fullKey]: bundleChanges }));
    };

    const openAppPopup = (bundleKey: string, bundleData: WhatsNewBundle, packageName: string, appData: WhatsNewApp) => {
      const fullKey = getFullBundleKey(bundleKey, bundleData);
      navigateToWhatsNewShow(
        !appData || appData.isNew
          ? `${fullKey}:${packageName}`
          : stringifyTrie({
              [fullKey]: {
                [packageName]: [...(appData.patches || [])].sort(),
              },
            }),
      );
    };

    const openPatchPopup = (bundleKey: string, bundleData: WhatsNewBundle, packageName: string, patchName: string) => {
      const fullKey = getFullBundleKey(bundleKey, bundleData);
      navigateToWhatsNewShow(stringifyTrie({ [fullKey]: { [packageName]: [patchName] } }));
    };

    watch(isWhatsNewView, (newVal) => {
      if (newVal) {
        if (whatsNewHistory.value.length === 0) loadWhatsNewData();
      } else {
        if (!activeData.value) loadData();
      }
    });

    const filteredRows = computed(() => {
      if (!activeData.value) return [];
      const targetPrefix = `${bundle.value || ""}${app.value ? ":" + app.value : ""}`;
      const currentShowOptions = targetPrefix ? [targetPrefix] : [];
      return filterRows(activeData.value, {
        query: query.value,
        showOptions: currentShowOptions,
      });
    });

    const filterOptions = computed(() => {
      if (!activeData.value) return { bundleOptions: [], appOptions: [] };

      const enrichAndSortBundleOptions = (options: { value: string; label: string }[]) => {
        return options
          .map((option) => {
            const bundleObject = activeData.value?.bundleMap[option.value.toLowerCase()];
            return {
              ...option,
              label: bundleObject?.name || option.label,
              repo: bundleObject?.repo?.toLowerCase() || "",
              icon: bundleObject?.avatarUrl || "",
            };
          })
          .sort((firstItem, secondItem) =>
            sortBundlesHelper(
              activeData.value?.bundleMap[firstItem.value.toLowerCase()],
              activeData.value?.bundleMap[secondItem.value.toLowerCase()],
              firstItem.value,
              secondItem.value,
              sortOrder.value,
            ),
          );
      };

      const noFilters = !query.value && !app.value && !bundle.value;
      if (noFilters && activeData.value.bundles?.length > 0) {
        const options = getFilterOptions(activeData.value.rows, activeData.value.namesMap);
        return {
          bundleOptions: enrichAndSortBundleOptions(options.bundleOptions),
          appOptions: options.appOptions,
        };
      }

      const rowsForSource = filterRows(activeData.value, {
        query: query.value,
        showOptions: app.value ? [`:${app.value}`] : [],
      });
      const bundleOptions = enrichAndSortBundleOptions(getFilterOptions(rowsForSource, activeData.value.namesMap).bundleOptions);

      const rowsForApp = filterRows(activeData.value, {
        query: query.value,
        showOptions: bundle.value ? [bundle.value] : [],
      });
      return {
        bundleOptions,
        appOptions: getFilterOptions(rowsForApp, activeData.value.namesMap).appOptions,
      };
    });

    const filterDropdownOptions = (options: { value: string; label: string }[], searchValue: string, extraFields: string[], allOptionLabel: string) => {
      const queryWords = searchValue.toLowerCase().split(/\s+/).filter(Boolean);
      let filtered = options;
      if (queryWords.length > 0) {
        filtered = options.filter((option) => {
          const targets = [option.label, option.value];
          extraFields.forEach((field) => targets.push((option as any)[field] || ""));
          const targetStr = targets.join(" ").toLowerCase();
          return queryWords.every((word) => targetStr.includes(word));
        });
      }
      return [{ value: "", label: allOptionLabel }, ...filtered];
    };

    const buildGroupFromRows = (bundleItem: Bundle, rows: RowItem[]) => {
      const patchIdMap = new Map<string, PatchGroupItem>();
      for (const row of rows) {
        if (!patchIdMap.has(row.patchId)) {
          patchIdMap.set(row.patchId, {
            id: row.patchId,
            patchName: row.patchName,
            description: row.description,
            enabled: row.enabled,
            options: row.options || [],
            apps: [],
            isPatchPreRelease: row.isPatchPreRelease,
          });
        }
        if (row.packageName || row.appName) {
          patchIdMap.get(row.patchId)!.apps.push({
            id: row.id,
            appName: row.appName,
            appIcon: row.appIcon,
            packageName: row.packageName,
            versions: row.versions,
            isAppPreRelease: row.isAppPreRelease,
          });
        }
      }
      const patches = Array.from(patchIdMap.values()).sort((firstItem: PatchGroupItem, secondItem: PatchGroupItem) => firstItem.patchName.localeCompare(secondItem.patchName));
      const appsMap = new Map<string, AppElement>();

      for (const patch of patches) for (const appItem of patch.apps) appsMap.set(appItem.packageName || "universal", appItem);

      const appsList = Array.from(appsMap.values()).sort((firstItem: AppElement, secondItem: AppElement) => {
        if ((firstItem.packageName === "universal") !== (secondItem.packageName === "universal"))
          return (firstItem.packageName === "universal" ? 1 : 0) - (secondItem.packageName === "universal" ? 1 : 0);
        return firstItem.appName.localeCompare(secondItem.appName);
      });

      return {
        key: bundleItem.key,
        bundle: bundleItem,
        rows,
        patches,
        appsList,
      };
    };

    const bundlesGroups = computed(() => {
      if (!activeData.value) return [];

      return activeData.value.bundles
        .map((bundleItem) =>
          buildGroupFromRows(
            bundleItem,
            filteredRows.value.filter((row) => row.bundleKey === bundleItem.key),
          ),
        )
        .filter((group) => group.rows.length > 0)
        .sort((firstItem: GroupItem, secondItem: GroupItem) => sortBundlesHelper(firstItem.bundle, secondItem.bundle, firstItem.key, secondItem.key, sortOrder.value));
    });

    const mainUI = useListUI("");
    const popupUI = useListUI("popup_");

    const expandAll = () => {
      bundlesGroups.value.forEach((group: GroupItem) => {
        if (!group.appsList?.length) return;
        const isBundleOpen = group.appsList.some((app: AppElement) => mainUI.expandedOptions.has(`app_${group.key}_${app.id}`)) || mainUI.expandedAppLists.has(group.key);
        if (!isBundleOpen) {
          mainUI.expandedAppLists.add(group.key);
          mainUI.expandedOptions.add(`app_${group.key}_${group.appsList[0].id}`);
        }
      });
    };
    const collapseAll = () => bundlesGroups.value.forEach((group: GroupItem) => mainUI.collapseBundle(group));

    watch(bundlesGroups, (newGroups) => {
      if (newGroups && !popupBundleKey.value) {
        const uniqueApps = new Set();
        newGroups.forEach((group: GroupItem) => {
          group.appsList?.forEach((appItem: AppElement) => {
            uniqueApps.add(appItem.packageName || appItem.appName);
          });
        });
        if (newGroups.length === 1 || uniqueApps.size === 1) {
          expandAll();
        }
      }
    });

    const openPopupFast = (groupKey: string) => {
      const firstColon = groupKey.indexOf(":");
      if (firstColon <= 0) return;

      const source = groupKey.substring(0, firstColon);
      const rest = groupKey.substring(firstColon + 1);
      const encodedRest = encodeURIComponent(rest).replace(/%3A/g, ":").replace(/%2C/g, ",").replace(/%28/g, "(").replace(/%29/g, ")").replace(/%2F/g, "/");
      const newUrl = `?${source}=${encodedRest}${location.hash === "#whats-new" ? "#whats-new" : ""}`;
      safeUpdateHistory(newUrl, true);
      syncFromUrl(newUrl.split("#")[0]);
    };

    const closePopup = () => {
      document.body.style.overflow = "";
      popupBundleKey.value = null;
      popupSearchQuery.value = "";
      const urlParams = new URLSearchParams(location.search);
      urlParams.delete("show");
      urlParams.delete("github");
      urlParams.delete("gitlab");
      urlParams.delete("pq");
      const newUrl = `${location.pathname}${urlParams.toString() ? "?" + urlParams.toString() : ""}${isWhatsNewView.value ? "#whats-new" : location.hash}`;
      safeUpdateHistory(newUrl, !isWhatsNewView.value);
      if (isWhatsNewView.value && location.hash !== "#whats-new") location.hash = "whats-new";
      syncFromUrl(urlParams.toString() ? "?" + urlParams.toString() : "");
    };

    const autoExpandPopupApp = () => {
      if (popupBundleKey.value) {
        const group = popupGroup.value;
        if (group && group.key === popupBundleKey.value && group.appsList?.length > 0) {
          if (isWhatsNewView.value) {
            group.appsList.forEach((appElement) => {
              popupUI.expandedOptions.add(`popup_app_${group.key}_${appElement.id}`);
            });
          } else {
            const targetApp = app.value ? group.appsList.find((firstItem) => firstItem.packageName === app.value) : null;
            if (targetApp && !group.appsList.some((appElement) => popupUI.expandedOptions.has(`popup_app_${group.key}_${appElement.id}`))) {
              popupUI.expandedOptions.add(`popup_app_${group.key}_${targetApp.id}`);
            }
          }
        }
      }
    };

    watch(popupBundleKey, (newKey) => {
      if (newKey) {
        if (!activeData.value) loadData();
        autoExpandPopupApp();
      } else {
        popupUI.clearState();
      }
    });

    const popupGroup = computed(() => {
      if (!activeData.value || !popupBundleKey.value) return null;
      const targetKey = popupBundleKey.value.toLowerCase();
      const bundleItem = activeData.value.bundles.find((bundleElement: Bundle) => bundleElement.key.toLowerCase() === targetKey);
      if (!bundleItem) return null;
      const rows = filterRows(activeData.value, {
        query: popupSearchQuery.value,
        showOptions: showOptions.value,
      }).filter((row) => row.bundleKey.toLowerCase() === targetKey);
      return buildGroupFromRows(bundleItem, rows);
    });

    watch(popupGroup, (newGroup) => {
      if (!newGroup) {
        if (popupBundleKey.value && activeData.value?.bundles?.length) closePopup();
        return;
      }

      if (isWhatsNewView.value) {
        newGroup.appsList?.forEach((appElement: AppElement) => {
          popupUI.expandedOptions.add(`popup_app_${newGroup.key}_${appElement.id}`);
        });
        return;
      }

      const hasExpanded = newGroup.appsList?.some((appElement: AppElement) => popupUI.expandedOptions.has(`popup_app_${newGroup.key}_${appElement.id}`));

      if (!hasExpanded && newGroup.appsList?.length > 0) {
        if (newGroup.appsList.length === 1) {
          popupUI.expandedOptions.add(`popup_app_${newGroup.key}_${newGroup.appsList[0].id}`);
        } else if (app.value) {
          const targetApp = newGroup.appsList.find((firstItem: AppElement) => firstItem.packageName === app.value);
          if (targetApp) popupUI.expandedOptions.add(`popup_app_${newGroup.key}_${targetApp.id}`);
        }
      }
    });

    const filterByApp = (packageName: string) => {
      if (popupBundleKey.value) {
        document.body.style.overflow = "";
        popupBundleKey.value = null;
      }
      resetFilters();
      app.value = packageName;
    };
    const resetFilters = () => {
      collapseAll();
      query.value = bundle.value = app.value = popupSearchQuery.value = "";
      showOptions.value = [];
      isWhatsNewView.value = false;
      mainUI.clearState();
    };

    const onBundleSelected = (value: string, event: Event) => {
      bundle.value = value || "";
      localBundleSearch.value = "";
      const target = event.target as HTMLElement;
      target.closest(".dd-root")?.classList.remove("open");
    };

    const onAppSelected = (value: string, event: Event) => {
      app.value = value || "";
      localAppSearch.value = "";
      const target = event.target as HTMLElement;
      target.closest(".dd-root")?.classList.remove("open");
    };

    const blurSearchInput = (event: Event) => {
      const target = event.target as HTMLElement;
      target.querySelector("input")?.blur();
    };

    const copiedStates = reactive<Record<string, boolean>>({});
    const copyText = (text: string, key: string) =>
      navigator.clipboard
        .writeText(text)
        .then(() => {
          copiedStates[key] = true;
          setTimeout(() => (copiedStates[key] = false), 2000);
        })
        .catch(() => {});

    const isSideMenuOpen = ref<boolean>(false);
    const toggleSideMenu = () => {
      isSideMenuOpen.value = !isSideMenuOpen.value;
      if (isSideMenuOpen.value) {
        document.body.style.overflow = "hidden";
      } else if (!popupBundleKey.value) {
        document.body.style.overflow = "";
      }
    };

    const handleBottomNav = (tab: "bundles" | "whatsnew") => {
      if (tab === "bundles") {
        if (!isWhatsNewView.value) {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          window.scrollTo(0, 0);
          isWhatsNewView.value = false;
          safeUpdateHistory(buildUrlString(""), true);
        }
      } else if (tab === "whatsnew") {
        if (isWhatsNewView.value) {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          window.scrollTo(0, 0);
          isWhatsNewView.value = true;
          safeUpdateHistory(buildUrlString("#whats-new"), true);
        }
      }
    };

    return {
      query,
      bundle,
      app,
      showOptions,
      localQuery,
      localBundleSearch,
      localAppSearch,
      localPopupSearchQuery,

      sortOrder,
      isTwoColumns,
      isLoading,
      errorMsg,
      stats: computed(() => summarizeRows(filteredRows.value)),
      filterOptions,
      bundlesGroups,
      effectiveTwoColumns: computed(() => (bundlesGroups.value.length === 1 ? false : isTwoColumns.value)),
      isWhatsNewView,
      isSideMenuOpen,
      toggleSideMenu,
      handleBottomNav,
      whatsNewHighlights,
      whatsNewHistory,
      isWhatsNewLoading,
      popupBundleKey,
      popupSearchQuery,
      popupGroup,
      filteredAppOptions: computed(() => filterDropdownOptions(filterOptions.value.appOptions, localAppSearch.value, [], "All Apps")),
      filteredBundleOptions: computed(() => filterDropdownOptions(filterOptions.value.bundleOptions, localBundleSearch.value, ["repo"], "All Bundles")),

      mainUI,
      popupUI,
      expandAll,
      collapseAll,
      filterByApp,
      resetFilters,
      closeWhatsNew: () => {
        if (isWhatsNewView.value) {
          isWhatsNewView.value = false;
          safeUpdateHistory(buildUrlString(""), true);
        }
      },
      openPopupFast,
      closePopup,
      onBundleSelected,
      onAppSelected,
      blurSearchInput,
      openBundlePopup,
      openAppPopup,
      openPatchPopup,
      copyText,
      copiedStates,

      formatDate: (value: string | number | Date) => {
        if (!value) return "";
        const parsedDate = new Date(value);
        return isNaN(parsedDate.getTime())
          ? ""
          : parsedDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
      },
      playUrl: (packageName: string) => `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName)}`,
      getWhatsNewAppIcon: (packageName: string) => {
        const whatsNewMeta = whatsNewAppsData.value[packageName];
        if (whatsNewMeta?.iconUrl) return whatsNewMeta.iconUrl;
        const meta = activeData.value?.namesMap?.[packageName];
        return typeof meta === "object" && meta !== null ? (meta as AppNameMeta).iconUrl || "" : "";
      },
      formatWhatsNewAppName: (packageName: string) => appName(packageName, Object.keys(whatsNewAppsData.value).length > 0 ? whatsNewAppsData.value : activeData.value?.namesMap || {}),
      getAppName: (packageName: string) => (packageName ? appName(packageName, activeData.value?.namesMap || {}) : "All Apps"),
      getAppIcon: (packageName: string) => {
        const meta = activeData.value?.namesMap[packageName];
        return typeof meta === "object" && meta !== null ? (meta as AppNameMeta).iconUrl || "" : "";
      },
      getBundleName: (key: string) => (key && activeData.value ? activeData.value.bundleMap[key.toLowerCase()]?.name || key : "All Bundles"),
      getBundleIcon: (key: string) => (key && activeData.value ? activeData.value.bundleMap[key.toLowerCase()]?.avatarUrl || "" : ""),
      toggleColumns: () => (isTwoColumns.value = !isTwoColumns.value),
      isNewBundle: (group: GroupItem) => !isWhatsNewView.value && !!group?.bundle?.firstSeen && (Date.now() - new Date(group.bundle.firstSeen).getTime()) / 86400000 <= 7,
      hasHighlight: (prefix: string) => isWhatsNewView.value && whatsNewHighlights.value.some((h) => h.toLowerCase() === prefix.toLowerCase()),
      isAppHighlighted: (groupKey: string, appItem: AppElement) =>
        isWhatsNewView.value &&
        whatsNewHighlights.value.some((h) => {
          const lowerH = h.toLowerCase();
          return lowerH === `${groupKey}:${appItem.packageName}`.toLowerCase() || lowerH === `${groupKey}:${appItem.appName}`.toLowerCase();
        }),
    };
  },
});

app.component("patch-item", {
  template: "#patch-item-template",
  props: ["patchItem", "appItem", "group", "ui", "copiedStates", "copyText", "hasHighlight"],
});

app.mount("#app");
