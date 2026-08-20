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

  return { escapeHtml: escapeHtml, fullName: fullName, mapStatus: mapStatus,
    streetList: streetList, filterPlots: filterPlots, sortPlots: sortPlots };
});
