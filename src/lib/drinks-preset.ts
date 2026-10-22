// Liste de boissons prête à l'emploi pour la carte (sélection en un clic dans le back-office).
export const PRESET_DRINKS: { id: string; name: string; price: number }[] = [
  "Coca Cherry", "Coca-Cola", "Coca Zéro", "Sprite", "Fanta Dragon", "Fanta Citron", "Fanta Orange",
  "Perrier", "Lipton", "Oasis Tropical", "Oasis Pomme Cassis", "Cristaline", "Orangina", "Tropico",
  "Hawaï", "Pepsi", "7Up Mojito", "7Up Citron", "7Up Cherry", "7Up Cocktail", "Ice Tea", "Fuze Tea",
  "Schweppes", "Dada Fraise", "Dada Melon", "Dada Litchi", "Dada Mangue", "Capri-Sun",
].map((name) => ({ id: slug(name), name, price: 2 }))
  .concat([{ id: "drink-coca-cola-1-5l", name: "Coca-Cola 1,5 L", price: 4 }, { id: "drink-lipton-1-5l", name: "Lipton 1,5 L", price: 4 }]);

function slug(n: string) {
  return "drink-" + n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
