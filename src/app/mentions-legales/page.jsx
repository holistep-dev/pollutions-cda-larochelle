import { site } from "../../lib/site";
import { references } from "../../lib/donnees";

export const metadata = {
  title: "Mentions légales et procédure de correction",
  alternates: { canonical: "/mentions-legales" },
};

export default function MentionsLegales() {
  const refs = references();
  return (
    <main>
      <p className="fil">
        <a href="/">Carte</a>
      </p>
      <h1>Méthode, mentions légales et corrections</h1>

      <h2>Éditeur</h2>
      <p>
        {site.directeur_publication
          ? `Directeur de la publication : ${site.directeur_publication}.`
          : "Directeur de la publication : à compléter avant la mise en ligne publique."}{" "}
        {site.contact ? `Contact : ${site.contact}.` : "Contact : à compléter."}
      </p>

      <h2>Hébergement</h2>
      <p>Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.</p>

      <h2>Ce que publie ce site</h2>
      <p>
        Chaque fiche indique ses sources, la date de dernière vérification, le niveau de preuve retenu et ce qui
        manque encore. Les exploitants ne sont nommés que lorsqu&apos;un document administratif public ou une
        décision de justice les nomme. Les témoignages sont présentés comme tels et ne valent pas fait établi.
        Aucun lien de cause à effet n&apos;est affirmé entre un site recensé et un effet sanitaire.
      </p>

      <h2>Demander une correction ou exercer un droit de réponse</h2>
      <p>
        Toute personne ou organisation citée peut demander la rectification d&apos;une information inexacte, en
        indiquant la fiche concernée et en joignant la pièce qui l&apos;établit. Délai de réponse et modalités
        d&apos;envoi : à compléter.
      </p>
      <p>
        Les corrections sont publiques. Le contenu du site est versionné dans un dépôt ouvert, où chaque
        modification est horodatée et attribuable : <a href={site.depot}>{site.depot}</a>.
      </p>

      <h2 id="references">Valeurs de comparaison</h2>
      <p>{refs.note}</p>
      <ul className="simple">
        {Object.entries(refs.natures).map(([k, v]) => (
          <li key={k}>
            <b>{{ fond_geochimique: "Fond géochimique", valeur_de_gestion: "Valeur de gestion", limite_de_qualite: "Limite de qualité", seuil_sanitaire: "Seuil sanitaire", aucune: "Aucune valeur" }[k]}.</b> {v}
          </li>
        ))}
      </ul>
      <h3>Textes et études utilisés</h3>
      <ul className="simple">
        {Object.values(refs.sources).map((r) => (
          <li key={r.titre}>
            {r.url ? <a href={r.url}>{r.titre}</a> : r.titre}, {r.auteur}, {r.date}
            {r.publication ? `, ${r.publication}` : ""}.
          </li>
        ))}
      </ul>
      <p className="note">
        Pour les sols, la France ne fixe pas de seuil générique de pollution. Le site compare donc aux teneurs couramment observées
        dans des sols non pollués, et, pour les hydrocarbures, les BTEX, les PCB et les HAP, au seuil d&apos;admission des terres en
        stockage de déchets inertes, qui est une valeur de gestion. Le plomb est aussi comparé aux seuils de vigilance et
        d&apos;intervention du Haut Conseil de la santé publique.
      </p>

      <h2 id="pesticides">Pesticides agricoles</h2>
      <p>
        Le site traite l&apos;usage de pesticides de synthèse comme une pollution diffuse. La carte montre chaque parcelle déclarée à la PAC
        en 2023 avec son groupe de cultures. Une parcelle absente du jeu de l&apos;Agence Bio est dite conventionnelle : l&apos;usage de
        pesticides de synthèse y est autorisé. La carte ne dit pas ce qui a été épandu sur une parcelle donnée, ni quand. En agriculture
        biologique, les pesticides de synthèse sont interdits, mais certains produits comme le cuivre ou le soufre restent autorisés. Aucun
        exploitant n&apos;est nommé.
      </p>
      <p>
        Les quantités achetées viennent de la banque nationale des ventes de produits phytopharmaceutiques (BNV-D) de l&apos;OFB, par code
        postal de l&apos;acheteur. Thairé et Vérines partagent leur code postal avec des communes extérieures et ne sont pas comptés.
      </p>

      <h2 id="nappes-canaux">Nappes et canaux</h2>
      <p>
        Les points de mesure des eaux souterraines (ADES) et des cours d&apos;eau et canaux (Naïades) entrent sur la carte quand une analyse
        publiée depuis 2015 dépasse 50 mg/l de nitrates, norme de qualité des eaux souterraines et seuil du bon état des cours d&apos;eau. Pour
        les captages, il s&apos;agit de l&apos;eau brute, avant traitement et mélange : ce n&apos;est pas l&apos;eau du robinet. Les métabolites
        de pesticides classés non pertinents par l&apos;ANSES, comme le chlorothalonil R471811 ou les métabolites ESA et NOA du métolachlore,
        sont affichés quand ils sont quantifiés, sans verdict de dépassement. Les piézomètres des sites industriels déclarés dans ADES n&apos;ont
        pas de résultat publié.
      </p>

      <h2 id="air">Air ambiant</h2>
      <p>
        L&apos;air de fond n&apos;est pas une entrée de la carte. Aux stations d&apos;Atmo Nouvelle-Aquitaine de La Pallice et du centre-ville, les
        particules fines respectent en 2023 et 2024 les valeurs limites réglementaires : 7 µg/m³ de PM2,5 en moyenne annuelle pour une limite
        de 25. Elles dépassent les lignes directrices de l&apos;OMS de 2021, qui recommandent 5 µg/m³ en moyenne annuelle et pas plus de trois à
        quatre jours par an au-dessus de 15 µg/m³ ; on en a compté 13 à 29 selon l&apos;année et la station. Les lignes directrices de
        l&apos;OMS ne sont pas des valeurs réglementaires. Seuls figurent sur la carte des émissions industrielles ayant fait l&apos;objet
        d&apos;un constat de l&apos;inspection et des pesticides mesurés dans l&apos;air.
      </p>
      <p className="note">
        Sources : Atmo Nouvelle-Aquitaine, synthèses annuelles 2023 et 2024 de la station La Rochelle La Pallice, publiées par Port Atlantique
        La Rochelle.
      </p>

      <h2 id="couleurs">Codes couleur</h2>
      <p>
        Plages : vert pour un classement excellent ou bon, orange pour suffisant, rouge pour insuffisant ou pour une baignade interdite par
        arrêté après des saisons insuffisantes. Le classement porte sur deux bactéries d&apos;origine fécale.
      </p>
      <p>
        Eau du robinet : l&apos;état est calculé sur les douze derniers mois de contrôle sanitaire, réseau par réseau, et chaque commune
        prend l&apos;état le plus défavorable de ses réseaux. Rouge : au moins un résultat au-delà d&apos;une limite de qualité. Orange :
        aucun dépassement, mais une substance de synthèse quantifiée sous sa limite (pesticide ou métabolite, PFAS, chlorure de vinyle,
        solvant chloré). Vert : ni l&apos;un ni l&apos;autre, alors que des pesticides ont été recherchés. Gris : pesticides non recherchés
        sur la période. Les sous-produits de la chloration, les métaux et les nitrates ne changent pas la couleur. Une limite de qualité
        n&apos;est pas un seuil sanitaire.
      </p>

      <h2>Données republiées</h2>
      <p>
        Les jeux de données publics republiés ici sont diffusés sous Licence Ouverte. L&apos;attribution figure sur
        chaque source, avec le lien et la page. La licence du jeu consolidé reste à fixer.
      </p>

      <footer>
        <p>
          <a href="/">Retour à la carte</a>
        </p>
      </footer>
    </main>
  );
}
