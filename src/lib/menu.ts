// Catalogue Wok & Sushi — source unique des prix (client + serveur)

export type Choice = { id: string; label: string; price?: number };
export type OptionGroup = {
  id: string;
  label: string;
  min: number;
  max: number;
  included?: number; // nb de choix compris dans le prix
  extraPrice?: number; // prix par choix au-delà de "included"
  choices: Choice[];
};
export type MenuItem = {
  id: string;
  name: string;
  desc?: string;
  price: number;
  tag?: string;
  options?: OptionGroup[];
  builder?: boolean; // configurateur étape par étape
  hidden?: boolean; // masqué (rupture / indisponible)
  allergens?: string[]; // ids des 14 allergènes INCO (src/lib/allergens.ts)
};
export type Category = { id: string; label: string; note?: string; items: MenuItem[] };

const accomp = (n: number, list = ["Salade chou", "Salade okame", "Riz nature", "Riz vinaigré"]): OptionGroup => ({
  id: "accomp",
  label: n > 1 ? `${n} accompagnements au choix` : "Accompagnement au choix",
  min: n,
  max: n,
  choices: list.map((l) => ({ id: slug(l), label: l })),
});
const meat = (list: string[]): OptionGroup => ({
  id: "viande",
  label: "Viande au choix",
  min: 1,
  max: 1,
  choices: list.map((l) => ({ id: slug(l), label: l })),
});
function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
const list = (prefix: string, rows: [string, number, string?][]): MenuItem[] =>
  rows.map(([name, price, desc]) => ({ id: `${prefix}-${slug(name)}`, name, price, ...(desc ? { desc } : {}) }));

const VEG_MEATS = ["Végétarien", "Poulet", "Poulet katsu", "Bœuf", "Crevettes"];
const SAUCES: Choice[] = [
  { id: "maison", label: "Sauce maison" },
  { id: "coco", label: "Sauce coco", price: 2 },
  { id: "epicee", label: "Sauce épicée" },
  { id: "soja-sale", label: "Sauce soja salé" },
  { id: "pad-thai", label: "Sauce pad thaï" },
  { id: "lok-lak", label: "Sauce lok lak" },
  { id: "sweety", label: "Sauce sweety" },
  { id: "soja-sucre", label: "Sauce soja sucrée" },
];

export const CATEGORIES: Category[] = [
  {
    id: "compose-wok",
    label: "Compose ton wok",
    note: "Choisis ta base, tes viandes, tes légumes, ta sauce — c'est toi le chef.",
    items: [
      {
        id: "wok-compose",
        name: "Compose ton wok",
        desc: "1 base, 1 viande, 3 légumes, 1 sauce et 1 topping compris.",
        price: 12.9,
        builder: true,
        tag: "Signature",
        options: [
          { id: "base", label: "1. Choisis ta base", min: 1, max: 1, choices: [
            { id: "nouilles", label: "Nouilles classiques" }, { id: "riz-thai", label: "Riz thaï" },
            { id: "udon", label: "Udon" }, { id: "nouille-riz", label: "Nouilles de riz" } ] },
          { id: "viandes", label: "2. Choisis tes viandes", min: 1, max: 3, included: 1, extraPrice: 3.9, choices: [
            { id: "poulet", label: "Poulet" }, { id: "boeuf", label: "Bœuf" }, { id: "crevettes", label: "Crevettes" } ] },
          { id: "legumes", label: "3. Choisis tes légumes", min: 3, max: 6, included: 3, extraPrice: 1.5, choices: [
            { id: "oignons", label: "Oignons" }, { id: "poivrons", label: "Poivrons" }, { id: "courgettes", label: "Courgettes" },
            { id: "carottes", label: "Carottes" }, { id: "champignons", label: "Champignons" }, { id: "brocoli", label: "Brocoli" } ] },
          { id: "sauces", label: "4. Choisis ta sauce", min: 1, max: 3, included: 1, extraPrice: 1, choices: SAUCES },
          { id: "toppings", label: "5. Choisis tes toppings", min: 0, max: 4, included: 1, extraPrice: 0.9, choices: [
            { id: "sesame", label: "Graines de sésame" }, { id: "cacahuetes", label: "Cacahuètes" },
            { id: "coriandre", label: "Coriandre" }, { id: "oignons-frits", label: "Oignons frits" } ] },
        ],
      },
    ],
  },
  {
    id: "signatures",
    label: "Woks signatures",
    items: [
      { id: "sig-beef-lok-lak", name: "Beef Lok Lak", price: 10.9, desc: "Riz sauce tomate, mélange de légumes, œuf, émincé de bœuf sauce maison" },
      { id: "sig-chicken-thai", name: "Chicken Thaï", price: 11.9, desc: "Riz thaï sauté, émincé de poulet, légumes, œuf, sauce sucre salé" },
      { id: "sig-honey-chicken", name: "Honey Chicken", price: 10.9, desc: "Riz thaï, légumes, émincé de poulet sauce miel gingembre maison" },
      { id: "sig-katsu-coco", name: "Katsu Coco", price: 10.9, desc: "Riz thaï, filet de poulet pané maison, oignons frits", options: [
        { id: "sauce", label: "Sauce au choix", min: 1, max: 1, choices: [{ id: "coco", label: "Crème coco" }, { id: "curry", label: "Curry" }] } ] },
      { id: "sig-salmon-wok", name: "Salmon Wok", price: 12.9, desc: "Riz thaï, légumes, saumon, ciboulette, citron, sauce maison" },
      { id: "sig-poulet-korma", name: "Indien Poulet Korma", price: 12.9, desc: "Spécialité du Bengale, sauce oignon, pistache, amande, yaourt et crème" },
      { id: "sig-boeuf-pane", name: "Bœuf Pané", price: 12.9, desc: "Riz thaï, bœuf pané, légumes, sauce teriyaki" },
      { id: "sig-coco-cream", name: "Coco Cream / Coco Échalote", price: 10.9, desc: "Riz thaï, légumes, sauce coco, oignons frits, ciboulette", options: [meat(VEG_MEATS)] },
      { id: "sig-aloco-wok", name: "Aloco Wok", price: 10.9, desc: "Riz thaï, légumes, émincé de bœuf poivron, oignons, banane plantain" },
      { id: "sig-hot-spicy", name: "Hot Spicy", price: 10.9, desc: "Nouilles chinoises, légumes, émincé de poulet, sauce épicée" },
      { id: "sig-chicken-sweet", name: "Chicken Sweet", price: 10.9, desc: "Riz thaï, légumes, émincé de poulet, sauce épicée maison" },
      { id: "sig-singapore-wok", name: "Singapore Wok", price: 10.9, desc: "Nouilles chinoises, légumes, crevettes, ciboulette, citron" },
      { id: "sig-pekin-wok", name: "Pékin Wok", price: 10.9, desc: "Nouilles chinoises, légumes, sauce maison", options: [meat(VEG_MEATS)] },
      { id: "sig-pad-thai", name: "Pad Thaï", price: 10.9, desc: "Nouilles de riz, légumes, œuf, sauce maison", options: [meat(VEG_MEATS)] },
      { id: "sig-udon-wok", name: "Udon Wok", price: 10.9, desc: "Nouilles udon, légumes, bœuf, sauce soja maison" },
    ],
  },
  {
    id: "midi",
    label: "Menus midi",
    note: "Du lundi au vendredi de 12h à 14h30 — 13,90 € + 1 accompagnement",
    items: [
      ...([
        ["Midi Saumon", "12 pcs · 2 sushi saumon, 2 sashimi saumon, 8 california saumon avocat"],
        ["Midi Mix 1", "12 pcs · 8 crispy thon cuit cheese, 2 yakitori saumon, 2 gyoza poulet"],
        ["Midi Mix 2", "13 pcs · 3 gyoza poulet, 6 rainbow saumon cheese, 4 crispy thon cuit"],
        ["Midi Katsu", "3 gyoza légumes, riz nature, poulet pané sauce coco"],
        ["Midi Tempura Roll", "12 pcs · 2 gyoza poulet, 10 crevette tempura avocat cheese"],
        ["Little Mix", "12 pcs · 8 spring roll saumon avocat, 4 rainbow saumon cheese"],
        ["Little Tempura", "12 pcs · 4 crispy crevette tempura, 8 california crevette tempura chili mayo"],
        ["Little Sushi", "6 sushi saumon"],
        ["Little Yakitori", "Riz nature, yakitori poulet ou bœuf cheese, sauce coco crème maison"],
      ] as [string, string][]).map(([name, desc]) => ({ id: `midi-${slug(name)}`, name, desc, price: 13.9, options: [accomp(1)] })),
      { id: "midi-chirachi-saumon-avocat", name: "Chirachi Saumon Avocat", price: 15.9, desc: "14 petites tranches, riz vinaigré, saumon" },
      { id: "midi-box-wok-sushi", name: "Box Wok & Sushi", price: 18.9, desc: "2 yakitori poulet ou bœuf cheese, 1 california saumon avocat, 2 gyoza poulet, 2 gyoza légumes + boisson" },
    ],
  },
  {
    id: "plateaux",
    label: "Plateaux",
    items: [
      { id: "pl-love-1", name: "Plateau Love 1", price: 39.9, desc: "36 pcs · 8 spring saumon cheese, 8 crispy thon cuit avocat, 8 california crevette tempura chili mayo, 4 sushi, 8 sashimi saumon, 2 boissons", options: [accomp(2, ["Salade chou", "Riz vinaigré"])] },
      { id: "pl-love-2", name: "Plateau Love 2", price: 39.9, desc: "27 pcs · 6 rainbow cheese, 8 spring thon cuit cheese, 8 crispy saumon fromage, yakitoris, 2 boissons", options: [accomp(2, ["Salade chou", "Riz vinaigré"])] },
      ...([
        ["Classique", "19 pcs · 6 maki saumon, 8 california saumon avocat, 2 sushi, 3 sashimi saumon"],
        ["Veggie", "16 pcs · 8 spring roll thon cuit avocat, 6 maki avocat cheese, 1 salade"],
        ["Cheese", "19 pcs · 3 rainbow avocat cheese, 8 crispy poulet pané chili mayo, 8 california saumon"],
        ["Mix", "11 pcs · 8 spring saumon, 1 tartare saumon, 2 yakitori poulet"],
        ["Tempura", "15 pcs · 4 gyoza poulet, 8 california poulet pané, 3 ebi-fry"],
        ["Jeanne d'Arc", "14 pcs · 8 spring poulet mayo, 4 gyoza poulet, 2 yakitori bœuf fromage"],
      ] as [string, string][]).map(([name, desc]) => ({ id: `pl-${slug(name)}`, name: `Plateau ${name}`, desc, price: 18.9, options: [accomp(2, ["Salade chou", "Salade okame"])] })),
      { id: "pl-crispy", name: "Plateau Crispy (24 pcs)", price: 25.9, desc: "2 pers. · poulet pané chili mayo, saumon avocat, thon cuit cheese, poulet algérien cheese", options: [accomp(1, ["Salade chou", "Riz vinaigré"])] },
      { id: "pl-california", name: "Plateau California (24 pcs)", price: 24.9, desc: "2 pers. · saumon avocat, saumon cheese, thon cuit cheese, poulet mayo", options: [accomp(1, ["Salade chou", "Riz vinaigré"])] },
      { id: "pl-saumon", name: "Plateau Saumon (24 pcs)", price: 25.9, desc: "2 pers. · california, spring, maki, sushi et sashimi saumon", options: [accomp(1, ["Salade chou", "Riz vinaigré"])] },
      { id: "pl-maki", name: "Plateau Maki (24 pcs)", price: 22.9, desc: "2 pers. · saumon cheese, thon cuit mayo, avocat mayo, poulet pané chili mayo", options: [accomp(1, ["Salade chou", "Riz vinaigré"])] },
      { id: "pl-fried", name: "Plateau Fried (24 pcs)", price: 25.9, desc: "Crevette tempura avocat cheese, poulet pané avocat cheese, saumon avocat cheese", options: [accomp(1)] },
      { id: "pl-family", name: "Plateau Family (48 pcs)", price: 58, desc: "10 dragon roll, 6 rainbow, 6 spring roll, 6 maki, 6 sushi, 6 california saumon, 8 california tempura + Coca 1,25 L", options: [accomp(3)] },
    ],
  },
  { id: "california", label: "California x8", items: list("cal", [
    ["Saumon avocat", 7.5], ["Saumon cheese", 7.5], ["Avocat cheese", 7], ["Crevettes tempura chili mayo", 7.9], ["Thon cuit cheese", 7.5],
    ["Saumon cuit avocat", 7.9], ["Chèvre miel", 7.9], ["Thon cuit avocat mayo", 7.5], ["Poulet pané chili mayo", 7.5], ["Saumon fumé", 7.9] ]) },
  { id: "crispy", label: "Crispy x8", items: list("cri", [
    ["Saumon fumé cheese", 7.9], ["Chèvre miel", 7.9], ["Saumon avocat", 7.5], ["Saumon cuit cheese", 7.9], ["Poulet algérien cheese", 7.9],
    ["Poulet curry mayo", 7.9], ["Crevette tempura chili mayo", 7.5], ["Poulet pané chili mayo", 7.5], ["Saumon fine", 7.5] ]) },
  { id: "maki", label: "Maki x8", items: list("mak", [
    ["Saumon", 5.9], ["Saumon cuit mayo", 5.9], ["Avocat cheese", 5.9], ["Concombre", 5.9], ["Thon cuit mayo", 5.9], ["Crevette mayo", 5.9] ]) },
  { id: "flocon", label: "Flocon x8", items: list("flo", [
    ["Saumon avocat", 7], ["Saumon cheese", 7], ["Saumon fines herbes", 7], ["Poulet pané cheese", 7], ["Poulet mayo", 7], ["Thon cuit mayo", 7.5], ["Chèvre miel", 7.5] ]) },
  { id: "rainbow", label: "Rainbow x8", items: list("rai", [
    ["Saumon avocat", 8.5], ["Saumon cheese", 8.5], ["Saumon fine", 8.5], ["Thon cuit avocat", 8.5], ["Saumon fumé cheese", 8.5], ["Chèvre miel", 8.5] ]) },
  { id: "spring", label: "Spring rolls x8", items: list("spr", [
    ["Saumon avocat", 7.5], ["Thon cuit mayo fines herbes", 7.5], ["Chèvre miel", 7.5], ["Saumon fumé cheese", 7.5], ["Crevette mangue avocat", 7.5] ]) },
  { id: "rolls", label: "Fried & Dragon rolls x10", items: [
    ...list("fri", [["Fried cali saumon", 13.9, "Avocat cheese"], ["Fried tempura crevette chili mayo", 13.9, "Avocat cheese"], ["Fried poulet pané chili mayo", 13.9, "Avocat cheese"]]),
    ...list("dra", [["Dragon crevette tempura", 13.9, "Avocat cheese saumon"], ["Dragon poulet pané chili mayo", 13.9, "Avocat cheese saumon"]]),
  ] },
  { id: "sushi", label: "Sushi, sashimi & chirashi", items: [
    ...list("sus", [["Sushi saumon x5", 9.9], ["Sushi saumon fines herbes x5", 9.9], ["Sushi saumon avocat x5", 9.9], ["Sushi crevettes x5", 9.9]]),
    ...list("sas", [["Sashimi saumon x10", 13.9, "Accompagné de riz vinaigré"], ["Sashimi saumon x5", 8.9, "Accompagné de riz vinaigré"], ["Tataki saumon x10", 14.9, "Accompagné de riz vinaigré"]]),
    ...list("chi", [["Chirashi saumon avocat", 16.9], ["Chirashi saumon", 17.9], ["Chirashi tataki saumon avocat", 18.9]]),
  ] },
  {
    id: "poke",
    label: "Poké bowls",
    items: [
      ...([["Saumon cuit ou saumon tartare", "Riz vinaigré, saumon"], ["Crevette sautée", "Riz vinaigré, crevettes sautées"], ["Crevette tempura", "Riz vinaigré, crevettes tempura"],
        ["Thon saumon", "Riz vinaigré, thon, saumon"], ["Bœuf pané", "Riz vinaigré, bœuf pané"], ["Thon cuit", "Riz vinaigré, thon cuit"]] as [string, string][])
        .map(([n, d]) => ({ id: `poke-${slug(n)}`, name: `Poké ${n}`, price: 15.9, desc: `${d}, concombre, avocat, edamame, tomate cerise, salade wakamé, mangue` })),
      {
        id: "poke-compose", name: "Compose ton poké", price: 7.9, builder: true, desc: "Base 7,90 € + ingrédients (minimum 3)",
        options: [
          { id: "base", label: "1. Base", min: 1, max: 1, choices: [{ id: "riz-nature", label: "Riz nature" }, { id: "riz-vinaigre", label: "Riz vinaigré" }, { id: "salade-choux", label: "Salade de choux" }] },
          { id: "proteines", label: "2. Protéines (3,90 € chacune)", min: 0, max: 3, choices: ["Saumon", "Thon", "Daurade", "Thon cuit", "Crevette", "Beignet de crevette", "Beignet de poulet", "Nem"].map((l) => ({ id: slug(l), label: l, price: 3.9 })) },
          { id: "garnitures", label: "3. Garnitures (1,50 € chacune)", min: 0, max: 10, choices: ["Avocat", "Concombre", "Edamame", "Wakamé", "Chou blanc", "Carotte", "Betterave", "Mangue", "Tomate cerise", "Ananas"].map((l) => ({ id: slug(l), label: l, price: 1.5 })) },
        ],
      },
    ],
  },
  { id: "salades", label: "Salades", items: list("sal", [
    ["Salade thaï poulet sauté", 14.9], ["Salade bœuf", 12.9], ["Salade bœuf pané", 12.9], ["Salade poulet pané", 12.9], ["Salade poulet", 12.9],
    ["Salade crevette tempura", 12.9], ["Salade crevette sautée", 12.9], ["Salade saumon cuit", 12.9], ["Salade nems", 12.9] ]) },
  { id: "curry", label: "Japanese curry", note: "Base de riz parfumé sésame et sauce avec légumes", items: list("cur", [
    ["Poulet curry", 13.9], ["Bœuf curry", 13.9], ["Crevettes curry", 13.9], ["Végé (tofu) curry", 13.9], ["Curry chicken katsu", 13.9], ["Curry crevettes tempura", 14.9] ]) },
  { id: "ramen", label: "Ramens", note: "Pousses de bambou, champignons, champignons noirs, ciboulette, œuf", items: list("ram", [
    ["Ramen bœuf", 12.9], ["Ramen poulet", 12.9], ["Ramen crevettes", 12.9], ["Ramen végé (tofu)", 13.9], ["Ramen chicken katsu", 13.9], ["Ramen crevettes tempura", 14.9] ]) },
  {
    id: "street",
    label: "Wraps & Korean chicken",
    items: [
      { id: "wrap", name: "Wrap sandwich + canette", price: 9.9, desc: "Salade, avocat, fromage, sauce maison + riz vinaigré", options: [
        { id: "garniture", label: "Garniture", min: 1, max: 1, choices: ["Poulet pané", "Crevettes tempura", "Saumon cuit", "Bœuf sauté", "Poulet sauté", "Crevettes sautées"].map((l) => ({ id: slug(l), label: l })) } ] },
      { id: "kfc-5", name: "Korean fried chicken 5 pcs", price: 6.9, desc: "Poulet frit coréen" },
      { id: "kfc-menu", name: "Menu Korean chicken", price: 14.9, desc: "Riz nature + 8 pièces + canette" },
    ],
  },
  { id: "entrees", label: "Entrées & accompagnements", items: [
    ...list("ent", [["Beignets de crevettes x4", 6.5], ["Nems poulet x4", 6.5], ["Nems crevette x4", 6.9], ["Samoussas poulet x4", 6.5], ["Samoussas bœuf x4", 6.5],
      ["Samoussas légumes x4", 6.5], ["Gyoza poulet x5", 6.5], ["Gyoza crevette x5", 6.5], ["Gyoza légumes x5", 6.5], ["Crevette dynamique x6", 8.5],
      ["Fried mix", 18.9, "4 nems poulet, 4 gyoza légumes, 4 samoussas bœuf"], ["Riz nature", 3], ["Riz vinaigré", 3.9], ["Salade de choux", 3.9], ["Salade de choux saumon", 4.5], ["Salade wakamé", 4.5]]),
    { id: "ent-soupe-maison", name: "Soupe maison", price: 4.5, options: [{ id: "parfum", label: "Au choix", min: 1, max: 1, choices: [{ id: "poulet", label: "Poulet" }, { id: "crevette", label: "Crevette" }, { id: "saumon", label: "Saumon" }] }] },
  ] },
  { id: "desserts", label: "Desserts", items: list("des", [
    ["Mochi glacé mangue x2", 5.9], ["Mochi glacé vanille x2", 5.9], ["Mochi glacé litchi x2", 5.9], ["Maki Nutella x6", 6.9], ["Maki Nutella banane x6", 7.5],
    ["Fondant chocolat", 4.9], ["Tiramisu café", 4.9], ["Tarte au daim", 4], ["Litchi x10", 6.9] ]) },
  { id: "boissons", label: "Boissons", items: [
    { id: "bois-canette", name: "Canette 33 cl", price: 2, options: [{ id: "choix", label: "Au choix", min: 1, max: 1, choices: ["Coca-Cola", "Coca Zéro", "Ice Tea", "Orangina", "Oasis"].map((l) => ({ id: slug(l), label: l })) }] },
    { id: "bois-ramune", name: "Ramune", price: 3.5, desc: "Limonade japonaise", options: [{ id: "parfum", label: "Parfum", min: 1, max: 1, choices: ["Blueberry", "Melon", "Plain", "Pineapple", "Strawberry"].map((l) => ({ id: slug(l), label: l })) }] },
    { id: "bois-coca-125", name: "Coca-Cola 1,25 L", price: 3.9 },
    { id: "bois-eau", name: "Eau 50 cl", price: 1.5 },
  ] },
];

export const ITEMS_BY_ID: Record<string, MenuItem | undefined> = Object.fromEntries(
  CATEGORIES.flatMap((c) => c.items.map((i) => [i.id, i])),
);

export type Selections = Record<string, string[]>; // groupId -> choiceIds

export function groupCost(g: OptionGroup, picked: string[]) {
  let cost = 0;
  for (const id of picked) cost += g.choices.find((c) => c.id === id)?.price ?? 0;
  if (g.included !== undefined && g.extraPrice) cost += Math.max(0, picked.length - g.included) * g.extraPrice;
  return cost;
}

export function validateSelections(item: MenuItem, sel: Selections): string | null {
  for (const g of item.options ?? []) {
    const picked = sel[g.id] ?? [];
    if (picked.some((id) => !g.choices.find((c) => c.id === id))) return `Choix invalide : ${g.label}`;
    if (new Set(picked).size !== picked.length) return `Choix en double : ${g.label}`;
    if (picked.length < g.min) return `${g.label} : ${g.min} choix minimum`;
    if (picked.length > g.max) return `${g.label} : ${g.max} choix maximum`;
  }
  if (item.id === "poke-compose") {
    const n = (sel["proteines"]?.length ?? 0) + (sel["garnitures"]?.length ?? 0);
    if (n < 3) return "Compose ton poké : 3 ingrédients minimum";
  }
  return null;
}

export function unitPrice(item: MenuItem, sel: Selections) {
  let p = item.price;
  for (const g of item.options ?? []) p += groupCost(g, sel[g.id] ?? []);
  return Math.round(p * 100) / 100;
}

export function describeSelections(item: MenuItem, sel: Selections): string[] {
  return (item.options ?? [])
    .filter((g) => (sel[g.id] ?? []).length)
    .map((g) => `${g.label.replace(/^\d\.\s*/, "")} : ${(sel[g.id] ?? []).map((id) => g.choices.find((c) => c.id === id)?.label).join(", ")}`);
}

export const euro = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
