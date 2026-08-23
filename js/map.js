/**
 * მთავარი გვერდის რუკა.
 *
 * ფერი ქუჩას ნიშნავს, არა სტატუსს — ეს უბრალოდ უბნის რუკაა. სტატუსი
 * პროექტის ცნებაა და პროექტის გვერდზე ცხოვრობს: მთავარზე მას ვერცერთი
 * კონკრეტული პროექტი ვერ დაიკავებდა, თუ რამდენიმე იქნებოდა აქტიური.
 *
 * გეომეტრია სტატიკური ფაილიდან მოდის (`data/plan-page.json`), მფლობელი —
 * ბაზიდან; ორი წყარო საკადასტრო კოდით ერწყმის.
 */
const MapView = (function () {
  'use strict';

  const esc = function (v) { return WebLib.escapeHtml(v); };

  let instance = null;
  let byCad = {};
  let user = null;
  let phonesVisible = false;

  function canEdit() {
    return !!user && (user.role === 'moderator' || user.role === 'admin');
  }

  function openSheet(cad) {
    const plot = byCad[String(cad).trim()];
    if (!plot) return;
    Sheet.open(plot, { canEdit: canEdit(), canSeePhone: phonesVisible });
  }

  function render(plots, currentUser, showPhones) {
    user = currentUser;
    phonesVisible = Boolean(showPhones);
    byCad = {};
    (plots || []).forEach(function (plot) { byCad[String(plot.cad).trim()] = plot; });

    const host = UI.el('home-map');
    host.innerHTML =
      '<div class="map-card"><div id="plan-app"></div></div>' +
      '<p class="map-hint">შეეხე ნაკვეთს — ვისია</p>';

    Sheet.handlers({
      onEdit: function (cad) { TableView.openEditor(cad); },
      onClose: function () { if (instance) instance.select(null); },
    });

    PlanView.load().then(function (data) {
      instance = PlanView.create(document.getElementById('plan-app'), data, {
        sidebar: false,
        // წარწერა ბაზიდან: გეგმის ფაილში ნომრები ერთხელ ჩაიწერა და
        // მოდერატორის შესწორებები იქ არ ხვდება.
        label: function (cad) { return byCad[cad] ? byCad[cad].num : ''; },
        onSelect: function (cad) { if (cad) openSheet(cad); },
      });
    }).catch(function (error) {
      host.innerHTML = '<p class="dialog-error">' +
        esc(error.message || 'გეგმა ვერ ჩაიტვირთა') + '</p>';
    });
  }

  function refresh() { if (instance) instance.refresh(); }
  /** ნომრის შესწორების შემდეგ — რუკის თავიდან აგების გარეშე. */
  function relabel() { if (instance) instance.relabel(); }

  return { render: render, refresh: refresh, relabel: relabel,
    openSheet: openSheet };
})();
