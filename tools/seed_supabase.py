#!/usr/bin/env python3
"""build/plots.csv + build/phones.json → INSERT-ები stdout-ზე.

სკრიპტი PII-ს არ შეიცავს — მას მხოლოდ კითხულობს და მილში აგზავნის:

    python3 tools/seed_supabase.py | tools/sbsql.sh

გენერირებული SQL ფაილად არსად არ ინახება: ტელეფონები და სახელები
დისკზე მხოლოდ იქ რჩება, სადაც უკვე იყო.
"""
import csv, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
COLS = {
    'საკადასტრო კოდი': 'cad', 'ქუჩა': 'street', 'N': 'num',
    'სრული მისამართი': 'address', 'ფართობი კვ.მ': 'area',
    'დანიშნულება': 'purpose', 'სახელი': 'first_name', 'გვარი': 'last_name',
    'ტელეფონი': 'phone', 'გრძედი': 'lon', 'განედი': 'lat',
    'გეომეტრია': 'geometry', 'წყარო': 'source', 'შენიშვნა': 'note',
}
NUMERIC = {'area', 'lat', 'lon'}
# `build/phones.json`-ის გასაღებებში ერთ კოდს სეგმენტი აკლია. ნაკვეთი
# `plots.csv`-ში სწორი კოდით არის, ასე რომ ეს ტელეფონი უპატრონოდ რჩებოდა.
PHONE_KEY_FIXES = {'01.72.097.077': '01.72.16.097.077'}
JSONB = {'geometry'}


def lit(value, key):
    """SQL-ის ლიტერალი. ცარიელი სტრიქონი NULL-ია, არა ''."""
    if value is None or value.strip() == '':
        return 'null'
    v = value.strip()
    if key in NUMERIC:
        try:
            f = float(v)
        except ValueError:
            return 'null'
        return 'null' if key == 'area' and f <= 0 else repr(f)
    quoted = "'" + v.replace("'", "''") + "'"
    return quoted + '::jsonb' if key in JSONB else quoted


def main():
    raw_phones = json.loads((ROOT / 'build' / 'phones.json').read_text())
    phones = {PHONE_KEY_FIXES.get(k, k): v for k, v in raw_phones.items()}
    rows = list(csv.DictReader((ROOT / 'build' / 'plots.csv').open(encoding='utf-8')))

    keys = list(COLS.values())
    values = []
    for row in rows:
        cad = row['საკადასტრო კოდი'].strip()
        if not cad:
            continue
        # phones.json უფრო ახალია — ხელით შეყვანილი ნომერი CSV-ს სჯობს.
        row['ტელეფონი'] = phones.get(cad) or row.get('ტელეფონი', '')
        values.append('(' + ', '.join(lit(row.get(g, ''), k)
                                      for g, k in COLS.items()) + ')')

    if not values:
        sys.exit('ჩასაწერი არაფერია')

    print('begin;')
    print(f'insert into public.plots ({", ".join(keys)}) values')
    print(',\n'.join(values))
    print("""on conflict (cad) do update set
  street = excluded.street, num = excluded.num, address = excluded.address,
  area = excluded.area, purpose = excluded.purpose,
  first_name = excluded.first_name, last_name = excluded.last_name,
  phone = coalesce(excluded.phone, public.plots.phone),
  lat = excluded.lat, lon = excluded.lon, geometry = excluded.geometry,
  source = excluded.source, note = excluded.note;""")
    print('commit;')
    print("select count(*) as ნაკვეთი, count(phone) as ტელეფონით, "
          "count(geometry) as გეომეტრიით, count(first_name) as მფლობელით "
          "from public.plots;")


if __name__ == '__main__':
    main()
