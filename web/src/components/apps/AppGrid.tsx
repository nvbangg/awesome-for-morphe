import { useMemo, useDeferredValue, memo } from "react";
import { AppCard } from "./AppCard";
import { ActiveData, getAppItems } from "@/data";
import { EmptyState } from "@/components/common/EmptyState";

interface AppGridProps {
  activeData: ActiveData | null;
  sortOrder: string;
  selectedCategory?: string;
  globalSearch: string;
  onAppClick: (packageName: string) => void;
}

export const AppGrid = memo(function AppGrid({
  activeData,
  sortOrder,
  selectedCategory = "all",
  globalSearch,
  onAppClick,
}: AppGridProps) {
  const deferredSearch = useDeferredValue(globalSearch);

  const appList = useMemo(() => {
    if (!activeData) return [];
    return getAppItems(
      activeData.appItems,
      deferredSearch,
      sortOrder,
      selectedCategory,
    );
  }, [activeData, sortOrder, selectedCategory, deferredSearch]);

  if (appList.length === 0) {
    return <EmptyState message="No apps match your search" />;
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5 my-6">
      {appList.map((appItem) => (
        <AppCard
          key={appItem.packageName}
          appItem={appItem}
          onClick={onAppClick}
        />
      ))}
    </div>
  );
});
