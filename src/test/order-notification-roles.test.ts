import { describe, expect, it } from "vitest";
import { notificationRecipients } from "@/lib/order-notification-roles";

const base = { enabled: true, team: true, agency: true, fallback: "resto@x.fr", agencyEmails: ["agence@x.fr"] };
describe("destinataires des commandes", () => {
  it("livreur reçoit seulement les livraisons par défaut", () => {
    const members = [{ email: "liv@x.fr", roles: ["livreur"] }];
    expect(notificationRecipients({ ...base, mode: "delivery", members })).toContain("liv@x.fr");
    expect(notificationRecipients({ ...base, mode: "pickup", members })).not.toContain("liv@x.fr");
  });
  it("responsable et caissier reçoivent tous les modes, agence en copie", () => {
    const r = notificationRecipients({ ...base, mode: "dine_in", members: [{ email: "resp@x.fr", roles: ["responsable"] }, { email: "cai@x.fr", roles: ["caissier"] }] });
    expect(r).toEqual(["resto@x.fr", "resp@x.fr", "cai@x.fr", "agence@x.fr"]);
  });
  it("les cases décochées excluent le mode", () => {
    const members = [{ email: "cai@x.fr", roles: ["caissier"], modes: ["pickup"] }];
    expect(notificationRecipients({ ...base, mode: "delivery", members })).not.toContain("cai@x.fr");
    expect(notificationRecipients({ ...base, mode: "pickup", members })).toContain("cai@x.fr");
  });
  it("copie agence désactivable et doublons retirés", () => {
    expect(notificationRecipients({ ...base, agency: false, mode: "pickup", members: [{ email: "RESTO@x.fr", roles: ["caissier"] }] })).toEqual(["resto@x.fr"]);
  });
  it("plusieurs adresses directes ciblées, désactivation et absence de repli après suppression", () => {
    expect(notificationRecipients({ ...base, team: false, agency: false, mode: "delivery", members: [], recipients: [
      { email: "a@x.fr", enabled: true, modes: ["delivery"] },
      { email: "b@x.fr", enabled: true, modes: ["delivery", "pickup"] },
      { email: "off@x.fr", enabled: false, modes: ["delivery"] },
      { email: "pickup@x.fr", enabled: true, modes: ["pickup"] },
    ] })).toEqual(["a@x.fr", "b@x.fr"]);
    expect(notificationRecipients({ ...base, team: false, agency: false, mode: "delivery", members: [], recipients: [] })).toEqual([]);
  });
});