import Source from "../../components/Source";
import { eauPotable, etatRobinets, communes, sources, dateLisible } from "../../lib/donnees";

const ETATS = {
  rouge: ["Au-dessus d'une limite légale", "#dc2626"],
  orange: ["Polluée sous les limites légales", "#f59e0b"],
  vert: ["Aucune pollution détectée", "#16a34a"],
  non_analyse: ["Pesticides non recherchés", "#94a3b8"],
};

export const metadata = {
  title: "Eau du robinet",
  description:
    "Résultats du contrôle sanitaire de l'eau distribuée au-delà d'une limite de qualité depuis 2016, pour les 28 communes de l'agglomération de La Rochelle.",
  alternates: { canonical: "/eau-du-robinet" },
};

const date = (d) => d.split("-").reverse().join("/");

export default function EauDuRobinet() {
  const eau = eauPotable();
  const etat = etatRobinets();
  const src = sources();
  const liste = communes()
    .map((c) => ({ ...c, eau: eau?.communes?.[c.code_insee] }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  const total = liste.reduce((n, c) => n + (c.eau?.nb_depassements ?? 0), 0);
  const avec = liste.filter((c) => c.eau?.nb_depassements).length;

  return (
    <main>
      <p className="fil">
        <a href="/">Carte</a>
      </p>
      <h1>Eau du robinet</h1>
      <p className="sous-titre">
        Contrôle sanitaire de l&apos;eau distribuée, commune par commune, depuis le 1er janvier 2016. Données collectées le{" "}
        {eau ? dateLisible(eau.collecte_le) : "…"}.
      </p>

      <p className="regle">
        Une limite de qualité est une norme de gestion fixée avec des marges de sécurité. Pour les pesticides, elle vaut 0,1 µg/L par
        molécule et 0,5 µg/L pour leur somme, quelle que soit leur toxicité. Un résultat au-delà n&apos;est pas un dépassement de seuil
        sanitaire. L&apos;ARS décide, au cas par cas, d&apos;une éventuelle restriction de consommation. Aucune restriction de
        consommation n&apos;est recensée sur ce site pour l&apos;agglomération.
      </p>

      <h2>La couleur de chaque commune</h2>
      <p>
        Sur la carte, chaque commune porte un robinet coloré selon les douze derniers mois de contrôle sanitaire
        {etat ? `, du ${dateLisible(etat.debut)} au ${dateLisible(etat.fin)}` : ""}. L&apos;état est calculé réseau par réseau, et la commune
        prend l&apos;état le plus défavorable des réseaux qui la desservent. Rouge : au moins un résultat au-delà d&apos;une limite de
        qualité. Orange : aucun dépassement, mais une substance de synthèse quantifiée sous sa limite, comme un pesticide, un métabolite de
        pesticide, un PFAS ou le chlorure de vinyle. Vert : rien de tel, alors que des pesticides ont été recherchés. Gris : pesticides non
        recherchés sur la période, on ne sait pas.
      </p>

      <h2>Depuis 2016</h2>
      <p>
        {total} résultats d&apos;analyse dépassent une limite de qualité depuis 2016, répartis sur {avec} des 28 communes. La liste
        commune par commune figure plus bas.
      </p>
      <p>
        Le métabolite R471811 du chlorothalonil, un fongicide interdit depuis 2020, représente la majorité de ces résultats, mesurés en 2023 et 2024.
        La CDA a arrêté tous ses captages d&apos;Aunis du 25 octobre 2023 au 18 juin 2024 et alimenté le réseau depuis les usines de
        Coulonge et de Saint-Hippolyte. Le 29 avril 2024, l&apos;ANSES a classé ce métabolite « non pertinent ». La limite de 0,1 µg/L
        ne s&apos;applique plus à lui. Une valeur indicative de 0,9 µg/L la remplace. Plusieurs de ces résultats dépassent aussi cette
        valeur.
      </p>
      <p>
        Le fosétyl est un fongicide agricole. Il est détecté de façon saisonnière dans l&apos;eau prélevée dans la Charente à
        Saint-Savinien et traitée à l&apos;usine de Coulonge. Un arrêté préfectoral du 26 mars 2026 accorde une dérogation aux limites de
        qualité pour ce paramètre sur les neuf unités de distribution desservies par cette usine. Le fleuve et son bassin se situent
        pour l&apos;essentiel hors de l&apos;agglomération.
      </p>
      <p>
        Le chlorure de vinyle monomère provient en général des canalisations en PVC anciennes, en particulier en bout de réseau. Le
        plomb provient en général des canalisations ou des branchements en plomb. Ces deux paramètres décrivent l&apos;état du réseau
        plus que celui de la ressource.
      </p>
      <p className="note">
        Limites de la lecture. Le rattachement d&apos;un résultat à une commune est celui de la base nationale : une analyse faite sur un
        réseau qui dessert plusieurs communes peut n&apos;être enregistrée que sous l&apos;une d&apos;elles. L&apos;absence de résultat
        sous une commune ne prouve donc pas l&apos;absence de dépassement sur son réseau. Seuls les prélèvements que la base déclare non
        conformes ont été lus. Les données antérieures à 2016 ne sont pas publiées par l&apos;API.
      </p>

      <h2>Par commune</h2>
      {liste.map((c) => (
        <section key={c.code_insee} id={c.code_insee} className="eau-commune">
          <h3>
            {c.nom}{" "}
            {etat?.communes?.[c.code_insee] ? (
              <span className="pastille-etat" style={{ background: ETATS[etat.communes[c.code_insee].etat][1] }}>
                {ETATS[etat.communes[c.code_insee].etat][0]}, douze derniers mois
              </span>
            ) : null}
          </h3>
          {c.eau ? (
            <>
              <p className="note">
                {c.eau.reseaux.join(", ")}. {c.eau.nb_prelevements.toLocaleString("fr-FR")} prélèvements depuis 2016, le dernier le{" "}
                {dateLisible(c.eau.dernier_prelevement)}.
              </p>
              {c.eau.depassements.length ? (
                <table className="mesures">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Paramètre</th>
                      <th>Résultat</th>
                      <th>Limite de qualité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.eau.depassements.map((d, i) => (
                      <tr key={i}>
                        <td>{date(d.date)}</td>
                        <td>{d.parametre}</td>
                        <td>
                          {d.resultat ?? d.valeur} {d.unite}
                        </td>
                        <td>{d.limite}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>Aucun résultat au-delà d&apos;une limite de qualité rattaché à cette commune.</p>
              )}
            </>
          ) : (
            <p>Pas de données.</p>
          )}
        </section>
      ))}

      <h2>Sources</h2>
      <ul className="sources">
        {["hubeau-qualite-eau-potable", "cda-larochelle-chlorothalonil-faq", "ars17-arrete-2026-03-edch-01"].map((id) => (
          <Source key={id} source={src.get(id)} />
        ))}
      </ul>
    </main>
  );
}
