import { GitHubIcon } from "@/components/common/icons/GitHubIcon";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-divider transition-shadow">
      <div className="container mx-auto px-6 max-w-300 py-3 flex items-center justify-between">
        <a
          href="https://awesome-morphe.vercel.app/"
          className="flex items-center gap-3 no-underline shrink-0 group"
        >
          <img
            alt="Awesome Morphe"
            className="size-8 object-contain"
            src="assets/favicon.svg"
          />
          <span className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
            Awesome Morphe
          </span>
        </a>

        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />

          <a
            href="https://github.com/nvbangg/awesome-morphe"
            target="_blank"
            title="Awesome Morphe Repository"
            className="inline-flex items-center justify-center h-8 px-3 rounded-lg font-semibold text-xs gap-1.5 transition-all bg-foreground text-background hover:opacity-90 border-none no-underline"
          >
            <GitHubIcon className="size-4" />
            <span className="hidden md:inline">GitHub</span>
          </a>
        </div>
      </div>
    </nav>
  );
}
