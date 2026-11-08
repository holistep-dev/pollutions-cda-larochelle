import Source from "../../components/Source";
import { signaux, sources, libelles, communes, periodeLisible, dateLisible } from "../../lib/donnees";

export const metadata = {
  title: "Signaux sanitaires",
  alternates: { canonical: "/signaux-sanitaires" },
};

export default function SignauxSanitaires() {
  const liste = signaux();
  const src = sources();
  const nomCommune = new Map(communes().map((c) => [c.code_insee, c.nom]));
  return (
    <main>
      <p className="fil">
        <a href="/">Carte</a> / <a href="/fiches">Fiches</a>
      </p>
      <h1>Signaux sanitaires</h1>
      <p className="bandeau">{libelles().bandeau_signaux_sanitaires}</p>
      <p>
        Les cancers « pédiatriques » des études du registre portent sur les 0 à 24 ans : enfants, adolescents et jeunes adultes. La
        tranche a été choisie avec la Ligue contre le cancer.
      </p>
      <p>
        Cette page rassemble des résultats d&apos;études épidémiologiques portant sur la population de
        l&apos;agglomération. Ce ne sont pas des pollutions. Ils sont présentés séparément des fiches de sites, sans
        rapprochement géographique, parce qu&apos;aucune des études citées n&apos;établit de lien entre une source de
        pollution et les cas observés.
      </p>
      {[...liste.filter((s) => s.niveau_source !== "presse"), ...liste.filter((s) => s.niveau_source === "presse")].map((s) => (
        <section key={s.id} id={s.id} className={`signal ${s.niveau_source === "presse" ? "signal-presse" : ""}`}>
          {s.niveau_source === "presse" ? (
            <p className="categorie">Chiffre connu par la presse seulement</p>
          ) : null}
          <h2>{s.accroche ?? s.libelle}</h2>
          {s.resume_court ? <p className="chapeau">{s.resume_court}</p> : null}
          <p className="sous-titre">
            {s.zone_libelle ?? (s.communes ?? []).map((c) => nomCommune.get(c)).join(", ")}. Période étudiée :{" "}
            {periodeLisible(s.periode)}.
          </p>
          <p>
            <b>Population.</b> {s.population}
          </p>
          <p>
            <b>Ce que l&apos;étude mesure.</b> {s.resultat}
          </p>
          <p>
            <b>Étude.</b> {s.auteur_etude}
          </p>
          {s.facteurs_de_risque_connus ? (
            <p>
              <b>Facteurs de risque connus.</b> {s.facteurs_de_risque_connus}
            </p>
          ) : null}
          {s.enquetes_en_cours?.length ? (
            <>
              <h3>Enquêtes officielles en cours</h3>
              <ul className="simple">
                {s.enquetes_en_cours.map((e, i) => (
                  <li key={i}>
                    {e.nom}, pilotée par {e.pilote}
                    {e.echeance ? `, échéance ${dateLisible(e.echeance)}` : ""}.
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <h3>Sources</h3>
          <ul className="sources">
            {s.sources.map((id) => (
              <Source key={id} source={src.get(id)} />
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
