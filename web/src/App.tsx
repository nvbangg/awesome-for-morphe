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
import { useState, useMemo, useCallback, useEffect } from "react";
import { TestBundleInputModal } from "@/components/bundles/TestBundleInputModal";
import { TestBundleViewModal } from "@/components/bundles/TestBundleViewModal";
import { fetchTestBundle, TestBundleData } from "@/utils/testBundleFetcher";

export default function App() {
  const {
    activeTab,
    selectedCategory,
    sortOrder,
    selectedAppPackageName,
    popupBundleKey,
    popupSearchQuery,
    updateUrl,
  } = useUrlSync();
  const {
    activeData,
    isLoading,
    errorMessage,
    whatsNewHistory,
    globalSearch,
    setGlobalSearch,
    stats,
  } = usePatchData();

  const categories = useMemo(() => {
    if (!activeData) return [];
    return getAvailableCategories(activeData.rows, activeData.namesMap);
  }, [activeData]);

  const handleTabChange = useCallback(
    (tab: NavigationTabType) => {
      setGlobalSearch("");
      updateUrl({ tab });
    },
    [setGlobalSearch, updateUrl],
  );

  const handleSortOrderChange = useCallback(
    (sort: string) => updateUrl({ sort }),
    [updateUrl],
  );
  const handleCategoryChange = useCallback(
    (category: string) => updateUrl({ category }),
    [updateUrl],
  );
  const handleAppClick = useCallback(
    (packageName: string) => updateUrl({ app: packageName }),
    [updateUrl],
  );
  const handleBundleClick = useCallback(
    (bundleKey: string) => updateUrl({ bundle: bundleKey }),
    [updateUrl],
  );
  const handlePatchClick = useCallback(
    (packageName: string, patchName: string) =>
      updateUrl({ app: packageName, search: patchName }),
    [updateUrl],
  );
  const handleCloseAppModal = useCallback(
    () => updateUrl({ app: null, search: "" }),
    [updateUrl],
  );
  const handleCloseBundleModal = useCallback(
    () => updateUrl({ bundle: null, search: "" }),
    [updateUrl],
  );
  const handleSearchChange = useCallback(
    (search: string) => updateUrl({ search }),
    [updateUrl],
  );

  const [isTestBundleInputOpen, setIsTestBundleInputOpen] = useState(false);
  const [isTestBundleViewOpen, setIsTestBundleViewOpen] = useState(false);
  const [testBundleData, setTestBundleData] = useState<TestBundleData | null>(
    null,
  );
  const [testBundleLoading, setTestBundleLoading] = useState(false);
  const [testBundleError, setTestBundleError] = useState("");

  const loadTestBundleFromUrl = useCallback(
    async (link: string) => {
      if (!activeData) return;
      setTestBundleLoading(true);
      setTestBundleError("");
      try {
        const data = await fetchTestBundle(link);
        setTestBundleData(data);
        setIsTestBundleInputOpen(false);
        setIsTestBundleViewOpen(true);
      } catch (error: unknown) {
        setTestBundleError(
          error instanceof Error
            ? error.message
            : "Failed to load bundle data. Please check the URL and try again.",
        );
        setIsTestBundleInputOpen(true);
      } finally {
        setTestBundleLoading(false);
      }
    },
    [activeData],
  );

  const handleTestBundleSubmit = async (link: string) => {
    if (!activeData) return;
    setTestBundleLoading(true);
    setTestBundleError("");
    try {
      const data = await fetchTestBundle(link);
      setTestBundleData(data);
      setIsTestBundleInputOpen(false);
      setIsTestBundleViewOpen(true);

      const repoInfo = data.repoName;
      const platformParam = data.platform === "gitlab" ? "gitlab" : "github";
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}?${platformParam}=${repoInfo}&test-bundle#bundles`,
      );
    } catch (error: unknown) {
      setTestBundleError(
        error instanceof Error
          ? error.message
          : "Failed to load bundle data. Please check the URL and try again.",
      );
    } finally {
      setTestBundleLoading(false);
    }
  };

  useEffect(() => {
    if (!activeData) return;
    const handleUrlState = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const isTestBundle =
        searchParams.has("test-bundle") ||
        window.location.hash.includes("test-bundle");

      if (isTestBundle) {
        const githubRepo = searchParams.get("github");
        const gitlabRepo = searchParams.get("gitlab");

        if (githubRepo) {
          loadTestBundleFromUrl(`https://github.com/${githubRepo}`);
        } else if (gitlabRepo) {
          loadTestBundleFromUrl(`https://gitlab.com/${gitlabRepo}`);
        } else {
          setIsTestBundleInputOpen(true);
        }
      }
    };
    handleUrlState();
    window.addEventListener("popstate", handleUrlState);
    window.addEventListener("hashchange", handleUrlState);
    return () => {
      window.removeEventListener("popstate", handleUrlState);
      window.removeEventListener("hashchange", handleUrlState);
    };
  }, [activeData, loadTestBundleFromUrl]);

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
                  {activeTab === "apps" && (
                    <AppGrid
                      activeData={activeData}
                      sortOrder={sortOrder}
                      selectedCategory={selectedCategory}
                      globalSearch={globalSearch}
                      onAppClick={handleAppClick}
                    />
                  )}

                  {activeTab === "bundles" && (
                    <>
                      <div className="text-sm sm:text-base text-foreground-700 dark:text-foreground-400 mb-4 px-1 text-right">
                        Bundle not found?{" "}
                        <button
                          onClick={() => {
                            setTestBundleError("");
                            setIsTestBundleInputOpen(true);
                            window.history.replaceState(
                              null,
                              "",
                              `${window.location.pathname}?test-bundle#bundles`,
                            );
                          }}
                          className="font-semibold text-primary hover:underline hover:text-primary/80 transition-colors"
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
                        onBundleClick={handleBundleClick}
                      />
                    </>
                  )}

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

      <TestBundleInputModal
        isOpen={isTestBundleInputOpen}
        onClose={() => {
          setTestBundleError("");
          setIsTestBundleInputOpen(false);
          if (window.location.search.includes("test-bundle")) {
            window.history.replaceState(
              null,
              "",
              `${window.location.pathname}#bundles`,
            );
          }
        }}
        onSubmit={handleTestBundleSubmit}
        isLoading={testBundleLoading}
        error={testBundleError}
      />

      <TestBundleViewModal
        isOpen={isTestBundleViewOpen}
        onClose={() => {
          setIsTestBundleViewOpen(false);
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}#bundles`,
          );
        }}
        data={testBundleData}
        activeData={activeData}
      />

      <AppModal
        isOpen={!!selectedAppPackageName}
        onClose={handleCloseAppModal}
        packageName={selectedAppPackageName}
        activeData={activeData}
        searchQuery={popupSearchQuery}
        onSearchChange={handleSearchChange}
      />

      <BundleModal
        isOpen={!!popupBundleKey}
        onClose={handleCloseBundleModal}
        bundleKey={popupBundleKey}
        activeData={activeData}
        searchQuery={popupSearchQuery}
        onSearchChange={handleSearchChange}
      />
    </div>
  );
}
