// Street View, two ways (keyless Google Maps embed, unofficial; may change):
//  - right-click a spot on the map -> "Street View here" -> fullscreen, close with × or Esc
//  - double-click a point (parking, station, POI ...) -> bubble at that point: info popup on the left, 500 x 400 px Street View on the right (bindStreetView)
import { map } from "./map.js";

const menu = document.createElement("div");
menu.className = "map-menu";
menu.hidden = true;
menu.innerHTML = '<button type="button" class="map-menu-item">Street View here</button>';
document.body.appendChild(menu);

const overlay = document.createElement("div");
overlay.className = "sv-overlay";
overlay.hidden = true;
overlay.setAttribute("role", "dialog");
overlay.setAttribute("aria-modal", "true");
overlay.setAttribute("aria-label", "Google Street View");
overlay.innerHTML =
  '<button type="button" class="sv-close" aria-label="Close Street View (Esc)">&times;</button>' +
  '<a class="sv-open" target="_blank" rel="noopener noreferrer">Open in Google Maps ↗</a>' +
  '<p class="sv-hint">Esc to close</p>';
document.body.appendChild(overlay);

let target = null;
let frame = null;

function hideMenu() {
  menu.hidden = true;
}

function open({ lat, lng }) {
  const ll = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  frame = document.createElement("iframe");
  frame.title = "Google Street View";
  frame.referrerPolicy = "no-referrer";
  frame.allow = "accelerometer; gyroscope; fullscreen";
  frame.allowFullscreen = true;
  frame.src = `https://www.google.com/maps?layer=c&cbll=${ll}&cbp=12,0,0,0,0&output=svembed`;
  overlay.prepend(frame);
  overlay.querySelector(".sv-open").href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${ll}`;
  overlay.hidden = false;
  overlay.querySelector(".sv-close").focus();
  // Real browser fullscreen too; if refused, the overlay still covers the whole window
  try {
    const request = overlay.requestFullscreen && overlay.requestFullscreen();
    if (request && request.catch) request.catch(() => {});
  } catch (error) {
    /* overlay alone is fine */
  }
}

function close() {
  if (overlay.hidden) return;
  overlay.hidden = true;
  if (frame) frame.remove();
  frame = null;
  try {
    if (document.fullscreenElement) document.exitFullscreen();
  } catch (error) {
    /* ignore */
  }
}

map.on("contextmenu", (event) => {
  L.DomEvent.preventDefault(event.originalEvent);
  target = event.latlng;
  const { clientX, clientY } = event.originalEvent;
  menu.hidden = false;
  const w = menu.offsetWidth;
  const h = menu.offsetHeight;
  menu.style.left = `${Math.min(clientX, window.innerWidth - w - 8)}px`;
  menu.style.top = `${Math.min(clientY, window.innerHeight - h - 8)}px`;
});

menu.addEventListener("click", () => {
  hideMenu();
  if (target) open(target);
});
menu.addEventListener("contextmenu", (event) => event.preventDefault());

map.on("click movestart zoomstart", hideMenu);
document.addEventListener("pointerdown", (event) => {
  if (!menu.hidden && !menu.contains(event.target)) hideMenu();
});
overlay.querySelector(".sv-close").addEventListener("click", close);
// Esc leaves browser fullscreen first; when that happens, close the overlay too
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) close();
});
// Capture phase: Esc closes Street View before the card or developer panel see it
document.addEventListener(
  "keydown",
  (event) => {
    if (event.key !== "Escape") return;
    if (!overlay.hidden) {
      event.stopImmediatePropagation();
      close();
    } else if (!menu.hidden) {
      hideMenu();
    }
  },
  true
);

// Double-click bubble: the point's info popup (left) next to a 500 x 400 px Street View (right), anchored at the point
export function bindStreetView(layer) {
  layer.on("dblclick", (event) => {
    L.DomEvent.stop(event);
    const latlng = layer.getLatLng ? layer.getLatLng() : layer.getBounds().getCenter();
    const ll = `${latlng.lat.toFixed(6)},${latlng.lng.toFixed(6)}`;
    const box = document.createElement("div");
    box.className = "sv-bubble";
    // Same content as the single-click popup, shown on the left
    const info = document.createElement("div");
    info.className = "sv-info leaflet-popup-content-inner";
    const source = layer.getPopup && layer.getPopup();
    let content = source ? source.getContent() : "";
    if (typeof content === "function") content = content(layer);
    if (content instanceof Node) info.appendChild(content);
    else info.innerHTML = content || "";
    box.appendChild(info);
    const iframe = document.createElement("iframe");
    iframe.title = "Google Street View";
    iframe.referrerPolicy = "no-referrer";
    iframe.allow = "accelerometer; gyroscope; fullscreen";
    iframe.allowFullscreen = true;
    iframe.src = `https://www.google.com/maps?layer=c&cbll=${ll}&cbp=12,0,0,0,0&output=svembed`;
    box.appendChild(iframe);
    L.popup({ minWidth: 780, maxWidth: 780, className: "sv-popup", autoPanPadding: [20, 20] })
      .setLatLng(latlng)
      .setContent(box)
      .openOn(map);
  });
}
