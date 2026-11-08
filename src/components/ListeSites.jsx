import { libelles, ORDRE_CATEGORIES } from "../lib/donnees";

// Liste de fiches groupée par catégorie, chaque fiche avec son niveau de preuve.
export default function ListeSites({ sites, avecCommune = true }) {
  const L = libelles();
  const groupes = ORDRE_CATEGORIES.map((c) => [c, sites.filter((s) => s.categorie === c)]).filter(
    ([, l]) => l.length
  );
  return groupes.map(([cat, liste]) => (
    <section key={cat}>
      <h3>{L.categorie[cat]}</h3>
      <ul className="liste-sites">
        {liste.map((s) => (
          <li key={s.id}>
            <a href={`/sites/${s.id}`}>{s.nom}</a>
            {avecCommune ? <span className="commune">{s.commune}</span> : null}
            <span className={`preuve ${s.statut_preuve}`}>{L.statut_preuve[s.statut_preuve].libelle}</span>
            <span className="traitement">{L.statut_traitement[s.statut_traitement].libelle}</span>
          </li>
        ))}
      </ul>
    </section>
  ));
}
