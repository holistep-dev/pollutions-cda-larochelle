"""Qualité des eaux souterraines, ADES via Hub'Eau, sur les 28 communes de la CDA.
Écrit data/collecte/ades.json : par qualitomètre, période, réseaux, paramètres quantifiés depuis 2015 et maximums."""
import json, urllib.request, urllib.parse, time, sys, os
CODES = [c["code_insee"] for c in json.load(open("data/communes.json"))["communes"]]
API = "https://hubeau.eaufrance.fr/api/v1/qualite_nappes/"
CACHE = "/tmp/ades-cache"; os.makedirs(CACHE, exist_ok=True)

def lire(url):
    for i in range(5):
        try: return json.load(urllib.request.urlopen(url, timeout=120))
        except Exception as e:
            time.sleep(3 * (i + 1)); err = e
    raise err

stations = lire(API + "stations?" + urllib.parse.urlencode({"code_commune": ",".join(CODES), "size": 500}))["data"]
out = []
for s in stations:
    f = f"{CACHE}/{s['bss_id']}.json"
    if os.path.exists(f): ana = json.load(open(f))
    else:
        ana, page = [], 1
        while True:
            q = {"bss_id": s["bss_id"], "date_debut_prelevement": "2015-01-01", "size": 5000, "page": page,
                 "fields": "date_debut_prelevement,code_param,nom_param,resultat,symbole_unite,code_remarque_analyse,codes_reseau"}
            d = lire(API + "analyses?" + urllib.parse.urlencode(q))
            ana += d["data"]
            if not d.get("next") or page * 5000 >= 20000: break
            page += 1
        json.dump(ana, open(f, "w"))
    quanti = {}
    for a in ana:
        if str(a.get("code_remarque_analyse")) != "1" or a.get("resultat") is None: continue
        k = a["nom_param"]
        q = quanti.setdefault(k, {"param": k, "code": a["code_param"], "unite": a.get("symbole_unite"), "n": 0, "max": None, "date_max": None, "derniere": None})
        q["n"] += 1
        if q["max"] is None or a["resultat"] > q["max"]: q["max"], q["date_max"] = a["resultat"], a["date_debut_prelevement"][:10]
        q["derniere"] = max(q["derniere"] or "", a["date_debut_prelevement"][:10])
    dates = sorted(a["date_debut_prelevement"][:10] for a in ana)
    out.append({"bss_id": s["bss_id"], "code_bss": s["code_bss"], "commune": s["nom_commune"], "code_insee": s["code_insee"],
                "lon": s["longitude"], "lat": s["latitude"], "nature": s.get("nom_nature_pe"), "profondeur": s.get("profondeur_investigation"),
                "masse_eau": (s.get("noms_masse_eau_edl") or [None])[0], "mesures_depuis_2015": len(ana),
                "premiere": dates[0] if dates else None, "derniere": dates[-1] if dates else None,
                "reseaux": sorted({r for a in ana for r in (a.get("codes_reseau") or [])}),
                "quantifies": sorted(quanti.values(), key=lambda q: q["param"])})
    print(s["bss_id"], s["nom_commune"], len(ana), file=sys.stderr)
json.dump({"genere_le": time.strftime("%Y-%m-%d"), "source": "ADES, Hub'Eau qualite_nappes", "stations": out}, open("data/collecte/ades.json", "w"), ensure_ascii=False, indent=1)
