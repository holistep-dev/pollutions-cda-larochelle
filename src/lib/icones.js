// Icônes de la carte, dessinées en SVG et chargées dans MapLibre comme images.
// Le pictogramme dit le type de fait, la couleur dit l'état quand il existe un seuil (plages, robinets).

export const COULEURS = {
  sols: "#7c3aed",
  projets: "#a78bfa",
  air: "#0891b2",
  eau: "#0369a1",
  signaux: "#db2777",
  vert: "#16a34a",
  orange: "#f59e0b",
  rouge: "#dc2626",
  gris: "#94a3b8",
  conventionnel: "#fcd34d",
  prairie: "#d9e4a6",
  gel: "#cbd5e1",
  bio: "#15803d",
  nature: "#0f766e",
};

// Silhouettes pleines sur une grille de 24 × 24. W = couleur du pictogramme, F = couleur du fond (détails évidés).
const S = (d) => `<path d="${d}" fill="W"/>`;
const L = (d, w = 2.6) => `<path d="${d}" fill="none" stroke="W" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const GLYPHES = {
  // Usine : toits en dents de scie et cheminée.
  usine: S("M2 21.5V11l5 3.2V11l5 3.2V11l3 1.9V2.5h4.5v19z") + '<path d="M5 17.5h2.4M9.6 17.5H12M14.2 17.5h2.4" stroke="F" stroke-width="2" stroke-linecap="round"/>',
  // Décharge : poubelle avec couvercle.
  decharge: S("M3.5 5.5h17v2.6h-17zM9 2.5h6v2.2H9zM5.2 9.4h13.6l-1.3 12.1H6.5z") + '<path d="M9.4 12v6.6M14.6 12v6.6" stroke="F" stroke-width="1.9" stroke-linecap="round"/>',
  goutte: S("M12 1.8c3.6 5 7.2 8.6 7.2 12.8a7.2 7.2 0 0 1-14.4 0C4.8 10.4 8.4 6.8 12 1.8z") + '<path d="M8.6 14.6a3.4 3.4 0 0 0 2.6 3.3" fill="none" stroke="F" stroke-width="1.7" stroke-linecap="round"/>',
  // Plage : parasol et vagues.
  plage: S("M2.5 11.5A9.5 9.5 0 0 1 21.5 11.5z") + L("M12 11.5v6", 2.4) + L("M2 21c1.7-1.4 3.3-1.4 5 0s3.3 1.4 5 0 3.3-1.4 5 0 3.3 1.4 5 0", 2.4),
  // Robinet : corps, bec et goutte.
  robinet: S("M7 3h6v2.4h-1.8V7H19a3.5 3.5 0 0 1 3.5 3.5V14h-4.4v-2.4a.9.9 0 0 0-.9-.9H2.5V7h6.3V5.4H7z") + S("M20.3 16.3c1.1 1.6 2 2.6 2 3.7a2 2 0 0 1-4 0c0-1.1.9-2.1 2-3.7z"),
  // Captage : puits, sol et goutte qui remonte.
  captage: S("M12 1.8c2.4 3.4 4.6 5.7 4.6 8.4a4.6 4.6 0 0 1-9.2 0c0-2.7 2.2-5 4.6-8.4z") + S("M1.8 16.2h20.4v2.4H1.8z") + S("M10.6 18.6h2.8V23h-2.8z"),
  vent: L("M2.5 8h11a3.2 3.2 0 1 0-3.2-3.2", 2.7) + L("M2.5 12.5H19a3.2 3.2 0 1 1-3.2 3.2", 2.7) + L("M2.5 17h7", 2.7),
  vague: L("M2 8.5c1.7-1.6 3.3-1.6 5 0s3.3 1.6 5 0 3.3-1.6 5 0 3.3 1.6 5 0", 2.6) + L("M2 14c1.7-1.6 3.3-1.6 5 0s3.3 1.6 5 0 3.3-1.6 5 0 3.3 1.6 5 0", 2.6) + L("M2 19.5c1.7-1.6 3.3-1.6 5 0s3.3 1.6 5 0 3.3-1.6 5 0 3.3 1.6 5 0", 2.6),
  coche: L("M4.5 12.5 10 18 19.5 6.5", 3.2),
  // Trèfle radioactif normalisé.
  radioactif: '<circle cx="12" cy="12" r="2.6" fill="W"/>' + S("M9.90 8.36L6.90 3.17A10.2 10.2 0 0 1 17.10 3.17L14.10 8.36A4.2 4.2 0 0 0 9.90 8.36ZM16.20 12.00L22.20 12.00A10.2 10.2 0 0 1 17.10 20.83L14.10 15.64A4.2 4.2 0 0 0 16.20 12.00ZM9.90 15.64L6.90 20.83A10.2 10.2 0 0 1 1.80 12.00L7.80 12.00A4.2 4.2 0 0 0 9.90 15.64Z"),
  // Cheminée qui fume.
  cheminee: S("M8.2 7.5h4.6v8H8.2zM2.5 14.5h19v7h-19z") + '<circle cx="10.4" cy="4.4" r="2.2" fill="W"/><circle cx="14.4" cy="3.2" r="2.4" fill="W"/><circle cx="18.6" cy="4.6" r="1.9" fill="W"/>' + '<path d="M6 18h2.4M10.8 18h2.4M15.6 18H18" stroke="F" stroke-width="2" stroke-linecap="round"/>',
  feuille: S("M4.5 20C3.5 10.5 9 4 21 3c-.6 11.5-6.5 17.5-16.5 17z") + '<path d="M4.5 20 14 10.5" stroke="F" stroke-width="1.9" stroke-linecap="round"/>',
};

export function svgIcone({ glyphe, fond, creux = false, pointille = false, carre = false, taille = 96 }) {
  const remplissage = creux ? "#ffffff" : fond;
  const bord = creux ? fond : "#ffffff";
  const encre = creux ? fond : "#ffffff";
  const dash = pointille ? ' stroke-dasharray="7 5"' : "";
  const forme = carre
    ? `<rect x="4" y="4" width="56" height="56" rx="16" fill="${remplissage}" stroke="${bord}" stroke-width="3.5"${dash}/>`
    : `<circle cx="32" cy="32" r="28" fill="${remplissage}" stroke="${bord}" stroke-width="3.5"${dash}/>`;
  const g = GLYPHES[glyphe].replaceAll('"W"', `"${encre}"`).replaceAll('"F"', `"${remplissage}"`);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 64 64">` +
    `<circle cx="32" cy="34.5" r="28.5" fill="rgba(15,28,46,0.25)"/>` +
    forme +
    `<g transform="translate(13 13) scale(1.5833)">${g}</g></svg>`
  );
}

// Grappe de repères proches : disque sombre et nombre.
export function svgGrappe(n, taille = 96) {
  const r = n < 10 ? 22 : n < 30 ? 25 : 28;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 64 64">` +
    `<circle cx="32" cy="32" r="${r + 5}" fill="rgba(13,43,69,0.22)"/>` +
    `<circle cx="32" cy="32" r="${r}" fill="#0d2b45" stroke="#ffffff" stroke-width="3.5"/>` +
    `<text x="32" y="32" dy="0.36em" text-anchor="middle" font-family="Figtree, Arial, sans-serif" font-weight="700" font-size="${n < 100 ? 22 : 18}" fill="#ffffff">${n}</text></svg>`
  );
}

export const urlIcone = (o) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgIcone(o));

// Description d'icône à partir des propriétés d'un repère de site.
export function iconeSite(p) {
  const creux = p.preuve === "signalement_non_instruit";
  // Site réhabilité : même pictogramme, fond vert.
  if (p.rehabilite) return { glyphe: p.pictogramme ?? (p.categorie === "decharge" ? "decharge" : "usine"), fond: COULEURS.vert };
  if (p.pictogramme && p.type !== "baignade") {
    const fond = p.type === "air" ? COULEURS.air : p.type === "projets" ? COULEURS.projets : p.type === "eau" ? COULEURS.eau : COULEURS.sols;
    return { glyphe: p.pictogramme, fond, creux, pointille: p.type === "projets" };
  }
  if (p.type === "baignade") return { glyphe: "plage", fond: COULEURS[p.baignade_couleur] ?? COULEURS.gris };
  if (p.type === "projets") return { glyphe: "decharge", fond: COULEURS.projets, pointille: true, creux };
  if (p.type === "air") return { glyphe: "vent", fond: COULEURS.air, creux };
  if (p.type === "eau") return { glyphe: "goutte", fond: COULEURS.eau, creux };
  if (p.categorie === "decharge") return { glyphe: "decharge", fond: COULEURS.sols, creux };
  if (p.categorie === "sediment_marin") return { glyphe: "vague", fond: COULEURS.sols, creux };
  return { glyphe: "usine", fond: COULEURS.sols, creux };
}

export const cleIcone = (o) => [o.glyphe, o.fond, o.creux ? "c" : "p", o.pointille ? "d" : "", o.carre ? "k" : ""].join("_");
