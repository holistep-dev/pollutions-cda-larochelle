import { site } from "../lib/site";
import { sites, communes } from "../lib/donnees";

export default function sitemap() {
  const maintenant = new Date();
  const pages = ["", "/fiches", "/eau-du-robinet", "/mentions-legales", "/signaux-sanitaires", "/restrictions"];
  return [
    ...pages.map((p) => ({ url: `${site.url}${p}`, lastModified: maintenant })),
    ...communes().map((c) => ({ url: `${site.url}/communes/${c.slug}`, lastModified: maintenant })),
    ...sites().map((s) => ({ url: `${site.url}/sites/${s.id}`, lastModified: new Date(s.derniere_verification) })),
  ];
}
