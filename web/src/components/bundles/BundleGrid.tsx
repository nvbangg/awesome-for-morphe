import { useMemo, useDeferredValue, memo } from "react";
import { BundleCard } from "./BundleCard";
import { ActiveData, getFilteredBundles } from "@/data";
import { EmptyState } from "@/components/common/EmptyState";

interface BundleGridProps {
  activeData: ActiveData | null;
  sortOrder: string;
  globalSearch: string;
  onBundleClick: (bundleKey: string) => void;
}

export const BundleGrid = memo(function BundleGrid({
  activeData,
  sortOrder,
  globalSearch,
  onBundleClick,
}: BundleGridProps) {
  const deferredSearch = useDeferredValue(globalSearch);

  const processedBundles = useMemo(() => {
    if (!activeData) return [];
    return getFilteredBundles(activeData.bundles, deferredSearch, sortOrder);
  }, [activeData, sortOrder, deferredSearch]);

  if (processedBundles.length === 0) {
    return <EmptyState message="No bundles match your search" />;
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5 my-6">
      {processedBundles.map((bundleItem) => (
        <BundleCard
          key={bundleItem.key}
          bundleItem={bundleItem}
          onClick={onBundleClick}
        />
      ))}
    </div>
  );
});
