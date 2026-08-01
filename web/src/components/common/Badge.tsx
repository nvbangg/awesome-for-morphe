import { Sparkles, FlaskConical, Star, Download } from "lucide-react";
import { formatNumberCompact, formatStarCount } from "@/utils/formatters";

type BadgeVariant = "new" | "prerelease" | "stars" | "downloads";

interface BadgeProps {
  variant: BadgeVariant;
  value?: number;
  className?: string;
  title?: string;
}

export function Badge({ variant, value, className = "", title }: BadgeProps) {
  if (variant === "new") {
    return (
      <span
        className={`inline-flex items-center gap-0.5 justify-center bg-success/20 text-success-600 dark:text-success-500 rounded-md px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider border border-success/30 shrink-0 ${className}`}
        title={title}
      >
        <Sparkles className="w-2.5 h-2.5" />
        New
      </span>
    );
  }

  if (variant === "prerelease") {
    return (
      <span
        className={`inline-flex items-center gap-0.5 justify-center bg-warning/20 text-warning-700 dark:text-warning-500 rounded-md px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider border border-warning/30 shrink-0 ${className}`}
        title={title}
      >
        <FlaskConical className="w-2.5 h-2.5" />
        Pre-release
      </span>
    );
  }

  if (variant === "stars" && value !== undefined && value > 0) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-xs bg-zinc-200/60 dark:bg-zinc-700/60 text-foreground-600 dark:text-zinc-300 px-1.5 py-0.5 rounded-md font-medium whitespace-nowrap border border-zinc-200 dark:border-zinc-700 shrink-0 ${className}`}
        title={title || "GitHub Stars"}
      >
        <Star className="w-2.5 h-2.5 fill-current text-yellow-500" />
        {formatStarCount(value)}
      </span>
    );
  }

  if (variant === "downloads" && value !== undefined) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-xs bg-zinc-200/60 dark:bg-zinc-700/60 text-foreground-600 dark:text-zinc-300 px-1.5 py-0.5 rounded-md font-medium whitespace-nowrap border border-zinc-200 dark:border-zinc-700 shrink-0 ${className}`}
        title={title}
      >
        <Download className="w-2.5 h-2.5" />
        {formatNumberCompact(value)}
      </span>
    );
  }

  return null;
}
