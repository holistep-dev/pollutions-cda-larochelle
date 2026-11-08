import { site } from "../../lib/site";

export const metadata = {
  title: "Mentions légales et procédure de correction",
  alternates: { canonical: "/mentions-legales" },
};

export default function MentionsLegales() {
  return (
    <main>
      <h1>Mentions légales et procédure de correction</h1>

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

      <h2>Données republiées</h2>
      <p>
        Les jeux de données publics republiés ici sont diffusés sous Licence Ouverte. L&apos;attribution figure sur
        chaque source, avec le lien et la page. La licence du jeu consolidé reste à fixer.
      </p>

      <footer>
        <p>
          <a href="/">Retour à l&apos;accueil</a>
        </p>
      </footer>
    </main>
  );
}
