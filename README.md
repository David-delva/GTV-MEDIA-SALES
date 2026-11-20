# GTV-MEDIA-SALES

## Espace commercial

La page `/projects` affiche les indicateurs du portefeuille et les prochaines actions à échéance. Elle permet de rechercher, filtrer, trier et exporter les projets, de modifier les projets en brouillon et d’ajouter des rappels depuis leur espace de travail. Les transitions de statut des projets restent réservées à l’administration.

## Espace d’administration

La route `/admin` est réservée au rôle `ADMIN`. Elle regroupe les indicateurs, la gestion des grilles tarifaires, des comptes, des clients, des projets et des demandes visiteurs. Elle propose également la recherche, les filtres et l’export CSV des listes. Les grilles restent modifiables uniquement en brouillon; l’activation archive la grille précédente. Les rôles et mots de passe peuvent être administrés sans révéler les mots de passe stockés. La désactivation d’un compte prend effet sur les requêtes suivantes et aucun changement de rôle ne peut supprimer le dernier administrateur actif.

Appliquer les migrations dans l’ordre : `001` à `008`. La migration `005` garantit l’unicité des adresses e-mail sans distinction de casse et des lignes tarifaires sans support associé. La migration `006` ajoute l’état actif/inactif des clients. La migration `007` permet de révoquer les sessions existantes après une réinitialisation de mot de passe. La migration `008` ajoute les actions de suivi et rappels des projets.

Pour remplir une base locale de démonstration avec des clients, projets et demandes fictifs, exécuter `db/seeds/002_admin_demo_workflow.sql` après les migrations et le seed `001_demo_fictif.sql`. Pour ajouter les 20 grilles brouillon et les options de format `AUTRE` fictives, exécuter ensuite `db/seeds/003_demo_other_rate_cards.sql`. Les seeds sont réexécutables sans remplacer les enregistrements existants; les contacts utilisent le domaine réservé `example.invalid`.
