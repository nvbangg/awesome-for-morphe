import { Sun, Moon } from "lucide-react";
import { Button } from "@heroui/react";
import { useTheme } from "next-themes";
import { GitHubIcon } from "@/components/common/icons/GitHubIcon";

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
            <GitHubIcon className="size-4" />
            <span className="hidden md:inline">GitHub</span>
          </a>
        </div>
      </div>
    </nav>
  );
}
