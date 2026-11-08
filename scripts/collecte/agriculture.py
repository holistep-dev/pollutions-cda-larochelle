#!/usr/bin/env python3
"""Couche de contexte agricole : cultures déclarées à la PAC et parcelles en agriculture biologique.

Ce n'est pas une couche de pollution. Elle dit ce qui est cultivé et comment, pas ce qui est mesuré.
Aucun exploitant n'est nommé : le RPG publié par l'IGN est anonyme, le jeu bio de l'Agence Bio aussi.

Sources :
  IGN, Registre parcellaire graphique 2023, couche RPG.2023:parcelles_graphiques (WFS data.geopf.fr)
  Agence Bio, Parcelles en agriculture biologique déclarées à la PAC, Nouvelle-Aquitaine, 2023 (data.gouv.fr)

Usage : python3 scripts/collecte/agriculture.py chemin/rpg-bio-2023-nouvelleaquitaine-75.gpkg
Sortie : data/agriculture/rpg-2023.geojson (géométries fusionnées par groupe de cultures et par mode)
"""
import json, math, sqlite3, sys, time, urllib.request, collections
from pathlib import Path
from shapely import wkb
from shapely.geometry import shape, mapping
from shapely.ops import unary_union, transform

ROOT = Path(__file__).resolve().parents[2]
EPCI = "241700434"
WFS = "https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&OUTPUTFORMAT=application/json"


def get(url):
    for essai in range(5):
        try:
            return json.load(urllib.request.urlopen(url, timeout=120))
        except Exception:
            time.sleep(4 * (essai + 1))
    raise RuntimeError(url)


def lambert93_vers_wgs84(x, y, z=None):
    n, c, xs, ys, e = 0.7256077650532670, 11754255.426096, 700000, 12655612.049876, 0.0818191910428158
    dx, dy = x - xs, y - ys
    r = math.hypot(dx, dy)
    lon = math.radians(3) + math.atan(dx / -dy) / n
    li = -1 / n * math.log(abs(r / c))
    phi = 2 * math.atan(math.exp(li)) - math.pi / 2
    for _ in range(8):
        phi = 2 * math.atan(((1 + e * math.sin(phi)) / (1 - e * math.sin(phi))) ** (e / 2) * math.exp(li)) - math.pi / 2
    return math.degrees(lon), math.degrees(phi)


cda = unary_union([shape(f["geometry"]) for f in json.load(open(ROOT / "data/communes-contours.geojson"))["features"]])
minx, miny, maxx, maxy = cda.bounds

# Libellés des groupes de cultures
groupes = {}
for f in get(f"{WFS}&TYPENAMES=RPG.2023:codes_cultures&COUNT=1000")["features"]:
    p = f["properties"]
    groupes[p["code_groupe"]] = p["libelle_groupe"]

# Parcelles RPG 2023 dans l'emprise
parcelles, debut = [], 0
while True:
    url = (f"{WFS}&TYPENAMES=RPG.2023:parcelles_graphiques&SRSNAME=EPSG:4326&COUNT=5000&STARTINDEX={debut}"
           f"&BBOX={miny},{minx},{maxy},{maxx},urn:ogc:def:crs:EPSG::4326")
    lot = get(url)["features"]
    parcelles += lot
    print("RPG", len(parcelles), file=sys.stderr)
    if len(lot) < 5000:
        break
    debut += 5000

par_groupe = collections.defaultdict(list)
surf = collections.Counter()
for f in parcelles:
    g = shape(f["geometry"]).buffer(0)
    if not g.intersects(cda):
        continue
    g = g.intersection(cda)
    code = f["properties"]["code_group"]
    par_groupe[code].append(g)
    surf[code] += f["properties"]["surf_parc"]

# Parcelles bio de la CDA
con = sqlite3.connect(sys.argv[1])
bio, surf_bio = [], collections.Counter()
for blob, grp, ha in con.execute("select geom, grp_culture, surface_ha from code_region_75 where code_epci = ?", (int(EPCI),)):
    # en-tête GeoPackage : 8 octets + enveloppe selon le drapeau
    flags = blob[3]
    env = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[(flags >> 1) & 7]
    g = transform(lambert93_vers_wgs84, wkb.loads(blob[8 + env:])).buffer(0)
    bio.append(g)
    surf_bio[grp] += ha

simplifie = lambda g: mapping(transform(lambda x, y, z=None: (round(x, 5), round(y, 5)), g.simplify(0.00004, preserve_topology=True)))
features = []
for code, geoms in sorted(par_groupe.items(), key=lambda kv: -surf[kv[0]]):
    features.append({"type": "Feature", "geometry": simplifie(unary_union(geoms)),
                     "properties": {"couche": "culture", "code_groupe": code, "libelle": groupes.get(code, code),
                                    "surface_ha": round(surf[code])}})
features.append({"type": "Feature", "geometry": simplifie(unary_union(bio)),
                 "properties": {"couche": "bio", "libelle": "Parcelles déclarées en agriculture biologique",
                                "surface_ha": round(sum(surf_bio.values()))}})

(ROOT / "data/agriculture").mkdir(exist_ok=True)
sortie = {
    "type": "FeatureCollection",
    "sources": [
        "IGN, Registre parcellaire graphique 2023, parcelles graphiques, WFS data.geopf.fr",
        "Agence Bio, Parcelles en agriculture biologique déclarées à la PAC, Nouvelle-Aquitaine, 2023, data.gouv.fr",
    ],
    "annee": 2023,
    "surface_declaree_ha": round(sum(surf.values())),
    "surface_bio_ha": round(sum(surf_bio.values())),
    "bio_par_groupe_ha": {k: round(v, 1) for k, v in surf_bio.most_common()},
    "features": features,
}
json.dump(sortie, open(ROOT / "data/agriculture/rpg-2023.geojson", "w"), ensure_ascii=False, separators=(",", ":"))
print("surface déclarée", round(sum(surf.values())), "ha ; bio", round(sum(surf_bio.values())), "ha")
for code, s in surf.most_common(): print(f"  {groupes.get(code, code)}: {round(s)} ha")
print(dict(surf_bio.most_common()))
