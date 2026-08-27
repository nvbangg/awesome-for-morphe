import { memo } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

export const ThemeToggle = memo(function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark" || theme === "dark";

  return (
    <button
      type="button"
      id="theme-toggle"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDarkMode ? "light" : "dark")}
      className="inline-flex items-center justify-center size-8 md:w-auto md:pl-2 md:pr-2.5 rounded-full font-semibold text-xs gap-1 transition-all bg-foreground text-background hover:opacity-90 border-none cursor-pointer shrink-0"
    >
      {isDarkMode ? (
        <>
          <Sun className="size-4 text-warning fill-warning" />
          <span className="hidden md:inline">Light</span>
        </>
      ) : (
        <>
          <Moon className="size-4 text-secondary fill-secondary" />
          <span className="hidden md:inline">Dark</span>
        </>
      )}
    </button>
  );
});
