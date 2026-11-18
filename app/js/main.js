// Entry point. Module order matters: map first, then the data layers, then the UI on top.
import "./errorlog.js";
import "./map.js";
import "./layers.js";
import "./cells.js";
import "./ui.js";
import "./streetview.js";
import { byId, setChecked } from "./util.js";

// Default planner view: the supply gap grid, the main result of the project
setChecked(byId("gap-500m"), true);
