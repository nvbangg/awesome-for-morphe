import { memo } from "react";
import { GitHubIcon } from "@/components/common/icons/GitHubIcon";
import { GitLabIcon } from "@/components/common/icons/GitLabIcon";

interface RepoLinkProps {
  repo?: string;
  repoUrl?: string;
  source?: string;
  className?: string;
}

export const RepoLink = memo(function RepoLink({
  repo,
  repoUrl,
  source,
  className = "",
}: RepoLinkProps) {
  if (!repo || !repoUrl) return null;

  const isGitLab = source === "gitlab";

  return (
    <a
      href={repoUrl}
      target="_blank"
      onClick={(e) => e.stopPropagation()}
      className={`text-xs text-primary hover:underline font-medium dark:text-secondary inline-flex items-start gap-1.5 mt-0.5 max-w-full ${className}`}
    >
      {isGitLab ? (
        <GitLabIcon className="size-3.5 text-warning shrink-0 mt-0.5" />
      ) : (
        <GitHubIcon className="size-3.5 text-foreground shrink-0 mt-0.5" />
      )}
      <span className="break-all whitespace-normal min-w-0">{repo}</span>
    </a>
  );
});
