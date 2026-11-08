"""Fiches « nitrates » : un point de mesure (ADES ou Naïades) où une analyse depuis 2015 dépasse 50 mg/l.
Les ouvrages d'un même captage, à la même position, sont réunis. Lit les caches de ades.py et naiades.py."""
import json, os, collections, unicodedata
ascii_ = lambda s: unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode()
NOMS = json.load(open("scripts/collecte/noms-stations.json"))
CACHE_A, CACHE_N = "/tmp/ades-cache", "/tmp/naiades-cache"
communes = {c["code_insee"]: c["nom"] for c in json.load(open("data/communes.json"))["communes"]}
ades = json.load(open("data/collecte/ades.json"))["stations"]
naiades = json.load(open("data/collecte/naiades.json"))["stations"]
sources = json.load(open("data/sources.json"))
ids_sources = {s["id"] for s in sources["sources"]}
NON_PERTINENTS = ("R471811", "Metolachlor ESA", "Métolachlore NOA", "Metolachlor NOA", "Métazachlore ESA", "Chloridazone desphényl")
CAPTAGES = {"BSS001QFFG": "captage de Varaize", "BSS001QGSC": "captage de Cassemortier", "BSS001QFVT": "captage de la Fraise",
            "BSS001QFUZ": "captage de la Fraise", "BSS001QGTA": "captage de la Ragotterie", "BSS001QGTB": "captage de la Ragotterie"}

def fr(x):
    s = f"{x:,.2f}".rstrip("0").rstrip(".").replace(",", " ").replace(".", ",")
    return s
def date_fr(d):
    m = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"]
    return f"{int(d[8:10])} {m[int(d[5:7])-1]} {d[:4]}".replace("1 ", "1er ", 1) if d[8:10] == "01" else f"{int(d[8:10])} {m[int(d[5:7])-1]} {d[:4]}"

def nitrates(ana, cle_date, cle_param, cle_rem):
    v = [(a[cle_date][:10], a["resultat"]) for a in ana if a.get(cle_param) == "Nitrates" and str(a.get(cle_rem)) == "1" and a.get("resultat") is not None]
    return sorted(v)

fiches = []
# ---- eaux souterraines, regroupées par position
groupes = collections.defaultdict(list)
for s in ades:
    if s["mesures_depuis_2015"]: groupes[(round(s["lon"], 4), round(s["lat"], 4))].append(s)
for (lon, lat), sts in groupes.items():
    serie = []
    for s in sts:
        serie += nitrates(json.load(open(f"{CACHE_A}/{s['bss_id']}.json")), "date_debut_prelevement", "nom_param", "code_remarque_analyse")
    serie.sort()
    if not serie or max(v for _, v in serie) <= 50: continue
    s0 = sts[0]; code = s0["code_insee"]; com = communes[code]
    dmax, vmax = max(serie, key=lambda x: x[1]); dder, vder = serie[-1]
    n50 = sum(1 for _, v in serie if v > 50)
    lieu = CAPTAGES.get(s0["bss_id"])
    sid = []
    for s in sts:
        i = "ades-" + s["bss_id"].lower()
        sid.append(i)
        if i not in ids_sources:
            sources["sources"].append({"id": i, "type": "base_publique", "auteur": "BRGM et OFB, ADES, via Hub'Eau", "titre": f"Qualité des eaux souterraines, point {s['code_bss']} ({s['bss_id']}), {com}",
                                       "date": s["derniere"], "url": f"https://ades.eaufrance.fr/Fiche/PtEau?Code={s['bss_id']}", "acces": "libre", "licence": "Licence Ouverte", "consulte_le": "2026-11-08"})
    autres = {}
    for s in sts:
        for q in s["quantifies"]:
            if q["unite"] == "µg/L" and q["max"] > 0.1 and not q["param"].startswith(("Bromure", "Somme", "EDTA", "Chlorophylle", "Phéopigments")):
                if q["param"] not in autres or q["max"] > autres[q["param"]]["max"]: autres[q["param"]] = q
    subs = [{"libelle": f"nitrates, maximum depuis 2015 ({date_fr(dmax)})", "milieu": "eau_souterraine", "valeur": vmax, "unite": "mg/L", "date_mesure": dmax, "source": sid[0]},
            {"libelle": f"nitrates, dernière mesure ({date_fr(dder)})", "milieu": "eau_souterraine", "valeur": vder, "unite": "mg/L", "date_mesure": dder, "source": sid[0]}]
    for q in sorted(autres.values(), key=lambda q: -q["max"])[:6]:
        subs.append({"libelle": f"{q['param']}, maximum ({date_fr(q['date_max'])})", "milieu": "eau_souterraine", "valeur": q["max"], "unite": "µg/L", "date_mesure": q["date_max"], "source": sid[0]})
    nom_lieu = f"Nappe au {lieu}, {com}" if lieu else f"Nappe à {com}, point de surveillance {s0['code_bss']}"
    debut = (f"Le {lieu} prélève l'eau d'une nappe pour l'eau potable. " if lieu else "Ce forage mesure l'eau d'une nappe suivie par les réseaux de surveillance de l'état des eaux. ")
    resume = (debut +
              f"Sur {len(serie)} analyses de nitrates depuis 2015, {n50} dépassent 50 mg/l, la norme de qualité des eaux souterraines. "
              f"Le maximum est de {fr(vmax)} mg/l le {date_fr(dmax)} ; la dernière mesure publiée donne {fr(vder)} mg/l le {date_fr(dder)}. ")
    if lieu: resume += "Il s'agit de l'eau brute, avant traitement et mélange : la qualité de l'eau du robinet se lit sur le pictogramme robinet de chaque commune."
    if autres: resume += " D'autres substances y sont quantifiées, listées dans les mesures."
    fiches.append({"id": ascii_(f"nitrates-nappe-{com.lower().replace(' ', '-').replace('’', '').replace(chr(39), '')}"), "nom": nom_lieu, "commune": com, "code_insee": code,
        "geometry": {"type": "Point", "coordinates": [s0["lon"], s0["lat"]]}, "precision_geo": "localisation_indicative", "rayon_m": 150,
        "origine_trace": "Position du point de mesure publiée par ADES. La mesure vaut pour la nappe à cet endroit, pas pour une surface délimitée.",
        "categorie": "ressource_eau", "pictogramme": "goutte", "milieux": ["eau_souterraine"], "substances": subs,
        "periode": {"debut": serie[0][0], "debut_statut": "datee", "fin": None, "fin_statut": "en_cours", "note": "Analyses depuis 2015 retenues. La pollution par les nitrates est diffuse, d'origine principalement agricole selon les états des lieux de l'agence de l'eau."},
        "resume": resume.strip(), "accroche": f"Nitrates au-dessus de 50 mg/l dans la nappe{' du ' + lieu if lieu else ''} à {com}",
        "resume_court": f"Jusqu'à {fr(vmax)} mg/l de nitrates, pour une norme de 50 mg/l. Dernière mesure : {fr(vder)} mg/l en {dder[:4]}.",
        "statut_preuve": "mesure_publiee", "procedure_en_cours": False, "statut_traitement": "sous_surveillance",
        "derniere_verification": "2026-11-08", "visible_par_defaut": True, "sources": sid,
        "ce_qui_manque": [{"piece": "L'origine précise des nitrates sur l'aire d'alimentation", "ou_chercher": "Études d'aire d'alimentation de captage de la CDA et du syndicat Eau 17, état des lieux de l'agence de l'eau Loire-Bretagne"}]})

# ---- cours d'eau et canaux
for s in naiades:
    if not s["mesures_depuis_2015"]: continue
    ana = json.load(open(f"{CACHE_N}/{s['code_station']}.json"))
    serie = sorted((a["date_prelevement"][:10], a["resultat"]) for a in ana if a.get("libelle_parametre") == "Nitrates" and str(a.get("code_remarque")) == "1" and a.get("resultat") is not None)
    if not serie or max(v for _, v in serie) <= 50: continue
    code = s["code_insee"]; com = communes.get(code)
    if not com: continue
    meta = json.load(open(f"{CACHE_N}/station-{s['code_station']}.json")) if os.path.exists(f"{CACHE_N}/station-{s['code_station']}.json") else None
    dmax, vmax = max(serie, key=lambda x: x[1]); dder, vder = serie[-1]; n50 = sum(1 for _, v in serie if v > 50)
    i = "naiades-" + s["code_station"]
    if i not in ids_sources:
        sources["sources"].append({"id": i, "type": "base_publique", "auteur": "OFB et agences de l'eau, Naïades, via Hub'Eau", "titre": f"Qualité physico-chimique des eaux de surface, station {s['code_station']}, {s['libelle']}",
                                   "date": s["derniere"], "url": f"https://naiades.eaufrance.fr/acces-donnees#/physicochimie/resultats?stations={s['code_station']}", "acces": "libre", "licence": "Licence Ouverte", "consulte_le": "2026-11-08"})
    lib = s["libelle"].strip()
    nom, court = NOMS.get(s["code_station"], [lib, lib])
    subs = [{"libelle": f"nitrates, maximum depuis 2015 ({date_fr(dmax)})", "milieu": "eau_superficielle", "valeur": vmax, "unite": "mg/L", "date_mesure": dmax, "source": i},
            {"libelle": f"nitrates, dernière mesure ({date_fr(dder)})", "milieu": "eau_superficielle", "valeur": vder, "unite": "mg/L", "date_mesure": dder, "source": i}]
    for q in sorted(s["quantifies"], key=lambda q: -q["max"]):
        if q["unite"] == "µg/L" and q["max"] > 0.1 and not q["param"].startswith(("Chlorophylle", "Phéopigments")) and len(subs) < 7:
            subs.append({"libelle": f"{q['param']}, maximum ({date_fr(q['date_max'])})", "milieu": "eau_superficielle", "valeur": q["max"], "unite": "µg/L", "date_mesure": q["date_max"], "source": i})
    slug = "nitrates-" + s["code_station"]
    fiches.append({"id": slug, "nom": nom, "commune": com, "code_insee": code,
        "geometry": {"type": "Point", "coordinates": [s["lon_reel"], s["lat_reel"]]}, "precision_geo": "localisation_indicative", "rayon_m": 150,
        "origine_trace": "Position de la station de mesure publiée par Naïades. La mesure vaut pour le cours d'eau à cet endroit.",
        "categorie": "ressource_eau", "pictogramme": "goutte", "milieux": ["eau_superficielle"], "substances": subs,
        "periode": {"debut": serie[0][0], "debut_statut": "datee", "fin": None if dder >= "2024" else dder, "fin_statut": "en_cours" if dder >= "2024" else "datee",
                    "note": "Analyses depuis 2015 retenues." + ("" if dder >= "2024" else f" Pas de mesure publiée depuis {dder[:4]}.")},
        "resume": (f"La station {s['code_station']} mesure la qualité de l'eau de {court}. Sur {len(serie)} analyses de nitrates depuis 2015, {n50} dépassent 50 mg/l, "
                   f"seuil du bon état des eaux. Le maximum est de {fr(vmax)} mg/l le {date_fr(dmax)} ; la dernière mesure publiée donne {fr(vder)} mg/l le {date_fr(dder)}."
                   + (" D'autres substances y sont quantifiées, listées dans les mesures." if len(subs) > 2 else "")),
        "accroche": f"Nitrates au-dessus de 50 mg/l dans {court} à {com}",
        "resume_court": f"Jusqu'à {fr(vmax)} mg/l de nitrates, pour un seuil de bon état de 50 mg/l. Dernière mesure : {fr(vder)} mg/l en {dder[:4]}.",
        "statut_preuve": "mesure_publiee", "procedure_en_cours": False, "statut_traitement": "sous_surveillance",
        "derniere_verification": "2026-11-08", "visible_par_defaut": True, "sources": [i]})

for f in fiches:
    json.dump(f, open(f"data/sites/{f['id']}.json", "w"), ensure_ascii=False, indent=2); open(f"data/sites/{f['id']}.json", "a").write("\n")
json.dump(sources, open("data/sources.json", "w"), ensure_ascii=False, indent=2); open("data/sources.json", "a").write("\n")
print(len(fiches), "fiches"); [print(" ", f["id"], "|", f["accroche"]) for f in fiches]
