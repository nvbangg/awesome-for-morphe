import { Grid, Layers, Sparkles, Filter, ArrowUpDown } from "lucide-react";
import { NavigationTabType as TabType } from "@/hooks/useUrlSync";
import { ActiveStats } from "@/data";
import { SearchInput } from "@/components/common/SearchInput";
import { CustomSelect } from "@/components/common/CustomSelect";
import { Tabs, TabListContainer, TabList, Tab, Chip } from "@heroui/react";

interface ControlBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  globalSearchQuery: string;
  onSearchQueryChange: (searchValue: string) => void;
  sortOrder: string;
  onSortOrderChange: (sortValue: string) => void;
  selectedCategory?: string;
  onCategoryChange?: (categoryValue: string) => void;
  categories?: { key: string; label: string }[];
  statistics: ActiveStats;
}

export function ControlBar({
  activeTab,
  onTabChange,
  globalSearchQuery,
  onSearchQueryChange,
  sortOrder,
  onSortOrderChange,
  selectedCategory = "all",
  onCategoryChange,
  categories = [],
  statistics,
}: ControlBarProps) {
  const sortOptions =
    activeTab === "bundles"
      ? [
          { key: "default", label: "Hot" },
          { key: "new", label: "New" },
          { key: "updated", label: "Recently updated" },
          { key: "stars", label: "Most stars" },
          { key: "apps", label: "Most apps" },
          { key: "patches", label: "Most patches" },
          { key: "alphabetical", label: "Alphabetical" },
        ]
      : [
          { key: "default", label: "Most downloads" },
          { key: "new", label: "New" },
          { key: "patches", label: "Most patches" },
          { key: "alphabetical", label: "Alphabetical" },
        ];

  const tabItemClass =
    "flex-1 sm:flex-initial px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-primary text-black dark:text-zinc-300 hover:text-black dark:hover:text-white data-[selected=true]:bg-white dark:data-[selected=true]:bg-zinc-700 data-[selected=true]:text-black dark:data-[selected=true]:text-white data-[selected=true]:shadow-xs";

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap items-center gap-3 sm:gap-4 mt-4 mb-5" id="browse-bar">
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => key && onTabChange(String(key) as TabType)}
        aria-label="Navigation Tabs"
        className="w-full sm:w-auto p-1 bg-zinc-100 dark:bg-zinc-800/80 border border-divider rounded-xl"
      >
        <TabListContainer className="w-full bg-transparent p-0">
          <TabList className="flex items-center justify-between sm:justify-start bg-transparent p-0 border-none outline-none divide-x divide-zinc-300 dark:divide-zinc-700">
            <Tab id="apps" className={tabItemClass}>
              <Grid className="size-4 shrink-0 text-primary" />
              <span>Apps</span>
            </Tab>

            <Tab id="bundles" className={tabItemClass}>
              <Layers className="size-4 shrink-0 text-secondary" />
              <span>Bundles</span>
            </Tab>

            <Tab id="whats-new" className={tabItemClass}>
              <Sparkles className="size-4 shrink-0 text-warning fill-warning/20" />
              <span className="whitespace-nowrap">What's New</span>
            </Tab>
          </TabList>
        </TabListContainer>
      </Tabs>

      {activeTab !== "whats-new" && (
        <>
          {activeTab === "apps" && categories.length > 0 && (
            <div className="w-full sm:w-56 shrink-0">
              <CustomSelect value={selectedCategory || "all"} onChange={(category) => onCategoryChange?.(category)} options={categories} icon={Filter} ariaLabel="Category filter" className="w-full" />
            </div>
          )}

          <div className="w-full sm:w-52 shrink-0">
            <CustomSelect key={`sort-${activeTab}`} value={sortOrder || "default"} onChange={onSortOrderChange} options={sortOptions} icon={ArrowUpDown} ariaLabel="Sort order" className="w-full" />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-0">
            <SearchInput
              id="search-input"
              value={globalSearchQuery}
              onChange={onSearchQueryChange}
              placeholder={activeTab === "apps" ? "Search apps…" : "Search bundles…"}
              className="flex-1 min-w-0"
            />
            <div className="shrink-0 sm:ml-auto">
              <Chip variant="soft" color="accent" className="px-3 py-1 font-medium text-xs whitespace-nowrap">
                {activeTab === "apps" ? `${statistics.appsCount.toLocaleString()} Apps` : `${statistics.bundlesCount.toLocaleString()} Bundles`}
              </Chip>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
