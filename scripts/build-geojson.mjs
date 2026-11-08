#!/usr/bin/env node
// Construit les fichiers consommés par la carte et les pages, à partir des données sources.
// Rien n'est écrit à la main dans data/build. Ce dossier est régénéré à chaque build.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const write = (p, o) => writeFileSync(join(ROOT, p), JSON.stringify(o, null, 2) + "\n");
const listJson = (d) =>
  existsSync(join(ROOT, d)) ? readdirSync(join(ROOT, d)).filter((f) => f.endsWith(".json")) : [];

mkdirSync(join(ROOT, "data/build"), { recursive: true });

const communes = read("data/communes.json").communes;
const sites = listJson("data/sites").map((f) => read(`data/sites/${f}`));
const series = listJson("data/baignade").map((f) => read(`data/baignade/${f}`));

// Un thème regroupe plusieurs catégories. Les thèmes sont cumulables côté carte.
const THEME = {
  decharge: "pollution_chimique",
  projet_decharge: "pollution_chimique",
  friche_sol_pollue: "pollution_chimique",
  sediment_marin: "pollution_chimique",
  inventaire_historique: "memoire_industrielle",
  ressource_eau: "ressource_eau",
  eau_baignade: "eaux_baignade",
  air: "air",
};

// --------------------------------------------------------------- carte
const features = sites
  .filter((s) => s.geometry)
  .map((s) => ({
    type: "Feature",
    id: s.id,
    geometry: s.geometry,
    properties: {
      id: s.id,
      nom: s.nom,
      commune: s.commune,
      code_insee: s.code_insee,
      categorie: s.categorie,
      theme: THEME[s.categorie],
      precision_geo: s.precision_geo,
      rayon_m: s.rayon_m ?? null,
      statut_preuve: s.statut_preuve,
      procedure_en_cours: s.procedure_en_cours,
      statut_traitement: s.statut_traitement,
      visible_par_defaut: s.visible_par_defaut !== false && s.statut_traitement !== "rehabilite",
    },
  }));
write("data/build/sites.geojson", { type: "FeatureCollection", features });

// --------------------------------------------------- sites sans localisation
// Comptés par commune, affichés en compteur cliquable sur la carte, jamais placés au centroïde.
const sansGeometrie = {};
for (const s of sites.filter((x) => !x.geometry)) {
  (sansGeometrie[s.code_insee] ??= []).push({ id: s.id, nom: s.nom, motif: s.motif_absence_geometrie });
}

// --------------------------------------------------------------- communes
const index = communes.map((c) => {
  const liste = sites.filter((s) => s.code_insee === c.code_insee || (s.communes_secondaires ?? []).includes(c.code_insee));
  return {
    ...c,
    nb_sites: liste.length,
    nb_sans_localisation: (sansGeometrie[c.code_insee] ?? []).length,
    sans_localisation: sansGeometrie[c.code_insee] ?? [],
    sites: liste.map((s) => ({
      id: s.id,
      nom: s.nom,
      categorie: s.categorie,
      statut_preuve: s.statut_preuve,
      statut_traitement: s.statut_traitement,
      localise: Boolean(s.geometry),
    })),
  };
});
write("data/build/communes-index.json", { genere_le: new Date().toISOString().slice(0, 10), communes: index });

// --------------------------------------------------------------- baignade
// Le classement annuel est déjà calculé par l'ARS sur les quatre dernières saisons de prélèvements.
// La moyenne affichée porte donc sur des valeurs déjà lissées : elle sert de repère, pas de mesure.
const NOTE = { Excellent: 4, Bon: 3, Suffisant: 2, Insuffisant: 1 };
const baignade = series.map((s) => {
  const saisons = Object.keys(s.classements).sort();
  const retenues = saisons.filter((a) => s.classements[a] !== null).slice(-5);
  const notes = retenues.map((a) => NOTE[s.classements[a]]);
  const moyenne = notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : null;
  const derniereSaison = saisons[saisons.length - 1];
  return {
    site: s.site,
    id_site_sise: s.id_site_sise,
    classements: s.classements,
    saisons_retenues: retenues,
    moyenne_5_saisons: moyenne === null ? null : Math.round(moyenne * 100) / 100,
    etat:
      s.classements[derniereSaison] === null
        ? "hors_controle_sanitaire"
        : s.classements[derniereSaison].toLowerCase(),
    motif_absence_classement: s.motif_absence_classement ?? null,
    nb_prelevements: (s.prelevements ?? []).length,
    nb_evenements_declares: (s.evenements_declares ?? []).length,
    nb_fermetures: (s.fermetures ?? []).length,
  };
});
write("data/build/baignade-synthese.json", {
  genere_le: new Date().toISOString().slice(0, 10),
  methode:
    "Moyenne des cinq derniers classements annuels disponibles, Excellent 4 à Insuffisant 1. Un site sans classement récent est en état hors_controle_sanitaire et n'est pas moyenné.",
  sites: baignade,
});

console.log(
  `${features.length} objets cartographiés, ${sites.length - features.length} sites sans localisation, ` +
    `${index.filter((c) => c.nb_sites).length} communes peuplées, ${baignade.length} séries baignade.`
);
