/**
 * რუკა: Leaflet + OpenStreetMap. ხატვის ინსტრუმენტი არ არის —
 * გეომეტრია გარე წყაროდან მოდის და Sheet-ში იწერება.
 */
const MapView = (function () {
  let map = null;
  let layer = null;
  let plots = [];
  let user = null;

  // dataviz-ის ვალიდირებული კატეგორიული პალიტრა, ფიქსირებული რიგით.
  // 8 ქუჩა = 8 სლოტი. ფერები არასოდეს ციკლდება — მე-9 ქუჩა ნაცრისფერში
  // ჩავარდება. light და dark ცალკე მასივებია: dataviz-ის ვალიდატორი
  // ერთი პალიტრით ორივე ზედაპირს ვერ ამტკიცებს (light-ის ფერები dark
  // ზედაპირზე Lightness band-ს არღვევენ) — ამიტომ ბნელი რეჟიმისთვის
  // საცნობარო დოკუმენტის საკუთარი dark სვეტია. მე-6 სლოტი (მწვანე)
  // ორივეგან ერთია — ეს საცნობარო მასივის მიხედვით სწორია, არა კოპირების
  // შეცდომა.
  const PALETTE_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100',
    '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
  const PALETTE_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500',
    '#d55181', '#008300', '#9085e9', '#e66767'];
  const GREY = '#898781';

  const DARK_QUERY = (typeof window !== 'undefined' && window.matchMedia)
    ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  let colorByStreet = {};

  /** მიმდინარე OS/ბრაუზერის თემის შესაბამისი მასივი. */
  function activePalette() {
    return (DARK_QUERY && DARK_QUERY.matches) ? PALETTE_DARK : PALETTE_LIGHT;
  }

  /**
   * Sheet-ის მონაცემი ხელით ივსება და შეიძლება შეიცავდეს ნებისმიერ
   * სიმბოლოს — popup-ის და "არ ჩანს" სიის HTML-ში embed-მდე ყველგან
   * escape-ვართ. table.js-ს იგივე დანიშნულების კერძო ჰელფერი აქვს
   * (არ არის export-ილი მოდულის საჯარო API-დან), ამიტომ ეს 5-სტრიქონიანი
   * სუფთა ფუნქცია აქაც დუბლირებულია — გაზიარებული export-ის დამატება
   * js/lib.js-ში ამ დავალების ფარგლებს სცდება.
   */
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function colorOf(plot) {
    return colorByStreet[String(plot.street || '').trim()] || GREY;
  }

  function popupHtml(plot) {
    const phone = plot.phone
      ? '<a href="tel:' + escapeHtml(plot.phone) + '">' + escapeHtml(plot.phone) + '</a>' : '—';
    const edit = (user && (user.role === 'moderator' || user.role === 'admin'))
      ? '<button data-edit="' + escapeHtml(plot.cad) + '">✏️ რედაქტირება</button>'
      : '';
    return '<b>' + escapeHtml(plot.address || plot.cad) + '</b><br>' +
      escapeHtml(WebLib.fullName(plot)) + '<br>' + phone + '<br>' +
      (plot.area ? escapeHtml(plot.area) + ' კვ.მ' : '') + '<br>' +
      '<small>' + escapeHtml(plot.purpose || '') + '</small><br>' +
      '<code>' + escapeHtml(plot.cad) + '</code><br>' + edit;
  }

  function render(allPlots, currentUser) {
    plots = allPlots;
    user = currentUser;

    const palette = activePalette();
    const streets = WebLib.streetList(plots);
    colorByStreet = {};
    streets.forEach(function (street, index) {
      if (index < palette.length) colorByStreet[street] = palette[index];
    });

    if (!map) {
      UI.el('panel-map').innerHTML =
        '<div id="map"></div><div id="map-legend"></div><div id="map-missing"></div>';
      map = L.map('map').setView([41.7455, 44.7195], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      // popup-ის "რედაქტირება" ღილაკს onclick-ატრიბუტში cad-ის ჩაწერის
      // მაგივრად (რაც ერთი ბრჭყალის შემთხვევაში JS სტრიქონს გატეხდა)
      // event delegation-ით ვუკავშირდებით — იგივე data-attribute პატერნი,
      // რასაც table.js იყენებს.
      map.on('popupopen', function (e) {
        const el = e.popup.getElement();
        const button = el && el.querySelector('[data-edit]');
        if (button) {
          button.addEventListener('click', function () {
            TableView.openEditor(button.getAttribute('data-edit'));
          });
        }
      });
    }

    if (layer) map.removeLayer(layer);
    layer = L.layerGroup().addTo(map);

    const missing = [];
    plots.forEach(function (plot) {
      const status = WebLib.mapStatus(plot);
      const color = colorOf(plot);

      if (status === 'polygon') {
        // GeoJSON არის [lon, lat], Leaflet ელოდება [lat, lon]
        const rings = plot.geometry.map(function (ring) {
          return ring.map(function (point) { return [point[1], point[0]]; });
        });
        L.polygon(rings, { color: color, weight: 2, fillOpacity: 0.35 })
          .bindPopup(popupHtml(plot)).addTo(layer);
      } else if (status === 'marker') {
        L.circleMarker([plot.lat, plot.lon], {
          radius: 8, color: color, fillColor: color, fillOpacity: 0.8, weight: 2,
        }).bindPopup(popupHtml(plot)).addTo(layer);
      } else {
        missing.push(plot);
      }
    });

    // ლეგენდა სავალდებულოა — 8 სერიაზე ფერი მარტო ვერ ატარებს იდენტობას
    UI.el('map-legend').innerHTML = '<h4>ქუჩები</h4>' +
      streets.map(function (street) {
        return '<span class="legend-item">' +
          '<i style="background:' + (colorByStreet[street] || GREY) + '"></i>' +
          escapeHtml(street) + '</span>';
      }).join('');

    UI.el('map-missing').innerHTML = missing.length === 0 ? '' :
      '<h4>რუკაზე არ ჩანს (' + missing.length + ')</h4>' +
      '<p>ამ ნაკვეთებს არც პოლიგონი აქვთ, არც კოორდინატი. ' +
      'ადმინმა Sheet-ში უნდა შეავსოს <code>გეომეტრია</code> ან ' +
      '<code>გრძედი</code>/<code>განედი</code>.</p><ul>' +
      missing.map(function (plot) {
        return '<li><code>' + escapeHtml(plot.cad) + '</code> — ' +
          escapeHtml(plot.address || 'მისამართის გარეშე') + '</li>';
      }).join('') + '</ul>';
  }

  function refresh() { if (map) map.invalidateSize(); }

  // მობილურზე/OS-ში სესიის შუაში თემის გადართვისას რუკა ხელახლა უნდა
  // დაიხატოს ახალი პალიტრით — თორემ ლეგენდა ერთ რეჟიმში ჩერდება, პოლიგონები
  // მეორეში. render()-მდე (map ჯერ არ არსებობს, plots ჯერ არ არის მიწოდებული)
  // არაფერი ხდება.
  if (DARK_QUERY) {
    DARK_QUERY.addEventListener('change', function () {
      if (map) render(plots, user);
    });
  }

  return { render: render, refresh: refresh };
})();
