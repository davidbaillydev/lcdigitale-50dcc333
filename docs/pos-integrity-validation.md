# Socle d’inaltérabilité — périmètre et limites

## Disponible
- Tickets caisse comptoir chaînés SHA-256 par restaurant, transactionnellement avec leur numérotation ; empreinte précédente, identité, horodatage serveur, lignes, règlements, remise et TVA figés.
- Empreinte de contrôle courte sur ticket HTML et ESC/POS. Ce n’est pas une signature électronique.
- JET chaîné, append-only : ventes, remises, ouvertures, clôtures Z, annulations, mouvements, changements des réglages, contrôles d’intégrité en échec et archives. Les tentatives refusées dans une transaction annulée ne peuvent pas laisser un événement dans cette même transaction.
- Réglages : empreintes avant/après et champs modifiés, sans recopier les secrets dans le journal. Les écritures par client privilégié sont explicitement non attribuées si elles n’ont pas d’identité utilisateur authentifiée ; elles ne sont pas faussement imputées à un compte.
- Export JSON UTF-8 documenté en français ; empreinte globale séparée, archive conservée immuable en base et retéléchargeable. Snapshot atomique, sans purge. JET et reçus vérifiés avant export ; anomalies journalisées et export bloqué.
- Projet individuel de document BOFiP en deux volets, prérempli avec les informations juridiques disponibles, explicitement non signé et sans valeur d’attestation.
- Historique antérieur conservé séparément, non rétroactivement chaîné. Aucune modification des prix ou des ventes passées.

## Ne vaut pas conformité fiscale établie
Restent nécessaires : audit complet des quatre conditions légales et du périmètre/version, clôtures quotidiennes/mensuelles/annuelles et cumuls perpétuels, archivage au moins annuel avec date certaine, stockage externe sécurisé et rétention effective d’au moins six ans, procédures de restauration/changement logiciel et contrôles indépendants. Une base append-only ne protège pas contre son propriétaire privilégié ; un hash seul n’est ni horodatage de confiance, ni stockage WORM, ni certification.

La génération du projet ne délivre aucune attestation ; les identités, dates et références commerciales manquantes restent à remplir. Validation et signatures réelles des représentants éditeur/utilisateur requises. La plateforme n’est pas déclarée NF525 certifiée.

## Sources officielles consultées le 7 novembre 2026
- CGI 286 : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053546765
- Retour de l’attestation éditeur, loi de finances 2026 : https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000053508893
- Conditions et preuve : https://bofip.impots.gouv.fr/bofip/10691-PGP.html/identifiant%3DBOI-TVA-DECLA-30-10-30-20260325
- Modèle individuel BOI-LETTRE-000242 : https://bofip.impots.gouv.fr/bofip/10692-PGP.html/identifiant%3DBOI-LETTRE-000242-20260325
- Conservation LPF L102 B : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000046869194/2023-01-01

## Vérification
40 tests ciblés réussis. Établissement TEST désactivé, deux encaissements caisse avec TVA 10 %, remise 1,10 €, annulation 11 €, Z net 9,90 € / tiroir 59,90 € / écart 0. Chaîne de tickets recomputée indépendamment en Python, empreinte d’archive vérifiée, téléchargement PDF deux volets, ticket HTML/ESC-POS et mobile vérifiés. Refus visiteur, archive d’un autre restaurant et suppression JET vérifiés. Archives et audits TEST volontairement conservés ; aucune transaction bancaire, attestation signée, impression physique ou publication.