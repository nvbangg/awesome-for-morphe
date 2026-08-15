import { memo } from "react";
import {
  Sparkles,
  FlaskConical,
  Star,
  Download,
  Calendar,
  TriangleAlert,
} from "lucide-react";
import { formatNumberCompact, formatStarCount } from "@/utils/formatters";

type BadgeVariant =
  | "new"
  | "prerelease"
  | "unofficial"
  | "off"
  | "stars"
  | "downloads"
  | "patches"
  | "count"
  | "category"
  | "updated";

interface BadgeProps {
  variant: BadgeVariant;
  value?: number;
  className?: string;
  title?: string;
  href?: string;
  children?: React.ReactNode;
}

export const Badge = memo(function Badge({
  variant,
  value,
  className = "",
  title,
  href,
  children,
}: BadgeProps) {
  if (variant === "new") {
    return (
      <span
        className={`inline-flex items-center justify-center gap-1 px-1 py-0.5 text-xs font-semibold whitespace-nowrap text-warning border border-warning/30 rounded-md shrink-0 select-none ${className}`}
        title={title}
      >
        <Sparkles className="size-3 fill-current text-warning shrink-0" />
        New
      </span>
    );
  }

  if (variant === "prerelease") {
    return (
      <span
        className={`inline-flex items-center justify-center gap-1 px-1 py-0.5 text-xs font-semibold whitespace-nowrap text-warning border border-warning/30 rounded-md shrink-0 select-none ${className}`}
        title={title}
      >
        <FlaskConical className="size-3 text-warning shrink-0" />
        Pre-release
      </span>
    );
  }

  if (variant === "unofficial") {
    return (
      <span
        className={`inline-flex items-center justify-center gap-1 px-1 py-0.5 text-xs font-semibold whitespace-nowrap text-warning border border-warning/30 rounded-md shrink-0 select-none ${className}`}
        title={title || "Not included in Official Morphe Community Patches"}
      >
        <TriangleAlert className="size-3 text-warning shrink-0" />
        Unofficial
      </span>
    );
  }

  if (variant === "off") {
    return (
      <span
        className={`inline-flex items-center justify-center px-1 py-0.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap text-warning border border-warning/30 rounded-md shrink-0 cursor-help select-none ${className}`}
        title={title || "Disabled by default"}
      >
        off
      </span>
    );
  }

  if (variant === "stars" && value !== undefined && value > 0) {
    return (
      <span
        className={`inline-flex items-center justify-center gap-1 px-1 py-0.5 text-xs font-semibold whitespace-nowrap text-foreground-muted border border-divider rounded-md shrink-0 select-none ${className}`}
        title={title}
      >
        <Star className="size-3 fill-current text-warning shrink-0" />
        {formatStarCount(value)}
      </span>
    );
  }

  if (variant === "downloads" && value !== undefined) {
    return (
      <span
        className={`inline-flex items-center justify-center gap-1 px-1 py-0.5 text-xs font-semibold whitespace-nowrap text-foreground-muted border border-divider rounded-md shrink-0 select-none ${className}`}
        title={title}
      >
        <Download className="size-3 text-warning shrink-0" />
        {formatNumberCompact(value)}
      </span>
    );
  }

  if (variant === "patches") {
    return (
      <span
        className={`inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap text-foreground-muted border border-divider rounded-full shrink-0 select-none ${className}`}
        title={title}
      >
        {children}
      </span>
    );
  }

  if (variant === "count") {
    return (
      <span
        className={`inline-flex items-center justify-center px-2 py-1 text-xs font-semibold whitespace-nowrap text-foreground-muted border border-divider rounded-full shrink-0 select-none ${className}`}
        title={title}
      >
        {children}
      </span>
    );
  }

  if (variant === "category") {
    return (
      <span
        className={`inline-flex items-center justify-center px-2 py-1 text-xs font-semibold whitespace-nowrap text-foreground-muted border border-divider rounded-full shrink-0 select-none ${className}`}
        title={title || "Category"}
      >
        {children}
      </span>
    );
  }

  if (variant === "updated") {
    const Tag = href ? "a" : "span";
    return (
      <Tag
        href={href}
        target={href ? "_blank" : undefined}
        onClick={
          href ? (e: React.MouseEvent) => e.stopPropagation() : undefined
        }
        className={`inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-semibold whitespace-nowrap text-primary border border-primary/20 rounded-full shrink-0 select-none ${href ? "hover:underline cursor-pointer" : ""} ${className}`}
        title={title || "View Release Changelog"}
      >
        <Calendar className="size-3.5 shrink-0" />
        {children}
      </Tag>
    );
  }

  return null;
});
