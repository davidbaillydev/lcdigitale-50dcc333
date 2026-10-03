// Thème de marque par restaurant (logo + couleurs) appliqué au site, à la borne et à la cuisine.
import { useEffect, type CSSProperties, type ReactNode } from "react";

export type Brand = { primary?: string; accent?: string };
const HEX = /^#[0-9a-f]{6}$/i;

function readableOn(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.4 ? "#141210" : "#fbf8f1";
}

export function brandVars(brand: Brand | null | undefined): Record<string, string> {
  const v: Record<string, string> = {};
  if (brand?.primary && HEX.test(brand.primary)) {
    v["--primary"] = brand.primary; v["--primary-foreground"] = readableOn(brand.primary); v["--ring"] = brand.primary;
  }
  if (brand?.accent && HEX.test(brand.accent)) {
    v["--accent"] = brand.accent; v["--accent-foreground"] = readableOn(brand.accent);
  }
  return v;
}

/** Applique les couleurs au sous-arbre (SSR) et au document (fenêtres et panneaux superposés). */
export function BrandTheme({ brand, children }: { brand: Brand | null | undefined; children: ReactNode }) {
  const vars = brandVars(brand);
  const key = JSON.stringify(vars);
  useEffect(() => {
    const root = document.documentElement;
    const entries = Object.entries(JSON.parse(key) as Record<string, string>);
    entries.forEach(([k, val]) => root.style.setProperty(k, val));
    return () => entries.forEach(([k]) => root.style.removeProperty(k));
  }, [key]);
  return <div style={vars as CSSProperties} className="contents">{children}</div>;
}

export function BrandLogo({ src, name, className }: { src: string | null | undefined; name: string; className?: string }) {
  if (!src) return null;
  return <img src={src} alt={`Logo ${name}`} className={className ?? "h-10 w-10 rounded-md object-contain"} />;
}

/** Redimensionne une image choisie en PNG compact (data URL) pour le logo. */
export function fileToLogo(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/png"));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
