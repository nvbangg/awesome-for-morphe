import { SearchX } from "lucide-react";

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-divider rounded-2xl my-6">
      <SearchX className="size-10 text-foreground-400 mb-3" />
      <p className="text-foreground-500 font-medium">{message}</p>
    </div>
  );
}
