import Source from "../../components/Source";
import { restrictions, sources, communes, dateLisible, sites } from "../../lib/donnees";

export const metadata = {
  title: "Restrictions d'usage",
  alternates: { canonical: "/restrictions" },
};

const NATURE = {
  interdiction: "Interdiction",
  recommandation: "Recommandation",
  classement_sanitaire: "Classement sanitaire",
};
const STATUT = { en_vigueur: "en vigueur", levee: "levée", inconnue: "statut actuel non documenté" };

export default function Restrictions() {
  const liste = restrictions();
  const src = sources();
  const nomCommune = new Map(communes().map((c) => [c.code_insee, c.nom]));
  const nomSite = new Map(sites().map((s) => [s.id, s.nom]));
  return (
    <main>
      <p className="fil">
        <a href="/">Carte</a> / <a href="/fiches">Fiches</a>
      </p>
      <h1>Restrictions d&apos;usage</h1>
      <p className="sous-titre">
        Ce qu&apos;une autorité interdit ou déconseille de faire. Une restriction n&apos;est pas un site pollué : elle
        dit ce qui est décidé, avec le motif écrit dans l&apos;acte quand il existe.
      </p>
      {liste.map((r) => (
        <section key={r.id} id={r.id}>
          <h2>{r.libelle}</h2>
          <p className="sous-titre">
            {NATURE[r.nature]}, {r.autorite}. Depuis {dateLisible(r.date_debut)}, {STATUT[r.statut]}.{" "}
            {r.portee.libelle_zone ?? ""} Communes : {r.portee.communes.map((c) => nomCommune.get(c)).join(", ")}.
          </p>
          {r.motif_declare ? (
            <p>
              <b>Motif déclaré.</b> {r.motif_declare}
            </p>
          ) : null}
          {r.sites_lies?.length ? (
            <p>
              Fiches liées :{" "}
              {r.sites_lies.map((id, i) => (
                <span key={id}>
                  {i ? ", " : ""}
                  <a href={`/sites/${id}`}>{nomSite.get(id)}</a>
                </span>
              ))}
              .
            </p>
          ) : null}
          <ul className="sources">
            {r.sources.map((id) => (
              <Source key={id} source={src.get(id)} />
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
