// Data layers: study area, charging stations, grids, OSM points, parking, traffic, historic stations, legend
import { map } from "./map.js";
import { byId, popupHtml, classColor, classLabels, euro, escapeHtml, setChecked } from "./util.js";
import { bindStreetView } from "./streetview.js";
import { loadJSON, setLayerState, layerError, toast } from "./status.js";

const accent = "#2563eb";

// Inputs and configuration
const radiusInput = byId("radius");
const technologyInput = byId("technology");
const accessInput = byId("access");
const regionInput = byId("region");

export const config = {
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

// Study area: a district from the dropdown / search, or a circle set by clicking the map
export const districts = {}; // AGS code -> GeoJSON feature
let districtLayer = null;

export const districtsLoaded = loadJSON("../data/processed/kreise_bw.geojson", "districts")
  .then((data) => {
    data.features
      .sort((a, b) => a.properties.GEN.localeCompare(b.properties.GEN, "de"))
      .forEach((feature) => {
        const { AGS, GEN, BEZ } = feature.properties;
        districts[AGS] = feature;
        regionInput.add(new Option(`${GEN} (${BEZ})`, AGS));
      });
    return data.features;
  })
  .catch((error) => {
    layerError("show-area", "districts", error);
    return [];
  });

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
      interactive: false,
      style: { color: accent, weight: 2.5, fillOpacity: 0.04, dashArray: null },
    }).addTo(map);
    map.fitBounds(districtLayer.getBounds(), { padding: [24, 24] });
  }
  applyAreaVisibility();
  updateStyles();
});

// The study area (circle or district outline) can be hidden without losing the selection
const areaInput = byId("show-area");

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

// Study area: click the map to set the center (only while the developer panel is open,
// so that a planner's click on a grid cell does not move the circle)
map.on("click", (event) => {
  if (!document.body.classList.contains("dev-open")) return;
  if (config.region !== "circle") return;
  config.center = event.latlng;
  if (studyArea) {
    studyArea.setLatLng(event.latlng);
  } else {
    studyArea = L.circle(event.latlng, {
      radius: config.radiusKm * 1000,
      color: accent,
      weight: 2,
      fillOpacity: 0.08,
      interactive: false,
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
const registerColor = "#2563eb";
const matchedColor = "#9333ea";
const insideColor = "#f59e0b";
const selectedColor = "#16a34a";
const matchRadiusM = 50;

// Stations inside the circle are orange, the picked station is green
function updateStyles() {
  stations.forEach((station) => {
    const inside =
      studyArea !== null &&
      config.region === "circle" &&
      map.distance(studyArea.getLatLng(), station.marker.getLatLng()) <= studyArea.getRadius();
    const base = station.historic ? matchedColor : registerColor;
    const color = station === selectedStation ? selectedColor : inside ? insideColor : base;
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

const showRegisterInput = byId("show-register");
const showMatchedInput = byId("show-matched");

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

setLayerState("show-register", "loading");
setLayerState("show-matched", "loading");
const stationsLoaded = loadJSON("../data/processed/ladesaeulen.json", "charging stations")
  .then((data) => {
    const records = data.rows.map((row) => Object.fromEntries(data.columns.map((column, i) => [column, row[i]])));
    records.forEach((record) => {
      const marker = L.circleMarker([record["Breitengrad"], record["Längengrad"]], {
        radius: 4,
        weight: 1,
        fillOpacity: 0.85,
        bubblingMouseEvents: false, // a marker click must not move the study area
      }).bindPopup(() => {
        const historic = marker.station.historic;
        const title = `<p class="popup-title">${escapeHtml(record["Betreiber"] || "Charging station")}</p>`;
        if (!historic) return title + popupHtml(record);
        const extra = Object.fromEntries(Object.entries(historic).map(([key, value]) => [`Historic: ${key}`, value]));
        return title + popupHtml({ ...record, ...extra });
      });
      bindStreetView(marker);
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
  .catch((error) => layerError("show-register", "charging stations", error));

// Population heatmap from Zensus 2022 (100 m cells summed to 500 m): [lat, lon, residents]
// Semi-transparent colours; the heatmap is only shown between these zoom levels
const populationHeat = L.heatLayer([], {
  radius: 12,
  blur: 15,
  gradient: { 0.2: "rgba(37, 99, 235, 0.25)", 0.5: "rgba(245, 158, 11, 0.4)", 1: "rgba(220, 38, 38, 0.6)" },
});
const populationInput = byId("population");
const populationZoom = { min: 9, max: 19 };
let populationLoaded = null;

function updatePopulationHeat() {
  const zoom = map.getZoom();
  const visible = populationInput.checked && zoom >= populationZoom.min && zoom <= populationZoom.max;
  if (visible) populationHeat.addTo(map);
  else map.removeLayer(populationHeat);
}

populationInput.addEventListener("change", () => {
  if (populationInput.checked && !populationLoaded) {
    setLayerState("population", "loading");
    populationLoaded = loadJSON("../data/processed/bevoelkerung_500m.json", "population")
      .then((rows) => {
        populationHeat.setLatLngs(rows);
        setLayerState("population", null);
      })
      .catch((error) => {
        populationLoaded = null;
        layerError("population", "population", error);
      });
  }
  if (populationInput.checked && map.getZoom() < populationZoom.min) {
    toast("Residents heatmap appears from zoom level 9. Zoom in to see it.", "info");
  }
  updatePopulationHeat();
});
map.on("zoomend", updatePopulationHeat);

// 5 km grid choropleth: share of cars with electric drive in % (KBA)
export const evBreaks = [3, 4, 5, 6, 7, 8, 10];
export const evColors = ["#fef9c3", "#fde68a", "#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#b45309", "#7c2d12"];
const evInput = byId("ev");
export const noDataColor = "#cbd5e1";

const evLayer = L.geoJSON(null, {
  style: (feature) => ({
    color: "#64748b",
    weight: 0.3,
    fillColor: feature.properties.ev_share == null ? noDataColor : classColor(feature.properties.ev_share, evBreaks, evColors),
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

let evLoaded = null;
evInput.addEventListener("change", () => {
  if (!evInput.checked) {
    map.removeLayer(evLayer);
    return;
  }
  if (!evLoaded) {
    setLayerState("ev", "loading");
    evLoaded = loadJSON("../data/processed/ev_anteil_5km_bw.geojson", "EV share grid")
      .then((data) => {
        evLayer.addData(data);
        setLayerState("ev", null);
      })
      .catch((error) => {
        evLoaded = null;
        layerError("ev", "EV share grid", error);
      });
  }
  evLoaded.then(() => {
    if (evInput.checked) evLayer.addTo(map).bringToBack();
  });
});

// 500 m grid layer from a {columns, rows} JSON file; data is loaded the first time the switch is turned on
// The grid is sent to the back so that stations and other points stay on top of it.
// Cells are not interactive: the detail card (cells.js) finds the cell under the pointer itself.
function gridLayer(input, url, label, styleRow) {
  const layer = L.featureGroup();
  let loaded = null;
  input.addEventListener("change", () => {
    if (!input.checked) {
      map.removeLayer(layer);
      return;
    }
    if (!loaded) {
      setLayerState(input.id, "loading");
      loaded = loadJSON(url, label)
        .then(({ columns, rows }) => {
          const col = Object.fromEntries(columns.map((name, i) => [name, i]));
          rows.forEach((row) => {
            const cell = Object.fromEntries(Object.entries(col).map(([name, i]) => [name, row[i]]));
            // Approximate the 500 m EPSG:3035 cell as a lat/lon square around its centre (display only)
            const dLat = 0.00225;
            const dLon = 0.00225 / Math.cos((cell.lat * Math.PI) / 180);
            L.rectangle(
              [
                [cell.lat - dLat, cell.lon - dLon],
                [cell.lat + dLat, cell.lon + dLon],
              ],
              { stroke: false, fillOpacity: 0.7, interactive: false, ...styleRow(cell) }
            ).addTo(layer);
          });
          setLayerState(input.id, null);
        })
        .catch((error) => {
          loaded = null;
          layerError(input.id, label, error);
        });
    }
    loaded.then(() => {
      if (input.checked) layer.addTo(map).bringToBack();
    });
  });
  return layer;
}

// 500 m cells: parent 5 km EV share weighted by Zensus residents (ev_index = residents x share / 100)
export const evPopBreaks = [1, 2.5, 5, 10, 25, 50, 100];
export const evPopColors = ["#f0fdfa", "#ccfbf1", "#99f6e4", "#5eead4", "#2dd4bf", "#14b8a6", "#0f766e", "#134e4a"];

// 500 m cells: supply gap = public EV demand within 1.5 km / public charging points within 1.5 km (none in reach counts as one)
// Public demand = EV index minus the owners in 1-2-family houses assumed to charge at home (see save_demand_gap_grid)
// Palette: perceptually uniform, colour-vision-deficiency-safe sequential ramp (inferno family), light = low gap
export const gapBreaks = [5, 10, 20, 40, 80, 160];
export const gapColors = ["#fcffa4", "#f6d746", "#fca50a", "#f37819", "#dd513a", "#a52c60", "#6a176e"];

// 500 m cells: median monthly gross wage at residence (BA), from the 1 km parent, else the 5 km parent, else the district
export const incomeBreaks = [3800, 4100, 4300, 4500, 4700, 5000, 5500];
export const incomeColors = ["#faf5ff", "#f3e8ff", "#e9d5ff", "#d8b4fe", "#c084fc", "#a855f7", "#7e22ce", "#4c1d95"];

// Shared definitions of the three 500 m grids (also used by the detail card)
export const grids = {
  gap: {
    input: "gap-500m",
    url: "../data/processed/nachfrage_luecke_500m_bw.json",
    label: "supply gap grid",
    title: "Supply gap",
    style: (c) => ({ fillColor: classColor(c.ev_per_point, gapBreaks, gapColors) }),
    popupRow: (c) => ({
      "Residents (500 m)": c.Einwohner,
      "EV index of this cell": c.ev_index,
      "Dwellings in 1–2-family houses": c.house_share == null ? "no data" : `${Math.round(c.house_share * 100)} %`,
      "Public EV demand of this cell (no home charging)": c.ev_public,
      "Public EV demand within 1.5 km": c.demand,
      "Charging stations within 1.5 km": c.stations,
      "Charging points within 1.5 km": c.points,
      "Charging power within 1.5 km": `${c.kw.toLocaleString("de-DE")} kW`,
      "Public EV demand per charging point": c.points ? c.ev_per_point : `${c.ev_per_point} (no point in reach, counted as one)`,
    }),
  },
  ev: {
    input: "ev-500m",
    url: "../data/processed/ev_bevoelkerung_500m_bw.json",
    label: "EV index grid",
    title: "EV demand index",
    style: (c) => ({ fillColor: c.ev_index == null ? noDataColor : classColor(c.ev_index, evPopBreaks, evPopColors) }),
    popupRow: (c) => ({
      "Residents (500 m)": c.Einwohner,
      "EV share of parent 5 km cell": c.ev_share == null ? "no data" : c.ev_share + " %",
      "EV index (residents × share)": c.ev_index == null ? "no data" : c.ev_index,
      "5 km cell": c.cell_5km,
    }),
  },
  income: {
    input: "income-500m",
    url: "../data/processed/einkommen_500m_bw.json",
    label: "income grid",
    title: "Median wage",
    style: (c) => ({ fillColor: c.median_income == null ? noDataColor : classColor(c.median_income, incomeBreaks, incomeColors) }),
    popupRow: (c) => ({
      "Residents (500 m)": c.Einwohner,
      "Median gross wage per month": c.median_income == null ? "not published" : euro(c.median_income),
      "Median taken from": { "1km": "1 km cell", "5km": "5 km cell", kreis: "district (Kreis)" }[c.income_source] || "no data",
      "Resident employees (share of 1 km cell)": c.employees,
      "Wage sum per month (employees × median)": c.wage_sum == null ? "no data" : euro(c.wage_sum),
      "1 km cell": c.cell_1km,
    }),
  },
};
Object.values(grids).forEach((g) => gridLayer(byId(g.input), g.url, g.label, g.style));

// GeoJSON point layer loaded the first time its switch is turned on
function lazyGeoJSONLayer(input, url, label, layer, prepare = (data) => data) {
  let loaded = null;
  input.addEventListener("change", () => {
    if (!input.checked) {
      map.removeLayer(layer);
      return;
    }
    if (!loaded) {
      setLayerState(input.id, "loading");
      loaded = loadJSON(url, label)
        .then((data) => {
          layer.addData(prepare(data));
          setLayerState(input.id, null);
          return true;
        })
        .catch((error) => {
          loaded = null;
          layerError(input.id, label, error);
          return false;
        });
    }
    loaded.then((ok) => {
      if (ok && input.checked) layer.addTo(map);
    });
  });
}

const dot = (color, radius = 4) => (feature, latlng) =>
  L.circleMarker(latlng, {
    radius,
    color: "#ffffff",
    weight: 0.8,
    fillColor: color,
    fillOpacity: 0.95,
    bubblingMouseEvents: false,
  });

// OSM points (Geofabrik extract), one switch per category; a file is loaded the first time one of its switches is turned on
function osmPointLayer(input, url, filter, color, label) {
  const layer = L.geoJSON(null, {
    filter,
    pointToLayer: dot(color),
    onEachFeature: (feature, marker) => {
      marker.bindPopup(() => popupHtml(feature.properties));
      bindStreetView(marker);
    },
  });
  lazyGeoJSONLayer(input, url, label, layer);
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
osmPointLayers.forEach(([id, url, filter, color, label]) => osmPointLayer(byId(id), url, filter, color, label));

// Major roads (OSM motorway, trunk, primary) as lines under the points
const roadStyles = {
  motorway: { color: "#e11d48", weight: 2.4 },
  trunk: { color: "#ea580c", weight: 1.8 },
  primary: { color: "#64748b", weight: 1.1 },
};
const roadsLayer = L.geoJSON(null, {
  style: (feature) => ({ ...(roadStyles[feature.properties.highway] || roadStyles.primary), opacity: 0.85 }),
  onEachFeature: (feature, layer) => layer.bindPopup(() => popupHtml(feature.properties)),
});
lazyGeoJSONLayer(byId("roads"), "../data/processed/strassen_osm_bw.geojson", "major roads", roadsLayer);

// Parking sites in Baden-Württemberg (OSM joined with MobiData BW within 10 m, plus unmatched MobiData), shown as green dots
// Loaded on first use: the file is large (~90 MB)
const parkingColor = "#22c55e";
const parkingLayer = L.geoJSON(null, {
  pointToLayer: dot(parkingColor, 3),
  onEachFeature: (feature, layer) => {
    layer.bindPopup(() => popupHtml(feature.properties));
    bindStreetView(layer);
  },
});
lazyGeoJSONLayer(byId("parking"), "../data/processed/parkplaetze_kombiniert_bw.geojson", "parking sites", parkingLayer);

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

const trafficCounterLayer = L.geoJSON(null, {
  pointToLayer: dot(trafficCounterColor),
  onEachFeature: (feature, layer) => {
    layer.bindPopup(() => trafficCounterPopup(feature.properties));
    bindStreetView(layer);
  },
});
lazyGeoJSONLayer(byId("traffic-counters"), "../data/processed/verkehr_svz_bw.geojson", "traffic counting sites", trafficCounterLayer);

// Stations from the historic feed in Baden-Württemberg (18 Oct 2026) as rose dots
const historicColor = "#e11d48";
const historicLayer = L.geoJSON(null, {
  pointToLayer: dot(historicColor),
  onEachFeature: (feature, layer) => {
    layer.bindPopup(() => popupHtml(feature.properties));
    bindStreetView(layer);
  },
});

const historicInput = byId("show-historic");
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

setLayerState("show-historic", "loading");
Promise.all([stationsLoaded, loadJSON("../data/processed/historie_bw.geojson", "historic stations")])
  .then(([, data]) => {
    const unmatched = matchHistoric(data.features);
    historicLayer.addData({ type: "FeatureCollection", features: unmatched });
    console.log(`${data.features.length - unmatched.length} historic stations matched to the register`);
    setLayerState("show-historic", null);
  })
  .catch((error) => layerError("show-historic", "historic stations", error))
  .finally(() => {
    ["show-register", "show-matched"].forEach((id) => {
      if (stations.length) setLayerState(id, null);
    });
    showStations();
    updateStyles();
  });

// Demand view: the 500 m EV index grid (EV share × residents) with the charging stations on top.
// Turns the underlying switches on or off together, so they can still be changed one by one afterwards.
const demandInput = byId("demand");
demandInput.addEventListener("change", () => {
  ["ev-500m", "show-register", "show-matched"].forEach((id) => setChecked(byId(id), demandInput.checked));
});

// Legend, bottom-left: shows only the entries whose switch is on
const legend = L.control({ position: "bottomleft" });
legend.onAdd = () => {
  const div = L.DomUtil.create("div", "legend");
  div.innerHTML =
    '<button type="button" class="legend-toggle" aria-expanded="true" aria-controls="legend-body">' +
    '<span>Legend</span><svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>' +
    '<div id="legend-body" class="legend-body"></div>';
  L.DomEvent.disableClickPropagation(div);
  L.DomEvent.disableScrollPropagation(div);
  const toggle = div.querySelector(".legend-toggle");
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    div.querySelector(".legend-body").hidden = !open;
  });
  // Collapsed by default on small screens
  if (matchMedia("(max-width: 640px)").matches) toggle.click();
  return div;
};

const symbolEntries = [
  [["show-register", "show-matched"], "dot", registerColor, "Charging station (register)"],
  [["show-register", "show-matched"], "dot", insideColor, "Station in study area"],
  [["show-register", "show-matched"], "dot", selectedColor, "Selected station"],
  [["show-matched"], "dot", matchedColor, "Station in register and live feed"],
  [["show-historic"], "dot", historicColor, "Live-feed station only (18 Oct 2026)"],
  [["parking"], "dot", parkingColor, "Parking site (MobiData + OSM)"],
  [["traffic-counters"], "dot", trafficCounterColor, "Traffic counting site"],
  ...osmPointLayers.map(([id, , , color, label]) => [[id], "dot", color, label]),
  [["roads"], "line", roadStyles.motorway.color, "Motorway"],
  [["roads"], "line", roadStyles.trunk.color, "Trunk road"],
  [["roads"], "line", roadStyles.primary.color, "Primary road"],
  [["show-borders"], "box", "transparent", "State border"],
  [["show-area"], "box accent", "transparent", "Study area / district"],
  [["population"], "gradient", "linear-gradient(to right, rgba(37,99,235,0.6), rgba(245,158,11,0.6), rgba(220,38,38,0.8))", "Residents heatmap (zoom 9+)"],
];
const scaleEntries = [
  ["ev", "EV share of cars, 5 km grid (%)", classLabels(evBreaks), evColors, "no data"],
  ["ev-500m", "EV index, 500 m (residents × share)", classLabels(evPopBreaks), evPopColors, null],
  ["income-500m", "Median gross wage per month, 500 m", classLabels(incomeBreaks, euro), incomeColors, null],
];
const swatch = (shape, color, label) =>
  `<li><span class="swatch ${shape}" style="background:${color}" aria-hidden="true"></span>${label}</li>`;

// Supply gap: horizontal ramp with class breaks, the main legend of the planner view
function gapLegend() {
  const cells = gapColors.map((color) => `<span style="background:${color}"></span>`).join("");
  const ticks = gapBreaks.map((b, i) => `<span style="left:${((i + 1) / gapColors.length) * 100}%">${b}</span>`).join("");
  return (
    '<div class="legend-block">' +
    '<p class="legend-title">Supply gap</p>' +
    '<p class="legend-sub">Public EV demand per charging point within 1.5 km</p>' +
    `<div class="ramp" role="img" aria-label="Seven classes from below ${gapBreaks[0]} to ${gapBreaks[gapBreaks.length - 1]} or more">${cells}</div>` +
    `<div class="ramp-ticks" aria-hidden="true">${ticks}</div>` +
    '<div class="ramp-ends"><span>well served</span><span>under-served</span></div>' +
    "</div>"
  );
}

function renderLegend() {
  const container = legend.getContainer();
  if (!container) return;
  const body = container.querySelector(".legend-body");
  const symbols = symbolEntries.filter(([ids]) => ids.some((id) => byId(id).checked));
  const scales = scaleEntries.filter(([id]) => byId(id).checked);
  let html = "";
  if (byId("gap-500m").checked) html += gapLegend();
  scales.forEach(([, title, labels, colors, missing]) => {
    html += `<div class="legend-block"><p class="legend-title">${title}</p><ul>`;
    html += labels.map((label, i) => swatch("", colors[i], label)).join("");
    if (missing) html += swatch("", noDataColor, missing);
    html += "</ul></div>";
  });
  if (symbols.length) {
    html += `<div class="legend-block"><p class="legend-title">Symbols</p><ul>${symbols
      .map(([, ...entry]) => swatch(...entry))
      .join("")}</ul></div>`;
  }
  body.innerHTML = html;
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
// Any switch can change which entries are shown
document.addEventListener("change", (event) => {
  if (event.target.matches("input[type=checkbox]")) renderLegend();
});
