#!/usr/bin/env python3
"""Collecte des prélèvements et événements des onze sites de baignade de la CDA.

Sources :
  - saisons 2013 à 2019 : fichiers nationaux xlsx du rapportage de la saison balnéaire (data.gouv.fr,
    jeu 57fce28ac751df0e4079df72), feuilles « Resultats d'analyses », « Situations anormales »,
    « Pollutions à court terme » ;
  - saisons 2020 à 2025 : CSV « résultats d'analyses » du même jeu ;
  - saison 2026 : pages publiques SISE-Baignades (baignades.sante.gouv.fr), le rapportage n'étant pas publié.

Usage : python3 scripts/collecte/baignade.py <dossier des fichiers téléchargés>
Sortie : data/collecte/baignade-prelevements.json. Les valeurs « <15 » sont notées 15, comme dans le rapportage.
"""
import csv, datetime, html, json, os, re, sys, urllib.request

import openpyxl

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
DOSSIER = sys.argv[1]

# Suffixe stable du code de rapportage européen : le préfixe a changé selon les millésimes.
SITES = {
    'M017009': ('baignade-lhoumeau-pampin', '017000779'),
    'M017015': ('baignade-chef-de-baie-la-rochelle', '017000584'),
    'M017020': ('baignade-concurrence-la-rochelle', '017000613'),
    'M017025': ('baignade-minimes-la-rochelle', '017000585'),
    'M017035': ('baignade-aytre-platin-nord', '017000589'),
    'M017040': ('baignade-aytre-platin-sud', '017000590'),
    'M017045': ('baignade-angoulins-platerre', '017000586'),
    'M017047': ('baignade-chatelaillon-nord', '017000755'),
    'M017048': ('baignade-chatelaillon-casino', '017000592'),
    'M017055': ('baignade-chatelaillon-sud', '017000594'),
    'M017060': ('baignade-chatelaillon-boucholeurs', '017000595'),
}
suffixe = lambda code: (code or '')[-7:]

out = {s: {'prelevements': {}, 'evenements': []} for s, _ in SITES.values()}

def num(v):
    if v is None or v == '':
        return None
    v = str(v).strip().replace('<', '').replace(',', '.')
    try:
        return float(v) if '.' in v else int(v)
    except ValueError:
        return None

def ajoute(code, date, ent, eco, provenance):
    if suffixe(code) not in SITES:
        return
    site = SITES[suffixe(code)][0]
    out[site]['prelevements'][date] = {'date': date, 'saison': int(date[:4]), 'enterocoques_ufc_100ml': num(ent),
                                       'escherichia_coli_ufc_100ml': num(eco), 'provenance': provenance}

def jour(v):
    if isinstance(v, datetime.datetime):
        return v.date().isoformat()
    v = str(v).strip()
    if re.match(r'\d{2}/\d{2}/\d{4}', v):
        j, m, a = v[:10].split('/')
        return f'{a}-{m}-{j}'
    return v[:10]

for f in sorted(os.listdir(DOSSIER)):
    p = os.path.join(DOSSIER, f)
    m = re.search(r'saison-balneaire-(20\d\d)', f)
    if not m:
        continue
    annee = m.group(1)
    if f.endswith('.xlsx'):
        wb = openpyxl.load_workbook(p, read_only=True)
        for ws in wb.worksheets:
            t = ws.title.lower().replace('é', 'e')
            rows = ws.iter_rows(values_only=True)
            entete = [str(h or '') for h in next(rows, [])]
            # Les colonnes varient selon les millésimes : on les repère par leur intitulé.
            ic = next((i for i, h in enumerate(entete) if 'Code unique' in h), 2)
            for r in rows:
                code = str(r[ic] or '')
                if suffixe(code) not in SITES:
                    continue
                if t.startswith('resultats'):
                    ajoute(code, jour(r[ic + 1]), r[ic + 2], r[ic + 3], f'rapportage {annee}')
                elif t.startswith('situations') or t.startswith('pollutions'):
                    out[SITES[suffixe(code)][0]]['evenements'].append({
                        'saison': int(annee), 'type': 'situation anormale' if t.startswith('situations') else 'pollution à court terme',
                        'debut': jour(r[ic + 1]), 'fin': jour(r[ic + 2])})
    elif f.endswith('.csv') and 'resultat' in f:
        with open(p, encoding='latin-1', newline='') as fh:
            for r in csv.reader(fh, delimiter=';'):
                if len(r) > 6 and suffixe(r[3]) in SITES:
                    ajoute(r[3], jour(r[4]), r[5], r[6], f'rapportage {annee}')

# ------------------------------------------------------------------ 2026, SISE-Baignades
def page(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read().decode('latin-1')

for suf, (site, sise) in SITES.items():
    url = f'https://baignades.sante.gouv.fr/baignades/consultSite.do?dptddass=017&site={sise}&annee=2026&plv=all'
    try:
        t = page(url)
    except Exception as e:
        print(site, '2026 indisponible', e)
        continue
    for bloc in t.split('Param&egrave;tres obligatoires')[1:]:
        dates = re.findall(r'scope="Qualite">(\d{2}/\d{2}/\d{4})</th>', bloc)
        lignes = re.split(r'<tr>', bloc)
        ent = eco = None
        for l in lignes:
            cell = re.findall(r'class="cellule_(?:paire|impaire)_resultat">\s*([^<]*(?:<\d+)?)\s*</td>', l)
            if 'rocoques' in l and ent is None:
                ent = re.findall(r'_resultat">([^<]*|<\d+)</td>', l)
            elif 'Escherichia' in l and eco is None:
                eco = re.findall(r'_resultat">([^<]*|<\d+)</td>', l)
        for i, d in enumerate(dates):
            e1 = ent[i] if ent and i < len(ent) else None
            e2 = eco[i] if eco and i < len(eco) else None
            ajoute(suf, jour(d), e1, e2, 'SISE-Baignades 2026')

res = {'extrait_le': datetime.date.today().isoformat(),
       'source': 'data.gouv.fr jeu 57fce28ac751df0e4079df72 (2013-2025) ; baignades.sante.gouv.fr (2026)',
       'sites': {s: {'prelevements': sorted(v['prelevements'].values(), key=lambda x: x['date']),
                     'evenements': sorted({json.dumps(e, sort_keys=True) for e in v['evenements']})}
                 for s, v in out.items()}}
for s in res['sites'].values():
    s['evenements'] = [json.loads(e) for e in s['evenements']]
os.makedirs(os.path.join(ROOT, 'data/collecte'), exist_ok=True)
json.dump(res, open(os.path.join(ROOT, 'data/collecte/baignade-prelevements.json'), 'w'), ensure_ascii=False, indent=1)
for s, v in res['sites'].items():
    ans = sorted({p['saison'] for p in v['prelevements']})
    print(s, len(v['prelevements']), 'prélèvements', ans[:1], ans[-1:], len(v['evenements']), 'événements')
