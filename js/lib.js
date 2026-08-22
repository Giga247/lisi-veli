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

  /**
   * ვინ არის რომელი პროექტის ხაზინდარი.
   *
   * ხაზინდარი გლობალური როლი არ არის — ის `projects.treasurers` ველია,
   * ანუ ერთი ადამიანი შეიძლება ერთ პროექტში იყოს ხაზინდარი და მეორეში
   * არა. ადმინის პანელს ეს ჭრილი პირუკუ სჭირდება — მომხმარებლიდან
   * პროექტებისკენ — ამიტომ ინდექსი აქ იგება.
   *
   * მეილი ორივე მხრიდან lower/trim-დება: `create_project` მას `lower()`-ით
   * ინახავს, მაგრამ Sheet-იდან შემოსულ ძველ ჩანაწერებში რეგისტრი დაცული
   * არ იყო. გაუქმებული პროექტი არ ითვლება — მასზე ხაზინდრობა აღარაფერს
   * ნიშნავს, ფული აღარ იწერება.
   */
  function treasurerIndex(projects) {
    return staffIndex(projects, 'treasurers');
  }

  /**
   * იგივე, ნებისმიერი პასუხისმგებლის ველისთვის: `treasurers`, `moderators`.
   *
   * ველი მასივია — პროექტს რამდენიმე ხაზინდარიც ჰყავს და რამდენიმე
   * მოდერატორიც. ცალკე სტრიქონიც მიიღება: ბაზაში ეს ველები ერთეულები
   * იყო და ძველი პასუხი ქეშიდან ჯერ კიდევ შეიძლება მოვიდეს.
   */
  function staffIndex(projects, field) {
    const index = {};
    (projects || []).forEach(function (project) {
      if (!project || project.status === 'cancelled') return;
      const raw = project[field];
      const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
      const label = String(project.name || '').trim() || String(project.id || '');
      list.forEach(function (item) {
        const email = String(item || '').trim().toLowerCase();
        if (!email) return;
        if (!index[email]) index[email] = [];
        if (index[email].indexOf(label) === -1) index[email].push(label);
      });
    });
    return index;
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
  /**
   * ექვსი სტატუსი — ერთადერთი წყარო წარწერისთვის, სიმბოლოსა და ფერისთვის.
   *
   * `tone` სტატუსის სახელს ემთხვევა და ეს განზრახაა: ადრე ფერი ცალკე
   * ცნება იყო და გადახდების ცხრილიდან გამოითვლებოდა („ნაწილობრივ
   * გადახდილი"). ნაწილობრივი გადახდა არ არსებობს — ან დებს, ან არა —
   * ამიტომ სტატუსი თავად არის ფერი და ორი ცნება ერთმანეთს ვეღარ
   * დაშორდება.
   *
   * სიმბოლო ყველგან თან ახლავს ფერს: მწვანე და ნარინჯისფერი
   * პროტანოპიისთვის ახლოს დგანან, და ფერი მარტო ვერასდროს ატარებს
   * მნიშვნელობას.
   */
  const PLEDGE_VIEW = {
    not_contacted: { label: 'არ დარეკილა', short: 'არ დარეკილა', icon: '·', tone: 'not_contacted' },
    unreachable: { label: 'ვერ ვუკავშირდები', short: 'ვერ ვუკავშირდები', icon: '?', tone: 'unreachable' },
    paying: { label: 'დებს', short: 'დებს', icon: '↑', tone: 'paying' },
    loan: { label: 'ვერ დებს და ვალად იღებს', short: 'ვალად იღებს', icon: '⟳', tone: 'loan' },
    declined: { label: 'არ დებს', short: 'არ დებს', icon: '✕', tone: 'declined' },
    paid: { label: 'გადახდილია', short: 'გადახდილია', icon: '✓', tone: 'paid' },
  };

  const TONE_VIEW = {
    not_contacted: { label: 'არ დარეკილა', icon: '·' },
    unreachable: { label: 'ვერ ვუკავშირდები', icon: '?' },
    paying: { label: 'დებს', icon: '↑' },
    loan: { label: 'ვალად იღებს', icon: '⟳' },
    declined: { label: 'არ დებს', icon: '✕' },
    paid: { label: 'გადახდილია', icon: '✓' },
  };

  function pledgeView(status) {
    return PLEDGE_VIEW[status] || PLEDGE_VIEW.not_contacted;
  }

  function toneView(tone) {
    return TONE_VIEW[tone] || TONE_VIEW.not_contacted;
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
        // და გადახდილი ნაკვეთების რიცხვსაც — და ერთმანეთს ემატებოდნენ.
        // მთვლელები ექვსივე სტატუსზე, `PLEDGE_VIEW`-იდან — რომ ახალი
        // სტატუსის დამატებისას ეს სია ჩუმად არ ჩამორჩეს.
        const counts = {};
        Object.keys(PLEDGE_VIEW).forEach(function (key) { counts[key] = 0; });
        byStreet[street] = { street: street, total: 0, due: 0, paid: 0, counts: counts };
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

  /**
   * რედაქტირებადი ველების თეთრი სია.
   *
   * ჭეშმარიტების წყარო აღარ არის ეს მასივი — ბაზაში ამ ცხრა სვეტზე
   * გვაქვს `grant update`, დანარჩენებზე არა, ასე რომ სიის გვერდის ავლა
   * შეუძლებელია. აქ ის იმისთვის რჩება, რომ მომხმარებელმა შეცდომა
   * ქართულად და მაშინვე დაინახოს, და არა Postgres-ის ინგლისური უარი.
   */
  const EDITABLE_FIELDS = ['first_name', 'last_name', 'phone', 'street',
    'num', 'address', 'area', 'purpose', 'note'];

  function isEditableField(field) {
    return EDITABLE_FIELDS.indexOf(field) !== -1;
  }

  /** ტელეფონი -> {ok, value} ან {ok:false, message}. */
  function normalizePhone(raw) {
    if (raw == null || String(raw).trim() === '') {
      return { ok: true, value: '' };
    }
    const text = String(raw).trim();
    // წამყვანი `+` განზრახვის ნიშანია: მფლობელი უცხოურ ნომერს წერს. მის
    // გარეშე ისევ მხოლოდ ქართული ფორმატი მიიღება — ათნიშნა ნომერი ტიპოა,
    // არა უცხოური.
    const international = text.charAt(0) === '+';
    const digits = text.replace(/[\s\-()+.]/g, '');
    if (!/^[0-9]+$/.test(digits)) {
      return { ok: false, message: 'ტელეფონი მხოლოდ ციფრებს უნდა შეიცავდეს' };
    }
    if (international) {
      // E.164: ქვეყნის კოდი + ნომერი, სულ 15 ციფრამდე.
      if (digits.length < 8 || digits.length > 15) {
        return { ok: false, message: 'საერთაშორისო ნომერი უნდა იყოს 8-15 ციფრი' };
      }
      return { ok: true, value: '+' + digits };
    }
    let local;
    if (digits.length === 9) {
      local = digits;
    } else if (digits.length === 12 && digits.indexOf('995') === 0) {
      local = digits.slice(3);
    } else {
      return { ok: false, message: 'ნომერი უნდა იყოს 9 ციფრი, 995 + 9 ციფრი, ან +ქვეყნის-კოდი' };
    }
    return { ok: true, value: '+995' + local };
  }

  /**
   * უახლოეს ხუთეულამდე. უბანში ხუთლარიან ნაბიჯებში ლაპარაკობენ და ისე
   * იხდიან; 222.22 ლარი ქაღალდზეც უხერხულია და საუბარშიც.
   */
  function roundToFive(value) {
    const number = Number(value);
    if (!isFinite(number)) return 0;
    return Math.round(number / 5) * 5;
  }

  /**
   * ნაკვეთის ფერი. სტატუსი და ფერი ერთი და იგივეა.
   *
   * ადრე ეს ფუნქცია გადახდილ თანხას ადარებდა წილს და „ნაწილობრივ
   * გადახდილს" აბრუნებდა. ასეთი მდგომარეობა უბანში არ არსებობს.
   */
  function plotColor(pledge) {
    const status = pledge && pledge.status;
    return PLEDGE_VIEW[status] ? status : 'not_contacted';
  }

  /**
   * პროექტის ჯამები.
   *
   * `promised` და `loan` **დარჩენილს** ითვლიან, არა სრულ წილს — ვინც
   * ნახევარი გადაიხადა, დანარჩენ ნახევარს რჩება დაპირებული, და ერთი და
   * იგივე ლარი ორჯერ არ ითვლება.
   */
  /**
   * რამდენი მეპატრონეა ნაკვეთების ამ ნაკრებში.
   *
   * მეპატრონე ნაკვეთზე ნაკლებია: ზოგს ორი-სამი ნაკვეთი აქვს და
   * ნაკვეთების რიცხვი უბნის ხალხს ზედმეტად ბევრად აჩვენებდა. სახელი
   * და გვარი ერთდება, ჰარეები და რეგისტრი იშლება — ერთი და იგივე კაცი
   * ორ ჩანაწერში ხან ბოლო ჰარით იწერებოდა, ხან მის გარეშე.
   *
   * უსახელო ნაკვეთი ცალკე მეპატრონედ ითვლება: არ ვიცით, ვისია, და
   * მათი ერთ კაცად ჩათვლა ნაკლებად სწორი იქნებოდა, ვიდრე ცალკედ.
   */
  function ownerCount(rows) {
    const seen = {};
    let unknown = 0;
    (rows || []).forEach(function (row) {
      const name = fullName(row);
      if (name === '—') { unknown += 1; return; }
      seen[name.replace(/\s+/g, ' ').toLowerCase()] = true;
    });
    return Object.keys(seen).length + unknown;
  }

  function projectTotals(project, pledges, payments) {
    const paidByCad = {};
    (payments || []).forEach(function (payment) {
      const cad = String(payment.cad || '').trim();
      paidByCad[cad] = (paidByCad[cad] || 0) + (Number(payment.amount) || 0);
    });

    let collected = 0;
    Object.keys(paidByCad).forEach(function (cad) { collected += paidByCad[cad]; });

    let promised = 0;
    let loan = 0;
    let declined = 0;
    let pending = 0;

    (pledges || []).forEach(function (pledge) {
      const cad = String(pledge.cad || '').trim();
      const due = Number(pledge.amount_due) || 0;
      const paid = paidByCad[cad] || 0;
      const left = Math.max(0, due - paid);
      if (pledge.status === 'paid') return;   // ფული უკვე `collected`-შია
      if (pledge.status === 'paying') promised += left;
      else if (pledge.status === 'loan') loan += left;
      else if (pledge.status === 'declined') declined += due;
      else pending += due;   // not_contacted და unreachable
    });

    const budget = Number(project && project.budget) || 0;
    return {
      budget: budget, collected: collected, promised: promised,
      loan: loan, declined: declined, pending: pending,
      remaining: Math.max(0, budget - collected),
      // ნამეტი შეცდომა არ არის — ის უბნის ფონდში რჩება. მისი ცალკე
      // ჩვენების გარეშე 31 000-იან პროექტში შემოსული 56 000 ეკრანზე
      // „აკლია 0 ₾"-ად გამოჩნდებოდა და 25 000 უბრალოდ დაიკარგებოდა.
      surplus: Math.max(0, collected - budget),
    };
  }

  return { escapeHtml: escapeHtml, fullName: fullName, mapStatus: mapStatus,
    streetList: streetList, filterPlots: filterPlots, sortPlots: sortPlots,
    treasurerIndex: treasurerIndex, staffIndex: staffIndex,
    PLEDGE_VIEW: PLEDGE_VIEW, TONE_VIEW: TONE_VIEW,
    pledgeView: pledgeView, toneView: toneView, money: money,
    streetBreakdown: streetBreakdown, filterPledgeRows: filterPledgeRows,
    EDITABLE_FIELDS: EDITABLE_FIELDS, isEditableField: isEditableField,
    normalizePhone: normalizePhone,
    roundToFive: roundToFive, plotColor: plotColor,
    projectTotals: projectTotals, ownerCount: ownerCount };
});
