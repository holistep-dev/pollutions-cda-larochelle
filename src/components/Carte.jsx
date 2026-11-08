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
  { id: "agriculture", libelle: "Agriculture", types: [], bicolore: true,
    def: "Parcelles conventionnelles, où les pesticides de synthèse sont autorisés, et parcelles bio, d'après les déclarations PAC 2023." },
  { id: "sante", libelle: "Santé", types: [], hachure: true,
    def: "Signaux sanitaires issus d'études épidémiologiques. Ce ne sont pas des pollutions. Aucun lien de cause à effet n'est établi avec la carte." },
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

async function chargerIcone(m, cle, o) {
  if (m.hasImage(cle)) return;
  const img = new Image(64, 64);
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgIcone(o));
  await img.decode();
  if (!m.hasImage(cle)) m.addImage(cle, img, { pixelRatio: 2 });
}

export default function Carte({ bandeau }) {
  const conteneur = useRef(null);
  const carte = useRef(null);
  const survol = useRef(null);
  const [donnees, setDonnees] = useState(null);
  const [agri, setAgri] = useState(null);
  const [actifs, setActifs] = useState({ sol: true, eau: true, air: true, agriculture: true, sante: true, nature: false });
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
      m.addSource("reperes", { type: "geojson", data: donnees.reperes });
      m.addSource("robinets", { type: "geojson", data: donnees.robinets?.points ?? { type: "FeatureCollection", features: [] } });
      m.addSource("captages", { type: "geojson", data: donnees.captages ?? { type: "FeatureCollection", features: [] } });

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

      const couleurSurface = ["case", ["==", ["get", "type"], "baignade"],
        ["match", ["coalesce", ["get", "baignade_couleur"], "gris"], "vert", COULEURS.vert, "orange", COULEURS.orange, "rouge", COULEURS.rouge, COULEURS.gris],
        ["match", ["get", "type"], "projets", COULEURS.projets, "air", COULEURS.air, "eau", COULEURS.eau, COULEURS.sols]];
      m.addLayer({ id: "surfaces-fond", type: "fill", source: "surfaces", minzoom: 11.5, paint: { "fill-color": couleurSurface, "fill-opacity": ["case", ["==", ["get", "type"], "baignade"], 0.35, 0.16] } });
      m.addLayer({ id: "surfaces-trait", type: "line", source: "surfaces", minzoom: 11.5, paint: { "line-color": couleurSurface, "line-width": 1.2, "line-dasharray": [2, 1.5] } });

      m.addLayer({
        id: "captages", type: "symbol", source: "captages",
        layout: { "icon-image": "captage", "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.45, 10.5, 0.65, 14, 0.9], "icon-allow-overlap": true },
      });
      m.addLayer({
        id: "captages-selection", type: "circle", source: "captages", filter: ["in", ["get", "code"], ["literal", []]],
        paint: { "circle-radius": 26, "circle-color": "rgba(3,105,161,0.18)", "circle-stroke-color": COULEURS.eau, "circle-stroke-width": 3 },
      });
      m.addLayer({
        id: "captages-grands", type: "symbol", source: "captages", filter: ["in", ["get", "code"], ["literal", []]],
        layout: { "icon-image": "captage", "icon-size": 1.5, "icon-allow-overlap": true },
      });
      m.addLayer({
        id: "reperes", type: "symbol", source: "reperes",
        layout: { "icon-image": ["get", "icone"], "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.5, 10.5, 0.75, 14, 1], "icon-allow-overlap": true, "symbol-sort-key": ["case", ["==", ["get", "type"], "baignade"], 1, 2] },
        paint: { "icon-opacity": ["case", ["==", ["get", "preuve"], "procedure_en_cours"], 0.7, 1] },
      });
      m.addLayer({
        id: "robinets", type: "symbol", source: "robinets",
        layout: { "icon-image": ["get", "icone"], "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.5, 10.5, 0.75, 14, 1], "icon-allow-overlap": true },
      });
      m.addLayer({
        id: "selection", type: "circle", source: "reperes", filter: ["==", ["get", "id"], ""],
        paint: { "circle-radius": 20, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#0d2b45", "circle-stroke-width": 3 },
      });

      survol.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "survol", offset: 16 });
      const visibles = (ids) => ids.filter((id) => m.getLayer(id) && m.getLayoutProperty(id, "visibility") !== "none");
      const cliquables = () => visibles(["robinets", "captages", "reperes", "surfaces-fond"]);

      m.on("mousemove", (e) => {
        const f = m.queryRenderedFeatures(e.point, { layers: cliquables() });
        m.getCanvas().style.cursor = f.length ? "pointer" : "";
        if (!f.length) return survol.current.remove();
        const p = f[0].properties;
        const titre = f[0].layer.id === "robinets" ? `Eau du robinet, ${p.nom}` : p.nom;
        const sous = f[0].layer.id === "robinets" ? ETATS_EAU[p.etat]?.libelle : f[0].layer.id === "captages" ? "captage d'eau potable" : p.type === "baignade" ? ETATS_PLAGE[p.baignade_couleur]?.libelle : p.preuve_libelle;
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
          const l = f[0].layer.id;
          if (l === "robinets") return setSelection({ genre: "robinet", code: f[0].properties.code_insee });
          if (l === "captages") return setSelection({ genre: "captage", props: f[0].properties });
          return setSelection({ genre: "site", id: f[0].properties.id });
        }
        const sig = m.queryRenderedFeatures(e.point, { layers: visibles(["signaux-fond"]) });
        if (sig.length) return setSelection({ genre: "signal", id: sig[0].properties.id });
        const nat = m.queryRenderedFeatures(e.point, { layers: visibles(["nature-fond"]) });
        if (nat.length) return setSelection({ genre: "nature", props: nat[0].properties });
        const com = m.queryRenderedFeatures(e.point, { layers: ["communes-fond"] });
        const ag = m.queryRenderedFeatures(e.point, { layers: visibles(["agri-bio", "agri-conv"]) });
        if (ag.length) return setSelection({ genre: "agri", props: ag[0].properties, commune: com[0]?.properties?.nom });
        if (com.length) return setSelection({ genre: "commune", code: com[0].properties.code_insee });
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

  useEffect(() => {
    const m = carte.current;
    if (!m || !pret) return;
    const types = GROUPES.filter((g) => actifs[g.id]).flatMap((g) => g.types);
    const niv = PREUVES.filter((p) => preuves[p]);
    const filtre = ["all", ["in", ["get", "type"], ["literal", types]], ["in", ["get", "preuve"], ["literal", niv]]];
    if (!rehabilites) filtre.push(["!", ["get", "rehabilite"]]);
    for (const id of ["surfaces-fond", "surfaces-trait", "reperes"]) m.setFilter(id, filtre);
    const vis = (ids, on) => ids.forEach((id) => m.setLayoutProperty(id, "visibility", on ? "visible" : "none"));
    vis(["signaux-fond", "signaux-trait"], actifs.sante);
    vis(["robinets", "captages", "captages-selection", "captages-grands"], actifs.eau);
    vis(["agri-conv", "agri-bio-fond", "agri-bio"], actifs.agriculture);
    vis(["nature-fond", "nature-trait"], actifs.nature);
  }, [actifs, preuves, rehabilites, pret]);

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
    carte.current?.fitBounds(emprise(trouvees.map((f) => f.geometry)), { padding: 50, duration: 900 });
    if (trouvees.length === 1) setSelection({ genre: "commune", code: trouvees[0].properties.code_insee });
  };

  const proprietes = useMemo(() => (donnees?.reperes?.features ?? []).map((f) => f.properties), [donnees]);
  const compte = (g) => {
    if (g.id === "sante") return donnees?.signaux_liste?.length ?? 0;
    if (g.id === "agriculture" || g.id === "nature") return null;
    const n = proprietes.filter((p) => g.types.includes(p.type) && (rehabilites || !p.rehabilite)).length;
    return g.id === "eau" ? n + (donnees?.robinets?.points.features.length ?? 0) + (donnees?.captages?.features.length ?? 0) : n;
  };
  const comptePreuve = (id) => proprietes.filter((p) => p.preuve === id && (rehabilites || !p.rehabilite)).length;
  const nbRehabilites = proprietes.filter((p) => p.rehabilite).length;
  const lib = donnees?.libelles;

  // Code postal de la commune cliquée, pour les achats de pesticides.
  const codePostalDe = (nom) => {
    if (!nom || !donnees?.achats) return null;
    return Object.entries(donnees.achats.codes_postaux).find(([, v]) => v.split(", ").includes(nom))?.[0] ?? null;
  };

  let panneau = null;
  const fermer = () => setSelection(null);
  if (selection?.genre === "site") {
    const p = proprietes.find((x) => x.id === selection.id);
    if (p) panneau = <PanneauSite p={p} d={donnees.details[p.id]} libelles={lib} fermer={fermer} icone={p.iconeUrl} />;
  } else if (selection?.genre === "robinet") {
    const c = donnees.communes.features.find((f) => f.properties.code_insee === selection.code)?.properties;
    if (c) panneau = <PanneauRobinet key={c.code_insee} commune={c} robinets={donnees.robinets} eau={donnees.eau} installations={donnees.installations} captages={donnees.captages} fermer={fermer} />;
  } else if (selection?.genre === "captage") {
    panneau = <PanneauCaptage p={selection.props} fermer={fermer} />;
  } else if (selection?.genre === "commune") {
    const c = donnees.communes.features.find((f) => f.properties.code_insee === selection.code)?.properties;
    if (c) panneau = <PanneauCommune key={c.code_insee} c={c} donnees={donnees} actifs={actifs} fermer={fermer} />;
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
          {messageRecherche ? <span className="recherche-message">{messageRecherche}</span> : null}
        </form>
      </header>

      <div className="filtres" role="group" aria-label="Filtres de la carte">
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
                Pollutions mesurées, diagnostiquées ou instruites par l&apos;administration sur les 28 communes. Cliquez un pictogramme pour lire ce
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
              </ul>
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
