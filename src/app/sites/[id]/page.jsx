import { notFound } from "next/navigation";
import Statuts from "../../../components/Statuts";
import Source from "../../../components/Source";
import {
  sites,
  site as lireSite,
  sources as lireSources,
  libelles,
  serieBaignade,
  communes,
  dateLisible,
  periodeLisible,
} from "../../../lib/donnees";

export const dynamicParams = false;

export function generateStaticParams() {
  return sites().map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const s = lireSite(id);
  if (!s) return {};
  return {
    title: `${s.nom}, ${s.commune}`,
    description: s.resume.slice(0, 160),
    alternates: { canonical: `/sites/${s.id}` },
  };
}

const NATURE_REF = {
  limite_de_qualite: "limite de qualité",
  valeur_indicative: "valeur indicative",
  seuil_sanitaire: "seuil sanitaire",
  valeur_de_gestion: "valeur de gestion",
  aucune: "sans référence réglementaire",
};

function Baignade({ serie }) {
  if (!serie) return null;
  const saisons = Object.keys(serie.classements).sort();
  const prel = serie.prelevements ?? [];
  const entMax = prel.reduce((m, p) => Math.max(m, p.enterocoques_ufc_100ml ?? 0), 0);
  const ecoMax = prel.reduce((m, p) => Math.max(m, p.escherichia_coli_ufc_100ml ?? 0), 0);
  const audessus = prel.filter(
    (p) => (p.enterocoques_ufc_100ml ?? 0) > 370 || (p.escherichia_coli_ufc_100ml ?? 0) > 1000
  ).length;
  const annees = prel.length ? [prel[0].date.slice(0, 4), prel[prel.length - 1].date.slice(0, 4)].sort() : [];
  return (
    <section>
      <h2>Classements annuels</h2>
      <p className="note">
        Le classement est calculé par l&apos;administration sur les quatre dernières saisons de prélèvements, à partir
        de deux bactéries d&apos;origine fécale. Il ne mesure ni les substances chimiques ni les hydrocarbures.
      </p>
      <div className="frise">
        {saisons.map((a) => (
          <div key={a} className={`case ${(serie.classements[a] ?? "aucun").toLowerCase()}`}>
            <span>{a}</span>
            <b>{serie.classements[a] ?? "aucun"}</b>
          </div>
        ))}
      </div>
      {serie.motif_absence_classement ? <p className="note">{serie.motif_absence_classement}</p> : null}
      {prel.length ? (
        <>
          <h2>Prélèvements du contrôle sanitaire</h2>
          <p>
            {prel.length} prélèvements publiés, saisons {annees[0]} à {annees[1]}. Valeur la plus haute : {entMax}{" "}
            UFC/100 mL en entérocoques, {ecoMax} UFC/100 mL en Escherichia coli. {audessus} prélèvement
            {audessus > 1 ? "s dépassent" : " dépasse"} la borne haute d&apos;un des deux paramètres (370 et 1 000
            UFC/100 mL en eau de mer). Ces bornes séparent des classes de qualité, ce ne sont pas des seuils
            sanitaires.
          </p>
        </>
      ) : null}
      {serie.evenements_declares?.length ? (
        <>
          <h2>Événements déclarés à l&apos;Union européenne</h2>
          <ul className="simple">
            {serie.evenements_declares.map((e, i) => (
              <li key={i}>
                {e.type}, du {dateLisible(e.debut)} au {dateLisible(e.fin)}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {serie.fermetures?.length ? (
        <>
          <h2>Fermetures temporaires</h2>
          <ul className="simple">
            {serie.fermetures.map((f, i) => (
              <li key={i}>
                Du {dateLisible(f.debut)} {f.fin ? `au ${dateLisible(f.fin)}` : "à une date non documentée"}.{" "}
                {f.motif_declare ?? ""} {f.conclusion_analyses ?? ""}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

export default async function FicheSite({ params }) {
  const { id } = await params;
  const s = lireSite(id);
  if (!s) notFound();
  const src = lireSources();
  const L = libelles();
  const tous = new Map(sites().map((x) => [x.id, x]));
  const commune = communes().find((c) => c.code_insee === s.code_insee);
  const ids = [...new Set([...(s.sources ?? []), ...(s.revue_presse ?? []).map((r) => r.source)])];

  return (
    <main className="fiche">
      <p className="fil">
        <a href="/">Accueil</a> / <a href={`/communes/${commune.slug}`}>{s.commune}</a>
      </p>
      <p className="categorie">{L.categorie[s.categorie]}</p>
      <h1>{s.nom}</h1>
      <p className="sous-titre">
        {s.commune}. {periodeLisible(s.periode)}. Dernière vérification le {dateLisible(s.derniere_verification)}.
      </p>
      {s.periode?.note ? <p className="note">{s.periode.note}</p> : null}

      <Statuts site={s} />

      <h2>Résumé</h2>
      <p>{s.resume}</p>

      {s.substances?.length ? (
        <>
          <h2>Mesures</h2>
          <table className="mesures">
            <thead>
              <tr>
                <th>Substance</th>
                <th>Valeur</th>
                <th>Référence</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {s.substances.map((m, i) => (
                <tr key={i}>
                  <td>{m.libelle}</td>
                  <td>{m.valeur !== undefined ? `${m.valeur.toLocaleString("fr-FR")} ${m.unite ?? ""}` : "non chiffré"}</td>
                  <td>
                    {m.reference_reglementaire
                      ? `${m.reference_reglementaire.libelle}${
                          m.reference_reglementaire.nature ? ` (${NATURE_REF[m.reference_reglementaire.nature]})` : ""
                        }`
                      : "aucune"}
                  </td>
                  <td>{m.date_mesure ? dateLisible(m.date_mesure) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {s.categorie === "eau_baignade" ? <Baignade serie={serieBaignade(s.id)} /> : null}

      {s.chronologie?.length ? (
        <>
          <h2>Chronologie</h2>
          <ol className="chronologie">
            {s.chronologie.map((e, i) => (
              <li key={i}>
                <time>{dateLisible(e.date)}</time>
                <span>
                  {e.fait}{" "}
                  {(e.sources ?? []).map((id) => (
                    <a key={id} className="renvoi" href={`#source-${id}`}>
                      [{L.type_source[src.get(id)?.type] ?? id}]
                    </a>
                  ))}
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {s.exploitants?.length ? (
        <>
          <h2>Exploitants nommés par un document public</h2>
          <ul className="simple">
            {s.exploitants.map((e, i) => (
              <li key={i}>
                {e.nom}
                {e.role ? `, ${e.role}` : ""}
                {e.debut || e.fin ? `, ${e.debut ? dateLisible(e.debut) : "?"} à ${e.fin ? dateLisible(e.fin) : "?"}` : ""}{" "}
                <a className="renvoi" href={`#source-${e.source}`}>
                  [source]
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {s.temoignages?.length ? (
        <>
          <h2>Témoignages</h2>
          <p className="note">Ces propos sont rapportés tels quels. Ils ne valent pas fait établi.</p>
          <ul className="simple">
            {s.temoignages.map((t, i) => (
              <li key={i}>
                {t.anonymise || !t.auteur ? "Un témoin" : t.auteur}
                {t.date ? `, ${dateLisible(t.date)}` : ""} : {t.propos}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {s.ce_qui_manque?.length ? (
        <>
          <h2>Ce qui manque</h2>
          <ul className="simple">
            {s.ce_qui_manque.map((m, i) => (
              <li key={i}>
                {m.piece}. <span className="note">Où chercher : {m.ou_chercher}.</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {s.revue_presse?.length ? (
        <>
          <h2>Revue de presse</h2>
          <p className="note">Articles rattachés à la fiche, sans valeur de preuve.</p>
          <ul className="simple">
            {s.revue_presse.map((r, i) => {
              const so = src.get(r.source);
              return (
                <li key={i}>
                  {so?.auteur}, {so?.url ? <a href={so.url}>{so.titre}</a> : so?.titre}, {dateLisible(so?.date)}.{" "}
                  {r.angle ?? ""}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {s.liens?.length ? (
        <>
          <h2>Fiches liées</h2>
          <ul className="simple">
            {s.liens
              .filter((l) => tous.has(l.site))
              .map((l) => (
                <li key={l.site}>
                  <a href={`/sites/${l.site}`}>{tous.get(l.site).nom}</a>
                </li>
              ))}
          </ul>
        </>
      ) : null}

      <h2>Sources</h2>
      <ul className="sources">
        {ids.map((id) => (
          <Source key={id} source={src.get(id)} />
        ))}
      </ul>
    </main>
  );
}
