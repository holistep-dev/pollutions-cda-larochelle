"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Une couleur dit la nature du fait, jamais sa gravité.
const COULEUR = {
  sols: "#8a4b2f",
  projets: "#5b4b8a",
  eau: "#2f6f8f",
  air: "#5c6b78",
  signaux: "#9a6b1f",
  bio: "#2e6b3a",
};
const BAIGNADE = { Excellent: "#2f7d6b", Bon: "#6a9c4f", Suffisant: "#c39a2e", Insuffisant: "#b4533b" };

// Palette sourde des groupes de cultures : la couche agricole reste un fond de contexte.
const CULTURES = {
  "Blé tendre": "#e8d9a6", Orge: "#e2cf94", "Autres céréales": "#dccb9c", "Maïs grain et ensilage": "#e6c47f",
  Colza: "#eee3a0", Tournesol: "#efd88a", "Autres oléagineux": "#e7e0ad",
  Protéagineux: "#d9cfe0", "Légumineuses à grains": "#d6cbe3",
  "Prairies permanentes": "#c5dbb5", "Prairies temporaires": "#cfe2bf", Fourrage: "#bfd6ae", "Estives et landes": "#c9d9bd",
  "Gel (surfaces gelées sans production)": "#dcdcd4", "Légumes ou fleurs": "#ebc6c6", Vergers: "#e3b3a8", Vignes: "#d8a3b3",
  "Autres cultures industrielles": "#d7d0c0", Divers: "#d9d6cf",
};

const TYPES = [
  { id: "sols", libelle: "Sols pollués et décharges", couleur: COULEUR.sols,
    def: "Sites où une pollution du sol ou de la nappe est mesurée, diagnostiquée ou instruite par l'administration, et anciennes décharges." },
  { id: "projets", libelle: "Projets de décharge", couleur: COULEUR.projets,
    def: "Projets d'enfouissement de déchets. Aucune pollution n'y est constatée : c'est un projet, pas un site pollué." },
  { id: "baignade", libelle: "Eaux de baignade", couleur: BAIGNADE.Bon, degrade: true,
    def: "Points de contrôle sanitaire des plages. La couleur donne le classement de la saison 2025, établi sur deux bactéries d'origine fécale." },
  { id: "eau", libelle: "Eau du robinet", couleur: COULEUR.eau,
    def: "Contrôle sanitaire de l'eau distribuée depuis 2016, par commune : résultats au-delà d'une limite de qualité. Une limite de qualité n'est pas un seuil de danger." },
  { id: "air", libelle: "Pesticides dans l'air", couleur: COULEUR.air,
    def: "Points de mesure d'Atmo Nouvelle-Aquitaine. Il n'existe pas de valeur sanitaire pour les pesticides dans l'air ambiant." },
  { id: "signaux", libelle: "Signaux sanitaires", couleur: COULEUR.signaux, hachure: true,
    def: "Résultats d'études épidémiologiques. Ce ne sont pas des pollutions. Aucun lien de cause à effet n'est établi avec les sites de la carte." },
  { id: "agriculture", libelle: "Agriculture, contexte", couleur: CULTURES["Blé tendre"], contexte: true,
    def: "Cultures déclarées à la PAC en 2023 et parcelles en agriculture biologique. Couche de contexte : elle montre ce qui est cultivé, pas une pollution mesurée." },
];

const PREUVES = ["mesure_publiee", "diagnostic_administratif", "procedure_en_cours", "signalement_non_instruit"];

const typeDe = (p) => {
  if (p.categorie === "projet_decharge") return "projets";
  if (p.categorie === "eau_baignade") return "baignade";
  if (p.categorie === "ressource_eau" || p.categorie === "eau_distribuee") return "eau";
  if (p.categorie === "air") return "air";
  return "sols";
};

const couleurSite = [
  "match", ["get", "type"],
  "projets", COULEUR.projets,
  "eau", COULEUR.eau,
  "air", COULEUR.air,
  "baignade",
  ["match", ["coalesce", ["get", "baignade_dernier"], "aucun"],
    "Excellent", BAIGNADE.Excellent, "Bon", BAIGNADE.Bon, "Suffisant", BAIGNADE.Suffisant,
    "Insuffisant", BAIGNADE.Insuffisant, "#7a7f7c"],
  COULEUR.sols,
];

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

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function dateLisible(d) {
  if (!d) return "";
  const s = String(d);
  if (/^[0-9]{3}X$/.test(s)) return `années ${s.slice(0, 3)}0`;
  const [a, m, j] = s.split("-");
  if (j) return `${Number(j)} ${MOIS[Number(m) - 1]} ${a}`;
  if (m) return `${MOIS[Number(m) - 1]} ${a}`;
  return a;
}
function periodeLisible(p) {
  if (!p) return "";
  const debut = p.debut ? dateLisible(p.debut) : null;
  if (p.fin_statut === "en_cours") return debut ? `depuis ${debut}, en cours` : "début inconnu, en cours";
  const fin = p.fin ? dateLisible(p.fin) : null;
  if (debut && fin) return debut === fin ? debut : `de ${debut} à ${fin}`;
  if (fin) return `début inconnu, jusqu'en ${fin}`;
  if (debut) return `depuis ${debut}, fin inconnue`;
  return "dates inconnues";
}
const nb = (v) => (v == null ? "" : Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 3 }));

function Definition({ titre, children }) {
  return (
    <span className="def" role="tooltip">
      {titre ? <b>{titre}</b> : null}
      {children}
    </span>
  );
}

function Statut({ nom, valeur, libelles }) {
  const l = libelles?.[valeur];
  if (!l) return null;
  return (
    <div className={`statut ${valeur}`} tabIndex={0}>
      <dt>{nom}</dt>
      <dd>{l.libelle}</dd>
      <Definition>{l.definition}</Definition>
    </div>
  );
}

function Substances({ liste, libelles }) {
  if (!liste?.length) return null;
  const chiffrees = liste.filter((s) => s.valeur != null);
  const citees = liste.filter((s) => s.valeur == null);
  const circ = [...new Map(liste.filter((s) => s.comparaison?.circ).map((s) => [s.comparaison.cle, s.comparaison])).values()];
  // Une absence de valeur commune à toutes les mesures est dite une fois, pas à chaque ligne.
  const aucunes = [...new Set(liste.flatMap((s) => (s.comparaison?.reperes ?? []).filter((r) => r.nature === "aucune").map((r) => r.libelle)))];
  const utiles = (s) => (s.comparaison?.reperes ?? []).filter((r) => r.nature !== "aucune");
  return (
    <section className="pan-bloc">
      <h3>Ce qui est mesuré</h3>
      {chiffrees.map((s, i) => (
        <div className="teneur" key={i}>
          <p className="teneur-nom">{s.libelle}</p>
          <p className="teneur-val">
            <b>{nb(s.valeur)} {s.unite}</b>
            {s.date ? <span>, {dateLisible(s.date)}</span> : null}
            {s.milieu ? <span className="milieu"> · {s.milieu.replace("_", " ")}</span> : null}
          </p>
          {utiles(s).length ? (
            <ul className="reperes">
              {utiles(s).map((r, j) => (
                <li key={j} className={r.rapport > 1.05 ? "au-dessus" : ""}>
                  <span className={`nature ${r.nature}`} tabIndex={0}>
                    {libelles?.natures_reference?.[r.nature] ? <Definition>{libelles.natures_reference[r.nature]}</Definition> : null}
                    {{ fond_geochimique: "fond", valeur_de_gestion: "gestion", limite_de_qualite: "qualité", seuil_sanitaire: "sanitaire", aucune: "aucune" }[r.nature]}
                  </span>
                  <span>
                    {r.libelle}
                    {r.valeur != null ? ` : ${nb(r.valeur)} ${r.unite}` : r.max != null ? ` : ${nb(r.min)} à ${nb(r.max)} ${r.unite}` : ""}
                    {r.texte ? <b>. Mesure : {r.texte}.</b> : "."}
                    {r.note ? <em> {r.note}</em> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : aucunes.length ? null : (
            <p className="note">Aucune valeur de comparaison retenue pour ce milieu.</p>
          )}
        </div>
      ))}
      {aucunes.map((a) => (
        <p key={a} className="note aucune-ref">{a}.</p>
      ))}
      {citees.length ? (
        <p className="teneur-citees">
          <span>Cité sans valeur publiée : </span>
          {citees.map((s) => s.libelle).join(" ; ")}.
        </p>
      ) : null}
      {circ.length ? (
        <div className="circ">
          <p>
            <b>Classement du CIRC</b>, qui décrit un danger et pas un risque : il ne dit rien du niveau d&apos;exposition.
          </p>
          <ul>
            {circ.map((c) => (
              <li key={c.cle}>
                {c.cle} : groupe {c.circ.groupe}, {libelles?.circ_groupes?.[c.circ.groupe]}
                {c.circ.precision ? ` (${c.circ.precision})` : ""}.
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function PanneauSite({ p, d, libelles, fermer }) {
  return (
    <article className="pan-fiche">
      <button type="button" className="fermer" onClick={fermer} aria-label="Fermer la fiche">×</button>
      <p className="pan-cat">
        <span className="pastille-couleur" style={{ background: p.couleur }} />
        {p.categorie_libelle} · {p.commune}
      </p>
      <h2>{p.nom}</h2>
      {p.baignade_etat === "hors_controle_sanitaire" ? (
        <p className="pan-baignade">Hors contrôle sanitaire, baignade interdite.</p>
      ) : p.baignade_dernier ? (
        <p className="pan-baignade">
          Classement 2025 : <b>{p.baignade_dernier}</b>
        </p>
      ) : null}
      <dl className="pan-statuts">
        <Statut nom="Preuve" valeur={p.preuve} libelles={libelles?.statut_preuve} />
        <Statut nom="Traitement" valeur={p.traitement} libelles={libelles?.statut_traitement} />
      </dl>
      {d?.procedure_en_cours && p.preuve !== "procedure_en_cours" ? <p className="note">Une procédure administrative est en cours.</p> : null}
      {d?.periode ? <p className="pan-periode">Période : {periodeLisible(d.periode)}</p> : null}
      {d?.resume ? <p className="pan-resume">{d.resume}</p> : null}
      <Substances liste={d?.substances} libelles={libelles} />
      <section className="pan-bloc">
        <h3>Sources</h3>
        <ul className="pan-sources">
          {d?.sources?.map((s, i) => (
            <li key={i}>
              {s.url ? <a href={s.url} rel="noopener noreferrer" target="_blank">{s.titre}</a> : s.titre}
              <span>
                {s.auteur}, {dateLisible(s.date)}
              </span>
            </li>
          ))}
        </ul>
        {d?.nb_sources > (d?.sources?.length ?? 0) ? <p className="note">{d.nb_sources - d.sources.length} autre(s) dans la fiche.</p> : null}
      </section>
      <p className="pan-trace">
        Tracé : {libelles?.precision_geo?.[p.precision_geo]?.libelle?.toLowerCase()}.{d?.origine_trace ? ` ${d.origine_trace}` : ""}
      </p>
      <a className="pan-lien" href={`/sites/${encodeURIComponent(p.id)}`}>Lire la fiche complète</a>
    </article>
  );
}

function PanneauCommune({ c, donnees, actifs, fermer }) {
  const eau = donnees?.eau?.communes?.[c.code_insee];
  const fiches = (donnees?.reperes?.features ?? []).map((f) => f.properties).filter((p) => p.commune === c.nom);
  const signaux = (donnees?.signaux_liste ?? []).filter((s) => s.communes.includes(c.code_insee));
  const [tout, setTout] = useState(false);
  const deps = eau?.depassements ?? [];
  return (
    <article className="pan-fiche">
      <button type="button" className="fermer" onClick={fermer} aria-label="Fermer">×</button>
      <p className="pan-cat">Commune</p>
      <h2>{c.nom}</h2>
      {eau ? (
        <section className="pan-bloc">
          <h3>Eau du robinet depuis 2016</h3>
          <p>
            Réseau{eau.reseaux.length > 1 ? "x" : ""} : {eau.reseaux.join(", ")}. {nb(eau.nb_prelevements)} prélèvements de contrôle
            sanitaire, le dernier le {dateLisible(eau.dernier_prelevement)}.
          </p>
          {deps.length ? (
            <>
              <p>
                <b>
                  {deps.length} résultat{deps.length > 1 ? "s" : ""} au-delà d&apos;une limite de qualité
                </b>
                {eau.nb_physico_chimiques ? `, dont ${eau.nb_physico_chimiques} physico-chimique${eau.nb_physico_chimiques > 1 ? "s" : ""}` : ""}
                {eau.nb_microbiologiques ? ` et ${eau.nb_microbiologiques} microbiologique${eau.nb_microbiologiques > 1 ? "s" : ""}` : ""}.
                Le dernier date du {dateLisible(eau.dernier_depassement)}.
              </p>
              <table className="pan-table">
                <thead>
                  <tr><th>Date</th><th>Paramètre</th><th>Résultat</th><th>Limite</th></tr>
                </thead>
                <tbody>
                  {[...deps].reverse().slice(0, tout ? deps.length : 6).map((x, i) => (
                    <tr key={i}>
                      <td>{x.date.split("-").reverse().join("/")}</td>
                      <td>{x.parametre}</td>
                      <td>{x.resultat ?? nb(x.valeur)} {x.unite}</td>
                      <td>{x.limite}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {deps.length > 6 ? (
                <button type="button" className="lien-bouton" onClick={() => setTout(!tout)}>
                  {tout ? "Réduire" : `Afficher les ${deps.length} résultats`}
                </button>
              ) : null}
            </>
          ) : (
            <p>Aucun résultat au-delà d&apos;une limite de qualité n&apos;est rattaché à cette commune dans la base.</p>
          )}
          <p className="note">
            Une limite de qualité est une norme de gestion. Pour les pesticides, elle vaut 0,1 µg/L par molécule, quelle que soit sa
            toxicité. Un dépassement n&apos;est pas un dépassement de seuil sanitaire : c&apos;est l&apos;ARS qui décide d&apos;éventuelles
            restrictions de consommation. Le rattachement des résultats aux communes est partiel : une analyse faite sur un réseau
            commun peut être enregistrée sous une seule des communes desservies.
          </p>
          <a href={`/eau-du-robinet#${c.code_insee}`}>Toutes les communes</a>
        </section>
      ) : null}
      <section className="pan-bloc">
        <h3>Fiches</h3>
        {fiches.length ? (
          <ul className="pan-liste">
            {fiches.map((f) => (
              <li key={f.id}>
                <span className="pastille-couleur" style={{ background: f.couleur }} />
                <a href={`/sites/${f.id}`}>{f.nom}</a>
              </li>
            ))}
          </ul>
        ) : (
          <p>Aucune fiche localisée sur cette commune.</p>
        )}
        {c.nb_sans_localisation ? <p className="note">Connu sans localisation : {c.sans_localisation}.</p> : null}
      </section>
      {signaux.length && actifs.signaux ? (
        <section className="pan-bloc">
          <h3>Signaux sanitaires</h3>
          <ul className="pan-liste">
            {signaux.map((s) => (
              <li key={s.id}>
                <a href={`/signaux-sanitaires#${s.id}`}>{s.libelle}</a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <a className="pan-lien" href={`/communes/${c.slug}`}>Page de la commune</a>
    </article>
  );
}

function PanneauSignal({ s, bandeau, fermer }) {
  return (
    <article className="pan-fiche">
      <button type="button" className="fermer" onClick={fermer} aria-label="Fermer">×</button>
      <p className="pan-cat">Signal sanitaire{s.niveau_source === "presse" ? ", chiffre rapporté par la presse" : ""}</p>
      <h2>{s.libelle}</h2>
      <p className="bandeau">{bandeau}</p>
      <p>{s.resultat}</p>
      <a className="pan-lien" href={`/signaux-sanitaires#${s.id}`}>Lire l&apos;étude et les enquêtes en cours</a>
    </article>
  );
}

function PanneauAgri({ p, agri, fermer }) {
  return (
    <article className="pan-fiche">
      <button type="button" className="fermer" onClick={fermer} aria-label="Fermer">×</button>
      <p className="pan-cat">Agriculture, couche de contexte</p>
      <h2>{p.libelle}</h2>
      <p>
        {nb(p.surface_ha)} ha déclarés à la PAC en 2023 sur les 28 communes{p.couche === "bio" ? "" : " pour ce groupe de cultures"}.
      </p>
      {p.couche === "bio" && agri ? (
        <p>
          Soit {nb(Math.round((agri.surface_bio_ha / agri.surface_declaree_ha) * 1000) / 10)} % des {nb(agri.surface_declaree_ha)} ha
          déclarés.
        </p>
      ) : null}
      <p className="note">
        Cette couche montre ce qui est cultivé et sous quel mode. Elle ne mesure aucune pollution. Les parcelles ne sont rattachées à
        aucun exploitant. Sources : IGN, registre parcellaire graphique 2023 ; Agence Bio, parcelles en agriculture biologique
        déclarées à la PAC, 2023.
      </p>
    </article>
  );
}

export default function Carte({ bandeau }) {
  const conteneur = useRef(null);
  const carte = useRef(null);
  const survol = useRef(null);
  const [donnees, setDonnees] = useState(null);
  const [agri, setAgri] = useState(null);
  const [actifs, setActifs] = useState({ sols: true, projets: true, baignade: true, eau: true, air: true, signaux: true, agriculture: false });
  const [preuves, setPreuves] = useState(Object.fromEntries(PREUVES.map((p) => [p, true])));
  const [rehabilites, setRehabilites] = useState(false);
  const [selection, setSelection] = useState(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    fetch("/data/carte.json")
      .then((r) => r.json())
      .then((d) => {
        for (const col of [d.reperes, d.surfaces]) for (const f of col.features) {
          f.properties.type = typeDe(f.properties);
          f.properties.couleur =
            f.properties.type === "baignade" ? BAIGNADE[f.properties.baignade_dernier] ?? "#7a7f7c" : COULEUR[f.properties.type];
        }
        setDonnees(d);
      })
      .catch(() => setDonnees({ erreur: true }));
  }, []);

  useEffect(() => {
    if (!actifs.agriculture || agri) return;
    fetch("/data/agriculture.json").then((r) => r.json()).then(setAgri).catch(() => {});
  }, [actifs.agriculture, agri]);

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
        layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.75, "raster-opacity": 0.8 } }],
      },
      bounds: [-1.26, 46.03, -0.93, 46.27],
      fitBoundsOptions: { padding: 20 },
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

    m.on("load", () => {
      m.addImage("hachure-signaux", hachures(COULEUR.signaux), { pixelRatio: 2 });
      m.addImage("hachure-signaux-presse", hachures(COULEUR.signaux, 14, 1), { pixelRatio: 2 });
      m.addImage("hachure-gris", hachures("#7a7f7c"), { pixelRatio: 2 });
      m.addImage("hachure-bio", hachures(COULEUR.bio, 7, 1.2), { pixelRatio: 2 });

      m.addSource("agriculture", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addSource("communes", { type: "geojson", data: donnees.communes });
      m.addSource("signaux", { type: "geojson", data: donnees.signaux });
      m.addSource("surfaces", { type: "geojson", data: donnees.surfaces });
      m.addSource("reperes", { type: "geojson", data: donnees.reperes });

      const couleurCulture = ["match", ["get", "libelle"], ...Object.entries(CULTURES).flat(), "#d9d6cf"];
      m.addLayer({ id: "agri-cultures", type: "fill", source: "agriculture", filter: ["==", ["get", "couche"], "culture"], layout: { visibility: "none" }, paint: { "fill-color": couleurCulture, "fill-opacity": 0.7 } });
      m.addLayer({ id: "agri-bio", type: "fill", source: "agriculture", filter: ["==", ["get", "couche"], "bio"], layout: { visibility: "none" }, paint: { "fill-pattern": "hachure-bio" } });
      m.addLayer({ id: "agri-bio-trait", type: "line", source: "agriculture", filter: ["==", ["get", "couche"], "bio"], layout: { visibility: "none" }, paint: { "line-color": COULEUR.bio, "line-width": 0.8 } });

      m.addLayer({ id: "communes-fond", type: "fill", source: "communes", paint: { "fill-color": "#ffffff", "fill-opacity": 0.01 } });
      m.addLayer({
        id: "communes-eau", type: "fill", source: "communes",
        filter: [">=", ["get", "eau_depassements"], 0],
        paint: {
          "fill-color": COULEUR.eau,
          "fill-opacity": ["case", [">", ["get", "eau_pc"], 0], 0.16, [">", ["get", "eau_depassements"], 0], 0.08, 0.02],
        },
      });
      m.addLayer({ id: "communes-trait", type: "line", source: "communes", paint: { "line-color": "#4a524e", "line-width": 0.8, "line-opacity": 0.5 } });

      m.addLayer({
        id: "signaux-fond", type: "fill", source: "signaux",
        paint: { "fill-pattern": ["case", ["==", ["get", "niveau_source"], "presse"], "hachure-signaux-presse", "hachure-signaux"], "fill-opacity": 0.6 },
      });
      m.addLayer({
        id: "signaux-trait", type: "line", source: "signaux",
        paint: { "line-color": COULEUR.signaux, "line-width": ["case", ["==", ["get", "niveau_source"], "presse"], 1, 2], "line-dasharray": [2, 2] },
      });

      // Tracé discret : un voile et un trait fin, à partir d'une échelle de quartier.
      m.addLayer({ id: "surfaces-fond", type: "fill", source: "surfaces", minzoom: 11.5, paint: { "fill-color": couleurSite, "fill-opacity": ["case", ["==", ["get", "precision_geo"], "emprise_cadastrale"], 0.22, 0.09] } });
      m.addLayer({ id: "surfaces-trait", type: "line", source: "surfaces", minzoom: 11.5, filter: ["==", ["get", "precision_geo"], "emprise_cadastrale"], paint: { "line-color": couleurSite, "line-width": 1 } });
      m.addLayer({ id: "surfaces-trait-flou", type: "line", source: "surfaces", minzoom: 11.5, filter: ["!=", ["get", "precision_geo"], "emprise_cadastrale"], paint: { "line-color": couleurSite, "line-width": 1, "line-dasharray": [2, 2], "line-opacity": 0.8 } });
      m.addLayer({ id: "baignade-hors-controle", type: "fill", source: "surfaces", minzoom: 11.5, filter: ["==", ["get", "baignade_etat"], "hors_controle_sanitaire"], paint: { "fill-pattern": "hachure-gris", "fill-opacity": 0.8 } });

      // Repère : plein si mesuré ou diagnostiqué, atténué si en procédure, creux si seulement signalé.
      m.addLayer({
        id: "reperes", type: "circle", source: "reperes",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 5.5, 15, 8],
          "circle-color": ["case", ["==", ["get", "preuve"], "signalement_non_instruit"], "#ffffff", couleurSite],
          "circle-opacity": ["case", ["==", ["get", "preuve"], "procedure_en_cours"], 0.6, 1],
          "circle-stroke-color": ["case", ["==", ["get", "preuve"], "signalement_non_instruit"], couleurSite, "#ffffff"],
          "circle-stroke-width": ["case", ["==", ["get", "preuve"], "signalement_non_instruit"], 2.5, 1.5],
        },
      });
      m.addLayer({
        id: "reperes-selection", type: "circle", source: "reperes", filter: ["==", ["get", "id"], ""],
        paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 10, 15, 13], "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#1b1f1d", "circle-stroke-width": 2 },
      });

      survol.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "survol", offset: 10 });
      const visibles = (ids) => ids.filter((id) => m.getLayer(id) && m.getLayoutProperty(id, "visibility") !== "none");

      m.on("mousemove", (e) => {
        const f = m.queryRenderedFeatures(e.point, { layers: visibles(["reperes", "surfaces-fond"]) });
        m.getCanvas().style.cursor = f.length ? "pointer" : "";
        if (f.length) {
          const p = f[0].properties;
          survol.current.setLngLat(e.lngLat).setHTML(`<b></b><span></span>`).addTo(m);
          const el = survol.current.getElement();
          el.querySelector("b").textContent = p.nom;
          el.querySelector("span").textContent = ` · ${p.preuve_libelle}`;
        } else survol.current.remove();
      });
      m.on("mouseout", () => survol.current?.remove());

      m.on("click", (e) => {
        survol.current?.remove();
        const site = m.queryRenderedFeatures(e.point, { layers: visibles(["reperes", "surfaces-fond"]) });
        if (site.length) return setSelection({ genre: "site", id: site[0].properties.id });
        const sig = m.queryRenderedFeatures(e.point, { layers: visibles(["signaux-fond"]) });
        if (sig.length) return setSelection({ genre: "signal", id: sig[0].properties.id });
        const ag = m.queryRenderedFeatures(e.point, { layers: visibles(["agri-bio", "agri-cultures"]) });
        const com = m.queryRenderedFeatures(e.point, { layers: ["communes-fond"] });
        if (ag.length) return setSelection({ genre: "agri", props: ag[0].properties });
        if (com.length) return setSelection({ genre: "commune", code: com[0].properties.code_insee });
        setSelection(null);
      });
      setPret(true);
    });
    carte.current = m;
    return () => {
      m.remove();
      carte.current = null;
    };
  }, [donnees]);

  useEffect(() => {
    const m = carte.current;
    if (!m || !pret || !agri) return;
    m.getSource("agriculture").setData(agri);
  }, [agri, pret]);

  // Filtres combinés : type, niveau de preuve, réhabilités.
  useEffect(() => {
    const m = carte.current;
    if (!m || !pret) return;
    const types = TYPES.filter((t) => !["signaux", "agriculture"].includes(t.id) && actifs[t.id]).map((t) => t.id);
    const niv = PREUVES.filter((p) => preuves[p]);
    const filtre = ["all", ["in", ["get", "type"], ["literal", types]], ["in", ["get", "preuve"], ["literal", niv]]];
    if (!rehabilites) filtre.push(["!", ["get", "rehabilite"]]);
    const base = {
      "surfaces-fond": null,
      "surfaces-trait": ["==", ["get", "precision_geo"], "emprise_cadastrale"],
      "surfaces-trait-flou": ["!=", ["get", "precision_geo"], "emprise_cadastrale"],
      "baignade-hors-controle": ["==", ["get", "baignade_etat"], "hors_controle_sanitaire"],
      reperes: null,
    };
    for (const [id, f] of Object.entries(base)) m.setFilter(id, f ? ["all", f, filtre] : filtre);
    const vis = (ids, on) => ids.forEach((id) => m.setLayoutProperty(id, "visibility", on ? "visible" : "none"));
    vis(["signaux-fond", "signaux-trait"], actifs.signaux);
    vis(["communes-eau"], actifs.eau);
    vis(["agri-cultures", "agri-bio", "agri-bio-trait"], actifs.agriculture);
  }, [actifs, preuves, rehabilites, pret]);

  useEffect(() => {
    const m = carte.current;
    if (!m || !pret) return;
    m.setFilter("reperes-selection", ["==", ["get", "id"], selection?.genre === "site" ? selection.id : ""]);
  }, [selection, pret]);

  const proprietes = useMemo(() => (donnees?.reperes?.features ?? []).map((f) => f.properties), [donnees]);
  const compteType = (id) => {
    if (id === "signaux") return donnees?.signaux_liste?.length ?? 0;
    if (id === "eau") return proprietes.filter((p) => p.type === "eau").length + (donnees?.eau ? Object.keys(donnees.eau.communes).length : 0);
    if (id === "agriculture") return null;
    return proprietes.filter((p) => p.type === id && (rehabilites || !p.rehabilite)).length;
  };
  const comptePreuve = (id) => proprietes.filter((p) => p.preuve === id && (rehabilites || !p.rehabilite)).length;
  const nbRehabilites = proprietes.filter((p) => p.rehabilite).length;
  const lib = donnees?.libelles;

  let panneau = null;
  const fermer = () => setSelection(null);
  if (selection?.genre === "site") {
    const p = proprietes.find((x) => x.id === selection.id);
    if (p) panneau = <PanneauSite p={p} d={donnees.details[p.id]} libelles={lib} fermer={fermer} />;
  } else if (selection?.genre === "commune") {
    const c = donnees.communes.features.find((f) => f.properties.code_insee === selection.code)?.properties;
    if (c) panneau = <PanneauCommune key={c.code_insee} c={c} donnees={donnees} actifs={actifs} fermer={fermer} />;
  } else if (selection?.genre === "signal") {
    const s = donnees.signaux_liste.find((x) => x.id === selection.id);
    if (s) panneau = <PanneauSignal s={s} bandeau={bandeau} fermer={fermer} />;
  } else if (selection?.genre === "agri") {
    panneau = <PanneauAgri p={selection.props} agri={agri} fermer={fermer} />;
  }

  return (
    <div className="appli">
      <header className="entete">
        <a href="/" className="titre">Pollutions documentées <span>agglomération de La Rochelle</span></a>
        <nav>
          <a href="/fiches">Toutes les fiches</a>
          <a href="/eau-du-robinet">Eau du robinet</a>
          <a href="/signaux-sanitaires">Signaux sanitaires</a>
          <a href="/restrictions">Restrictions d&apos;usage</a>
          <a href="/mentions-legales">Méthode et corrections</a>
        </nav>
      </header>

      <div className="filtres" role="group" aria-label="Filtres de la carte">
        <div className="filtres-ligne">
          <span className="filtres-titre">Types</span>
          {TYPES.map((t) => {
            const n = compteType(t.id);
            return (
              <button
                key={t.id}
                type="button"
                className={`puce ${actifs[t.id] ? "active" : ""} ${t.contexte ? "contexte" : ""}`}
                aria-pressed={actifs[t.id]}
                onClick={() => setActifs({ ...actifs, [t.id]: !actifs[t.id] })}
              >
                <span
                  className={`pastille-couleur ${t.hachure ? "hachure" : ""} ${t.degrade ? "degrade" : ""}`}
                  style={t.hachure || t.degrade ? undefined : { background: t.couleur }}
                />
                {t.libelle}
                {n != null ? <em>{n}</em> : null}
                <Definition titre={t.libelle}>{t.def}</Definition>
              </button>
            );
          })}
        </div>
        <div className="filtres-ligne">
          <span className="filtres-titre">Preuve</span>
          {PREUVES.map((id) => (
            <button
              key={id}
              type="button"
              className={`puce preuve-${id} ${preuves[id] ? "active" : ""}`}
              aria-pressed={preuves[id]}
              onClick={() => setPreuves({ ...preuves, [id]: !preuves[id] })}
            >
              <span className={`marque ${id}`} />
              {lib?.statut_preuve?.[id]?.libelle ?? id}
              <em>{comptePreuve(id)}</em>
              {lib ? <Definition titre={lib.statut_preuve[id].libelle}>{lib.statut_preuve[id].definition}</Definition> : null}
            </button>
          ))}
          <button type="button" className={`puce discrete ${rehabilites ? "active" : ""}`} aria-pressed={rehabilites} onClick={() => setRehabilites(!rehabilites)}>
            Sites réhabilités <em>{nbRehabilites}</em>
            {lib ? <Definition titre="Réhabilité">{lib.statut_traitement.rehabilite.definition} Masqués par défaut.</Definition> : null}
          </button>
        </div>
      </div>

      <div className="corps">
        <div className="carte-zone">
          <div ref={conteneur} className="carte-fond" role="region" aria-label="Carte des pollutions documentées" />
          {actifs.signaux ? (
            <p className="bandeau-carte">
              Hachures ocre : signaux sanitaires. Aucun lien de cause à effet n&apos;est établi avec les sites de la carte.{" "}
              <a href="/signaux-sanitaires">Les études</a>
            </p>
          ) : null}
          {donnees?.erreur ? <p className="erreur-carte">Les données de la carte n&apos;ont pas pu être chargées.</p> : null}
        </div>

        <aside className={`panneau ${panneau ? "avec-fiche" : ""}`} aria-live="polite">
          {panneau ?? (
            <div className="pan-accueil">
              <h1>Ce qui est documenté sous l&apos;agglomération de La Rochelle</h1>
              <p>
                Un fait n&apos;entre ici que s&apos;il est mesuré, diagnostiqué ou visé par une procédure administrative. Cliquez un point
                pour lire ce qui est mesuré, à quelle date, par qui, et ce qui reste à établir. Cliquez une commune pour l&apos;eau du
                robinet.
              </p>
              <h3>Lire les points</h3>
              <ul className="legende">
                <li><span className="marque mesure_publiee" />Plein : mesure publiée ou diagnostic administratif.</li>
                <li><span className="marque procedure_en_cours" />Atténué : procédure administrative en cours.</li>
                <li><span className="marque signalement_non_instruit" />Creux : signalé, jamais instruit.</li>
                <li><span className="ech flou" />Contour pointillé, visible de près : position approximative, pas l&apos;étendue de la pollution.</li>
              </ul>
              {actifs.baignade ? (
                <>
                  <h3>Plages, classement 2025</h3>
                  <ul className="legende ligne">
                    {Object.entries(BAIGNADE).map(([k, c]) => (
                      <li key={k}><span className="marque" style={{ background: c }} />{k}</li>
                    ))}
                    <li><span className="ech hachure" />Hors contrôle</li>
                  </ul>
                </>
              ) : null}
              {actifs.eau ? (
                <>
                  <h3>Eau du robinet depuis 2016</h3>
                  <ul className="legende">
                    <li><span className="ech" style={{ background: "rgba(47,111,143,0.32)", borderColor: COULEUR.eau }} />Au moins un résultat physico-chimique au-delà d&apos;une limite de qualité.</li>
                    <li><span className="ech" style={{ background: "rgba(47,111,143,0.16)", borderColor: COULEUR.eau }} />Dépassements microbiologiques seulement.</li>
                    <li><span className="ech" style={{ background: "rgba(47,111,143,0.05)", borderColor: COULEUR.eau }} />Aucun dépassement rattaché à la commune.</li>
                  </ul>
                </>
              ) : null}
              {actifs.agriculture && agri ? (
                <>
                  <h3>Agriculture en 2023, contexte</h3>
                  <p className="note">
                    {nb(agri.surface_declaree_ha)} ha déclarés à la PAC, dont {nb(agri.surface_bio_ha)} ha en agriculture biologique (
                    {nb(Math.round((agri.surface_bio_ha / agri.surface_declaree_ha) * 1000) / 10)} %).
                  </p>
                  <ul className="legende">
                    <li><span className="ech hachure-bio" />Agriculture biologique</li>
                    {agri.features.filter((f) => f.properties.couche === "culture").slice(0, 10).map((f) => (
                      <li key={f.properties.code_groupe}>
                        <span className="ech" style={{ background: CULTURES[f.properties.libelle] ?? "#d9d6cf", borderColor: "transparent" }} />
                        {f.properties.libelle} <em>{nb(f.properties.surface_ha)} ha</em>
                      </li>
                    ))}
                  </ul>
                </>
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
