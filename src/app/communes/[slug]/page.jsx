import { notFound } from "next/navigation";
import ListeSites from "../../../components/ListeSites";
import { communes, sites, signaux, restrictions } from "../../../lib/donnees";

export const dynamicParams = false;

export function generateStaticParams() {
  return communes().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const c = communes().find((x) => x.slug === slug);
  return c ? { title: c.nom, alternates: { canonical: `/communes/${slug}` } } : {};
}

export default async function Commune({ params }) {
  const { slug } = await params;
  const c = communes().find((x) => x.slug === slug);
  if (!c) notFound();
  const liste = sites().filter(
    (s) => s.code_insee === c.code_insee || (s.communes_secondaires ?? []).includes(c.code_insee)
  );
  const sansLieu = liste.filter((s) => !s.geometry);
  const sig = signaux().filter((s) => (s.communes ?? []).includes(c.code_insee));
  const res = restrictions().filter((r) => r.portee.communes.includes(c.code_insee));

  return (
    <main>
      <p className="fil">
        <a href="/">Accueil</a>
      </p>
      <h1>{c.nom}</h1>
      <p className="sous-titre">
        Code INSEE {c.code_insee}. {liste.length ? `${liste.length} fiche${liste.length > 1 ? "s" : ""}.` : ""}
        {sansLieu.length ? ` Dont ${sansLieu.length} sans localisation connue.` : ""}
      </p>

      {liste.length ? (
        <ListeSites sites={liste} avecCommune={false} />
      ) : (
        <p>
          Aucune fiche n&apos;est publiée pour cette commune à ce jour. Cela ne veut pas dire qu&apos;aucune pollution
          n&apos;y existe : le recensement est en cours et suit l&apos;ordre des sources dépouillées.
        </p>
      )}

      {res.length ? (
        <>
          <h2>Restrictions d&apos;usage</h2>
          <ul className="simple">
            {res.map((r) => (
              <li key={r.id}>
                <a href={`/restrictions#${r.id}`}>{r.libelle}</a>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {sig.length ? (
        <>
          <h2>Signaux sanitaires</h2>
          <p className="note">
            Résultats d&apos;études épidémiologiques. Aucun lien de cause à effet n&apos;est établi avec les fiches de
            cette commune.
          </p>
          <ul className="simple">
            {sig.map((s) => (
              <li key={s.id}>
                <a href={`/signaux-sanitaires#${s.id}`}>{s.libelle}</a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </main>
  );
}
