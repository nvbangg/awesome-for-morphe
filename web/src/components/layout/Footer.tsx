import { useState, useEffect } from "react";
import { Button } from "@heroui/react";
import { ArrowUp } from "lucide-react";

export function Footer() {
  const [isScrollTopVisible, setIsScrollTopVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrollTopVisible(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <footer className="mt-4 border-t border-divider bg-background pt-4 pb-20 sm:pb-6">
        <div className="container mx-auto px-6 max-w-300 flex flex-col gap-3">
          <a
            href="https://awesome-morphe.vercel.app/"
            className="flex items-center gap-3 no-underline group w-fit"
          >
            <img
              alt="Awesome Morphe"
              className="h-8 w-auto"
              src="assets/favicon.svg"
            />
            <span className="font-bold text-xl text-foreground group-hover:text-primary transition-colors">
              Awesome Morphe
            </span>
          </a>
          <p className="text-foreground-600 dark:text-foreground-500 text-sm">
            Explore all patch bundles created by the Morphe community.
          </p>
          <div className="border-t border-divider pt-3 text-foreground-600 dark:text-foreground-500 text-xs leading-relaxed flex flex-col gap-1.5">
            <p>
              <a
                href="https://github.com/nvbangg/awesome-morphe"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary no-underline hover:opacity-80 transition-opacity"
              >
                This project
              </a>{" "}
              is not affiliated with{" "}
              <a
                href="https://morphe.software/"
                target="_blank"
                className="font-semibold text-primary no-underline hover:opacity-80 transition-opacity"
              >
                Morphe
              </a>{" "}
              or any authors mentioned here.
            </p>
            <p>
              Only use patch sources or projects you trust. This project is for
              informational purposes only and is not responsible for any arising
              issues.
            </p>
          </div>
        </div>
      </footer>

      <Button
        isIconOnly
        variant="primary"
        className={`fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full shadow-xl transition-all duration-300 ${isScrollTopVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}
        aria-label="Scroll to top"
        onPress={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <ArrowUp className="size-6" />
      </Button>
    </>
  );
}
