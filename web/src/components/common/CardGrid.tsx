import { memo, ReactNode, RefObject } from "react";
import { SearchX } from "lucide-react";
import { Skeleton } from "@heroui/react";

interface CardGridProps {
  children: ReactNode;
  hasMore?: boolean;
  loadMoreRef?: RefObject<HTMLDivElement | null>;
  className?: string;
}

export const CardGrid = memo(function CardGrid({
  children,
  hasMore,
  loadMoreRef,
  className = "",
}: CardGridProps) {
  return (
    <>
      <div
        className={`grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5 my-6 ${className}`}
      >
        {children}
      </div>
      {hasMore && <div ref={loadMoreRef} className="h-px w-full" />}
    </>
  );
});

interface SkeletonGridProps {
  count?: number;
}

export function SkeletonGrid({ count = 6 }: SkeletonGridProps) {
  return (
    <CardGrid>
      {Array.from({ length: count }).map((_, skeletonIndex) => (
        <div
          key={skeletonIndex}
          className="p-4 border border-divider rounded-2xl bg-card flex flex-col gap-3"
        >
          <div className="flex gap-4">
            <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-10 w-full mt-2" />
        </div>
      ))}
    </CardGrid>
  );
}

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-divider rounded-2xl my-6">
      <SearchX className="size-10 text-foreground-subtle mb-3" />
      <p className="text-foreground-muted font-medium">{message}</p>
    </div>
  );
}
