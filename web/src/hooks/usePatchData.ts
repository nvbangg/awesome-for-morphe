import { useState, useEffect, useMemo, useCallback } from "react";
import { loadInitialData, ActiveData } from "@/data";

export function usePatchData() {
  const [activeData, setActiveData] = useState<ActiveData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [globalSearch, setGlobalSearch] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const loadedData = await loadInitialData();
      setActiveData(loadedData);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load data",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.resolve().then(() => {
      if (mounted) fetchData();
    });
    return () => {
      mounted = false;
    };
  }, [fetchData]);
  const stats = useMemo(
    () =>
      activeData?.stats || { bundlesCount: 0, patchesCount: 0, appsCount: 0 },
    [activeData],
  );

  return {
    activeData,
    isLoading,
    errorMessage,
    whatsNewHistory: activeData?.whatsNewHistory || [],
    globalSearch,
    setGlobalSearch,
    stats,
  };
}
