#!/usr/bin/env python3
"""Ouvrages de prélèvement d'eau destinée à l'eau potable sur les 28 communes.

Source : Banque nationale des prélèvements quantitatifs en eau (BNPE), via l'API Hub'Eau prelevements.
Un ouvrage est retenu s'il a déclaré au moins une année un volume à l'usage AEP (alimentation en eau potable).
Les coordonnées sont celles que publie la BNPE.

Usage : python3 scripts/collecte/captages.py  -> data/collecte/captages.json
"""
import json, time, urllib.request, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
API = "https://hubeau.eaufrance.fr/api/v1/prelevements/chroniques"


def get(**p):
    url = API + "?" + urllib.parse.urlencode(p)
    for essai in range(5):
        try:
            return json.load(urllib.request.urlopen(url, timeout=90))
        except Exception:
            time.sleep(3 * (essai + 1))
    raise RuntimeError(url)


communes = json.load(open(ROOT / "data/communes.json"))["communes"]
ouvrages = {}
for c in communes:
    page = 1
    while True:
        d = get(code_commune_insee=c["code_insee"], code_usage="AEP", size=1000, page=page)
        for x in d["data"]:
            o = ouvrages.setdefault(x["code_ouvrage"], {
                "code_ouvrage": x["code_ouvrage"], "nom": x["nom_ouvrage"], "commune": x["nom_commune"],
                "code_insee": x["code_commune_insee"], "coordonnees": [round(x["longitude"], 6), round(x["latitude"], 6)],
                "uri": x["uri_ouvrage"], "volumes": {}})
            o["volumes"][x["annee"]] = x["volume"]
        if not d.get("next"):
            break
        page += 1

liste = []
for o in sorted(ouvrages.values(), key=lambda o: (o["commune"], o["nom"])):
    annees = sorted(o["volumes"])
    actives = [a for a in annees if (o["volumes"][a] or 0) > 0]
    o["premiere_annee"], o["derniere_annee"] = annees[0], annees[-1]
    o["derniere_annee_volume"] = actives[-1] if actives else None
    o["dernier_volume_m3"] = round(o["volumes"][actives[-1]]) if actives else 0
    del o["volumes"]
    liste.append(o)
    print(o["commune"], o["nom"], o["derniere_annee_volume"], o["dernier_volume_m3"])

json.dump({"source": "BNPE via Hub'Eau prelevements, usage AEP", "collecte_le": time.strftime("%Y-%m-%d"), "ouvrages": liste},
          open(ROOT / "data/collecte/captages.json", "w"), ensure_ascii=False, indent=1)
