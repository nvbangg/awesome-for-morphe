import { useMemo, useDeferredValue, memo } from "react";
import { BundleCard } from "./BundleCard";
import { ActiveData } from "@/types/data";
import { getFilteredBundles } from "@/services";
import { EmptyState } from "@/components/common/EmptyState";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { ITEMS_PER_PAGE } from "@/constants";

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

  const { visibleItems, loadMoreRef, hasMore } = useInfiniteScroll(
    processedBundles,
    ITEMS_PER_PAGE,
  );

  if (processedBundles.length === 0) {
    return <EmptyState message="No bundles match your search" />;
  }

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5 my-6">
        {visibleItems.map((bundleItem) => (
          <BundleCard
            key={bundleItem.key}
            bundleItem={bundleItem}
            onClick={onBundleClick}
          />
        ))}
      </div>
      {hasMore && <div ref={loadMoreRef} className="h-px w-full" />}
    </>
  );
});
