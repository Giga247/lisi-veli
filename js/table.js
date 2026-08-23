/**
 * ნაკვეთების სია მთავარ გვერდზე.
 *
 * თითო ნაკვეთი ერთი მწკრივია: საკადასტრო კოდი, მისამართი, სახელი.
 * სტატუსი აქ განზრახ არ არის — ის პროექტის ცნებაა და პროექტის გვერდზე
 * ჩანს. ტელეფონსაც ვერ ნახავ: ბაზა მას მხოლოდ მოდერატორს, ადმინს და
 * პროექტის ხაზინდარს უგზავნის, დანარჩენებთან ის საერთოდ არ მოდის.
 */
const TableView = (function () {
  'use strict';

  const esc = function (v) { return WebLib.escapeHtml(v); };

  let plots = [];
  let user = null;
  let filters = { query: '', street: '' };

  function canEdit() {
    return user && (user.role === 'moderator' || user.role === 'admin');
  }

  function chips() {
    const streets = WebLib.streetList(plots);
    const one = function (value, label, on) {
      return '<button type="button" data-v="' + esc(value) + '"' +
        (on ? ' class="on"' : '') + '>' + esc(label) + '</button>';
    };
    return '<div class="chips">' +
      one('', 'ყველა ქუჩა', filters.street === '') +
      streets.map(function (street) {
        return one(street, street, filters.street === street);
      }).join('') + '</div>';
  }

  function visible() {
    return WebLib.sortPlots(
      WebLib.filterPlots(plots, { query: filters.query, street: filters.street }),
      'street', 'asc');
  }

  function rowHtml(plot) {
    const where = [plot.street, plot.num ? '№' + plot.num : '']
      .filter(Boolean).join(' ');
    return '<button type="button" class="it" data-cad="' + esc(plot.cad) + '">' +
      '<span class="it-b">' +
      '<span class="it-n">' + esc(WebLib.fullName(plot) || 'მფლობელი უცნობია') + '</span>' +
      '<span class="it-a">' + esc(where || '—') + '</span></span>' +
      '<span class="it-cad mono">' + esc(plot.cad) + '</span>' +
      '</button>';
  }

  function draw() {
    const rows = visible();
    UI.el('list-count').textContent = rows.length === plots.length
      ? String(plots.length) : rows.length + ' / ' + plots.length;
    UI.el('list-rows').innerHTML = rows.length === 0
      ? '<p class="empty">ვერაფერი მოიძებნა.</p>'
      : rows.map(rowHtml).join('');
    UI.el('list-filters').innerHTML = chips();
  }

  function render(allPlots, currentUser) {
    plots = allPlots || [];
    user = currentUser;

    const host = UI.el('home-list');
    host.innerHTML =
      '<div class="sec-h"><h2>ნაკვეთები</h2><span id="list-count" class="muted"></span></div>' +
      '<input id="list-q" type="search" placeholder="ძებნა — სახელი, მისამართი, კოდი">' +
      '<div id="list-filters"></div>' +
      '<div id="list-rows" class="list"></div>';

    // მოვლენები დელეგირებულია: სია და ჩიპები ყოველ ფილტრზე თავიდან
    // იხატება, ამიტომ პირდაპირ მიბმული მსმენელი პირველივე ძებნას
    // გადარჩებოდა.
    host.addEventListener('input', function (event) {
      if (event.target.id !== 'list-q') return;
      filters.query = event.target.value;
      draw();
    });
    host.addEventListener('click', function (event) {
      const chip = event.target.closest('[data-v]');
      if (chip) {
        filters.street = chip.getAttribute('data-v');
        draw();
        return;
      }
      const item = event.target.closest('[data-cad]');
      if (item) MapView.openSheet(item.getAttribute('data-cad'));
    });

    draw();
  }

  function findPlot(cad) {
    return plots.filter(function (plot) { return plot.cad === cad; })[0];
  }

  const EDITABLE = [
    { key: 'first_name', label: 'სახელი' },
    { key: 'last_name', label: 'გვარი' },
    { key: 'phone', label: 'ტელეფონი', type: 'tel', wide: true },
    { key: 'address', label: 'სრული მისამართი', wide: true },
    { key: 'num', label: 'ნომერი' },
    { key: 'note', label: 'შენიშვნა', wide: true },
  ];

  /**
   * ნაკვეთის რედაქტორი.
   *
   * `onSaved` პროექტის ბარათისთვისაა: ის იმავე ნაკვეთს სხვა ეკრანზე
   * აჩვენებს და შენახვის შემდეგ თავად უნდა განახლდეს — თორემ
   * გასწორებული სახელი მხოლოდ მთავარ სიაში გამოჩნდებოდა.
   */
  function openEditor(cad, onSaved) {
    const plot = findPlot(cad);
    if (!plot || !canEdit()) return;

    const fields = EDITABLE.map(function (field) {
      return '<label class="pe-f' + (field.wide ? ' pe-wide' : '') + '">' +
        WebLib.escapeHtml(field.label) +
        '<input data-field="' + field.key + '"' +
        (field.type ? ' type="' + field.type + '" inputmode="' + field.type + '"' : '') +
        ' value="' + WebLib.escapeHtml(plot[field.key]) + '"></label>';
    }).join('');

    const dialog = document.createElement('dialog');
    dialog.className = 'pe';
    dialog.innerHTML =
      '<form method="dialog" class="pe-box">' +
      '<header class="pe-h"><div>' +
      '<h3>' + WebLib.escapeHtml(plot.address || plot.cad) + '</h3>' +
      '<p class="pe-cad mono">' + WebLib.escapeHtml(plot.cad) + '</p></div>' +
      '<button type="button" class="pe-x" data-cancel ' +
      'aria-label="დახურვა">✕</button></header>' +
      '<div class="pe-grid">' + fields + '</div>' +
      '<p class="dialog-error" data-error hidden></p>' +
      '<div class="pe-act">' +
      '<button type="button" data-cancel>გაუქმება</button>' +
      '<button data-save class="pe-go">შენახვა</button>' +
      '</div></form>';
    document.body.appendChild(dialog);
    dialog.showModal();

    const errorBox = dialog.querySelector('[data-error]');
    // `[data-save]`, და არა `[value="save"]`: ველების <input>-ებს ზემოთ
    // Sheet-იდან მოსული value აქვთ და თუ რომელიმე მათგანი სიტყვასიტყვით
    // "save"-ს შეიცავდა, querySelector სწორედ მას დააბრუნებდა (DOM-ში ისინი
    // ღილაკზე ადრე დგანან) — disabled არასწორ ელემენტზე დაჯდებოდა.
    const saveButton = dialog.querySelector('[data-save]');

    // `close` ერთადერთი ადგილია, სადაც dialog DOM-იდან იშლება — და ის
    // ყველა დახურვის გზაზე ისვლება: Escape, „გაუქმება" და წარმატებული
    // შენახვა. ასე ვერცერთ ტოტზე ვერ დარჩება მიტოვებული <dialog>.
    dialog.addEventListener('close', function () { dialog.remove(); });
    // `[data-cancel]` ორია — ✕ სათაურში და ღილაკი ბოლოში.
    dialog.querySelectorAll('[data-cancel]').forEach(function (button) {
      button.addEventListener('click', function () { dialog.close(); });
    });

    dialog.querySelector('form').addEventListener('submit', async function (event) {
      // `method="dialog"`-ის ნაგულისხმევი ქცევა ფორმის გაგზავნისთანავე ხურავს
      // dialog-ს — ვაჩერებთ. თუ სერვერი VALIDATION-ს (მაგ. არასწორი ტელეფონი),
      // CONFLICT-ს ან ქსელის შეცდომას დააბრუნებს, მოდერატორის აკრეფილი ექვსივე
      // ველი ეკრანზე რჩება და შესწორება ხელახლა აკრეფის გარეშე შეიძლება.
      event.preventDefault();

      const changed = {};
      dialog.querySelectorAll('[data-field]').forEach(function (input) {
        changed[input.getAttribute('data-field')] = input.value;
      });

      errorBox.hidden = true;
      saveButton.disabled = true;
      try {
        const result = await API.call('updatePlot', {
          cad: cad,
          expected_updated_at: String(plot.updated_at || ''),
          fields: changed,
        });
        // სერვერი ინახავს გასუფთავებულ მნიშვნელობებს (მაგ. ტელეფონი +995-ით
        // ნორმალიზებული) — ვცდილობთ ვცადოთ ისინი, თუ სერვერმა `fields`
        // დააბრუნა; თუ არა (ძველი დეპლოი), მაინც არ დავტოვოთ რიგი ცარიელი.
        Object.assign(plot, result.fields || changed);
        plot.updated_at = result.updated_at;
        dialog.close();
        draw();
        // რუკის წარწერა ნომერს ბაზიდან იღებს — შესწორება მასაც უნდა
        // მიჰყვეს, თორემ სიაში ახალი ნომერი ეწერება, რუკაზე კი ძველი.
        if (typeof MapView !== 'undefined') MapView.relabel();
        if (typeof onSaved === 'function') onSaved(plot);
        // რუკის თავიდან ხატვა არ სჭირდება: `MapView` სიის იმავე
        // ობიექტებს იხსენებს, ამიტომ `Object.assign` მასაც ეხება.
        // გეომეტრია და სტატუსი კი რედაქტირებით არ იცვლება.
      } catch (error) {
        // შეცდომა თავად dialog-ში ჩანს და 6 წამში არ ქრება — ტოსტი
        // შესწორებისთვის საკმარისი დრო არ იყო, და მისი გაქრობის შემდეგ
        // მოდერატორს აღარაფერი რჩებოდა, გარდა ხელახლა აკრეფისა.
        errorBox.textContent = error.message;
        errorBox.hidden = false;
        saveButton.disabled = false;
      }
    });
  }

  return { render: render, openEditor: openEditor };
})();
