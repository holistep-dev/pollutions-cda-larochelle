import { libelles, dateLisible } from "../lib/donnees";

export default function Source({ source }) {
  if (!source) return null;
  const type = libelles().type_source[source.type];
  return (
    <li className="source" id={`source-${source.id}`}>
      <span className="type">{type}</span>
      <span>
        {source.auteur}, {source.url ? <a href={source.url}>{source.titre}</a> : <i>{source.titre}</i>},{" "}
        {dateLisible(source.date)}
        {source.reference ? `. ${source.reference}` : ""}
        {source.page ? `, p. ${source.page}` : ""}
        {source.acces === "payant" ? ". Accès payant" : ""}
        {source.acces === "non_publie" ? ". Document non publié" : ""}
        {source.licence ? `. ${source.licence}` : ""}.
      </span>
    </li>
  );
}
