# Pollutions documentées de la CDA de La Rochelle

Site d'information sur les pollutions documentées des 28 communes de la Communauté d'agglomération de La Rochelle. Données JSON versionnées, pas de base de données. Chaque correction est publique parce qu'elle est un commit.

## Commandes

    npm install
    npm run validate      # schémas JSON + règles de cohérence, bloquant
    npm run build:data    # régénère data/build
    npm run dev           # site local

`npm run build` enchaîne validation, génération et build Next. Rien ne se déploie si la validation échoue.

## Arborescence

    schemas/              schémas JSON Schema 2020-12, un par entité
      defs.schema.json    énumérations et types partagés
      site.schema.json
      source.schema.json
      baignade-serie.schema.json
      restriction-usage.schema.json
      signal-sanitaire.schema.json
      recherche-infructueuse.schema.json
    data/
      communes.json       les 28 communes et leurs codes INSEE, source geo.api.gouv.fr
      sources.json        référentiel unique des sources, toutes les fiches y pointent
      libelles.json       libellés publics et définitions affichées
      sites/              une fiche par site, nom de fichier = id
      baignade/           une série de classements et prélèvements par site de baignade
      restrictions-usage.json
      signaux-sanitaires.json
      recherches-infructueuses.json
      build/              généré, jamais édité à la main
    scripts/
      validate.mjs        schémas + règles de cohérence
      build-geojson.mjs   sites.geojson, index communal, synthèse baignade
      collecte/           extractions Géorisques, Hub'Eau, SISE-Baignades
    src/                  application Next.js
    public/sources/       copies locales des PDF quand la source risque de disparaître

Une fiche par fichier : le diff d'une correction se lit sans chercher, et une demande de rectification se traite en un commit identifiable.

## Format de période

`periode` accepte des bornes floues, en EDTF allégé.

| écriture | sens |
|---|---|
| `1899` | année |
| `196X` | décennie 1960 |
| `2024-07` | mois |
| `2024-07-12` | jour |
| `null` | borne inconnue, qualifiée par le statut |

Chaque borne porte son statut. `debut_statut` vaut `datee` ou `inconnue`. `fin_statut` vaut `datee`, `en_cours` ou `inconnue`. La distinction compte : une décharge dont l'exploitation continue et une décharge dont on ignore la date de fermeture ne s'affichent pas pareil.

## Statut de preuve

Une valeur unique, la plus forte que les sources justifient, plus un booléen `procedure_en_cours` indépendant. Un site peut donc être mesuré et sous procédure sans que l'un affaiblisse l'autre.

## Règles de cohérence vérifiées en intégration continue

| code | règle |
|---|---|
| C1 | identifiants uniques, nom de fichier égal à l'id |
| C2 | toute source référencée existe dans `sources.json` |
| C3 | aucun site sans source |
| C4 | un site dont toutes les sources sont presse, associatives, témoignage ou communication institutionnelle ne peut pas porter `mesure_publiee` ni `diagnostic_administratif` |
| C5 | un exploitant n'est nommé que sur un arrêté, une délibération, une décision de justice ou une base publique |
| C6 | `geometry` nulle implique `precision_geo` nulle et un motif écrit |
| C7 | `localisation_indicative` implique un rayon ; pas d'emprise cadastrale sur un point |
| C8 | `statut_preuve` à `procedure_en_cours` implique le booléen à vrai |
| C9 | code INSEE dans les 28 communes |
| C10 | bornes de période cohérentes avec leur statut, début avant fin |
| C11 | un site réhabilité est masqué par défaut |
| C12 | une fiche `eau_baignade` porte un bloc baignade et une série rattachée |
| C13 | un classement nul exige un motif |
| C14 | `derniere_verification` pas dans le futur |
| C15 | coordonnées dans l'emprise de la CDA, ce qui attrape les inversions longitude/latitude |
| C16 | les liens internes pointent vers des fiches existantes |
| C17 | un signal sanitaire ne référence aucun site |

C15 et C17 ne figurent pas dans le document d'inventaire. C15 attrape la faute la plus fréquente en GeoJSON. C17 rend l'interdit éditorial mécanique : la non-imputation causale ne peut pas être contournée par inadvertance, même si les deux couches se superposent à l'écran.

## Ce que le validateur ne sait pas faire

Il vérifie la forme, pas le fond. Il ne dira pas qu'un résumé tire une conclusion que la source ne porte pas, ni qu'un polygone net a été tracé sur un plan approximatif. La relecture reste humaine.

## Licences

Les jeux republiés sont sous Licence Ouverte : Géorisques, Hub'Eau, SISE-Baignades, rapportage de la saison balnéaire. L'attribution figure sur chaque fiche source, avec l'URL et la page quand elle existe. La licence du jeu consolidé reste à fixer.
