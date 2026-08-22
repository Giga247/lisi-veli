/**
 * მთავარი გვერდის რუკა.
 *
 * გეომეტრია სტატიკური ფაილიდან მოდის (`data/plan-page.json`), მფლობელი და
 * სტატუსი — ბაზიდან; ორი წყარო საკადასტრო კოდით ერწყმის.
 *
 * ფერი სტატუსს ნიშნავს, არა ქუჩას: მიმდინარე პროექტში ვინ რა
 * მდგომარეობაშია. თუ აქტიური პროექტი არ არის, ნაკვეთები ქუჩის ფერებს
 * ინარჩუნებენ — მაშინ სტატუსი უბრალოდ არ არსებობს.
 */
const MapView = (function () {
  'use strict';

  const esc = function (v) { return WebLib.escapeHtml(v); };

  let instance = null;
  let byCad = {};
  let statusByCad = {};
  let user = null;
  let project = null;

  function canEdit() {
    return !!user && (user.role === 'moderator' || user.role === 'admin');
  }

  /**
   * ლეგენდა `PlanView`-ის საკუთარ სლოტში ჩაჯდება, ცალკე ზოლად კი არა:
   * ორივე რომ იხატებოდეს, ეკრანზე ორი ლეგენდა იდგებოდა — ქუჩების ფერები
   * რუკის შიგნით და სტატუსები მის ქვეშ, ერთი და იმავე ნაკვეთებზე.
   */
  function legendHtml() {
    if (!project) return null;   // null — ქუჩების ნაგულისხმევი ლეგენდა რჩება
    return Object.keys(WebLib.PLEDGE_VIEW).map(function (key) {
      const view = WebLib.PLEDGE_VIEW[key];
      return '<span class="lgd"><i class="dot tint-' + esc(key) + '"></i>' +
        esc(view.label) + '</span>';
    }).join('');
  }

  function openSheet(cad) {
    const plot = byCad[String(cad).trim()];
    if (!plot) return;
    const row = statusByCad[plot.cad];
    Sheet.open(plot, {
      status: row ? row.status : null,
      amount_due: row ? row.amount_due : null,
      projectName: project ? project.name : null,
      canEdit: canEdit(),
    });
  }

  function render(plots, currentUser, activeProject, rows) {
    user = currentUser;
    project = activeProject || null;

    byCad = {};
    (plots || []).forEach(function (plot) { byCad[String(plot.cad).trim()] = plot; });
    statusByCad = {};
    (rows || []).forEach(function (row) { statusByCad[String(row.cad).trim()] = row; });

    const host = UI.el('home-map');
    host.innerHTML =
      '<div class="map-card"><div id="plan-app"></div></div>' +
      '<p class="map-hint">შეეხე ნაკვეთს — ვისია და რა სტატუსია</p>';

    Sheet.handlers({
      onEdit: function (cad) { TableView.openEditor(cad); },
      onClose: function () { if (instance) instance.select(null); },
    });

    PlanView.load().then(function (data) {
      instance = PlanView.create(document.getElementById('plan-app'), data, {
        sidebar: false,
        legend: legendHtml(),
        tint: project ? function (cad) {
          const row = statusByCad[String(cad).trim()];
          return row ? row.status : 'not_contacted';
        } : null,
        onSelect: function (cad) { if (cad) openSheet(cad); },
      });
    }).catch(function (error) {
      host.innerHTML = '<p class="dialog-error">' +
        esc(error.message || 'გეგმა ვერ ჩაიტვირთა') + '</p>';
    });
  }

  function refresh() { if (instance) instance.refresh(); }

  return { render: render, refresh: refresh, openSheet: openSheet };
})();
