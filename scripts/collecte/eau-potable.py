#!/usr/bin/env python3
"""Collecte du contrôle sanitaire de l'eau du robinet, API Hub'Eau qualite_eau_potable.

Pour chacune des 28 communes : réseaux (UDI) desservant la commune, nombre de prélèvements depuis 2016,
et tous les résultats d'analyse dépassant une limite de qualité. Les dépassements de référence de qualité
(indicateurs de fonctionnement, sans valeur sanitaire) sont comptés à part.

Sortie : data/collecte/eau-potable.json. Usage : python3 scripts/collecte/eau-potable.py
"""
import json, re, sys, time, urllib.request, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
API = "https://hubeau.eaufrance.fr/api/v1/qualite_eau_potable"
DEBUT = "2016-01-01"


def get(path, **params):
    url = f"{API}/{path}?" + urllib.parse.urlencode(params)
    for essai in range(5):
        try:
            with urllib.request.urlopen(url, timeout=90) as r:
                return json.load(r)
        except Exception as e:  # réseau instable
            if essai == 4:
                raise
            time.sleep(3 * (essai + 1))


def tout(path, **params):
    page, out = 1, []
    while True:
        d = get(path, page=page, size=5000, **params)
        out += d["data"]
        if not d.get("next"):
            return out, d["count"]
        page += 1


def seuil(texte):
    """'<=50 mg/L' -> 50.0 ; renvoie None si non numérique."""
    if not texte:
        return None
    m = re.search(r"<=\s*([\d.,]+)", texte)
    return float(m.group(1).replace(",", ".")) if m else None


communes = json.load(open(ROOT / "data/communes.json"))["communes"]
sortie = {"source": "Hub'Eau qualite_eau_potable (ARS, SISE-Eaux)", "periode_debut": DEBUT,
          "collecte_le": time.strftime("%Y-%m-%d"), "communes": []}

for c in communes:
    code = c["code_insee"]
    udi, _ = tout("communes_udi", code_commune=code)
    reseaux = {}
    for u in udi:
        r = reseaux.setdefault(u["code_reseau"], {"code": u["code_reseau"], "nom": u["nom_reseau"], "annees": set()})
        r["annees"].add(int(u["annee"]))
    depassements, refs = [], {}
    prelevements = set()
    for champ in ("conformite_limites_pc_prelevement", "conformite_limites_bact_prelevement"):
        rows, _ = tout("resultats_dis", code_commune=code, date_min_prelevement=DEBUT, **{champ: "N"})
        for x in rows:
            lim = seuil(x.get("limite_qualite_parametre"))
            v = x.get("resultat_numerique")
            if lim is not None and v is not None and v > lim:
                depassements.append({
                    "date": x["date_prelevement"][:10],
                    "prelevement": x["code_prelevement"],
                    "parametre": x["libelle_parametre"],
                    "code_parametre": x["code_parametre"],
                    "cas": x.get("code_parametre_cas"),
                    "valeur": v,
                    "resultat": x.get("resultat_alphanumerique"),
                    "unite": x.get("libelle_unite"),
                    "limite_qualite": x.get("limite_qualite_parametre"),
                    "reseaux": [r["nom"] for r in (x.get("reseaux") or [])],
                    "conclusion": x.get("conclusion_conformite_prelevement"),
                })
    # dédoublonnage (un résultat peut sortir des deux requêtes)
    vu, uniq = set(), []
    for d in sorted(depassements, key=lambda d: (d["date"], d["parametre"])):
        k = (d["prelevement"], d["code_parametre"])
        if k not in vu:
            vu.add(k)
            uniq.append(d)
    # nombre de prélèvements : via le paramètre conductivité (1303) ou pH (1302)
    rows, _ = tout("resultats_dis", code_commune=code, date_min_prelevement=DEBUT, code_parametre="1302",
                   fields="code_prelevement,date_prelevement")
    nb_prel = len({r["code_prelevement"] for r in rows})
    der = max((r["date_prelevement"][:10] for r in rows), default=None)
    sortie["communes"].append({
        "code_insee": code, "nom": c["nom"],
        "reseaux": [{"code": r["code"], "nom": r["nom"], "annees": [min(r["annees"]), max(r["annees"])]}
                    for r in reseaux.values()],
        "nb_prelevements_ph": nb_prel, "dernier_prelevement": der,
        "depassements_limite": uniq,
    })
    print(code, c["nom"], len(reseaux), "réseaux", nb_prel, "prél.", len(uniq), "dépassements", file=sys.stderr)

(ROOT / "data/collecte").mkdir(exist_ok=True)
json.dump(sortie, open(ROOT / "data/collecte/eau-potable.json", "w"), ensure_ascii=False, indent=1)
