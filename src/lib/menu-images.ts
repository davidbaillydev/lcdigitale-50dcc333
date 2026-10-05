// Editorial illustrations by menu family; not photographs of individual recipes.
import wok from "@/assets/food-wok.jpg";
import sushi from "@/assets/food-sushi.jpg";
import plateau from "@/assets/food-plateau.jpg";
import poke from "@/assets/food-poke.jpg";
import ramen from "@/assets/food-ramen.jpg";
import curry from "@/assets/food-curry.jpg";
import chicken from "@/assets/food-chicken.jpg";
import entree from "@/assets/food-entree.jpg";
import dessert from "@/assets/food-dessert.jpg";

const images: Record<string, string> = {
  "compose-wok": wok, signatures: wok, midi: plateau, plateaux: plateau,
  california: sushi, crispy: sushi, maki: sushi, flocon: sushi,
  rainbow: sushi, spring: sushi, rolls: sushi, sushi,
  poke, salades: poke, curry, ramen, street: chicken,
  entrees: entree, desserts: dessert,
};

export function menuImage(categoryId: string) {
  return images[categoryId];
}

/** Photo du plat si le restaurant en a une ; sinon illustration de sa famille. */
export function itemImage(item: { id: string; image?: string }, categories: { id: string; items: { id: string }[] }[]) {
  if (item.image) return { src: item.image, real: true };
  const category = categories.find((c) => c.items.some((i) => i.id === item.id));
  const src = category ? menuImage(category.id) : undefined;
  return src ? { src, real: false } : undefined;
}