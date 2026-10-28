// Map centered on Germany with OpenStreetMap tiles
// Germany's extent; the map cannot be zoomed out further than this
const germany = L.latLngBounds([47.2, 5.8], [55.1, 15.1]);
// Baden-Württemberg: the initial view on every start or reload
const badenWuerttemberg = L.latLngBounds([47.5, 7.5], [49.8, 10.5]);
const map = L.map("map", { preferCanvas: true });
map.fitBounds(badenWuerttemberg);
map.setMinZoom(map.getBoundsZoom(germany));

// Written by src.run_pipeline after validation. The map remains usable if it is absent.
const dataStatus = document.getElementById("data-status");
fetch("../data/processed/update_status.json", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((report) => {
    const date = report.generated_at ? new Date(report.generated_at).toLocaleString() : "unknown";
    const successful = report.datasets?.filter((dataset) => dataset.ok).length || 0;
    const ml = report.ml;
    dataStatus.textContent = report.ok
      ? `Data checked: ${date} (${successful} datasets). ML: ${ml?.status || "not configured"}.`
      : `Data check needs attention: ${date}. The map shows the last generated files.`;
  })
  .catch(() => {
    dataStatus.textContent = "Data status unavailable; this map uses the local generated files.";
  });

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
  updateStyles();
});

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
  updateStyles();
});

// Charging stations
// Nearby stations merge into numbered circles that split up when zooming in
const stationLayer = L.markerClusterGroup({ chunkedLoading: true }).addTo(map);
const stations = []; // { record, marker, ac, dc }
let selectedStation = null;

// Stations inside the circle are orange, the picked station is red
function updateStyles() {
  stations.forEach((station) => {
    const inside =
      studyArea !== null &&
      config.region === "circle" &&
      map.distance(studyArea.getLatLng(), station.marker.getLatLng()) <= studyArea.getRadius();
    const color = station === selectedStation ? "#dc2626" : inside ? "#f59e0b" : "#2563eb";
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

function showStations() {
  stationLayer.clearLayers();
  stationLayer.addLayers(
    stations
      .filter((station) => config.technology === "both" || (config.technology === "ac" ? station.ac : station.dc))
      .map((station) => station.marker)
  );
}

fetch("../data/processed/ladesaeulen.json")
  .then((response) => response.json())
  .then((data) => {
    const records = data.rows.map((row) => Object.fromEntries(data.columns.map((column, i) => [column, row[i]])));
    records.forEach((record) => {
      const marker = L.circleMarker([record["Breitengrad"], record["Längengrad"]], {
        radius: 4,
        weight: 1,
        fillOpacity: 0.8,
        bubblingMouseEvents: false, // a marker click must not move the study area
      }).bindPopup(() => popupHtml(record));
      const plugs = Object.keys(record)
        .filter((key) => key.startsWith("Steckertypen"))
        .map((key) => record[key] || "")
        .join(";");
      const station = { record, marker, ac: plugs.includes("AC "), dc: plugs.includes("DC ") };
      marker.on("click", () => selectStation(station));
      stations.push(station);
    });
    showStations();
    updateStyles();
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
    ["dot", "#dc2626", "Selected station"],
    ["dot", "#7c3aed", "Charging station (historic, 18 Oct 2026)"],
    ["dot", "#89cff0", "Parking spot"],
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
  onEachFeature: (feature, layer) => layer.bindPopup(() => popupHtml(feature.properties) + gridParkingPopup(feature)),
}).addTo(map);

fetch("../data/processed/parkplaetze_bw.geojson")
  .then((response) => response.json())
  .then((data) => parkingLayer.addData(data))
  .catch((error) => console.error("Could not load parking sites", error));

parkingInput.addEventListener("change", () => {
  if (parkingInput.checked) parkingLayer.addTo(map);
  else map.removeLayer(parkingLayer);
});

// Stations from the historic feed in Baden-Württemberg (18 Oct 2026) as purple dots
const historicLayer = L.geoJSON(null, {
  pointToLayer: (feature, latlng) =>
    L.circleMarker(latlng, {
      radius: 4,
      color: "#7c3aed",
      fillColor: "#7c3aed",
      fillOpacity: 0.9,
      weight: 1,
      bubblingMouseEvents: false,
    }),
  onEachFeature: (feature, layer) => layer.bindPopup(() => popupHtml(feature.properties)),
}).addTo(map);

fetch("../data/processed/historie_bw.geojson")
  .then((response) => response.json())
  .then((data) => historicLayer.addData(data))
  .catch((error) => console.error("Could not load historic stations", error));

// Black outlines of the German states (no fill, so they don't block clicks)
fetch("../data/processed/laender.geojson")
  .then((response) => response.json())
  .then((data) => {
    L.geoJSON(data, {
      interactive: false,
      style: { color: "#000000", weight: 1.5, fill: false },
    }).addTo(map);
  })
  .catch((error) => console.error("Could not load state borders", error));

// Optional, precomputed grid snapshot: no Overpass requests from the browser.
let gridProximity = null;
const gridInput = document.getElementById("grid");
const gridStatus = document.getElementById("grid-status");
const gridColors = { distribution: "#0f766e", other_station: "#64748b", line: "#b45309" };
const gridLayer = L.geoJSON(null, {
  style: (feature) => ({
    color: gridColors[feature.properties.category], weight: 2, fillOpacity: 0.18,
  }),
  pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
    radius: 5, color: gridColors[feature.properties.category], fillOpacity: 0.85,
  }),
  onEachFeature: (feature, layer) => {
    const p = feature.properties;
    layer.bindPopup(() => "<strong>Mapped electricity infrastructure</strong>" + popupHtml({
      Name: p.name || "Unknown",
      Type: p.power,
      Classification: p.category,
      "Substation type": p.substation || "Unknown",
      "Recorded voltage (V)": p.voltage || "Unknown",
      Operator: p.operator || "Unknown",
      "OSM reference": p.osm_ref,
      "Available capacity": "Unknown",
    }) + "<p>Proximity does not confirm connection feasibility or cost.</p>");
  },
});
let gridData = null;

function gridParkingPopup(feature) {
  if (!gridProximity) return "<p>Grid proximity data is unavailable or still loading.</p>";
  const [lon, lat] = feature.geometry.coordinates;
  const match = gridProximity[`${lon.toFixed(6)},${lat.toFixed(6)}`];
  if (!match) return "<p>Outside the processed grid study area. Grid proximity is unknown.</p>";
  const format = (record) => record
    ? `${Math.round(record.distance_m)} m (${record.osm_ref}; voltage: ${record.voltage || "unknown"})`
    : "No matching mapped asset found in the search area";
  return "<strong>Grid proximity</strong>" + popupHtml({
    "Mapped distribution infrastructure": format(match.distribution),
    "Mapped line / cable (any voltage)": format(match.line),
    "Available capacity": "Unknown — operator assessment required",
  }) + "<p>Straight-line distance to mapped geometry; not a cable route or cost estimate.</p>";
}

gridInput.addEventListener("change", () => {
  if (gridInput.checked) {
    if (gridData && gridLayer.getLayers().length === 0) gridLayer.addData(gridData);
    gridLayer.addTo(map);
  }
  else map.removeLayer(gridLayer);
});
fetch("../data/processed/stromnetz_bw.geojson")
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    if (!data.metadata || !Array.isArray(data.features) || !data.parking_proximity) {
      throw new Error("Invalid grid dataset");
    }
    gridData = data;
    gridProximity = data.parking_proximity;
    gridInput.disabled = false;
    const m = data.metadata;
    gridStatus.textContent = `Grid coverage: ${m.scope}. ${m.asset_count} mapped assets. ` +
      `Downloaded: ${(m.retrieved_at || "unknown").slice(0, 10)}. ` +
      "Teal: distribution; grey: other stations; brown: lines/cables. Capacity and connection feasibility unknown.";
    map.attributionControl.addAttribution('Grid data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>');
  })
  .catch(() => {
    gridStatus.textContent = "Electricity infrastructure unavailable. Other map layers remain usable.";
  });
