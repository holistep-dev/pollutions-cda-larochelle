import { site } from "../lib/site";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lire = (chemin) => JSON.parse(readFileSync(join(process.cwd(), chemin), "utf8"));

export default function Accueil() {
  const communes = lire("data/build/communes-index.json").communes;
  const sitesGeo = lire("data/build/sites.geojson");
  const recherches = lire("data/recherches-infructueuses.json");
  const nbSites = communes.reduce((n, c) => n + c.nb_sites, 0);
  const nbLocalises = sitesGeo.features.length;

  return (
    <main>
      <h1>Ce qui est documenté sous l&apos;agglomération de La Rochelle</h1>
      <p className="sous-titre">
        Recensement des pollutions documentées sur les 28 communes de la Communauté d&apos;agglomération. Le site
        est en construction. Les premières fiches sont en ligne, la carte suit.
      </p>

      <p className="regle">
        Un fait n&apos;entre ici que s&apos;il est mesuré, diagnostiqué, ou visé par une procédure administrative. Un
        risque n&apos;est pas une pollution. Chaque fiche dit d&apos;où vient l&apos;information, à quelle date, et
        ce qui manque encore.
      </p>

      <h2>État du recensement</h2>
      <div className="etat">
        <div>
          <b>{nbSites}</b>
          <span>fiches publiées</span>
        </div>
        <div>
          <b>{nbLocalises}</b>
          <span>sites localisés</span>
        </div>
        <div>
          <b>{recherches.recherches.length}</b>
          <span>recherches documentées, abouties ou non</span>
        </div>
      </div>

      <h2>Communes couvertes</h2>
      <ul className="communes">
        {communes.map((c) => (
          <li key={c.code_insee}>
            <span>{c.nom}</span>
            <em>{c.nb_sites || "—"}</em>
          </li>
        ))}
      </ul>

      <footer>
        <p>
          Données et code publics : <a href={site.depot}>dépôt GitHub</a>. Une erreur, une pièce à verser, une
          demande de rectification : <a href="/mentions-legales">mentions légales et procédure de correction</a>.
        </p>
      </footer>
    </main>
  );
}
