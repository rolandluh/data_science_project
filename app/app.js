// Map centered on Germany with OpenStreetMap tiles
// Germany's extent; the map cannot be zoomed out further than this
const germany = L.latLngBounds([47.2, 5.8], [55.1, 15.1]);
// Baden-Württemberg: the initial view on every start or reload
const badenWuerttemberg = L.latLngBounds([47.5, 7.5], [49.8, 10.5]);
const map = L.map("map", { preferCanvas: true });
map.fitBounds(badenWuerttemberg);
map.setMinZoom(map.getBoundsZoom(germany));

// Current zoom level shown in the bottom-right corner
const zoomInfo = L.control({ position: "bottomright" });
zoomInfo.onAdd = function () {
  this._div = L.DomUtil.create("div", "zoom-level");
  this._div.textContent = `Zoom ${map.getZoom()}`;
  return this._div;
};
zoomInfo.addTo(map);
map.on("zoomend", () => {
  zoomInfo._div.textContent = `Zoom ${map.getZoom()}`;
});

// Vertical zoom slider on the right, kept in sync with the map
const zoomSlider = document.getElementById("zoom");
zoomSlider.min = map.getMinZoom();
zoomSlider.value = map.getZoom();
zoomSlider.addEventListener("input", () => map.setZoom(Number(zoomSlider.value)));
map.on("zoomend", () => {
  zoomSlider.value = map.getZoom();
});

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Popup with every non-empty column of the Bundesnetzagentur record
function popupHtml(record) {
  const rows = Object.entries(record)
    .filter(([, value]) => value !== null && value !== "")
    .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`);
  return `<table>${rows.join("")}</table>`;
}

// Inputs and configuration
const radiusInput = document.getElementById("radius");
const technologyInput = document.getElementById("technology");
const accessInput = document.getElementById("access");
const regionInput = document.getElementById("region");

const config = {
  center: null,
  radiusKm: 10,
  technology: "both",
  maxAccessKm: 10, // stored for the optimization; not used yet
  region: "circle", // "circle" or a district AGS code
};

// Keeps a number input within its range and returns the value used
function readRange(input, min, max, fallback) {
  const value = Number(input.value);
  const clamped = Number.isNaN(value) ? fallback : Math.min(max, Math.max(min, value));
  input.value = clamped;
  return clamped;
}

let studyArea = null;

radiusInput.addEventListener("change", () => {
  config.radiusKm = readRange(radiusInput, 1, 50, 10);
  if (studyArea) studyArea.setRadius(config.radiusKm * 1000);
  updateStyles();
});

technologyInput.addEventListener("change", () => {
  config.technology = technologyInput.value;
  showStations();
});

accessInput.addEventListener("change", () => {
  config.maxAccessKm = readRange(accessInput, 1, 20, 10);
});

// Study area: a district from the dropdown, or a circle set by clicking the map
const districts = {}; // AGS code -> GeoJSON feature
let districtLayer = null;

fetch("../data/processed/kreise_bw.geojson")
  .then((response) => response.json())
  .then((data) => {
    data.features
      .sort((a, b) => a.properties.GEN.localeCompare(b.properties.GEN, "de"))
      .forEach((feature) => {
        const { AGS, GEN, BEZ } = feature.properties;
        districts[AGS] = feature;
        regionInput.add(new Option(`${GEN} (${BEZ})`, AGS));
      });
  })
  .catch((error) => console.error("Could not load districts", error));

regionInput.addEventListener("change", () => {
  config.region = regionInput.value;
  const useCircle = config.region === "circle";
  radiusInput.disabled = !useCircle;

  if (districtLayer) {
    map.removeLayer(districtLayer);
    districtLayer = null;
  }
  if (studyArea) {
    if (useCircle) studyArea.addTo(map);
    else map.removeLayer(studyArea);
  }
  if (!useCircle) {
    districtLayer = L.geoJSON(districts[config.region], {
      style: { color: "#2563eb", weight: 2, fillOpacity: 0.08 },
    }).addTo(map);
    map.fitBounds(districtLayer.getBounds());
  }
  applyAreaVisibility();
  updateStyles();
});

// The study area (circle or district outline) can be hidden without losing the selection
const areaInput = document.getElementById("show-area");

function applyAreaVisibility() {
  const on = areaInput.checked;
  if (studyArea) {
    if (on && config.region === "circle") studyArea.addTo(map);
    else map.removeLayer(studyArea);
  }
  if (districtLayer) {
    if (on) districtLayer.addTo(map);
    else map.removeLayer(districtLayer);
  }
}

areaInput.addEventListener("change", applyAreaVisibility);

// Study area: click the map to set the center
map.on("click", (event) => {
  if (config.region !== "circle") return;
  config.center = event.latlng;
  if (studyArea) {
    studyArea.setLatLng(event.latlng);
  } else {
    studyArea = L.circle(event.latlng, {
      radius: config.radiusKm * 1000,
      color: "#2563eb",
      weight: 2,
      fillOpacity: 0.08,
    }).addTo(map);
  }
  applyAreaVisibility();
  updateStyles();
});

// Charging stations
// Nearby stations merge into numbered circles that split up when zooming in; from zoom 14 every station is shown on its own
const stationLayer = L.markerClusterGroup({ chunkedLoading: true, disableClusteringAtZoom: 14 }).addTo(map);
const stations = []; // { record, marker, ac, dc, historic }
let selectedStation = null;
// Register stations that also appear in the historic feed (within matchRadiusM)
const matchedColor = "#9333ea";
const matchRadiusM = 50;

// Stations inside the circle are orange, the picked station is red
function updateStyles() {
  stations.forEach((station) => {
    const inside =
      studyArea !== null &&
      config.region === "circle" &&
      map.distance(studyArea.getLatLng(), station.marker.getLatLng()) <= studyArea.getRadius();
    const base = station.historic ? matchedColor : "#2563eb";
    const color = station === selectedStation ? "#16a34a" : inside ? "#f59e0b" : base;
    if (color !== station.color) {
      station.color = color;
      station.marker.setStyle({ color, fillColor: color });
    }
  });
}

function selectStation(station) {
  selectedStation = station;
  updateStyles();
}

const showRegisterInput = document.getElementById("show-register");
const showMatchedInput = document.getElementById("show-matched");

function showStations() {
  stationLayer.clearLayers();
  stationLayer.addLayers(
    stations
      .filter((station) => (station.historic ? showMatchedInput.checked : showRegisterInput.checked))
      .filter((station) => config.technology === "both" || (config.technology === "ac" ? station.ac : station.dc))
      .map((station) => station.marker)
  );
}

showRegisterInput.addEventListener("change", showStations);
showMatchedInput.addEventListener("change", showStations);

const stationsLoaded = fetch("../data/processed/ladesaeulen.json")
  .then((response) => response.json())
  .then((data) => {
    const records = data.rows.map((row) => Object.fromEntries(data.columns.map((column, i) => [column, row[i]])));
    records.forEach((record) => {
      const marker = L.circleMarker([record["Breitengrad"], record["Längengrad"]], {
        radius: 3,
        weight: 1,
        fillOpacity: 0.8,
        bubblingMouseEvents: false, // a marker click must not move the study area
      }).bindPopup(() => {
        const historic = marker.station.historic;
        if (!historic) return popupHtml(record);
        const extra = Object.fromEntries(Object.entries(historic).map(([key, value]) => [`Historic: ${key}`, value]));
        return popupHtml({ ...record, ...extra });
      });
      const plugs = Object.keys(record)
        .filter((key) => key.startsWith("Steckertypen"))
        .map((key) => record[key] || "")
        .join(";");
      const station = { record, marker, ac: plugs.includes("AC "), dc: plugs.includes("DC "), historic: null };
      marker.station = station;
      marker.on("click", () => selectStation(station));
      stations.push(station);
    });
    console.log(`${records.length} charging stations loaded`);
  })
  .catch((error) => console.error("Could not load charging stations", error));

// Population heatmap from Zensus 2022 (100 m cells summed to 500 m): [lat, lon, residents]
// Semi-transparent colours; the heatmap is only shown between these zoom levels
const populationHeat = L.heatLayer([], {
  radius: 12,
  blur: 15,
  gradient: { 0.2: "rgba(37, 99, 235, 0.25)", 0.5: "rgba(245, 158, 11, 0.4)", 1: "rgba(220, 38, 38, 0.6)" },
});
const populationInput = document.getElementById("population");
const populationZoom = { min: 9, max: 19 };

function updatePopulationHeat() {
  const zoom = map.getZoom();
  const visible = populationInput.checked && zoom >= populationZoom.min && zoom <= populationZoom.max;
  if (visible) populationHeat.addTo(map);
  else map.removeLayer(populationHeat);
}

fetch("../data/processed/bevoelkerung_500m.json")
  .then((response) => response.json())
  .then((rows) => populationHeat.setLatLngs(rows))
  .catch((error) => console.error("Could not load population", error));

populationInput.addEventListener("change", updatePopulationHeat);
map.on("zoomend", updatePopulationHeat);

// 5 km grid choropleth: share of cars with electric drive in % (KBA)
const evBreaks = [3, 4, 5, 6, 7, 8, 10];
const evColors = ["#fef9c3", "#fde68a", "#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#b45309", "#7c2d12"];
const evInput = document.getElementById("ev");

function evColor(share) {
  let i = 0;
  while (i < evBreaks.length && share >= evBreaks[i]) i++;
  return evColors[i];
}

const evLayer = L.geoJSON(null, {
  style: (feature) => ({
    color: "#6b7280",
    weight: 0.3,
    fillColor: feature.properties.ev_share == null ? "#e5e7eb" : evColor(feature.properties.ev_share),
    fillOpacity: 0.6,
  }),
  onEachFeature: (feature, layer) => {
    const p = feature.properties;
    layer.bindPopup(
      popupHtml({
        "5 km cell": p.cell_id,
        "EV share (cars)": p.ev_share == null ? "no data" : p.ev_share + " %",
        "Reporting year": p.year,
      })
    );
  },
});

fetch("../data/processed/ev_anteil_5km_bw.geojson")
  .then((response) => response.json())
  .then((data) => evLayer.addData(data))
  .catch((error) => console.error("Could not load EV grid", error));

evInput.addEventListener("change", () => {
  if (evInput.checked) evLayer.addTo(map).bringToBack();
  else map.removeLayer(evLayer);
});

// Colour class of a value: breaks [b0, b1, ...] give classes < b0, b0 – b1, ..., ≥ last
function classColor(value, breaks, colors) {
  let i = 0;
  while (i < breaks.length && value >= breaks[i]) i++;
  return colors[i];
}

function classLabels(breaks, format = (b) => b) {
  return [
    `&lt; ${format(breaks[0])}`,
    ...breaks.slice(0, -1).map((b, i) => `${format(b)} – ${format(breaks[i + 1])}`),
    `≥ ${format(breaks[breaks.length - 1])}`,
  ];
}

// 500 m grid layer from a {columns, rows} JSON file; data is loaded the first time the switch is turned on
// The grid is sent to the back so that stations and other points stay on top of it
function gridLayer(input, url, styleRow, popupRow) {
  const layer = L.featureGroup();
  let loaded = null;
  input.addEventListener("change", () => {
    if (!input.checked) {
      map.removeLayer(layer);
      return;
    }
    loaded =
      loaded ||
      fetch(url)
        .then((response) => response.json())
        .then(({ columns, rows }) => {
          const col = Object.fromEntries(columns.map((name, i) => [name, i]));
          const get = (row) => Object.fromEntries(Object.entries(col).map(([name, i]) => [name, row[i]]));
          rows.forEach((row) => {
            const cell = get(row);
            // Approximate the 500 m EPSG:3035 cell as a lat/lon square around its centre (display only)
            const dLat = 0.00225;
            const dLon = 0.00225 / Math.cos((cell.lat * Math.PI) / 180);
            L.rectangle(
              [
                [cell.lat - dLat, cell.lon - dLon],
                [cell.lat + dLat, cell.lon + dLon],
              ],
              { stroke: false, fillOpacity: 0.7, ...styleRow(cell) }
            )
              .bindPopup(() => popupHtml(popupRow(cell)))
              .addTo(layer);
          });
        })
        .catch((error) => console.error(`Could not load ${url}`, error));
    loaded.then(() => {
      if (input.checked) layer.addTo(map).bringToBack();
    });
  });
  return layer;
}

const noDataColor = "#e5e7eb";

// 500 m cells: parent 5 km EV share weighted by Zensus residents (ev_index = residents x share / 100)
const evPopBreaks = [1, 2.5, 5, 10, 25, 50, 100];
const evPopColors = ["#f0fdfa", "#ccfbf1", "#99f6e4", "#5eead4", "#2dd4bf", "#14b8a6", "#0f766e", "#134e4a"];
const evPopInput = document.getElementById("ev-500m");
gridLayer(
  evPopInput,
  "../data/processed/ev_bevoelkerung_500m_bw.json",
  (c) => ({ fillColor: c.ev_index == null ? noDataColor : classColor(c.ev_index, evPopBreaks, evPopColors) }),
  (c) => ({
    "Residents (500 m)": c.Einwohner,
    "EV share of parent 5 km cell": c.ev_share == null ? "no data" : c.ev_share + " %",
    "EV index (residents × share)": c.ev_index == null ? "no data" : c.ev_index,
    "5 km cell": c.cell_5km,
  })
);

// 500 m cells: supply gap = public EV demand within 1.5 km / public charging points within 1.5 km (none in reach counts as one)
// Public demand = EV index minus the owners in 1-2-family houses assumed to charge at home (see save_demand_gap_grid)
const gapBreaks = [5, 10, 20, 40, 80, 160];
const gapColors = ["#ffffcc", "#ffeda0", "#fed976", "#feb24c", "#fd8d3c", "#f03b20", "#bd0026"];
gridLayer(
  document.getElementById("gap-500m"),
  "../data/processed/nachfrage_luecke_500m_bw.json",
  (c) => ({ fillColor: classColor(c.ev_per_point, gapBreaks, gapColors) }),
  (c) => ({
    "Residents (500 m)": c.Einwohner,
    "EV index of this cell": c.ev_index,
    "Dwellings in 1–2-family houses": c.house_share == null ? "no data" : `${Math.round(c.house_share * 100)} %`,
    "Public EV demand of this cell (no home charging)": c.ev_public,
    "Public EV demand within 1.5 km": c.demand,
    "Charging stations within 1.5 km": c.stations,
    "Charging points within 1.5 km": c.points,
    "Charging power within 1.5 km": `${c.kw.toLocaleString("de-DE")} kW`,
    "Public EV demand per charging point": c.points ? c.ev_per_point : `${c.ev_per_point} (no point in reach, counted as one)`,
  })
);

// 500 m cells: median monthly gross wage at residence (BA), from the 1 km parent, else the 5 km parent, else the district
const incomeBreaks = [3800, 4100, 4300, 4500, 4700, 5000, 5500];
const incomeColors = ["#faf5ff", "#f3e8ff", "#e9d5ff", "#d8b4fe", "#c084fc", "#a855f7", "#7e22ce", "#4c1d95"];
const incomeInput = document.getElementById("income-500m");
const euro = (value) => `${Math.round(value).toLocaleString("de-DE")} €`;
gridLayer(
  incomeInput,
  "../data/processed/einkommen_500m_bw.json",
  (c) => ({ fillColor: c.median_income == null ? noDataColor : classColor(c.median_income, incomeBreaks, incomeColors) }),
  (c) => ({
    "Residents (500 m)": c.Einwohner,
    "Median gross wage per month": c.median_income == null ? "not published" : euro(c.median_income),
    "Median taken from": { "1km": "1 km cell", "5km": "5 km cell", kreis: "district (Kreis)" }[c.income_source] || "no data",
    "Resident employees (share of 1 km cell)": c.employees,
    "Wage sum per month (employees × median)": c.wage_sum == null ? "no data" : euro(c.wage_sum),
    "1 km cell": c.cell_1km,
  })
);

// OSM points (Geofabrik extract), one switch per category; a file is loaded the first time one of its switches is turned on
const geojsonFiles = {}; // url -> Promise of the parsed file, shared by the switches that use it
function loadGeoJSON(url) {
  geojsonFiles[url] = geojsonFiles[url] || fetch(url).then((response) => response.json());
  return geojsonFiles[url];
}

function osmPointLayer(input, url, filter, color) {
  const layer = L.geoJSON(null, {
    filter,
    pointToLayer: (feature, latlng) =>
      L.circleMarker(latlng, {
        radius: 3,
        color,
        fillColor: color,
        fillOpacity: 0.9,
        weight: 1,
        bubblingMouseEvents: false,
      }),
    onEachFeature: (feature, marker) => marker.bindPopup(() => popupHtml(feature.properties)),
  });
  let loaded = null;
  input.addEventListener("change", () => {
    if (!input.checked) {
      map.removeLayer(layer);
      return;
    }
    loaded =
      loaded ||
      loadGeoJSON(url)
        .then((data) => layer.addData(data))
        .catch((error) => console.error(`Could not load ${url}`, error));
    loaded.then(() => {
      if (input.checked) layer.addTo(map);
    });
  });
}

const poiUrl = "../data/processed/poi_osm_bw.geojson";
const roadPointUrl = "../data/processed/strassenpunkte_osm_bw.geojson";
const substationUrl = "../data/processed/umspannwerke_osm_bw.geojson";
const hasValue = (key, values) => (feature) => values.includes(feature.properties[key]);
// [switch id, file, feature filter, colour, legend label]
const osmPointLayers = [
  ["poi-office", poiUrl, hasValue("category", ["office"]), "#4f46e5", "Office (OSM)"],
  ["poi-industrial", poiUrl, hasValue("category", ["industrial"]), "#78716c", "Industrial site (OSM)"],
  ["poi-supermarket", poiUrl, hasValue("category", ["supermarket"]), "#c2410c", "Supermarket (OSM)"],
  ["poi-retail", poiUrl, hasValue("category", ["retail"]), "#db2777", "Retail (OSM)"],
  ["poi-university", poiUrl, hasValue("category", ["university"]), "#0284c7", "University (OSM)"],
  ["poi-hospital", poiUrl, hasValue("category", ["hospital"]), "#dc2626", "Hospital (OSM)"],
  ["road-junction", roadPointUrl, hasValue("kind", ["junction"]), "#475569", "Motorway junction (OSM)"],
  ["road-rest", roadPointUrl, hasValue("kind", ["rest_area", "services"]), "#854d0e", "Rest area / services (OSM)"],
  ["substations", substationUrl, () => true, "#ca8a04", "Substation (OSM)"],
];
osmPointLayers.forEach(([id, url, filter, color]) => osmPointLayer(document.getElementById(id), url, filter, color));

// Legend, bottom-left: shows only the entries whose switch is on
const legend = L.control({ position: "bottomleft" });
legend.onAdd = () => L.DomUtil.create("div", "legend");

const byId = (id) => document.getElementById(id);
const symbolEntries = [
  [["show-register", "show-matched"], "dot", "#2563eb", "Charging station (register)"],
  [["show-register", "show-matched"], "dot", "#f59e0b", "Station in study area"],
  [["show-register", "show-matched"], "dot", "#16a34a", "Selected station"],
  [["show-matched"], "dot", matchedColor, "Station in register and historic data"],
  [["show-historic"], "dot", "#e11d48", "Charging station (historic only, 18 Oct 2026)"],
  [["parking"], "dot", "#22c55e", "Parking spot (MobiData + OSM)"],
  [["traffic-counters"], "dot", "#0d9488", "Traffic counting site"],
  ...osmPointLayers.map(([id, , , color, label]) => [[id], "dot", color, label]),
  [["show-borders"], "box", "#000000", "State border"],
  [["show-area"], "box", "#2563eb", "Study area / district"],
  [["population"], "gradient", "linear-gradient(to right, rgba(37,99,235,0.6), rgba(245,158,11,0.6), rgba(220,38,38,0.8))", "Population heatmap (zoom 9+)"],
];
const scaleEntries = [
  ["ev", "EV share of cars, 5 km grid (%)", classLabels(evBreaks), evColors, "no data"],
  ["ev-500m", "EV index, 500 m grid (residents × share)", classLabels(evPopBreaks), evPopColors, null],
  ["gap-500m", "Supply gap: public EV demand per charging point (1.5 km)", classLabels(gapBreaks), gapColors, null],
  ["income-500m", "Median gross wage per month, 500 m grid", classLabels(incomeBreaks, euro), incomeColors, null],
];
const swatch = (shape, color, label) =>
  `<div><span class="swatch ${shape}" style="background:${color}"></span>${label}</div>`;

function renderLegend() {
  const container = legend.getContainer();
  if (!container) return;
  const symbols = symbolEntries.filter(([ids]) => ids.some((id) => byId(id).checked));
  const scales = scaleEntries.filter(([id]) => byId(id).checked);
  let html = "";
  if (symbols.length) html += "<strong>Symbols</strong>" + symbols.map(([, ...entry]) => swatch(...entry)).join("");
  scales.forEach(([, title, labels, colors, missing]) => {
    html += `<strong>${title}</strong>` + labels.map((label, i) => swatch("", colors[i], label)).join("");
    if (missing) html += swatch("", noDataColor, missing);
  });
  container.innerHTML = html;
  container.style.display = html ? "" : "none";
}

const legendInput = byId("show-legend");
function applyLegendVisibility() {
  if (legendInput.checked) {
    legend.addTo(map);
    renderLegend();
  } else {
    legend.remove();
  }
}
applyLegendVisibility();
legendInput.addEventListener("change", applyLegendVisibility);
// Any switch in the side panel can change which entries are shown
document.querySelector("aside").addEventListener("change", renderLegend);

// Demand view: the 500 m EV index grid (EV share × residents) with the charging stations on top.
// Turns the underlying switches on or off together, so they can still be changed one by one afterwards.
const demandInput = byId("demand");
demandInput.addEventListener("change", () => {
  ["ev-500m", "show-register", "show-matched"].forEach((id) => {
    const input = byId(id);
    if (input.checked === demandInput.checked) return;
    input.checked = demandInput.checked;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
});

// Parking sites in Baden-Württemberg (OSM joined with MobiData BW within 10 m, plus unmatched MobiData), shown as green dots
const parkingInput = document.getElementById("parking");
const parkingLayer = L.geoJSON(null, {
  pointToLayer: (feature, latlng) =>
    L.circleMarker(latlng, {
      radius: 3,
      color: "#22c55e",
      fillColor: "#22c55e",
      fillOpacity: 0.9,
      weight: 1,
      bubblingMouseEvents: false,
    }),
  onEachFeature: (feature, layer) => layer.bindPopup(() => popupHtml(feature.properties)),
});

fetch("../data/processed/parkplaetze_kombiniert_bw.geojson")
  .then((response) => response.json())
  .then((data) => parkingLayer.addData(data))
  .catch((error) => console.error("Could not load parking sites", error));

parkingInput.addEventListener("change", () => {
  if (parkingInput.checked) parkingLayer.addTo(map);
  else map.removeLayer(parkingLayer);
});

// Traffic counting sites (Verkehrsmonitoring BW) as teal dots
const trafficCounterColor = "#0d9488";
const countTypes = {
  DZ: "Permanent station",
  DZZ: "Permanently counting site",
  MZ: "Manual count",
  "MZ*": "Manual count this year, reduced values",
  TM: "Temporary measurement",
  "TM 2G": "Temporary measurement, 2 devices",
  VBA: "Traffic control system",
};
const countLocations = { FS: "Open road", OD: "Through town" };
const countMethods = { H: "Extrapolated from a count", F: "Carried forward from an earlier count" };

function vehiclesPerDay(value) {
  return value == null ? null : `${Math.round(value).toLocaleString("en-US")} / day`;
}

// Labels and units for a counting site; empty values are dropped by popupHtml
function trafficCounterPopup(p) {
  const share = (part) => (part != null && p.dtv ? ` (${((100 * part) / p.dtv).toFixed(1)} %)` : "");
  const change =
    p.dtv != null && p.dtv_two_years_before != null
      ? `${(100 * (p.dtv / p.dtv_two_years_before - 1)).toFixed(1)} %`
      : null;
  const section = [p.direction_1, p.direction_2].filter(Boolean).join(" – ");
  return popupHtml({
    Road: p.road,
    Section: section,
    "Site number": p.station_id,
    Type: countTypes[p.count_type] || p.count_type,
    Location: countLocations[p.location] || p.location,
    Lanes: p.lanes,
    [`Traffic ${p.year} (all vehicles)`]: vehiclesPerDay(p.dtv) ?? "no data",
    "Cars and vans": p.dtv_cars == null ? null : vehiclesPerDay(p.dtv_cars) + share(p.dtv_cars),
    "Heavy vehicles": p.dtv_heavy == null ? null : vehiclesPerDay(p.dtv_heavy) + share(p.dtv_heavy),
    "Normal workdays": vehiclesPerDay(p.dtv_workday),
    "Workdays in school holidays": vehiclesPerDay(p.dtv_holiday_workday),
    "Sundays and public holidays": vehiclesPerDay(p.dtv_sunday),
    [`Change since ${p.year - 2}`]: change,
    "Last counted": p.last_counted,
    [`How ${p.year} was calculated`]: countMethods[p.method] || null,
    Comment: p.comment,
  });
}

const trafficCounterInput = document.getElementById("traffic-counters");
const trafficCounterLayer = L.geoJSON(null, {
  pointToLayer: (feature, latlng) =>
    L.circleMarker(latlng, {
      radius: 3,
      color: trafficCounterColor,
      fillColor: trafficCounterColor,
      fillOpacity: 0.9,
      weight: 1,
      bubblingMouseEvents: false,
    }),
  onEachFeature: (feature, layer) => layer.bindPopup(() => trafficCounterPopup(feature.properties)),
});

fetch("../data/processed/verkehr_svz_bw.geojson")
  .then((response) => response.json())
  .then((data) => trafficCounterLayer.addData(data))
  .catch((error) => console.warn("Traffic counting sites not loaded (file may not exist yet)", error));

trafficCounterInput.addEventListener("change", () => {
  if (trafficCounterInput.checked) trafficCounterLayer.addTo(map);
  else map.removeLayer(trafficCounterLayer);
});

// Stations from the historic feed in Baden-Württemberg (18 Oct 2026) as rose dots
const historicLayer = L.geoJSON(null, {
  pointToLayer: (feature, latlng) =>
    L.circleMarker(latlng, {
      radius: 3,
      color: "#e11d48",
      fillColor: "#e11d48",
      fillOpacity: 0.9,
      weight: 1,
      bubblingMouseEvents: false,
    }),
  onEachFeature: (feature, layer) => layer.bindPopup(() => popupHtml(feature.properties)),
});

const historicInput = document.getElementById("show-historic");
historicInput.addEventListener("change", () => {
  if (historicInput.checked) historicLayer.addTo(map);
  else map.removeLayer(historicLayer);
});

// Matches historic stations to register stations by location (no shared ID).
// Matched ones are drawn once, as the purple register dot; the rest stay rose.
function matchHistoric(features) {
  const cell = 0.001; // ~100 m grid, so only neighbouring cells need checking
  const key = (lat, lon) => `${Math.floor(lat / cell)},${Math.floor(lon / cell)}`;
  const grid = new Map();
  stations.forEach((station) => {
    const { lat, lng } = station.marker.getLatLng();
    const k = key(lat, lng);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(station);
  });
  return features.filter((feature) => {
    const [lon, lat] = feature.geometry.coordinates;
    const latLng = L.latLng(lat, lon);
    let best = null;
    let bestDistance = matchRadiusM;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const k = `${Math.floor(lat / cell) + dy},${Math.floor(lon / cell) + dx}`;
        (grid.get(k) || []).forEach((station) => {
          const distance = map.distance(latLng, station.marker.getLatLng());
          if (distance <= bestDistance) {
            best = station;
            bestDistance = distance;
          }
        });
      }
    }
    if (best && !best.historic) best.historic = feature.properties;
    return !best;
  });
}

Promise.all([stationsLoaded, fetch("../data/processed/historie_bw.geojson").then((response) => response.json())])
  .then(([, data]) => {
    const unmatched = matchHistoric(data.features);
    historicLayer.addData({ type: "FeatureCollection", features: unmatched });
    console.log(`${data.features.length - unmatched.length} historic stations matched to the register`);
  })
  .catch((error) => console.error("Could not load historic stations", error))
  .finally(() => {
    showStations();
    updateStyles();
  });

// Black outlines of the German states (no fill, so they don't block clicks)
const bordersLayer = L.geoJSON(null, {
  interactive: false,
  style: { color: "#000000", weight: 1.5, fill: false },
});

// Grey veil over everything outside Baden-Württemberg, in its own pane between the tiles and the data layers
map.createPane("mask");
map.getPane("mask").style.zIndex = 250;
map.getPane("mask").style.pointerEvents = "none";

function outsideMask(feature) {
  const world = [
    [85, -180],
    [85, 180],
    [-85, 180],
    [-85, -180],
  ];
  const parts = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  // The outer ring of every BW part becomes a hole in the world polygon
  const holes = parts.map((polygon) => polygon[0].map(([lon, lat]) => [lat, lon]));
  return L.polygon([world, ...holes], {
    pane: "mask",
    interactive: false,
    stroke: false,
    fillColor: "#9ca3af",
    fillOpacity: 0.55,
  });
}

fetch("../data/processed/laender.geojson")
  .then((response) => response.json())
  .then((data) => {
    bordersLayer.addData(data);
    const bw = data.features.find((feature) => feature.properties.AGS === "08");
    if (bw) outsideMask(bw).addTo(map);
  })
  .catch((error) => console.error("Could not load state borders", error));

const bordersInput = document.getElementById("show-borders");
bordersInput.addEventListener("change", () => {
  if (bordersInput.checked) bordersLayer.addTo(map);
  else map.removeLayer(bordersLayer);
});
