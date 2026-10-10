// Bascule clair/sombre, partagée par le site, la borne et la cuisine.
// Le choix est mémorisé dans le navigateur (localStorage "theme").
import { safeLocal } from "@/lib/safe-storage";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Theme = "dark" | "light";
const KEY = "theme";

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#141210" : "#fbf8f1");
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    const saved = safeLocal.get(KEY);
    const initial: Theme = saved === "light" ? "light" : "dark";
    setTheme(initial);
    apply(initial);
    const sync = () => setTheme(safeLocal.get(KEY) === "light" ? "light" : "dark");
    window.addEventListener("lc-theme-change", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("lc-theme-change", sync); window.removeEventListener("storage", sync); };
  }, []);
  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    safeLocal.set(KEY, next);
    apply(next);
    window.dispatchEvent(new Event("lc-theme-change"));
  };
  return { theme, toggle };
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-label={theme === "dark" ? "Passer en affichage clair" : "Passer en affichage sombre"}
      title={theme === "dark" ? "Affichage clair" : "Affichage sombre"}
      className={cn(
        "shrink-0",
        className,
      )}
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
