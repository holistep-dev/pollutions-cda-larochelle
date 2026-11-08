"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { COULEURS, cleIcone, iconeSite, svgIcone, urlIcone } from "../lib/icones";
import {
  Definition, ETATS_EAU, ETATS_PLAGE, PanneauAgri, PanneauCaptage, PanneauCommune, PanneauNature, PanneauRobinet, PanneauSignal, PanneauSite, nb,
} from "./Panneaux";

// Classement par milieu. Chaque groupe réunit plusieurs types de repères.
const GROUPES = [
  { id: "sol", libelle: "Sol", types: ["sols", "projets"], icone: { glyphe: "usine", fond: COULEURS.sols },
    def: "Sols et nappes pollués, anciennes décharges, radioactivité, projets de décharge." },
  { id: "eau", libelle: "Eau", types: ["baignade", "eau"], icone: { glyphe: "robinet", fond: COULEURS.eau, carre: true },
    def: "Eau du robinet par commune sur douze mois, captages d'eau potable, qualité des plages." },
  { id: "air", libelle: "Air", types: ["air"], icone: { glyphe: "vent", fond: COULEURS.air },
    def: "Pesticides mesurés dans l'air par Atmo Nouvelle-Aquitaine, émissions de l'incinérateur." },
  { id: "sante", libelle: "Santé", types: [], hachure: true,
    def: "Signaux sanitaires issus d'études épidémiologiques. Ce ne sont pas des pollutions. Aucun lien de cause à effet n'est établi avec la carte." },
  { id: "agriculture", libelle: "Agriculture", types: [], bicolore: true,
    def: "Parcelles conventionnelles, où les pesticides de synthèse sont autorisés, et parcelles bio, d'après les déclarations PAC 2023." },
  { id: "nature", libelle: "Nature protégée", types: [], icone: { glyphe: "feuille", fond: COULEURS.nature },
    def: "Réserves naturelles, Natura 2000, arrêtés de biotope, Conservatoire du littoral, parc naturel régional. Contexte, pas pollution." },
];
const sansAccent = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[-']/g, " ").trim();
function emprise(geoms) {
  let b = [180, 90, -180, -90];
  const visite = (c) => (typeof c[0] === "number" ? (b = [Math.min(b[0], c[0]), Math.min(b[1], c[1]), Math.max(b[2], c[0]), Math.max(b[3], c[1])]) : c.forEach(visite));
  geoms.forEach((g) => visite(g.coordinates));
  return b;
}
const PREUVES = ["mesure_publiee", "diagnostic_administratif", "procedure_en_cours", "signalement_non_instruit"];

const typeDe = (p) => {
  if (p.categorie === "projet_decharge") return "projets";
  if (p.categorie === "eau_baignade") return "baignade";
  if (p.categorie === "ressource_eau" || p.categorie === "eau_distribuee") return "eau";
  if (p.categorie === "air") return "air";
  return "sols";
};

function hachures(couleur, pas = 8, epaisseur = 1.5) {
  const t = pas * 2;
  const c = document.createElement("canvas");
  c.width = c.height = t;
  const x = c.getContext("2d");
  x.strokeStyle = couleur;
  x.lineWidth = epaisseur;
  for (let i = -t; i < t * 2; i += pas) {
    x.beginPath();
    x.moveTo(i, t);
    x.lineTo(i + t, 0);
    x.stroke();
  }
  return x.getImageData(0, 0, t, t);
}

async function chargerSvg(m, cle, svg) {
  if (m.hasImage(cle)) return;
  const img = new Image(96, 96);
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await img.decode();
  if (!m.hasImage(cle)) m.addImage(cle, img, { pixelRatio: 2 });
}
const chargerIcone = (m, cle, o) => chargerSvg(m, cle, svgIcone(o));

// Taille affichée d'un pictogramme selon le zoom, en pixels (image de 48 px à l'échelle 1).
const TAILLES = [[9, 0.6], [12, 0.7], [15, 0.85]];
// Sur petit écran, pictogrammes réduits pour que la vue d'ensemble reste lisible.
const facteur = (m) => (m.getContainer().clientWidth < 600 ? 0.72 : 1);
const tailleExpr = (f) => ["interpolate", ["linear"], ["zoom"], ...TAILLES.flatMap(([z, s]) => [z, s * f])];
function echelle(z) {
  if (z <= TAILLES[0][0]) return TAILLES[0][1];
  for (let k = 1; k < TAILLES.length; k++) {
    const [z0, s0] = TAILLES[k - 1], [z1, s1] = TAILLES[k];
    if (z <= z1) return s0 + ((s1 - s0) * (z - z0)) / (z1 - z0);
  }
  return TAILLES.at(-1)[1];
}

// Écarte les pictogrammes qui se chevauchent à l'écran, au zoom courant, et relie chacun à sa vraie position.
function etaler(m, features) {
  const d = 48 * echelle(m.getZoom()) * facteur(m) * 0.95;
  const pts = features.map((f, i) => {
    const q = m.project(f.geometry.coordinates);
    return { f, x0: q.x, y0: q.y, x: q.x + Math.cos(i * 2.4) * 0.01, y: q.y + Math.sin(i * 2.4) * 0.01 };
  });
  for (let it = 0; it < 80; it++) {
    let bouge = false;
    for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) {
      const A = pts[a], B = pts[b];
      const dx = B.x - A.x, dy = B.y - A.y, l = Math.hypot(dx, dy);
      if (l >= d) continue;
      const k = (d - l) / 2 / (l || 1);
      A.x -= dx * k; A.y -= dy * k; B.x += dx * k; B.y += dy * k;
      bouge = true;
    }
    for (const P of pts) { P.x += (P.x0 - P.x) * 0.02; P.y += (P.y0 - P.y) * 0.02; }
    if (!bouge) break;
  }
  const points = [], liens = [];
  for (const P of pts) {
    const ll = m.unproject([P.x, P.y]).toArray();
    points.push({ ...P.f, geometry: { type: "Point", coordinates: ll } });
    if (Math.hypot(P.x - P.x0, P.y - P.y0) > 6) {
      liens.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [P.f.geometry.coordinates, ll] } });
      liens.push({ type: "Feature", properties: { origine: true }, geometry: P.f.geometry });
    }
  }
  return { points: { type: "FeatureCollection", features: points }, liens: { type: "FeatureCollection", features: liens } };
}

// Monde moins la commune : voile blanc qui isole la commune choisie.
function masqueHors(geom) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[-10, 40], [10, 40], [10, 52], [-10, 52], [-10, 40]], ...polys.map((p) => p[0])] } };
}

// Captages reliés à une commune : par les réseaux qui la desservent, ou situés sur son territoire.
function captagesDe(donnees, code, nom) {
  const reseaux = donnees.robinets?.communes[code]?.reseaux ?? [];
  const codes = new Set(reseaux.flatMap((k) => (donnees.installations?.[k]?.installations ?? []).flatMap((i) => i.captages)));
  for (const f of donnees.captages?.features ?? []) if (f.properties.commune === nom) codes.add(f.properties.code);
  return [...codes];
}

export default function Carte({ bandeau }) {
  const conteneur = useRef(null);
  const carte = useRef(null);
  const survol = useRef(null);
  const [donnees, setDonnees] = useState(null);
  const [agri, setAgri] = useState(null);
  const [actifs, setActifs] = useState({ sol: true, eau: true, air: true, sante: true, agriculture: false, nature: false });
  const [focus, setFocus] = useState(null);
  const focusRef = useRef(null);
  const visiblesRef = useRef([]);
  const redessiner = useRef(null);
  focusRef.current = focus;
  const [nature, setNature] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [messageRecherche, setMessageRecherche] = useState("");
  const [preuves, setPreuves] = useState(Object.fromEntries(PREUVES.map((p) => [p, true])));
  const [rehabilites, setRehabilites] = useState(false);
  const [selection, setSelection] = useState(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    fetch("/data/carte.json")
      .then((r) => r.json())
      .then((d) => {
        for (const col of [d.reperes, d.surfaces]) for (const f of col.features) {
          const p = f.properties;
          p.type = typeDe(p);
          const o = iconeSite(p);
          p.icone = cleIcone(o);
          p.iconeDef = o;
          p.iconeUrl = urlIcone(o);
          p.couleur = o.fond;
        }
        if (d.robinets) for (const f of d.robinets.points.features) {
          const o = { glyphe: "robinet", fond: COULEURS[f.properties.etat] ?? COULEURS.gris, carre: true };
          f.properties.icone = cleIcone(o);
          f.properties.iconeDef = o;
        }
        // Une seule source pour tous les pictogrammes, regroupés quand ils se chevauchent.
        const pt = (f, couche, extra) => ({ type: "Feature", geometry: f.geometry, properties: { ...f.properties, iconeDef: undefined, couche, ...extra } });
        d.points = ([
          ...d.reperes.features.map((f) => pt(f, "site")),
          ...(d.robinets?.points.features ?? []).map((f) => pt(f, "robinet", { communes: f.properties.code_insee })),
          ...(d.captages?.features ?? []).map((f) => pt(f, "captage", { icone: "captage" })),
        ]);
        setDonnees(d);
      })
      .catch(() => setDonnees({ erreur: true }));
    fetch("/data/agriculture.json").then((r) => r.json()).then(setAgri).catch(() => {});
  }, []);

  useEffect(() => {
    if (!donnees || donnees.erreur || carte.current) return;
    const m = new maplibregl.Map({
      container: conteneur.current,
      style: {
        version: 8,
        sources: {
          osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: "© contributeurs OpenStreetMap" },
        },
        layers: [
          { id: "fond", type: "background", paint: { "background-color": "#e8f1f6" } },
          { id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.55, "raster-opacity": 0.85, "raster-contrast": -0.05 } },
        ],
      },
      bounds: [-1.26, 46.03, -0.93, 46.27],
      fitBoundsOptions: { padding: 20 },
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

    m.on("load", async () => {
      m.addImage("hachure-signaux", hachures(COULEURS.signaux, 8, 1.6), { pixelRatio: 2 });
      m.addImage("hachure-signaux-presse", hachures(COULEURS.signaux, 14, 1), { pixelRatio: 2 });
      m.addImage("hachure-bio", hachures(COULEURS.bio, 7, 1.3), { pixelRatio: 2 });

      const icones = new Map();
      for (const f of donnees.reperes.features) icones.set(f.properties.icone, f.properties.iconeDef);
      for (const f of donnees.robinets?.points.features ?? []) icones.set(f.properties.icone, f.properties.iconeDef);
      icones.set("captage", { glyphe: "captage", fond: COULEURS.eau });
      await Promise.all([...icones].map(([k, o]) => chargerIcone(m, k, o)));

      m.addSource("agriculture", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addSource("communes", { type: "geojson", data: donnees.communes });
      m.addSource("signaux", { type: "geojson", data: donnees.signaux });
      m.addSource("surfaces", { type: "geojson", data: donnees.surfaces });
      m.addSource("points", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addSource("liens", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addSource("captages", { type: "geojson", data: donnees.captages ?? { type: "FeatureCollection", features: [] } });
      m.addSource("masque", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      const famille = ["get", "famille"];
      m.addLayer({
        id: "agri-conv", type: "fill", source: "agriculture", filter: ["==", ["get", "couche"], "conventionnel"],
        paint: {
          "fill-color": ["match", famille, "prairies", COULEURS.prairie, "gel", COULEURS.gel, COULEURS.conventionnel],
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.42, 14, 0.28],
        },
      });
      m.addLayer({ id: "agri-bio-fond", type: "fill", source: "agriculture", filter: ["==", ["get", "couche"], "bio"], paint: { "fill-color": "#86efac", "fill-opacity": 0.45 } });
      m.addLayer({ id: "agri-bio", type: "fill", source: "agriculture", filter: ["==", ["get", "couche"], "bio"], paint: { "fill-pattern": "hachure-bio" } });

      m.addSource("nature", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "nature-fond", type: "fill", source: "nature", layout: { visibility: "none" }, paint: { "fill-color": COULEURS.nature, "fill-opacity": 0.14 } });
      m.addLayer({ id: "nature-trait", type: "line", source: "nature", layout: { visibility: "none" }, paint: { "line-color": COULEURS.nature, "line-width": 1.4, "line-dasharray": [3, 2] } });

      m.addLayer({ id: "communes-fond", type: "fill", source: "communes", paint: { "fill-color": "#ffffff", "fill-opacity": 0.01 } });
      m.addLayer({ id: "communes-trait", type: "line", source: "communes", paint: { "line-color": "#0d2b45", "line-width": 1, "line-opacity": 0.45 } });

      m.addLayer({
        id: "signaux-fond", type: "fill", source: "signaux",
        paint: { "fill-pattern": ["case", ["==", ["get", "niveau_source"], "presse"], "hachure-signaux-presse", "hachure-signaux"], "fill-opacity": 0.75 },
      });
      m.addLayer({
        id: "signaux-trait", type: "line", source: "signaux",
        paint: { "line-color": COULEURS.signaux, "line-width": ["case", ["==", ["get", "niveau_source"], "presse"], 1.2, 2.2], "line-dasharray": [2, 1.5] },
      });

      m.addLayer({ id: "masque", type: "fill", source: "masque", paint: { "fill-color": "#f4f7fa", "fill-opacity": 0.82 } });
      m.addLayer({ id: "commune-focus", type: "line", source: "communes", filter: ["==", ["get", "code_insee"], ""], paint: { "line-color": "#0d2b45", "line-width": 2.6 } });

      const couleurSurface = ["case", ["==", ["get", "type"], "baignade"],
        ["match", ["coalesce", ["get", "baignade_couleur"], "gris"], "vert", COULEURS.vert, "orange", COULEURS.orange, "rouge", COULEURS.rouge, COULEURS.gris],
        ["match", ["get", "type"], "projets", COULEURS.projets, "air", COULEURS.air, "eau", COULEURS.eau, COULEURS.sols]];
      m.addLayer({ id: "surfaces-fond", type: "fill", source: "surfaces", minzoom: 11.5, paint: { "fill-color": couleurSurface, "fill-opacity": ["case", ["==", ["get", "type"], "baignade"], 0.35, 0.16] } });
      m.addLayer({ id: "surfaces-trait", type: "line", source: "surfaces", minzoom: 11.5, paint: { "line-color": couleurSurface, "line-width": 1.2, "line-dasharray": [2, 1.5] } });

      m.addLayer({
        id: "captages-selection", type: "circle", source: "captages", filter: ["in", ["get", "code"], ["literal", []]],
        paint: { "circle-radius": 34, "circle-color": "rgba(3,105,161,0.18)", "circle-stroke-color": COULEURS.eau, "circle-stroke-width": 3 },
      });
      const taille = tailleExpr(facteur(m));
      m.addLayer({ id: "liens", type: "line", source: "liens", filter: ["!", ["has", "origine"]], paint: { "line-color": "#0d2b45", "line-width": 1.3, "line-opacity": 0.55 } });
      m.addLayer({ id: "liens-origine", type: "circle", source: "liens", filter: ["has", "origine"], paint: { "circle-radius": 3, "circle-color": "#0d2b45", "circle-stroke-color": "#fff", "circle-stroke-width": 1 } });
      m.addLayer({
        id: "points", type: "symbol", source: "points", 
        layout: { "icon-image": ["get", "icone"], "icon-size": taille, "icon-allow-overlap": true, "icon-ignore-placement": true },
        paint: { "icon-opacity": ["case", ["==", ["get", "preuve"], "procedure_en_cours"], 0.8, 1] },
      });
      m.addLayer({
        id: "captages-grands", type: "symbol", source: "captages", filter: ["in", ["get", "code"], ["literal", []]],
        layout: { "icon-image": "captage", "icon-size": 1.05, "icon-allow-overlap": true },
      });
      m.addLayer({
        id: "selection", type: "circle", source: "points", filter: ["==", ["get", "id"], ""],
        paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 17, 15, 23], "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#0d2b45", "circle-stroke-width": 3 },
      });

      redessiner.current = () => {
        const r = etaler(m, visiblesRef.current);
        m.getSource("points").setData(r.points);
        m.getSource("liens").setData(r.liens);
      };
      m.on("zoomend", () => redessiner.current());
      m.on("resize", () => {
        m.setLayoutProperty("points", "icon-size", tailleExpr(facteur(m)));
        redessiner.current();
      });

      survol.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "survol", offset: 16 });
      const visibles = (ids) => ids.filter((id) => m.getLayer(id) && m.getLayoutProperty(id, "visibility") !== "none");
      const cliquables = () => visibles(["points", "surfaces-fond"]);

      m.on("mousemove", (e) => {
        const f = m.queryRenderedFeatures(e.point, { layers: cliquables() });
        m.getCanvas().style.cursor = f.length ? "pointer" : "";
        if (!f.length) return survol.current.remove();
        const p = f[0].properties;
        const titre = p.couche === "robinet" ? `Eau du robinet, ${p.nom}` : p.accroche ?? p.nom;
        const sous = p.couche === "robinet" ? ETATS_EAU[p.etat]?.libelle : p.couche === "captage" ? "captage d'eau potable" : p.type === "baignade" ? ETATS_PLAGE[p.baignade_couleur]?.libelle : p.preuve_libelle;
        survol.current.setLngLat(e.lngLat).setHTML("<b></b><span></span>").addTo(m);
        const el = survol.current.getElement();
        el.querySelector("b").textContent = titre;
        el.querySelector("span").textContent = sous ? ` · ${sous}` : "";
      });
      m.on("mouseout", () => survol.current?.remove());

      m.on("click", (e) => {
        survol.current?.remove();
        const f = m.queryRenderedFeatures(e.point, { layers: cliquables() });
        if (f.length) {
          const p = f[0].properties;
          if (p.couche === "robinet") return setSelection({ genre: "robinet", code: p.code_insee });
          if (p.couche === "captage") return setSelection({ genre: "captage", props: p });
          return setSelection({ genre: "site", id: p.id });
        }
        const com = m.queryRenderedFeatures(e.point, { layers: ["communes-fond"] });
        // En mode commune, un clic hors de la commune revient à l'agglomération entière.
        if (focusRef.current && com[0]?.properties.code_insee !== focusRef.current) {
          setFocus(null);
          setSelection(null);
          return;
        }
        const sig = m.queryRenderedFeatures(e.point, { layers: visibles(["signaux-fond"]) });
        if (sig.length) return setSelection({ genre: "signal", id: sig[0].properties.id });
        const nat = m.queryRenderedFeatures(e.point, { layers: visibles(["nature-fond"]) });
        if (nat.length) return setSelection({ genre: "nature", props: nat[0].properties });
        const ag = m.queryRenderedFeatures(e.point, { layers: visibles(["agri-bio", "agri-conv"]) });
        if (ag.length) return setSelection({ genre: "agri", props: ag[0].properties, commune: com[0]?.properties?.nom });
        if (com.length) {
          setFocus(com[0].properties.code_insee);
          return setSelection({ genre: "commune", code: com[0].properties.code_insee });
        }
        setSelection(null);
      });
      setPret(true);
    });
    carte.current = m;
    if (typeof window !== "undefined") window.__carte = m;
    return () => {
      m.remove();
      carte.current = null;
    };
  }, [donnees]);

  useEffect(() => {
    if (carte.current && pret && agri) carte.current.getSource("agriculture").setData(agri);
  }, [agri, pret]);

  useEffect(() => {
    if (!actifs.nature || nature) return;
    fetch("/data/nature.json").then((r) => r.json()).then(setNature).catch(() => {});
  }, [actifs.nature, nature]);
  useEffect(() => {
    if (carte.current && pret && nature) carte.current.getSource("nature").setData(nature);
  }, [nature, pret]);

  const nomFocus = focus ? donnees?.communes.features.find((f) => f.properties.code_insee === focus)?.properties.nom : null;
  const dansFocus = (p) => !focus || (p.communes ?? "").split(",").includes(focus) || (p.couche === "captage" && captagesFocus.includes(p.code));
  const captagesFocus = useMemo(() => (focus && donnees ? captagesDe(donnees, focus, nomFocus) : []), [focus, donnees, nomFocus]);

  useEffect(() => {
    const m = carte.current;
    if (!m || !pret) return;
    const types = GROUPES.filter((g) => actifs[g.id]).flatMap((g) => g.types);
    const niv = PREUVES.filter((p) => preuves[p]);
    const garde = (p) => {
      if (!dansFocus(p)) return false;
      if (p.couche === "robinet" || p.couche === "captage") return actifs.eau;
      return types.includes(p.type) && niv.includes(p.preuve) && (rehabilites || !p.rehabilite);
    };
    visiblesRef.current = donnees.points.filter((f) => garde(f.properties));
    redessiner.current?.();
    const filtre = ["all", ["in", ["get", "type"], ["literal", types]], ["in", ["get", "preuve"], ["literal", niv]]];
    if (!rehabilites) filtre.push(["!", ["get", "rehabilite"]]);
    if (focus) filtre.push(["in", focus, ["get", "communes"]]);
    for (const id of ["surfaces-fond", "surfaces-trait"]) m.setFilter(id, filtre);
    const vis = (ids, on) => ids.forEach((id) => m.setLayoutProperty(id, "visibility", on ? "visible" : "none"));
    vis(["signaux-fond", "signaux-trait"], actifs.sante);
    vis(["captages-selection", "captages-grands"], actifs.eau);
    vis(["agri-conv", "agri-bio-fond", "agri-bio"], actifs.agriculture);
    vis(["nature-fond", "nature-trait"], actifs.nature);
    // Commune choisie : voile autour, contour appuyé, cadrage.
    const com = focus ? donnees.communes.features.find((f) => f.properties.code_insee === focus) : null;
    m.getSource("masque").setData({ type: "FeatureCollection", features: com ? [masqueHors(com.geometry)] : [] });
    m.setFilter("commune-focus", ["==", ["get", "code_insee"], focus ?? ""]);
    m.setPaintProperty("communes-trait", "line-opacity", focus ? 0 : 0.45);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actifs, preuves, rehabilites, pret, focus, captagesFocus]);

  useEffect(() => {
    const m = carte.current;
    if (!m || !pret) return;
    const com = focus ? donnees.communes.features.find((f) => f.properties.code_insee === focus) : null;
    if (com) m.fitBounds(emprise([com.geometry]), { padding: 50, maxZoom: 14, duration: 800 });
    else m.fitBounds([-1.26, 46.03, -0.93, 46.27], { padding: 20, duration: 800 });
  }, [focus, pret, donnees]);

  useEffect(() => {
    const m = carte.current;
    if (!m || !pret) return;
    m.setFilter("selection", ["==", ["get", "id"], selection?.genre === "site" ? selection.id : ""]);
    // Robinet : on met en avant les captages reliés et on cadre commune et captages ensemble.
    let codes = [];
    if (selection?.genre === "robinet" && donnees?.robinets) {
      const reseaux = donnees.robinets.communes[selection.code]?.reseaux ?? [];
      codes = reseaux.flatMap((k) => (donnees.installations?.[k]?.installations ?? []).flatMap((i) => i.captages));
      const com = donnees.communes.features.find((f) => f.properties.code_insee === selection.code);
      const caps = (donnees.captages?.features ?? []).filter((f) => codes.includes(f.properties.code));
      if (com) m.fitBounds(emprise([com.geometry, ...caps.map((f) => f.geometry)]), { padding: 70, maxZoom: 13, duration: 900 });
    }
    m.setFilter("captages-selection", ["in", ["get", "code"], ["literal", codes]]);
    m.setFilter("captages-grands", ["in", ["get", "code"], ["literal", codes]]);
  }, [selection, pret, donnees]);

  const chercher = (e) => {
    e.preventDefault();
    if (!donnees) return;
    const q = sansAccent(recherche.replace(/\(.*\)/, ""));
    if (!q) return;
    const cps = donnees.codes_postaux ?? {};
    const toutes = donnees.communes.features;
    let trouvees = /^\d{5}$/.test(q)
      ? toutes.filter((f) => (cps[f.properties.code_insee] ?? []).includes(q))
      : toutes.filter((f) => sansAccent(f.properties.nom) === q);
    if (!trouvees.length && !/^\d/.test(q)) trouvees = toutes.filter((f) => sansAccent(f.properties.nom).includes(q));
    if (!trouvees.length) return setMessageRecherche("Hors des 28 communes ou introuvable.");
    setMessageRecherche(trouvees.length > 1 ? `${trouvees.length} communes : ${trouvees.map((f) => f.properties.nom).join(", ")}` : "");
    if (trouvees.length === 1) {
      setFocus(trouvees[0].properties.code_insee);
      setSelection({ genre: "commune", code: trouvees[0].properties.code_insee });
    } else {
      setFocus(null);
      carte.current?.fitBounds(emprise(trouvees.map((f) => f.geometry)), { padding: 50, duration: 900 });
    }
  };

  const proprietes = useMemo(() => (donnees?.reperes?.features ?? []).map((f) => f.properties), [donnees]);
  const compte = (g) => {
    if (g.id === "sante") return donnees?.signaux_liste?.length ?? 0;
    if (g.id === "agriculture" || g.id === "nature") return null;
    const n = proprietes.filter((p) => g.types.includes(p.type) && (rehabilites || !p.rehabilite) && dansFocus(p)).length;
    if (g.id !== "eau") return n;
    return n + (donnees?.points ?? []).filter((f) => (f.properties.couche === "robinet" || f.properties.couche === "captage") && dansFocus(f.properties)).length;
  };
  const comptePreuve = (id) => proprietes.filter((p) => p.preuve === id && (rehabilites || !p.rehabilite) && dansFocus(p)).length;
  const nbRehabilites = proprietes.filter((p) => p.rehabilite).length;
  const lib = donnees?.libelles;

  // Code postal de la commune cliquée, pour les achats de pesticides.
  const codePostalDe = (nom) => {
    if (!nom || !donnees?.achats) return null;
    return Object.entries(donnees.achats.codes_postaux).find(([, v]) => v.split(", ").includes(nom))?.[0] ?? null;
  };

  let panneau = null;
  const fermer = () => setSelection(null);
  const quitterCommune = () => {
    setFocus(null);
    setSelection(null);
    setRecherche("");
  };
  if (selection?.genre === "site") {
    const p = proprietes.find((x) => x.id === selection.id);
    if (p) panneau = <PanneauSite p={p} d={donnees.details[p.id]} libelles={lib} fermer={fermer} icone={p.iconeUrl} />;
  } else if (selection?.genre === "robinet") {
    const c = donnees.communes.features.find((f) => f.properties.code_insee === selection.code)?.properties;
    if (c) panneau = <PanneauRobinet key={c.code_insee} commune={c} robinets={donnees.robinets} eau={donnees.eau} installations={donnees.installations} captages={donnees.captages} fermer={fermer} />;
  } else if (selection?.genre === "captage") {
    panneau = <PanneauCaptage p={selection.props} fermer={fermer} />;
  } else if (selection?.genre === "commune" || (!selection && focus)) {
    const code = selection?.code ?? focus;
    const c = donnees.communes.features.find((f) => f.properties.code_insee === code)?.properties;
    if (c) panneau = <PanneauCommune key={c.code_insee} c={c} donnees={donnees} actifs={actifs} fermer={quitterCommune} />;
  } else if (selection?.genre === "signal") {
    const s = donnees.signaux_liste.find((x) => x.id === selection.id);
    if (s) panneau = <PanneauSignal s={s} bandeau={bandeau} fermer={fermer} />;
  } else if (selection?.genre === "nature") {
    panneau = <PanneauNature p={selection.props} fermer={fermer} />;
  } else if (selection?.genre === "agri") {
    panneau = <PanneauAgri p={selection.props} agri={agri} achats={donnees.achats} codePostal={codePostalDe(selection.commune)} fermer={fermer} />;
  }

  return (
    <div className="appli">
      <header className="entete">
        <a href="/" className="titre">
          Pollutions documentées <span>agglomération de La Rochelle</span>
        </a>
        <nav>
          <a href="/fiches">Toutes les fiches</a>
          <a href="/eau-du-robinet">Eau du robinet</a>
          <a href="/signaux-sanitaires">Signaux sanitaires</a>
          <a href="/restrictions">Restrictions d&apos;usage</a>
          <a href="/mentions-legales">Méthode</a>
        </nav>
      </header>

      <div className="filtres" role="group" aria-label="Filtres de la carte">
      <form className="recherche" onSubmit={chercher} role="search">
        <input
          type="search" list="liste-communes" value={recherche} onChange={(e) => { setRecherche(e.target.value); setMessageRecherche(""); }}
          placeholder="Commune ou code postal" aria-label="Rechercher une commune ou un code postal"
        />
        <datalist id="liste-communes">
          {(donnees?.communes?.features ?? []).map((f) => (
            <option key={f.properties.code_insee} value={`${f.properties.nom} (${(donnees.codes_postaux?.[f.properties.code_insee] ?? []).join(", ")})`} />
          ))}
        </datalist>
        <button type="submit">Aller</button>
        {nomFocus ? (
          <button type="button" className="quitter-commune" onClick={quitterCommune}>
            {nomFocus} <span aria-hidden="true">×</span> <span className="sr">revenir à toute l&apos;agglomération</span>
          </button>
        ) : null}
        {messageRecherche ? <span className="recherche-message">{messageRecherche}</span> : null}
      </form>
        <div className="filtres-ligne">
          {GROUPES.map((g) => {
            const n = compte(g);
            return (
              <button key={g.id} type="button" className={`puce ${actifs[g.id] ? "active" : ""} ${g.id === "nature" ? "contexte" : ""}`} aria-pressed={actifs[g.id]}
                onClick={() => setActifs({ ...actifs, [g.id]: !actifs[g.id] })}>
                {g.icone ? <img src={urlIcone(g.icone)} alt="" width="22" height="22" /> : g.hachure ? <span className="pastille-couleur hachure" /> : <span className="pastille-couleur bicolore" />}
                {g.libelle}
                {n != null ? <em>{n}</em> : null}
                <Definition titre={g.libelle}>{g.def}</Definition>
              </button>
            );
          })}
        </div>
        <div className="filtres-ligne secondaire">
          <span className="filtres-titre">Niveau de preuve</span>
          {PREUVES.map((id) => (
            <button key={id} type="button" className={`puce petite ${preuves[id] ? "active" : ""}`} aria-pressed={preuves[id]}
              onClick={() => setPreuves({ ...preuves, [id]: !preuves[id] })}>
              <span className={`marque ${id}`} />
              {lib?.statut_preuve?.[id]?.libelle ?? id}
              <em>{comptePreuve(id)}</em>
              {lib ? <Definition titre={lib.statut_preuve[id].libelle}>{lib.statut_preuve[id].definition}</Definition> : null}
            </button>
          ))}
          <button type="button" className={`puce petite ${rehabilites ? "active" : ""}`} aria-pressed={rehabilites} onClick={() => setRehabilites(!rehabilites)}>
            <span className="marque rehabilite" />
            {rehabilites ? "Masquer" : "Afficher"} les {nbRehabilites} sites réhabilités
            {lib ? <Definition titre="Sites réhabilités">{lib.statut_traitement.rehabilite.definition} Masqués par défaut pour alléger la carte.</Definition> : null}
          </button>
        </div>
      </div>

      <div className="corps">
        <div className="carte-zone">
          <div ref={conteneur} className="carte-fond" role="region" aria-label="Carte des pollutions documentées" />
          {actifs.sante ? (
            <p className="bandeau-carte">
              Hachures roses : signaux sanitaires, sans lien de cause établi avec la carte. <a href="/signaux-sanitaires">Les études</a>
            </p>
          ) : null}
          {donnees?.erreur ? <p className="erreur-carte">Les données de la carte n&apos;ont pas pu être chargées.</p> : null}
        </div>

        <aside className={`panneau ${panneau ? "avec-fiche" : ""}`} aria-live="polite">
          {panneau ?? (
            <div className="pan-accueil">
              <h1>Ce qui est documenté sous l&apos;agglomération de La Rochelle</h1>
              <p>
                Pollutions mesurées, diagnostiquées ou instruites par l&apos;administration sur les 28 communes. Cherchez votre commune pour n&apos;afficher qu&apos;elle, ou cliquez un pictogramme pour lire ce
                qui est mesuré, à quelle date et par qui.
              </p>
              <h3>Plages</h3>
              <ul className="legende">
                {Object.entries(ETATS_PLAGE).map(([k, e]) => (
                  <li key={k}><img src={urlIcone({ glyphe: "plage", fond: COULEURS[k] })} alt="" width="24" height="24" />{e.libelle}</li>
                ))}
              </ul>
              <h3>Eau du robinet, douze derniers mois</h3>
              <ul className="legende">
                {Object.entries(ETATS_EAU).map(([k, e]) => (
                  <li key={k}><img src={urlIcone({ glyphe: "robinet", fond: COULEURS[k] ?? COULEURS.gris, carre: true })} alt="" width="24" height="24" />{e.libelle}</li>
                ))}
                <li><img src={urlIcone({ glyphe: "captage", fond: COULEURS.eau })} alt="" width="24" height="24" />Captage d&apos;eau potable</li>
                <li><img src={urlIcone({ glyphe: "goutte", fond: COULEURS.eau })} alt="" width="24" height="24" />Nappe ou canal : nitrates au-dessus de 50 mg/l</li>
                <li><img src={urlIcone({ glyphe: "usine", fond: COULEURS.eau })} alt="" width="24" height="24" />Rejets d&apos;eaux industrielles au-dessus des limites</li>
              </ul>
              <p className="note">Les pictogrammes trop proches sont écartés ; un trait les relie à leur position réelle, marquée d&apos;un point.</p>
              <h3>Sol et air</h3>
              <ul className="legende">
                <li><img src={urlIcone({ glyphe: "usine", fond: COULEURS.sols })} alt="" width="24" height="24" />Sol ou nappe pollué, mesuré ou diagnostiqué</li>
                <li><img src={urlIcone({ glyphe: "decharge", fond: COULEURS.sols })} alt="" width="24" height="24" />Ancienne décharge</li>
                <li><img src={urlIcone({ glyphe: "usine", fond: COULEURS.sols, creux: true })} alt="" width="24" height="24" />Pictogramme creux : signalé, jamais instruit</li>
                <li><img src={urlIcone({ glyphe: "radioactif", fond: COULEURS.sols })} alt="" width="24" height="24" />Radioactivité</li>
                <li><img src={urlIcone({ glyphe: "usine", fond: COULEURS.vert })} alt="" width="24" height="24" />Site réhabilité, affiché à la demande</li>
                <li><img src={urlIcone({ glyphe: "vent", fond: COULEURS.air })} alt="" width="24" height="24" />Pesticides mesurés dans l&apos;air</li>
                <li><img src={urlIcone({ glyphe: "cheminee", fond: COULEURS.air })} alt="" width="24" height="24" />Émissions industrielles</li>
              </ul>
              <h3>Parcelles agricoles en 2023</h3>
              <ul className="legende">
                <li><span className="ech" style={{ background: COULEURS.conventionnel }} />Cultures conventionnelles, pesticides de synthèse autorisés</li>
                <li><span className="ech" style={{ background: COULEURS.prairie }} />Prairies et fourrages conventionnels</li>
                <li><span className="ech hachure-bio" />Agriculture biologique</li>
              </ul>
              {agri ? (
                <p className="note">
                  {nb(agri.surface_bio_ha)} ha en bio sur {nb(agri.surface_declaree_ha)} ha déclarés, soit{" "}
                  {nb(Math.round((agri.surface_bio_ha / agri.surface_declaree_ha) * 1000) / 10)} %.
                </p>
              ) : null}
              {donnees?.sans_localisation?.length ? (
                <>
                  <h3>Connus sans localisation</h3>
                  <ul className="pan-liste">
                    {donnees.sans_localisation.flatMap((c) =>
                      c.sites.map((s) => (
                        <li key={s.id}>
                          <a href={`/sites/${s.id}`}>{s.nom}</a> <span className="note">{c.commune}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </>
              ) : null}
              <p className="note">Données du {donnees?.genere_le ?? "…"}. Fond de carte © contributeurs OpenStreetMap.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
