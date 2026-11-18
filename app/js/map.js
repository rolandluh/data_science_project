// Leaflet map, basemaps, the grey veil outside Baden-Württemberg and the state borders
import { byId, storage } from "./util.js";
import { loadJSON, layerError } from "./status.js";

// Germany's extent; the map cannot be zoomed out further than this
export const germany = L.latLngBounds([47.2, 5.8], [55.1, 15.1]);
// Baden-Württemberg: the initial view on every start or reload
export const badenWuerttemberg = L.latLngBounds([47.5, 7.5], [49.8, 10.5]);

export const map = L.map("map", { preferCanvas: true, zoomControl: false });
map.fitBounds(badenWuerttemberg);
map.setMinZoom(map.getBoundsZoom(germany));

L.control.zoom({ position: "bottomright" }).addTo(map);
L.control.scale({ position: "bottomright", imperial: false }).addTo(map);

// "Reset view" button under the zoom buttons
const resetControl = L.control({ position: "bottomright" });
resetControl.onAdd = () => {
  const div = L.DomUtil.create("div", "leaflet-bar reset-control");
  div.innerHTML =
    '<a href="#" role="button" title="Show all of Baden-Württemberg" aria-label="Show all of Baden-Württemberg">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></a>';
  L.DomEvent.disableClickPropagation(div);
  div.querySelector("a").addEventListener("click", (event) => {
    event.preventDefault();
    map.fitBounds(badenWuerttemberg);
  });
  return div;
};
resetControl.addTo(map);

export const isDark = () => document.documentElement.dataset.theme === "dark" ||
  (document.documentElement.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);

// Basemap: OpenStreetMap standard tiles (no API key needed). "Muted" greys them out with a CSS filter
// (and inverts them in dark mode) so that the data layers stand out; "osm" keeps the original colours.
const osmAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: osmAttribution }).addTo(map);
const basemapInput = byId("basemap");
basemapInput.value = storage.get("basemap", "muted") === "osm" ? "osm" : "muted";

function applyBasemap() {
  const muted = basemapInput.value !== "osm";
  const classes = map.getContainer().classList;
  classes.toggle("tiles-muted", muted && !isDark());
  classes.toggle("tiles-dark", isDark());
}
basemapInput.addEventListener("change", () => {
  storage.set("basemap", basemapInput.value);
  applyBasemap();
});

// Current zoom level (developer panel) and zoom slider, kept in sync with the map
const zoomInfo = byId("zoom-level");
const zoomSlider = byId("zoom");
zoomSlider.min = map.getMinZoom();
zoomSlider.value = map.getZoom();
zoomInfo.textContent = `Zoom ${map.getZoom()}`;
zoomSlider.addEventListener("input", () => map.setZoom(Number(zoomSlider.value)));
map.on("zoomend", () => {
  zoomSlider.value = map.getZoom();
  zoomInfo.textContent = `Zoom ${map.getZoom()}`;
});

// Outlines of the German states (no fill, so they don't block clicks)
const bordersLayer = L.geoJSON(null, { interactive: false, style: { weight: 1.5, fill: false } });

// Veil over everything outside Baden-Württemberg, in its own pane between the tiles and the data layers
map.createPane("mask");
map.getPane("mask").style.zIndex = 250;
map.getPane("mask").style.pointerEvents = "none";
let mask = null;

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
  return L.polygon([world, ...holes], { pane: "mask", interactive: false, stroke: false });
}

function applyOverlayTheme() {
  const dark = isDark();
  bordersLayer.setStyle({ color: dark ? "#e2e8f0" : "#0f172a" });
  if (mask) mask.setStyle({ fillColor: dark ? "#000000" : "#64748b", fillOpacity: dark ? 0.5 : 0.35 });
}

loadJSON("../data/processed/laender.geojson", "state borders")
  .then((data) => {
    bordersLayer.addData(data);
    const bw = data.features.find((feature) => feature.properties.AGS === "08");
    if (bw) mask = outsideMask(bw).addTo(map);
    applyOverlayTheme();
  })
  .catch((error) => layerError("show-borders", "state borders", error));

const bordersInput = byId("show-borders");
bordersInput.addEventListener("change", () => {
  if (bordersInput.checked) bordersLayer.addTo(map);
  else map.removeLayer(bordersLayer);
});

export function applyMapTheme() {
  applyBasemap();
  applyOverlayTheme();
}
applyMapTheme();
document.addEventListener("themechange", applyMapTheme);
