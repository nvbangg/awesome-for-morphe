import { memo } from "react";
import { Check, Copy } from "lucide-react";
import { PACKAGE_UNIVERSAL } from "@/constants";

interface PackageNameCopyProps {
  packageName?: string;
  copiedText?: string | null;
  copyToClipboard: (text: string, key?: string) => void;
  className?: string;
}

export const PackageNameCopy = memo(function PackageNameCopy({
  packageName,
  copiedText,
  copyToClipboard,
  className = "",
}: PackageNameCopyProps) {
  if (!packageName || packageName === PACKAGE_UNIVERSAL) return null;

  const isCopied = copiedText === packageName;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        copyToClipboard(packageName);
      }}
      className={`flex items-center gap-1.5 mt-0.5 text-xs text-primary cursor-pointer w-fit ${className}`}
      title="Copy Package Name"
    >
      {isCopied ? (
        <Check className="size-3 text-success shrink-0" />
      ) : (
        <Copy className="size-3 shrink-0 text-foreground-muted hover:text-primary" />
      )}
      <span className="truncate text-primary font-medium dark:text-secondary">
        {packageName}
      </span>
    </div>
  );
});
