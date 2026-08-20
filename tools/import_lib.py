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
