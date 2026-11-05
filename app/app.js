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
// Nearby stations merge into numbered circles that split up when zooming in
const stationLayer = L.markerClusterGroup({ chunkedLoading: true }).addTo(map);
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

// Population heatmap from Zensus 2022 (1 km cells): [lat, lon, residents]
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

fetch("../data/processed/bevoelkerung_1km.json")
  .then((response) => response.json())
  .then((rows) => populationHeat.setLatLngs(rows))
  .catch((error) => console.error("Could not load population", error));

populationInput.addEventListener("change", updatePopulationHeat);
map.on("zoomend", updatePopulationHeat);

// Municipality choropleth of battery-electric cars (KBA, 1 Oct 2024)
const evBreaks = [50, 100, 250, 500, 1000, 2500, 5000];
const evColors = ["#fef9c3", "#fde68a", "#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#b45309", "#7c2d12"];
const evInput = document.getElementById("ev");

function evColor(bev) {
  let i = 0;
  while (i < evBreaks.length && bev >= evBreaks[i]) i++;
  return evColors[i];
}

const evLayer = L.geoJSON(null, {
  style: (feature) => ({
    color: "#6b7280",
    weight: 0.3,
    fillColor: feature.properties.bev == null ? "#e5e7eb" : evColor(feature.properties.bev),
    fillOpacity: 0.7,
  }),
  onEachFeature: (feature, layer) => {
    const p = feature.properties;
    const share = p.pkw ? ((100 * p.bev) / p.pkw).toFixed(1) + " %" : "no data";
    layer.bindPopup(
      popupHtml({
        Gemeinde: p.GEN,
        "Cars (all)": p.pkw,
        "Battery-electric (BEV)": p.bev,
        "Plug-in hybrid": p.phev,
        "BEV share": share,
      })
    );
  },
});

fetch("../data/processed/gemeinden_ev.geojson")
  .then((response) => response.json())
  .then((data) => evLayer.addData(data))
  .catch((error) => console.error("Could not load municipalities", error));

evInput.addEventListener("change", () => {
  if (evInput.checked) evLayer.addTo(map);
  else map.removeLayer(evLayer);
});

// Legend for all symbols and colours, bottom-left
const legend = L.control({ position: "bottomleft" });
legend.onAdd = () => {
  const div = L.DomUtil.create("div", "legend");
  const symbols = [
    ["dot", "#2563eb", "Charging station (register)"],
    ["dot", "#f59e0b", "Station in study area"],
    ["dot", "#16a34a", "Selected station"],
    ["dot", matchedColor, "Station in register and historic data"],
    ["dot", "#e11d48", "Charging station (historic only, 18 Oct 2026)"],
    ["dot", "#89cff0", "Parking spot (MobiData)"],
    ["dot", "#22c55e", "Parking spot (OSM)"],
    ["dot", "#0d9488", "Traffic counting site"],
    ["box", "#000000", "State border"],
    ["box", "#2563eb", "Study area / district"],
    ["gradient", "linear-gradient(to right, rgba(37,99,235,0.6), rgba(245,158,11,0.6), rgba(220,38,38,0.8))", "Population heatmap (zoom 9+)"],
  ];
  const labels = [
    `&lt; ${evBreaks[0]}`,
    ...evBreaks.slice(0, -1).map((b, i) => `${b} – ${evBreaks[i + 1]}`),
    `≥ ${evBreaks[evBreaks.length - 1]}`,
  ];
  div.innerHTML =
    "<strong>Symbols</strong>" +
    symbols.map(([shape, color, label]) => `<div><span class="swatch ${shape}" style="background:${color}"></span>${label}</div>`).join("") +
    "<strong>BEV cars per municipality</strong>" +
    labels.map((label, i) => `<div><span class="swatch" style="background:${evColors[i]}"></span>${label}</div>`).join("") +
    '<div><span class="swatch" style="background:#e5e7eb"></span>no data</div>';
  return div;
};
legend.addTo(map);

const legendInput = document.getElementById("show-legend");
legendInput.addEventListener("change", () => {
  if (legendInput.checked) legend.addTo(map);
  else legend.remove();
});

// Parking sites in Baden-Württemberg (MobiData BW), shown as baby-blue dots
const parkingInput = document.getElementById("parking");
const parkingLayer = L.geoJSON(null, {
  pointToLayer: (feature, latlng) =>
    L.circleMarker(latlng, {
      radius: 4,
      color: "#89CFF0",
      fillColor: "#89CFF0",
      fillOpacity: 0.9,
      weight: 1,
      bubblingMouseEvents: false,
    }),
  onEachFeature: (feature, layer) => layer.bindPopup(() => popupHtml(feature.properties)),
}).addTo(map);

fetch("../data/processed/parkplaetze_bw.geojson")
  .then((response) => response.json())
  .then((data) => parkingLayer.addData(data))
  .catch((error) => console.error("Could not load parking sites", error));

parkingInput.addEventListener("change", () => {
  if (parkingInput.checked) parkingLayer.addTo(map);
  else map.removeLayer(parkingLayer);
});

// OSM parking spots in Baden-Württemberg, shown as green dots
const parkingOsmInput = document.getElementById("parking-osm");
const parkingOsmLayer = L.geoJSON(null, {
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

fetch("../data/processed/parkplaetze_osm_bw.geojson")
  .then((response) => response.json())
  .then((data) => {
    parkingOsmLayer.addData(data);
    console.log(`${data.features.length} OSM parking features loaded`);
  })
  .catch((error) => console.warn("OSM parking not loaded (file may not exist yet)", error));

parkingOsmInput.addEventListener("change", () => {
  if (parkingOsmInput.checked) parkingOsmLayer.addTo(map);
  else map.removeLayer(parkingOsmLayer);
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
}).addTo(map);

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
}).addTo(map);

fetch("../data/processed/laender.geojson")
  .then((response) => response.json())
  .then((data) => bordersLayer.addData(data))
  .catch((error) => console.error("Could not load state borders", error));

const bordersInput = document.getElementById("show-borders");
bordersInput.addEventListener("change", () => {
  if (bordersInput.checked) bordersLayer.addTo(map);
  else map.removeLayer(bordersLayer);
});
