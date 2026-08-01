import { Skeleton } from "@heroui/react";

interface SkeletonGridProps {
  count?: number;
}

export function SkeletonGrid({ count = 6 }: SkeletonGridProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5 my-6">
      {Array.from({ length: count }).map((_, skeletonIndex) => (
        <div key={skeletonIndex} className="p-4 border border-divider rounded-2xl bg-card flex flex-col gap-3">
          <div className="flex gap-4">
            <Skeleton className="w-14 h-14 rounded-xl shrink-0 bg-zinc-200 dark:bg-zinc-700" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4 bg-zinc-200 dark:bg-zinc-700" />
              <Skeleton className="h-3 w-1/2 bg-zinc-200 dark:bg-zinc-700" />
            </div>
          </div>
          <Skeleton className="h-10 w-full mt-2 bg-zinc-200 dark:bg-zinc-700" />
        </div>
      ))}
    </div>
  );
}
