# -*- coding: utf-8 -*-
"""პერსონალური მონაცემების დეტექტორი.

ლექსიკონს წყარო-ფაილებიდან აგებს (`.gitignore`-შია, ლოკალურად ცხოვრობს) და
ეძებს მათ იმაში, რასაც git-ში ვუშვებთ. ლექსიკონი repo-ში არასოდეს იწერება —
არც ღიად, არც ჰეშად — თორემ თვითონ დამცავი გახდებოდა გაჟონვის წყარო.

გამოყენება:
    python3 .githooks/pii_scan.py --staged
    python3 .githooks/pii_scan.py --commits <rev> [<rev> ...]
"""
import os
import re
import subprocess
import sys
import zipfile

# მფლობელის საკუთარი მონაცემები — მისი repo-ა, მისი სახელი მასში ჩანს
ALLOW = {'გაბრიაძე', 'ზურაბ', 'g.gabriadze@gmail.com'}

SOURCES = ('განცხადება მერიაში.docx',
           'კედრის_ქუჩა_ხელმოწერები.xlsx',
           'კედრის_ქუჩა_ნაკვეთები.geojson')

CAD_RE = re.compile(r'\b\d{2}(?:\.\d{2,3}){2,4}\b')
# ტელეფონში წერტილი არ გვხვდება. თუ დავუშვებთ, `41.7443761119608`
# (გეოგრაფიული განედი) ციფრებად ნომერს დაემთხვევა და დამცავი ცრუ
# განგაშს ატეხავს — ცრუ განგაშიანი დამცავი კი უგულებელყოფილი დამცავია.
PHONE_RE = re.compile(r'(?<![\d.])\+?\d[\d ()\-]{7,17}\d(?![\d.])')
EMAIL_RE = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
# ხელმოწერების სია: ნომერი → სახელი გვარი → საკადასტრო კოდი → ტელეფონი
NAME_RE = re.compile(r'[ა-ჰ]+( [ა-ჰ]+)+$')


def _zip_text(path):
    with zipfile.ZipFile(path) as z:
        raw = b''.join(z.read(n) for n in z.namelist() if n.endswith('.xml'))
    return raw.decode('utf8', 'ignore')


def _docx_paragraphs(path):
    with zipfile.ZipFile(path) as z:
        xml = z.read('word/document.xml').decode('utf8', 'ignore')
    out = []
    for para in re.findall(r'<w:p[ >].*?</w:p>', xml, re.S):
        text = ''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', para, re.S))
        text = re.sub(r'\s+', ' ', text).strip()
        if text:
            out.append(text)
    return out


def build_dictionary(root):
    """აბრუნებს (სახელები, ტელეფონები, კოდები, მეილები) ან None, თუ წყარო არ არის."""
    blob = ''
    found_any = False
    for name in SOURCES:
        path = os.path.join(root, name)
        if not os.path.exists(path):
            continue
        found_any = True
        if name.endswith('.geojson'):
            with open(path, encoding='utf8', errors='ignore') as fh:
                blob += fh.read()
        else:
            blob += re.sub(r'<[^>]+>', '\n', _zip_text(path))
    if not found_any:
        return None

    names = set()
    docx = os.path.join(root, SOURCES[0])
    if os.path.exists(docx):
        paras = _docx_paragraphs(docx)
        for i, para in enumerate(paras):
            is_row = (re.fullmatch(r'\d{1,3}', para)
                      and i + 2 < len(paras)
                      and re.fullmatch(r'[\d.]{8,20}', paras[i + 2])
                      and NAME_RE.match(paras[i + 1]))
            if is_row:
                names |= {t for t in paras[i + 1].split() if len(t) >= 4}

    cads = set(CAD_RE.findall(blob))
    # საკადასტრო კოდი ციფრებად ტელეფონს ჰგავს (99.99.99.002 → 999999002),
    # ამიტომ კოდები ტელეფონების სიმრავლიდან ამოდის — თორემ ერთი და იგივე
    # დამთხვევა ორ სხვადასხვა სახელს მიიღებდა.
    cad_digits = {re.sub(r'[^0-9]', '', c) for c in cads}

    phones = set()
    for match in PHONE_RE.findall(blob):
        digits = re.sub(r'[^0-9]', '', match)
        if 9 <= len(digits) <= 15 and digits not in cad_digits:
            phones.add(digits)
    emails = set(EMAIL_RE.findall(blob))
    return (names - ALLOW, phones, cads, emails - ALLOW)


def scan(text, dictionary):
    """აბრუნებს (მბლოკავი, საცნობარო).

    ცალკეულ კანდიდატს ამოწმებს, არა მთელ ფაილს — ისე ციფრები ფაილის ერთი
    ბოლოდან მეორეში არ იკვრება ცრუ დამთხვევად.

    საკადასტრო კოდი არ ბლოკავს: ის საჯარო რეესტრის მონაცემია (tas.ge-ზე
    ნებისმიერს შეუძლია მოძებნა) და აპლიკაციასაც სჭირდება რუკისთვის.
    საიდუმლო არის კავშირი კოდი → მფლობელი, ის კი პირად Sheet-ში ცხოვრობს.
    """
    names, phones, cads, emails = dictionary
    blocking, notes = set(), set()
    for token in names:
        if token in text:
            blocking.add('სახელი: ' + token)
    for match in PHONE_RE.findall(text):
        digits = re.sub(r'[^0-9]', '', match)
        if digits in phones:
            blocking.add('ტელეფონი: ' + match.strip())
    for email in EMAIL_RE.findall(text):
        if email in emails:
            blocking.add('მეილი: ' + email)
    for cad in CAD_RE.findall(text):
        if cad in cads:
            notes.add(cad)
    return sorted(blocking), sorted(notes)


def _git(args):
    return subprocess.run(['git'] + args, capture_output=True).stdout


def staged_files():
    out = _git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
    return [p for p in out.decode('utf8', 'ignore').split('\n') if p]


def staged_blob(path):
    return _git(['show', ':' + path]).decode('utf8', 'ignore')


def objects_in(revs):
    """(გზა, შიგთავსი) ყველა ტექსტური blob-ისთვის ამ commit-ებში."""
    out = _git(['rev-list', '--objects'] + revs).decode('utf8', 'ignore')
    seen = set()
    for line in out.split('\n'):
        parts = line.split(' ', 1)
        if len(parts) != 2 or not parts[1].strip():
            continue
        sha, path = parts[0], parts[1].strip()
        if sha in seen:
            continue
        seen.add(sha)
        kind = _git(['cat-file', '-t', sha]).decode().strip()
        if kind != 'blob':
            continue
        data = _git(['cat-file', 'blob', sha])
        if b'\0' in data[:8000]:
            continue
        yield path, data.decode('utf8', 'ignore')


def report(findings, what, cad_count=0):
    if cad_count:
        print('ℹ️  საკადასტრო კოდი: %d ცალი (საჯარო რეესტრის მონაცემი, არ ბლოკავს)'
              % cad_count, file=sys.stderr)
    if not findings:
        return 0
    print('', file=sys.stderr)
    print('⛔ %s შეჩერდა — ნაპოვნია მეზობლების პერსონალური მონაცემები:'
          % what, file=sys.stderr)
    print('', file=sys.stderr)
    for path in sorted(findings):
        print('   %s' % path, file=sys.stderr)
        for hit in findings[path]:
            print('      · %s' % hit, file=sys.stderr)
    print('', file=sys.stderr)
    print('   ეს repo საჯარო GitHub-ზე მიდის. შეცვალე ფიქტიური მონაცემით.',
          file=sys.stderr)
    print('   იძულებით გატარება (მხოლოდ თუ ზუსტად იცი რას აკეთებ): --no-verify',
          file=sys.stderr)
    print('', file=sys.stderr)
    return 1


def main(argv):
    root = _git(['rev-parse', '--show-toplevel']).decode('utf8').strip()
    dictionary = build_dictionary(root)
    if dictionary is None:
        print('ℹ️  PII-შემოწმება გამოტოვდა: წყარო-ფაილები ამ ასლში არ არის.',
              file=sys.stderr)
        return 0

    findings = {}
    cads_seen = set()
    if argv[:1] == ['--staged']:
        for path in staged_files():
            hits, notes = scan(staged_blob(path), dictionary)
            cads_seen |= set(notes)
            if hits:
                findings[path] = hits
        return report(findings, 'ჩაკომიტება', len(cads_seen))

    if argv[:1] == ['--commits']:
        for path, text in objects_in(argv[1:]):
            hits, notes = scan(text, dictionary)
            cads_seen |= set(notes)
            if hits:
                findings.setdefault(path, [])
                for hit in hits:
                    if hit not in findings[path]:
                        findings[path].append(hit)
        return report(findings, 'ატვირთვა (push)', len(cads_seen))

    print(__doc__, file=sys.stderr)
    return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
