import { site } from "../../lib/site";
import ListeSites from "../../components/ListeSites";
import { sites, indexCommunes, recherches, signaux, restrictions } from "../../lib/donnees";

export const metadata = {
  title: "Toutes les fiches",
  alternates: { canonical: "/fiches" },
};

export default function Fiches() {
  const communes = indexCommunes();
  const liste = sites();
  const nbLocalises = liste.filter((s) => s.geometry).length;
  const sig = signaux();
  const res = restrictions();

  return (
    <main>
      <p className="fil">
        <a href="/">Carte</a>
      </p>
      <h1>Toutes les fiches</h1>
      <p className="sous-titre">
        Recensement des pollutions documentées sur les 28 communes de la Communauté d&apos;agglomération. Le site
        est en construction. Les fiches sont en ligne au fil de leur saisie.
      </p>


      <p className="regle">
        Un fait n&apos;entre ici que s&apos;il est mesuré, diagnostiqué, ou visé par une procédure administrative. Un
        risque n&apos;est pas une pollution. Chaque fiche dit d&apos;où vient l&apos;information, à quelle date, et
        ce qui manque encore.
      </p>

      <h2>État du recensement</h2>
      <div className="etat">
        <div>
          <b>{liste.length}</b>
          <span>fiches publiées</span>
        </div>
        <div>
          <b>{nbLocalises}</b>
          <span>sites localisés</span>
        </div>
        <div>
          <b>{recherches().length}</b>
          <span>recherches documentées, abouties ou non</span>
        </div>
      </div>

      <h2>Fiches</h2>
      <ListeSites sites={liste} />

      {res.length || sig.length ? <h2>Autres rubriques</h2> : null}
      <ul className="simple">
        {res.length ? (
          <li>
            <a href="/restrictions">Restrictions d&apos;usage</a>, {res.length} décision
            {res.length > 1 ? "s" : ""} d&apos;une autorité : ce qui est interdit ou déconseillé.
          </li>
        ) : null}
        {sig.length ? (
          <li>
            <a href="/signaux-sanitaires">Signaux sanitaires</a>, {sig.length} résultat
            {sig.length > 1 ? "s" : ""} d&apos;études épidémiologiques, présentés à part, sans lien de cause établi
            avec les sites.
          </li>
        ) : null}
        <li>
          <a href="/eau-du-robinet">Eau du robinet</a>, résultats du contrôle sanitaire au-delà d&apos;une limite de qualité depuis 2016, commune par commune.
        </li>
      </ul>

      <h2>Par commune</h2>
      <ul className="communes">
        {communes.map((c) => (
          <li key={c.code_insee}>
            <a href={`/communes/${c.slug}`}>{c.nom}</a>
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
