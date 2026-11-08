import { libelles } from "../lib/donnees";

// Les trois statuts obligatoires, toujours affichés ensemble et avec leur définition.
export default function Statuts({ site }) {
  const L = libelles();
  const preuve = L.statut_preuve[site.statut_preuve];
  const traitement = L.statut_traitement[site.statut_traitement];
  const precision = L.precision_geo[site.precision_geo ?? "null"];
  return (
    <dl className="statuts">
      <div>
        <dt>Niveau de preuve</dt>
        <dd>
          <b>{preuve.libelle}</b>
          <span>{preuve.definition}</span>
          {site.procedure_en_cours && site.statut_preuve !== "procedure_en_cours" ? (
            <span className="pastille">{L.procedure_en_cours.libelle}</span>
          ) : null}
        </dd>
      </div>
      <div>
        <dt>Traitement</dt>
        <dd>
          <b>{traitement.libelle}</b>
          <span>{traitement.definition}</span>
        </dd>
      </div>
      <div>
        <dt>Localisation</dt>
        <dd>
          <b>{precision.libelle}</b>
          <span>{precision.definition}</span>
        </dd>
      </div>
    </dl>
  );
}
