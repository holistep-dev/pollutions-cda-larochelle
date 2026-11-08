import { site } from "../lib/site";

export default function sitemap() {
  const maintenant = new Date();
  return [
    { url: site.url, lastModified: maintenant },
    { url: `${site.url}/mentions-legales`, lastModified: maintenant },
  ];
}
