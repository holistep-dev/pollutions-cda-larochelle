#!/usr/bin/env node
// Construit les fichiers consommés par la carte et les pages, à partir des données sources.
// Rien n'est écrit à la main dans data/build. Ce dossier est régénéré à chaque build.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { comparer } from "../src/lib/comparaison.js";

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

// ------------------------------------------------------------ carte publique
// Un seul fichier servi au navigateur. La géométrie dessinée suit precision_geo :
// un point indicatif devient un disque du rayon déclaré, jamais un polygone net.
const libelles = read("data/libelles.json");
const etatBaignade = new Map(baignade.map((b) => [b.site, b]));

function disque([lon, lat], rayon, n = 48) {
  const R = 6371008.8;
  const dLat = (rayon / R) * (180 / Math.PI);
  const dLon = dLat / Math.cos((lat * Math.PI) / 180);
  const anneau = [];
  for (let i = 0; i <= n; i++) {
    const a = (2 * Math.PI * i) / n;
    anneau.push([+(lon + dLon * Math.cos(a)).toFixed(6), +(lat + dLat * Math.sin(a)).toFixed(6)]);
  }
  return { type: "Polygon", coordinates: [anneau] };
}

function centre(g) {
  if (g.type === "Point") return g.coordinates;
  const pts = [];
  const collecte = (c) => (typeof c[0] === "number" ? pts.push(c) : c.forEach(collecte));
  collecte(g.coordinates);
  const lon = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [+lon.toFixed(6), +lat.toFixed(6)];
}

const surfaces = [];
const reperes = [];
for (const s of sites.filter((x) => x.geometry)) {
  const b = etatBaignade.get(s.id);
  const props = {
    id: s.id,
    nom: s.nom,
    commune: s.commune,
    categorie: s.categorie,
    categorie_libelle: libelles.categorie[s.categorie],
    theme: THEME[s.categorie],
    precision_geo: s.precision_geo,
    precision_libelle: libelles.precision_geo[s.precision_geo].libelle,
    preuve: s.statut_preuve,
    preuve_libelle: libelles.statut_preuve[s.statut_preuve].libelle,
    traitement: s.statut_traitement,
    traitement_libelle: libelles.statut_traitement[s.statut_traitement].libelle,
    rehabilite: s.statut_traitement === "rehabilite",
    baignade_etat: b ? b.etat : null,
    baignade_dernier: b ? (b.classements[Object.keys(b.classements).sort().pop()] ?? null) : null,
  };
  const geom = s.geometry.type === "Point" ? disque(s.geometry.coordinates, s.rayon_m ?? 100) : s.geometry;
  surfaces.push({ type: "Feature", id: s.id, geometry: geom, properties: props });
  reperes.push({ type: "Feature", id: s.id, geometry: { type: "Point", coordinates: centre(s.geometry) }, properties: props });
}

const contours = read("data/communes-contours.geojson");
const parCode = new Map(index.map((c) => [c.code_insee, c]));
const communesCarte = contours.features.map((f) => {
  const c = parCode.get(f.properties.code);
  return {
    type: "Feature",
    geometry: f.geometry,
    properties: {
      code_insee: f.properties.code,
      nom: c.nom,
      slug: c.slug,
      nb_sites: c.nb_sites,
      nb_sans_localisation: c.nb_sans_localisation,
      sans_localisation: c.sans_localisation.map((x) => x.nom).join(" ; "),
    },
  };
});

// Signaux : contour communal seulement quand l'étude porte sur la commune entière.
const signauxData = existsSync(join(ROOT, "data/signaux-sanitaires.json")) ? read("data/signaux-sanitaires.json").signaux : [];
const contourParCode = new Map(contours.features.map((f) => [f.properties.code, f.geometry]));
const signauxCarte = [];
const signauxNonCartographies = [];
for (const s of signauxData) {
  if (s.zone_libelle || !s.communes?.length) {
    signauxNonCartographies.push({ id: s.id, libelle: s.libelle, zone: s.zone_libelle ?? null });
    continue;
  }
  for (const code of s.communes) {
    signauxCarte.push({ type: "Feature", geometry: contourParCode.get(code), properties: { id: s.id, libelle: s.libelle } });
  }
}

// ------------------------------------------------------------ comparaisons
// Une teneur n'est rapprochée que d'une valeur de même milieu et d'unité convertible.
const references = read("data/references.json");
const sourcesIndex = new Map(read("data/sources.json").sources.map((s) => [s.id, s]));
const details = {};
for (const s of sites) {
  details[s.id] = {
    resume: s.resume,
    periode: s.periode,
    origine_trace: s.origine_trace ?? null,
    procedure_en_cours: s.procedure_en_cours,
    substances: (s.substances ?? []).map((x) => ({ libelle: x.libelle, milieu: x.milieu ?? null, valeur: x.valeur ?? null, unite: x.unite ?? null, date: x.date_mesure ?? null, comparaison: comparer(x, references) })),
    sources: s.sources.slice(0, 4).map((id) => {
      const src = sourcesIndex.get(id);
      return { titre: src.titre, auteur: src.auteur, date: src.date, url: src.url ?? null, type: src.type };
    }),
    nb_sources: s.sources.length,
  };
}

// ------------------------------------------------------------ eau du robinet
// Synthèse par commune tirée de la collecte Hub'Eau. Sans collecte, la couche n'est pas produite.
let eau = null;
if (existsSync(join(ROOT, "data/collecte/eau-potable.json"))) {
  const brut = read("data/collecte/eau-potable.json");
  const MICRO = /coli|entérocoque|enterocoque|bactéri|bacteri|coliforme|clostridium/i;
  eau = {
    source: brut.source,
    collecte_le: brut.collecte_le,
    periode_debut: brut.periode_debut,
    communes: Object.fromEntries(
      brut.communes.map((c) => {
        const dep = c.depassements_limite;
        const micro = dep.filter((d) => MICRO.test(d.parametre));
        const chimie = dep.filter((d) => !MICRO.test(d.parametre));
        const parametres = [...new Set(chimie.map((d) => d.parametre))];
        return [c.code_insee, {
          reseaux: c.reseaux.map((r) => r.nom),
          nb_prelevements: c.nb_prelevements_ph,
          dernier_prelevement: c.dernier_prelevement,
          nb_depassements: dep.length,
          nb_microbiologiques: micro.length,
          nb_physico_chimiques: chimie.length,
          parametres_physico_chimiques: parametres,
          dernier_depassement: dep.length ? dep.map((d) => d.date).sort().pop() : null,
          depassements: dep.map((d) => ({ date: d.date, parametre: d.parametre, valeur: d.valeur, resultat: d.resultat, unite: d.unite, limite: d.limite_qualite, reseau: d.reseaux.join(", ") })),
        }];
      })
    ),
  };
  writeFileSync(join(ROOT, "data/build/eau-potable.json"), JSON.stringify(eau, null, 1) + "\n");
  for (const f of communesCarte) {
    const e = eau.communes[f.properties.code_insee];
    f.properties.eau_depassements = e ? e.nb_depassements : -1;
    f.properties.eau_pc = e ? e.nb_physico_chimiques : -1;
  }
}

// Signaux : niveau de la source, pour un tracé plus léger quand le chiffre ne vient que de la presse.
for (const f of signauxCarte) {
  const s = signauxData.find((x) => x.id === f.properties.id);
  f.properties.niveau_source = s?.niveau_source ?? "etude_publiee";
}

mkdirSync(join(ROOT, "public/data"), { recursive: true });
writeFileSync(
  join(ROOT, "public/data/carte.json"),
  JSON.stringify({
    genere_le: new Date().toISOString().slice(0, 10),
    surfaces: { type: "FeatureCollection", features: surfaces },
    reperes: { type: "FeatureCollection", features: reperes },
    communes: { type: "FeatureCollection", features: communesCarte },
    signaux: { type: "FeatureCollection", features: signauxCarte },
    signaux_liste: signauxData.map((s) => ({ id: s.id, libelle: s.libelle, resultat: s.resultat, niveau_source: s.niveau_source ?? "etude_publiee", communes: s.communes ?? [], zone: s.zone_libelle ?? null })),
    signaux_non_cartographies: signauxNonCartographies,
    sans_localisation: index.filter((c) => c.nb_sans_localisation).map((c) => ({ commune: c.nom, slug: c.slug, sites: c.sans_localisation })),
    details,
    eau,
    libelles: {
      statut_preuve: libelles.statut_preuve,
      statut_traitement: libelles.statut_traitement,
      precision_geo: libelles.precision_geo,
      natures_reference: references.natures,
      circ_groupes: references.circ_groupes,
    },
  })
);
if (existsSync(join(ROOT, "data/agriculture/rpg-2023.geojson"))) {
  writeFileSync(join(ROOT, "public/data/agriculture.json"), readFileSync(join(ROOT, "data/agriculture/rpg-2023.geojson")));
}

console.log(
  `${features.length} objets cartographiés, ${sites.length - features.length} sites sans localisation, ` +
    `${index.filter((c) => c.nb_sites).length} communes peuplées, ${baignade.length} séries baignade.`
);
