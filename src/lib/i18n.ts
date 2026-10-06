import { useEffect, useState } from "react";
import type { Category, MenuItem } from "./menu";

/** Langues étrangères proposées ; le français est la langue source de la carte. */
export const FOREIGN_LANGS = ["en", "es", "de"] as const;
export type ForeignLang = (typeof FOREIGN_LANGS)[number];
export type Lang = "fr" | ForeignLang;
export const LANG_LABELS: Record<Lang, string> = { fr: "FR", en: "EN", es: "ES", de: "DE" };
export const LANG_NAMES: Record<ForeignLang, string> = { en: "Anglais", es: "Espagnol", de: "Allemand" };

/** Traduction d'un plat, stockée avec le plat (aucun appel de traduction à l'affichage). */
export type ItemTranslation = { name: string; description?: string | undefined };
export type ItemTranslations = Partial<Record<ForeignLang, ItemTranslation>>;
export type LabelTranslations = Partial<Record<ForeignLang, string>>;

const KEY = "lc-menu-lang";
const isLang = (v: unknown): v is Lang => v === "fr" || FOREIGN_LANGS.includes(v as ForeignLang);

/** Langue choisie par le client, mémorisée sur l'appareil (lue après hydratation : pas de décalage serveur/client). */
export function useMenuLang(): [Lang, (l: Lang) => void] {
  const [lang, setLang] = useState<Lang>("fr");
  useEffect(() => { const s = localStorage.getItem(KEY); if (isLang(s)) setLang(s); }, []);
  return [lang, (l) => { setLang(l); localStorage.setItem(KEY, l); document.documentElement.lang = l; }];
}

export function itemText(i: MenuItem, lang: Lang): { name: string; desc?: string | undefined } {
  const t = lang === "fr" ? undefined : i.translations?.[lang];
  return { name: t?.name || i.name, desc: t?.description || i.desc };
}
export const catLabel = (c: Category, lang: Lang) => (lang === "fr" ? c.label : c.translations?.[lang] || c.label);

/** Plats dont une langue manque : seuls ceux-là sont envoyés à la pré-traduction. */
export function missingTranslations(menu: Category[]) {
  const items = menu.flatMap((c) => c.items).filter((i) => FOREIGN_LANGS.some((l) => !i.translations?.[l]?.name));
  const cats = menu.filter((c) => FOREIGN_LANGS.some((l) => !c.translations?.[l]));
  return { items, cats };
}

export const UI: Record<Lang, { allergies: string; add: string; options: string; compose: string; soon: string }> = {
  fr: { allergies: "Allergies ? Masquer les plats contenant…", add: "+ Ajouter", options: "Choisir les options →", compose: "Composer →", soon: "La carte arrive bientôt." },
  en: { allergies: "Allergies? Hide dishes containing…", add: "+ Add", options: "Choose options →", compose: "Build →", soon: "The menu is coming soon." },
  es: { allergies: "¿Alergias? Ocultar platos que contienen…", add: "+ Añadir", options: "Elegir opciones →", compose: "Componer →", soon: "La carta llegará pronto." },
  de: { allergies: "Allergien? Gerichte ausblenden mit…", add: "+ Hinzufügen", options: "Optionen wählen →", compose: "Zusammenstellen →", soon: "Die Speisekarte folgt in Kürze." },
};
