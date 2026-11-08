// Rapproche une teneur mesurée des valeurs de comparaison de data/references.json.
// Utilisé au build par scripts/build-geojson.mjs et par les pages de fiche.

const UNITES = { "mg/kg": ["mg/kg", 1], "mg/kg MS": ["mg/kg", 1], "µg/L": ["µg/L", 1], "mg/L": ["µg/L", 1000], "Bq/g": ["Bq/kg", 1000], "Bq/kg": ["Bq/kg", 1], "Bq/m³": ["Bq/m³", 1], "coups/s": ["coups/s", 1], "UFC/100 mL": ["UFC/100 mL", 1] };
const nombre = (v) => (Math.round(v * 1000) / 1000).toLocaleString("fr-FR");
function referenceDe(libelle, references) {
  const l = libelle.toLowerCase();
  return references.substances.find((r) => r.motifs.some((m) => new RegExp(m, "i").test(l))) ?? null;
}
export function comparer(sub, references) {
  const ref = referenceDe(sub.libelle, references);
  const out = { cle: ref?.cle ?? null, circ: ref?.circ ?? null, effets: ref?.effets ?? null, effets_source: references.sources[ref?.effets_source]?.titre ?? null, reperes: [], verdict: "sans_repere" };
  // Air ambiant : aucune valeur réglementaire pour les pesticides, on le dit pour chaque molécule.
  if (sub.milieu === "air" && sub.reference_reglementaire?.nature !== "valeur_limite_emission" && !(ref?.valeurs ?? []).some((v) => v.milieu === "air")) {
    const air = references.substances.find((r) => r.cle === "pesticides dans l'air")?.valeurs[0];
    if (air) out.reperes.push({ libelle: air.libelle, nature: "aucune", source: references.sources[air.source]?.titre ?? null, source_url: references.sources[air.source]?.url ?? null });
  }
  const fin = () => {
    out.verdict = verdictDe(out.reperes);
    if (sub.depassement_constate && out.verdict !== "au_dessus_seuil") out.verdict = "au_dessus_seuil";
    return out;
  };
  // Valeur limite propre à l'installation, citée par l'administration.
  const rr = sub.reference_reglementaire;
  if (rr?.nature === "valeur_limite_emission") {
    const rep = { libelle: rr.libelle, nature: "valeur_limite_emission", valeur: rr.valeur ?? null, unite: rr.unite ?? sub.unite, source: null };
    if (rr.valeur != null && sub.valeur != null && (rr.unite ?? sub.unite) === sub.unite) {
      rep.rapport = sub.valeur / rr.valeur;
      rep.texte = rep.rapport >= 1.05 ? `${nombre(Math.round(rep.rapport * 10) / 10)} fois cette valeur` : "en dessous de cette valeur";
    } else if (sub.depassement_constate) rep.texte = "dépassement constaté par l'inspection";
    out.reperes.push(rep);
  }
  if (!ref) return fin();
  // Métabolite non pertinent : quantifié, sans verdict de dépassement.
  if (ref.non_pertinent) {
    out.reperes.push({ libelle: ref.note_non_pertinent, nature: "aucune", source: references.sources[ref.effets_source]?.titre ?? null });
    out.verdict = "non_pertinent";
    return out;
  }
  const u = UNITES[sub.unite];
  for (const v of ref.valeurs.filter((x) => x.milieu === sub.milieu)) {
    const repere = { libelle: v.libelle, nature: v.nature, source: references.sources[v.source]?.titre ?? null, source_url: references.sources[v.source]?.url ?? null };
    if (v.nature === "aucune") { out.reperes.push(repere); continue; }
    const uv = UNITES[v.unite];
    repere.valeur = v.valeur ?? null;
    repere.min = v.min ?? null;
    repere.max = v.max ?? null;
    repere.unite = v.unite;
    if (v.note) repere.note = v.note;
    if (v.non_comparable) repere.non_comparable = true;
    if (v.serie) repere.note = "Seuil calculé sur une série de prélèvements. Une valeur isolée ne s'y compare pas directement.";
    if (sub.milieu === "eau_souterraine" && v.nature === "limite_de_qualite" && !v.norme_milieu)
      repere.note = "Repère seulement : une nappe polluée n'est pas forcément utilisée pour l'eau potable.";
    if (sub.valeur != null && u && uv && u[0] === uv[0] && !v.serie && !v.non_comparable) {
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
  return fin();
}


// Verdict d'ensemble : dépassement d'un seuil sanitaire ou de gestion, puis du niveau habituel.
export function verdictDe(reperes) {
  const avecRapport = reperes.filter((r) => r.rapport != null);
  if (!avecRapport.length) return reperes.some((r) => r.non_comparable) ? "non_comparable" : "sans_repere";
  if (avecRapport.some((r) => r.nature !== "fond_geochimique" && r.rapport >= 1.05)) return "au_dessus_seuil";
  if (avecRapport.some((r) => r.nature === "fond_geochimique" && r.rapport > 1.05)) return "au_dessus_habituel";
  return "dans_la_norme";
}

export const VERDICTS = {
  au_dessus_seuil: { libelle: "Au-dessus d'un seuil", couleur: "#dc2626" },
  au_dessus_habituel: { libelle: "Au-dessus du niveau habituel", couleur: "#f59e0b" },
  dans_la_norme: { libelle: "Dans les valeurs habituelles", couleur: "#16a34a" },
  non_comparable: { libelle: "Pas directement comparable", couleur: "#94a3b8" },
  non_pertinent: { libelle: "Métabolite non pertinent", couleur: "#94a3b8" },
  sans_repere: { libelle: "Pas de repère publié", couleur: "#94a3b8" },
};
