import { Plus } from "lucide-react";
import { ModalHeader, CloseButton } from "@/components/common/CustomModal";

interface TestBundleViewModalHeaderProps {
  repoUrl: string;
  branches: string[];
  availableBranches: string[];
  currentBranch: string;
  setCurrentBranch: (branch: string) => void;
  deepLink: string;
  onClose: () => void;
}

export function TestBundleViewModalHeader({
  repoUrl,
  branches,
  availableBranches,
  currentBranch,
  setCurrentBranch,
  deepLink,
  onClose,
}: TestBundleViewModalHeaderProps) {
  return (
    <ModalHeader>
      <div className="flex flex-col gap-3 w-full">
        <div className="flex items-center justify-between gap-4 w-full">
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg font-bold text-primary hover:underline dark:text-[#3fe9e8] break-all whitespace-normal"
          >
            {repoUrl}
          </a>
          <CloseButton onClose={onClose} />
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-background-100 dark:bg-background-800 p-1 rounded-xl border border-divider">
            {branches.map((branch) => {
              const isAvailable = availableBranches.includes(branch);
              return (
                <button
                  key={branch}
                  type="button"
                  disabled={!isAvailable}
                  onClick={() => isAvailable && setCurrentBranch(branch)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    currentBranch === branch
                      ? "bg-primary text-white shadow-xs"
                      : isAvailable
                        ? "text-foreground-600 hover:text-foreground hover:bg-background-200 dark:hover:bg-background-700 cursor-pointer"
                        : "text-foreground-300 dark:text-foreground-600 opacity-50 cursor-not-allowed"
                  }`}
                >
                  {branch}
                </button>
              );
            })}
          </div>

          {deepLink && (
            <a
              href={deepLink}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(image:--primary-gradient) text-white text-sm font-semibold no-underline border-none cursor-pointer transition-all hover:opacity-90 hover:scale-[1.02] shadow-sm select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <Plus className="w-4 h-4" /> Add to Morphe
            </a>
          )}
        </div>
      </div>
    </ModalHeader>
  );
}
