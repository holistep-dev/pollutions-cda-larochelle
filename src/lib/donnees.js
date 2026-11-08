// Lecture des données au moment du build. Les pages sont statiques : aucune lecture à l'exécution.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const lire = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const lireSiExiste = (p, defaut) => (existsSync(join(ROOT, p)) ? lire(p) : defaut);
const listeJson = (d) =>
  existsSync(join(ROOT, d)) ? readdirSync(join(ROOT, d)).filter((f) => f.endsWith(".json")).sort() : [];

export const libelles = () => lire("data/libelles.json");
export const communes = () => lire("data/communes.json").communes;
export const indexCommunes = () => lire("data/build/communes-index.json").communes;
export const sources = () => new Map(lire("data/sources.json").sources.map((s) => [s.id, s]));
export const sites = () => listeJson("data/sites").map((f) => lire(`data/sites/${f}`));
export const site = (id) => sites().find((s) => s.id === id) ?? null;
export const serieBaignade = (id) =>
  listeJson("data/baignade")
    .map((f) => lire(`data/baignade/${f}`))
    .find((s) => s.site === id) ?? null;
export const signaux = () => lireSiExiste("data/signaux-sanitaires.json", { signaux: [] }).signaux;
export const restrictions = () => lireSiExiste("data/restrictions-usage.json", { restrictions: [] }).restrictions;
export const recherches = () => lireSiExiste("data/recherches-infructueuses.json", { recherches: [] }).recherches;

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// Affiche une date floue EDTF allégée telle qu'elle est connue, sans inventer de précision.
export function dateLisible(d) {
  if (!d) return "date inconnue";
  if (/^[0-9]{3}X$/.test(d)) return `années ${d.slice(0, 3)}0`;
  const [a, m, j] = d.split("-");
  if (j) return `${Number(j)} ${MOIS[Number(m) - 1]} ${a}`;
  if (m) return `${MOIS[Number(m) - 1]} ${a}`;
  return a;
}

export function periodeLisible(p) {
  if (!p) return "";
  const debut = p.debut ? dateLisible(p.debut) : "début inconnu";
  const fin =
    p.fin_statut === "en_cours" ? "en cours" : p.fin ? dateLisible(p.fin) : "fin inconnue";
  return `${debut} à ${fin}`;
}

export const ORDRE_CATEGORIES = [
  "friche_sol_pollue",
  "decharge",
  "projet_decharge",
  "sediment_marin",
  "ressource_eau",
  "eau_baignade",
  "air",
  "inventaire_historique",
];
