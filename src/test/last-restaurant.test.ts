import { describe, expect, it } from "vitest";
import { automaticRestaurant, rememberLastRestaurant } from "@/lib/last-restaurant";

const first = { slug: "woknsushi", role: "manager" };
const second = { slug: "best-food", role: "manager" };

describe("choix de cuisine sur /espace", () => {
  it("garde la liste pour plusieurs restaurants malgré un dernier restaurant mémorisé", () => {
    rememberLastRestaurant(first.slug);
    expect(automaticRestaurant([first, second], false)).toBeNull();
  });
  it("garde la liste pour l'agence même avec un seul restaurant mémorisé", () => {
    rememberLastRestaurant(first.slug);
    expect(automaticRestaurant([first], true)).toBeNull();
  });
  it("garde la liste pour un restaurant accessible avec le rôle agence", () => {
    expect(automaticRestaurant([{ ...first, role: "agency" }], false)).toBeNull();
  });
  it("ouvre directement l'unique restaurant d'un compte non-agence", () => {
    expect(automaticRestaurant([first], false)).toEqual(first);
  });
  it("ne redirige pas sans restaurant accessible", () => {
    expect(automaticRestaurant([], false)).toBeNull();
  });
});