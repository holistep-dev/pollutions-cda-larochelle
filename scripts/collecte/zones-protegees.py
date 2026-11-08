#!/usr/bin/env python3
"""Espaces naturels protégés sur les 28 communes (IGN et PatriNat, WFS data.geopf.fr).

Couche de contexte. Retenus : réserves naturelles nationales et régionales, arrêtés de protection de biotope,
sites Natura 2000 (habitats et oiseaux), terrains du Conservatoire du littoral, parcs naturels régionaux.
Les ZNIEFF sont des inventaires, pas des protections : elles ne sont pas retenues.
Les géométries sont découpées sur le territoire des 28 communes.

Usage : python3 scripts/collecte/zones-protegees.py  -> data/collecte/zones-protegees.geojson
"""
import json, time, urllib.request
from pathlib import Path
from shapely.geometry import shape, mapping
from shapely.ops import unary_union, transform

ROOT = Path(__file__).resolve().parents[2]
WFS = ("https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&OUTPUTFORMAT=application/json"
       "&SRSNAME=EPSG:4326&COUNT=500&TYPENAMES={}&BBOX={},urn:ogc:def:crs:EPSG::4326")
COUCHES = {
    "patrinat_rnn:rnn": "Réserve naturelle nationale",
    "patrinat_rnr:rnr": "Réserve naturelle régionale",
    "patrinat_apb:apb": "Arrêté de protection de biotope",
    "patrinat_sic:sic": "Natura 2000, directive Habitats",
    "patrinat_zps:zps": "Natura 2000, directive Oiseaux",
    "patrinat_cdl:conservatoire_littoral": "Conservatoire du littoral",
    "patrinat_pnr:pnr": "Parc naturel régional",
}
cda = unary_union([shape(f["geometry"]) for f in json.load(open(ROOT / "data/communes-contours.geojson"))["features"]]).buffer(0)
x0, y0, x1, y1 = cda.bounds
bbox = f"{y0},{x0},{y1},{x1}"
feats = []
for couche, libelle in COUCHES.items():
    for essai in range(4):
        try:
            d = json.load(urllib.request.urlopen(WFS.format(couche, bbox), timeout=120))
            break
        except Exception:
            time.sleep(4)
    else:
        raise SystemExit(couche)
    for f in d["features"]:
        g = shape(f["geometry"]).buffer(0).intersection(cda)
        if g.is_empty or g.area < 1e-7:
            continue
        p = f["properties"]
        nom = p.get("nom_site") or p.get("nom") or p.get("NOM_SITE") or "?"
        ident = p.get("id_mnhn") or p.get("sitecode") or p.get("id_local") or ""
        g = transform(lambda x, y, z=None: (round(x, 5), round(y, 5)), g.simplify(0.00005, preserve_topology=True))
        feats.append({"type": "Feature", "geometry": mapping(g),
                      "properties": {"type": libelle, "nom": nom, "identifiant": ident, "couche": couche.split(":")[0]}})
        print(libelle, "|", nom, "|", ident)
json.dump({"type": "FeatureCollection", "source": "INPN PatriNat et IGN, WFS data.geopf.fr", "collecte_le": time.strftime("%Y-%m-%d"),
           "features": feats}, open(ROOT / "data/collecte/zones-protegees.geojson", "w"), ensure_ascii=False)
