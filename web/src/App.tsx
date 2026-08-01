import { Header } from "@/components/layout/Header";
import { ControlBar } from "@/components/layout/ControlBar";
import { AppGrid } from "@/components/apps/AppGrid";
import { AppModal } from "@/components/apps/AppModal";
import { BundleGrid } from "@/components/bundles/BundleGrid";
import { BundleModal } from "@/components/bundles/BundleModal";
import { WhatsNewList } from "@/components/whatsnew/WhatsNewList";
import { WhatsNewHeader } from "@/components/whatsnew/WhatsNewHeader";
import { Footer } from "@/components/layout/Footer";
import { SkeletonGrid } from "@/components/common/SkeletonGrid";

import { useUrlSync, NavigationTabType } from "@/hooks/useUrlSync";
import { usePatchData } from "@/hooks/usePatchData";
import { getAvailableCategories } from "@/data";
import { Alert, AlertTitle, AlertDescription } from "@heroui/react";
import { useMemo, useCallback } from "react";

export default function App() {
  const { activeTab, selectedCategory, sortOrder, selectedAppPackageName, popupBundleKey, popupSearchQuery, updateUrl } = useUrlSync();
  const { activeData, isLoading, errorMessage, whatsNewHistory, globalSearch, setGlobalSearch, stats } = usePatchData();

  const categories = useMemo(() => {
    if (!activeData) return [];
    return getAvailableCategories(activeData.rows, activeData.namesMap);
  }, [activeData]);

  const handleTabChange = useCallback(
    (tab: NavigationTabType) => {
      setGlobalSearch("");
      updateUrl({ tab, category: "all" });
    },
    [setGlobalSearch, updateUrl],
  );

  const handleSortOrderChange = useCallback((sort: string) => updateUrl({ sort }), [updateUrl]);
  const handleCategoryChange = useCallback((category: string) => updateUrl({ category }), [updateUrl]);
  const handleAppClick = useCallback((packageName: string) => updateUrl({ app: packageName }), [updateUrl]);
  const handleBundleClick = useCallback((bundleKey: string) => updateUrl({ bundle: bundleKey }), [updateUrl]);
  const handlePatchClick = useCallback((packageName: string, patchName: string) => updateUrl({ app: packageName, search: patchName }), [updateUrl]);
  const handleCloseAppModal = useCallback(() => updateUrl({ app: null, search: "" }), [updateUrl]);
  const handleCloseBundleModal = useCallback(() => updateUrl({ bundle: null, search: "" }), [updateUrl]);
  const handleSearchChange = useCallback((search: string) => updateUrl({ search }), [updateUrl]);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Header />

      <section className="pt-1 pb-4" id="bundles">
        <div id="apps" />
        <div className="container mx-auto px-6 max-w-300">
          {errorMessage ? (
            <Alert status="danger" className="my-8">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : (
            <>
              <ControlBar
                activeTab={activeTab}
                onTabChange={handleTabChange}
                globalSearchQuery={globalSearch}
                onSearchQueryChange={setGlobalSearch}
                sortOrder={sortOrder}
                onSortOrderChange={handleSortOrderChange}
                selectedCategory={selectedCategory}
                onCategoryChange={handleCategoryChange}
                categories={categories}
                statistics={stats}
              />

              {isLoading ? (
                <SkeletonGrid />
              ) : (
                <>
                  {activeTab === "apps" && <AppGrid activeData={activeData} sortOrder={sortOrder} selectedCategory={selectedCategory} globalSearch={globalSearch} onAppClick={handleAppClick} />}

                  {activeTab === "bundles" && <BundleGrid activeData={activeData} sortOrder={sortOrder} globalSearch={globalSearch} onBundleClick={handleBundleClick} />}

                  {activeTab === "whats-new" && (
                    <div className="my-3">
                      <WhatsNewHeader />
                      <WhatsNewList
                        history={whatsNewHistory}
                        isLoading={isLoading}
                        activeData={activeData}
                        onBundleClick={handleBundleClick}
                        onAppClick={handleAppClick}
                        onPatchClick={handlePatchClick}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </section>

      <Footer />

      <AppModal
        isOpen={!!selectedAppPackageName}
        onClose={handleCloseAppModal}
        packageName={selectedAppPackageName}
        activeData={activeData}
        searchQuery={popupSearchQuery}
        onSearchChange={handleSearchChange}
      />

      <BundleModal isOpen={!!popupBundleKey} onClose={handleCloseBundleModal} bundleKey={popupBundleKey} activeData={activeData} searchQuery={popupSearchQuery} onSearchChange={handleSearchChange} />
    </div>
  );
}
