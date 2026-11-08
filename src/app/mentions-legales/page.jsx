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

      <h2>Couche agricole</h2>
      <p>
        La carte peut afficher les cultures déclarées à la PAC en 2023 et les parcelles en agriculture biologique. C&apos;est une
        couche de contexte, désactivée par défaut. Elle ne mesure aucune pollution et ne nomme aucun exploitant. Sources : IGN,
        registre parcellaire graphique 2023 ; Agence Bio, parcelles en agriculture biologique déclarées à la PAC, 2023.
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
