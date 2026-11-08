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
};

// Tracés sur une grille de 24 × 24, trait blanc.
const GLYPHES = {
  usine: '<path d="M3 21V10l5 3v-3l5 3V7l8 4v10z"/><path d="M7 17h1.5M11.5 17h1.5M16 17h1.5"/>',
  decharge: '<path d="M4 7h16"/><path d="M9.5 7V4.5h5V7"/><path d="M6 7l1.2 13h9.6L18 7"/><path d="M10 11v5M14 11v5"/>',
  goutte: '<path d="M12 3.5c3 4.3 5.8 7.3 5.8 10.6a5.8 5.8 0 0 1-11.6 0C6.2 10.8 9 7.8 12 3.5z"/>',
  plage: '<path d="M4 12a8 8 0 0 1 16 0z"/><path d="M12 12v6"/><path d="M3 20c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0"/>',
  robinet: '<path d="M3 8.5h9.5a4 4 0 0 1 4 4V15"/><path d="M3 12.5h7"/><path d="M8 5v3.5M5.5 5h5"/><path d="M16.5 18.2v.6M16.5 21v.4"/>',
  captage: '<path d="M12 3v9"/><path d="M8.5 8.5 12 12l3.5-3.5"/><path d="M4 15h16"/><path d="M7 15v6M17 15v6"/>',
  vent: '<path d="M3 8.5h10.5a2.8 2.8 0 1 0-2.8-2.8"/><path d="M3 12.5h15a3 3 0 1 1-3 3"/><path d="M3 16.5h6"/>',
  vague: '<path d="M3 9c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0"/><path d="M3 14c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0"/>',
  coche: '<path d="M5 12.5 10 17.5 19 7.5"/>',
};

export function svgIcone({ glyphe, fond, creux = false, pointille = false, carre = false, taille = 64 }) {
  const remplissage = creux ? "#ffffff" : fond;
  const bord = creux ? fond : "#ffffff";
  const trait = creux ? fond : "#ffffff";
  const dash = pointille ? ' stroke-dasharray="7 5"' : "";
  const forme = carre
    ? `<rect x="6" y="6" width="52" height="52" rx="15" fill="${remplissage}" stroke="${bord}" stroke-width="4"${dash}/>`
    : `<circle cx="32" cy="32" r="26" fill="${remplissage}" stroke="${bord}" stroke-width="4"${dash}/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 64 64">` +
    `<circle cx="32" cy="34" r="27" fill="rgba(15,28,46,0.22)"/>` +
    forme +
    `<g transform="translate(18 18) scale(1.1667)" fill="none" stroke="${trait}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${GLYPHES[glyphe]}</g></svg>`
  );
}

export const urlIcone = (o) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgIcone(o));

// Description d'icône à partir des propriétés d'un repère de site.
export function iconeSite(p) {
  const creux = p.preuve === "signalement_non_instruit";
  if (p.type === "baignade") return { glyphe: "plage", fond: COULEURS[p.baignade_couleur] ?? COULEURS.gris };
  if (p.type === "projets") return { glyphe: "decharge", fond: COULEURS.projets, pointille: true, creux };
  if (p.type === "air") return { glyphe: "vent", fond: COULEURS.air, creux };
  if (p.type === "eau") return { glyphe: "goutte", fond: COULEURS.eau, creux };
  if (p.categorie === "decharge") return { glyphe: "decharge", fond: COULEURS.sols, creux };
  if (p.categorie === "sediment_marin") return { glyphe: "vague", fond: COULEURS.sols, creux };
  return { glyphe: "usine", fond: COULEURS.sols, creux };
}

export const cleIcone = (o) => [o.glyphe, o.fond, o.creux ? "c" : "p", o.pointille ? "d" : "", o.carre ? "k" : ""].join("_");
