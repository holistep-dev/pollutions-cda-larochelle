// Rapproche une teneur mesurée des valeurs de comparaison de data/references.json.
// Utilisé au build par scripts/build-geojson.mjs et par les pages de fiche.

const UNITES = { "mg/kg": ["mg/kg", 1], "mg/kg MS": ["mg/kg", 1], "µg/L": ["µg/L", 1], "mg/L": ["µg/L", 1000], "Bq/g": ["Bq/g", 1], "UFC/100 mL": ["UFC/100 mL", 1] };
const nombre = (v) => (Math.round(v * 1000) / 1000).toLocaleString("fr-FR");
function referenceDe(libelle, references) {
  const l = libelle.toLowerCase();
  return references.substances.find((r) => r.motifs.some((m) => new RegExp(m, "i").test(l))) ?? null;
}
export function comparer(sub, references) {
  const ref = referenceDe(sub.libelle, references);
  const out = { cle: ref?.cle ?? null, circ: ref?.circ ?? null, reperes: [] };
  // Air ambiant : aucune valeur réglementaire pour les pesticides, on le dit pour chaque molécule.
  if (sub.milieu === "air" && !(ref?.valeurs ?? []).some((v) => v.milieu === "air")) {
    const air = references.substances.find((r) => r.cle === "pesticides dans l'air")?.valeurs[0];
    if (air) out.reperes.push({ libelle: air.libelle, nature: "aucune", source: references.sources[air.source]?.titre ?? null, source_url: references.sources[air.source]?.url ?? null });
  }
  if (!ref) return out;
  const u = UNITES[sub.unite];
  for (const v of ref.valeurs.filter((x) => x.milieu === sub.milieu)) {
    const repere = { libelle: v.libelle, nature: v.nature, source: references.sources[v.source]?.titre ?? null, source_url: references.sources[v.source]?.url ?? null };
    if (v.nature === "aucune") { out.reperes.push(repere); continue; }
    const uv = UNITES[v.unite];
    repere.valeur = v.valeur ?? null;
    repere.min = v.min ?? null;
    repere.max = v.max ?? null;
    repere.unite = v.unite;
    if (v.serie) repere.note = "Seuil calculé sur une série de prélèvements. Une valeur isolée ne s'y compare pas directement.";
    if (sub.milieu === "eau_souterraine" && v.nature === "limite_de_qualite")
      repere.note = "Repère seulement : une nappe polluée n'est pas forcément utilisée pour l'eau potable.";
    if (sub.valeur != null && u && uv && u[0] === uv[0] && !v.serie) {
      const mesure = (sub.valeur * u[1]) / uv[1];
      if (v.valeur != null) {
        const r = mesure / v.valeur;
        repere.rapport = r;
        repere.texte = r >= 1.05 ? `${nombre(r < 10 ? Math.round(r * 10) / 10 : Math.round(r))} fois cette valeur` : r >= 0.95 ? "de l'ordre de cette valeur" : "en dessous de cette valeur";
      } else if (v.max != null) {
        repere.rapport = mesure / v.max;
        repere.texte = mesure > v.max ? `${nombre(Math.round((mesure / v.max) * 10) / 10)} fois le haut de cette gamme` : mesure >= v.min ? "dans cette gamme" : "sous cette gamme";
      }
    }
    out.reperes.push(repere);
  }
  return out;
}
