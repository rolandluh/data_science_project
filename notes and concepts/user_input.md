# User input

What the user (a CPO) sets in the app, with defaults. Sections (§) refer to `demand_estimation_v1.md`.

Status: ✅ decided · ❓ proposed, not decided yet.

## Main inputs

| # | Input | Options / default | What it changes | Status |
|---|---|---|---|---|
| 1 | **Area of examination** | **Radius** (map click or address + km) **or Landkreis** (dropdown, one or more) | Only candidates inside the area can be picked. Features, competition and spacing still use all of BW, so stations just outside the border count. | ✅ |
| 2 | **Charger type** | AC only · DC only · both (default) | Shows only the budget fields needed; the other budget is 0. DC only picks motorway, primary-road and supermarket spots in v1 (§6). | ❓ |
| 3 | **Budget** (€, one per class) | **Simple:** total € for AC and for DC; default cost values are used. **Detailed:** the user also edits the cost components (below). | How many sites fit (§9). | ✅ |
| 4 | **Scenario year** | Today (default) · 2030 · 2035. Future demand per Kreis from the StandortTOOL dashboard download only. | Hours per point, sizing, cost per site, number of sites; the order between Kreise can shift. | ✅ (Referenzszenario; supply as linear register trend, §9) |

## Detailed budget: cost components

Per class (AC / DC). Defaults come from the cost list (`todos.md`), each marked as sourced or assumed. The user can overwrite any value; "reset to default" restores them.

| Component | Unit | Used for |
|---|---|---|
| Hardware and installation per point (AC 11 / 22 kW; DC 50 / 150 kW / HPC) | € per point | Site cost = per-point cost × points from sizing |
| Grid connection | € per site | Site cost |
| Civil works (ground, signs, parking marking) | € per site | Site cost |
| Subsidies | € or % per site | Deducted from site cost |
| Annual operation and maintenance | € per point per year | Returns display only, not the budget |

## Advanced settings (collapsed, defaults are fine)

| Input | Default | What it changes | Status |
|---|---|---|---|
| Max points per site | 8 AC / 12 DC | Caps sizing (§5) | ✅ |
| Points per site, per pick | from sizing | User override for a single site | ✅ |
| Minimum spacing between picks | one value per class, larger for DC (still to set) | Spacing rule (§9) | ✅ rule / ❓ values |
| Value assumptions | delivered kW per class, price and energy cost per kWh, lifetime, discount rate | Energy and returns display only (§9) | ✅ |
| Hide low-confidence candidates | off | Removes candidates with the "Low confidence" flag (§7) | ❓ |

## Future inputs (not in v1)

| Input | Default | What it would change |
|---|---|---|
| Own operator group | none (feed operator mix, §4) | Predictions as if this operator group built the site |
| Occupancy level (how often a site may be full) | v1 fixed: as full as 3 in 4 of today's stations (AC ≈ 31%, DC ≈ 5% of days). Later as presets, e.g. comfortable / standard / lean = 50th / 75th / 90th percentile | Points per site and cost (§5) |

## Not user input in v1

- **Optimizer mode:** usage maximization only. Accessibility and hybrid (λ slider) come later (§9).
- **AC/DC per site:** set by the context rule (§6), not by the user.
- **Model settings** (features, buffers, CV) are fixed in the pipeline.
