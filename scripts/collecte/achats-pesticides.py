#!/usr/bin/env python3
"""Achats de pesticides déclarés par les acheteurs domiciliés dans les codes postaux de la CDA.

Source : OFB, BNV-D Traçabilité, fichiers ACHAT_CP_SUBSTANCE (quantités de substance active en kg, par code postal
de l'acheteur). Le code postal est celui de l'acheteur, pas celui de la parcelle traitée.
Seuls les codes postaux entièrement inclus dans la CDA sont retenus : 17290 (Thairé) et 17540 (Vérines) couvrent aussi
des communes extérieures et sont exclus.

Usage : python3 scripts/collecte/achats-pesticides.py BNVD_..._ACHAT_CP_SUBSTANCE_2024.csv.gz [...]
Sortie : data/collecte/achats-pesticides.json
"""
import csv, gzip, json, sys, collections
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CP = {"17000": "La Rochelle", "17137": "Esnandes, L'Houmeau, Marsilly, Nieul-sur-Mer", "17138": "Puilboreau, Saint-Xandre",
      "17139": "Dompierre-sur-Mer", "17140": "Lagord", "17180": "Périgny",
      "17220": "Bourgneuf, Clavette, Croix-Chapeau, La Jarne, La Jarrie, Montroy, Saint-Christophe, Saint-Médard-d'Aunis, Saint-Rogatien, Sainte-Soulle, Saint-Vivien, Salles-sur-Mer",
      "17340": "Châtelaillon-Plage, Yves", "17440": "Aytré", "17690": "Angoulins"}
annees = {}
for f in sys.argv[1:]:
    tot, sub, cl, par_cp = 0.0, collections.Counter(), collections.Counter(), collections.Counter()
    fonc = {}
    annee = None
    for r in csv.DictReader(gzip.open(f, "rt", encoding="utf8"), delimiter=";"):
        if r["code_postal_acheteur"] not in CP:
            continue
        try:
            q = float(r["quantite_substance"])
        except ValueError:
            continue
        annee = r["annee"]
        tot += q
        par_cp[r["code_postal_acheteur"]] += q
        sub[r["substance"]] += q
        fonc[r["substance"]] = (r["fonction"], r["classification"])
        cl[r["classification"]] += q
    annees[annee] = {
        "total_kg": round(tot),
        "par_code_postal_kg": {k: round(v) for k, v in sorted(par_cp.items())},
        "par_classification_kg": {k: round(v) for k, v in cl.most_common()},
        "substances": [{"substance": s, "kg": round(q), "fonction": fonc[s][0], "classification": fonc[s][1]}
                       for s, q in sub.most_common(25)],
    }
    print(annee, round(tot), "kg")
json.dump({"source": "OFB, BNV-D Traçabilité, achats par code postal de l'acheteur, version du 25 novembre 2025",
           "codes_postaux": CP, "exclus": {"17290": "Thairé et neuf communes hors CDA", "17540": "Vérines et six communes hors CDA"},
           "annees": annees}, open(ROOT / "data/collecte/achats-pesticides.json", "w"), ensure_ascii=False, indent=1)
