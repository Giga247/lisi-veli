# ლისი ველი — სახელი და უბნის ვექტორული გეგმა

> **სტატუსი (2026-08-21):** ამოცანები 1-4 შესრულდა. **ამოცანები 5-7 გაუქმდა**
> მფლობელის გადაწყვეტილებით — ინტერაქციული რენდერი, Leaflet-ის ამოღება და
> რუკის ტაბის გადაწერა ამ ამოცანისთვის ზედმეტი აღმოჩნდა. მათ ნაცვლად
> `tools/render_plan.py` ერთხელ აგებს `data/plan.svg`-ს, რომელიც შესვლის
> ეკრანზე `<img>`-ითაა ჩასმული. ამოცანა 4-ის (`js/lib.js`-ის გეომეტრია)
> კომიტი დაბრუნდა — სტატიკურ ნახაზს ბრაუზერში ხატვა არ სჭირდება.
> რუკის ტაბი Leaflet-ზე უცვლელად რჩება.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** პლატფორმას „ლისი ველი" ერქვას და მთავარ გვერდზე უბნის ვექტორული გეგმა იდგეს — გზები, საკადასტრო კონტურები, ნაგებობები და მისამართები საარქიტექტორო ნახაზის სტილში.

**Architecture:** OSM-იდან ერთხელ მოქაჩული გეომეტრია + ჩვენი საკადასტრო კონტურები ერთ სტატიკურ `data/plan.geojson`-ში იკომიტება. ერთი JS მოდული (`js/plan.js`) ამ ფაილიდან SVG-ს ხატავს ორ რეჟიმში: `hero` (შესვლის ეკრანი, ინტერაქციის გარეშე) და `interactive` (რუკის ტაბი, ცოცხალი მონაცემით, pan/zoom-ით და პოპაპებით). Leaflet მთლიანად გამოდის.

**Tech Stack:** vanilla JS (build-პროცესის გარეშე), SVG, `node --test`, Python 3.9 stdlib + `unittest`, Overpass API.

**Spec:** `docs/superpowers/specs/2026-08-21-lisi-veli-gegma-design.md`

## Global Constraints

- **პლატფორმის სახელი:** `ლისი ველი` (ლათინურად `Lisi Veli`). ძველი `კედრის უბანი` მომხმარებელზე ხილულ არცერთ ტექსტში აღარ რჩება.
- **ფაილების სახელები არ იცვლება:** `4_Kedri_Street`, `კედრის_ქუჩა_ნაკვეთები.geojson`, `კედრის_ქუჩა_ხელმოწერები.xlsx`.
- **პირადი მონაცემი საჯარო ფაილში არასოდეს:** `data/plan.geojson` მხოლოდ თეთრი სიის ველებს შეიცავს — `cad`, `adr_num`, `street`, `area` (+ OSM-ის `osm_id`, `name`, `name_src`, `class`). სახელი, გვარი, ტელეფონი, `note`, `purpose` — არასოდეს.
- **build-პროცესი არ არსებობს:** ყველა JS ფაილი პირდაპირ `index.html`-ში იტვირთება, მოდულების ბანდლერის გარეშე. `js/lib.js` UMD-ია (ბრაუზერში `WebLib`, Node-ში `require`).
- **პროექცია:** Web Mercator. უბრალო `lon/lat` აკრძალულია — 41.7° განედზე ნახაზს ბრტყელს ხდის.
- **გზების სახელების ზღვარი:** `min_votes=3`, `min_share=0.6`. ვერ გადალახა → გზა უწარწეროდ რჩება.
- **ატრიბუცია სავალდებულო:** `გზები და ნაგებობები: © OpenStreetMap-ის მონაწილეები (ODbL)` ორივე რეჟიმში ჩანს.
- **ტესტების გაშვება:** `node --test tests/*.test.js` და `python3 -m unittest discover -s tools -p 'test_*.py'`
- **ლოკალური სერვერი:** `python3 -m http.server 8080` (უკვე გაშვებულია)
- **კომიტის ხელმოწერა:** ყოველი კომიტის ბოლოს `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

---

## File Structure

| ფაილი | პასუხისმგებლობა | ამოცანა |
|---|---|---|
| `index.html` | სახელი, ჰეროს კონტეინერი, სკრიპტების სია | 1, 5, 6 |
| `README.md`, `docs/setup.md`, `docs/qa-checklist.md` | სახელი, ახალი QA პუნქტები | 1, 7 |
| `apps-script/Code.js` | სახელი (კომენტარი, `doGet`, ელფოსტა) | 1 |
| `tools/plan_lib.py` | **ახალი.** წმინდა გეომეტრია Python-ში: ცენტროიდი, წერტილი↔ხაზი მანძილი, ქუჩების სახელების მიწერა | 2 |
| `tools/test_plan_lib.py` | **ახალი.** `plan_lib`-ის ტესტები | 2 |
| `tools/fetch_osm.py` | **ახალი.** ქსელი: Overpass → `data/plan.geojson` | 3 |
| `data/plan.geojson` | **ახალი.** სტატიკური სნეპშოტი, რეპოში | 3 |
| `.gitignore` | `!data/plan.geojson` გამონაკლისი | 3 |
| `js/lib.js` | +5 წმინდა ფუნქცია: პროექცია, პროექტორი, ცენტროიდი, path-ები | 4 |
| `tests/weblib.test.js` | ახალი ფუნქციების ტესტები | 4 |
| `css/style.css` | გეგმის ფერადი ტოკენები და ფენების სტილი | 5 |
| `js/plan.js` | **ახალი.** SVG რენდერი — `hero` (ამოცანა 5), `interactive` (ამოცანა 6) | 5, 6 |
| `js/main.js` | ჰეროს გამოძახება, `MapView` → `PlanView` | 5, 6 |
| `js/ui.js` | `MapView.refresh` → `PlanView.refresh` | 6 |
| `js/map.js` | **იშლება** (ამოცანა 6) | 6 |

---

## Task 1: სახელი — „ლისი ველი"

**Files:**
- Modify: `index.html:6`, `index.html:25`, `index.html:31`, `index.html:38`
- Modify: `README.md:1`
- Modify: `apps-script/Code.js:2`, `apps-script/Code.js:82`, `apps-script/Code.js:268`
- Modify: `docs/setup.md:1`, `docs/setup.md:3`, `docs/setup.md:102`, `docs/setup.md:128`
- Modify: `docs/qa-checklist.md:20`

**Interfaces:**
- Consumes: არაფერი
- Produces: არაფერი (მხოლოდ ტექსტი)

- [ ] **Step 1: დაწერე შემოწმება, რომელიც ახლა ჩავარდება**

გაუშვი და დაინახე, რომ ძველი სახელი ჯერ კიდევ არსებობს:

```sh
grep -rn "კედრის უბანი" index.html README.md apps-script/ docs/setup.md docs/qa-checklist.md
```

Expected: 12 დამთხვევა (4 `index.html`, 1 `README.md`, 3 `apps-script/Code.js`, 3 `docs/setup.md`, 1 `docs/qa-checklist.md`).

- [ ] **Step 2: შეცვალე `index.html`**

```sh
sed -i '' 's/კედრის უბანი/ლისი ველი/g' index.html README.md apps-script/Code.js docs/qa-checklist.md
```

- [ ] **Step 3: შეცვალე `docs/setup.md` ხელით**

`docs/setup.md`-ში სამივე ადგილი იცვლება, ოღონდ 128-ე ხაზზე (OAuth consent screen) ლათინური ფორმაც ემატება, რადგან Google Cloud-ის კონსოლში ქართული სახელი ზოგ ველში ცუდად ჩანს:

```markdown
2. APIs & Services → OAuth consent screen → External → აპლიკაციის სახელი
   `ლისი ველი` (თუ ქართული არ მიიღება: `Lisi Veli`), support email,
   developer email → Save
```

დანარჩენი ორი ადგილი:

```sh
sed -i '' 's/კედრის უბანი/ლისი ველი/g' docs/setup.md
```

შემდეგ ხელით დაამატე ლათინური ფორმა OAuth-ის პუნქტში.

- [ ] **Step 4: შეამოწმე, რომ ძველი სახელი აღარსად არის**

```sh
grep -rn "კედრის უბანი" index.html README.md apps-script/ docs/setup.md docs/qa-checklist.md
```

Expected: არცერთი დამთხვევა (exit code 1).

**ყურადღება:** `docs/superpowers/plans/2026-08-20-etapi-1-reestri.md` და `docs/chat-logs/` **არ იცვლება** — ეს ისტორიული ჩანაწერებია, რომლებიც იმ დროის მდგომარეობას აღწერს.

- [ ] **Step 5: გაუშვი არსებული ტესტები**

```sh
node --test tests/*.test.js
```

Expected: PASS (სახელის შეცვლა ლოგიკას არ ეხება, მაგრამ რეგრესია გამოირიცხოს).

- [ ] **Step 6: შეამოწმე ბრაუზერში**

`http://localhost:8080/` → hard refresh (Cmd+Shift+R). ჩანართის სათაური და შესვლის ეკრანის სათაური: **ლისი ველი**.

- [ ] **Step 7: Commit**

```sh
git add index.html README.md apps-script/Code.js docs/setup.md docs/qa-checklist.md
git commit -m "feat: პლატფორმას ლისი ველი ჰქვია

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: `tools/plan_lib.py` — გზებისთვის ქუჩის სახელების მიწერა

**Files:**
- Create: `tools/plan_lib.py`
- Test: `tools/test_plan_lib.py`

**Interfaces:**
- Consumes: არაფერი
- Produces:
  - `ring_centroid(ring) -> (lon, lat)` — `ring` არის `[[lon, lat], ...]`
  - `point_segment_distance_m(p, a, b, lat0) -> float`
  - `distance_point_to_line_m(p, coords, lat0) -> float`
  - `assign_street_names(roads, plots, radius_m=40.0, min_votes=3, min_share=0.6) -> list`
    - `roads`: `[{'osm_id': int, 'name': str, 'class': str, 'coords': [[lon, lat], ...]}]`
    - `plots`: `[{'cad': str, 'street': str, 'ring': [[lon, lat], ...]}]`
    - აბრუნებს **ახალ** სიას; თითო გზას ემატება `name` და `name_src` (`'osm'` / `'დაშვებული'` / `''`)

- [ ] **Step 1: დაწერე ჩავარდნადი ტესტები**

`tools/test_plan_lib.py`:

```python
# -*- coding: utf-8 -*-
import unittest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from plan_lib import (
    ring_centroid, point_segment_distance_m, distance_point_to_line_m,
    assign_street_names)

# ყველა კოორდინატი ლისი ველის განედზეა — 41.745°, სადაც გრძედის
# გრადუსი 83058 მ-ია, განედისა 111320 მ.
LAT0 = 41.745


class TestRingCentroid(unittest.TestCase):
    def test_kvadratis_centri(self):
        ring = [[0.0, 0.0], [2.0, 0.0], [2.0, 2.0], [0.0, 2.0]]
        lon, lat = ring_centroid(ring)
        self.assertAlmostEqual(lon, 1.0, places=9)
        self.assertAlmostEqual(lat, 1.0, places=9)

    def test_dakhuruli_rgoli_ar_shlis_shedegs(self):
        # პირველი და ბოლო წერტილი ერთი და იგივე — GeoJSON-ის ჩვეული ფორმა
        ring = [[0.0, 0.0], [2.0, 0.0], [2.0, 2.0], [0.0, 2.0], [0.0, 0.0]]
        lon, lat = ring_centroid(ring)
        self.assertAlmostEqual(lon, 1.0, places=9)
        self.assertAlmostEqual(lat, 1.0, places=9)

    def test_gadagvarebuli_rgoli_sashualos_abrunebs(self):
        # ნულოვანი ფართობი — ფართობით შეწონა შეუძლებელია
        ring = [[1.0, 1.0], [1.0, 1.0], [1.0, 1.0]]
        lon, lat = ring_centroid(ring)
        self.assertAlmostEqual(lon, 1.0, places=9)
        self.assertAlmostEqual(lat, 1.0, places=9)


class TestDistance(unittest.TestCase):
    def test_perpendikuluri_manzili_metrebshi(self):
        # წერტილი 0.001° ჩრდილოეთით ჰორიზონტალური მონაკვეთიდან
        d = point_segment_distance_m(
            [44.7200, 41.7460], [44.7190, 41.7450], [44.7210, 41.7450], LAT0)
        self.assertAlmostEqual(d, 111.32, places=1)

    def test_monakvetis_gareshe_bolo_wertils_ezomeba(self):
        # წერტილი მონაკვეთის მარჯვნივაა — უახლოესი არის ბოლო წვერო
        d = point_segment_distance_m(
            [44.7220, 41.7450], [44.7190, 41.7450], [44.7210, 41.7450], LAT0)
        self.assertAlmostEqual(d, 83.06, places=1)

    def test_nulovani_monakveti(self):
        d = point_segment_distance_m(
            [44.7210, 41.7450], [44.7200, 41.7450], [44.7200, 41.7450], LAT0)
        self.assertAlmostEqual(d, 83.06, places=1)

    def test_xazi_uaxloes_monakvets_irchevs(self):
        coords = [[44.7190, 41.7450], [44.7210, 41.7450], [44.7210, 41.7470]]
        d = distance_point_to_line_m([44.7211, 41.7460], coords, LAT0)
        self.assertAlmostEqual(d, 8.31, places=1)


def road(osm_id, name, coords, cls=u'residential'):
    return {u'osm_id': osm_id, u'name': name, u'class': cls, u'coords': coords}


def plot(cad, street, lon, lat):
    # პატარა კვადრატი მითითებული ცენტრით
    d = 0.00005
    return {u'cad': cad, u'street': street, u'ring': [
        [lon - d, lat - d], [lon + d, lat - d],
        [lon + d, lat + d], [lon - d, lat + d]]}


# ჰორიზონტალური გზა 41.7450-ზე, 44.7190-დან 44.7210-მდე
ROAD_A = road(1, u'', [[44.7190, 41.7450], [44.7210, 41.7450]])
# შორეული გზა — 41.7470-ზე, ანუ ROAD_A-დან ~222 მ ჩრდილოეთით
ROAD_B = road(2, u'', [[44.7190, 41.7470], [44.7210, 41.7470]])


class TestAssignStreetNames(unittest.TestCase):
    def test_osm_saxeli_yoveltvis_imarjvebs(self):
        roads = [road(1, u'ლეო კვაჭაძის ქუჩა',
                      [[44.7190, 41.7450], [44.7210, 41.7450]])]
        plots = [plot(u'A', u'კედრის ქუჩა', 44.7195, 41.74505),
                 plot(u'B', u'კედრის ქუჩა', 44.7200, 41.74505),
                 plot(u'C', u'კედრის ქუჩა', 44.7205, 41.74505)]
        out = assign_street_names(roads, plots)
        self.assertEqual(out[0][u'name'], u'ლეო კვაჭაძის ქუჩა')
        self.assertEqual(out[0][u'name_src'], u'osm')

    def test_umravlesoba_saxels_wers(self):
        plots = [plot(u'A', u'კედრის I ჩიხი', 44.7195, 41.74505),
                 plot(u'B', u'კედრის I ჩიხი', 44.7200, 41.74505),
                 plot(u'C', u'კედრის I ჩიხი', 44.7205, 41.74505),
                 plot(u'D', u'კედრის ქუჩა', 44.7207, 41.74505)]
        out = assign_street_names([ROAD_A], plots)
        self.assertEqual(out[0][u'name'], u'კედრის I ჩიხი')
        self.assertEqual(out[0][u'name_src'], u'დაშვებული')

    def test_sam_xmaze_naklebi_ar_kmara(self):
        plots = [plot(u'A', u'კედრის I ჩიხი', 44.7195, 41.74505),
                 plot(u'B', u'კედრის I ჩიხი', 44.7200, 41.74505)]
        out = assign_street_names([ROAD_A], plots)
        self.assertEqual(out[0][u'name'], u'')
        self.assertEqual(out[0][u'name_src'], u'')

    def test_gayofili_xmebi_saxels_ar_wers(self):
        # 3 : 3 — არცერთი 60%-ს ვერ აღწევს
        plots = [plot(u'A', u'კედრის I ჩიხი', 44.7192, 41.74505),
                 plot(u'B', u'კედრის I ჩიხი', 44.7194, 41.74505),
                 plot(u'C', u'კედრის I ჩიხი', 44.7196, 41.74505),
                 plot(u'D', u'კედრის ქუჩა', 44.7204, 41.74505),
                 plot(u'E', u'კედრის ქუჩა', 44.7206, 41.74505),
                 plot(u'F', u'კედრის ქუჩა', 44.7208, 41.74505)]
        out = assign_street_names([ROAD_A], plots)
        self.assertEqual(out[0][u'name'], u'')

    def test_shors_myofi_nakvetebi_xmas_ar_azleven(self):
        # ყველა ნაკვეთი ROAD_A-სთანაა; ROAD_B 222 მ-ითაა დაშორებული
        plots = [plot(u'A', u'კედრის I ჩიხი', 44.7195, 41.74505),
                 plot(u'B', u'კედრის I ჩიხი', 44.7200, 41.74505),
                 plot(u'C', u'კედრის I ჩიხი', 44.7205, 41.74505)]
        out = assign_street_names([ROAD_A, ROAD_B], plots)
        self.assertEqual(out[0][u'name'], u'კედრის I ჩიხი')
        self.assertEqual(out[1][u'name'], u'')

    def test_shemomavali_sia_ar_icvleba(self):
        roads = [road(1, u'', [[44.7190, 41.7450], [44.7210, 41.7450]])]
        assign_street_names(roads, [])
        self.assertNotIn(u'name_src', roads[0])


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: გაუშვი და დაინახე, რომ ჩავარდება**

```sh
python3 -m unittest discover -s tools -p 'test_plan_lib.py' -v
```

Expected: `ModuleNotFoundError: No module named 'plan_lib'`

- [ ] **Step 3: დაწერე `tools/plan_lib.py`**

```python
# -*- coding: utf-8 -*-
u"""სუფთა გეომეტრია გეგმისთვის — ქსელს და ფაილებს არ ეხება, ამიტომ იტესტება.

მანძილები ლოკალურ ბრტყელ მიახლოებაშია: ამ განედზე (41.7°) და ამ მასშტაბზე
(უბანი ~350 მ) დედამიწის სიმრუდე სანტიმეტრებს ცვლის, ჩვენ კი ათეულ მეტრზე
ვმსჯელობთ.
"""
import math

M_PER_DEG_LAT = 111320.0


def meters_per_deg_lon(lat):
    u"""გრძედის ერთი გრადუსი მეტრებში მოცემულ განედზე."""
    return M_PER_DEG_LAT * math.cos(math.radians(lat))


def ring_centroid(ring):
    u"""[[lon, lat], ...] -> (lon, lat), ფართობით შეწონილი.

    გადაგვარებულ (ნულოვანფართობიან) რგოლზე წვეროების საშუალოს აბრუნებს —
    სხვაგვარად ნულზე გაყოფა მოხდებოდა.
    """
    points = list(ring)
    if len(points) > 1 and points[0] == points[-1]:
        points = points[:-1]
    if not points:
        return (0.0, 0.0)

    area = 0.0
    cx = 0.0
    cy = 0.0
    count = len(points)
    for i in range(count):
        ax, ay = points[i][0], points[i][1]
        bx, by = points[(i + 1) % count][0], points[(i + 1) % count][1]
        cross = ax * by - bx * ay
        area += cross
        cx += (ax + bx) * cross
        cy += (ay + by) * cross

    if abs(area) < 1e-14:
        return (sum(p[0] for p in points) / count,
                sum(p[1] for p in points) / count)

    area *= 0.5
    return (cx / (6.0 * area), cy / (6.0 * area))


def _to_meters(point, origin, lat0):
    u"""[lon, lat] -> (x, y) მეტრებში, origin-ის მიმართ."""
    return ((point[0] - origin[0]) * meters_per_deg_lon(lat0),
            (point[1] - origin[1]) * M_PER_DEG_LAT)


def point_segment_distance_m(p, a, b, lat0):
    u"""წერტილიდან [a, b] მონაკვეთამდე უმოკლესი მანძილი, მეტრებში."""
    px, py = _to_meters(p, a, lat0)
    bx, by = _to_meters(b, a, lat0)
    seg_sq = bx * bx + by * by
    if seg_sq == 0.0:
        return math.hypot(px, py)
    t = (px * bx + py * by) / seg_sq
    t = max(0.0, min(1.0, t))
    return math.hypot(px - t * bx, py - t * by)


def distance_point_to_line_m(p, coords, lat0):
    u"""წერტილიდან მტეხილ ხაზამდე უმოკლესი მანძილი, მეტრებში."""
    if not coords:
        return float('inf')
    if len(coords) == 1:
        return point_segment_distance_m(p, coords[0], coords[0], lat0)
    return min(point_segment_distance_m(p, coords[i], coords[i + 1], lat0)
               for i in range(len(coords) - 1))


def assign_street_names(roads, plots, radius_m=40.0, min_votes=3, min_share=0.6):
    u"""გზებს ქუჩის სახელს აწერს ახლომდებარე ნაკვეთების ხმებით.

    OSM-ის საკუთარი სახელი ყოველთვის იმარჯვებს (`name_src='osm'`).
    დანარჩენებზე: `radius_m`-ში მოხვედრილი ნაკვეთები ხმას აძლევენ თავიანთ
    `street`-ს; გამარჯვებულს სჭირდება `min_votes` ხმა **და** ხმების
    `min_share` წილი. ვერ გადალახა — გზა უსახელო რჩება.

    მცდარი ქუჩის სახელი ნახაზზე უარესია, ვიდრე ცარიელი გზა: მეზობელი მას
    ენდობა. ამიტომ ზღვარი მკაცრია და ეჭვის შემთხვევაში არაფერი იწერება.

    შემომავალ სიას არ ცვლის — ახალ სიას აბრუნებს.
    """
    voters = []
    for plot in plots:
        street = (plot.get(u'street') or u'').strip()
        ring = plot.get(u'ring') or []
        if street and ring:
            voters.append((ring_centroid(ring), street))

    lat0 = (sum(c[1] for c, _ in voters) / len(voters)) if voters else 41.745

    result = []
    for source in roads:
        road = dict(source)
        name = (road.get(u'name') or u'').strip()
        if name:
            road[u'name'] = name
            road[u'name_src'] = u'osm'
            result.append(road)
            continue

        votes = {}
        for centroid, street in voters:
            if distance_point_to_line_m(centroid, road.get(u'coords') or [],
                                        lat0) <= radius_m:
                votes[street] = votes.get(street, 0) + 1

        road[u'name'] = u''
        road[u'name_src'] = u''
        total = sum(votes.values())
        if total:
            # ხმების რაოდენობით, ტოლობისას სახელით — რომ შედეგი
            # გაშვებიდან გაშვებამდე ერთი და იგივე იყოს
            best, count = sorted(votes.items(),
                                 key=lambda kv: (-kv[1], kv[0]))[0]
            if count >= min_votes and count >= min_share * total:
                road[u'name'] = best
                road[u'name_src'] = u'დაშვებული'
        result.append(road)

    return result
```

- [ ] **Step 4: გაუშვი ტესტები**

```sh
python3 -m unittest discover -s tools -p 'test_plan_lib.py' -v
```

Expected: 13 ტესტი, ყველა PASS.

- [ ] **Step 5: გაუშვი ყველა Python ტესტი (რეგრესია)**

```sh
python3 -m unittest discover -s tools -p 'test_*.py'
```

Expected: OK.

- [ ] **Step 6: Commit**

```sh
git add tools/plan_lib.py tools/test_plan_lib.py
git commit -m "feat: plan_lib — გზებს ქუჩის სახელს ნაკვეთების ხმებით აწერს

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: `tools/fetch_osm.py` → `data/plan.geojson`

**Files:**
- Create: `tools/fetch_osm.py`
- Create: `data/plan.geojson` (სკრიპტის შედეგი)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `plan_lib.assign_street_names`, `plan_lib.ring_centroid`
- Produces: `data/plan.geojson` — `FeatureCollection`, თითო `Feature`-ს აქვს `properties.layer` ∈ {`plot`, `building`, `road`}
  - `plot`: `cad`, `adr_num`, `street`, `area` · Polygon
  - `building`: `osm_id` · Polygon
  - `road`: `osm_id`, `name`, `name_src`, `class` · LineString

- [ ] **Step 1: დაამატე `.gitignore`-ის გამონაკლისი**

`.gitignore`-ის ბოლოში, პერსონალური მონაცემების ბლოკის შემდეგ:

```gitignore
# გამონაკლისი: ნახაზის სტატიკური მონაცემი. აქ პირადი ველი არ არის —
# მხოლოდ საკადასტრო კონტურები, კოდები, მისამართის ნომრები და ქუჩები,
# ანუ ის, რაც საჯარო საკადასტრო რუკაზე ისედაც ხელმისაწვდომია.
# იხ. docs/superpowers/specs/2026-08-21-lisi-veli-gegma-design.md §4.2
!data/plan.geojson
```

- [ ] **Step 2: დაწერე `tools/fetch_osm.py`**

```python
# -*- coding: utf-8 -*-
u"""ერთჯერადი მოქაჩვა: OSM + ჩვენი ნაკვეთები -> data/plan.geojson.

გაშვება:  python3 tools/fetch_osm.py
დათვლა:   python3 tools/fetch_osm.py --dry-run

შედეგი რეპოში იკომიტება — ეს სნეპშოტია, არა ცოცხალი წყარო. განახლება
ნიშნავს ამ სკრიპტის ხელახლა გაშვებას.
"""
import io
import json
import os
import sys

try:
    from urllib.request import urlopen, Request
    from urllib.parse import urlencode
except ImportError:  # Python 2
    from urllib2 import urlopen, Request
    from urllib import urlencode

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from plan_lib import assign_street_names

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLOTS_GEOJSON = os.path.join(ROOT, u'კედრის_ქუჩა_ნაკვეთები.geojson')
OUT_DIR = os.path.join(ROOT, u'data')
OUT = os.path.join(OUT_DIR, u'plan.geojson')

OVERPASS = u'https://overpass-api.de/api/interpreter'
BBOX = (41.7430, 44.7165, 41.7480, 44.7225)  # S, W, N, E

# არარსებული გზები — ნახაზზე ტყუილი იქნებოდა
SKIP_ROAD_CLASSES = {u'construction', u'proposed'}

# თეთრი სია: მხოლოდ ეს ველები ხვდება საჯარო ფაილში. შავი სია აქ
# საშიში იქნებოდა — Sheet-ს ხვალ ახალი სვეტი დაემატება და ჩუმად გაჟონავს.
PLOT_FIELDS = (u'cad', u'adr_num', u'street', u'area')

COORD_PRECISION = 6  # ~0.1 მ — ფაილს ამცირებს, ნახაზზე უხილავია


def query():
    south, west, north, east = BBOX
    box = u'%s,%s,%s,%s' % (south, west, north, east)
    return (u'[out:json][timeout:100];('
            u'way["building"](%s);'
            u'way["highway"](%s);'
            u');out geom;' % (box, box))


def fetch_osm():
    data = urlencode({u'data': query()}).encode('utf-8')
    request = Request(OVERPASS, data=data,
                      headers={u'User-Agent': u'lisi-veli-plan/1.0'})
    response = urlopen(request, timeout=180)
    return json.loads(response.read().decode('utf-8'))


def round_point(lon, lat):
    return [round(lon, COORD_PRECISION), round(lat, COORD_PRECISION)]


def load_plots():
    with io.open(PLOTS_GEOJSON, encoding='utf-8') as handle:
        source = json.load(handle)
    plots = []
    for feature in source[u'features']:
        properties = feature.get(u'properties') or {}
        geometry = feature.get(u'geometry') or {}
        if geometry.get(u'type') != u'Polygon':
            continue
        plots.append({
            u'props': dict((key, properties.get(key, u''))
                           for key in PLOT_FIELDS),
            u'rings': geometry[u'coordinates'],
        })
    return plots


def split_osm(elements):
    buildings = []
    roads = []
    for element in elements:
        tags = element.get(u'tags') or {}
        geometry = element.get(u'geometry') or []
        if len(geometry) < 2:
            continue
        points = [round_point(node[u'lon'], node[u'lat']) for node in geometry]

        if u'building' in tags:
            if points[0] != points[-1]:
                points.append(points[0])
            if len(points) < 4:
                continue
            buildings.append({u'osm_id': element[u'id'], u'ring': points})
        elif u'highway' in tags:
            road_class = tags[u'highway']
            if road_class in SKIP_ROAD_CLASSES:
                continue
            roads.append({u'osm_id': element[u'id'],
                          u'name': tags.get(u'name', u''),
                          u'class': road_class,
                          u'coords': points})
    return buildings, roads


def feature(layer, properties, geometry_type, coordinates):
    props = {u'layer': layer}
    props.update(properties)
    return {u'type': u'Feature', u'properties': props,
            u'geometry': {u'type': geometry_type, u'coordinates': coordinates}}


def build(plots, buildings, roads):
    features = []
    for plot in plots:
        features.append(feature(u'plot', plot[u'props'], u'Polygon',
                                plot[u'rings']))
    for item in buildings:
        features.append(feature(u'building', {u'osm_id': item[u'osm_id']},
                                u'Polygon', [item[u'ring']]))
    for road in roads:
        features.append(feature(u'road', {
            u'osm_id': road[u'osm_id'], u'name': road[u'name'],
            u'name_src': road[u'name_src'], u'class': road[u'class'],
        }, u'LineString', road[u'coords']))
    return {u'type': u'FeatureCollection',
            u'attribution': u'გზები და ნაგებობები: © OpenStreetMap-ის '
                            u'მონაწილეები (ODbL)',
            u'features': features}


def main():
    dry_run = u'--dry-run' in sys.argv

    plots = load_plots()
    print(u'ნაკვეთი: %d' % len(plots))

    osm = fetch_osm()
    buildings, roads = split_osm(osm.get(u'elements') or [])
    print(u'შენობა: %d' % len(buildings))
    print(u'გზა: %d' % len(roads))

    vote_plots = [{u'cad': p[u'props'][u'cad'],
                   u'street': p[u'props'][u'street'],
                   u'ring': p[u'rings'][0]} for p in plots]
    roads = assign_street_names(roads, vote_plots)

    named = [r for r in roads if r[u'name']]
    print(u'\nსახელიანი გზა: %d / %d' % (len(named), len(roads)))
    for road in named:
        print(u'  %-10s %s  (%s)' % (road[u'class'], road[u'name'],
                                     road[u'name_src']))

    if dry_run:
        print(u'\n--dry-run — ფაილი არ ჩაწერილა')
        return

    if not os.path.isdir(OUT_DIR):
        os.makedirs(OUT_DIR)
    collection = build(plots, buildings, roads)
    with io.open(OUT, 'w', encoding='utf-8') as handle:
        handle.write(json.dumps(collection, ensure_ascii=False,
                                separators=(u',', u':')))
    size_kb = os.path.getsize(OUT) / 1024.0
    print(u'\nჩაიწერა %s — %d ობიექტი, %.0f KB'
          % (OUT, len(collection[u'features']), size_kb))


if __name__ == '__main__':
    main()
```

- [ ] **Step 3: გაუშვი `--dry-run` და შეამოწმე სახელების მიწერა**

```sh
python3 tools/fetch_osm.py --dry-run
```

Expected: `ნაკვეთი: 66`, `შენობა: ~83`, `გზა: ~61` (`construction` და `proposed` გამოკლებული). ბოლოს სახელიანი გზების სია.

**შეაფასე შედეგი თვალით:** ყოველი `დაშვებული` სახელი გონივრული უნდა იყოს — მაგ. `კედრის I ჩიხი` ერთ მოკლე გზას უნდა ერქვას, არა ხუთს. თუ ერთი და იგივე სახელი ბევრ გზას მიეწერა, ეს იმას ნიშნავს, რომ `radius_m=40` ამ უბნისთვის დიდია; შეამცირე 25-მდე `assign_street_names`-ის გამოძახებაში და ხელახლა გაუშვი.

- [ ] **Step 4: ჩაწერე ფაილი**

```sh
python3 tools/fetch_osm.py
```

Expected: `ჩაიწერა .../data/plan.geojson — ~210 ობიექტი, ~200 KB`

- [ ] **Step 5: შეამოწმე, რომ ფაილი git-ისთვის ხილულია და პირად ველს არ შეიცავს**

```sh
git check-ignore -v data/plan.geojson; echo "exit=$?"
python3 -c "
import json, io
d = json.load(io.open('data/plan.geojson', encoding='utf-8'))
keys = set()
for f in d['features']:
    keys.update(f['properties'].keys())
print(sorted(keys))
"
```

Expected: `git check-ignore` → `exit=1` (ანუ **არ** არის იგნორირებული).
გასაღებები **მხოლოდ**: `adr_num, area, cad, class, layer, name, name_src, osm_id, street`.
თუ სიაში `first_name`, `last_name`, `phone`, `note` ან `purpose` აღმოჩნდა — გაჩერდი, თეთრი სია გატყდა.

- [ ] **Step 6: Commit**

```sh
git add .gitignore tools/fetch_osm.py data/plan.geojson
git commit -m "feat: OSM-ის სნეპშოტი — data/plan.geojson

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: `js/lib.js` — გეგმის წმინდა გეომეტრია

**Files:**
- Modify: `js/lib.js` (ახალი ფუნქციები + `return`-ის ბლოკი ბოლოში)
- Test: `tests/weblib.test.js` (ბოლოში ემატება)

**Interfaces:**
- Consumes: არაფერი
- Produces (ყველა `WebLib`-ზე):
  - `projectPoint(lon, lat) -> {x, y}` — Web Mercator, ერთეულოვან კვადრატში, `y` ქვევით იზრდება
  - `flattenCoords(geometry) -> [[lon, lat], ...]` — `Point` / `LineString` / `Polygon` / `MultiPolygon`
  - `createProjector(points, size, padding) -> {project(lon, lat) -> {x, y}, width, height, viewBox}`
  - `polygonCentroid(ring) -> {x, y}` — `ring` არის `[{x, y}, ...]` (**პროექცირებული**, არა გეოგრაფიული)
  - `pathFromRings(rings) -> string` — დახურული, `Z`-ით
  - `pathFromLine(points) -> string` — ღია, `Z`-ის გარეშე

- [ ] **Step 1: დაწერე ჩავარდნადი ტესტები**

`tests/weblib.test.js`-ის **ბოლოში** დაამატე:

```js
// ── გეგმის გეომეტრია ────────────────────────────────────────────────

test('projectPoint — ნულოვანი წერტილი კვადრატის ცენტრშია', () => {
  const p = WebLib.projectPoint(0, 0);
  assert.ok(Math.abs(p.x - 0.5) < 1e-12);
  assert.ok(Math.abs(p.y - 0.5) < 1e-12);
});

test('projectPoint — ლისი ველის კოორდინატი', () => {
  const p = WebLib.projectPoint(44.72, 41.745);
  assert.ok(Math.abs(p.x - 0.6242222222) < 1e-9);
  assert.ok(Math.abs(p.y - 0.3721682906) < 1e-9);
});

test('projectPoint — y ქვევით იზრდება (SVG-ის მიმართულება)', () => {
  const north = WebLib.projectPoint(44.72, 41.75);
  const south = WebLib.projectPoint(44.72, 41.74);
  assert.ok(north.y < south.y);
});

test('projectPoint — Mercator ჭიმავს: ამ განედზე მასშტაბი lon-ისა და lat-ის ტოლი არაა', () => {
  // 0.001° გრძედი vs 0.001° განედი — Mercator-ში განედი ~1.34-ჯერ გრძელია
  const dx = WebLib.projectPoint(44.721, 41.745).x - WebLib.projectPoint(44.72, 41.745).x;
  const dy = WebLib.projectPoint(44.745, 41.745).y - WebLib.projectPoint(44.745, 41.746).y;
  assert.ok(dy / dx > 1.3 && dy / dx < 1.4);
});

test('flattenCoords — Polygon და LineString', () => {
  assert.deepStrictEqual(
    WebLib.flattenCoords({ type: 'LineString', coordinates: [[1, 2], [3, 4]] }),
    [[1, 2], [3, 4]]);
  assert.deepStrictEqual(
    WebLib.flattenCoords({ type: 'Polygon', coordinates: [[[1, 2], [3, 4], [1, 2]]] }),
    [[1, 2], [3, 4], [1, 2]]);
  assert.deepStrictEqual(
    WebLib.flattenCoords({ type: 'Point', coordinates: [5, 6] }), [[5, 6]]);
  assert.deepStrictEqual(WebLib.flattenCoords(null), []);
});

test('createProjector — კიდეები padding-ზე ჯდება', () => {
  const points = [[44.717, 41.743], [44.721, 41.747]];
  const proj = WebLib.createProjector(points, 1000, 0.05);
  const pad = 50; // 1000 * 0.05
  const left = proj.project(44.717, 41.743);
  const right = proj.project(44.721, 41.747);
  assert.ok(Math.abs(left.x - pad) < 1e-6);
  assert.ok(Math.abs(right.x - (1000 + pad)) < 1e-6);
  // ჩრდილოეთი ზემოთაა: 41.747 ყველაზე პატარა y-ია
  assert.ok(Math.abs(right.y - pad) < 1e-6);
  assert.ok(Math.abs(proj.width - 1100) < 1e-6);
});

test('createProjector — viewBox სიგანესა და სიმაღლეს იმეორებს', () => {
  const proj = WebLib.createProjector(
    [[44.717, 41.743], [44.721, 41.747]], 1000, 0.05);
  assert.strictEqual(proj.viewBox, '0 0 ' + proj.width + ' ' + proj.height);
});

test('createProjector — ერთი წერტილი არ ტეხს (ნულოვანი გაშლა)', () => {
  const proj = WebLib.createProjector([[44.72, 41.745]], 1000, 0.05);
  const p = proj.project(44.72, 41.745);
  assert.ok(isFinite(p.x) && isFinite(p.y));
});

test('polygonCentroid — კვადრატის ცენტრი', () => {
  const c = WebLib.polygonCentroid([
    { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }]);
  assert.ok(Math.abs(c.x - 1) < 1e-9);
  assert.ok(Math.abs(c.y - 1) < 1e-9);
});

test('polygonCentroid — დახურული რგოლი იმავე პასუხს იძლევა', () => {
  const c = WebLib.polygonCentroid([
    { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 0, y: 0 }]);
  assert.ok(Math.abs(c.x - 1) < 1e-9);
  assert.ok(Math.abs(c.y - 1) < 1e-9);
});

test('polygonCentroid — გადაგვარებული რგოლი საშუალოს აბრუნებს', () => {
  const c = WebLib.polygonCentroid([
    { x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 }]);
  assert.ok(Math.abs(c.x - 1) < 1e-9);
  assert.ok(Math.abs(c.y - 1) < 1e-9);
});

test('pathFromRings — დახურული, ორნიშნა სიზუსტით', () => {
  const d = WebLib.pathFromRings([[
    { x: 0, y: 0 }, { x: 1.005, y: 0 }, { x: 1, y: 1 }]]);
  assert.strictEqual(d, 'M0 0 L1.01 0 L1 1 Z');
});

test('pathFromLine — ღია, Z-ის გარეშე', () => {
  const d = WebLib.pathFromLine([{ x: 0, y: 0 }, { x: 5, y: 5 }]);
  assert.strictEqual(d, 'M0 0 L5 5');
});

test('pathFromLine — ცარიელი შემოსვლა ცარიელ სტრიქონს აბრუნებს', () => {
  assert.strictEqual(WebLib.pathFromLine([]), '');
  assert.strictEqual(WebLib.pathFromRings([]), '');
});
```

- [ ] **Step 2: გაუშვი და დაინახე, რომ ჩავარდება**

```sh
node --test tests/weblib.test.js
```

Expected: FAIL — `TypeError: WebLib.projectPoint is not a function`

- [ ] **Step 3: დაამატე ფუნქციები `js/lib.js`-ში**

`sortPlots`-ის შემდეგ, `return`-ის ბლოკამდე:

```js
  // ── გეგმის გეომეტრია ──────────────────────────────────────────────
  //
  // ერთი შეთანხმება მთელ ამ ბლოკზე: **გეოგრაფიული** წერტილი არის
  // `[lon, lat]` მასივი (GeoJSON-ის რიგი), **პროექცირებული** კი
  // `{x, y}` ობიექტი. ასე კომპილატორის გარეშეც ჩანს, რომელ სივრცეშია
  // მონაცემი და შემთხვევით შერევა შეუძლებელია.

  /**
   * Web Mercator ერთეულოვან კვადრატში. `y` ქვევით იზრდება — SVG-ის
   * ღერძის მიმართულება, ანუ ჩრდილოეთი ზემოთაა.
   *
   * უბრალო lon/lat არ გამოდგება: 41.7° განედზე გრძედის გრადუსი
   * განედისაზე ~25%-ით მოკლეა და ნახაზი გაბრტყელებული გამოვიდოდა.
   */
  function projectPoint(lon, lat) {
    const rad = lat * Math.PI / 180;
    return {
      x: (lon + 180) / 360,
      y: (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2,
    };
  }

  /** ნებისმიერი GeoJSON გეომეტრია -> ბრტყელი [[lon, lat], ...]. */
  function flattenCoords(geometry) {
    if (!geometry || !geometry.coordinates) return [];
    const out = [];
    (function walk(node) {
      if (typeof node[0] === 'number') { out.push([node[0], node[1]]); return; }
      node.forEach(walk);
    })(geometry.coordinates);
    return out;
  }

  /**
   * ბადება პროექტორს, რომელიც მოცემულ წერტილებს `size`-ის სიგანის
   * ყუთში სვამს, პროპორციის შენარჩუნებით და თანაბარი ველით კიდეებზე.
   *
   * რატომ ცალკე პროექტორი და არა პირდაპირ Mercator-ის მნიშვნელობები:
   * უბანი ერთეულოვან კვადრატში ~1e-5-ის ტოლ მონაკვეთს იკავებს — ასეთი
   * რიცხვები SVG-ის `d` ატრიბუტში ან სიზუსტეს კარგავს, ან ათი ციფრით
   * იწერება. `size`-ზე გადაყვანა ორივე პრობლემას ხსნის.
   */
  function createProjector(points, size, padding) {
    const width = size || 1000;
    const ratio = padding == null ? 0.06 : padding;
    const pad = width * ratio;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(function (point) {
      const p = projectPoint(point[0], point[1]);
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    // ერთი წერტილი (ან საერთოდ არცერთი) — გაშლა ნულია, მასშტაბი
    // უსასრულო გამოვიდოდა
    const spanX = (maxX - minX) || 1e-9;
    const spanY = (maxY - minY) || 1e-9;
    const scale = width / spanX;

    const boxWidth = width + pad * 2;
    const boxHeight = spanY * scale + pad * 2;

    function project(lon, lat) {
      const p = projectPoint(lon, lat);
      return { x: (p.x - minX) * scale + pad, y: (p.y - minY) * scale + pad };
    }

    return {
      project: project, width: boxWidth, height: boxHeight,
      viewBox: '0 0 ' + boxWidth + ' ' + boxHeight,
    };
  }

  /**
   * ფართობით შეწონილი ცენტროიდი — წარწერის საყრდენი წერტილი.
   * გადაგვარებულ (ნულოვანფართობიან) რგოლზე წვეროების საშუალოს
   * აბრუნებს, თორემ ნულზე გაყოფა მოხდებოდა.
   */
  function polygonCentroid(ring) {
    const points = (ring.length > 1 &&
      ring[0].x === ring[ring.length - 1].x &&
      ring[0].y === ring[ring.length - 1].y) ? ring.slice(0, -1) : ring;
    const count = points.length;
    if (!count) return { x: 0, y: 0 };

    let area = 0, cx = 0, cy = 0;
    for (let i = 0; i < count; i++) {
      const a = points[i];
      const b = points[(i + 1) % count];
      const cross = a.x * b.y - b.x * a.y;
      area += cross;
      cx += (a.x + b.x) * cross;
      cy += (a.y + b.y) * cross;
    }

    if (Math.abs(area) < 1e-12) {
      let sx = 0, sy = 0;
      points.forEach(function (p) { sx += p.x; sy += p.y; });
      return { x: sx / count, y: sy / count };
    }

    area *= 0.5;
    return { x: cx / (6 * area), y: cy / (6 * area) };
  }

  /** ორნიშნა სიზუსტე — ქვეპიქსელური, ფაილს კი შესამჩნევად ამცირებს. */
  function round2(value) {
    return Math.round(value * 100) / 100;
  }

  function pathFromLine(points) {
    if (!points || !points.length) return '';
    return points.map(function (p, index) {
      return (index === 0 ? 'M' : 'L') + round2(p.x) + ' ' + round2(p.y);
    }).join(' ');
  }

  function pathFromRings(rings) {
    if (!rings || !rings.length) return '';
    return rings.map(function (ring) {
      const line = pathFromLine(ring);
      return line ? line + ' Z' : '';
    }).filter(Boolean).join(' ');
  }
```

`return`-ის ბლოკი ხდება:

```js
  return { escapeHtml: escapeHtml, fullName: fullName, mapStatus: mapStatus,
    streetList: streetList, filterPlots: filterPlots, sortPlots: sortPlots,
    projectPoint: projectPoint, flattenCoords: flattenCoords,
    createProjector: createProjector, polygonCentroid: polygonCentroid,
    pathFromLine: pathFromLine, pathFromRings: pathFromRings };
```

- [ ] **Step 4: გაუშვი ტესტები**

```sh
node --test tests/*.test.js
```

Expected: ყველა PASS (ძველი + 14 ახალი).

- [ ] **Step 5: Commit**

```sh
git add js/lib.js tests/weblib.test.js
git commit -m "feat: WebLib — Mercator პროექცია, პროექტორი, ცენტროიდი, SVG path-ები

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: `js/plan.js` — ჰერო შესვლის ეკრანზე

**Files:**
- Create: `js/plan.js`
- Modify: `css/style.css` (ბოლოში ემატება)
- Modify: `index.html` — `screen-signin`-ის შიგთავსი, `<script src="js/plan.js">`
- Modify: `js/main.js` — `load`-ის ჰენდლერში ჰეროს გამოძახება

**Interfaces:**
- Consumes: `WebLib.createProjector`, `WebLib.flattenCoords`, `WebLib.polygonCentroid`, `WebLib.pathFromRings`, `WebLib.pathFromLine`; `data/plan.geojson`
- Produces:
  - `PlanView.renderHero(container) -> Promise<void>` — ხატავს სტატიკურ ნახაზს; ჩავარდნაზე ჩუმად ასუფთავებს კონტეინერს (ჰერო დეკორატიულია, შესვლას არ უნდა შეუშალოს)
  - `PlanView.buildSvg(base, options) -> SVGElement` — შიდა, მაგრამ ამოცანა 6 იმავე ფუნქციას იყენებს

- [ ] **Step 1: დაამატე ფერადი ტოკენები `css/style.css`-ში**

არსებული `:root` ბლოკს ემატება:

```css
:root {
  --plan-paper: #f7f4ec;
  --plan-ink: #1c1b18;
  --plan-hairline: #b9b3a2;
  --plan-building: #2b2925;
  --plan-accent: #b4552d;
}
```

არსებულ `@media (prefers-color-scheme: dark)` ბლოკს ემატება:

```css
  :root {
    --plan-paper: #14130f;
    --plan-ink: #e8e4d8;
    --plan-hairline: #3d3a33;
    --plan-building: #cfc9b8;
    --plan-accent: #d97a4a;
  }
```

- [ ] **Step 2: დაამატე გეგმის სტილი `css/style.css`-ის ბოლოში**

```css
/* ── უბნის გეგმა ──────────────────────────────────────────────────── */

.plan {
  background: var(--plan-paper);
  border: 1px solid var(--plan-hairline);
  border-radius: 8px;
  display: block;
  width: 100%;
}
.plan-hero { max-width: 560px; margin: 20px auto; }
.plan-hero .plan { max-height: 62vh; }

/* ხაზი მასშტაბთან ერთად არ სქელდება — გეგმის ხაზი ყოველთვის თხელია */
.plan path { vector-effect: non-scaling-stroke; }

.plan-plot { fill: none; stroke: var(--plan-hairline); stroke-width: 0.75; }
.plan-building { fill: var(--plan-building); stroke: none; }
.plan-road-casing { fill: none; stroke: var(--plan-hairline); }
.plan-road-fill { fill: none; stroke: var(--plan-paper); }
.plan-road-dashed { stroke-dasharray: 6 4; }

.plan-labels { fill: var(--plan-ink); }
.plan-label-address {
  text-anchor: middle; dominant-baseline: central;
  font-variant-numeric: tabular-nums; opacity: .85;
}
.plan-label-street { letter-spacing: .08em; opacity: .7; }

.plan-credit {
  color: var(--ink-muted); font-size: 11px; text-align: center; margin: 6px 0 0;
}

/* ეკრანის მკითხველისთვის — თვალით უხილავი, მაგრამ წაკითხვადი */
.visually-hidden {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap;
}
```

- [ ] **Step 3: დაწერე `js/plan.js`**

```js
/**
 * უბნის ვექტორული გეგმა — SVG, საარქიტექტორო ნახაზის სტილში.
 *
 * ორი რეჟიმი, ერთი რენდერი:
 *   `renderHero`        — შესვლის ეკრანი, სტატიკური ფაილიდან, ინტერაქციის გარეშე
 *   `render`            — რუკის ტაბი, ცოცხალი ნაკვეთებით (იხ. ამოცანა 6)
 *
 * ჩარჩო ყოველთვის **ნაკვეთებზე** ეწყობა, არა მთელ მონაცემზე: OSM-ის გზები
 * bbox-ის კიდემდე გრძელდება და თუ მათზე მოვარგებდით, უბანი შუაში პატარა
 * ლაქად დარჩებოდა. ზედმეტი გეომეტრია viewBox-ს გარეთ იჭრება — და ეს
 * განზრახაა: ნახაზი კიდეებზე „გამოდის", როგორც ბეჭდურ გეგმაზე.
 */
const PlanView = (function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const BASE_URL = 'data/plan.geojson';
  const WIDTH = 1000;
  const PADDING = 0.06;

  // გზის სისხო user unit-ებში; კლასი OSM-ის `highway` ტეგია
  const ROAD_WIDTH = { secondary: 9, tertiary: 8, residential: 7, service: 5,
    track: 3, footway: 3, path: 3, steps: 3 };
  const ROAD_WIDTH_DEFAULT = 5;
  const DASHED_ROADS = { track: true, footway: true, path: true, steps: true };

  const ADDRESS_FONT = 12;
  const STREET_FONT = 11;
  // ამაზე მოკლე გზაზე სახელი არ დაეტევა და asymmetrically ჩამოიჭრება
  const MIN_STREET_PATH = 120;

  let basePromise = null;

  function loadBase() {
    if (!basePromise) {
      basePromise = fetch(BASE_URL).then(function (response) {
        if (!response.ok) {
          throw new Error('გეგმის მონაცემი ვერ ჩაიტვირთა (' + response.status + ')');
        }
        return response.json();
      });
    }
    return basePromise;
  }

  function svgEl(name, attrs) {
    const node = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function (key) {
      node.setAttribute(key, attrs[key]);
    });
    return node;
  }

  function byLayer(features, layer) {
    return features.filter(function (f) {
      return f.properties && f.properties.layer === layer;
    });
  }

  function projectRings(coordinates, project) {
    return coordinates.map(function (ring) {
      return ring.map(function (p) { return project(p[0], p[1]); });
    });
  }

  function projectLine(coordinates, project) {
    return coordinates.map(function (p) { return project(p[0], p[1]); });
  }

  /** მტეხილი ხაზის სიგრძე user unit-ებში. */
  function lineLength(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += Math.hypot(points[i].x - points[i - 1].x,
        points[i].y - points[i - 1].y);
    }
    return total;
  }

  /**
   * SVG-ის `textPath` ტექსტს ხაზის მიმართულებით წერს. მარჯვნიდან
   * მარცხნივ მიმავალ გზაზე ეს თავდაყირა გამოდის — ასეთ ხაზს ვაბრუნებთ.
   */
  function readableDirection(points) {
    return points[points.length - 1].x < points[0].x
      ? points.slice().reverse() : points;
  }

  /**
   * ხატავს გეგმას და აბრუნებს `<svg>`-ს.
   *
   * options:
   *   plotFeatures  — რომელი ნაკვეთები დაიხატოს (ჰეროზე სტატიკური,
   *                   ინტერაქციულში სერვერიდან მოსული)
   *   plotFill(feature) -> string|null — შევსების ფერი, ან null კონტურისთვის
   *   onPlotClick(feature, event)      — არჩევითი
   */
  function buildSvg(base, options) {
    const opts = options || {};
    const features = base.features;
    const plotFeatures = opts.plotFeatures || byLayer(features, 'plot');

    // ჩარჩო ნაკვეთებზე ეწყობა — იხ. ფაილის თავში
    const framePoints = [];
    byLayer(features, 'plot').forEach(function (feature) {
      WebLib.flattenCoords(feature.geometry).forEach(function (point) {
        framePoints.push(point);
      });
    });
    const projector = WebLib.createProjector(framePoints, WIDTH, PADDING);
    const project = projector.project;

    const svg = svgEl('svg', {
      class: 'plan', viewBox: projector.viewBox,
      preserveAspectRatio: 'xMidYMid meet', role: 'img',
    });

    const defs = svgEl('defs', {});
    svg.appendChild(defs);

    const gCasing = svgEl('g', { class: 'plan-roads-casing' });
    const gFill = svgEl('g', { class: 'plan-roads-fill' });
    const gPlots = svgEl('g', { class: 'plan-plots' });
    const gBuildings = svgEl('g', { class: 'plan-buildings' });
    const gAddresses = svgEl('g', {
      class: 'plan-labels plan-addresses', 'font-size': ADDRESS_FONT });
    const gStreets = svgEl('g', {
      class: 'plan-labels plan-streets', 'font-size': STREET_FONT });
    [gCasing, gFill, gPlots, gBuildings, gAddresses, gStreets]
      .forEach(function (group) { svg.appendChild(group); });

    // 1-2. გზები: ჯერ მუქი კიდე, ზემოდან ქაღალდისფერი სხეული — შედეგად
    // ორი პარალელური ხაზი, როგორც ბეჭდურ გეგმაზე
    byLayer(features, 'road').forEach(function (feature, index) {
      const points = projectLine(feature.geometry.coordinates, project);
      if (points.length < 2) return;
      const roadClass = feature.properties.class;
      const width = ROAD_WIDTH[roadClass] || ROAD_WIDTH_DEFAULT;
      const dashed = DASHED_ROADS[roadClass] ? ' plan-road-dashed' : '';
      const d = WebLib.pathFromLine(points);

      gCasing.appendChild(svgEl('path', {
        class: 'plan-road-casing' + dashed, d: d, 'stroke-width': width + 1.5 }));
      gFill.appendChild(svgEl('path', {
        class: 'plan-road-fill' + dashed, d: d, 'stroke-width': width }));

      // 6. ქუჩის სახელი გზის ღერძზე
      const name = feature.properties.name;
      if (name && lineLength(points) >= MIN_STREET_PATH) {
        const id = 'plan-road-' + index;
        defs.appendChild(svgEl('path', {
          id: id, d: WebLib.pathFromLine(readableDirection(points)) }));
        const text = svgEl('text', { class: 'plan-label-street' });
        const textPath = svgEl('textPath', { startOffset: '50%',
          'text-anchor': 'middle' });
        textPath.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + id);
        textPath.setAttribute('href', '#' + id);
        textPath.textContent = name;
        text.appendChild(textPath);
        gStreets.appendChild(text);
      }
    });

    // 3. საკადასტრო კონტურები + 5. მისამართის ნომრები
    plotFeatures.forEach(function (feature) {
      const rings = projectRings(feature.geometry.coordinates, project);
      if (!rings.length || !rings[0].length) return;
      const fill = opts.plotFill ? opts.plotFill(feature) : null;

      const path = svgEl('path', {
        class: 'plan-plot', d: WebLib.pathFromRings(rings) });
      if (fill) {
        // inline style, არა ატრიბუტი: `.plan-plot { fill: none }` CSS-ის
        // წესია და პრეზენტაციულ ატრიბუტს კასკადში აჯობებდა
        path.style.fill = fill;
        path.style.fillOpacity = '0.35';
      }
      if (opts.onPlotClick) {
        path.style.cursor = 'pointer';
        path.addEventListener('click', function (event) {
          opts.onPlotClick(feature, event);
        });
      }
      gPlots.appendChild(path);

      const number = String(feature.properties.adr_num || '').trim();
      if (number) {
        const center = WebLib.polygonCentroid(rings[0]);
        const label = svgEl('text', {
          class: 'plan-label-address', x: center.x, y: center.y });
        label.textContent = number;
        gAddresses.appendChild(label);
      }
    });

    // 4. ნაგებობები — ნაკვეთის კონტურზე ზემოთ, რომ ჩადგმული ჩანდეს
    byLayer(features, 'building').forEach(function (feature) {
      const rings = projectRings(feature.geometry.coordinates, project);
      if (!rings.length) return;
      gBuildings.appendChild(svgEl('path', {
        class: 'plan-building', d: WebLib.pathFromRings(rings) }));
    });

    svg._planProjector = projector;
    svg._planLabelGroups = [gAddresses, gStreets];
    return svg;
  }

  function creditNode(base) {
    const credit = document.createElement('p');
    credit.className = 'plan-credit';
    credit.textContent = base.attribution ||
      'გზები და ნაგებობები: © OpenStreetMap-ის მონაწილეები (ODbL)';
    return credit;
  }

  /**
   * შესვლის ეკრანის ნახაზი. დეკორატიულია — ჩავარდნაზე ჩუმად ქრება,
   * რადგან ავტორიზაციის ღილაკი მისგან დამოუკიდებლად უნდა მუშაობდეს.
   */
  function renderHero(container) {
    if (!container) return Promise.resolve();
    return loadBase().then(function (base) {
      const svg = buildSvg(base, {});
      svg.setAttribute('aria-hidden', 'true');
      container.innerHTML = '';
      container.appendChild(svg);
      container.appendChild(creditNode(base));
    }).catch(function () {
      container.innerHTML = '';
    });
  }

  return { renderHero: renderHero, buildSvg: buildSvg, loadBase: loadBase };
})();
```

- [ ] **Step 4: ჩასვი ჰერო `index.html`-ში**

`screen-signin` ხდება:

```html
<div id="screen-signin" class="screen" hidden>
  <h1>ლისი ველი</h1>
  <div id="plan-hero" class="plan-hero"></div>
  <p class="visually-hidden">
    ლისი ველის უბნის გეგმა: რვა ქუჩა, 66 საკადასტრო ნაკვეთი,
    ნაგებობების კონტურებით და მისამართებით.
  </p>
  <p>სისტემაში შესასვლელად გაიარეთ ავტორიზაცია Google-ით.</p>
  <div id="signin-button"></div>
</div>
```

სკრიპტების სიაში, `js/map.js`-ის შემდეგ:

```html
<script src="js/plan.js"></script>
```

- [ ] **Step 5: გამოიძახე ჰერო `js/main.js`-ში**

`window.addEventListener('load', ...)`-ის **პირველივე ხაზად**, `configNotFilled()`-ის შემოწმებამდე:

```js
window.addEventListener('load', function () {
  // ჰერო კონფიგურაციის შემოწმებამდე იხატება: შევსებული `js/config.js`
  // თუ არა, შესვლის ეკრანი ორივე შემთხვევაში ჩანს და ნახაზიც უნდა ჩანდეს.
  PlanView.renderHero(UI.el('plan-hero'));

  if (configNotFilled()) {
```

- [ ] **Step 6: შეამოწმე ბრაუზერში**

`http://localhost:8080/` → hard refresh.

Expected:
- შესვლის ეკრანზე ქაღალდისფერ ფონზე უბნის გეგმა
- გზები ორმაგი ხაზით, შენობები მუქი ბლოკებით, ნაკვეთები თხელი კონტურით
- მისამართის ნომრები ნაკვეთებში, ქუჩების სახელები გზებზე
- ქვემოთ OSM-ის ატრიბუცია
- კონსოლში შეცდომა არ არის

**თუ წარწერები ერთმანეთს ფარავს ან ძალიან პატარაა:** დაარეგულირე `ADDRESS_FONT` (12) და `STREET_FONT` (11) `js/plan.js`-ის თავში. ეს ერთადერთი ადგილია, სადაც ზომა იწერება.

- [ ] **Step 7: შეამოწმე ბნელი თემა**

macOS: System Settings → Appearance → Dark. გვერდი გადატვირთვის გარეშე უნდა შეიცვალოს (CSS ცვლადებია).

Expected: მუქი ქაღალდი, ღია მელანი, შენობები ღია ბლოკებით — ყველაფერი იკითხება.

- [ ] **Step 8: გაუშვი ტესტები**

```sh
node --test tests/*.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit**

```sh
git add js/plan.js css/style.css index.html js/main.js
git commit -m "feat: უბნის ვექტორული გეგმა შესვლის ეკრანზე

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: ინტერაქციული რეჟიმი და Leaflet-ის ამოღება

**Files:**
- Modify: `js/plan.js` (ემატება `render`, `refresh`, pan/zoom, პოპაპი, ლეგენდა)
- Modify: `css/style.css` (პოპაპი, ლეგენდა)
- Modify: `index.html` (Leaflet-ის ორი CDN ტეგი და `js/map.js` ქრება)
- Modify: `js/ui.js:16`
- Modify: `js/main.js` (`MapView.render` → `PlanView.render`)
- Delete: `js/map.js`

**Interfaces:**
- Consumes: ამოცანა 5-ის `buildSvg`, `loadBase`; `WebLib.mapStatus`, `WebLib.streetList`, `WebLib.escapeHtml`, `WebLib.fullName`; `TableView.openEditor(cad)`
- Produces:
  - `PlanView.render(plots, user) -> Promise<void>` — `MapView.render`-ის ზუსტი შემცვლელი
  - `PlanView.refresh() -> void` — `MapView.refresh`-ის ზუსტი შემცვლელი

- [ ] **Step 1: გადმოიტანე პალიტრა და პოპაპი `js/map.js`-იდან**

`js/plan.js`-ის თავში, `basePromise`-ის გამოცხადებამდე, ჩასვი **უცვლელად** `js/map.js`-ის პალიტრის ბლოკი (კომენტარის ჩათვლით — dataviz-ის ვალიდაცია იქ არის აღწერილი):

```js
  // dataviz-ის ვალიდირებული კატეგორიული პალიტრა, ფიქსირებული რიგით.
  // 8 ქუჩა = 8 სლოტი. ფერები არასოდეს ციკლდება — მე-9 ქუჩა ნაცრისფერში
  // ჩავარდება. light და dark ცალკე მასივებია: dataviz-ის ვალიდატორი
  // ერთი პალიტრით ორივე ზედაპირს ვერ ამტკიცებს (light-ის ფერები dark
  // ზედაპირზე Lightness band-ს არღვევენ) — ამიტომ ბნელი რეჟიმისთვის
  // საცნობარო დოკუმენტის საკუთარი dark სვეტია. მე-6 სლოტი (მწვანე)
  // ორივეგან ერთია — ეს საცნობარო მასივის მიხედვით სწორია, არა კოპირების
  // შეცდომა.
  const PALETTE_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100',
    '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
  const PALETTE_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500',
    '#d55181', '#008300', '#9085e9', '#e66767'];
  const GREY = '#898781';

  const DARK_QUERY = (typeof window !== 'undefined' && window.matchMedia)
    ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  let colorByStreet = {};
  let plots = [];
  let user = null;
  let container = null;

  function activePalette() {
    return (DARK_QUERY && DARK_QUERY.matches) ? PALETTE_DARK : PALETTE_LIGHT;
  }

  function colorOf(plot) {
    return colorByStreet[String(plot.street || '').trim()] || GREY;
  }

  function popupHtml(plot) {
    const phone = plot.phone
      ? '<a href="tel:' + WebLib.escapeHtml(plot.phone) + '">' + WebLib.escapeHtml(plot.phone) + '</a>' : '—';
    const edit = (user && (user.role === 'moderator' || user.role === 'admin'))
      ? '<button data-edit="' + WebLib.escapeHtml(plot.cad) + '">✏️ რედაქტირება</button>'
      : '';
    return '<b>' + WebLib.escapeHtml(plot.address || plot.cad) + '</b><br>' +
      WebLib.escapeHtml(WebLib.fullName(plot)) + '<br>' + phone + '<br>' +
      (plot.area ? WebLib.escapeHtml(plot.area) + ' კვ.მ' : '') + '<br>' +
      '<small>' + WebLib.escapeHtml(plot.purpose || '') + '</small><br>' +
      '<code>' + WebLib.escapeHtml(plot.cad) + '</code><br>' + edit;
  }
```

- [ ] **Step 2: დაამატე pan/zoom `js/plan.js`-ში**

`buildSvg`-ის შემდეგ:

```js
  /**
   * pan/zoom `viewBox`-ის მანიპულაციით — Leaflet-ის გარეშე.
   *
   * წარწერების `font-size` ყოველ ცვლილებაზე გადაითვლება: user unit-ებში
   * მუდმივი ზომა ეკრანზე zoom-თან ერთად გაიზრდებოდა.
   */
  function attachPanZoom(svg) {
    const start = svg.getAttribute('viewBox').split(' ').map(Number);
    let box = start.slice();
    let dragging = null;

    function apply() {
      svg.setAttribute('viewBox', box.join(' '));
      const k = box[2] / start[2];
      svg._planLabelGroups[0].setAttribute('font-size', ADDRESS_FONT * k);
      svg._planLabelGroups[1].setAttribute('font-size', STREET_FONT * k);
    }

    /** ეკრანის კოორდინატი -> viewBox-ის კოორდინატი. */
    function toBox(clientX, clientY) {
      const rect = svg.getBoundingClientRect();
      return {
        x: box[0] + (clientX - rect.left) / rect.width * box[2],
        y: box[1] + (clientY - rect.top) / rect.height * box[3],
      };
    }

    svg.addEventListener('wheel', function (event) {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 1.15 : 1 / 1.15;
      // 8-ჯერ ჩაახლოება საკმარისია ერთი ნაკვეთის დასათვალიერებლად;
      // 1-ზე მეტი დაშორება მთელ ნახაზზე პატარას აზრი არ აქვს
      const width = Math.min(start[2], Math.max(start[2] / 8, box[2] * factor));
      const scale = width / box[2];
      const anchor = toBox(event.clientX, event.clientY);
      box = [
        anchor.x - (anchor.x - box[0]) * scale,
        anchor.y - (anchor.y - box[1]) * scale,
        box[2] * scale, box[3] * scale,
      ];
      apply();
    }, { passive: false });

    svg.addEventListener('pointerdown', function (event) {
      dragging = { x: event.clientX, y: event.clientY, box: box.slice() };
      svg.setPointerCapture(event.pointerId);
    });

    svg.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      const rect = svg.getBoundingClientRect();
      box[0] = dragging.box[0] - (event.clientX - dragging.x) / rect.width * box[2];
      box[1] = dragging.box[1] - (event.clientY - dragging.y) / rect.height * box[3];
      apply();
    });

    function endDrag(event) {
      if (!dragging) return;
      dragging = null;
      if (svg.hasPointerCapture(event.pointerId)) {
        svg.releasePointerCapture(event.pointerId);
      }
    }
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);

    svg.addEventListener('dblclick', function () {
      box = start.slice();
      apply();
    });
  }
```

- [ ] **Step 3: დაამატე პოპაპი, ლეგენდა და `render` `js/plan.js`-ში**

`renderHero`-ის შემდეგ:

```js
  function hidePopup() {
    const popup = container && container.querySelector('.plan-popup');
    if (popup) popup.hidden = true;
  }

  /**
   * პოპაპი HTML-ია, არა SVG — Leaflet-ის ბარათის იგივე შიგთავსი, იმავე
   * `data-edit` პატერნით (cad-ის onclick-ატრიბუტში ჩაწერა ერთი ბრჭყალის
   * შემთხვევაში მარკაპს ტეხდა).
   */
  function showPopup(plot, event) {
    const popup = container.querySelector('.plan-popup');
    popup.innerHTML = popupHtml(plot);
    const box = container.getBoundingClientRect();
    popup.style.left = (event.clientX - box.left) + 'px';
    popup.style.top = (event.clientY - box.top) + 'px';
    popup.hidden = false;

    const button = popup.querySelector('[data-edit]');
    if (button) {
      button.addEventListener('click', function () {
        TableView.openEditor(button.getAttribute('data-edit'));
      });
    }
  }

  /**
   * ცოცხალი ნაკვეთი -> Feature. გეომეტრია სერვერიდან მოდის, არა
   * სტატიკური ფაილიდან: Sheet-ში შესწორებული კონტური მაშინვე უნდა ჩანდეს.
   */
  function livePlotFeatures(list) {
    return list.filter(function (plot) {
      return WebLib.mapStatus(plot) === 'polygon';
    }).map(function (plot) {
      return {
        type: 'Feature',
        properties: { layer: 'plot', cad: plot.cad, adr_num: plot.num,
          street: plot.street, plot: plot },
        geometry: { type: 'Polygon', coordinates: plot.geometry },
      };
    });
  }

  function renderLegend(streets) {
    return '<h4>ქუჩები</h4>' + streets.map(function (street) {
      return '<span class="legend-item">' +
        '<i style="background:' + (colorByStreet[street] || GREY) + '"></i>' +
        WebLib.escapeHtml(street) + '</span>';
    }).join('');
  }

  function renderMissing(missing) {
    if (!missing.length) return '';
    return '<h4>რუკაზე არ ჩანს (' + missing.length + ')</h4>' +
      '<p>ამ ნაკვეთებს არც პოლიგონი აქვთ, არც კოორდინატი. ' +
      'ადმინმა Sheet-ში უნდა შეავსოს <code>გეომეტრია</code> ან ' +
      '<code>გრძედი</code>/<code>განედი</code>.</p><ul>' +
      missing.map(function (plot) {
        return '<li><code>' + WebLib.escapeHtml(plot.cad) + '</code> — ' +
          WebLib.escapeHtml(plot.address || 'მისამართის გარეშე') + '</li>';
      }).join('') + '</ul>';
  }

  /** რუკის ტაბი. `MapView.render`-ის ზუსტი შემცვლელი. */
  function render(allPlots, currentUser) {
    plots = allPlots;
    user = currentUser;

    const palette = activePalette();
    const streets = WebLib.streetList(plots);
    colorByStreet = {};
    streets.forEach(function (street, index) {
      if (index < palette.length) colorByStreet[street] = palette[index];
    });

    return loadBase().then(function (base) {
      container = UI.el('panel-map');
      container.innerHTML = '<div id="plan-canvas"></div>' +
        '<div class="plan-popup" hidden></div>' +
        '<p class="plan-credit"></p>' +
        '<div id="map-legend"></div><div id="map-missing"></div>';
      container.style.position = 'relative';

      const svg = buildSvg(base, {
        plotFeatures: livePlotFeatures(plots),
        plotFill: function (feature) { return colorOf(feature.properties.plot); },
        onPlotClick: function (feature, event) {
          event.stopPropagation();
          showPopup(feature.properties.plot, event);
        },
      });
      svg.setAttribute('aria-label', 'ლისი ველის უბნის ინტერაქციული გეგმა');
      UI.el('plan-canvas').appendChild(svg);
      attachPanZoom(svg);

      // ცარიელ ადგილას დაწკაპუნება პოპაპს ხურავს
      svg.addEventListener('click', hidePopup);

      // მარკერი უპოლიგონო, მაგრამ კოორდინატიან ნაკვეთს — იგივე
      // fallback, რაც Leaflet-ის ვერსიას ჰქონდა
      const projector = svg._planProjector;
      const markers = svgEl('g', { class: 'plan-markers' });
      const missing = [];
      plots.forEach(function (plot) {
        const status = WebLib.mapStatus(plot);
        if (status === 'polygon') return;
        if (status === 'missing') { missing.push(plot); return; }
        const point = projector.project(Number(plot.lon), Number(plot.lat));
        const color = colorOf(plot);
        const dot = svgEl('circle', { cx: point.x, cy: point.y, r: 6,
          fill: color, stroke: color, 'fill-opacity': '0.8' });
        dot.style.cursor = 'pointer';
        dot.addEventListener('click', function (event) {
          event.stopPropagation();
          showPopup(plot, event);
        });
        markers.appendChild(dot);
      });
      svg.appendChild(markers);

      container.querySelector('.plan-credit').textContent = base.attribution;
      UI.el('map-legend').innerHTML = renderLegend(streets);
      UI.el('map-missing').innerHTML = renderMissing(missing);
    }).catch(function (error) {
      UI.el('panel-map').innerHTML = '<p>' +
        WebLib.escapeHtml(error.message || 'გეგმა ვერ ჩაიტვირთა') + '</p>';
    });
  }

  /** ტაბზე გადმოსვლა. SVG თავად ეწყობა კონტეინერს — საქმე არ აქვს. */
  function refresh() {}

  // OS-ში თემის გადართვისას ნახაზი ხელახლა უნდა დაიხატოს ახალი
  // პალიტრით — თორემ ლეგენდა ერთ რეჟიმში ჩერდება, ნაკვეთები მეორეში.
  if (DARK_QUERY) {
    DARK_QUERY.addEventListener('change', function () {
      if (container) render(plots, user);
    });
  }
```

`return`-ის ბლოკი ხდება:

```js
  return { renderHero: renderHero, render: render, refresh: refresh,
    buildSvg: buildSvg, loadBase: loadBase };
```

- [ ] **Step 4: დაამატე პოპაპის სტილი `css/style.css`-ში**

```css
#plan-canvas .plan { height: 70vh; }
.plan-popup {
  position: absolute; z-index: 500; max-width: 260px;
  background: var(--surface); color: var(--ink);
  border: 1px solid var(--line); border-radius: 8px;
  padding: 10px 12px; font-size: 14px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, .2);
  transform: translate(-50%, calc(-100% - 10px));
}
.plan-popup code { background: var(--line); padding: 1px 4px; border-radius: 3px; }
```

- [ ] **Step 5: გადართე `js/ui.js` და `js/main.js`**

`js/ui.js:16`:

```js
    if (name === 'map' && window.PlanView) PlanView.refresh();
```

`js/main.js`-ში `MapView.render(PLOTS, CURRENT_USER);` ხდება:

```js
    PlanView.render(PLOTS, CURRENT_USER);
```

- [ ] **Step 6: ამოიღე Leaflet და `js/map.js`**

`index.html`-იდან იშლება:

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="js/map.js"></script>
```

`css/style.css`-იდან იშლება `#map { height: 70vh; ... }` წესი (მისი ადგილი `#plan-canvas .plan`-მა დაიკავა).

```sh
git rm js/map.js
```

- [ ] **Step 7: შეამოწმე, რომ Leaflet-ის კვალი აღარაა**

```sh
grep -rn "leaflet\|Leaflet\|MapView\|L\.map\|L\.polygon" index.html js/ css/
```

Expected: არცერთი დამთხვევა.

- [ ] **Step 8: შეამოწმე ბრაუზერში (მოითხოვს შევსებულ `js/config.js`-ს)**

შედი სისტემაში → „რუკა" ტაბი.

Expected:
- გეგმა ჩანს, ნაკვეთები ქუჩების ფერებით შევსებული
- ლეგენდა 8 ქუჩით
- ბორბალი აახლოებს/აშორებს კურსორის ირგვლივ, გადათრევა მუშაობს, ორმაგი დაწკაპუნება ბრუნდება საწყის ხედზე
- ნაკვეთზე დაწკაპუნება ხსნის ბარათს: მისამართი, სახელი, ტელეფონი, ფართობი, კოდი
- მოდერატორის/ადმინის როლზე ბარათში ✏️ ღილაკი ხსნის რედაქტორს
- „რუკაზე არ ჩანს (N)" სია ბოლოშია
- ქსელის ჩანართში `unpkg.com`-ზე მოთხოვნა აღარ არის

- [ ] **Step 9: გაუშვი ტესტები**

```sh
node --test tests/*.test.js
python3 -m unittest discover -s tools -p 'test_*.py'
```

Expected: ორივე PASS.

- [ ] **Step 10: Commit**

```sh
git add -A index.html js/ css/style.css
git commit -m "feat: რუკის ტაბი ვექტორულ გეგმაზე გადავიდა, Leaflet ამოღებულია

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: დოკუმენტაცია

**Files:**
- Modify: `README.md` — ფაილების რუკა, არქიტექტურა, `data/` და `tools/fetch_osm.py`
- Modify: `docs/qa-checklist.md` — „რუკა" სექცია და ახალი „გეგმა" პუნქტები

**Interfaces:**
- Consumes: ამოცანები 1-6
- Produces: არაფერი

- [ ] **Step 1: განაახლე `README.md`-ის ფაილების რუკა**

ცხრილს ემატება:

```markdown
| `data/` | `plan.geojson` — უბნის გეგმის სტატიკური სნეპშოტი (საკადასტრო კონტურები + OSM-ის შენობები და გზები). პირად ველს არ შეიცავს, ამიტომ `.gitignore`-ის გამონაკლისია |
```

`tools/`-ის სტრიქონი ხდება:

```markdown
| `tools/` | ერთჯერადი სკრიპტები: `import.py` (`.xlsx` + `.geojson` → `build/*.csv`) და `fetch_osm.py` (OSM → `data/plan.geojson`) |
```

`js/`-ის სტრიქონში `map.js` იცვლება `plan.js`-ით.

- [ ] **Step 2: დაამატე განყოფილება გეგმის განახლებაზე `README.md`-ში**

„ტესტები" სექციამდე:

```markdown
## უბნის გეგმა

მთავარ გვერდზე და რუკის ტაბში ერთი და იგივე ვექტორული ნახაზი დგას —
`js/plan.js` ხატავს `data/plan.geojson`-იდან. ტაილები და Leaflet აღარ გამოიყენება.

`data/plan.geojson` **სნეპშოტია, არა ცოცხალი წყარო.** OSM-ში შენობა ან გზა თუ
შეიცვალა, განახლება ხელით ხდება:

    python3 tools/fetch_osm.py --dry-run   # ჯერ დათვალე და სახელები შეამოწმე
    python3 tools/fetch_osm.py             # შემდეგ ჩაწერე

გზების სახელები OSM-ში თითქმის არ არის — სკრიპტი მათ ჩვენი ნაკვეთების `ქუჩა`
ველიდან აწერს ახლომდებარე ნაკვეთების ხმებით (≥3 ხმა და ≥60%). ვერ გადალახა
ზღვარი — გზა უწარწეროდ რჩება.
```

- [ ] **Step 3: განაახლე `docs/qa-checklist.md`-ის „რუკა" სექცია**

არსებული პუნქტები რჩება (66 პოლიგონი, ლეგენდა, „რუკაზე არ ჩანს", ბარათი,
დაზიანებული გეომეტრია), ოღონდ სექციის დასაწყისში ემატება:

```markdown
## გეგმა (შესვლის ეკრანი)

- [ ] **ავტორიზაციამდე** მთავარ გვერდზე უბნის ვექტორული ნახაზი ჩანს
- [ ] ნახაზზე იკითხება მისამართის ნომრები და ქუჩების სახელები
- [ ] ქვემოთ წერია OpenStreetMap-ის ატრიბუცია
- [ ] ბნელ თემაზე გადართვისას ნახაზი გადატვირთვის გარეშე იცვლება და იკითხება
- [ ] ქსელის ჩანართში `unpkg.com`-ზე (Leaflet) მოთხოვნა **არ არის**
- [ ] `data/plan.geojson`-ის შიგთავსში **არ არის** სახელი, გვარი ან ტელეფონი:
      `python3 -c "import json,io;d=json.load(io.open('data/plan.geojson',encoding='utf-8'));print(sorted({k for f in d['features'] for k in f['properties']}))"`
      → მხოლოდ `adr_num, area, cad, class, layer, name, name_src, osm_id, street`
```

და „რუკა" სექციას ემატება:

```markdown
- [ ] ბორბალი აახლოებს კურსორის ირგვლივ, გადათრევა მუშაობს, ორმაგი
      დაწკაპუნება საწყის ხედს აბრუნებს
- [ ] ჩაახლოებისას წარწერების ზომა ეკრანზე უცვლელი რჩება (არ იზრდება)
- [ ] ნახაზის ცარიელ ადგილას დაწკაპუნება ბარათს ხურავს
```

- [ ] **Step 4: Commit**

```sh
git add README.md docs/qa-checklist.md
git commit -m "docs: გეგმის განახლების წესი და QA პუნქტები

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## დამოკიდებულებების რიგი

```
1 (სახელი)  ────────────────────────────────► დამოუკიდებელი
2 (plan_lib) ──► 3 (fetch_osm → data/plan.geojson) ──┐
4 (WebLib გეომეტრია) ────────────────────────────────┤
                                                     ▼
                                          5 (ჰერო) ──► 6 (ინტერაქციული) ──► 7 (docs)
```

ამოცანები 1, 2 და 4 ერთმანეთისგან დამოუკიდებელია და პარალელურად შეიძლება.
ამოცანა 5 ორივეს — 3-ს და 4-ს — ელოდება.
