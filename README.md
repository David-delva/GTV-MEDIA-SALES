# GTV-MEDIA-SALES

## Espace d’administration

La route `/admin` est réservée au rôle `ADMIN`. Elle regroupe les indicateurs, la gestion des grilles tarifaires, des comptes, des projets et des demandes visiteurs. Les grilles restent modifiables uniquement en brouillon; l’activation archive la grille précédente. La désactivation d’un compte prend effet sur les requêtes suivantes et ne peut pas supprimer le dernier administrateur actif.

Après les migrations `001` à `004`, appliquer `db/migrations/005_admin_management.sql` pour garantir l’unicité des adresses e-mail sans distinction de casse et des lignes tarifaires sans support associé.
