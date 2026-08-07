import { Sun, Moon } from "lucide-react";
import { Button } from "@heroui/react";
import { useTheme } from "next-themes";

export function Header() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark" || theme === "dark";

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-divider transition-shadow">
      <div className="container mx-auto px-6 max-w-300 py-3 flex items-center justify-between">
        <a
          href="https://awesome-morphe.vercel.app/"
          className="flex items-center gap-3 no-underline shrink-0 group"
        >
          <img
            alt="Awesome Morphe"
            className="h-8 w-8 object-contain"
            src="assets/favicon.svg"
          />
          <span className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
            Awesome Morphe
          </span>
        </a>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            id="theme-toggle"
            variant="ghost"
            size="sm"
            aria-label="Toggle theme"
            onPress={() => setTheme(isDarkMode ? "light" : "dark")}
            className={`font-semibold text-xs gap-1.5 transition-all ${
              isDarkMode
                ? "bg-zinc-100 text-zinc-900 hover:bg-white dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
                : "bg-zinc-800 text-zinc-100 hover:bg-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900"
            }`}
          >
            {isDarkMode ? (
              <>
                <Sun className="size-4 text-amber-500 fill-amber-500" />
                <span className="hidden md:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="size-4 text-indigo-400 fill-indigo-400" />
                <span className="hidden md:inline">Dark</span>
              </>
            )}
          </Button>

          <a
            href="https://github.com/nvbangg/awesome-morphe"
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center justify-center h-8 px-3 rounded-lg font-semibold text-xs gap-1.5 transition-all ${
              isDarkMode
                ? "bg-zinc-100 text-zinc-900 hover:bg-white dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
                : "bg-zinc-800 text-zinc-100 hover:bg-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900"
            }`}
          >
            <svg className="size-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span className="hidden md:inline">GitHub</span>
          </a>
        </div>
      </div>
    </nav>
  );
}
