import { useState, useEffect, useMemo, useCallback } from "react";
import { ActiveData, WhatsNewHistoryItem } from "@/types/data";
import { loadInitialData, fetchWhatsNewHistory } from "@/services";

export function usePatchData(activeTab?: string) {
  const [activeData, setActiveData] = useState<ActiveData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [whatsNewHistory, setWhatsNewHistory] = useState<WhatsNewHistoryItem[]>(
    [],
  );
  const [isWhatsNewLoading, setIsWhatsNewLoading] = useState<boolean>(false);

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

  const loadWhatsNew = useCallback(async () => {
    if (whatsNewHistory.length > 0 || isWhatsNewLoading) return;
    try {
      setIsWhatsNewLoading(true);
      const history = await fetchWhatsNewHistory();
      setWhatsNewHistory(history);
    } catch {
      // ignore
    } finally {
      setIsWhatsNewLoading(false);
    }
  }, [whatsNewHistory.length, isWhatsNewLoading]);

  useEffect(() => {
    let mounted = true;
    Promise.resolve().then(() => {
      if (mounted) fetchData();
    });
    return () => {
      mounted = false;
    };
  }, [fetchData]);

  useEffect(() => {
    let mounted = true;
    if (activeTab === "whats-new") {
      Promise.resolve().then(() => {
        if (mounted) loadWhatsNew();
      });
    }
    return () => {
      mounted = false;
    };
  }, [activeTab, loadWhatsNew]);

  const stats = useMemo(
    () =>
      activeData?.stats || { bundlesCount: 0, patchesCount: 0, appsCount: 0 },
    [activeData],
  );

  return {
    activeData,
    isLoading,
    errorMessage,
    whatsNewHistory,
    globalSearch,
    setGlobalSearch,
    stats,
  };
}
