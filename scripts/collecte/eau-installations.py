#!/usr/bin/env python3
"""Installation de production en amont de chaque réseau de distribution, et lien vers un captage de la BNPE.

Hub'Eau publie pour chaque résultat le code et le nom de l'installation amont (unité de production ou stockage).
Le lien vers un captage n'est fait que si le nom de l'installation contient le nom de l'ouvrage BNPE.
Les installations sans captage identifié restent sans position : leurs coordonnées ne sont pas publiées.

Usage : python3 scripts/collecte/eau-installations.py  -> data/collecte/eau-installations.json
"""
import json, re, time, urllib.request, collections
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
etat = json.load(open(ROOT / "data/collecte/eau-robinet-etat.json"))
captages = json.load(open(ROOT / "data/collecte/captages.json"))["ouvrages"]
racine = lambda nom: re.split(r"[-_ ]", nom.upper().replace("LA ", ""))[0]
sortie = {"source": "Hub'Eau qualite_eau_potable, champ installation amont", "debut": etat["debut"], "reseaux": {}}
for code, n in etat["reseaux"].items():
    url = (f"https://hubeau.eaufrance.fr/api/v1/qualite_eau_potable/resultats_dis?code_reseau={code}&size=5000"
           f"&date_min_prelevement={etat['debut']}&fields=code_installation_amont,nom_installation_amont")
    for essai in range(5):
        try:
            rows = json.load(urllib.request.urlopen(url, timeout=120))["data"]
            break
        except Exception:
            time.sleep(4 * (essai + 1))
    c = collections.Counter((r["code_installation_amont"], r["nom_installation_amont"]) for r in rows if r["code_installation_amont"])
    inst = [{"code": k[0], "nom": k[1]} for k, _ in c.most_common()]
    for i in inst:
        i["captages"] = [o["code_ouvrage"] for o in captages if racine(o["nom"]) in i["nom"].upper()]
    sortie["reseaux"][code] = {"nom": n["nom"], "installations": inst}
    print(n["nom"], inst)
json.dump(sortie, open(ROOT / "data/collecte/eau-installations.json", "w"), ensure_ascii=False, indent=1)
