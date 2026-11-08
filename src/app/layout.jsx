import "@fontsource-variable/figtree";
import "./globals.css";
import { site } from "../lib/site";

export const metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: site.nom,
    template: "%s — pollution-larochelle.fr",
  },
  description: site.description,
  alternates: { canonical: "/" },
  openGraph: {
    title: site.nom,
    description: site.description,
    url: site.url,
    siteName: site.domaine,
    locale: "fr_FR",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
