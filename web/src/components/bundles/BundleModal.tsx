import { useMemo, useState, useEffect } from "react";
import { ActiveData, getBundleAppGroups } from "@/data";
import { SearchInput } from "@/components/common/SearchInput";
import { useCopy } from "@/hooks/useCopy";
import { isNew } from "@/utils/formatters";
import { Avatar } from "@heroui/react";
import { Package, Check, Copy, Plus, Smartphone, Play, Calendar, ChevronDown } from "lucide-react";
import { PatchItemRow } from "@/components/common/PatchItemRow";
import { Badge } from "@/components/common/Badge";
import { CustomModal, ModalHeader, ModalBody, CloseButton } from "@/components/common/CustomModal";

interface BundleModalProps {
  isOpen: boolean;
  onClose: () => void;
  bundleKey: string | null;
  activeData: ActiveData | null;
  searchQuery: string;
  onSearchChange: (searchValue: string) => void;
}

export function BundleModal({ isOpen, onClose, bundleKey, activeData, searchQuery, onSearchChange }: BundleModalProps) {
  const { copiedText, copyToClipboard } = useCopy();

  const [activeBundle, setActiveBundle] = useState<string | null>(null);
  useEffect(() => {
    if (bundleKey) setActiveBundle(bundleKey);
  }, [bundleKey]);

  const displayBundle = bundleKey || activeBundle;

  const bundleMeta = useMemo(() => {
    if (!displayBundle || !activeData) return null;

    const lowerKey = displayBundle.toLowerCase();
    const bundle = activeData.bundleMap[lowerKey];
    if (!bundle) return null;

    return {
      name: bundle.name || bundle.repo,
      repo: bundle.repo,
      repoUrl: bundle.repoUrl,
      avatarUrl: bundle.avatarUrl,
      deepLink: bundle.deepLink,
      rawKey: bundle.key,
      repoDescription: bundle.repoDescription,
      firstSeen: bundle.firstSeen,
      isPreRelease: bundle.isPreRelease,
      stars: bundle.stars,
      updatedAt: bundle.updatedAt,
      changelogUrl: bundle.changelogUrl,
      source: bundle.source,
    };
  }, [displayBundle, activeData]);

  const formattedDate = bundleMeta?.updatedAt
    ? new Date(bundleMeta.updatedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

  const appGroups = useMemo(() => {
    if (!displayBundle || !activeData) return [];
    return getBundleAppGroups(activeData, displayBundle, searchQuery);
  }, [displayBundle, activeData, searchQuery]);

  const [expandedAppKeys, setExpandedAppKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    if (appGroups.length === 1 || searchQuery.trim().length > 0) {
      setExpandedAppKeys(new Set(appGroups.map((g) => g.packageName)));
    } else {
      setExpandedAppKeys(new Set());
    }
  }, [appGroups, searchQuery, isOpen]);

  const toggleAppGroup = (pkgName: string) => {
    setExpandedAppKeys((prev) => {
      const next = new Set(prev);
      if (next.has(pkgName)) {
        next.delete(pkgName);
      } else {
        next.add(pkgName);
      }
      return next;
    });
  };

  if (!bundleMeta) return null;

  return (
    <CustomModal isOpen={isOpen} onClose={onClose}>
      <ModalHeader onClose={onClose}>
        <div className="flex flex-row items-start justify-between gap-4 w-full">
          <div className="flex flex-row items-center gap-4 flex-1 min-w-0">
            <Avatar className="w-14 h-14 rounded-2xl shrink-0 border border-border">
              <Avatar.Image src={bundleMeta.avatarUrl} alt={bundleMeta.name} />
              <Avatar.Fallback className="bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <Package className="size-8 text-foreground-400" />
              </Avatar.Fallback>
            </Avatar>
            <div className="flex flex-col min-w-0 justify-center">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight text-foreground truncate">{bundleMeta.name}</h2>
                {isNew(bundleMeta.firstSeen) && <Badge variant="new" />}
                {bundleMeta.isPreRelease && <Badge variant="prerelease" />}
                {bundleMeta.stars > 0 && <Badge variant="stars" value={bundleMeta.stars} />}
              </div>
              <a
                href={bundleMeta.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline font-medium dark:text-[#3fe9e8] inline-flex items-center gap-1.5 mt-0.5 w-fit max-w-full flex-wrap break-all"
              >
                {bundleMeta.source === "gitlab" ? (
                  <svg className="w-3.5 h-3.5 fill-current text-orange-500 shrink-0" viewBox="0 0 24 24">
                    <path d="m23.905 11.966-.02-.054L20.25 1.156a.458.458 0 0 0-.435-.312.463.463 0 0 0-.44.32l-2.078 6.4h-10.6l-2.07-6.4a.46.46 0 0 0-.441-.32c-.198 0-.374.126-.435.312L.116 11.912a.916.916 0 0 0 .332 1.025l11.235 8.163.023.016.03.018a.555.555 0 0 0 .528 0l.03-.018.022-.016 11.258-8.163a.916.916 0 0 0 .331-1.027Z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 fill-current text-foreground shrink-0" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                )}
                <span className="break-all whitespace-normal">{bundleMeta.repo}</span>
              </a>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {bundleMeta.updatedAt > 0 && (
              <a
                href={bundleMeta.changelogUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-divider hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-primary dark:hover:text-[#3fe9e8] transition-colors text-xs font-semibold text-foreground-600 dark:text-zinc-300 no-underline shrink-0"
                title="View Release Changelog"
              >
                <Calendar className="w-3.5 h-3.5" />
                {formattedDate}
              </a>
            )}
            {bundleMeta.deepLink && (
              <a
                href={bundleMeta.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(image:--primary-gradient) text-white text-sm font-semibold no-underline border-none cursor-pointer transition-all hover:opacity-90 hover:scale-[1.02] shadow-sm select-none"
                onClick={(e) => e.stopPropagation()}
              >
                <Plus className="w-4 h-4" /> Add to Morphe
              </a>
            )}
            <CloseButton onClose={onClose} />
          </div>

          <div className="sm:hidden shrink-0">
            <CloseButton onClose={onClose} />
          </div>
        </div>

        {bundleMeta.repoDescription && <p className="text-sm text-foreground-600 dark:text-foreground-500 leading-relaxed wrap-break-word">{bundleMeta.repoDescription}</p>}

        <div className="flex sm:hidden items-center justify-between gap-3 mt-1 w-full">
          {bundleMeta.updatedAt > 0 && (
            <a
              href={bundleMeta.changelogUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border border-divider hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-primary transition-colors text-xs font-semibold text-foreground-600 no-underline shrink-0"
              title="View Release Changelog"
            >
              <Calendar className="w-3.5 h-3.5" />
              {formattedDate}
            </a>
          )}
          {bundleMeta.deepLink && (
            <a
              href={bundleMeta.deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-(image:--primary-gradient) text-white text-sm font-semibold no-underline border-none cursor-pointer transition-all hover:opacity-90 active:scale-[0.98] shadow-sm select-none shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Plus className="w-4 h-4" /> Add to Morphe
            </a>
          )}
        </div>
      </ModalHeader>

      <ModalBody>
        <div className="flex items-center gap-3">
          <SearchInput id="patch-search" placeholder="Search apps or patches…" value={searchQuery} onChange={onSearchChange} className="flex-1" />
          <span className="inline-flex items-center justify-center bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-semibold px-3 py-1 shrink-0 whitespace-nowrap">
            {appGroups.length} {appGroups.length === 1 ? "app" : "apps"}
          </span>
        </div>

        <div className="flex flex-col gap-3 pr-1">
          {appGroups.length === 0 ? (
            <div className="py-12 text-center text-foreground-400 text-sm font-medium">No apps found</div>
          ) : (
            appGroups.map((group) => {
              const isUniversal = group.packageName === "universal";
              const isNotOnPlayStore = group.packageName === "not-on-google-play";
              const showGooglePlay = !isUniversal && !isNotOnPlayStore;
              const isExpanded = expandedAppKeys.has(group.packageName);

              return (
                <div key={group.packageName} className="border border-divider rounded-xl bg-background flex flex-col">
                  <div
                    onClick={() => toggleAppGroup(group.packageName)}
                    className={`sticky -top-4 z-20 flex items-center gap-4 px-4 py-3 bg-background cursor-pointer hover:bg-default-100/60 transition-colors rounded-t-xl shadow-sm ${showGooglePlay ? "sm:border-b border-divider/60" : "border-b border-divider/60"}`}
                  >
                    <Avatar className="w-10 h-10 rounded-xl shrink-0 border border-border bg-zinc-100 dark:bg-zinc-800">
                      {group.appMeta.appIcon ? <Avatar.Image src={group.appMeta.appIcon} alt={group.appMeta.appName} /> : null}
                      <Avatar.Fallback className="bg-transparent flex items-center justify-center">
                        <Smartphone className="size-5 text-foreground-400" />
                      </Avatar.Fallback>
                    </Avatar>

                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <div className="font-bold text-foreground text-sm truncate">{group.appMeta.appName}</div>
                        {isNew(group.appMeta.firstSeen) && <Badge variant="new" />}
                        {group.patches.some((p) => p.isAppPreRelease) && <Badge variant="prerelease" />}
                      </div>
                      {group.packageName !== "universal" && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(group.packageName);
                          }}
                          className="flex items-center gap-1.5 mt-0.5 text-xs text-primary cursor-pointer w-fit"
                          title="Copy Package Name"
                        >
                          {copiedText === group.packageName ? <Check className="size-3 text-success shrink-0" /> : <Copy className="size-3 shrink-0 text-foreground-500 hover:text-primary" />}
                          <span className="truncate text-primary font-medium dark:text-[#3fe9e8]">{group.packageName}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="hidden sm:inline-flex items-center justify-center bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-semibold px-2.5 py-0.5 shrink-0">
                        {group.patches.length} {group.patches.length === 1 ? "patch" : "patches"}
                      </span>
                      {showGooglePlay && (
                        <a
                          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-(image:--primary-gradient) text-white text-xs font-semibold no-underline border-none cursor-pointer transition-all hover:opacity-90 hover:scale-[1.02] shadow-sm shrink-0"
                          href={`https://play.google.com/store/apps/details?id=${group.packageName}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open on Google Play"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Google Play
                        </a>
                      )}
                      <ChevronDown className={`w-4 h-4 text-foreground-500 transition-transform duration-200 shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </div>

                  {showGooglePlay && (
                    <div
                      onClick={() => toggleAppGroup(group.packageName)}
                      className={`sm:hidden px-4 pb-3 pt-0 flex items-center justify-between gap-2 cursor-pointer hover:bg-default-100/60 transition-colors ${isExpanded ? "border-b border-divider/60" : ""}`}
                    >
                      <span className="inline-flex items-center justify-center bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-semibold px-2.5 py-0.5 shrink-0">
                        {group.patches.length} {group.patches.length === 1 ? "patch" : "patches"}
                      </span>
                      <a
                        className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg bg-(image:--primary-gradient) text-white text-xs font-semibold no-underline border-none cursor-pointer transition-all hover:opacity-90 active:scale-[0.98] shadow-sm shrink-0"
                        href={`https://play.google.com/store/apps/details?id=${group.packageName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open on Google Play"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Google Play
                      </a>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="flex flex-col">
                      {group.patches.map((patchItem) => (
                        <PatchItemRow key={patchItem.id} patchItem={patchItem} copiedText={copiedText} copyToClipboard={copyToClipboard} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ModalBody>
    </CustomModal>
  );
}
