import { useState, useEffect, useRef, useCallback } from "react";

export function useInfiniteScroll<T>(items: T[], chunkSize: number = 30) {
  const [visibleCount, setVisibleCount] = useState(chunkSize);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setVisibleCount(chunkSize);
  }

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting) {
        setVisibleCount((prev) => Math.min(prev + chunkSize, items.length));
      }
    },
    [chunkSize, items.length],
  );

  useEffect(() => {
    const currentElement = loadMoreRef.current;
    if (!currentElement) return;

    observerRef.current = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "400px",
      threshold: 0,
    });

    observerRef.current.observe(currentElement);

    return () => {
      if (observerRef.current && currentElement) {
        observerRef.current.unobserve(currentElement);
      }
    };
  }, [handleObserver]);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  return { visibleItems, loadMoreRef, hasMore };
}
