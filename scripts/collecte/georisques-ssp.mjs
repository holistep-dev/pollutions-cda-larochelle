#!/usr/bin/env node
// Extraction Géorisques, sites et sols pollués, pour les 28 communes de data/communes.json.
// Garde les instructions (ex-BASOL), les secteurs d'information sur les sols et les servitudes.
// CASIAS est compté, pas extrait : la couche mémoire industrielle est hors v1.
// Sortie : data/collecte/georisques-ssp.json. Relancer, puis lire le diff : c'est le journal des écarts.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const communes = JSON.parse(readFileSync(join(ROOT, "data/communes.json"), "utf8")).communes;
const API = "https://www.georisques.gouv.fr/api/v1/ssp";

async function page(code, n) {
  const r = await fetch(`${API}?code_insee=${code}&page=${n}&page_size=100`);
  if (!r.ok) throw new Error(`${code} page ${n} : HTTP ${r.status}`);
  return r.json();
}

// La géométrie arrive en objet GeoJSON, parfois en chaîne selon les versions de l'API.
const geom = (g) => (!g ? null : typeof g === "string" ? JSON.parse(g.replace(/'/g, '"')) : g);

const sortie = { source: API, extrait_le: new Date().toISOString().slice(0, 10), communes: [] };

for (const c of communes) {
  const p1 = await page(c.code_insee, 1);
  const bloc = { code_insee: c.code_insee, nom: c.nom, nb_casias: p1.casias.results, instructions: [], sis: [], sup: [] };
  for (const [cle, dest] of [["instructions", "instructions"], ["conclusions_sis", "sis"], ["conclusions_sup", "sup"]]) {
    let d = p1[cle];
    let n = 1;
    for (;;) {
      for (const x of d.data ?? []) bloc[dest].push({ ...x, geom: geom(x.geom) });
      if (!d.next) break;
      n += 1;
      d = (await page(c.code_insee, n))[cle];
    }
  }
  sortie.communes.push(bloc);
  console.log(`${c.nom} : ${bloc.instructions.length} instructions, ${bloc.sis.length} SIS, ${bloc.sup.length} SUP, ${bloc.nb_casias} CASIAS`);
}

mkdirSync(join(ROOT, "data/collecte"), { recursive: true });
writeFileSync(join(ROOT, "data/collecte/georisques-ssp.json"), JSON.stringify(sortie, null, 1) + "\n");
