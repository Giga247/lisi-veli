/**
 * „რუკა" ტაბი — იგივე გეგმა, რაც შესვლის ეკრანზე, ოღონდ სრული პანელით
 * და მფლობელის მონაცემით დეტალებში.
 *
 * გეომეტრია სტატიკური ფაილიდან მოდის (`data/plan-page.json`, `js/plan.js`-ის
 * ნაშენი), მფლობელი და ტელეფონი — ცოცხალი Sheet-იდან. ორი წყარო
 * საკადასტრო კოდით ერწყმის ერთმანეთს.
 *
 * ხატვის ინსტრუმენტი აქაც არ არის — გეომეტრია გარე წყაროდან მოდის.
 */
const MapView = (function () {
  let panel = null;
  let instance = null;
  let plots = [];
  let user = null;
  let byCad = {};

  function canEdit() {
    return !!user && (user.role === 'moderator' || user.role === 'admin');
  }

  /** დეტალების პანელის დამატებითი ბლოკი — ის, რაც საჯარო გეგმაზე არ არის. */
  function extra(record) {
    const plot = byCad[record.cad];
    if (!plot) {
      return '<p class="plan-owner-none">ეს ნაკვეთი ბაზაში არ არის.</p>';
    }
    const phone = plot.phone
      ? '<a href="tel:' + WebLib.escapeHtml(plot.phone) + '">' +
        WebLib.escapeHtml(plot.phone) + '</a>'
      : '—';
    const edit = canEdit()
      ? '<button type="button" class="plan-edit" data-edit="' +
        WebLib.escapeHtml(plot.cad) + '">✏️ რედაქტირება</button>'
      : '';
    return '<div class="plan-owner"><dl>' +
      '<dt>მფლობელი</dt><dd>' + WebLib.escapeHtml(WebLib.fullName(plot)) + '</dd>' +
      '<dt>ტელეფონი</dt><dd>' + phone + '</dd>' +
      (plot.note ? '<dt>შენიშვნა</dt><dd>' + WebLib.escapeHtml(plot.note) + '</dd>' : '') +
      '</dl>' + edit + '</div>';
  }

  function renderMissing(missing) {
    const box = document.getElementById('plan-missing');
    if (!box) return;
    box.innerHTML = missing.length === 0 ? '' :
      '<h4>გეგმაზე არ ჩანს (' + missing.length + ')</h4>' +
      '<p>ეს ნაკვეთები Sheet-შია, მაგრამ გეგმის ფაილში კონტური არ აქვთ. ' +
      'გეომეტრიის დამატების შემდეგ გაუშვი <code>python3 tools/plan_page/build.py</code>.</p><ul>' +
      missing.map(function (plot) {
        return '<li><code>' + WebLib.escapeHtml(plot.cad) + '</code> — ' +
          WebLib.escapeHtml(plot.address || 'მისამართის გარეშე') + '</li>';
      }).join('') + '</ul>';
  }

  function render(allPlots, currentUser) {
    plots = allPlots || [];
    user = currentUser;
    byCad = {};
    plots.forEach(function (plot) { byCad[String(plot.cad).trim()] = plot; });

    panel = UI.el('panel-map');
    panel.innerHTML = '<div id="plan-app"></div><div id="plan-missing"></div>';

    PlanView.load().then(function (data) {
      const known = {};
      data.parcels.forEach(function (p) { known[p.cad] = true; });
      (data.noshape || []).forEach(function (p) { known[p.cad] = true; });

      instance = PlanView.create(document.getElementById('plan-app'), data, { extra: extra });
      renderMissing(plots.filter(function (plot) {
        return !known[String(plot.cad).trim()];
      }));
    }).catch(function (error) {
      panel.innerHTML = '<p class="dialog-error">' +
        WebLib.escapeHtml(error.message || 'გეგმა ვერ ჩაიტვირთა') + '</p>';
    });

    // „რედაქტირება" დელეგირებულია: დეტალების პანელი ყოველ არჩევანზე
    // თავიდან იხატება, ამიტომ ღილაკზე პირდაპირ მიბმა გადარჩებოდა.
    panel.addEventListener('click', function (event) {
      const button = event.target.closest && event.target.closest('[data-edit]');
      if (button) TableView.openEditor(button.getAttribute('data-edit'));
    });
  }

  function refresh() { if (instance) instance.refresh(); }

  return { render: render, refresh: refresh };
})();
