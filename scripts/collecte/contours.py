#!/usr/bin/env python3
"""Contours tirés de la BD TOPO de l'IGN (WFS data.geopf.fr) pour les sites dont la source ne fournit qu'un point.

Le contour décrit l'objet nommé par la source (le plan d'eau, le port, la plage), jamais une emprise
de pollution. La fiche garde precision_geo = perimetre_approximatif et cite l'objet BD TOPO utilisé.

Usage : python3 scripts/collecte/contours.py  -> écrit data/collecte/contours.json
"""
import json, math, time, urllib.request, urllib.parse
from pathlib import Path
from shapely.geometry import shape, mapping, Point
from shapely.ops import unary_union, transform

ROOT = Path(__file__).resolve().parents[2]
WFS = "https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&OUTPUTFORMAT=application/json&SRSNAME=EPSG:4326&COUNT=2000"


def wfs(couche, bbox=None, filtre=None):
    url = f"{WFS}&TYPENAMES={couche}"
    if bbox:  # (lat_min, lon_min, lat_max, lon_max)
        url += "&BBOX=" + ",".join(map(str, bbox)) + ",urn:ogc:def:crs:EPSG::4326"
    if filtre:
        url += "&CQL_FILTER=" + urllib.parse.quote(filtre)
    for essai in range(4):
        try:
            return json.load(urllib.request.urlopen(url, timeout=90))["features"]
        except Exception:
            time.sleep(3)
    raise RuntimeError(url)


LAT0 = 46.15
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110540
vers_m = lambda x, y, z=None: (x * KX, y * KY)
vers_deg = lambda x, y, z=None: (x / KX, y / KY)


def plat(g):
    """Supprime la coordonnée Z et arrondit."""
    g = transform(lambda x, y, z=None: (round(x, 6), round(y, 6)), g)
    return mapping(g.simplify(0.00001))


sortie = {"source": "IGN, BD TOPO V3 (WFS data.geopf.fr)", "collecte_le": time.strftime("%Y-%m-%d"), "contours": {}}

# Trou Rizzo : plan d'eau de la carrière, retenue BD TOPO dont le centroïde coïncide avec le point de la fiche.
for f in wfs("BDTOPO_V3:surface_hydrographique", bbox=(46.124, -1.150, 46.133, -1.138)):
    g = shape(f["geometry"])
    if g.contains(Point(-1.144126, 46.128708)):
        sortie["contours"]["projet-decharge-trou-rizzo-aytre"] = {
            "objet": f"Surface hydrographique BD TOPO {f['properties']['cleabs']}, nature {f['properties']['nature']}",
            "geometry": plat(g),
        }

# Chef-de-Baie : la source situe la décharge à l'emplacement de l'actuel port de pêche.
for f in wfs("BDTOPO_V3:equipement_de_transport", bbox=(46.140, -1.235, 46.160, -1.205)):
    if f["properties"].get("toponyme") == "Port de Pêche de Chef de Baie":
        sortie["contours"]["decharge-chef-de-baie-la-rochelle"] = {
            "objet": f"Équipement de transport BD TOPO {f['properties']['cleabs']}, Port de Pêche de Chef de Baie",
            "geometry": plat(shape(f["geometry"])),
        }

# Plages : estran sableux BD TOPO dans un rayon de 250 m autour du point de contrôle ARS.
sable = [shape(f["geometry"]) for f in wfs("BDTOPO_V3:zone_d_estran", bbox=(46.03, -1.27, 46.22, -1.05))
         if f["properties"]["nature"] == "Sable"]
sable_m = unary_union([transform(vers_m, transform(lambda x, y, z=None: (x, y), s)) for s in sable])
for p in sorted((ROOT / "data/sites").glob("baignade-*.json")):
    s = json.load(open(p))
    x, y = transform(vers_m, Point(*s["geometry"]["coordinates"])).coords[0]
    zone = sable_m.intersection(Point(x, y).buffer(250))
    if zone.is_empty or zone.area < 2000:
        print("pas de sable autour de", s["id"], round(sable_m.distance(Point(x, y))), "m")
        continue
    sortie["contours"][s["id"]] = {
        "objet": "Zone d'estran BD TOPO de nature Sable, à moins de 250 m du point de contrôle sanitaire",
        "geometry": plat(transform(vers_deg, zone)),
    }

json.dump(sortie, open(ROOT / "data/collecte/contours.json", "w"), ensure_ascii=False)
print(sorted(sortie["contours"]))
