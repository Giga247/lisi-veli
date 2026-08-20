# ეტაპი 1 — სამეზობლოს რეესტრი: იმპლემენტაციის გეგმა

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** სამეზობლოს ნაკვეთების რეესტრი — ცხრილი და ინტერაქციული რუკა — Google-ით შესვლით, ადმინის დამტკიცებით და მოდერატორის რედაქტირებით.

**Architecture:** სტატიკური საიტი GitHub Pages-ზე (build-პროცესის გარეშე) ელაპარაკება Google Apps Script Web App-ს, რომელიც ერთადერთია, ვისაც Google Sheet-თან წვდომა აქვს. მომხმარებლის იდენტიფიკაცია ხდება Google Identity Services-ის ID token-ით, რომელსაც სერვერი ამოწმებს. ყველა უფლების შემოწმება სერვერზეა.

**Tech Stack:** vanilla JavaScript (ES2020, მოდულების და bundler-ის გარეშე) · Google Apps Script · Google Sheets · Google Identity Services · Leaflet 1.9 + OpenStreetMap · Python 3 + openpyxl (მხოლოდ ერთჯერადი იმპორტისთვის) · Node.js `node --test` (ტესტებისთვის, npm-პაკეტების გარეშე)

**Spec:** `docs/superpowers/specs/2026-08-20-samezoblos-platforma-design.md`

## Global Constraints

ეს წესები ყველა ამოცანაზე ვრცელდება. მნიშვნელობები სპეციფიკაციიდან სიტყვასიტყვითაა გადმოტანილი.

- **არანაირი build-პროცესი და npm-დამოკიდებულება.** `package.json` არ იქმნება. ტესტები Node-ის ჩაშენებული რანერით გადის: `node --test`.
- **API-ის ყველა გამოძახება:** `POST`, `Content-Type: text/plain;charset=utf-8`, სხეული JSON სტრიქონი. `application/json` **აკრძალულია** — Apps Script preflight-ს არ ამუშავებს.
- **მორგებული HTTP header-ები აკრძალულია.** ID token მიდის სხეულში, არა `Authorization`-ში.
- **`aud`-ის შემოწმება სავალდებულოა** ყოველი ტოკენისთვის: უნდა ემთხვეოდეს `CLIENT_ID`-ს. ასევე მოწმდება `iss` ∈ {`accounts.google.com`, `https://accounts.google.com`}, `email_verified === true`, `exp` > ახლა.
- **Sheet არასოდეს ქვეყნდება.** არც „Publish to web", არც „Anyone with the link".
- **Sheet-ის სვეტები ქართული სათაურებით; ძებნა სათაურის სახელით, არა ინდექსით.**
- **რედაქტირებადი ველების თეთრი სია:** `first_name`, `last_name`, `phone`, `street`, `num`, `address`, `area`, `purpose`, `note`. სიის გარეთ ყველაფერი → `FORBIDDEN`.
- **არასოდეს რედაქტირებადი:** `cad`, `geometry`, `lat`, `lon`, `updated_at`, `updated_by`.
- **რუკა:** მხოლოდ Leaflet 1.9 + OpenStreetMap. სხვა რუკის ბიბლიოთეკა არ ემატება. ხატვის ინსტრუმენტი არ არის.
- **ოპტიმისტური კონკურენცია:** `updatePlot` მოითხოვს `expected_updated_at`-ს. ცარიელი ჩანაწერისთვის — ცარიელი სტრიქონი `""`. `null` ან გამოტოვება → `VALIDATION`.
- **წერა LockService-ის ბლოკირებაშია:** `LockService.getScriptLock()`, 10 წამის მოცდა.
- **Rate limit:** 60 მოთხოვნა წუთში მეილზე, `CacheService`-ის მრიცხველით.
- **ტოკენის ვერიფიკაციის ქეში:** 5 წუთი, გასაღები = ტოკენის SHA-256.
- **ლოგი მხოლოდ ემატება.** არასოდეს რედაქტირდება ან იშლება აპლიკაციიდან.
- **ინტერფეისის ყველა ტექსტი ქართულად.**
- **პასუხის ფორმატი:** `{ok:true, data:…}` ან `{ok:false, error:"CODE", message:"ქართულად"}`.

---

## ფაილების სტრუქტურა

| ფაილი | პასუხისმგებლობა |
|---|---|
| `.gitignore` | 22 MB PNG და დროებითი ფაილები repo-ს გარეთ |
| `tools/import.py` | ერთჯერადი: xlsx + geojson → სამი CSV |
| `tools/import_lib.py` | იმპორტის **სუფთა ფუნქციები** — ფაილებს არ ეხება, ამიტომ იტესტება |
| `tools/test_import.py` | `import.py`-ის სუფთა ფუნქციების ტესტები |
| `apps-script/lib.js` | **სუფთა ფუნქციები** — Sheet-ს და ქსელს არ ეხება. ერთადერთი ტესტირებადი სერვერული ფაილი |
| `apps-script/Code.js` | Web App-ის შესასვლელი: `doPost`, მარშრუტიზაცია, Sheet-თან წვდომა, ტოკენის ქსელური შემოწმება, ლოგირება |
| `tests/lib.test.js` | `apps-script/lib.js`-ის ტესტები |
| `tests/weblib.test.js` | `js/lib.js`-ის ტესტები |
| `index.html` | ერთი გვერდი, სამი ტაბი |
| `css/style.css` | სტილები, ღია და ბნელი რეჟიმი |
| `js/config.js` | **ერთადერთი კონფიგურაცია:** `CLIENT_ID`, `API_URL` |
| `js/lib.js` | სუფთა ფრონტენდ-ლოგიკა: ფილტრი, სორტირება, ფორმატირება |
| `js/api.js` | **მიგრაციის წერტილი** — ბაზასთან საუბრის ერთადერთი ფაილი |
| `js/auth.js` | Google Sign-In, ტოკენის მიღება და განახლება |
| `js/ui.js` | ტაბები, შეცდომების ჩვენება, საერთო helper-ები |
| `js/table.js` | ცხრილის ხედი |
| `js/map.js` | რუკის ხედი |
| `js/admin.js` | ადმინის პანელი |
| `js/main.js` | ჩატვირთვის ნაკადი: ტოკენი → `me` → ეკრანი; გლობალები `CURRENT_USER`, `PLOTS` |
| `docs/setup.md` | განთავსების ინსტრუქცია |
| `docs/qa-checklist.md` | ხელით შესამოწმებელი სცენარები |

**რატომ იყოფა `lib.js` და `Code.js`:** Apps Script-ს ტესტ-რანერი არ აქვს და Sheet-თან მიბმული კოდი ლოკალურად ვერ გაიშვება. ამიტომ ყველა ლოგიკა, რომელიც გადაწყვეტილებას იღებს, `lib.js`-შია — სუფთა ფუნქციები, რომლებიც Node-ით იტესტება. `Code.js` მხოლოდ „მილია": კითხულობს Sheet-ს, ეკითხება `lib.js`-ს რა ქნას, წერს Sheet-ში.

---

## Task 1: repo-ს ჩონჩხი და მონაცემების იმპორტი

**Files:**
- Create: `.gitignore`
- Create: `tools/import.py`
- Create: `tools/import_lib.py`
- Test: `tools/test_import.py`

**Interfaces:**
- Consumes: არაფერს — პირველი ამოცანაა
- Produces: `build/plots.csv`, `build/users.csv`, `build/log.csv` — Google Sheet-ში ჩასასმელი სამი ფაილი. `plots.csv`-ის სვეტების რიგი: `საკადასტრო კოდი, ქუჩა, N, სრული მისამართი, ფართობი კვ.მ, დანიშნულება, სახელი, გვარი, ტელეფონი, გრძედი, განედი, გეომეტრია, წყარო, შენიშვნა, განახლდა, განმაახლებელი`

- [ ] **Step 1: repo-ს ინიციალიზაცია**

```bash
cd "/Users/giga/Library/CloudStorage/GoogleDrive-g.gabriadze@gmail.com/My Drive/4_Kedri_Street"
git init
mkdir -p tools tests apps-script js css build
```

- [ ] **Step 2: `.gitignore`-ის შექმნა**

`.gitignore`:

```
# 22 MB რასტრული რუკა — repo-ს ამძიმებს, GitHub-ს 100 MB ლიმიტი აქვს
*.png

# იმპორტის შედეგები — Sheet-ში იდება, repo-ში არა
build/

# სისტემური
.DS_Store
__pycache__/
*.pyc
```

- [ ] **Step 3: პირველი commit**

```bash
git add .gitignore
git commit -m "chore: repo-ს ჩონჩხი და .gitignore"
```

- [ ] **Step 4: `split_name`-ის დაცემული ტესტის დაწერა**

`tools/test_import.py`:

```python
# -*- coding: utf-8 -*-
import unittest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from import_lib import split_name


class TestSplitName(unittest.TestCase):
    def test_ori_sityva_gvari_pirveli(self):
        # xlsx-ში სვეტი ჰქვია „გვარი სახელი" — გვარი პირველია
        self.assertEqual(split_name(u'ბერიძე ზურაბ'), (u'ბერიძე', u'ზურაბ'))

    def test_sami_sityva_danarcheni_saxelia(self):
        self.assertEqual(
            split_name(u'ფარიდი ნადირი რეზაევი'),
            (u'ფარიდი', u'ნადირი რეზაევი'))

    def test_erti_sityva_mxolod_gvari(self):
        self.assertEqual(split_name(u'ბერიძე'), (u'ბერიძე', u''))

    def test_zedmeti_gamotoveba_irecxeba(self):
        self.assertEqual(split_name(u'  ბერიძე   ზურაბ  '), (u'ბერიძე', u'ზურაბ'))

    def test_carieli(self):
        self.assertEqual(split_name(u''), (u'', u''))
        self.assertEqual(split_name(None), (u'', u''))


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 5: ტესტის გაშვება — უნდა დაეცეს**

```bash
python3 tools/test_import.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'import_lib'`

- [ ] **Step 6: `split_name`-ის მინიმალური იმპლემენტაცია**

`tools/import_lib.py`:

```python
# -*- coding: utf-8 -*-
"""სუფთა ფუნქციები იმპორტისთვის — ფაილებს არ ეხება, ამიტომ იტესტება."""


def split_name(full):
    u"""'გვარი სახელი' -> (გვარი, სახელი). პირველი სიტყვა გვარია."""
    if not full:
        return (u'', u'')
    parts = str(full).split()
    if not parts:
        return (u'', u'')
    if len(parts) == 1:
        return (parts[0], u'')
    return (parts[0], u' '.join(parts[1:]))
```

- [ ] **Step 7: ტესტის გაშვება — უნდა გაიაროს**

```bash
python3 tools/test_import.py -v
```

Expected: PASS — 5 ტესტი

- [ ] **Step 8: commit**

```bash
git add tools/import_lib.py tools/test_import.py
git commit -m "feat: split_name — გვარისა და სახელის გაყოფა"
```

- [ ] **Step 9: `dedupe_by_cad`-ის დაცემული ტესტის დაწერა**

`tools/test_import.py`-ს დაემატოს:

```python
from import_lib import split_name, dedupe_by_cad


class TestDedupe(unittest.TestCase):
    def test_dublikati_ertdeba_da_ibechdeba(self):
        rows = [
            {u'cad': u'99.99.99.003', u'name': u'ხარაძე ქეთევან'},
            {u'cad': u'99.99.99.002', u'name': u'ბერიძე ზურაბ'},
            {u'cad': u'99.99.99.003', u'name': u'ხარაძე ქეთევან'},
        ]
        result, dups = dedupe_by_cad(rows)
        self.assertEqual(len(result), 2)
        self.assertEqual(dups, [u'99.99.99.003'])
        self.assertEqual(result[u'99.99.99.003'][u'name'], u'ხარაძე ქეთევან')

    def test_carieli_cad_gamoiricxeba(self):
        rows = [{u'cad': u'', u'name': u'X'}, {u'cad': None, u'name': u'Y'}]
        result, dups = dedupe_by_cad(rows)
        self.assertEqual(len(result), 0)
        self.assertEqual(dups, [])

    def test_dublikatebis_gareshe(self):
        rows = [{u'cad': u'A', u'name': u'1'}, {u'cad': u'B', u'name': u'2'}]
        result, dups = dedupe_by_cad(rows)
        self.assertEqual(len(result), 2)
        self.assertEqual(dups, [])
```

- [ ] **Step 10: ტესტის გაშვება — უნდა დაეცეს**

```bash
python3 tools/test_import.py -v
```

Expected: FAIL — `ImportError: cannot import name 'dedupe_by_cad'`

- [ ] **Step 11: `dedupe_by_cad`-ის იმპლემენტაცია**

`tools/import_lib.py`-ს დაემატოს:

```python
def dedupe_by_cad(rows):
    u"""[{cad:..}] -> ({cad: row}, [გამეორებული კოდები]).

    პირველი ჩანაწერი რჩება. ცარიელი კოდი გამოირიცხება.
    """
    out = {}
    dups = []
    for row in rows:
        cad = (row.get(u'cad') or u'').strip()
        if not cad:
            continue
        if cad in out:
            if cad not in dups:
                dups.append(cad)
            continue
        out[cad] = row
    return (out, dups)
```

- [ ] **Step 12: ტესტის გაშვება — უნდა გაიაროს**

```bash
python3 tools/test_import.py -v
```

Expected: PASS — 8 ტესტი

- [ ] **Step 13: commit**

```bash
git add tools/import_lib.py tools/test_import.py
git commit -m "feat: dedupe_by_cad — დუბლიკატების გაერთიანება"
```

- [ ] **Step 14: `geometry_string`-ის დაცემული ტესტის დაწერა**

`tools/test_import.py`-ს დაემატოს:

```python
from import_lib import split_name, dedupe_by_cad, geometry_string


class TestGeometryString(unittest.TestCase):
    def test_polygon_mxolod_koordinatebs_inaxavs(self):
        feature = {
            u'geometry': {
                u'type': u'Polygon',
                u'coordinates': [[[44.72, 41.74], [44.73, 41.74],
                                  [44.73, 41.75], [44.72, 41.74]]]
            }
        }
        out = geometry_string(feature)
        self.assertTrue(out.startswith(u'[[['))
        self.assertNotIn(u'Polygon', out)
        self.assertNotIn(u' ', out)  # კომპაქტური, უჯრაში ადგილის დასაზოგად

    def test_ararsebuli_feature_carielia(self):
        self.assertEqual(geometry_string(None), u'')

    def test_ucnobi_tipi_carielia(self):
        feature = {u'geometry': {u'type': u'Point', u'coordinates': [44.7, 41.7]}}
        self.assertEqual(geometry_string(feature), u'')
```

- [ ] **Step 15: ტესტის გაშვება — უნდა დაეცეს**

```bash
python3 tools/test_import.py -v
```

Expected: FAIL — `ImportError: cannot import name 'geometry_string'`

- [ ] **Step 16: `geometry_string`-ის იმპლემენტაცია**

`tools/import_lib.py`-ს დაემატოს (ფაილის თავში `import json`):

```python
import json


def geometry_string(feature):
    u"""GeoJSON Feature -> coordinates-ის კომპაქტური JSON სტრიქონი.

    ინახება მხოლოდ coordinates, არა სრული Feature — უჯრაში ადგილის
    დასაზოგად. Polygon-ის გარდა ყველა ტიპი იგნორირდება.
    """
    if not feature:
        return u''
    geom = feature.get(u'geometry') or {}
    if geom.get(u'type') != u'Polygon':
        return u''
    coords = geom.get(u'coordinates')
    if not coords:
        return u''
    return json.dumps(coords, separators=(u',', u':'))
```

- [ ] **Step 17: ტესტის გაშვება — უნდა გაიაროს**

```bash
python3 tools/test_import.py -v
```

Expected: PASS — 11 ტესტი

- [ ] **Step 18: commit**

```bash
git add tools/import_lib.py tools/test_import.py
git commit -m "feat: geometry_string — პოლიგონის კომპაქტური სერიალიზაცია"
```

- [ ] **Step 19: იმპორტის სკრიპტის დაწერა**

`tools/import.py`:

```python
# -*- coding: utf-8 -*-
u"""ერთჯერადი იმპორტი: xlsx + geojson -> სამი CSV Google Sheet-ისთვის.

გაშვება:  python3 tools/import.py
შედეგი:   build/plots.csv, build/users.csv, build/log.csv

სკრიპტი იდემპოტენტურია — ხელახლა გაშვება იმავე შედეგს იძლევა.
"""
import csv
import io
import json
import os
import sys

import openpyxl

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from import_lib import split_name, dedupe_by_cad, geometry_string

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, u'კედრის_ქუჩა_ხელმოწერები.xlsx')
GEOJSON = os.path.join(ROOT, u'კედრის_ქუჩა_ნაკვეთები.geojson')
OUT = os.path.join(ROOT, u'build')

PLOT_HEADERS = [
    u'საკადასტრო კოდი', u'ქუჩა', u'N', u'სრული მისამართი', u'ფართობი კვ.მ',
    u'დანიშნულება', u'სახელი', u'გვარი', u'ტელეფონი', u'გრძედი', u'განედი',
    u'გეომეტრია', u'წყარო', u'შენიშვნა', u'განახლდა', u'განმაახლებელი',
]
USER_HEADERS = [
    u'მეილი', u'როლი', u'ქუჩა', u'სახელი გვარი', u'საკადასტრო კოდი',
    u'მოთხოვნის თარიღი', u'დამტკიცების თარიღი', u'დამამტკიცებელი',
]
LOG_HEADERS = [
    u'დრო', u'ვინ', u'მოქმედება', u'საკადასტრო კოდი',
    u'ველი', u'ძველი მნიშვნელობა', u'ახალი მნიშვნელობა',
]


def write_csv(path, headers, rows):
    with io.open(path, 'w', encoding='utf-8', newline='') as fh:
        writer = csv.writer(fh)
        writer.writerow(headers)
        for row in rows:
            writer.writerow(row)


def main():
    if not os.path.isdir(OUT):
        os.makedirs(OUT)

    wb = openpyxl.load_workbook(XLSX)

    plot_rows = [r for r in wb[u'ნაკვეთები'].iter_rows(min_row=2, values_only=True) if r[0]]
    sig_rows = [{u'cad': r[2], u'name': r[1]}
                for r in wb[u'ხელმოწერები'].iter_rows(min_row=2, values_only=True) if r[0]]

    sigs, dups = dedupe_by_cad(sig_rows)

    with io.open(GEOJSON, encoding='utf-8') as fh:
        geo = json.load(fh)
    geo_index = {f[u'properties'][u'cad']: f for f in geo[u'features']}

    out_rows = []
    no_geometry = []
    no_area = []
    no_street = []
    for r in plot_rows:
        cad = (r[0] or u'').strip()
        sig = sigs.get(cad)
        last, first = split_name(sig[u'name'] if sig else u'')
        geom = geometry_string(geo_index.get(cad))

        if not geom:
            no_geometry.append(cad)
        if not r[4]:
            no_area.append(cad)
        if not r[1]:
            no_street.append(cad)

        out_rows.append([
            cad,            # საკადასტრო კოდი
            r[1] or u'',    # ქუჩა
            r[2] or u'',    # N
            r[3] or u'',    # სრული მისამართი
            r[4] or u'',    # ფართობი კვ.მ
            r[5] or u'',    # დანიშნულება
            first,          # სახელი
            last,           # გვარი
            u'',            # ტელეფონი — ხელით შესავსები
            r[9] or u'',    # გრძედი
            r[10] or u'',   # განედი
            geom,           # გეომეტრია
            r[7] or u'',    # წყარო
            r[8] or u'',    # შენიშვნა
            u'',            # განახლდა
            u'',            # განმაახლებელი
        ])

    write_csv(os.path.join(OUT, u'plots.csv'), PLOT_HEADERS, out_rows)
    write_csv(os.path.join(OUT, u'users.csv'), USER_HEADERS, [])
    write_csv(os.path.join(OUT, u'log.csv'), LOG_HEADERS, [])

    with_owner = sum(1 for r in out_rows if r[7])
    print(u'--- იმპორტის რეზიუმე ---')
    print(u'ნაკვეთი:            %d' % len(out_rows))
    print(u'მფლობელით:          %d' % with_owner)
    print(u'პოლიგონით:          %d' % (len(out_rows) - len(no_geometry)))
    print(u'პოლიგონის გარეშე:   %d  %s' % (len(no_geometry), no_geometry))
    print(u'ფართობის გარეშე:    %d  %s' % (len(no_area), no_area))
    print(u'ქუჩის გარეშე:       %d  %s' % (len(no_street), no_street))
    print(u'დუბლიკატი კოდი:     %d  %s' % (len(dups), dups))
    print(u'')
    print(u'ხელით გადასამოწმებელი: სამსიტყვიანი სახელები')
    for cad, sig in sigs.items():
        if len((sig[u'name'] or u'').split()) > 2:
            print(u'   %s  %s' % (cad, sig[u'name']))
    print(u'')
    print(u'ჩაწერილია: %s' % OUT)


if __name__ == '__main__':
    main()
```

- [ ] **Step 20: იმპორტის გაშვება და რეზიუმეს გადამოწმება**

```bash
python3 tools/import.py
```

Expected — ზუსტად ეს ციფრები (მონაცემები დათვლილია):

```
ნაკვეთი:            71
მფლობელით:          71
პოლიგონით:          66
პოლიგონის გარეშე:   5   ['01.99.999.999', '99.99.99.001', '99.99.99.004', '99.99.99.005', '99.99.99.006']
ფართობის გარეშე:    1   ['01.99.999.999']
ქუჩის გარეშე:       5   ['01.99.999.999', '99.99.99.001', '99.99.99.004', '99.99.99.005', '99.99.99.006']
დუბლიკატი კოდი:     1   ['99.99.99.003']
```

**თუ ციფრები არ ემთხვევა, გააჩერე და გაარკვიე რატომ** — ეს არის ერთადერთი ადგილი, სადაც მონაცემების მთლიანობა მოწმდება.

- [ ] **Step 21: CSV-ის სისწორის შემოწმება**

```bash
head -2 build/plots.csv
wc -l build/plots.csv
```

Expected: სათაურების ხაზი + 71 ხაზი მონაცემით (სულ 72), პირველი სვეტი საკადასტრო კოდი.

- [ ] **Step 22: commit**

```bash
git add tools/import.py
git commit -m "feat: იმპორტის სკრიპტი — xlsx და geojson -> CSV"
```

---

## Task 2: სერვერის სუფთა ლოგიკა (`apps-script/lib.js`)

ეს ამოცანა წერს **ყველა გადაწყვეტილებას, რომელსაც სერვერი იღებს** — სუფთა ფუნქციებად, რომლებიც Sheet-ს და ქსელს არ ეხებიან. სწორედ ამიტომ იტესტება ლოკალურად.

**Files:**
- Create: `apps-script/lib.js`
- Test: `tests/lib.test.js`

**Interfaces:**
- Consumes: არაფერს
- Produces — ზუსტი ხელმოწერები, რომლებსაც Task 3 იყენებს:
  - `mapHeaders(headerRow: string[]) → {[key: string]: number}`
  - `normalizePhone(raw: string) → {ok: true, value: string} | {ok: false, message: string}`
  - `parseGeometry(cell: string) → number[][][] | null`
  - `isEditableField(field: string) → boolean`
  - `checkPermission(role: string, action: string) → boolean`
  - `verifyTokenClaims(claims: object, clientId: string, nowSec: number) → {ok: true, email: string} | {ok: false, error: string, message: string}`
  - `diffFields(oldRow: object, newFields: object) → {field: string, old: string, new: string}[]`

- [ ] **Step 1: `mapHeaders`-ის დაცემული ტესტის დაწერა**

`tests/lib.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const lib = require('../apps-script/lib.js');

test('mapHeaders — ქართული სათაურები გასაღებებად', () => {
  const headers = ['საკადასტრო კოდი', 'ქუჩა', 'ტელეფონი'];
  const map = lib.mapHeaders(headers);
  assert.strictEqual(map.cad, 0);
  assert.strictEqual(map.street, 1);
  assert.strictEqual(map.phone, 2);
});

test('mapHeaders — არეული თანმიმდევრობა მაინც მუშაობს', () => {
  const map = lib.mapHeaders(['ტელეფონი', 'საკადასტრო კოდი']);
  assert.strictEqual(map.phone, 0);
  assert.strictEqual(map.cad, 1);
});

test('mapHeaders — ზედმეტი გამოტოვება ირეცხება', () => {
  const map = lib.mapHeaders(['  საკადასტრო კოდი  ']);
  assert.strictEqual(map.cad, 0);
});

test('mapHeaders — ლოგის „ვინ" და მომხმარებლის „მეილი" არ ერევა', () => {
  const log = lib.mapHeaders(['დრო', 'ვინ', 'მოქმედება']);
  assert.strictEqual(log.by, 1);
  assert.strictEqual(log.email, undefined);
  const users = lib.mapHeaders(['მეილი', 'როლი']);
  assert.strictEqual(users.email, 0);
  assert.strictEqual(users.by, undefined);
});

test('mapHeaders — უცნობი სვეტი იგნორირდება, არ აგდებს შეცდომას', () => {
  const map = lib.mapHeaders(['საკადასტრო კოდი', 'რაღაც ახალი სვეტი']);
  assert.strictEqual(map.cad, 0);
  assert.strictEqual(Object.keys(map).length, 1);
});
```

- [ ] **Step 2: ტესტის გაშვება — უნდა დაეცეს**

```bash
node --test tests/*.test.js
```

Expected: FAIL — `Cannot find module '../apps-script/lib.js'`

- [ ] **Step 3: `mapHeaders`-ის იმპლემენტაცია**

`apps-script/lib.js`:

```javascript
/**
 * სუფთა ფუნქციები — Sheet-ს, ქსელს და Apps Script-ის API-ს არ ეხებიან.
 * ყველა გადაწყვეტილება აქ მიიღება, რომ ლოკალურად იტესტებოდეს.
 *
 * ფაილი მუშაობს ორივე გარემოში: Apps Script-ში (module undefined-ია,
 * ბოლო ბლოკი გამოტოვდება) და Node-ში (require-ით).
 */

/** Sheet-ის ქართული სათაური -> კოდის გასაღები. */
const HEADER_MAP = {
  'საკადასტრო კოდი': 'cad',
  'ქუჩა': 'street',
  'N': 'num',
  'სრული მისამართი': 'address',
  'ფართობი კვ.მ': 'area',
  'დანიშნულება': 'purpose',
  'სახელი': 'first_name',
  'გვარი': 'last_name',
  'ტელეფონი': 'phone',
  'გრძედი': 'lon',
  'განედი': 'lat',
  'გეომეტრია': 'geometry',
  'წყარო': 'source',
  'შენიშვნა': 'note',
  'განახლდა': 'updated_at',
  'განმაახლებელი': 'updated_by',
  // მომხმარებლები
  'მეილი': 'email',
  'როლი': 'role',
  'სახელი გვარი': 'display_name',
  'მოთხოვნის თარიღი': 'requested_at',
  'დამტკიცების თარიღი': 'approved_at',
  'დამამტკიცებელი': 'approved_by',
  // ლოგი
  'დრო': 'at',
  'ვინ': 'by',
  'მოქმედება': 'action',
  'ველი': 'field',
  'ძველი მნიშვნელობა': 'old',
  'ახალი მნიშვნელობა': 'new',
};

/**
 * სათაურების რიგი -> {გასაღები: სვეტის ინდექსი}.
 * ძებნა სახელით ხდება, არა პოზიციით — სვეტების გადალაგება არაფერს ტეხს.
 */
function mapHeaders(headerRow) {
  const map = {};
  for (let i = 0; i < headerRow.length; i++) {
    const raw = String(headerRow[i] == null ? '' : headerRow[i]).trim();
    const key = HEADER_MAP[raw];
    if (key) map[key] = i;
  }
  return map;
}
```

ფაილის **ბოლოში** (ყოველი ახალი ფუნქციის შემდეგ განახლდება):

```javascript
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mapHeaders };
}
```

- [ ] **Step 4: ტესტის გაშვება — უნდა გაიაროს**

```bash
node --test tests/*.test.js
```

Expected: PASS — 5 ტესტი

- [ ] **Step 5: commit**

```bash
git add apps-script/lib.js tests/lib.test.js
git commit -m "feat: mapHeaders — ქართული სათაურების მიბმა გასაღებებზე"
```

- [ ] **Step 6: `normalizePhone`-ის დაცემული ტესტის დაწერა**

`tests/lib.test.js`-ს დაემატოს:

```javascript
test('normalizePhone — ცხრანიშნა ნომერს კოდი ემატება', () => {
  assert.deepStrictEqual(lib.normalizePhone('599123456'),
    { ok: true, value: '+995599123456' });
});

test('normalizePhone — გამოტოვებები და დეფისები ირეცხება', () => {
  assert.deepStrictEqual(lib.normalizePhone('+995 599 12-34-56'),
    { ok: true, value: '+995599123456' });
});

test('normalizePhone — 995-ით დაწყებული', () => {
  assert.deepStrictEqual(lib.normalizePhone('995599123456'),
    { ok: true, value: '+995599123456' });
});

test('normalizePhone — ცარიელი დაშვებულია', () => {
  assert.deepStrictEqual(lib.normalizePhone(''), { ok: true, value: '' });
  assert.deepStrictEqual(lib.normalizePhone(null), { ok: true, value: '' });
});

test('normalizePhone — ასოები უარყოფილია', () => {
  const r = lib.normalizePhone('abc');
  assert.strictEqual(r.ok, false);
  assert.ok(r.message.length > 0);
});

test('normalizePhone — მოკლე ნომერი უარყოფილია', () => {
  assert.strictEqual(lib.normalizePhone('5991234').ok, false);
});

test('normalizePhone — გრძელი ნომერი უარყოფილია', () => {
  assert.strictEqual(lib.normalizePhone('5991234567890').ok, false);
});
```

- [ ] **Step 7: ტესტის გაშვება — უნდა დაეცეს**

```bash
node --test tests/*.test.js
```

Expected: FAIL — `lib.normalizePhone is not a function`

- [ ] **Step 8: `normalizePhone`-ის იმპლემენტაცია**

`apps-script/lib.js`-ს დაემატოს:

```javascript
/**
 * ტელეფონის ნორმალიზება +995XXXXXXXXX ფორმატში.
 * მიიღება: 599123456 | 995599123456 | +995599123456 — გამოტოვებებით,
 * დეფისებით, ფრჩხილებით. ცარიელი ველი დაშვებულია.
 */
function normalizePhone(raw) {
  if (raw == null || String(raw).trim() === '') {
    return { ok: true, value: '' };
  }
  const digits = String(raw).replace(/[\s\-()+.]/g, '');
  if (!/^[0-9]+$/.test(digits)) {
    return { ok: false, message: 'ტელეფონი მხოლოდ ციფრებს უნდა შეიცავდეს' };
  }
  let local;
  if (digits.length === 9) {
    local = digits;
  } else if (digits.length === 12 && digits.indexOf('995') === 0) {
    local = digits.slice(3);
  } else {
    return { ok: false, message: 'ნომერი უნდა იყოს 9 ციფრი, ან 995 + 9 ციფრი' };
  }
  return { ok: true, value: '+995' + local };
}
```

ბოლო ბლოკი განახლდეს: `module.exports = { mapHeaders, normalizePhone };`

- [ ] **Step 9: ტესტის გაშვება — უნდა გაიაროს**

```bash
node --test tests/*.test.js
```

Expected: PASS — 12 ტესტი

- [ ] **Step 10: commit**

```bash
git add apps-script/lib.js tests/lib.test.js
git commit -m "feat: normalizePhone — ქართული ნომრის ნორმალიზება"
```

- [ ] **Step 11: `parseGeometry`-ის დაცემული ტესტის დაწერა**

`tests/lib.test.js`-ს დაემატოს:

```javascript
test('parseGeometry — სწორი პოლიგონი', () => {
  const cell = '[[[44.72,41.74],[44.73,41.74],[44.73,41.75],[44.72,41.74]]]';
  const out = lib.parseGeometry(cell);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].length, 4);
  assert.deepStrictEqual(out[0][0], [44.72, 41.74]);
});

test('parseGeometry — ცარიელი უჯრა -> null', () => {
  assert.strictEqual(lib.parseGeometry(''), null);
  assert.strictEqual(lib.parseGeometry(null), null);
});

test('parseGeometry — დაზიანებული JSON -> null, არა გამონაკლისი', () => {
  assert.strictEqual(lib.parseGeometry('[[[44.72,'), null);
});

test('parseGeometry — არასწორი სტრუქტურა -> null', () => {
  assert.strictEqual(lib.parseGeometry('"რაღაც ტექსტი"'), null);
  assert.strictEqual(lib.parseGeometry('[]'), null);
  assert.strictEqual(lib.parseGeometry('[[[44.72,41.74]]]'), null); // 1 წერტილი
});
```

- [ ] **Step 12: ტესტის გაშვება — უნდა დაეცეს**

```bash
node --test tests/*.test.js
```

Expected: FAIL — `lib.parseGeometry is not a function`

- [ ] **Step 13: `parseGeometry`-ის იმპლემენტაცია**

`apps-script/lib.js`-ს დაემატოს:

```javascript
/**
 * უჯრის ტექსტი -> პოლიგონის კოორდინატები, ან null.
 *
 * ტოლერანტულია განზრახ: გეომეტრიას ადმინი ხელით სვამს Sheet-ში და
 * შეცდომა გარდაუვალია. დაზიანებული უჯრა ერთ ნაკვეთს მარკერზე გადაიყვანს,
 * და არ ჩამოაგდებს მთელ რუკას.
 */
function parseGeometry(cell) {
  if (cell == null || String(cell).trim() === '') return null;
  let parsed;
  try {
    parsed = JSON.parse(String(cell));
  } catch (e) {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  for (const ring of parsed) {
    if (!Array.isArray(ring) || ring.length < 3) return null;
    for (const point of ring) {
      if (!Array.isArray(point) || point.length < 2) return null;
      if (typeof point[0] !== 'number' || typeof point[1] !== 'number') return null;
    }
  }
  return parsed;
}
```

ბოლო ბლოკი: `module.exports = { mapHeaders, normalizePhone, parseGeometry };`

- [ ] **Step 14: ტესტის გაშვება — უნდა გაიაროს**

```bash
node --test tests/*.test.js
```

Expected: PASS — 16 ტესტი

- [ ] **Step 15: commit**

```bash
git add apps-script/lib.js tests/lib.test.js
git commit -m "feat: parseGeometry — ტოლერანტული პოლიგონის წაკითხვა"
```

- [ ] **Step 16: `isEditableField` და `checkPermission` — დაცემული ტესტები**

`tests/lib.test.js`-ს დაემატოს:

```javascript
test('isEditableField — თეთრი სია', () => {
  assert.strictEqual(lib.isEditableField('phone'), true);
  assert.strictEqual(lib.isEditableField('first_name'), true);
  assert.strictEqual(lib.isEditableField('note'), true);
});

test('isEditableField — გეო-ველები და გასაღები დაცულია', () => {
  assert.strictEqual(lib.isEditableField('geometry'), false);
  assert.strictEqual(lib.isEditableField('lat'), false);
  assert.strictEqual(lib.isEditableField('lon'), false);
  assert.strictEqual(lib.isEditableField('cad'), false);
});

test('isEditableField — სისტემური ველები დაცულია', () => {
  assert.strictEqual(lib.isEditableField('updated_at'), false);
  assert.strictEqual(lib.isEditableField('updated_by'), false);
});

test('isEditableField — უცნობი ველი უარყოფილია (თეთრი სია, არა შავი)', () => {
  assert.strictEqual(lib.isEditableField('რაღაც_ახალი'), false);
});

test('checkPermission — member მხოლოდ კითხულობს', () => {
  assert.strictEqual(lib.checkPermission('member', 'plots'), true);
  assert.strictEqual(lib.checkPermission('member', 'updatePlot'), false);
  assert.strictEqual(lib.checkPermission('member', 'setRole'), false);
});

test('checkPermission — moderator რედაქტირებს, ადმინობს ვერა', () => {
  assert.strictEqual(lib.checkPermission('moderator', 'updatePlot'), true);
  assert.strictEqual(lib.checkPermission('moderator', 'setRole'), false);
  assert.strictEqual(lib.checkPermission('moderator', 'logs'), false);
});

test('checkPermission — admin ყველაფერს', () => {
  assert.strictEqual(lib.checkPermission('admin', 'updatePlot'), true);
  assert.strictEqual(lib.checkPermission('admin', 'setRole'), true);
  assert.strictEqual(lib.checkPermission('admin', 'logs'), true);
});

test('checkPermission — pending და blocked ვერაფერს', () => {
  assert.strictEqual(lib.checkPermission('pending', 'plots'), false);
  assert.strictEqual(lib.checkPermission('blocked', 'plots'), false);
  assert.strictEqual(lib.checkPermission('', 'plots'), false);
});
```

- [ ] **Step 17: ტესტის გაშვება — უნდა დაეცეს**

```bash
node --test tests/*.test.js
```

Expected: FAIL — `lib.isEditableField is not a function`

- [ ] **Step 18: იმპლემენტაცია**

`apps-script/lib.js`-ს დაემატოს:

```javascript
/** რედაქტირებადი ველების თეთრი სია. სიის გარეთ ყველაფერი აკრძალულია. */
const EDITABLE_FIELDS = [
  'first_name', 'last_name', 'phone', 'street',
  'num', 'address', 'area', 'purpose', 'note',
];

function isEditableField(field) {
  return EDITABLE_FIELDS.indexOf(field) !== -1;
}

/** მოქმედება -> როლები, რომლებსაც უფლება აქვთ. */
const PERMISSIONS = {
  me: ['member', 'moderator', 'admin'],
  plots: ['member', 'moderator', 'admin'],
  updatePlot: ['moderator', 'admin'],
  users: ['admin'],
  setRole: ['admin'],
  logs: ['admin'],
};

function checkPermission(role, action) {
  const allowed = PERMISSIONS[action];
  if (!allowed) return false;
  return allowed.indexOf(role) !== -1;
}
```

ბოლო ბლოკი: `module.exports = { mapHeaders, normalizePhone, parseGeometry, isEditableField, checkPermission };`

- [ ] **Step 19: ტესტის გაშვება — უნდა გაიაროს**

```bash
node --test tests/*.test.js
```

Expected: PASS — 24 ტესტი

- [ ] **Step 20: commit**

```bash
git add apps-script/lib.js tests/lib.test.js
git commit -m "feat: უფლებების და რედაქტირებადი ველების შემოწმება"
```

- [ ] **Step 21: `verifyTokenClaims` — დაცემული ტესტები**

ეს არის **მთელი უსაფრთხოების საყრდენი ფუნქცია.** ქსელური გამოძახებისგან განცალკევებულია სწორედ იმისთვის, რომ იტესტებოდეს.

`tests/lib.test.js`-ს დაემატოს:

```javascript
const CID = '123456789-abc.apps.googleusercontent.com';
const NOW = 1800000000;

function claims(extra) {
  return Object.assign({
    aud: CID,
    iss: 'https://accounts.google.com',
    email: 'Neighbor@Gmail.com',
    email_verified: 'true',
    exp: String(NOW + 3600),
  }, extra || {});
}

test('verifyTokenClaims — სწორი ტოკენი, მეილი lowercase-ში', () => {
  const r = lib.verifyTokenClaims(claims(), CID, NOW);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.email, 'neighbor@gmail.com');
});

test('verifyTokenClaims — სხვისი aud უარყოფილია', () => {
  const r = lib.verifyTokenClaims(claims({ aud: 'სხვა-აპლიკაცია' }), CID, NOW);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'UNAUTHENTICATED');
});

test('verifyTokenClaims — არასწორი iss უარყოფილია', () => {
  const r = lib.verifyTokenClaims(claims({ iss: 'evil.example.com' }), CID, NOW);
  assert.strictEqual(r.ok, false);
});

test('verifyTokenClaims — accounts.google.com სქემის გარეშეც ვარგისია', () => {
  const r = lib.verifyTokenClaims(claims({ iss: 'accounts.google.com' }), CID, NOW);
  assert.strictEqual(r.ok, true);
});

test('verifyTokenClaims — დაუდასტურებელი მეილი უარყოფილია', () => {
  const r = lib.verifyTokenClaims(claims({ email_verified: 'false' }), CID, NOW);
  assert.strictEqual(r.ok, false);
});

test('verifyTokenClaims — გასული ტოკენი უარყოფილია', () => {
  const r = lib.verifyTokenClaims(claims({ exp: String(NOW - 1) }), CID, NOW);
  assert.strictEqual(r.ok, false);
});

test('verifyTokenClaims — მეილის გარეშე უარყოფილია', () => {
  const r = lib.verifyTokenClaims(claims({ email: '' }), CID, NOW);
  assert.strictEqual(r.ok, false);
});

test('verifyTokenClaims — ცარიელი claims უარყოფილია', () => {
  assert.strictEqual(lib.verifyTokenClaims(null, CID, NOW).ok, false);
  assert.strictEqual(lib.verifyTokenClaims({}, CID, NOW).ok, false);
});
```

- [ ] **Step 22: ტესტის გაშვება — უნდა დაეცეს**

```bash
node --test tests/*.test.js
```

Expected: FAIL — `lib.verifyTokenClaims is not a function`

- [ ] **Step 23: `verifyTokenClaims`-ის იმპლემენტაცია**

`apps-script/lib.js`-ს დაემატოს:

```javascript
const VALID_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

/**
 * Google-ის tokeninfo-ს პასუხის შემოწმება.
 *
 * `aud`-ის შემოწმება კრიტიკულია: მის გარეშე ნებისმიერი Google აპლიკაციის
 * ტოკენი მიიღებოდა და ბაზა ღია იქნებოდა. ხელმოწერას და ვადას tokeninfo
 * უკვე ამოწმებს, მაგრამ `exp` აქაც მოწმდება ქეშირების გამო.
 */
function verifyTokenClaims(claims, clientId, nowSec) {
  const bad = function (message) {
    return { ok: false, error: 'UNAUTHENTICATED', message: message };
  };
  if (!claims || typeof claims !== 'object') return bad('ტოკენი არასწორია');
  if (claims.aud !== clientId) return bad('ტოკენი სხვა აპლიკაციისაა');
  if (VALID_ISSUERS.indexOf(String(claims.iss)) === -1) return bad('ტოკენის წყარო არასწორია');
  if (String(claims.email_verified) !== 'true') return bad('მეილი დადასტურებული არაა');
  const email = String(claims.email || '').trim().toLowerCase();
  if (!email) return bad('ტოკენში მეილი არ არის');
  if (!(Number(claims.exp) > nowSec)) return bad('ტოკენს ვადა გაუვიდა');
  return { ok: true, email: email };
}
```

ბოლო ბლოკს დაემატოს `verifyTokenClaims`.

- [ ] **Step 24: ტესტის გაშვება — უნდა გაიაროს**

```bash
node --test tests/*.test.js
```

Expected: PASS — 32 ტესტი

- [ ] **Step 25: commit**

```bash
git add apps-script/lib.js tests/lib.test.js
git commit -m "feat: verifyTokenClaims — ID token-ის შემოწმება aud-ის ჩათვლით"
```

- [ ] **Step 26: `diffFields` — დაცემული ტესტები**

`tests/lib.test.js`-ს დაემატოს:

```javascript
test('diffFields — მხოლოდ შეცვლილი ველები', () => {
  const oldRow = { phone: '+995599111111', first_name: 'ზურაბ' };
  const out = lib.diffFields(oldRow, { phone: '+995599222222', first_name: 'ზურაბ' });
  assert.strictEqual(out.length, 1);
  assert.deepStrictEqual(out[0], {
    field: 'phone', old: '+995599111111', new: '+995599222222',
  });
});

test('diffFields — უცვლელი ველი არ იწერება', () => {
  const out = lib.diffFields({ phone: 'X' }, { phone: 'X' });
  assert.strictEqual(out.length, 0);
});

test('diffFields — ცარიელიდან შევსებამდე ჩაიწერება', () => {
  const out = lib.diffFields({ phone: '' }, { phone: '+995599111111' });
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].old, '');
});

test('diffFields — რიცხვი და ტექსტი ერთნაირად ედრება', () => {
  const out = lib.diffFields({ area: 599 }, { area: '599' });
  assert.strictEqual(out.length, 0);
});
```

- [ ] **Step 27: ტესტის გაშვება — უნდა დაეცეს**

```bash
node --test tests/*.test.js
```

Expected: FAIL — `lib.diffFields is not a function`

- [ ] **Step 28: `diffFields`-ის იმპლემენტაცია**

`apps-script/lib.js`-ს დაემატოს:

```javascript
/**
 * ძველი რიგი და ახალი ველები -> ლოგისთვის ცვლილებების სია.
 * უცვლელი ველი არ იწერება — ლოგი მხოლოდ რეალურ ცვლილებას ინახავს.
 */
function diffFields(oldRow, newFields) {
  const out = [];
  for (const field in newFields) {
    if (!Object.prototype.hasOwnProperty.call(newFields, field)) continue;
    const before = oldRow[field] == null ? '' : String(oldRow[field]);
    const after = newFields[field] == null ? '' : String(newFields[field]);
    if (before !== after) {
      out.push({ field: field, old: before, new: after });
    }
  }
  return out;
}
```

ბოლო ბლოკი საბოლოო სახით:

```javascript
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    mapHeaders, normalizePhone, parseGeometry,
    isEditableField, checkPermission, verifyTokenClaims, diffFields,
  };
}
```

- [ ] **Step 29: ყველა ტესტის გაშვება**

```bash
node --test tests/*.test.js
```

Expected: PASS — 36 ტესტი, 0 failed

- [ ] **Step 30: commit**

```bash
git add apps-script/lib.js tests/lib.test.js
git commit -m "feat: diffFields — ლოგისთვის ცვლილებების გამოთვლა"
```

---

## Task 3: სერვერი (`apps-script/Code.js`) და მისი განთავსება

**Files:**
- Create: `apps-script/Code.js`
- Create: `docs/setup.md`

**Interfaces:**
- Consumes: `apps-script/lib.js`-ის ყველა ფუნქცია (Task 2)
- Produces: განთავსებული Web App URL, რომელსაც Task 4 იყენებს `js/config.js`-ში. პასუხის ფორმატი: `{ok:true,data:…}` / `{ok:false,error,message}`

**შენიშვნა ტესტირებაზე:** `Code.js` Sheet-სა და ქსელს ეხება, ამიტომ Node-ით ვერ იტესტება. მისი გადამოწმება ხდება (ა) Apps Script-ის რედაქტორში `smokeTest()`-ის გაშვებით, (ბ) განთავსებული endpoint-ის `curl`-ით შემოწმებით. ყველა ლოგიკა, რაც იტესტება, Task 2-შია.

- [ ] **Step 1: Google Sheet-ის შექმნა და მონაცემების ჩასმა**

1. Google Drive → New → Google Sheets. სახელი: `კედრის უბანი — ბაზა`
2. სამი ფურცელი შეიქმნას ზუსტად ამ სახელებით: `ნაკვეთები`, `მომხმარებლები`, `ლოგი`
3. `build/plots.csv` → File → Import → Replace current sheet → ფურცელი `ნაკვეთები`
4. `build/users.csv` → იგივე, ფურცელი `მომხმარებლები`
5. `build/log.csv` → იგივე, ფურცელი `ლოგი`
6. **გაზიარება: არავისთვის.** არც „Publish to web", არც ბმულით წვდომა.
7. `მომხმარებლები` ფურცელში ხელით ჩაიწეროს პირველი რიგი:

| მეილი | როლი | ქუჩა | სახელი გვარი | საკადასტრო კოდი | მოთხოვნის თარიღი | დამტკიცების თარიღი | დამამტკიცებელი |
|---|---|---|---|---|---|---|---|
| `g.gabriadze@gmail.com` | `admin` | | გიგა გაბრიაძე | | | | |

**ამის გარეშე ადმინი არავინ იქნება და სისტემაში ვერავინ შევა.**

- [ ] **Step 2: Google Cloud პროექტი და OAuth Client ID**

1. https://console.cloud.google.com → New Project → `kedris-ubani`
2. APIs & Services → OAuth consent screen → External → აპლიკაციის სახელი `კედრის უბანი`, support email, developer email → Save
3. Audience → Publish app (თუ Testing-ში დარჩა, მხოლოდ ხელით დამატებული 100 მომხმარებელი შეძლებს შესვლას)
4. Credentials → Create Credentials → OAuth client ID → Web application
5. **Authorized JavaScript origins:**
   - `https://<შენი-github-username>.github.io`
   - `http://localhost:8080` (ლოკალური ტესტირებისთვის; პროდაქშენში წაიშლება)
6. Client ID დაკოპირდეს — ის საჯაროა და კოდში იწერება

- [ ] **Step 3: `apps-script/Code.js`-ის დაწერა**

```javascript
/**
 * კედრის უბანი — სერვერი.
 *
 * განთავსება: Deploy → Web app → Execute as: Me → Who has access: Anyone.
 * უსაფრთხოებას ტოკენის შემოწმება უზრუნველყოფს, არა წვდომის პარამეტრი.
 * Sheet პირადი რჩება — მასთან წვდომა მხოლოდ ამ სკრიპტს აქვს.
 */

const CLIENT_ID = 'ჩასვი-შენი-client-id.apps.googleusercontent.com';
const ADMIN_EMAIL = 'g.gabriadze@gmail.com';

const SHEET_PLOTS = 'ნაკვეთები';
const SHEET_USERS = 'მომხმარებლები';
const SHEET_LOG = 'ლოგი';

const RATE_LIMIT_PER_MINUTE = 60;
const TOKEN_CACHE_SECONDS = 300;
const LOCK_WAIT_MS = 10000;

// ── პასუხის helper-ები ──────────────────────────────────────────────

function ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function err(code, message) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: code, message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── შესასვლელი ──────────────────────────────────────────────────────

function doPost(e) {
  try {
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return err('VALIDATION', 'მოთხოვნის ფორმატი არასწორია');
    }

    const auth = verifyToken(body.idToken);
    if (!auth.ok) return err(auth.error, auth.message);

    if (!allowRequest(auth.email)) {
      return err('RATE_LIMIT', 'ძალიან ბევრი მოთხოვნა, დაელოდეთ ერთი წუთი');
    }

    const user = findUser(auth.email);
    const action = String(body.action || '');
    const payload = body.payload || {};

    if (action === 'requestAccess') return handleRequestAccess(auth.email, user);

    if (!user) return err('PENDING', 'თქვენი მოთხოვნა ჯერ არ გაგზავნილა');
    if (user.role === 'pending') return err('PENDING', 'თქვენი მოთხოვნა დამტკიცების პროცესშია');
    if (user.role === 'blocked') return err('BLOCKED', 'წვდომა შეზღუდულია');

    if (!Lib_checkPermission(user.role, action)) {
      return err('FORBIDDEN', 'ამ მოქმედების უფლება არ გაქვთ');
    }

    switch (action) {
      case 'me': return ok(user);
      case 'plots': return ok(readPlots());
      case 'updatePlot': return handleUpdatePlot(user, payload);
      case 'users': return ok(readUsers());
      case 'setRole': return handleSetRole(user, payload);
      case 'logs': return ok(readLogs(Number(payload.limit) || 200));
      default: return err('VALIDATION', 'უცნობი მოქმედება');
    }
  } catch (fatal) {
    console.error(fatal);
    return err('SERVER', 'სისტემური შეცდომა');
  }
}

function doGet() {
  return ContentService.createTextOutput('კედრის უბანი — API. მოთხოვნები POST-ით მიიღება.');
}

// ── ავტორიზაცია ─────────────────────────────────────────────────────

/**
 * ID token -> {ok, email}. შედეგი ქეშირდება 5 წუთით.
 * ქეშის გასაღები ტოკენის hash-ია, არა თავად ტოკენი.
 */
function verifyToken(idToken) {
  if (!idToken) return { ok: false, error: 'UNAUTHENTICATED', message: 'გთხოვთ შეხვიდეთ Google-ით' };

  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, String(idToken));
  const key = 'tok_' + Utilities.base64Encode(digest);

  const cache = CacheService.getScriptCache();
  const cached = cache.get(key);
  if (cached) return { ok: true, email: cached };

  let claims;
  try {
    const response = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
      { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
      return { ok: false, error: 'UNAUTHENTICATED', message: 'ტოკენი არასწორია' };
    }
    claims = JSON.parse(response.getContentText());
  } catch (fetchError) {
    return { ok: false, error: 'SERVER', message: 'ავტორიზაცია ვერ შემოწმდა' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const result = Lib_verifyTokenClaims(claims, CLIENT_ID, nowSec);
  if (!result.ok) return result;

  cache.put(key, result.email, TOKEN_CACHE_SECONDS);
  return result;
}

/** მრიცხველი წუთზე. ერთდროულობა აქ კრიტიკული არაა. */
function allowRequest(email) {
  const cache = CacheService.getScriptCache();
  const key = 'rate_' + email + '_' + Math.floor(Date.now() / 60000);
  const current = Number(cache.get(key) || 0);
  if (current >= RATE_LIMIT_PER_MINUTE) return false;
  cache.put(key, String(current + 1), 120);
  return true;
}

// ── Sheet-თან წვდომა ────────────────────────────────────────────────

function sheetRows(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('ფურცელი ვერ მოიძებნა: ' + name);
  const values = sheet.getDataRange().getValues();
  if (values.length === 0) return { sheet: sheet, map: {}, rows: [] };
  return { sheet: sheet, map: Lib_mapHeaders(values[0]), rows: values.slice(1) };
}

function rowToObject(row, map) {
  const out = {};
  for (const key in map) {
    const value = row[map[key]];
    out[key] = value == null ? '' : value;
  }
  return out;
}

function readPlots() {
  const data = sheetRows(SHEET_PLOTS);
  return data.rows
    .filter(function (row) { return String(row[data.map.cad] || '').trim() !== ''; })
    .map(function (row) {
      const plot = rowToObject(row, data.map);
      plot.cad = String(plot.cad).trim();
      plot.updated_at = String(plot.updated_at || '');
      plot.geometry = Lib_parseGeometry(plot.geometry);
      plot.lat = plot.lat === '' ? null : Number(plot.lat);
      plot.lon = plot.lon === '' ? null : Number(plot.lon);
      return plot;
    });
}

function readUsers() {
  const data = sheetRows(SHEET_USERS);
  return data.rows
    .filter(function (row) { return String(row[data.map.email] || '').trim() !== ''; })
    .map(function (row) { return rowToObject(row, data.map); });
}

function findUser(email) {
  const users = readUsers();
  for (const user of users) {
    if (String(user.email).trim().toLowerCase() === email) {
      user.email = email;
      user.role = String(user.role || '').trim();
      return user;
    }
  }
  return null;
}

function readLogs(limit) {
  const data = sheetRows(SHEET_LOG);
  return data.rows.slice(-limit).reverse()
    .map(function (row) { return rowToObject(row, data.map); });
}

function appendLog(email, action, cad, changes) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
  const now = new Date().toISOString();
  const rows = changes.map(function (change) {
    return [now, email, action, cad, change.field, change.old, change.new];
  });
  if (rows.length === 0) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
}

// ── მოქმედებები ─────────────────────────────────────────────────────

function handleRequestAccess(email, existingUser) {
  if (existingUser) {
    if (existingUser.role === 'pending') {
      return err('PENDING', 'თქვენი მოთხოვნა დამტკიცების პროცესშია');
    }
    return ok(existingUser);
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) return err('SERVER', 'სისტემა დაკავებულია, სცადეთ ხელახლა');
  try {
    if (findUser(email)) return err('PENDING', 'თქვენი მოთხოვნა დამტკიცების პროცესშია');

    const data = sheetRows(SHEET_USERS);
    const row = new Array(Object.keys(data.map).length).fill('');
    row[data.map.email] = email;
    row[data.map.role] = 'pending';
    row[data.map.requested_at] = new Date().toISOString();
    data.sheet.appendRow(row);

    try {
      MailApp.sendEmail(ADMIN_EMAIL, 'კედრის უბანი — ახალი მოთხოვნა',
        email + ' ითხოვს წვდომას. დაამტკიცეთ ადმინის გვერდიდან.');
    } catch (mailError) {
      console.error('მეილი ვერ გაიგზავნა: ' + mailError);
    }
  } finally {
    lock.releaseLock();
  }
  return err('PENDING', 'მოთხოვნა გაგზავნილია. ადმინი დაგიდასტურებთ.');
}

function handleUpdatePlot(user, payload) {
  const cad = String(payload.cad || '').trim();
  const fields = payload.fields || {};
  const expected = payload.expected_updated_at;

  if (!cad) return err('VALIDATION', 'საკადასტრო კოდი არ არის მითითებული');
  if (typeof expected !== 'string') {
    return err('VALIDATION', 'expected_updated_at სავალდებულოა (ცარიელი ჩანაწერისთვის "")');
  }

  const clean = {};
  for (const field in fields) {
    if (!Object.prototype.hasOwnProperty.call(fields, field)) continue;
    if (!Lib_isEditableField(field)) {
      return err('FORBIDDEN', 'ველი არ ექვემდებარება რედაქტირებას: ' + field);
    }
    if (field === 'phone') {
      const phone = Lib_normalizePhone(fields[field]);
      if (!phone.ok) return err('VALIDATION', phone.message);
      clean[field] = phone.value;
    } else {
      clean[field] = String(fields[field] == null ? '' : fields[field]).trim().slice(0, 200);
    }
  }
  if (Object.keys(clean).length === 0) return err('VALIDATION', 'შესაცვლელი ველი არ არის');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) return err('SERVER', 'სისტემა დაკავებულია, სცადეთ ხელახლა');
  try {
    const data = sheetRows(SHEET_PLOTS);
    let index = -1;
    for (let i = 0; i < data.rows.length; i++) {
      if (String(data.rows[i][data.map.cad]).trim() === cad) { index = i; break; }
    }
    if (index === -1) return err('NOT_FOUND', 'ნაკვეთი ვერ მოიძებნა');

    const row = data.rows[index];
    const current = String(row[data.map.updated_at] || '');
    if (current !== expected) {
      return err('CONFLICT', 'ჩანაწერი სხვამ შეცვალა, გადატვირთეთ გვერდი');
    }

    const before = rowToObject(row, data.map);
    const changes = Lib_diffFields(before, clean);
    if (changes.length === 0) return ok({ cad: cad, updated_at: current, changed: 0 });

    for (const field in clean) {
      if (data.map[field] === undefined) {
        return err('VALIDATION', 'Sheet-ში ასეთი სვეტი არ არის: ' + field);
      }
    }

    const now = new Date().toISOString();
    const sheetRow = index + 2; // +1 სათაური, +1 ერთიდან ათვლა
    for (const field in clean) {
      data.sheet.getRange(sheetRow, data.map[field] + 1).setValue(clean[field]);
    }
    data.sheet.getRange(sheetRow, data.map.updated_at + 1).setValue(now);
    data.sheet.getRange(sheetRow, data.map.updated_by + 1).setValue(user.email);

    appendLog(user.email, 'update', cad, changes);
    return ok({ cad: cad, updated_at: now, changed: changes.length });
  } finally {
    lock.releaseLock();
  }
}

function handleSetRole(admin, payload) {
  const email = String(payload.email || '').trim().toLowerCase();
  const role = String(payload.role || '').trim();
  const street = String(payload.street || '').trim();

  const allowed = ['admin', 'moderator', 'member', 'pending', 'blocked'];
  if (allowed.indexOf(role) === -1) return err('VALIDATION', 'უცნობი როლი');
  if (!email) return err('VALIDATION', 'მეილი არ არის მითითებული');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) return err('SERVER', 'სისტემა დაკავებულია, სცადეთ ხელახლა');
  try {
    const data = sheetRows(SHEET_USERS);
    let index = -1;
    for (let i = 0; i < data.rows.length; i++) {
      if (String(data.rows[i][data.map.email]).trim().toLowerCase() === email) { index = i; break; }
    }
    if (index === -1) return err('NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა');

    const before = rowToObject(data.rows[index], data.map);
    if (before.role === 'admin' && role !== 'admin') {
      let admins = 0;
      for (const row of data.rows) {
        if (String(row[data.map.role]).trim() === 'admin') admins++;
      }
      if (admins <= 1) return err('FORBIDDEN', 'ბოლო ადმინის როლი ვერ შეიცვლება');
      if (email === admin.email) return err('FORBIDDEN', 'საკუთარი როლის დაქვეითება არ შეიძლება');
    }

    const sheetRow = index + 2;
    data.sheet.getRange(sheetRow, data.map.role + 1).setValue(role);
    data.sheet.getRange(sheetRow, data.map.street + 1).setValue(street);
    data.sheet.getRange(sheetRow, data.map.approved_at + 1).setValue(new Date().toISOString());
    data.sheet.getRange(sheetRow, data.map.approved_by + 1).setValue(admin.email);

    appendLog(admin.email, 'role_change', email,
      [{ field: 'role', old: before.role, new: role }]);
    return ok({ email: email, role: role, street: street });
  } finally {
    lock.releaseLock();
  }
}

// ── smoke test — რედაქტორიდან ხელით გასაშვები ───────────────────────

function smokeTest() {
  const plots = readPlots();
  console.log('ნაკვეთი: ' + plots.length);
  console.log('პოლიგონით: ' + plots.filter(function (p) { return p.geometry; }).length);
  console.log('კოორდინატით: ' + plots.filter(function (p) { return p.lat; }).length);
  console.log('პირველი: ' + JSON.stringify(plots[0]).slice(0, 200));

  const users = readUsers();
  console.log('მომხმარებელი: ' + users.length);
  const admin = findUser(ADMIN_EMAIL);
  console.log('ადმინი ნაპოვნია: ' + (admin ? admin.role : 'არა — შეავსე მომხმარებლები!'));

  if (CLIENT_ID.indexOf('ჩასვი') === 0) {
    throw new Error('CLIENT_ID ჯერ არ ჩასმულა');
  }
  console.log('smokeTest დასრულდა');
}
```

- [ ] **Step 4: `lib.js`-ის ფუნქციების პრეფიქსით გადმოტანა**

Apps Script-ს მოდულები არ აქვს — ყველა ფაილი ერთ სივრცეშია. კონფლიქტის თავიდან ასაცილებლად `lib.js`-ის ფუნქციები Apps Script-ში `Lib_` პრეფიქსით უნდა გამოიძახებოდეს.

Apps Script-ის რედაქტორში შეიქმნას ფაილი `lib.gs` და ჩაისვას `apps-script/lib.js`-ის შიგთავსი, ბოლოში დამატებით:

```javascript
// Apps Script-ის ერთიან სივრცეში სახელების გამიჯვნა
const Lib_mapHeaders = mapHeaders;
const Lib_normalizePhone = normalizePhone;
const Lib_parseGeometry = parseGeometry;
const Lib_isEditableField = isEditableField;
const Lib_checkPermission = checkPermission;
const Lib_verifyTokenClaims = verifyTokenClaims;
const Lib_diffFields = diffFields;
```

- [ ] **Step 5: Apps Script პროექტის შექმნა და კოდის ჩასმა**

1. Sheet-ში: Extensions → Apps Script
2. `Code.gs` ფაილში ჩაისვას `apps-script/Code.js`-ის შიგთავსი
3. `CLIENT_ID` შეივსოს Step 2-ის მნიშვნელობით
4. ახალი ფაილი `lib.gs` — Step 4-ის მიხედვით
5. Save

- [ ] **Step 6: `smokeTest`-ის გაშვება რედაქტორიდან**

Apps Script-ის რედაქტორში: ფუნქციის ჩამონათვალიდან `smokeTest` → Run. პირველ ჯერზე მოითხოვს ავტორიზაციას — დაეთანხმე.

Expected (Execution log):

```
ნაკვეთი: 71
პოლიგონით: 66
კოორდინატით: 66
პირველი: {"cad":"01.99.99.999.001",...}
მომხმარებელი: 1
ადმინი ნაპოვნია: admin
smokeTest დასრულდა
```

**თუ „ადმინი ნაპოვნია: არა" — დაბრუნდი Step 1-ის მე-7 პუნქტზე.**

- [ ] **Step 7: განთავსება**

Deploy → New deployment → Type: **Web app**
- Description: `v1`
- Execute as: **Me**
- Who has access: **Anyone**

Deploy → Web app URL დაკოპირდეს (`https://script.google.com/macros/s/…/exec`).

- [ ] **Step 8: endpoint-ის შემოწმება `curl`-ით**

არასწორი ტოკენით — უნდა დაბრუნდეს `UNAUTHENTICATED`. ეს ამტკიცებს, რომ მარშრუტიზაცია და ტოკენის შემოწმება მუშაობს, რეალური ტოკენის გარეშე:

```bash
curl -sL -X POST "<WEB_APP_URL>" \
  -H 'Content-Type: text/plain;charset=utf-8' \
  -d '{"idToken":"არასწორი","action":"plots"}'
```

Expected:

```json
{"ok":false,"error":"UNAUTHENTICATED","message":"ტოკენი არასწორია"}
```

ტოკენის გარეშე:

```bash
curl -sL -X POST "<WEB_APP_URL>" \
  -H 'Content-Type: text/plain;charset=utf-8' \
  -d '{"action":"plots"}'
```

Expected: `{"ok":false,"error":"UNAUTHENTICATED","message":"გთხოვთ შეხვიდეთ Google-ით"}`

**თუ HTML ბრუნდება JSON-ის ნაცვლად** — განთავსება „Anyone"-ზე არ არის დაყენებული.

- [ ] **Step 9: `docs/setup.md`-ის დაწერა**

ფაილში ჩაიწეროს Step 1, 2, 5, 7-ის ნაბიჯები, რომ განმეორებადი იყოს, პლუს:
- Web App URL
- Client ID
- შენიშვნა: **კოდის ცვლილების შემდეგ საჭიროა Deploy → Manage deployments → Edit → New version.** მხოლოდ Save საკმარისი არაა — ეს ყველაზე ხშირი შეცდომაა.

- [ ] **Step 10: commit**

```bash
git add apps-script/Code.js docs/setup.md
git commit -m "feat: Apps Script სერვერი — ავტორიზაცია, ნაკვეთები, როლები, ლოგი"
```

---

## Task 4: ფრონტენდის სუფთა ლოგიკა (`js/lib.js`)

ფილტრი, სორტირება, ფორმატირება — ყველაფერი, რაც DOM-ს არ ეხება და ამიტომ იტესტება.

**Files:**
- Create: `js/lib.js`
- Test: `tests/weblib.test.js`

**Interfaces:**
- Consumes: არაფერს
- Produces — გლობალური ობიექტი `WebLib` ბრაუზერში, `module.exports` Node-ში:
  - `fullName(plot) → string`
  - `mapStatus(plot) → 'polygon' | 'marker' | 'missing'`
  - `streetList(plots) → string[]`
  - `filterPlots(plots, {query, street}) → plot[]`
  - `sortPlots(plots, key, direction) → plot[]`

- [ ] **Step 1: დაცემული ტესტების დაწერა**

`tests/weblib.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const WebLib = require('../js/lib.js');

const PLOTS = [
  { cad: 'A', street: 'კედრის ქუჩა', num: '1', address: 'კედრის ქუჩა N1',
    first_name: 'ზურაბ', last_name: 'ბერიძე', phone: '+995599111111',
    area: 599, geometry: [[[44.7, 41.7], [44.7, 41.8], [44.8, 41.8], [44.7, 41.7]]],
    lat: 41.7, lon: 44.7 },
  { cad: 'B', street: 'კედრის I ჩიხი', num: '2', address: 'კედრის I ჩიხი N2',
    first_name: 'ელენე', last_name: 'კაპანაძე', phone: '',
    area: 300, geometry: null, lat: 41.75, lon: 44.72 },
  { cad: 'C', street: '', num: '', address: '',
    first_name: '', last_name: '', phone: '',
    area: '', geometry: null, lat: null, lon: null },
];

test('fullName — გვარი და სახელი', () => {
  assert.strictEqual(WebLib.fullName(PLOTS[0]), 'ბერიძე ზურაბ');
});

test('fullName — ცარიელი -> ტირე', () => {
  assert.strictEqual(WebLib.fullName(PLOTS[2]), '—');
});

test('mapStatus — პოლიგონი, მარკერი, არცერთი', () => {
  assert.strictEqual(WebLib.mapStatus(PLOTS[0]), 'polygon');
  assert.strictEqual(WebLib.mapStatus(PLOTS[1]), 'marker');
  assert.strictEqual(WebLib.mapStatus(PLOTS[2]), 'missing');
});

test('streetList — უნიკალური, დალაგებული, ცარიელის გარეშე', () => {
  assert.deepStrictEqual(WebLib.streetList(PLOTS),
    ['კედრის I ჩიხი', 'კედრის ქუჩა']);
});

test('filterPlots — ძებნა სახელით', () => {
  const out = WebLib.filterPlots(PLOTS, { query: 'ბერიძე', street: '' });
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].cad, 'A');
});

test('filterPlots — ძებნა საკადასტრო კოდით', () => {
  const out = WebLib.filterPlots(PLOTS, { query: 'B', street: '' });
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].cad, 'B');
});

test('filterPlots — ძებნა რეგისტრს არ ითვალისწინებს', () => {
  const out = WebLib.filterPlots(PLOTS, { query: 'b', street: '' });
  assert.strictEqual(out.length, 1);
});

test('filterPlots — ქუჩის ფილტრი', () => {
  const out = WebLib.filterPlots(PLOTS, { query: '', street: 'კედრის ქუჩა' });
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].cad, 'A');
});

test('filterPlots — ძებნა და ფილტრი ერთად', () => {
  const out = WebLib.filterPlots(PLOTS, { query: 'ელენე', street: 'კედრის ქუჩა' });
  assert.strictEqual(out.length, 0);
});

test('filterPlots — ცარიელი ფილტრი ყველას აბრუნებს', () => {
  assert.strictEqual(WebLib.filterPlots(PLOTS, { query: '', street: '' }).length, 3);
});

test('sortPlots — ფართობით ზრდადობით, ცარიელი ბოლოში', () => {
  const out = WebLib.sortPlots(PLOTS, 'area', 'asc');
  assert.deepStrictEqual(out.map((p) => p.cad), ['B', 'A', 'C']);
});

test('sortPlots — ფართობით კლებადობით, ცარიელი ისევ ბოლოში', () => {
  const out = WebLib.sortPlots(PLOTS, 'area', 'desc');
  assert.deepStrictEqual(out.map((p) => p.cad), ['A', 'B', 'C']);
});

test('sortPlots — ორიგინალი მასივი არ იცვლება', () => {
  const before = PLOTS.map((p) => p.cad).join(',');
  WebLib.sortPlots(PLOTS, 'area', 'desc');
  assert.strictEqual(PLOTS.map((p) => p.cad).join(','), before);
});
```

- [ ] **Step 2: ტესტის გაშვება — უნდა დაეცეს**

```bash
node --test tests/*.test.js
```

Expected: FAIL — `Cannot find module '../js/lib.js'`

- [ ] **Step 3: `js/lib.js`-ის იმპლემენტაცია**

```javascript
/**
 * ფრონტენდის სუფთა ლოგიკა — DOM-ს არ ეხება.
 * ბრაუზერში ხდება გლობალური `WebLib`, Node-ში იტესტება require-ით.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.WebLib = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  function fullName(plot) {
    const name = [plot.last_name, plot.first_name]
      .filter(function (part) { return part && String(part).trim(); })
      .join(' ')
      .trim();
    return name || '—';
  }

  /** რუკაზე როგორ გამოჩნდება: პოლიგონით, მარკერით, ან არანაირად. */
  function mapStatus(plot) {
    if (plot.geometry && plot.geometry.length) return 'polygon';
    if (plot.lat != null && plot.lon != null && plot.lat !== '' && plot.lon !== '') {
      return 'marker';
    }
    return 'missing';
  }

  function streetList(plots) {
    const seen = {};
    plots.forEach(function (plot) {
      const street = String(plot.street || '').trim();
      if (street) seen[street] = true;
    });
    return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b, 'ka'); });
  }

  const SEARCH_FIELDS = ['cad', 'street', 'num', 'address',
    'first_name', 'last_name', 'phone', 'purpose', 'note'];

  function filterPlots(plots, options) {
    const query = String((options && options.query) || '').trim().toLowerCase();
    const street = String((options && options.street) || '').trim();
    return plots.filter(function (plot) {
      if (street && String(plot.street || '').trim() !== street) return false;
      if (!query) return true;
      return SEARCH_FIELDS.some(function (field) {
        return String(plot[field] == null ? '' : plot[field])
          .toLowerCase().indexOf(query) !== -1;
      });
    });
  }

  /** ცარიელი მნიშვნელობა ყოველთვის ბოლოშია, მიმართულების მიუხედავად. */
  function sortPlots(plots, key, direction) {
    const sign = direction === 'desc' ? -1 : 1;
    return plots.slice().sort(function (a, b) {
      const left = a[key];
      const right = b[key];
      const leftEmpty = left == null || left === '';
      const rightEmpty = right == null || right === '';
      if (leftEmpty && rightEmpty) return 0;
      if (leftEmpty) return 1;
      if (rightEmpty) return -1;
      if (typeof left === 'number' && typeof right === 'number') {
        return (left - right) * sign;
      }
      const leftNumber = Number(left);
      const rightNumber = Number(right);
      if (!isNaN(leftNumber) && !isNaN(rightNumber)) {
        return (leftNumber - rightNumber) * sign;
      }
      return String(left).localeCompare(String(right), 'ka') * sign;
    });
  }

  return { fullName: fullName, mapStatus: mapStatus, streetList: streetList,
    filterPlots: filterPlots, sortPlots: sortPlots };
});
```

- [ ] **Step 4: ტესტის გაშვება — უნდა გაიაროს**

```bash
node --test tests/*.test.js
```

Expected: PASS — 49 ტესტი სულ (36 სერვერის + 13 ფრონტენდის)

- [ ] **Step 5: commit**

```bash
git add js/lib.js tests/weblib.test.js
git commit -m "feat: ფრონტენდის სუფთა ლოგიკა — ფილტრი, სორტირება, სტატუსი"
```

---

## Task 5: გვერდის ჩონჩხი, ავტორიზაცია და API

დელივერაბლი: ბრაუზერში იხსნება გვერდი, მომხმარებელი შედის Google-ით, და ხედავს ან თავის როლს, ან „დამტკიცების პროცესშია".

**Files:**
- Create: `index.html`, `css/style.css`, `js/config.js`, `js/api.js`, `js/auth.js`, `js/ui.js`

**Interfaces:**
- Consumes: Task 3-ის Web App URL; Task 2-ის პასუხის ფორმატი
- Produces:
  - `API.call(action, payload) → Promise<data>` — შეცდომაზე აგდებს `Error`-ს `.code` თვისებით
  - `Auth.getToken() → string | null`, `Auth.onSignIn(callback)`, `Auth.signOut()`
  - `UI.showError(message)`, `UI.showTab(name)`, `UI.el(id)`

- [ ] **Step 1: `js/config.js`**

```javascript
/**
 * ერთადერთი კონფიგურაცია. ორივე მნიშვნელობა საჯაროა — Client ID
 * Google-ის დიზაინით ღიაა, Web App URL კი ტოკენის გარეშე არაფერს აბრუნებს.
 */
const CONFIG = {
  CLIENT_ID: 'ჩასვი-შენი-client-id.apps.googleusercontent.com',
  API_URL: 'https://script.google.com/macros/s/ჩასვი-შენი-id/exec',
};
```

- [ ] **Step 2: `js/api.js` — მიგრაციის წერტილი**

```javascript
/**
 * ბაზასთან საუბრის ერთადერთი ფაილი. ყველა სხვა ფაილი მხოლოდ ამას იძახებს.
 * Supabase-ზე გადასვლისას მხოლოდ ეს ფაილი გადაიწერება.
 *
 * Content-Type აუცილებლად text/plain — application/json იწვევს preflight
 * OPTIONS მოთხოვნას, რომელსაც Apps Script არ ამუშავებს.
 */
const API = (function () {

  async function call(action, payload) {
    const token = Auth.getToken();
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ idToken: token, action: action, payload: payload || {} }),
    });

    if (!response.ok) {
      const error = new Error('სერვერთან კავშირი ვერ დამყარდა');
      error.code = 'SERVER';
      throw error;
    }

    const result = await response.json();
    if (result.ok) return result.data;

    const error = new Error(result.message || 'უცნობი შეცდომა');
    error.code = result.error || 'SERVER';
    throw error;
  }

  /** UNAUTHENTICATED-ზე ერთხელ ცდილობს ტოკენის განახლებას და იმეორებს. */
  async function callWithRetry(action, payload) {
    try {
      return await call(action, payload);
    } catch (error) {
      if (error.code !== 'UNAUTHENTICATED') throw error;
      const refreshed = await Auth.refresh();
      if (!refreshed) throw error;
      return await call(action, payload);
    }
  }

  return { call: callWithRetry };
})();
```

- [ ] **Step 3: `js/auth.js`**

```javascript
/**
 * Google Identity Services. ტოკენი მხოლოდ მეხსიერებაშია — localStorage-ში
 * არ ინახება. გვერდის გადატვირთვისას ჩუმი შესვლა ავსებს (One Tap).
 */
const Auth = (function () {
  let token = null;
  let signInCallback = null;
  let refreshResolve = null;

  function handleCredential(response) {
    token = response.credential;
    if (refreshResolve) { refreshResolve(true); refreshResolve = null; }
    if (signInCallback) signInCallback();
  }

  function init(callback) {
    signInCallback = callback;
    google.accounts.id.initialize({
      client_id: CONFIG.CLIENT_ID,
      callback: handleCredential,
      auto_select: true,
      cancel_on_tap_outside: false,
    });
    google.accounts.id.renderButton(
      document.getElementById('signin-button'),
      { theme: 'outline', size: 'large', text: 'signin_with', locale: 'ka' });
    google.accounts.id.prompt();
  }

  function getToken() { return token; }

  /** ტოკენის ვადა ერთი საათია; გასვლისას ჩუმად ვცდილობთ ახლის აღებას. */
  function refresh() {
    return new Promise(function (resolve) {
      refreshResolve = resolve;
      google.accounts.id.prompt(function (notification) {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          if (refreshResolve) { refreshResolve(false); refreshResolve = null; }
        }
      });
      setTimeout(function () {
        if (refreshResolve) { refreshResolve(false); refreshResolve = null; }
      }, 5000);
    });
  }

  function signOut() {
    token = null;
    google.accounts.id.disableAutoSelect();
    location.reload();
  }

  return { init: init, getToken: getToken, refresh: refresh, signOut: signOut };
})();
```

- [ ] **Step 4: `js/ui.js`**

```javascript
const UI = (function () {

  function el(id) { return document.getElementById(id); }

  function showTab(name) {
    ['table', 'map', 'admin'].forEach(function (tab) {
      const panel = el('panel-' + tab);
      const button = el('tab-' + tab);
      if (!panel || !button) return;
      panel.hidden = (tab !== name);
      button.classList.toggle('active', tab === name);
    });
    if (name === 'map' && window.MapView) MapView.refresh();
  }

  function showError(message) {
    const box = el('error-box');
    box.textContent = message;
    box.hidden = false;
    clearTimeout(box._timer);
    box._timer = setTimeout(function () { box.hidden = true; }, 6000);
  }

  function showScreen(name) {
    ['loading', 'signin', 'pending', 'app'].forEach(function (screen) {
      el('screen-' + screen).hidden = (screen !== name);
    });
  }

  return { el: el, showTab: showTab, showError: showError, showScreen: showScreen };
})();
```

- [ ] **Step 5: `index.html`**

```html
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>კედრის უბანი</title>

<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<link rel="stylesheet" href="css/style.css">

<div id="screen-loading" class="screen">
  <p>იტვირთება…</p>
</div>

<div id="screen-signin" class="screen" hidden>
  <h1>კედრის უბანი</h1>
  <p>სისტემაში შესასვლელად გაიარეთ ავტორიზაცია Google-ით.</p>
  <div id="signin-button"></div>
</div>

<div id="screen-pending" class="screen" hidden>
  <h1>კედრის უბანი</h1>
  <p id="pending-message">თქვენი მოთხოვნა დამტკიცების პროცესშია.</p>
  <button onclick="Auth.signOut()">გასვლა</button>
</div>

<div id="screen-app" class="screen" hidden>
  <header>
    <h1>კედრის უბანი</h1>
    <nav>
      <button id="tab-table" onclick="UI.showTab('table')">ცხრილი</button>
      <button id="tab-map" onclick="UI.showTab('map')">რუკა</button>
      <button id="tab-admin" onclick="UI.showTab('admin')" hidden>ადმინი</button>
    </nav>
    <span id="whoami"></span>
    <button onclick="Auth.signOut()">გასვლა</button>
  </header>

  <div id="error-box" hidden></div>

  <section id="panel-table"></section>
  <section id="panel-map" hidden></section>
  <section id="panel-admin" hidden></section>
</div>

<script src="https://accounts.google.com/gsi/client" async defer></script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="js/config.js"></script>
<script src="js/lib.js"></script>
<script src="js/ui.js"></script>
<script src="js/auth.js"></script>
<script src="js/api.js"></script>
<script src="js/table.js"></script>
<script src="js/map.js"></script>
<script src="js/admin.js"></script>
<script src="js/main.js"></script>
```

- [ ] **Step 6: `js/main.js` — შესვლის ნაკადი**

```javascript
/** გვერდის ჩატვირთვის ნაკადი: ტოკენი -> me -> ეკრანი. */
let CURRENT_USER = null;
let PLOTS = [];

async function afterSignIn() {
  UI.showScreen('loading');
  try {
    CURRENT_USER = await API.call('me');
  } catch (error) {
    if (error.code === 'PENDING') {
      UI.el('pending-message').textContent = error.message;
      UI.showScreen('pending');
      return;
    }
    if (error.code === 'BLOCKED') {
      UI.el('pending-message').textContent = error.message;
      UI.showScreen('pending');
      return;
    }
    // უცნობი მეილი — მოთხოვნის გაგზავნა
    try {
      await API.call('requestAccess');
    } catch (requestError) {
      UI.el('pending-message').textContent = requestError.message;
      UI.showScreen('pending');
      return;
    }
    UI.showScreen('pending');
    return;
  }

  UI.el('whoami').textContent =
    CURRENT_USER.display_name || CURRENT_USER.email;
  if (CURRENT_USER.role === 'admin') UI.el('tab-admin').hidden = false;

  PLOTS = await API.call('plots');
  TableView.render(PLOTS, CURRENT_USER);
  MapView.render(PLOTS, CURRENT_USER);
  if (CURRENT_USER.role === 'admin') AdminView.render();

  UI.showScreen('app');
  UI.showTab('table');
}

window.addEventListener('load', function () {
  const timer = setInterval(function () {
    if (window.google && google.accounts && google.accounts.id) {
      clearInterval(timer);
      Auth.init(afterSignIn);
      UI.showScreen('signin');
    }
  }, 100);
});
```

- [ ] **Step 7: `css/style.css` — მინიმალური, ორივე რეჟიმისთვის**

```css
:root {
  --surface: #fcfcfb;
  --ink: #0b0b0b;
  --ink-muted: #52514e;
  --line: #e1e0d9;
  --accent: #2a78d6;
  --danger: #d03b3b;
}
@media (prefers-color-scheme: dark) {
  :root {
    --surface: #1a1a19;
    --ink: #ffffff;
    --ink-muted: #c3c2b7;
    --line: #2c2c2a;
    --accent: #3987e5;
    --danger: #e66767;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 0;
  font-family: system-ui, "Noto Sans Georgian", sans-serif;
  background: var(--surface); color: var(--ink);
}
.screen { padding: 24px; max-width: 1200px; margin: 0 auto; }
header { display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
  border-bottom: 1px solid var(--line); padding-bottom: 12px; }
header h1 { font-size: 18px; margin: 0; flex: 0 0 auto; }
nav { display: flex; gap: 4px; flex: 1 1 auto; }
nav button { background: none; border: 1px solid transparent; color: var(--ink-muted);
  padding: 6px 12px; cursor: pointer; border-radius: 6px; font: inherit; }
nav button.active { border-color: var(--line); color: var(--ink); font-weight: 600; }
#error-box { background: var(--danger); color: #fff; padding: 10px 14px;
  border-radius: 6px; margin: 12px 0; }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
th, td { text-align: right; padding: 6px 10px; border-bottom: 1px solid var(--line); }
th { cursor: pointer; color: var(--ink-muted); font-weight: 600; white-space: nowrap; }
#map { height: 70vh; border: 1px solid var(--line); border-radius: 8px; }
.controls { display: flex; gap: 8px; margin: 12px 0; flex-wrap: wrap; }
input, select, button { font: inherit; padding: 6px 10px;
  border: 1px solid var(--line); border-radius: 6px;
  background: var(--surface); color: var(--ink); }
```

- [ ] **Step 8: დროებითი ჩანაცვლებები, რომ გვერდი გაიხსნას**

`js/table.js`, `js/map.js`, `js/admin.js` ჯერ ცარიელი ობიექტებია — შემდეგი ამოცანები შეავსებს:

```javascript
// js/table.js
const TableView = { render: function () {} };
```

```javascript
// js/map.js
const MapView = { render: function () {}, refresh: function () {} };
```

```javascript
// js/admin.js
const AdminView = { render: function () {} };
```

- [ ] **Step 9: `CONFIG`-ის შევსება და ლოკალური გაშვება**

`js/config.js`-ში ჩაისვას Task 3-ის Client ID და Web App URL.

```bash
python3 -m http.server 8080
```

ბრაუზერში: `http://localhost:8080`

- [ ] **Step 10: შესვლის ხელით შემოწმება**

Expected:
1. ჩნდება „შესვლა Google-ით" ღილაკი
2. შესვლის შემდეგ ადმინის მეილით — ჩნდება ცხრილის/რუკის/ადმინის ტაბები და `whoami`-ში სახელი
3. ბრაუზერის კონსოლში შეცდომა არ არის
4. Network-ში `/exec` მოთხოვნა აბრუნებს `{"ok":true,...}`

**თუ „origin is not allowed"** — Google Cloud-ში `http://localhost:8080` Authorized JavaScript origins-ში არ არის.

- [ ] **Step 11: `pending` ნაკადის შემოწმება მეორე ანგარიშით**

სხვა Gmail-ით შესვლა → უნდა გამოჩნდეს „მოთხოვნა გაგზავნილია", Sheet-ის `მომხმარებლები` ფურცელში გაჩნდეს რიგი `pending` როლით, და ადმინს მოსდის მეილი.

- [ ] **Step 12: commit**

```bash
git add index.html css/style.css js/
git commit -m "feat: გვერდის ჩონჩხი, Google-ით შესვლა და API-ს ფენა"
```

---

## Task 6: ცხრილის ხედი (`js/table.js`)

**Files:**
- Modify: `js/table.js` (Task 5-ის ჩანაცვლება)

**Interfaces:**
- Consumes: `WebLib.filterPlots`, `WebLib.sortPlots`, `WebLib.streetList`, `WebLib.fullName`, `WebLib.mapStatus` (Task 4); `API.call` (Task 5)
- Produces: `TableView.render(plots, user)`, `TableView.openEditor(cad)` — `js/map.js` ბარათიდან რედაქტირებისთვის იძახებს

- [ ] **Step 1: `js/table.js`-ის დაწერა**

```javascript
const TableView = (function () {
  let plots = [];
  let user = null;
  let sortKey = 'street';
  let sortDir = 'asc';

  const COLUMNS = [
    { key: 'street', label: 'ქუჩა' },
    { key: 'num', label: 'N' },
    { key: 'name', label: 'მფლობელი', sortable: false },
    { key: 'phone', label: 'ტელეფონი' },
    { key: 'area', label: 'ფართობი' },
    { key: 'cad', label: 'საკადასტრო კოდი' },
  ];

  function canEdit() {
    return user && (user.role === 'moderator' || user.role === 'admin');
  }

  function render(allPlots, currentUser) {
    plots = allPlots;
    user = currentUser;
    const panel = UI.el('panel-table');
    panel.innerHTML =
      '<div class="controls">' +
      '  <input id="tbl-search" type="search" placeholder="ძებნა…">' +
      '  <select id="tbl-street"><option value="">ყველა ქუჩა</option></select>' +
      '  <span id="tbl-count"></span>' +
      '</div><div id="tbl-body"></div>';

    const select = UI.el('tbl-street');
    WebLib.streetList(plots).forEach(function (street) {
      const option = document.createElement('option');
      option.value = street;
      option.textContent = street;
      select.appendChild(option);
    });

    UI.el('tbl-search').addEventListener('input', draw);
    select.addEventListener('change', draw);
    draw();
  }

  function draw() {
    const query = UI.el('tbl-search').value;
    const street = UI.el('tbl-street').value;
    const rows = WebLib.sortPlots(
      WebLib.filterPlots(plots, { query: query, street: street }),
      sortKey, sortDir);

    UI.el('tbl-count').textContent = rows.length + ' ნაკვეთი';

    const head = COLUMNS.map(function (column) {
      const arrow = (column.key === sortKey) ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
      const attr = column.sortable === false ? '' :
        ' data-sort="' + column.key + '"';
      return '<th' + attr + '>' + column.label + arrow + '</th>';
    }).join('') + '<th></th>';

    const body = rows.map(function (plot) {
      const status = WebLib.mapStatus(plot);
      const flag = status === 'missing' ? ' 🚩' : (status === 'marker' ? ' 📍' : '');
      const phone = plot.phone
        ? '<a href="tel:' + plot.phone + '">' + plot.phone + '</a>' : '—';
      const edit = canEdit()
        ? '<button data-edit="' + plot.cad + '">✏️</button>' : '';
      return '<tr>' +
        '<td>' + (plot.street || '—') + flag + '</td>' +
        '<td>' + (plot.num || '—') + '</td>' +
        '<td>' + WebLib.fullName(plot) + '</td>' +
        '<td>' + phone + '</td>' +
        '<td>' + (plot.area || '—') + '</td>' +
        '<td>' + plot.cad + '</td>' +
        '<td>' + edit + '</td>' +
        '</tr>';
    }).join('');

    UI.el('tbl-body').innerHTML =
      '<table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';

    UI.el('tbl-body').querySelectorAll('[data-sort]').forEach(function (th) {
      th.addEventListener('click', function () {
        const key = th.getAttribute('data-sort');
        if (key === sortKey) { sortDir = (sortDir === 'asc') ? 'desc' : 'asc'; }
        else { sortKey = key; sortDir = 'asc'; }
        draw();
      });
    });
    UI.el('tbl-body').querySelectorAll('[data-edit]').forEach(function (button) {
      button.addEventListener('click', function () {
        openEditor(button.getAttribute('data-edit'));
      });
    });
  }

  function findPlot(cad) {
    return plots.filter(function (plot) { return plot.cad === cad; })[0];
  }

  const EDITABLE = [
    { key: 'first_name', label: 'სახელი' },
    { key: 'last_name', label: 'გვარი' },
    { key: 'phone', label: 'ტელეფონი' },
    { key: 'address', label: 'სრული მისამართი' },
    { key: 'num', label: 'N' },
    { key: 'note', label: 'შენიშვნა' },
  ];

  function openEditor(cad) {
    const plot = findPlot(cad);
    if (!plot || !canEdit()) return;

    const fields = EDITABLE.map(function (field) {
      return '<label>' + field.label +
        '<input data-field="' + field.key + '" value="' +
        String(plot[field.key] == null ? '' : plot[field.key]).replace(/"/g, '&quot;') +
        '"></label>';
    }).join('');

    const dialog = document.createElement('dialog');
    dialog.innerHTML =
      '<form method="dialog">' +
      '<h3>' + (plot.address || plot.cad) + '</h3>' + fields +
      '<div class="controls">' +
      '<button value="save">შენახვა</button>' +
      '<button value="cancel">გაუქმება</button>' +
      '</div></form>';
    document.body.appendChild(dialog);
    dialog.showModal();

    dialog.addEventListener('close', async function () {
      if (dialog.returnValue !== 'save') { dialog.remove(); return; }
      const changed = {};
      dialog.querySelectorAll('[data-field]').forEach(function (input) {
        changed[input.getAttribute('data-field')] = input.value;
      });
      dialog.remove();
      try {
        const result = await API.call('updatePlot', {
          cad: cad,
          expected_updated_at: String(plot.updated_at || ''),
          fields: changed,
        });
        Object.assign(plot, changed);
        plot.updated_at = result.updated_at;
        draw();
        if (window.MapView) MapView.render(plots, user);
      } catch (error) {
        UI.showError(error.message);
      }
    });
  }

  return { render: render, openEditor: openEditor };
})();
```

- [ ] **Step 2: ხელით შემოწმება — ჩვენება**

`python3 -m http.server 8080`, ბრაუზერში ცხრილის ტაბი.

Expected:
- 71 ნაკვეთი, „71 ნაკვეთი" მრიცხველში
- 5 რიგზე 🚩 ნიშანი (ქუჩის ველი ცარიელი)
- ტელეფონის სვეტში ყველგან „—" (ჯერ არ შევსებულა)

- [ ] **Step 3: ხელით შემოწმება — ძებნა და ფილტრი**

- ძებნაში `ბერიძე` → 1 რიგი
- ქუჩის ფილტრში `კედრის I გასასვლელი` → 15 რიგი
- ფართობის სვეტზე დაჭერა → სორტირდება, ისრის მიმართულება იცვლება

- [ ] **Step 4: ხელით შემოწმება — რედაქტირება**

ადმინით: ✏️ → ტელეფონში `599123456` → შენახვა.

Expected: ცხრილში ჩნდება `+995599123456`; Sheet-ში `ტელეფონი` სვეტი შევსებულია, `განახლდა` და `განმაახლებელი` შევსებულია; `ლოგი` ფურცელში ერთი ახალი ხაზი.

- [ ] **Step 5: კონკურენციის შემოწმება**

Sheet-ში ხელით შეიცვალოს იმავე ნაკვეთის `ტელეფონი`. გვერდის გადატვირთვის **გარეშე** ისევ დარედაქტირდეს იგივე რიგი.

Expected: შეცდომა „ჩანაწერი სხვამ შეცვალა, გადატვირთეთ გვერდი"

- [ ] **Step 6: commit**

```bash
git add js/table.js
git commit -m "feat: ცხრილის ხედი — ძებნა, ფილტრი, სორტირება, რედაქტირება"
```

---

## Task 7: რუკის ხედი (`js/map.js`)

**Files:**
- Modify: `js/map.js` (Task 5-ის ჩანაცვლება)

**Interfaces:**
- Consumes: `WebLib.mapStatus`, `WebLib.fullName`, `WebLib.streetList` (Task 4); `TableView.openEditor(cad)` (Task 6); Leaflet-ის გლობალური `L`
- Produces: `MapView.render(plots, user)`, `MapView.refresh()` — `UI.showTab` იძახებს, რომ Leaflet-მა ზომა გადათვალოს

- [ ] **Step 1: პალიტრის ვალიდაცია**

ქუჩების ფერები `dataviz`-ის ვალიდირებული კატეგორიული პალიტრიდან მოდის. გაშვება სავალდებულოა — თვალით შეფასება არ ვარგა:

```bash
node /private/tmp/claude-501/bundled-skills/2.1.234/42d3e1eaa70020ce1adecb41da653be0/dataviz/scripts/validate_palette.js \
  "#2a78d6,#eb6834,#1baf7a,#eda100,#e87ba4,#008300,#4a3aa7,#e34948" --mode light
```

Expected: ყველა შემოწმება PASS. თუ რომელიმე FAIL — ფერი შეიცვალოს ვალიდატორის რჩევით.

- [ ] **Step 2: `js/map.js`-ის დაწერა**

```javascript
/**
 * რუკა: Leaflet + OpenStreetMap. ხატვის ინსტრუმენტი არ არის —
 * გეომეტრია გარე წყაროდან მოდის და Sheet-ში იწერება.
 */
const MapView = (function () {
  let map = null;
  let layer = null;
  let plots = [];
  let user = null;

  // dataviz-ის კატეგორიული პალიტრა, ფიქსირებული რიგით. 8 ქუჩა = 8 სლოტი.
  // ფერები არასოდეს ციკლდება — მე-9 ქუჩა ნაცრისფერში ჩავარდება.
  const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100',
    '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
  const GREY = '#898781';

  let colorByStreet = {};

  function colorOf(plot) {
    return colorByStreet[String(plot.street || '').trim()] || GREY;
  }

  function popupHtml(plot) {
    const phone = plot.phone
      ? '<a href="tel:' + plot.phone + '">' + plot.phone + '</a>' : '—';
    const edit = (user && (user.role === 'moderator' || user.role === 'admin'))
      ? '<button onclick="TableView.openEditor(\'' + plot.cad + '\')">✏️ რედაქტირება</button>'
      : '';
    return '<b>' + (plot.address || plot.cad) + '</b><br>' +
      WebLib.fullName(plot) + '<br>' + phone + '<br>' +
      (plot.area ? plot.area + ' კვ.მ' : '') + '<br>' +
      '<small>' + (plot.purpose || '') + '</small><br>' +
      '<code>' + plot.cad + '</code><br>' + edit;
  }

  function render(allPlots, currentUser) {
    plots = allPlots;
    user = currentUser;

    const streets = WebLib.streetList(plots);
    colorByStreet = {};
    streets.forEach(function (street, index) {
      if (index < PALETTE.length) colorByStreet[street] = PALETTE[index];
    });

    if (!map) {
      UI.el('panel-map').innerHTML =
        '<div id="map"></div><div id="map-legend"></div><div id="map-missing"></div>';
      map = L.map('map').setView([41.7455, 44.7195], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
    }

    if (layer) map.removeLayer(layer);
    layer = L.layerGroup().addTo(map);

    const missing = [];
    plots.forEach(function (plot) {
      const status = WebLib.mapStatus(plot);
      const color = colorOf(plot);

      if (status === 'polygon') {
        // GeoJSON არის [lon, lat], Leaflet ელოდება [lat, lon]
        const rings = plot.geometry.map(function (ring) {
          return ring.map(function (point) { return [point[1], point[0]]; });
        });
        L.polygon(rings, { color: color, weight: 2, fillOpacity: 0.35 })
          .bindPopup(popupHtml(plot)).addTo(layer);
      } else if (status === 'marker') {
        L.circleMarker([plot.lat, plot.lon], {
          radius: 8, color: color, fillColor: color, fillOpacity: 0.8, weight: 2,
        }).bindPopup(popupHtml(plot)).addTo(layer);
      } else {
        missing.push(plot);
      }
    });

    // ლეგენდა სავალდებულოა — 8 სერიაზე ფერი მარტო ვერ ატარებს იდენტობას
    UI.el('map-legend').innerHTML = '<h4>ქუჩები</h4>' +
      streets.map(function (street) {
        return '<span class="legend-item">' +
          '<i style="background:' + (colorByStreet[street] || GREY) + '"></i>' +
          street + '</span>';
      }).join('');

    UI.el('map-missing').innerHTML = missing.length === 0 ? '' :
      '<h4>რუკაზე არ ჩანს (' + missing.length + ')</h4>' +
      '<p>ამ ნაკვეთებს არც პოლიგონი აქვთ, არც კოორდინატი. ' +
      'ადმინმა Sheet-ში უნდა შეავსოს <code>გეომეტრია</code> ან ' +
      '<code>გრძედი</code>/<code>განედი</code>.</p><ul>' +
      missing.map(function (plot) {
        return '<li><code>' + plot.cad + '</code> — ' +
          (plot.address || 'მისამართის გარეშე') + '</li>';
      }).join('') + '</ul>';
  }

  function refresh() { if (map) map.invalidateSize(); }

  return { render: render, refresh: refresh };
})();
```

- [ ] **Step 3: ლეგენდის სტილის დამატება**

`css/style.css`-ს დაემატოს:

```css
#map-legend { display: flex; flex-wrap: wrap; gap: 12px; margin: 12px 0; font-size: 13px; }
.legend-item { display: inline-flex; align-items: center; gap: 6px; }
.legend-item i { width: 14px; height: 14px; border-radius: 3px; display: inline-block; }
#map-missing { color: var(--ink-muted); font-size: 14px; }
#map-missing code { background: var(--line); padding: 1px 4px; border-radius: 3px; }
```

- [ ] **Step 4: ხელით შემოწმება**

რუკის ტაბი.

Expected:
- 66 პოლიგონი, 8 განსხვავებული ფერი ქუჩების მიხედვით
- ლეგენდაში 8 ქუჩა ფერებით
- „რუკაზე არ ჩანს (5)" სია ბოლოში, 5 საკადასტრო კოდით
- პოლიგონზე დაჭერა → ბარათი მისამართით, მფლობელით, ტელეფონით
- ადმინით: ბარათში „✏️ რედაქტირება" → იხსნება იგივე ფორმა

- [ ] **Step 5: მარკერის ლოგიკის შემოწმება**

Sheet-ში ერთ-ერთ „რუკაზე არ ჩანს" ნაკვეთს (`99.99.99.004`) ჩაეწეროს `გრძედი` = `44.7196`, `განედი` = `41.7462`. გვერდი გადაიტვირთოს.

Expected: ნაკვეთი ქრება „არ ჩანს" სიიდან და რუკაზე ჩნდება წრიული მარკერი. სია ხდება (4).

- [ ] **Step 6: დაზიანებული გეომეტრიის ტოლერანტობის შემოწმება**

Sheet-ში ერთ-ერთი ნაკვეთის `გეომეტრია` უჯრაში ჩაიწეროს ნაგავი: `[[[44.72,`. გვერდი გადაიტვირთოს.

Expected: **რუკა არ ეცემა.** ეს ერთი ნაკვეთი მარკერზე გადადის (თუ კოორდინატი აქვს) ან „არ ჩანს" სიაში. კონსოლში შეცდომა არ არის.

შემდეგ უჯრა დაბრუნდეს ძველ მნიშვნელობაზე (Ctrl+Z Sheet-ში).

- [ ] **Step 7: commit**

```bash
git add js/map.js css/style.css
git commit -m "feat: რუკა — პოლიგონები, მარკერები, ლეგენდა, დანაკლისის სია"
```

---

## Task 8: ადმინის პანელი (`js/admin.js`)

**Files:**
- Modify: `js/admin.js` (Task 5-ის ჩანაცვლება)

**Interfaces:**
- Consumes: `API.call('users')`, `API.call('setRole', {email, role, street})`, `API.call('logs', {limit})` (Task 3); `WebLib.streetList` (Task 4)
- Produces: `AdminView.render(user)`

- [ ] **Step 1: `js/admin.js`-ის დაწერა**

```javascript
const AdminView = (function () {
  const ROLES = [
    { value: 'member', label: 'მაცხოვრებელი — მხოლოდ ნახვა' },
    { value: 'moderator', label: 'მოდერატორი — რედაქტირება' },
    { value: 'admin', label: 'ადმინი — სრული წვდომა' },
    { value: 'blocked', label: 'დაბლოკილი' },
  ];

  async function render() {
    const panel = UI.el('panel-admin');
    panel.innerHTML = '<p>იტვირთება…</p>';
    try {
      const users = await API.call('users');
      const logs = await API.call('logs', { limit: 200 });
      draw(panel, users, logs);
    } catch (error) {
      UI.showError(error.message);
      panel.innerHTML = '<p>ჩატვირთვა ვერ მოხერხდა.</p>';
    }
  }

  function roleOptions(current) {
    return ROLES.map(function (role) {
      return '<option value="' + role.value + '"' +
        (role.value === current ? ' selected' : '') + '>' + role.label + '</option>';
    }).join('');
  }

  function streetOptions(current) {
    const streets = window.PLOTS ? WebLib.streetList(window.PLOTS) : [];
    return '<option value="">ქუჩის გარეშე</option>' +
      streets.map(function (street) {
        return '<option value="' + street + '"' +
          (street === current ? ' selected' : '') + '>' + street + '</option>';
      }).join('');
  }

  function userRow(user) {
    return '<tr data-email="' + user.email + '">' +
      '<td>' + user.email + '</td>' +
      '<td>' + (user.display_name || '—') + '</td>' +
      '<td><select data-role>' + roleOptions(user.role) + '</select></td>' +
      '<td><select data-street>' + streetOptions(user.street) + '</select></td>' +
      '<td><button data-save>შენახვა</button></td>' +
      '</tr>';
  }

  function draw(panel, users, logs) {
    const pending = users.filter(function (u) { return u.role === 'pending'; });
    const active = users.filter(function (u) { return u.role !== 'pending'; });

    panel.innerHTML =
      '<h3>დასამტკიცებელი მოთხოვნები (' + pending.length + ')</h3>' +
      (pending.length === 0 ? '<p>ახალი მოთხოვნა არ არის.</p>' :
        '<table><tbody>' + pending.map(userRow).join('') + '</tbody></table>') +
      '<h3>მომხმარებლები (' + active.length + ')</h3>' +
      '<table><thead><tr><th>მეილი</th><th>სახელი</th><th>როლი</th>' +
      '<th>ქუჩა</th><th></th></tr></thead><tbody>' +
      active.map(userRow).join('') + '</tbody></table>' +
      '<h3>ცვლილებების ლოგი</h3>' +
      '<table><thead><tr><th>დრო</th><th>ვინ</th><th>მოქმედება</th>' +
      '<th>კოდი</th><th>ველი</th><th>ძველი</th><th>ახალი</th></tr></thead><tbody>' +
      logs.map(function (row) {
        return '<tr><td>' + String(row.at).slice(0, 16).replace('T', ' ') + '</td>' +
          '<td>' + row.by + '</td><td>' + row.action + '</td>' +
          '<td><code>' + row.cad + '</code></td><td>' + row.field + '</td>' +
          '<td>' + (row.old || '—') + '</td><td>' + (row.new || '—') + '</td></tr>';
      }).join('') + '</tbody></table>';

    panel.querySelectorAll('[data-save]').forEach(function (button) {
      button.addEventListener('click', async function () {
        const tr = button.closest('tr');
        try {
          await API.call('setRole', {
            email: tr.getAttribute('data-email'),
            role: tr.querySelector('[data-role]').value,
            street: tr.querySelector('[data-street]').value,
          });
          render();
        } catch (error) {
          UI.showError(error.message);
        }
      });
    });
  }

  return { render: render };
})();
```

- [ ] **Step 2: `js/main.js`-ში `PLOTS`-ის გლობალურად გატანა**

`AdminView`-ს ქუჩების სია სჭირდება. `js/main.js`-ში `PLOTS = await API.call('plots');` შეიცვალოს:

```javascript
PLOTS = await API.call('plots');
window.PLOTS = PLOTS;
```

- [ ] **Step 3: ხელით შემოწმება — დამტკიცება**

ადმინით ადმინის ტაბი. Task 5 Step 11-ში შექმნილი `pending` მომხმარებელი უნდა ჩანდეს.

როლი `მოდერატორი`, ქუჩა `კედრის I გასასვლელი` → შენახვა.

Expected: მომხმარებელი გადადის „მომხმარებლები" სიაში; Sheet-ში `როლი`, `ქუჩა`, `დამტკიცების თარიღი`, `დამამტკიცებელი` შევსებულია; ლოგში ჩანს `role_change`.

- [ ] **Step 4: ხელით შემოწმება — მოდერატორის უფლებები**

დამტკიცებული ანგარიშით შესვლა.

Expected: ცხრილში ✏️ ჩანს; ადმინის ტაბი **არ ჩანს**; რედაქტირება მუშაობს.

- [ ] **Step 5: უფლების გვერდის ავლის მცდელობა**

მოდერატორის სესიაში, ბრაუზერის კონსოლში:

```javascript
await API.call('users');
```

Expected: `Error: ამ მოქმედების უფლება არ გაქვთ` (`FORBIDDEN`)

```javascript
await API.call('updatePlot', { cad: '99.99.99.002',
  expected_updated_at: '', fields: { geometry: '[]' } });
```

Expected: `Error: ველი არ ექვემდებარება რედაქტირებას: geometry` (`FORBIDDEN`)

**ეს ორი შემოწმება ამტკიცებს, რომ დაცვა სერვერზეა და არა ღილაკის დამალვაში.**

- [ ] **Step 6: ბოლო ადმინის დაცვის შემოწმება**

ადმინის სესიაში საკუთარი როლის `მაცხოვრებელ`-ზე შეცვლის მცდელობა.

Expected: `Error: ბოლო ადმინის როლი ვერ შეიცვლება`

- [ ] **Step 7: commit**

```bash
git add js/admin.js js/main.js
git commit -m "feat: ადმინის პანელი — დამტკიცება, როლები, ლოგი"
```

---

## Task 9: განთავსება GitHub Pages-ზე და QA

**Files:**
- Create: `docs/qa-checklist.md`
- Create: `README.md`
- Modify: `docs/setup.md`

**Interfaces:**
- Consumes: ყველა წინა ამოცანა
- Produces: მუშა საიტი `https://<username>.github.io/<repo>/`

- [ ] **Step 1: ყველა ტესტის გაშვება**

```bash
node --test tests/*.test.js
python3 tools/test_import.py -v
```

Expected: 49 Node-ტესტი PASS, 11 Python-ტესტი PASS, 0 failed.

**თუ რომელიმე ეცემა — გააჩერე და გაასწორე. აქედან წინ ტესტების გატეხვით არ მიდიხარ.**

- [ ] **Step 2: `README.md`-ის დაწერა**

```markdown
# კედრის უბანი

სამეზობლოს რეესტრი — ნაკვეთები, მფლობელები, საკონტაქტო ინფორმაცია.
ცხრილისა და ინტერაქციული რუკის სახით.

## არქიტექტურა

- **ინტერფეისი:** სტატიკური საიტი GitHub Pages-ზე, build-პროცესის გარეშე
- **სერვერი:** Google Apps Script Web App
- **ბაზა:** Google Sheet (პირადი, არასაჯარო)
- **ავტორიზაცია:** Google Identity Services + ID token-ის შემოწმება

## ტესტები

    node --test tests/*.test.js
    python3 tools/test_import.py -v

npm-პაკეტები არ არის საჭირო.

## დოკუმენტაცია

- `docs/setup.md` — განთავსების ინსტრუქცია
- `docs/qa-checklist.md` — ხელით შესამოწმებელი სცენარები
- `docs/superpowers/specs/` — სპეციფიკაციები
```

- [ ] **Step 3: `docs/qa-checklist.md`-ის დაწერა**

```markdown
# QA-ჩექლისტი

სამი ანგარიშით გასავლელი: **ადმინი**, **მოდერატორი**, **მაცხოვრებელი**.

## წვდომა

- [ ] უცნობი მეილით შესვლა → „მოთხოვნა გაგზავნილია"; Sheet-ში `pending` რიგი; ადმინს მოსდის მეილი
- [ ] `pending` მომხმარებელი ცხრილს **ვერ** ხედავს
- [ ] ადმინი ამტკიცებს → მომხმარებელი შედის და ხედავს ცხრილს
- [ ] `blocked` როლით შესვლა → „წვდომა შეზღუდულია"

## ცხრილი

- [ ] 71 ნაკვეთი ჩანს
- [ ] ძებნა `ბერიძე` → 1 რიგი
- [ ] ქუჩის ფილტრი `კედრის I გასასვლელი` → 15 რიგი
- [ ] ფართობზე სორტირება მუშაობს ორივე მიმართულებით; ცარიელი ბოლოშია
- [ ] 5 რიგზე 🚩 ნიშანი
- [ ] ტელეფონის ბმულზე დაჭერა მობილურზე რეკავს

## რუკა

- [ ] 66 პოლიგონი, 8 ფერი ქუჩების მიხედვით
- [ ] ლეგენდა ჩანს 8 ქუჩით
- [ ] „რუკაზე არ ჩანს (5)" სია ბოლოშია
- [ ] პოლიგონზე დაჭერა → ბარათი მისამართით, მფლობელით, ტელეფონით
- [ ] Sheet-ში კოორდინატის ჩაწერა → ნაკვეთი მარკერად ჩნდება, სია მცირდება
- [ ] დაზიანებული `გეომეტრია` უჯრა → რუკა **არ ეცემა**

## უფლებები

- [ ] მოდერატორი ხედავს ✏️ ღილაკს
- [ ] მოდერატორს ადმინის ტაბი **არ უჩანს**
- [ ] მოდერატორი კონსოლიდან `API.call('users')` → `FORBIDDEN`
- [ ] მოდერატორი კონსოლიდან `geometry`-ის შეცვლა → `FORBIDDEN`
- [ ] მაცხოვრებელს ✏️ **არ უჩანს**
- [ ] მაცხოვრებელი კონსოლიდან `updatePlot` → `FORBIDDEN`
- [ ] ადმინი საკუთარ როლს ვერ აქვეითებს → „ბოლო ადმინის როლი ვერ შეიცვლება"

## რედაქტირება და ლოგი

- [ ] ტელეფონის შეცვლა → ცხრილში მაშინვე ჩანს
- [ ] Sheet-ში `განახლდა` და `განმაახლებელი` შევსებულია
- [ ] `ლოგი` ფურცელში ერთი ხაზი თითო შეცვლილ ველზე
- [ ] არასწორი ტელეფონი `abc` → „ტელეფონი მხოლოდ ციფრებს უნდა შეიცავდეს"
- [ ] Sheet-ში ხელით შეცვლა + გვერდის გადატვირთვის გარეშე რედაქტირება → `CONFLICT`

## უსაფრთხოება

- [ ] Sheet-ის გაზიარება: მხოლოდ მფლობელი
- [ ] Sheet **არ არის** „Published to web"
- [ ] `curl` არასწორი ტოკენით → `UNAUTHENTICATED`
- [ ] `curl` ტოკენის გარეშე → `UNAUTHENTICATED`
- [ ] repo-ში საიდუმლო არ არის (მხოლოდ Client ID და Web App URL)

## ბრაუზერები

- [ ] Chrome (დესკტოპი)
- [ ] Safari (iPhone) — რუკა და ცხრილი იკითხება
- [ ] ბნელი რეჟიმი
```

- [ ] **Step 4: GitHub repo-ს შექმნა და push**

```bash
gh repo create kedris-ubani --private --source=. --remote=origin
git add -A
git commit -m "docs: README და QA-ჩექლისტი"
git push -u origin main
```

**repo პირადი უნდა იყოს.** კოდში საიდუმლო არაა, მაგრამ საჯარო repo ზედმეტ ყურადღებას იზიდავს.

- [ ] **Step 5: GitHub Pages-ის ჩართვა**

Settings → Pages → Source: Deploy from a branch → Branch: `main`, folder: `/ (root)` → Save.

მისამართი: `https://<username>.github.io/kedris-ubani/`

**შენიშვნა:** პირადი repo-სთვის GitHub Pages საჭიროებს GitHub Pro-ს. თუ არ გაქვს, repo გახდი საჯარო (`gh repo edit --visibility public`) — კოდში საიდუმლო არ არის, ხოლო მონაცემები Sheet-შია და დაცულია.

- [ ] **Step 6: Authorized origins-ის განახლება**

Google Cloud → Credentials → OAuth client → Authorized JavaScript origins:
- დაემატოს `https://<username>.github.io`
- **წაიშალოს** `http://localhost:8080`

- [ ] **Step 7: სრული QA-ჩექლისტის გავლა პროდაქშენ მისამართზე**

`docs/qa-checklist.md`-ის ყველა პუნქტი გაირბინოს **განთავსებულ საიტზე**, არა localhost-ზე. სამივე როლით.

- [ ] **Step 8: ტელეფონის ნომრების შევსება**

Sheet-ის `ტელეფონი` სვეტი შეივსოს — ან ხელით, ან მოდერატორების მიერ აპლიკაციიდან. **ეს არის ერთადერთი მონაცემი, რომელიც სისტემას აკლია და მხოლოდ ცოცხალი კომუნიკაციით მოიპოვება.**

- [ ] **Step 9: საბოლოო commit**

```bash
git add -A
git commit -m "chore: ეტაპი 1 დასრულებულია — რეესტრი მუშაობს"
git push
```

---

## დასრულების კრიტერიუმი

ეტაპი 1 დასრულებულია, როცა:

- [ ] `node --test tests/*.test.js` — 49 ტესტი PASS
- [ ] `python3 tools/test_import.py -v` — 11 ტესტი PASS
- [ ] `docs/qa-checklist.md`-ის ყველა პუნქტი მონიშნულია პროდაქშენ მისამართზე
- [ ] სამი რეალური მეზობელი შესულია და ხედავს ცხრილს
- [ ] მინიმუმ ერთი მოდერატორი დამტკიცებულია და ერთი ცვლილება გაუკეთებია
- [ ] Sheet არასაჯაროა

ამის შემდეგ იწყება **ეტაპი 2** — `docs/superpowers/specs/2026-08-20-proektebi-design.md`
