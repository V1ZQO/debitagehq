# DebitageHQ

L'application privée de l'équipe : fichiers, tâches, planning, notes et discussion, sur un serveur Supabase.
Les fichiers de plus de 50 Mo sont envoyés sur Gofile (lien visible seulement dans l'appli).

## Installer l'application

Télécharge le dernier `DebitageHQ-Setup-x.y.z.exe` dans la page **Releases** (colonne de droite du dépôt), lance-le, puis colle le code d'invitation de l'équipe.

Windows peut afficher « Windows a protégé votre ordinateur » à la première installation : clique sur **Informations complémentaires** puis **Exécuter quand même**. Ensuite, l'appli se met à jour toute seule.

## Publier une mise à jour (pour les admins)

1. Modifie le code (directement sur GitHub ou sur ton PC).
2. Ouvre `package.json` et augmente le numéro de version, par exemple `"version": "1.2.0"` → `"version": "1.3.0"`.
3. Enregistre (Commit) sur la branche `main`. Rien n'est publié à ce stade.
4. Quand tu es prêt, onglet **Actions** > **Publier une mise à jour** > **Run workflow**.

GitHub construit alors l'installateur sur une machine Windows (quelques minutes) et le publie dans **Releases**. Toutes les applis de l'équipe le téléchargent dans l'heure et proposent « Redémarrer ». Si le numéro de version existe déjà, rien n'est publié : change d'abord le numéro.

## Fichiers

- `app/` : l'interface (HTML, CSS, JavaScript).
- `main.js` : la fenêtre, l'icône de la zone de notification, les notifications et les mises à jour.
- `preload.js` : le pont entre l'interface et Windows.
- `supabase-setup.sql` : le script du serveur. Il est déjà installé : ne le relance que si tu sais ce que tu fais, et en remettant ton code secret d'équipe à la place de `REMPLACE-MOI…`.
- `.github/workflows/release.yml` : la publication automatique.

Le dépôt ne contient aucun secret : l'adresse Supabase, la clé et le code d'équipe sont saisis dans l'application.
