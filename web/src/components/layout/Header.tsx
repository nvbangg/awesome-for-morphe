import { GitHubIcon } from "@/components/common/icons/GitHubIcon";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-divider transition-shadow h-16">
      <div className="container mx-auto px-6 max-w-300 h-full flex items-center justify-between">
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="https://awesome-morphe.vercel.app/"
            className="no-underline shrink-0 flex items-center"
          >
            <img
              alt="Awesome Morphe"
              className="size-9 object-contain"
              src="assets/favicon.svg"
              decoding="async"
            />
          </a>
          <div className="flex flex-col justify-center">
            <a
              href="https://awesome-morphe.vercel.app/"
              className="font-bold text-lg text-foreground hover:text-primary transition-colors leading-tight no-underline"
            >
              Awesome Morphe
            </a>
            <span className="hidden lg:block text-xs text-foreground-muted font-normal leading-tight mt-0.5">
              Explore all patch bundles from the{" "}
              <a
                href="https://morphe.software/"
                target="_blank"
                className="font-semibold text-primary no-underline hover:opacity-80 transition-opacity"
              >
                Morphe
              </a>{" "}
              community
            </span>
          </div>
        </div>

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
