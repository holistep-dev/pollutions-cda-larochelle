#!/usr/bin/env python3
"""État de l'eau du robinet par commune sur les douze derniers mois, pour l'icône de la carte.

Règle, appliquée à tous les résultats du contrôle sanitaire publiés par Hub'Eau sur la période :
  rouge  : au moins un résultat au-delà d'une limite de qualité réglementaire ;
  orange : aucun dépassement, mais au moins une substance de synthèse quantifiée sous sa limite
           (pesticide ou métabolite de pesticide, PFAS, chlorure de vinyle, solvant chloré) ;
  vert   : ni dépassement, ni substance de synthèse quantifiée, alors que des pesticides ont été recherchés ;
  gris   : aucune recherche de substance de synthèse sur la période, on ne sait pas.
L'état est calculé par réseau de distribution (UDI), puis chaque commune prend l'état le plus défavorable des réseaux
qui la desservent. Le rattachement d'un prélèvement à une seule commune n'introduit donc pas de faux vert.
Les sous-produits de la chloration, les métaux et les nitrates ne déclenchent pas l'orange : ils sont listés à part.

Usage : python3 scripts/collecte/eau-robinet-etat.py  -> data/collecte/eau-robinet-etat.json
"""
import datetime, json, re, sys, time, urllib.request, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
API = "https://hubeau.eaufrance.fr/api/v1/qualite_eau_potable/resultats_dis"
FIN = datetime.date.today()
DEBUT = FIN - datetime.timedelta(days=365)
CHAMPS = ("code_prelevement,date_prelevement,libelle_parametre,code_parametre,resultat_numerique,"
          "resultat_alphanumerique,libelle_unite,limite_qualite_parametre,reference_qualite_parametre,reseaux")

SYNTHESE = re.compile(
    r"R471811|chlorothalonil|\bESA\b|\bOXA\b|\bCGA\b|\bNOA\b|desph[ée]nyl|d[ée]s[ée]thyl|d[ée]sisopropyl|AMPA|glyphosate|"
    r"atrazine|simazine|terbuthylazine|m[ée]tolachlor|alachlor|bentazone|fos[ée]tyl|perfluoro|PFAS|\bPF[A-Z]{2,4}\b|"
    r"chlorure de vinyl|trichloro[ée]thyl|t[ée]trachloro[ée]thyl|dichloro[ée]thane|pesticides",
    re.I)
SOUS_PRODUITS = re.compile(r"trihalom|bromoforme|chloroforme|chlorodibromo|dichloromonobromo|haloac[ée]tique|bromates?|chlorates?|chlorites?", re.I)


def get(**p):
    url = API + "?" + urllib.parse.urlencode(p)
    for essai in range(6):
        try:
            return json.load(urllib.request.urlopen(url, timeout=120))
        except Exception:
            time.sleep(4 * (essai + 1))
    raise RuntimeError(url)


def lire_json(url):
    for essai in range(6):
        try:
            return json.load(urllib.request.urlopen(url, timeout=120))
        except Exception:
            time.sleep(4 * (essai + 1))
    raise RuntimeError(url)


def limite(texte):
    m = re.search(r"<=\s*([\d.,]+)", texte or "")
    return float(m.group(1).replace(",", ".")) if m else None


communes = json.load(open(ROOT / "data/communes.json"))["communes"]
UDI = "https://hubeau.eaufrance.fr/api/v1/qualite_eau_potable/communes_udi"

# 1. Résultats de toutes les communes, regroupés par réseau (UDI). Un même prélèvement peut apparaître
#    sous plusieurs communes : on dédoublonne par prélèvement et paramètre.
CACHE = Path("/tmp") / f"eau-robinet-{FIN.isoformat()}.json"
vus, reseaux, vus_par_commune = set(), {}, {}
if CACHE.exists():
    cache = json.load(open(CACHE))
    reseaux = cache["reseaux"]
    for n in reseaux.values():
        n["prelevements"] = set(n["prelevements"])
    vus_par_commune = {k: set(v) for k, v in cache["vus_par_commune"].items()}
for c in ([] if CACHE.exists() else communes):
    vus_par_commune[c["code_insee"]] = set()
    page = 1
    while True:
        d = get(code_commune=c["code_insee"], date_min_prelevement=DEBUT.isoformat(), size=5000, page=page, fields=CHAMPS)
        for r in d["data"]:
            for res in r.get("reseaux") or []:
                vus_par_commune[c["code_insee"]].add(res["code"])
            k = (r["code_prelevement"], r["code_parametre"])
            if k in vus:
                continue
            vus.add(k)
            for res in r.get("reseaux") or []:
                n = reseaux.setdefault(res["code"], {"code": res["code"], "nom": res["nom"], "prelevements": set(),
                                                     "analyses_synthese": 0, "depassements": [], "synthese": {}})
                n["prelevements"].add(r["code_prelevement"])
                lib = r["libelle_parametre"] or ""
                v = r.get("resultat_numerique")
                lim = limite(r.get("limite_qualite_parametre"))
                synth = bool(SYNTHESE.search(lib)) and not SOUS_PRODUITS.search(lib)
                if synth:
                    n["analyses_synthese"] += 1
                if v is not None and lim is not None and v > lim:
                    n["depassements"].append({"date": r["date_prelevement"][:10], "parametre": lib, "valeur": v,
                                              "unite": r.get("libelle_unite"), "limite": r["limite_qualite_parametre"]})
                elif synth and v and v > 0:
                    sb = n["synthese"].setdefault(lib, {"parametre": lib, "nb": 0, "max": 0, "unite": r.get("libelle_unite"),
                                                        "limite": r.get("limite_qualite_parametre"), "date_max": None})
                    sb["nb"] += 1
                    if v > sb["max"]:
                        sb["max"], sb["date_max"] = v, r["date_prelevement"][:10]
        if not d.get("next"):
            break
        page += 1
    print(c["nom"], len(vus), file=sys.stderr)

if not CACHE.exists():
    json.dump({"reseaux": {k: {**n, "prelevements": sorted(n["prelevements"])} for k, n in reseaux.items()},
               "vus_par_commune": {k: sorted(v) for k, v in vus_par_commune.items()}}, open(CACHE, "w"))

ORDRE = {"rouge": 3, "orange": 2, "vert": 1, "non_analyse": 0}
for n in reseaux.values():
    n["etat"] = ("rouge" if n["depassements"] else "orange" if n["synthese"]
                 else "vert" if n["analyses_synthese"] else "non_analyse")
    n["nb_prelevements"] = len(n.pop("prelevements"))
    n["depassements"].sort(key=lambda x: x["date"])
    n["substances_quantifiees"] = sorted(n.pop("synthese").values(), key=lambda x: -x["nb"])

# 2. Réseaux desservant chaque commune l'année en cours (ou la précédente si l'année n'est pas publiée).
sortie = {"source": "Hub'Eau qualite_eau_potable (ARS, SISE-Eaux)", "debut": DEBUT.isoformat(), "fin": FIN.isoformat(),
          "regle": __doc__.split("Usage")[0].strip(), "reseaux": reseaux, "communes": {}}
for c in communes:
    udi = []
    for annee in (FIN.year, FIN.year - 1):
        udi = lire_json(f"{UDI}?code_commune={c['code_insee']}&annee={annee}&size=100")["data"]
        if udi:
            break
    # Réseaux déclarés pour la commune, plus ceux qui apparaissent dans ses résultats de la période.
    codes = sorted({u["code_reseau"] for u in udi} | vus_par_commune[c["code_insee"]])
    etats = [reseaux[k]["etat"] for k in codes if k in reseaux]
    etat = max(etats, key=lambda e: ORDRE[e]) if etats else "non_analyse"
    sortie["communes"][c["code_insee"]] = {"etat": etat, "reseaux": codes,
                                           "noms_reseaux": [reseaux[k]["nom"] if k in reseaux else next((u["nom_reseau"] for u in udi if u["code_reseau"] == k), k) for k in codes]}
    print(c["nom"], etat, [(reseaux[k]["nom"], reseaux[k]["etat"]) if k in reseaux else (k, "sans résultat") for k in codes], file=sys.stderr)

json.dump(sortie, open(ROOT / "data/collecte/eau-robinet-etat.json", "w"), ensure_ascii=False, indent=1)
