"""Qualité physico-chimique des cours d'eau et canaux, Naïades via Hub'Eau, sur les 28 communes.
Écrit data/collecte/naiades.json : par station, période et paramètres quantifiés depuis 2015 avec maximums."""
import json, urllib.request, urllib.parse, time, os, sys
CODES = [c["code_insee"] for c in json.load(open("data/communes.json"))["communes"]]
API = "https://hubeau.eaufrance.fr/api/v2/qualite_rivieres/"
CACHE = "/tmp/naiades-cache"; os.makedirs(CACHE, exist_ok=True)
def lire(url):
    for i in range(5):
        try: return json.load(urllib.request.urlopen(url, timeout=120))
        except Exception as e: time.sleep(3 * (i + 1)); err = e
    raise err
st = lire(API + "station_pc?" + urllib.parse.urlencode({"code_commune": ",".join(CODES), "size": 200}))["data"]
out = []
for s in st:
    f = f"{CACHE}/{s['code_station']}.json"
    if os.path.exists(f): ana = json.load(open(f))
    else:
        ana, page = [], 1
        while True:
            q = {"code_station": s["code_station"], "date_debut_prelevement": "2015-01-01", "size": 5000, "page": page,
                 "fields": "date_prelevement,code_parametre,libelle_parametre,resultat,symbole_unite,code_remarque,libelle_fraction"}
            d = lire(API + "analyse_pc?" + urllib.parse.urlencode(q))
            ana += d["data"]
            if not d.get("next") or page * 5000 >= 20000: break
            page += 1
        json.dump(ana, open(f, "w"))
    quanti = {}
    for a in ana:
        if str(a.get("code_remarque")) != "1" or a.get("resultat") is None: continue
        k = a["libelle_parametre"]
        q = quanti.setdefault(k, {"param": k, "code": a["code_parametre"], "unite": a.get("symbole_unite"), "fraction": a.get("libelle_fraction"), "n": 0, "max": None, "date_max": None, "derniere": None})
        q["n"] += 1
        if q["max"] is None or a["resultat"] > q["max"]: q["max"], q["date_max"] = a["resultat"], a["date_prelevement"][:10]
        q["derniere"] = max(q["derniere"] or "", a["date_prelevement"][:10])
    dates = sorted(a["date_prelevement"][:10] for a in ana)
    out.append({"code_station": s["code_station"], "libelle": s["libelle_station"], "commune": s["libelle_commune"], "code_insee": s["code_commune"],
                "lon": s.get("coordonnee_x") and s.get("longitude"), "lat": s.get("latitude"), "cours_eau": s.get("libelle_cours_eau"),
                "mesures_depuis_2015": len(ana), "premiere": dates[0] if dates else None, "derniere": dates[-1] if dates else None,
                "quantifies": sorted(quanti.values(), key=lambda q: q["param"])})
    print(s["code_station"], s["libelle_station"], len(ana), file=sys.stderr)
json.dump({"genere_le": time.strftime("%Y-%m-%d"), "source": "Naïades, Hub'Eau qualite_rivieres", "stations": out}, open("data/collecte/naiades.json", "w"), ensure_ascii=False, indent=1)
