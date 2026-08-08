import { ActiveData } from "@/types/data";
import { BundleGrid } from "./BundleGrid";

interface BundlesTabProps {
  activeData: ActiveData | null;
  sortOrder: string;
  globalSearch: string;
  onBundleClick: (bundleKey: string) => void;
  onTestBundleClick: () => void;
}

export function BundlesTab({
  activeData,
  sortOrder,
  globalSearch,
  onBundleClick,
  onTestBundleClick,
}: BundlesTabProps) {
  return (
    <>
      <div className="text-sm sm:text-base text-foreground-700 dark:text-foreground-400 mb-4 px-1 text-right">
        Bundle not found?{" "}
        <button
          onClick={onTestBundleClick}
          className="font-semibold text-primary hover:underline hover:text-primary/80 transition-colors cursor-pointer"
        >
          Test bundle
        </button>
        {" | "}
        <a
          href="https://github.com/nvbangg/awesome-morphe/issues/new?template=bundle-request.yml"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary hover:underline hover:text-primary/80 transition-colors"
        >
          Submit Bundle
        </a>
      </div>
      <BundleGrid
        activeData={activeData}
        sortOrder={sortOrder}
        globalSearch={globalSearch}
        onBundleClick={onBundleClick}
      />
    </>
  );
}
