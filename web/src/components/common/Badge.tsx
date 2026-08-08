import { Sparkles, FlaskConical, Star, Download } from "lucide-react";
import { formatNumberCompact, formatStarCount } from "@/utils/formatters";

type BadgeVariant =
  "new" | "prerelease" | "stars" | "downloads" | "count" | "category";

interface BadgeProps {
  variant: BadgeVariant;
  value?: number;
  className?: string;
  title?: string;
  children?: React.ReactNode;
}

export function Badge({
  variant,
  value,
  className = "",
  title,
  children,
}: BadgeProps) {
  if (variant === "new") {
    return (
      <span
        className={`inline-flex items-center gap-1 justify-center bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-md px-1.5 py-0.5 text-xs font-semibold shrink-0 ${className}`}
        title={title}
      >
        <Sparkles className="w-3 h-3" />
        New
      </span>
    );
  }

  if (variant === "prerelease") {
    return (
      <span
        className={`inline-flex items-center gap-1 justify-center bg-zinc-200/60 dark:bg-zinc-700/60 text-amber-600 dark:text-amber-400 rounded-md px-1.5 py-0.5 text-xs font-semibold border border-zinc-200 dark:border-zinc-700 shrink-0 ${className}`}
        title={title}
      >
        <FlaskConical className="w-3 h-3" />
        Pre-release
      </span>
    );
  }

  if (variant === "stars" && value !== undefined && value > 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 justify-center text-xs bg-zinc-200/60 dark:bg-zinc-700/60 text-foreground-600 dark:text-zinc-300 px-1.5 py-0.5 rounded-md font-semibold whitespace-nowrap border border-zinc-200 dark:border-zinc-700 shrink-0 ${className}`}
        title={title || "GitHub Stars"}
      >
        <Star className="w-3 h-3 fill-current text-yellow-500" />
        {formatStarCount(value)}
      </span>
    );
  }

  if (variant === "downloads" && value !== undefined) {
    return (
      <span
        className={`inline-flex items-center gap-1 justify-center text-xs bg-zinc-200/60 dark:bg-zinc-700/60 text-foreground-600 dark:text-zinc-300 px-1.5 py-0.5 rounded-md font-semibold whitespace-nowrap border border-zinc-200 dark:border-zinc-700 shrink-0 ${className}`}
        title={title}
      >
        <Download className="w-3 h-3 text-yellow-500" />
        {formatNumberCompact(value)}
      </span>
    );
  }

  if (variant === "count" || variant === "category") {
    const isCategory = variant === "category";
    const defaultPadding = isCategory ? "px-2 py-1" : "px-2.5 py-0.5";
    const hasPadding =
      className.includes("p-") ||
      className.includes("px-") ||
      className.includes("py-");
    return (
      <span
        className={`inline-flex items-center justify-center font-semibold rounded-full text-xs bg-zinc-200 text-foreground-700 dark:text-zinc-300 dark:bg-zinc-700 shrink-0 ${hasPadding ? "" : defaultPadding} ${className}`}
        title={title}
      >
        {children}
      </span>
    );
  }

  return null;
}
