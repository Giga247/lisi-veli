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

  /**
   * HTML-ში ჩასასმელი ტექსტის escape.
   *
   * მონაცემები Sheet-იდან მოდის, ხელით ივსება და შეიძლება შეიცავდეს
   * ნებისმიერ სიმბოლოს — escape-ის გარეშე შენიშვნა ან მისამართი მარკაპს
   * გატეხს, ან attribute-იდან გამოაპარებს (შენახული injection).
   *
   * `&` ყოველთვის პირველი იცვლება: სხვა რიგში უკვე ჩასმული `&lt;`
   * მეორედ დამუშავდებოდა და `&amp;lt;`-ად გადაიქცეოდა.
   *
   * `'` -> `&#39;` დღეს ზედმეტია (ყველა attribute ორმაგ ბრჭყალშია), მაგრამ
   * ის ხსნის დამოკიდებულებას იმაზე, რომ ეს ასე დარჩება.
   */
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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
    // მარტივი კოდპოინტური შედარება: Intl.Collator-ის 'ka' ლოკალის ტაილორინგი
    // ამ Node-ის ICU-ზე ლათინურ და ქართულ სიმბოლოებს არაპროგნოზირებადად ალაგებს
    // (და შედეგი დამოკიდებულია LANG/LC_ALL გარემოს ცვლადზეც), ხოლო წმინდა
    // კოდპოინტური შედარება ქართული ანბანისთვის უკვე სწორი თანმიმდევრობაა.
    return Object.keys(seen).sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
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
      const leftStr = String(left);
      const rightStr = String(right);
      return (leftStr < rightStr ? -1 : leftStr > rightStr ? 1 : 0) * sign;
    });
  }

  /* ── პროექტები ────────────────────────────────────────────────── */

  /**
   * პასუხის სახელი, სიმბოლო და ფერი.
   *
   * სიმბოლო არჩევითი მორთულობა არ არის: მწვანე და ნარინჯისფერი
   * პროტანოპიისთვის ΔE 6.0-ით შორდება ერთმანეთს — ზუსტად იმ ზღვარზე,
   * სადაც ფერი მარტო აღარ კმარა. ამიტომ ფერს ყველგან სიმბოლოც მოსდევს
   * და წარწერაც: რუკაზე, ლეგენდაში, ცხრილში.
   */
  const PLEDGE_VIEW = {
    not_contacted: { label: 'ჯერ არ მიველაპარაკე', short: 'ჯერ არა', icon: '·', tone: 'none' },
    paying: { label: 'ვდებ თანხას', short: 'დებს', icon: '↑', tone: 'promised' },
    loan: { label: 'უბნის ვალად ვიღებ — წლის განმავლობაში დავაბრუნებ',
      short: 'ვალით', icon: '⟳', tone: 'loan' },
    declined: { label: 'არ ვდებ', short: 'არ დებს', icon: '✕', tone: 'declined' },
  };

  const TONE_VIEW = {
    none: { label: 'პასუხის გარეშე', icon: '·' },
    promised: { label: 'თანხას დებს', icon: '↑' },
    loan: { label: 'ვალად იღებს', icon: '⟳' },
    partial: { label: 'ნაწილობრივ გადახდილი', icon: '◐' },
    paid: { label: 'გადახდილი', icon: '✓' },
    declined: { label: 'არ დებს', icon: '✕' },
  };

  function pledgeView(status) {
    return PLEDGE_VIEW[status] || PLEDGE_VIEW.not_contacted;
  }

  function toneView(tone) {
    return TONE_VIEW[tone] || TONE_VIEW.none;
  }

  /**
   * ლარი — ათასეულები ვიწრო შორისით, წილადის გარეშე.
   *
   * `toLocaleString`-ს აქ განზრახ არ ვიყენებთ: მისი შედეგი ICU-ს
   * მონაცემებზეა დამოკიდებული და Node-სა და ბრაუზერში სხვადასხვაა —
   * ტესტი ერთს ხედავდა, მეზობელი მეორეს.
   */
  function money(value) {
    const number = Math.round(Number(value) || 0);
    const sign = number < 0 ? '−' : '';
    const digits = String(Math.abs(number));
    let out = '';
    for (let i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 === 0) out += '\u202f';
      out += digits[i];
    }
    return sign + out + ' ₾';
  }

  /**
   * ქუჩების ჭრილი — რომელი ქუჩა ჩამორჩება.
   *
   * სწორედ ეს ინფორმაცია სჭირდება ადმინს: არა თუ ვინ არ იხდის, არამედ
   * სად არ ყოფილა საუბარი.
   */
  function streetBreakdown(rows) {
    const byStreet = {};
    (rows || []).forEach(function (row) {
      const street = String(row.street || '').trim() || 'ქუჩის გარეშე';
      if (!byStreet[street]) {
        // მთვლელები ცალკე ბუდეშია: `paid` ორივეს ერქვა — შემოსულ თანხასაც
        // და გადახდილი კომლების რიცხვსაც — და ერთმანეთს ემატებოდნენ.
        byStreet[street] = { street: street, total: 0, due: 0, paid: 0,
          counts: { none: 0, promised: 0, loan: 0, partial: 0, paid: 0, declined: 0 } };
      }
      const bucket = byStreet[street];
      bucket.total += 1;
      bucket.due += Number(row.amount_due) || 0;
      bucket.paid += Number(row.paid) || 0;
      if (bucket.counts[row.color] !== undefined) bucket.counts[row.color] += 1;
    });
    return Object.keys(byStreet)
      .sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; })
      .map(function (key) { return byStreet[key]; });
  }

  /** ცხრილის ფილტრი პროექტის გვერდზე. */
  function filterPledgeRows(rows, filters) {
    const street = (filters && filters.street) || '';
    const tone = (filters && filters.tone) || '';
    const query = String((filters && filters.query) || '').trim().toLowerCase();
    return (rows || []).filter(function (row) {
      if (street && String(row.street || '') !== street) return false;
      if (tone && row.color !== tone) return false;
      if (!query) return true;
      const hay = [row.cad, row.address, row.street, row.first_name, row.last_name]
        .join(' ').toLowerCase();
      return hay.indexOf(query) !== -1;
    });
  }

  return { escapeHtml: escapeHtml, fullName: fullName, mapStatus: mapStatus,
    streetList: streetList, filterPlots: filterPlots, sortPlots: sortPlots,
    PLEDGE_VIEW: PLEDGE_VIEW, TONE_VIEW: TONE_VIEW,
    pledgeView: pledgeView, toneView: toneView, money: money,
    streetBreakdown: streetBreakdown, filterPledgeRows: filterPledgeRows };
});
