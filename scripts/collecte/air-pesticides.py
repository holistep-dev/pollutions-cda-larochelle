#!/usr/bin/env python3
"""Synthèse des mesures de pesticides dans l'air sur les communes de la CDA.

Source : Atmo France et Atmo Nouvelle-Aquitaine, « Données de mesure des pesticides dans l'air
Nouvelle-Aquitaine », fichier DataPesticides_AtmoNA_2001-2024 publié sur data.gouv.fr.

Usage : python3 scripts/collecte/air-pesticides.py chemin/DataPesticides.xlsx
Sortie : data/collecte/air-pesticides.json
"""
import json, sys, collections, math
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parents[2]
codes = {c["code_insee"] for c in json.load(open(ROOT / "data/communes.json"))["communes"]}


def lambert93_vers_wgs84(x, y):
    """Lambert 93 (EPSG:2154) vers longitude, latitude. Formules IGN, précision métrique."""
    n, c, xs, ys = 0.7256077650532670, 11754255.426096, 700000, 12655612.049876
    e = 0.0818191910428158
    lon0 = math.radians(3)
    dx, dy = x - xs, y - ys
    r = math.hypot(dx, dy)
    gamma = math.atan(dx / -dy)
    lon = lon0 + gamma / n
    lat_iso = -1 / n * math.log(abs(r / c))
    phi = 2 * math.atan(math.exp(lat_iso)) - math.pi / 2
    for _ in range(10):
        phi = 2 * math.atan(((1 + e * math.sin(phi)) / (1 - e * math.sin(phi))) ** (e / 2) * math.exp(lat_iso)) - math.pi / 2
    return round(math.degrees(lon), 5), round(math.degrees(phi), 5)


wb = openpyxl.load_workbook(sys.argv[1], read_only=True)
ws = wb[[n for n in wb.sheetnames if n.startswith("pesticides")][0]]
rows = ws.iter_rows(values_only=True)
hdr = [str(h).strip() for h in next(rows)]
I = {h: i for i, h in enumerate(hdr)}

stations = {}
for r in rows:
    if str(r[I["Code INSEE"]]) not in codes:
        continue
    cle = (r[I["Commune"]], r[I["xlamb93"]], r[I["ylamb93"]])
    st = stations.setdefault(cle, {"prelevements": set(), "annees": collections.defaultdict(set), "substances": {}})
    debut = str(r[I["Debut prelevement"]])[:10]
    annee = int(r[I["Annee"]])
    st["prelevements"].add(debut)
    st["annees"][annee].add(debut)
    nom = r[I["Substance active"]]
    s = st["substances"].setdefault(nom, {"analyses": 0, "quantifiees": 0, "valeurs": [], "annees": set()})
    s["analyses"] += 1
    conc = r[I["Concentration (ng/m3)"]]
    if not r[I["Detection/quantification"]] and conc is not None:
        s["quantifiees"] += 1
        s["valeurs"].append((float(conc), debut))
        s["annees"].add(annee)

sortie = {"source": "Atmo France et Atmo Nouvelle-Aquitaine, DataPesticides_AtmoNA_2001-2024, version du 4 décembre 2025",
          "unite": "ng/m3", "stations": []}
for (commune, x, y), st in sorted(stations.items(), key=lambda kv: (kv[0][0], kv[0][1])):
    subs = []
    for nom, s in st["substances"].items():
        if not s["quantifiees"]:
            continue
        vmax, dmax = max(s["valeurs"])
        subs.append({"substance": nom, "analyses": s["analyses"], "quantifiees": s["quantifiees"],
                     "max": round(vmax, 3), "date_max": dmax,
                     "moyenne_quantifiees": round(sum(v for v, _ in s["valeurs"]) / s["quantifiees"], 3),
                     "annees": sorted(s["annees"])})
    subs.sort(key=lambda d: (-d["quantifiees"], -d["max"]))
    lon, lat = lambert93_vers_wgs84(x, y)
    sortie["stations"].append({
        "commune": commune, "lambert93": [x, y], "coordonnees": [lon, lat],
        "annees": {a: len(v) for a, v in sorted(st["annees"].items())},
        "nb_prelevements": len(st["prelevements"]),
        "nb_substances_recherchees": len(st["substances"]),
        "nb_substances_quantifiees": len(subs),
        "substances_quantifiees": subs,
    })
    print(commune, x, y, lon, lat, len(st["prelevements"]), "prélèvements,", len(subs), "substances quantifiées")

json.dump(sortie, open(ROOT / "data/collecte/air-pesticides.json", "w"), ensure_ascii=False, indent=1)
