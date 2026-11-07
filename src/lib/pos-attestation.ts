import type { LegalInfo } from "./legal";
import { POS_INTEGRITY_VERSION } from "./pos-integrity";
export const BOFIP_ATTESTATION_URL = "https://bofip.impots.gouv.fr/bofip/10692-PGP.html/identifiant%3DBOI-LETTRE-000242-20260325";
/** Unexecuted model, never a statement that the current software is compliant. */
export function attestationDraft(r: { name: string; address: string | null; legal: LegalInfo | null }): string[] {
  return [
    "PROJET NON SIGNÉ — NE VAUT PAS ATTESTATION INDIVIDUELLE DE L’ÉDITEUR",
    "Modèle BOI-LETTRE-000242 du 25/03/2026 — à valider avant signature.",
    "Conformité non établie : contrôles de conservation, clôtures journalières/mensuelles/annuelles, archivage avec date certaine et validation du périmètre restent à finaliser. Ce projet ne doit pas être présenté comme justificatif au contrôle fiscal.",
    `Entreprise utilisatrice : ${r.legal?.company || r.name}`,
    `Enseigne : ${r.name} — SIRET : ${r.legal?.siret || "[À renseigner]"}`,
    `Adresse : ${r.address || "[À renseigner]"}`,
    `Version technique du socle : ${POS_INTEGRITY_VERSION}. Ce numéro n’identifie pas encore une version commerciale validée du logiciel.`,
    "Les volets 1 et 2 doivent être présentés à l’administration fiscale en cas de contrôle. L’attestation n’a de valeur que si son volet 2 est dûment complété et signé par l’entreprise utilisatrice du logiciel / système.",
    "I. VOLET 1 — À REMPLIR ET VALIDER PAR L’ÉDITEUR OU INTÉGRATEUR",
    "Texte du modèle ci-dessous, non souscrit et non signé :",
    "Je soussigné, [NOM Prénom], représentant légal de la société [RAISON SOCIALE EXACTE DE L’ÉDITEUR], éditeur du logiciel / système de caisse [LC Digitale — caisse comptoir ; références commerciales à valider], atteste que ce logiciel/système OU les fonctionnalités de caisse de ce logiciel/système (1), mis sur le marché à compter du [DATE À RENSEIGNER], dans sa version n° [VERSION COMMERCIALE VALIDÉE À RENSEIGNER], sous le numéro de licence [SI APPLICABLE] (2), satisfait OU satisfont aux conditions d’inaltérabilité, de sécurisation, de conservation et d’archivage des données en vue du contrôle de l’administration fiscale, prévues au 3° bis du I de l’article 286 du code général des impôts.",
    "[J’atteste que la dernière version majeure de ce logiciel ou système est identifiée avec la racine suivante : [XXX] et que les versions mineures développées ultérieurement à cette version majeure sont ou seront identifiées par les subdivisions suivantes de cette racine : [XXX-aaa]. Je m’engage à ce que ces subdivisions ne soient utilisées par [RAISON SOCIALE de l’éditeur] que pour l’identification des versions mineures ultérieures, à l’exclusion de toute version majeure. Les versions majeures et mineures du logiciel ou système s’entendent au sens du III-A § 340 du BOI-TVA-DECLA-30-10-30.] (3)",
    "Périmètre couvert : [À valider — fonctionnalités de caisse comptoir uniquement envisagées].",
    "Fonctionnalités non couvertes : [À compléter — autres canaux, banque et facturation non validés].",
    "Fait à [VILLE], le [DATE]. Signature du représentant légal de l’éditeur : [NON SIGNÉ].",
    "(1) À adapter et compléter selon le cas. (2) Quand il existe une licence. (3) Mention facultative pour la tolérance du III-B § 380 du BOI-TVA-DECLA-30-10-30.",
    "II. VOLET 2 — À REMPLIR PAR L’ENTREPRISE UTILISATRICE",
    `Je soussigné, [NOM Prénom], représentant légal de la société [${r.legal?.company || r.name} — raison sociale à confirmer], certifie avoir acquis ou téléchargé le [DATE], auprès de [RAISON SOCIALE du distributeur], le logiciel / système de caisse mentionné au volet 1 de cette attestation.`,
    "J’atteste utiliser ce logiciel / système de caisse pour enregistrer les règlements de mes clients particuliers, conformément à la réglementation fiscale en vigueur, depuis le [DATE].",
    "Fait à [VILLE], le [DATE]. Signature du représentant légal : [NON SIGNÉ].",
    "Remarque pour chacun des deux volets : l’établissement d’une fausse attestation est un délit pénal passible de trois ans d’emprisonnement et de 45 000 € d’amende (code pénal, art. 441-1). L’usage d’une fausse attestation est passible des mêmes peines.",
    `Source officielle : ${BOFIP_ATTESTATION_URL}`,
  ];
}