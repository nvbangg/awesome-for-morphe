import { memo } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@heroui/react";
import { useTheme } from "next-themes";

export const ThemeToggle = memo(function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark" || theme === "dark";

  return (
    <Button
      id="theme-toggle"
      variant="ghost"
      size="sm"
      aria-label="Toggle theme"
      onPress={() => setTheme(isDarkMode ? "light" : "dark")}
      className="font-semibold text-xs gap-1.5 transition-all bg-foreground text-background hover:opacity-90 border-none"
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
    </Button>
  );
});
