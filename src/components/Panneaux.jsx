"use client";

import { useState } from "react";
import { COULEURS, urlIcone } from "../lib/icones";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export function dateLisible(d) {
  if (!d) return "";
  const s = String(d);
  if (/^[0-9]{3}X$/.test(s)) return `années ${s.slice(0, 3)}0`;
  const [a, m, j] = s.split("-");
  if (j) return `${Number(j)} ${MOIS[Number(m) - 1]} ${a}`;
  if (m) return `${MOIS[Number(m) - 1]} ${a}`;
  return a;
}
const dateCourte = (d) => (d ? d.split("-").reverse().join("/") : "");
export function periodeLisible(p) {
  if (!p) return "";
  const debut = p.debut ? dateLisible(p.debut) : null;
  if (p.fin_statut === "en_cours") return debut ? `depuis ${debut}, en cours` : "début inconnu, en cours";
  const fin = p.fin ? dateLisible(p.fin) : null;
  if (debut && fin) return debut === fin ? debut : `de ${debut} à ${fin}`;
  if (fin) return `début inconnu, jusqu'en ${fin}`;
  if (debut) return `depuis ${debut}, fin inconnue`;
  return "dates inconnues";
}
export const nb = (v) => (v == null ? "" : Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 3 }));

export const ETATS_EAU = {
  rouge: { libelle: "Au-dessus d'une limite légale", def: "Au moins un résultat au-delà d'une limite de qualité réglementaire sur les douze derniers mois, sur un réseau qui dessert la commune." },
  orange: { libelle: "Polluée sous les limites légales", def: "Aucun dépassement, mais au moins une substance de synthèse quantifiée sous sa limite : pesticide ou métabolite, PFAS, chlorure de vinyle, solvant chloré." },
  vert: { libelle: "Aucune pollution détectée", def: "Ni dépassement, ni substance de synthèse quantifiée, alors que des pesticides ont été recherchés sur la période." },
  non_analyse: { libelle: "Non recherché", def: "Aucune recherche de pesticide ou de substance de synthèse sur la période. On ne sait pas." },
};
export const ETATS_PLAGE = {
  vert: { libelle: "Bonne qualité", def: "Classement 2025 excellent ou bon." },
  orange: { libelle: "Qualité suffisante", def: "Classement 2025 suffisant : la limite basse de la directive européenne." },
  rouge: { libelle: "Qualité insuffisante ou baignade interdite", def: "Classement 2025 insuffisant, ou baignade interdite par le maire après plusieurs saisons insuffisantes." },
};

export function Definition({ titre, children }) {
  return (
    <span className="def" role="tooltip">
      {titre ? <b>{titre}</b> : null}
      {children}
    </span>
  );
}

function Pastille({ couleur, children }) {
  return (
    <span className="pastille-etat" style={{ background: couleur }}>
      {children}
    </span>
  );
}

function Statut({ nom, valeur, libelles }) {
  const l = libelles?.[valeur];
  if (!l) return null;
  return (
    <div className={`statut ${valeur}`} tabIndex={0}>
      <dt>{nom}</dt>
      <dd>{l.libelle}</dd>
      <Definition>{l.definition}</Definition>
    </div>
  );
}

function Fermer({ fermer }) {
  return (
    <button type="button" className="fermer" onClick={fermer} aria-label="Fermer">
      ×
    </button>
  );
}

function Substances({ liste, libelles }) {
  if (!liste?.length) return null;
  const chiffrees = liste.filter((s) => s.valeur != null);
  const citees = liste.filter((s) => s.valeur == null);
  const circ = [...new Map(liste.filter((s) => s.comparaison?.circ).map((s) => [s.comparaison.cle, s.comparaison])).values()];
  const aucunes = [...new Set(liste.flatMap((s) => (s.comparaison?.reperes ?? []).filter((r) => r.nature === "aucune").map((r) => r.libelle)))];
  const utiles = (s) => (s.comparaison?.reperes ?? []).filter((r) => r.nature !== "aucune");
  return (
    <section className="pan-bloc">
      <h3>Ce qui est mesuré</h3>
      {chiffrees.map((s, i) => (
        <div className="teneur" key={i}>
          <p className="teneur-nom">{s.libelle}</p>
          <p className="teneur-val">
            <b>
              {nb(s.valeur)} {s.unite}
            </b>
            {s.date ? <span>, {dateLisible(s.date)}</span> : null}
            {s.milieu ? <span className="milieu"> · {s.milieu.replace("_", " ")}</span> : null}
          </p>
          {utiles(s).length ? (
            <ul className="reperes">
              {utiles(s).map((r, j) => (
                <li key={j} className={r.rapport > 1.05 ? "au-dessus" : ""}>
                  <span className={`nature ${r.nature}`} tabIndex={0}>
                    {libelles?.natures_reference?.[r.nature] ? <Definition>{libelles.natures_reference[r.nature]}</Definition> : null}
                    {{ fond_geochimique: "fond", valeur_de_gestion: "gestion", limite_de_qualite: "qualité", seuil_sanitaire: "sanitaire" }[r.nature]}
                  </span>
                  <span>
                    {r.libelle}
                    {r.valeur != null ? ` : ${nb(r.valeur)} ${r.unite}` : r.max != null ? ` : ${nb(r.min)} à ${nb(r.max)} ${r.unite}` : ""}
                    {r.texte ? <b>. Mesure : {r.texte}.</b> : "."}
                    {r.note ? <em> {r.note}</em> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : aucunes.length ? null : (
            <p className="note">Aucune valeur de comparaison retenue pour ce milieu.</p>
          )}
        </div>
      ))}
      {aucunes.map((a) => (
        <p key={a} className="note aucune-ref">
          {a}.
        </p>
      ))}
      {citees.length ? (
        <p className="teneur-citees">
          <span>Cité sans valeur publiée : </span>
          {citees.map((s) => s.libelle).join(" ; ")}.
        </p>
      ) : null}
      {circ.length ? (
        <div className="circ">
          <p>
            <b>Classement du CIRC</b>, qui décrit un danger et pas un risque : il ne dit rien du niveau d&apos;exposition.
          </p>
          <ul>
            {circ.map((c) => (
              <li key={c.cle}>
                {c.cle} : groupe {c.circ.groupe}, {libelles?.circ_groupes?.[c.circ.groupe]}
                {c.circ.precision ? ` (${c.circ.precision})` : ""}.
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function PanneauSite({ p, d, libelles, fermer, icone }) {
  const plage = p.type === "baignade" ? ETATS_PLAGE[p.baignade_couleur] : null;
  return (
    <article className="pan-fiche">
      <Fermer fermer={fermer} />
      <p className="pan-cat">
        {icone ? <img src={icone} alt="" width="26" height="26" /> : null}
        {p.categorie_libelle} · {p.commune}
      </p>
      <h2>{p.nom}</h2>
      {plage ? (
        <p className="pan-etat">
          <Pastille couleur={COULEURS[p.baignade_couleur]}>{plage.libelle}</Pastille>
          <span>
            {p.baignade_etat === "hors_controle_sanitaire" ? "Baignade interdite, site sorti du contrôle sanitaire." : `Classement 2025 : ${p.baignade_dernier}.`}
          </span>
        </p>
      ) : null}
      <dl className="pan-statuts">
        <Statut nom="Preuve" valeur={p.preuve} libelles={libelles?.statut_preuve} />
        <Statut nom="Traitement" valeur={p.traitement} libelles={libelles?.statut_traitement} />
      </dl>
      {d?.procedure_en_cours && p.preuve !== "procedure_en_cours" ? <p className="note">Une procédure administrative est en cours.</p> : null}
      {d?.periode ? <p className="pan-periode">Période : {periodeLisible(d.periode)}</p> : null}
      {d?.resume ? <p className="pan-resume">{d.resume}</p> : null}
      <Substances liste={d?.substances} libelles={libelles} />
      <section className="pan-bloc">
        <h3>Sources</h3>
        <ul className="pan-sources">
          {d?.sources?.map((s, i) => (
            <li key={i}>
              {s.url ? (
                <a href={s.url} rel="noopener noreferrer" target="_blank">
                  {s.titre}
                </a>
              ) : (
                s.titre
              )}
              <span>
                {s.auteur}, {dateLisible(s.date)}
              </span>
            </li>
          ))}
        </ul>
        {d?.nb_sources > (d?.sources?.length ?? 0) ? <p className="note">{d.nb_sources - d.sources.length} autre(s) dans la fiche.</p> : null}
      </section>
      <p className="pan-trace">
        Tracé : {libelles?.precision_geo?.[p.precision_geo]?.libelle?.toLowerCase()}.{d?.origine_trace ? ` ${d.origine_trace}` : ""}
      </p>
      <a className="pan-lien" href={`/sites/${encodeURIComponent(p.id)}`}>
        Lire la fiche complète
      </a>
    </article>
  );
}

export function BlocRobinet({ code, robinets, eauHisto }) {
  const c = robinets?.communes?.[code];
  const [tout, setTout] = useState(false);
  if (!c) return null;
  const e = ETATS_EAU[c.etat];
  const reseaux = c.reseaux.map((k) => robinets.reseaux[k]).filter(Boolean);
  const deps = reseaux.flatMap((r) => r.depassements.map((d) => ({ ...d, reseau: r.nom })));
  const subs = reseaux.flatMap((r) => r.substances_quantifiees.map((s) => ({ ...s, reseau: r.nom })));
  return (
    <section className="pan-bloc">
      <h3>Eau du robinet, douze derniers mois</h3>
      <p className="pan-etat">
        <Pastille couleur={COULEURS[c.etat] ?? COULEURS.gris}>{e.libelle}</Pastille>
      </p>
      <p className="note">
        {e.def} Période du {dateCourte(robinets.debut)} au {dateCourte(robinets.fin)}.
      </p>
      <ul className="pan-liste">
        {reseaux.map((r) => (
          <li key={r.code}>
            <span className="pastille-couleur rond" style={{ background: COULEURS[r.etat] ?? COULEURS.gris }} />
            {r.nom} <span className="note">{r.nb_prelevements} prélèvements</span>
          </li>
        ))}
      </ul>
      {deps.length ? (
        <>
          <h4>Au-delà d&apos;une limite de qualité</h4>
          <table className="pan-table">
            <tbody>
              {deps.map((x, i) => (
                <tr key={i}>
                  <td>{dateCourte(x.date)}</td>
                  <td>{x.parametre}</td>
                  <td>
                    {nb(x.valeur)} {x.unite}
                  </td>
                  <td>limite {x.limite?.replace("<=", "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {deps.some((x) => /fos[eé]tyl/i.test(x.parametre)) ? (
            <p className="note">
              Un arrêté préfectoral du 26 mars 2026 accorde une dérogation aux limites de qualité pour le fosétyl sur neuf unités de distribution
              desservies par l&apos;usine de Coulonge. La liste de ces unités n&apos;est pas encore vérifiée sur ce site.
            </p>
          ) : null}
        </>
      ) : null}
      {subs.length ? (
        <>
          <h4>Substances de synthèse quantifiées</h4>
          <table className="pan-table">
            <tbody>
              {subs.slice(0, tout ? subs.length : 6).map((x, i) => (
                <tr key={i}>
                  <td>{x.parametre}</td>
                  <td>
                    max. {nb(x.max)} {x.unite}
                  </td>
                  <td>{x.limite ? `limite ${x.limite.replace("<=", "")}` : "pas de limite"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {subs.length > 6 ? (
            <button type="button" className="lien-bouton" onClick={() => setTout(!tout)}>
              {tout ? "Réduire" : `Afficher les ${subs.length} substances`}
            </button>
          ) : null}
        </>
      ) : null}
      {eauHisto ? (
        <p className="note">
          Depuis 2016 : {eauHisto.nb_depassements} résultat{eauHisto.nb_depassements > 1 ? "s" : ""} au-delà d&apos;une limite de qualité rattaché
          {eauHisto.nb_depassements > 1 ? "s" : ""} à la commune.
        </p>
      ) : null}
      <p className="note">
        Une limite de qualité est une norme de gestion, pas un seuil de danger. Pour les pesticides, elle vaut 0,1 µg/L par molécule quelle que soit
        sa toxicité. Les métabolites dits non pertinents, comme le R471811 du chlorothalonil, n&apos;ont plus de limite réglementaire.
      </p>
      <a href={`/eau-du-robinet#${code}`}>Historique depuis 2016</a>
    </section>
  );
}

export function PanneauRobinet({ commune, robinets, eau, fermer }) {
  return (
    <article className="pan-fiche">
      <Fermer fermer={fermer} />
      <p className="pan-cat">
        <img src={urlIcone({ glyphe: "robinet", fond: COULEURS[robinets.communes[commune.code_insee]?.etat] ?? COULEURS.gris, carre: true })} alt="" width="26" height="26" />
        Eau du robinet
      </p>
      <h2>{commune.nom}</h2>
      <BlocRobinet code={commune.code_insee} robinets={robinets} eauHisto={eau?.communes?.[commune.code_insee]} />
    </article>
  );
}

export function PanneauCaptage({ p, fermer }) {
  return (
    <article className="pan-fiche">
      <Fermer fermer={fermer} />
      <p className="pan-cat">
        <img src={urlIcone({ glyphe: "captage", fond: COULEURS.eau })} alt="" width="26" height="26" />
        Captage d&apos;eau potable · {p.commune}
      </p>
      <h2>{p.nom}</h2>
      <p>
        Ouvrage de prélèvement en nappe déclaré pour l&apos;alimentation en eau potable.{" "}
        {p.derniere_annee ? `Dernier volume déclaré : ${nb(p.volume)} m³ en ${p.derniere_annee}.` : "Aucun volume déclaré récemment."}
      </p>
      <p className="note">
        Position et volumes publiés par la Banque nationale des prélèvements en eau. Les volumes y sont publiés avec un ou deux ans de décalage. Une
        partie de l&apos;eau distribuée dans l&apos;agglomération vient d&apos;usines situées hors de son territoire, à Coulonge sur la Charente et
        à Saint-Hippolyte. Le captage n&apos;est pas lié aux parcelles voisines : sa nappe peut être alimentée sur une zone plus large.
      </p>
      {p.uri ? (
        <a href={p.uri} rel="noopener noreferrer" target="_blank">
          Fiche de l&apos;ouvrage
        </a>
      ) : null}
    </article>
  );
}

export function PanneauSignal({ s, bandeau, fermer }) {
  return (
    <article className="pan-fiche">
      <Fermer fermer={fermer} />
      <p className="pan-cat">Signal sanitaire{s.niveau_source === "presse" ? ", chiffre rapporté par la presse" : ""}</p>
      <h2>{s.libelle}</h2>
      <p className="bandeau">{bandeau}</p>
      {s.zone ? <p className="note">{s.zone}</p> : null}
      <p>{s.resultat}</p>
      <a className="pan-lien" href={`/signaux-sanitaires#${s.id}`}>
        Lire l&apos;étude et les enquêtes en cours
      </a>
    </article>
  );
}

export function PanneauAgri({ p, agri, achats, codePostal, fermer }) {
  const derniere = achats ? Object.keys(achats.annees).sort().pop() : null;
  const a = derniere ? achats.annees[derniere] : null;
  const bio = p.couche === "bio";
  return (
    <article className="pan-fiche">
      <Fermer fermer={fermer} />
      <p className="pan-cat">
        <span className="pastille-couleur" style={{ background: bio ? COULEURS.bio : p.famille === "prairies" ? COULEURS.prairie : p.famille === "gel" ? COULEURS.gel : COULEURS.conventionnel }} />
        Pesticides agricoles
      </p>
      <h2>
        {p.libelle}, {bio ? "agriculture biologique" : "conventionnel"}
      </h2>
      <p>
        {bio
          ? "Parcelle déclarée en agriculture biologique : les pesticides de synthèse y sont interdits. Certains produits d'origine naturelle ou minérale, comme le cuivre ou le soufre, restent autorisés."
          : "Parcelle déclarée à la PAC hors agriculture biologique : l'usage de pesticides de synthèse y est autorisé. La carte ne dit pas ce qui y a été épandu, ni quand."}
      </p>
      <p className="note">
        {nb(p.surface_ha)} ha de ce groupe {bio ? "en bio" : "en conventionnel"} sur les 28 communes en 2023.
        {agri ? ` En tout, ${nb(agri.surface_bio_ha)} ha en bio sur ${nb(agri.surface_declaree_ha)} ha déclarés, soit ${nb(Math.round((agri.surface_bio_ha / agri.surface_declaree_ha) * 1000) / 10)} %.` : ""}
      </p>
      {a ? (
        <section className="pan-bloc">
          <h3>Pesticides achetés en {derniere}</h3>
          <p>
            Les acheteurs domiciliés dans les codes postaux de l&apos;agglomération ont déclaré {nb(Math.round(a.total_kg / 100) / 10)} tonnes de
            substances actives.
            {codePostal && a.par_code_postal_kg[codePostal] != null
              ? ` Pour le code postal ${codePostal} (${achats.codes_postaux[codePostal]}) : ${nb(Math.round(a.par_code_postal_kg[codePostal] / 100) / 10)} tonnes.`
              : ""}
          </p>
          <table className="pan-table">
            <tbody>
              {a.substances.slice(0, 8).map((s) => (
                <tr key={s.substance}>
                  <td>{s.substance}</td>
                  <td>{s.fonction.toLowerCase()}</td>
                  <td>{nb(Math.round(s.kg / 100) / 10)} t</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">
            Source : OFB, BNV-D. Le code postal est celui de l&apos;acheteur, pas celui de la parcelle traitée. Thairé et Vérines partagent leur code
            postal avec des communes hors agglomération et ne sont pas comptés. Les achats peuvent inclure des usages professionnels non agricoles, comme le
            stockage des grains.
          </p>
        </section>
      ) : null}
    </article>
  );
}

export function PanneauCommune({ c, donnees, actifs, fermer }) {
  const fiches = (donnees?.reperes?.features ?? []).map((f) => f.properties).filter((p) => p.commune === c.nom);
  const signaux = (donnees?.signaux_liste ?? []).filter((s) => s.communes.includes(c.code_insee));
  return (
    <article className="pan-fiche">
      <Fermer fermer={fermer} />
      <p className="pan-cat">Commune</p>
      <h2>{c.nom}</h2>
      {donnees?.robinets ? <BlocRobinet code={c.code_insee} robinets={donnees.robinets} eauHisto={donnees?.eau?.communes?.[c.code_insee]} /> : null}
      <section className="pan-bloc">
        <h3>Fiches</h3>
        {fiches.length ? (
          <ul className="pan-liste">
            {fiches.map((f) => (
              <li key={f.id}>
                <img src={f.iconeUrl} alt="" width="20" height="20" />
                <a href={`/sites/${f.id}`}>{f.nom}</a>
              </li>
            ))}
          </ul>
        ) : (
          <p>Aucune fiche localisée sur cette commune.</p>
        )}
        {c.nb_sans_localisation ? <p className="note">Connu sans localisation : {c.sans_localisation}.</p> : null}
      </section>
      {signaux.length && actifs.signaux ? (
        <section className="pan-bloc">
          <h3>Signaux sanitaires</h3>
          <ul className="pan-liste">
            {signaux.map((s) => (
              <li key={s.id}>
                <a href={`/signaux-sanitaires#${s.id}`}>{s.libelle}</a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <a className="pan-lien" href={`/communes/${c.slug}`}>
        Page de la commune
      </a>
    </article>
  );
}
