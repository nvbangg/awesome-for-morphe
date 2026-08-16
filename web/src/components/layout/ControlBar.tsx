import {
  Grid,
  Layers,
  Sparkles,
  Shapes,
  ArrowDownWideNarrow,
} from "lucide-react";
import { NavigationTabType as TabType } from "@/hooks/useUrlSync";
import { ActiveStats } from "@/types/data";
import { Badge } from "@/components/common/Badge";
import { SearchInput } from "@/components/common/SearchInput";
import { CustomSelect } from "@/components/common/CustomSelect";
import { Tabs, TabListContainer, TabList, Tab } from "@heroui/react";

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

const BUNDLE_SORT_OPTIONS = [
  { key: "default", label: "Hot" },
  { key: "new", label: "New" },
  { key: "updated", label: "Recently updated" },
  { key: "stars", label: "Most stars" },
  { key: "apps", label: "Most apps" },
  { key: "patches", label: "Most patches" },
  { key: "alpha", label: "Alphabetical" },
];

const APP_SORT_OPTIONS = [
  { key: "default", label: "Most downloads" },
  { key: "new", label: "New" },
  { key: "patches", label: "Most patches" },
  { key: "alpha", label: "Alphabetical" },
];

const TAB_ITEM_CLASS =
  "flex-1 sm:flex-initial px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 outline-none text-foreground-muted hover:text-foreground data-[selected=true]:bg-background dark:data-[selected=true]:bg-divider data-[selected=true]:text-foreground data-[selected=true]:shadow-sm";

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
    activeTab === "bundles" ? BUNDLE_SORT_OPTIONS : APP_SORT_OPTIONS;

  return (
    <div
      className="flex flex-col sm:flex-row sm:flex-wrap items-center gap-3 sm:gap-4 mt-2 mb-3 relative"
      id="browse-bar"
    >
      <div
        className="w-full sm:w-auto"
        onKeyDownCapture={(e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === "Home" || e.key === "End") {
            e.stopPropagation();
            (e.target as HTMLElement)?.blur();
          }
        }}
      >
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) =>
            key && onTabChange(String(key) as TabType)
          }
          aria-label="Navigation Tabs"
          className="w-full sm:w-auto p-1 bg-card border border-divider rounded-xl"
        >
          <TabListContainer className="w-full bg-transparent p-0">
            <TabList className="flex items-center justify-between sm:justify-start bg-transparent p-0 border-none outline-none divide-x divide-divider">
              <Tab id="apps" className={TAB_ITEM_CLASS}>
                <Grid className="size-4 shrink-0 text-primary" />
                <span>Apps</span>
              </Tab>

              <Tab id="bundles" className={TAB_ITEM_CLASS}>
                <Layers className="size-4 shrink-0 text-secondary" />
                <span>Bundles</span>
              </Tab>

              <Tab id="whats-new" className={TAB_ITEM_CLASS}>
                <Sparkles className="size-4 shrink-0 text-warning fill-current" />
                <span className="whitespace-nowrap">What's New</span>
              </Tab>
            </TabList>
          </TabListContainer>
        </Tabs>
      </div>

      {activeTab === "whats-new" ? (
        <div className="w-full sm:w-auto sm:absolute sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 flex items-center justify-center gap-2.5 text-sm text-foreground font-semibold py-1 select-text">
          <span className="relative flex size-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
            <span className="relative inline-flex rounded-full size-2 bg-secondary"></span>
          </span>
          <span className="whitespace-nowrap">
            Recently added bundles, apps & patches
          </span>
        </div>
      ) : (
        <>
          <div className="w-full sm:w-52 shrink-0">
            <CustomSelect
              value={sortOrder || "default"}
              onChange={(sortValue) => onSortOrderChange(sortValue)}
              options={sortOptions}
              icon={ArrowDownWideNarrow}
              ariaLabel="Sort order"
              className="w-full"
            />
          </div>

          {categories.length > 0 && (
            <div className="w-full sm:w-56 shrink-0">
              <CustomSelect
                value={selectedCategory || "all"}
                onChange={(categoryValue) => onCategoryChange?.(categoryValue)}
                options={categories}
                icon={Shapes}
                ariaLabel="Category filter"
                className="w-full"
              />
            </div>
          )}

          <div className="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-70">
            <SearchInput
              id="search-input"
              value={globalSearchQuery}
              onChange={onSearchQueryChange}
              placeholder={
                activeTab === "apps" ? "Search apps…" : "Search bundles…"
              }
              className="flex-1 min-w-0"
            />
            <div className="shrink-0 sm:ml-auto">
              <Badge variant="count">
                {activeTab === "apps"
                  ? `${statistics.appsCount.toLocaleString()} Apps`
                  : `${statistics.bundlesCount.toLocaleString()} Bundles`}
              </Badge>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
