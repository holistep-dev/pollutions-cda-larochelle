#!/usr/bin/env node
// Validation des données du dépôt : schémas JSON puis règles de cohérence éditoriales.
// Sort en code 1 à la première erreur bloquante. Les avertissements ne bloquent pas.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const listJson = (d) =>
  existsSync(join(ROOT, d)) ? readdirSync(join(ROOT, d)).filter((f) => f.endsWith(".json")) : [];

const erreurs = [];
const avertissements = [];
const err = (regle, ou, msg) => erreurs.push(`[${regle}] ${ou} : ${msg}`);
const warn = (regle, ou, msg) => avertissements.push(`[${regle}] ${ou} : ${msg}`);

// ---------------------------------------------------------------- schémas
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
for (const f of listJson("schemas")) ajv.addSchema(read(`schemas/${f}`), f);

const valide = (schema, objet, ou) => {
  const v = ajv.getSchema(schema);
  if (!v(objet)) {
    for (const e of v.errors) err("schema", ou, `${e.instancePath || "/"} ${e.message}`);
    return false;
  }
  return true;
};

// ---------------------------------------------------------------- chargement
const communes = read("data/communes.json").communes;
const codesInsee = new Set(communes.map((c) => c.code_insee));

const sources = read("data/sources.json").sources;
const parSource = new Map(sources.map((s) => [s.id, s]));
for (const s of sources) valide("source.schema.json", s, `source ${s.id}`);
if (parSource.size !== sources.length) err("C1", "sources.json", "identifiants en double");

const sites = listJson("data/sites").map((f) => ({ fichier: f, ...read(`data/sites/${f}`) }));
const parSite = new Map();
for (const s of sites) {
  const { fichier, ...site } = s;
  valide("site.schema.json", site, `site ${fichier}`);
  if (parSite.has(site.id)) err("C1", `site ${fichier}`, `identifiant en double : ${site.id}`);
  parSite.set(site.id, site);
  if (`${site.id}.json` !== fichier) warn("C1", `site ${fichier}`, "le nom de fichier ne reprend pas l'id");
}

const series = listJson("data/baignade").map((f) => read(`data/baignade/${f}`));
for (const s of series) valide("baignade-serie.schema.json", s, `serie ${s.site}`);

const restrictions = existsSync(join(ROOT, "data/restrictions-usage.json"))
  ? read("data/restrictions-usage.json").restrictions
  : [];
for (const r of restrictions) valide("restriction-usage.schema.json", r, `restriction ${r.id}`);

const signaux = existsSync(join(ROOT, "data/signaux-sanitaires.json"))
  ? read("data/signaux-sanitaires.json").signaux
  : [];
for (const s of signaux) valide("signal-sanitaire.schema.json", s, `signal ${s.id}`);

const recherches = existsSync(join(ROOT, "data/recherches-infructueuses.json"))
  ? read("data/recherches-infructueuses.json").recherches
  : [];
for (const r of recherches) valide("recherche-infructueuse.schema.json", r, `recherche ${r.id}`);

// ---------------------------------------------------------------- règles
const FAIBLES = new Set(["presse", "publication_associative", "temoignage", "communication_institutionnelle"]);
const ADMINISTRATIVES = new Set([
  "arrete_prefectoral",
  "arrete_municipal",
  "deliberation",
  "decision_justice",
  "avis_administratif",
  "base_publique",
]);
const BBOX = { minLon: -1.42, maxLon: -0.85, minLat: 46.0, maxLat: 46.35 };
const AUJOURDHUI = new Date().toISOString().slice(0, 10);
const borneComparable = (v) => (v ? v.replace("X", "0").padEnd(10, "0") : null);

const verifieRefsSources = (ids, ou) => {
  for (const id of ids ?? []) if (!parSource.has(id)) err("C2", ou, `source inconnue : ${id}`);
};

for (const site of sites) {
  const ou = `site ${site.id}`;

  // C2, C3 : sources déclarées et existantes
  if (!site.sources?.length) err("C3", ou, "aucune source");
  verifieRefsSources(site.sources, ou);
  verifieRefsSources((site.revue_presse ?? []).map((r) => r.source), ou);
  verifieRefsSources((site.temoignages ?? []).map((t) => t.source), ou);
  verifieRefsSources((site.exploitants ?? []).map((e) => e.source), ou);
  for (const e of site.chronologie ?? []) verifieRefsSources(e.sources, ou);

  // C4 : le statut de preuve ne dépasse pas ce que les sources portent
  const types = (site.sources ?? []).map((id) => parSource.get(id)?.type).filter(Boolean);
  const seulementFaibles = types.length > 0 && types.every((t) => FAIBLES.has(t));
  if (seulementFaibles && ["mesure_publiee", "diagnostic_administratif"].includes(site.statut_preuve)) {
    err("C4", ou, `statut_preuve ${site.statut_preuve} sans source primaire (types : ${types.join(", ")})`);
  }

  // C5 : exploitant nommé seulement sur document administratif ou décision de justice
  for (const e of site.exploitants ?? []) {
    const t = parSource.get(e.source)?.type;
    if (!ADMINISTRATIVES.has(t)) err("C5", ou, `exploitant « ${e.nom} » adossé à une source de type ${t}`);
  }

  // C6 : géométrie nulle assumée et motivée
  if (site.geometry === null) {
    if (site.precision_geo !== null) err("C6", ou, "geometry nulle mais precision_geo renseignée");
    if (!site.motif_absence_geometrie) err("C6", ou, "geometry nulle sans motif_absence_geometrie");
  } else if (site.precision_geo === null) {
    err("C6", ou, "geometry renseignée mais precision_geo nulle");
  }

  // C7 : un point indicatif porte un rayon
  if (site.precision_geo === "localisation_indicative" && site.rayon_m == null) {
    err("C7", ou, "localisation_indicative sans rayon_m");
  }
  if (site.precision_geo === "emprise_cadastrale" && site.geometry?.type === "Point") {
    err("C7", ou, "emprise_cadastrale tracée sur un point");
  }

  // C8 : cohérence du booléen de procédure
  if (site.statut_preuve === "procedure_en_cours" && site.procedure_en_cours !== true) {
    err("C8", ou, "statut_preuve procedure_en_cours mais booléen à false");
  }

  // C9 : commune du périmètre
  if (!codesInsee.has(site.code_insee)) err("C9", ou, `code_insee hors CDA : ${site.code_insee}`);
  for (const c of site.communes_secondaires ?? [])
    if (!codesInsee.has(c)) err("C9", ou, `commune secondaire hors CDA : ${c}`);

  // C10 : période
  const p = site.periode;
  if (p) {
    if (p.debut === null && p.debut_statut !== "inconnue") err("C10", ou, "debut nul sans debut_statut inconnue");
    if (p.debut !== null && p.debut_statut !== "datee") err("C10", ou, "debut renseigné mais debut_statut n'est pas datee");
    if (p.fin === null && p.fin_statut === "datee") err("C10", ou, "fin nulle déclarée datee");
    if (p.fin !== null && p.fin_statut !== "datee") err("C10", ou, "fin renseignée mais fin_statut n'est pas datee");
    if (p.debut && p.fin && borneComparable(p.debut) > borneComparable(p.fin)) err("C10", ou, "début postérieur à la fin");
  }

  // C11 : un site réhabilité est masqué par défaut
  if (site.statut_traitement === "rehabilite" && site.visible_par_defaut !== false) {
    err("C11", ou, "site réhabilité : visible_par_defaut doit valoir false");
  }

  // C12 : baignade
  if (site.categorie === "eau_baignade") {
    if (!site.baignade) err("C12", ou, "catégorie eau_baignade sans bloc baignade");
    if (!series.some((s) => s.site === site.id)) err("C12", ou, "aucune série de classements rattachée");
  } else if (site.baignade) {
    err("C12", ou, "bloc baignade sur une catégorie qui n'est pas eau_baignade");
  }

  // C14 : date de vérification
  if (site.derniere_verification > AUJOURDHUI) err("C14", ou, "derniere_verification dans le futur");

  // C15 : coordonnées dans l'emprise de la CDA
  const coords = [];
  const collecte = (c) => {
    if (typeof c?.[0] === "number") coords.push(c);
    else if (Array.isArray(c)) c.forEach(collecte);
  };
  if (site.geometry) collecte(site.geometry.coordinates);
  for (const [lon, lat] of coords) {
    if (lon < BBOX.minLon || lon > BBOX.maxLon || lat < BBOX.minLat || lat > BBOX.maxLat) {
      err("C15", ou, `coordonnée hors emprise CDA : ${lon}, ${lat} (ordre attendu : longitude, latitude)`);
      break;
    }
  }

  // C16 : liens internes
  for (const l of site.liens ?? []) if (!parSite.has(l.site)) err("C16", ou, `lien vers un site inconnu : ${l.site}`);

  // avertissements éditoriaux
  if (!site.ce_qui_manque?.length && site.statut_preuve === "signalement_non_instruit") {
    warn("E1", ou, "signalement non instruit sans ce_qui_manque : la fiche ne dit pas où chercher");
  }
}

// C13 : séries de baignade
for (const s of series) {
  const ou = `serie ${s.site}`;
  if (!parSite.has(s.site)) err("C12", ou, `série rattachée à un site inexistant : ${s.site}`);
  verifieRefsSources(s.sources, ou);
  const aDesTrous = Object.values(s.classements ?? {}).some((v) => v === null);
  if (aDesTrous && !s.motif_absence_classement) err("C13", ou, "classement nul sans motif_absence_classement");
  for (const f of s.fermetures ?? []) verifieRefsSources([f.source], ou);
}

// restrictions, signaux, recherches
for (const r of restrictions) {
  verifieRefsSources(r.sources, `restriction ${r.id}`);
  for (const c of r.portee?.communes ?? [])
    if (!codesInsee.has(c)) err("C9", `restriction ${r.id}`, `commune hors CDA : ${c}`);
  for (const sid of r.sites_lies ?? [])
    if (!parSite.has(sid)) err("C16", `restriction ${r.id}`, `site inconnu : ${sid}`);
}
for (const s of signaux) {
  verifieRefsSources(s.sources, `signal ${s.id}`);
  for (const c of s.communes ?? [])
    if (!codesInsee.has(c)) err("C9", `signal ${s.id}`, `commune hors CDA : ${c}`);
  if (JSON.stringify(s).includes("sites_lies")) err("C17", `signal ${s.id}`, "un signal sanitaire ne référence aucun site");
}
for (const r of recherches) {
  for (const sid of r.sites_lies ?? [])
    if (!parSite.has(sid)) err("C16", `recherche ${r.id}`, `site inconnu : ${sid}`);
}

// ---------------------------------------------------------------- sortie
console.log(
  `${communes.length} communes, ${sites.length} sites, ${series.length} séries baignade, ` +
    `${restrictions.length} restrictions, ${signaux.length} signaux, ${recherches.length} recherches, ${sources.length} sources.`
);
for (const a of avertissements) console.log("avertissement " + a);
if (erreurs.length) {
  console.error(`\n${erreurs.length} erreur(s) :`);
  for (const e of erreurs) console.error("  " + e);
  process.exit(1);
}
console.log("Validation passée.");
