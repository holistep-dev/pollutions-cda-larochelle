"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Couleurs par thème. Une couleur ne dit jamais la gravité : elle dit la nature du fait.
const COULEUR = {
  pollution_chimique: "#8a4b2f",
  projet: "#5b4b8a",
  ressource_eau: "#2f6f8f",
  signaux: "#9a6b1f",
};
const BAIGNADE = {
  Excellent: "#2f7d6b",
  Bon: "#6a9c4f",
  Suffisant: "#c39a2e",
  Insuffisant: "#b4533b",
};

const THEMES = [
  { id: "sols", libelle: "Sols pollués et décharges", couleur: COULEUR.pollution_chimique },
  { id: "projets", libelle: "Projets de décharge", couleur: COULEUR.projet },
  { id: "baignade", libelle: "Qualité des eaux de baignade", couleur: BAIGNADE.Bon },
  { id: "eau", libelle: "Ressource en eau", couleur: COULEUR.ressource_eau },
  { id: "signaux", libelle: "Signaux sanitaires", couleur: COULEUR.signaux },
];

// Filtre MapLibre de chaque thème, appliqué aux couches de sites.
const FILTRE_THEME = {
  sols: ["all", ["==", ["get", "theme"], "pollution_chimique"], ["!=", ["get", "categorie"], "projet_decharge"]],
  projets: ["==", ["get", "categorie"], "projet_decharge"],
  baignade: ["==", ["get", "theme"], "eaux_baignade"],
  eau: ["==", ["get", "theme"], "ressource_eau"],
};

const couleurSite = [
  "case",
  ["==", ["get", "categorie"], "projet_decharge"], COULEUR.projet,
  ["==", ["get", "theme"], "ressource_eau"], COULEUR.ressource_eau,
  ["==", ["get", "theme"], "eaux_baignade"],
  ["match", ["coalesce", ["get", "baignade_dernier"], "aucun"],
    "Excellent", BAIGNADE.Excellent, "Bon", BAIGNADE.Bon, "Suffisant", BAIGNADE.Suffisant,
    "Insuffisant", BAIGNADE.Insuffisant, "#7a7f7c"],
  COULEUR.pollution_chimique,
];

// Motif hachuré dessiné à la volée : ce qui est incertain ne reçoit pas d'aplat.
function hachures(couleur, pas = 8) {
  const t = pas * 2;
  const c = document.createElement("canvas");
  c.width = c.height = t;
  const x = c.getContext("2d");
  x.strokeStyle = couleur;
  x.lineWidth = 1.5;
  for (let i = -t; i < t * 2; i += pas) {
    x.beginPath();
    x.moveTo(i, t);
    x.lineTo(i + t, 0);
    x.stroke();
  }
  return x.getImageData(0, 0, t, t);
}

const echapper = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export default function Carte({ bandeau }) {
  const conteneur = useRef(null);
  const carte = useRef(null);
  const [donnees, setDonnees] = useState(null);
  const [actifs, setActifs] = useState({ sols: true, projets: true, baignade: true, eau: true, signaux: true });
  const [rehabilites, setRehabilites] = useState(false);
  const [pret, setPret] = useState(false);
  const [panneau, setPanneau] = useState(true);

  useEffect(() => {
    fetch("/data/carte.json")
      .then((r) => r.json())
      .then(setDonnees)
      .catch(() => setDonnees({ erreur: true }));
  }, []);

  useEffect(() => {
    if (!donnees || donnees.erreur || carte.current) return;
    const m = new maplibregl.Map({
      container: conteneur.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            maxzoom: 19,
            attribution: "© contributeurs OpenStreetMap",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.6, "raster-opacity": 0.85 } }],
      },
      bounds: [-1.26, 46.03, -0.93, 46.27],
      fitBoundsOptions: { padding: 20 },
      attributionControl: { compact: true },
      cooperativeGestures: false,
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

    m.on("load", () => {
      m.addImage("hachure-signaux", hachures(COULEUR.signaux), { pixelRatio: 2 });
      m.addImage("hachure-gris", hachures("#7a7f7c"), { pixelRatio: 2 });

      m.addSource("communes", { type: "geojson", data: donnees.communes });
      m.addSource("signaux", { type: "geojson", data: donnees.signaux });
      m.addSource("surfaces", { type: "geojson", data: donnees.surfaces });
      m.addSource("reperes", { type: "geojson", data: donnees.reperes });

      m.addLayer({ id: "communes-fond", type: "fill", source: "communes", paint: { "fill-color": "#ffffff", "fill-opacity": 0.01 } });
      m.addLayer({ id: "communes-trait", type: "line", source: "communes", paint: { "line-color": "#4a524e", "line-width": 1, "line-opacity": 0.55 } });

      // Signaux : hachures et contour pointillé, jamais d'aplat qui se confondrait avec un site.
      m.addLayer({ id: "signaux-fond", type: "fill", source: "signaux", paint: { "fill-pattern": "hachure-signaux", "fill-opacity": 0.55 } });
      m.addLayer({ id: "signaux-trait", type: "line", source: "signaux", paint: { "line-color": COULEUR.signaux, "line-width": 2, "line-dasharray": [2, 2] } });

      // Emprise cadastrale : aplat net.
      m.addLayer({
        id: "emprise-fond", type: "fill", source: "surfaces",
        filter: ["==", ["get", "precision_geo"], "emprise_cadastrale"],
        paint: { "fill-color": couleurSite, "fill-opacity": 0.45 },
      });
      m.addLayer({
        id: "emprise-trait", type: "line", source: "surfaces",
        filter: ["==", ["get", "precision_geo"], "emprise_cadastrale"],
        paint: { "line-color": couleurSite, "line-width": 1.5 },
      });
      // Périmètre approximatif et localisation indicative : voile léger et contour pointillé.
      m.addLayer({
        id: "flou-fond", type: "fill", source: "surfaces",
        filter: ["!=", ["get", "precision_geo"], "emprise_cadastrale"],
        paint: { "fill-color": couleurSite, "fill-opacity": 0.14 },
      });
      m.addLayer({
        id: "flou-trait", type: "line", source: "surfaces",
        filter: ["!=", ["get", "precision_geo"], "emprise_cadastrale"],
        paint: { "line-color": couleurSite, "line-width": 1.5, "line-dasharray": [1.5, 1.5] },
      });
      // Baignade hors contrôle sanitaire : hachures grises, ni bonne ni mauvaise.
      m.addLayer({
        id: "baignade-hors-controle", type: "fill", source: "surfaces",
        filter: ["==", ["get", "baignade_etat"], "hors_controle_sanitaire"],
        paint: { "fill-pattern": "hachure-gris", "fill-opacity": 0.8 },
      });
      // Repère central, visible à petite échelle, cliquable.
      m.addLayer({
        id: "reperes", type: "circle", source: "reperes",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4, 15, 6],
          "circle-color": couleurSite,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
          "circle-opacity": ["case", ["==", ["get", "preuve"], "signalement_non_instruit"], 0.55, 1],
        },
      });

      const popup = new maplibregl.Popup({ closeButton: true, maxWidth: "290px" });
      const ouvrirSite = (e) => {
        const p = e.features[0].properties;
        const baignade =
          p.baignade_etat === "hors_controle_sanitaire"
            ? "<p>Hors contrôle sanitaire, baignade interdite.</p>"
            : p.baignade_dernier && p.baignade_dernier !== "null"
              ? `<p>Classement 2025 : ${echapper(p.baignade_dernier)}</p>`
              : "";
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<p class="pop-cat">${echapper(p.categorie_libelle)}, ${echapper(p.commune)}</p>
             <p class="pop-nom">${echapper(p.nom)}</p>
             ${baignade}
             <dl class="pop-statuts"><dt>Preuve</dt><dd>${echapper(p.preuve_libelle)}</dd>
             <dt>Traitement</dt><dd>${echapper(p.traitement_libelle)}</dd>
             <dt>Tracé</dt><dd>${echapper(p.precision_libelle)}</dd></dl>
             <a href="/sites/${encodeURIComponent(p.id)}">Voir la fiche</a>`
          )
          .addTo(m);
      };
      const ouvrirCommune = (e) => {
        const p = e.features[0].properties;
        const sans = p.nb_sans_localisation
          ? `<p>${p.nb_sans_localisation} site${p.nb_sans_localisation > 1 ? "s" : ""} connu${p.nb_sans_localisation > 1 ? "s" : ""} sans localisation : ${echapper(p.sans_localisation)}.</p>`
          : "";
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<p class="pop-nom">${echapper(p.nom)}</p>
             <p>${p.nb_sites ? `${p.nb_sites} fiche${p.nb_sites > 1 ? "s" : ""}` : "Aucune fiche publiée à ce jour"}.</p>${sans}
             <a href="/communes/${encodeURIComponent(p.slug)}">Voir la commune</a>`
          )
          .addTo(m);
      };
      const ouvrirSignal = (e) => {
        const p = e.features[0].properties;
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<p class="pop-cat">Signal sanitaire</p><p class="pop-nom">${echapper(p.libelle)}</p>
             <p>Aucun lien de cause à effet n'est établi avec les sites de la carte.</p>
             <a href="/signaux-sanitaires#${encodeURIComponent(p.id)}">Lire l'étude</a>`
          )
          .addTo(m);
      };

      // Un seul clic, résolu par priorité : site, puis signal, puis commune.
      const couchesSite = ["reperes", "emprise-fond", "flou-fond"];
      m.on("click", (e) => {
        const presents = (ids) => ids.filter((id) => m.getLayer(id) && m.getLayoutProperty(id, "visibility") !== "none");
        const site = m.queryRenderedFeatures(e.point, { layers: presents(couchesSite) });
        if (site.length) return ouvrirSite({ ...e, features: site });
        const sig = m.queryRenderedFeatures(e.point, { layers: presents(["signaux-fond"]) });
        if (sig.length) return ouvrirSignal({ ...e, features: sig });
        const com = m.queryRenderedFeatures(e.point, { layers: ["communes-fond"] });
        if (com.length) ouvrirCommune({ ...e, features: com });
      });
      m.on("mousemove", (e) => {
        const f = m.queryRenderedFeatures(e.point, { layers: couchesSite.filter((id) => m.getLayer(id)) });
        m.getCanvas().style.cursor = f.length ? "pointer" : "";
      });

      setPret(true);
    });
    carte.current = m;
    return () => {
      m.remove();
      carte.current = null;
    };
  }, [donnees]);

  // Thèmes et réhabilités : un filtre combiné, réappliqué à chaque changement.
  useEffect(() => {
    const m = carte.current;
    if (!m || !pret) return;
    const themes = Object.entries(FILTRE_THEME)
      .filter(([k]) => actifs[k])
      .map(([, f]) => f);
    const base = themes.length ? ["any", ...themes] : ["==", 1, 0];
    const filtre = rehabilites ? base : ["all", base, ["!", ["get", "rehabilite"]]];
    const precision = {
      "emprise-fond": ["==", ["get", "precision_geo"], "emprise_cadastrale"],
      "emprise-trait": ["==", ["get", "precision_geo"], "emprise_cadastrale"],
      "flou-fond": ["!=", ["get", "precision_geo"], "emprise_cadastrale"],
      "flou-trait": ["!=", ["get", "precision_geo"], "emprise_cadastrale"],
      "baignade-hors-controle": ["==", ["get", "baignade_etat"], "hors_controle_sanitaire"],
      reperes: null,
    };
    for (const [id, f] of Object.entries(precision)) m.setFilter(id, f ? ["all", f, filtre] : filtre);
    for (const id of ["signaux-fond", "signaux-trait"]) m.setLayoutProperty(id, "visibility", actifs.signaux ? "visible" : "none");
  }, [actifs, rehabilites, pret]);

  const compte = (id) => {
    if (!donnees?.reperes) return 0;
    const f = donnees.reperes.features.map((x) => x.properties);
    const ok = (p) => rehabilites || !p.rehabilite;
    if (id === "sols") return f.filter((p) => p.theme === "pollution_chimique" && p.categorie !== "projet_decharge" && ok(p)).length;
    if (id === "projets") return f.filter((p) => p.categorie === "projet_decharge" && ok(p)).length;
    if (id === "baignade") return f.filter((p) => p.theme === "eaux_baignade" && ok(p)).length;
    if (id === "eau") return f.filter((p) => p.theme === "ressource_eau" && ok(p)).length;
    if (id === "signaux") return new Set(donnees.signaux.features.map((x) => x.properties.id)).size;
    return 0;
  };
  const nbRehabilites = donnees?.reperes ? donnees.reperes.features.filter((x) => x.properties.rehabilite).length : 0;

  return (
    <div className="carte-page">
      <aside className={`carte-panneau ${panneau ? "ouvert" : "replie"}`}>
        <div className="panneau-tete">
          <a href="/" className="retour">Accueil</a>
          <button type="button" className="replier" onClick={() => setPanneau(!panneau)} aria-expanded={panneau}>
            {panneau ? "Masquer le panneau" : "Afficher le panneau"}
          </button>
        </div>
        <div className="panneau-corps">
          <h1>Carte des pollutions documentées</h1>
          <p className="note">
            Chaque tache renvoie à une fiche datée et sourcée. La couleur dit la nature du fait, pas sa gravité. Le
            contour dit la précision de la source.
          </p>

          <fieldset className="themes">
            <legend>Thèmes affichés</legend>
            {THEMES.map((t) => (
              <label key={t.id}>
                <input
                  type="checkbox"
                  checked={actifs[t.id]}
                  onChange={() => setActifs({ ...actifs, [t.id]: !actifs[t.id] })}
                />
                <span className="pastille-couleur" style={{ background: t.couleur }} />
                <span>{t.libelle}</span>
                <em>{compte(t.id)}</em>
              </label>
            ))}
            <label className="option">
              <input type="checkbox" checked={rehabilites} onChange={() => setRehabilites(!rehabilites)} />
              <span>Afficher les sites réhabilités</span>
              <em>{nbRehabilites}</em>
            </label>
          </fieldset>

          {actifs.signaux ? (
            <div className="bandeau">
              <p>{bandeau}</p>
              {donnees?.signaux_non_cartographies?.length ? (
                <p>
                  Non dessiné faute de contour publié :{" "}
                  {donnees.signaux_non_cartographies.map((s, i) => (
                    <span key={s.id}>
                      {i ? ", " : ""}
                      <a href={`/signaux-sanitaires#${s.id}`}>{s.libelle}</a>
                    </span>
                  ))}
                  .
                </p>
              ) : null}
              <p>
                <a href="/signaux-sanitaires">Lire les études et les enquêtes en cours</a>
              </p>
            </div>
          ) : null}

          <h2>Lire le tracé</h2>
          <ul className="legende">
            <li><span className="ech aplat" />Limites parcellaires connues : aplat net.</li>
            <li><span className="ech flou" />Point indicatif : disque pointillé du rayon d&apos;incertitude, pas l&apos;étendue de la pollution.</li>
            <li><span className="ech hachure" />Plage hors contrôle sanitaire, baignade interdite.</li>
            <li><span className="ech pale" />Repère pâle : fait signalé, jamais instruit.</li>
          </ul>
          <h2>Classement des plages, saison 2025</h2>
          <ul className="legende">
            {Object.entries(BAIGNADE).map(([k, c]) => (
              <li key={k}>
                <span className="ech" style={{ background: c }} />
                {k}
              </li>
            ))}
          </ul>
          <p className="note">
            Le classement porte sur deux bactéries d&apos;origine fécale, calculé sur quatre saisons. Il ne mesure pas les
            substances chimiques.
          </p>

          {donnees?.sans_localisation?.length ? (
            <>
              <h2>Sites connus sans localisation</h2>
              <ul className="simple">
                {donnees.sans_localisation.map((c) => (
                  <li key={c.slug}>
                    <a href={`/communes/${c.slug}`}>{c.commune}</a> : {c.sites.length}{" "}
                    {c.sites.map((s) => s.nom).join(", ")}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {donnees?.erreur ? <p className="note">Les données de la carte n&apos;ont pas pu être chargées.</p> : null}
          <p className="note">Données du {donnees?.genere_le ?? "…"}. Fond de carte © contributeurs OpenStreetMap.</p>
        </div>
      </aside>
      <div className="carte-zone">
        <div ref={conteneur} className="carte-fond" role="region" aria-label="Carte des pollutions documentées" />
        {actifs.signaux ? (
          <p className="bandeau-carte">
            Les zones hachurées en ocre sont des signaux sanitaires. Aucun lien de cause à effet n&apos;est établi avec les
            sites de la carte. <a href="/signaux-sanitaires">Les études</a>
          </p>
        ) : null}
      </div>
    </div>
  );
}
