# -*- coding: utf-8 -*-
"""სუფთა ფუნქციები იმპორტისთვის — ფაილებს არ ეხება, ამიტომ იტესტება."""
import json


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


def index_features_by_cad(features):
    u"""[GeoJSON Feature] -> ({cad: feature}, [გამეორებული კოდები], კოდის_გარეშე_რაოდენობა).

    პირველი feature რჩება. properties ან cad-ის არმქონე feature გამოირიცხება
    ინდექსიდან და ითვლება, მაგრამ არ ისროლება შეცდომა.
    """
    out = {}
    dups = []
    missing = 0
    for feature in features:
        props = (feature or {}).get(u'properties') or {}
        cad = (props.get(u'cad') or u'').strip()
        if not cad:
            missing += 1
            continue
        if cad in out:
            if cad not in dups:
                dups.append(cad)
            continue
        out[cad] = feature
    return (out, dups, missing)


def normalize_phone(raw):
    u"""ნომერი `+995XXXXXXXXX` ფორმაში, ან ცარიელი.

    იგივე წესი, რაც სერვერზე (`apps-script/lib.js`): წამყვანი `+`
    საერთაშორისო ნომრის ნიშანია და უცვლელად რჩება; მის გარეშე მხოლოდ
    ქართული ფორმატი მიიღება. ორ ადგილას ერთი და იგივე წესი იმიტომაა,
    რომ იმპორტმა ისეთი ნომერი არ ჩაწეროს, რომელსაც სერვერი უარყოფდა.
    """
    text = (raw or u'').strip()
    if not text:
        return u''
    international = text.startswith(u'+')
    digits = u''.join(ch for ch in text if ch.isdigit())
    if not digits:
        return u''
    if international:
        return u'+' + digits if 8 <= len(digits) <= 15 else u''
    if len(digits) == 9:
        return u'+995' + digits
    if len(digits) == 12 and digits.startswith(u'995'):
        return u'+995' + digits[3:]
    return u''


def normalize_cad(cad):
    u"""საკადასტრო კოდის შესადარებელი სახე.

    ერთი და იგივე ნაკვეთი დოკუმენტში `72.16.097.011`-ად წერია, ბაზაში
    კი `01.72.16.097.011`-ად. ბოლო ოთხი სეგმენტი ორივეში ერთია.
    """
    parts = [p for p in unicode_str(cad).strip().split(u'.') if p]
    return u'.'.join(parts[-4:]) if len(parts) >= 4 else u'.'.join(parts)


def unicode_str(value):
    return value if isinstance(value, type(u'')) else (u'' if value is None else str(value))


def phones_from_rows(rows):
    u"""(კოდი, ნომერი) წყვილებიდან -> {ნორმალიზებული_კოდი: ნომერი}.

    ერთსა და იმავე ნაკვეთზე ორი სხვადასხვა ნომერი რომ იყოს, პირველი
    რჩება და მეორე `conflicts`-ში ჩანს — ჩუმად გადაწერა ისეთი შეცდომაა,
    რომელიც მხოლოდ მაშინ აღმოჩნდება, როცა ვიღაცას ვერ დაურეკავენ.
    """
    out = {}
    conflicts = []
    skipped = []
    for cad, raw in rows:
        key = normalize_cad(cad)
        phone = normalize_phone(raw)
        if not key:
            continue
        if not phone:
            skipped.append(cad)
            continue
        if key in out and out[key] != phone:
            conflicts.append(cad)
            continue
        out[key] = phone
    return (out, conflicts, skipped)
