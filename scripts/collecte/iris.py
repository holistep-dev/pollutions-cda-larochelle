#!/usr/bin/env python3
"""Contours IRIS de La Rochelle (IGN, Contours IRIS, WFS data.geopf.fr).

Sert à tracer les zones d'étude du registre des cancers, définies comme des agrégats d'IRIS.
Usage : python3 scripts/collecte/iris.py  -> data/collecte/iris-la-rochelle.geojson
"""
import json, urllib.request
from pathlib import Path
from shapely.geometry import shape, mapping
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[2]
URL = ("https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&OUTPUTFORMAT=application/json"
       "&SRSNAME=EPSG:4326&TYPENAMES=STATISTICALUNITS.IRIS:contours_iris&CQL_FILTER=code_insee=%2717300%27&COUNT=200")
d = json.load(urllib.request.urlopen(URL, timeout=120))
feats = []
for f in d["features"]:
    g = transform(lambda x, y, z=None: (round(x, 6), round(y, 6)), shape(f["geometry"]).simplify(0.00003))
    p = f["properties"]
    feats.append({"type": "Feature", "geometry": mapping(g),
                  "properties": {"code_iris": p["code_iris"], "nom_iris": p["nom_iris"], "type_iris": p["type_iris"]}})
json.dump({"type": "FeatureCollection", "source": "IGN, Contours IRIS, WFS data.geopf.fr", "features": feats},
          open(ROOT / "data/collecte/iris-la-rochelle.geojson", "w"), ensure_ascii=False)
print(len(feats), "IRIS")

# Zones d'étude des signaux sanitaires définies par des noms d'IRIS : réunion des contours.
from shapely.ops import unary_union
signaux = json.load(open(ROOT / "data/signaux-sanitaires.json"))["signaux"]
par_nom = {f["properties"]["nom_iris"]: shape(f["geometry"]) for f in feats}
zones = []
for s in signaux:
    if s.get("iris"):
        manquants = [n for n in s["iris"] if n not in par_nom]
        if manquants:
            raise SystemExit(f"IRIS introuvables pour {s['id']} : {manquants}")
        g = unary_union([par_nom[n] for n in s["iris"]]).buffer(0)
        zones.append({"type": "Feature", "geometry": mapping(g), "properties": {"id": s["id"]}})
json.dump({"type": "FeatureCollection", "features": zones}, open(ROOT / "data/collecte/zones-signaux.geojson", "w"), ensure_ascii=False)
print(len(zones), "zones de signaux")
