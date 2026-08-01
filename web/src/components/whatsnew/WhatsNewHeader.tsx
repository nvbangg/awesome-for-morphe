import { Sparkles } from "lucide-react";

export function WhatsNewHeader() {
  return (
    <div className="mt-2 mb-6 flex flex-col items-center justify-center text-center gap-2">
      <h2 className="font-bold text-2xl text-foreground flex items-center justify-center gap-2">
        <Sparkles className="size-6 text-warning fill-warning/10 shrink-0" />
        What's New
      </h2>
      <p className="text-sm text-foreground-500">Recently added bundles, apps & patches</p>
      <div className="w-full max-w-xs h-px bg-divider/60 my-1 mx-auto" />
      <div className="text-sm text-foreground-600 dark:text-foreground-400 mt-1 flex flex-wrap items-center justify-center gap-1">
        <span>🔔 Get notified via the</span>
        <a href="https://t.me/awesome_morphe" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline dark:text-[#3fe9e8]">
          <svg className="w-4.5 h-4.5 fill-current text-[#24A1DE] shrink-0" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.24-5.54 3.65-.52.36-.99.54-1.41.53-.46-.01-1.35-.26-2.01-.48-.81-.27-1.46-.42-1.4-.88.03-.24.37-.49 1.02-.75 3.99-1.74 6.66-2.88 7.99-3.43 3.81-1.58 4.6-1.85 5.12-1.86.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.16-.03.22z" />
          </svg>
          Telegram channel
        </a>
        <span>whenever there's a new update.</span>
      </div>
      <div className="text-sm text-foreground-600 dark:text-foreground-400 flex flex-wrap items-center justify-center gap-1">
        <span>🔍 Explore all Morphe resources and community projects on the</span>
        <a
          href="https://github.com/nvbangg/awesome-morphe"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline dark:text-[#3fe9e8]"
        >
          <svg className="w-4 h-4 fill-current text-foreground shrink-0" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          GitHub repository.
        </a>
      </div>
    </div>
  );
}
