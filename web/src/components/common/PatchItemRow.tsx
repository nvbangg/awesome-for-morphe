import { memo, useState } from "react";
import { RowItem } from "@/data";
import { FlaskConical, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/common/Badge";

interface PatchItemRowProps {
  patchItem: RowItem;
  copiedText: string | null;
  copyToClipboard: (text: string, key?: string) => void;
}

export const PatchItemRow = memo(function PatchItemRow({ patchItem, copiedText, copyToClipboard }: PatchItemRowProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [showAllVersions, setShowAllVersions] = useState(false);

  const hasOptions = Array.isArray(patchItem.options) && patchItem.options.length > 0;
  const versions = patchItem.versions || [];
  const hasMultipleVersions = versions.length > 1;
  const isDefaultOff = patchItem.default === false;

  return (
    <div
      onClick={() => {
        if (hasOptions) {
          setShowOptions((prev) => !prev);
        }
      }}
      className={`py-2.5 px-4 bg-card hover:bg-default-50 border-b last:border-b-0 border-divider/60 flex flex-col gap-1.5 transition-colors text-foreground ${hasOptions ? "cursor-pointer" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1.5 w-full">
        <div className="flex items-center gap-2 flex-wrap max-w-full">
          <span className="font-semibold text-sm text-foreground wrap-break-word select-text">{patchItem.patchName}</span>

          {patchItem.isPatchPreRelease && <Badge variant="prerelease" />}

          {isDefaultOff && (
            <span
              className="inline-flex items-center justify-center bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-md px-1 py-0 text-xs font-bold uppercase tracking-wider border border-amber-500/30 cursor-help shrink-0"
              title="Disabled by default"
            >
              off
            </span>
          )}

          {hasOptions && (
            <span
              className="inline-flex items-center justify-center p-0.5 text-primary bg-primary/10 rounded-md border border-primary/20 hover:bg-primary/20 transition-colors shrink-0"
              title={showOptions ? "Hide patch options" : "Show patch options"}
            >
              {showOptions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap shrink min-w-0 justify-end ml-auto">
          {versions.length === 0 ? (
            <span className="inline-flex items-center px-1 py-0 rounded-full text-xs font-normal bg-zinc-200/60 dark:bg-zinc-700/60 text-foreground-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 shrink-0">
              Any version
            </span>
          ) : !showAllVersions ? (
            <div className="flex items-center gap-1 flex-wrap">
              {(() => {
                const ver = versions[0];
                const key = `${patchItem.id}-ver-0`;
                const isCopied = copiedText === key;

                return (
                  <button
                    key={0}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(ver.version, key);
                    }}
                    className={`inline-grid grid-cols-1 items-center justify-center px-1 py-0 rounded-full text-xs font-normal transition-all cursor-pointer border ${
                      isCopied
                        ? "bg-success/20 text-success-600 dark:text-success-400 border-success/40"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                    }`}
                    title={isCopied ? "Copied!" : ver.isExperimental ? "Experimental version (Click to copy)" : "Supported version (Click to copy)"}
                  >
                    <span className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-0.5 ${isCopied ? "invisible" : "visible"}`}>
                      {ver.isExperimental && <FlaskConical className="w-2.5 h-2.5 text-warning shrink-0" />}
                      <span>{ver.version}</span>
                    </span>
                    <span className={`col-start-1 row-start-1 inline-flex items-center justify-center ${isCopied ? "visible" : "invisible"}`}>Copied!</span>
                  </button>
                );
              })()}

              {hasMultipleVersions && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAllVersions(true);
                  }}
                  className="inline-flex items-center px-1.5 py-0 rounded-full text-xs font-normal bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all cursor-pointer shrink-0"
                  title="Show all supported versions"
                >
                  +{versions.length - 1}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1 max-w-full justify-end">
              {versions.map((ver, idx) => {
                const key = `${patchItem.id}-ver-${idx}`;
                const isCopied = copiedText === key;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(ver.version, key);
                    }}
                    className={`inline-grid grid-cols-1 items-center justify-center px-1 py-0 rounded-full text-xs font-normal transition-all cursor-pointer border ${
                      isCopied
                        ? "bg-success/20 text-success-600 dark:text-success-400 border-success/40"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                    }`}
                    title={isCopied ? "Copied!" : ver.isExperimental ? "Experimental version (Click to copy)" : "Supported version (Click to copy)"}
                  >
                    <span className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-0.5 ${isCopied ? "invisible" : "visible"}`}>
                      {ver.isExperimental && <FlaskConical className="w-2.5 h-2.5 text-warning shrink-0" />}
                      <span>{ver.version}</span>
                    </span>
                    <span className={`col-start-1 row-start-1 inline-flex items-center justify-center ${isCopied ? "visible" : "invisible"}`}>Copied!</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAllVersions(false);
                }}
                className="inline-flex items-center px-1.5 py-0 rounded-full text-xs font-normal bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all cursor-pointer shrink-0"
                title="Collapse version list"
              >
                Less
              </button>
            </div>
          )}
        </div>
      </div>

      {patchItem.patchDescription && <p className="text-xs text-foreground-600 dark:text-foreground-400 leading-relaxed select-text">{patchItem.patchDescription}</p>}

      {hasOptions && showOptions && (
        <div onClick={(e) => e.stopPropagation()} className="mt-1 p-2.5 bg-zinc-100 dark:bg-zinc-800/80 border border-border rounded-lg flex flex-col gap-2 select-text">
          {patchItem.options!.map((opt, idx) => (
            <div key={opt.key || idx} className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-foreground">{opt.title || opt.key}</span>
              {opt.description && <p className="text-xs text-foreground-600 dark:text-foreground-400 leading-normal">{opt.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
