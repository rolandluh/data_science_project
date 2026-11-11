# Sensitivity check: home-charging rate

The supply-gap layer (`save_demand_gap_grid()` in `src/extract.py`) removes EV owners who can charge at home:

```
public demand = EV index × (1 − HOME_CHARGING_RATE × share of dwellings in 1–2-family houses)
```

`HOME_CHARGING_RATE` was first set to 0.8 as an assumption. This check calibrates it against observed station occupancy. **Result: 0.9.**

Script: `src/sensitivity_home_charging.py` (run from the project root).

## Method

- **Ground truth:** time-weighted occupancy per station from the MobiData BW history (`auslastung_taeglich_bw.parquet`, valid days only, at least 14 days per station). Station locations come from `historie_bw.geojson` (same IDs). 5,069 stations: 3,909 AC (< 50 kW) and 1,160 DC.
- **Predictor:** for each station and rate, *pressure* = public EV demand within R / register charging points within R. This is the same quantity the map shows per cell.
- **Rates tested:** 0 to 2 in steps of 0.05. Values above 1 are physically impossible (more than 100 % of house dwellers charging at home). They are tested only to detect confounding.
- **Radii:** 1, 1.5, 2 and 3 km. The map uses 1.5 km.

Checks:

1. Spearman correlation of pressure and occupancy.
2. Partial Spearman correlation, controlling for residents within R, station power and charging points within R. Apartment share is strongly tied to urban density, and density raises occupancy for other reasons too (destinations, through traffic).
3. Bootstrap (300 resamples) of the best rate from check 2.
4. Regression `log(occupancy) ~ log(public demand) + log(points) + log(kW) + log(residents)`, R² per rate.
5. Spatial hold-out: fit on the northern half of the stations, test on the southern half, and the other way round.

## Results (AC stations)

| Check | R = 1 km | R = 1.5 km |
|---|---|---|
| 1. Spearman, rate 0 → 0.8 → 1.0 | 0.19 → 0.27 → 0.30 | 0.14 → 0.23 → 0.27 |
| 1. Spearman, best rate | 1.50 (impossible) | 1.50 (impossible) |
| 2. Partial Spearman, rate 0 / 0.8 / 0.9 / 1.0 | 0.115 / 0.158 / 0.163 / 0.167 | 0.116 / 0.154 / 0.159 / 0.163 |
| 2. Partial Spearman, best rate | 1.20 | 1.10 |
| 3. Bootstrap, best rate within [0, 1] | 1.00 in 96 % | 1.00 in 96 % |
| 4. Regression R², rate 0 / 0.8 / 0.9 / 1.0 | 0.0766 / 0.0836 / 0.0839 / 0.0838 | 0.0626 / 0.0670 / 0.0671 / 0.0670 |
| 4. Regression, best rate | 0.95 | **0.90** |
| 5. Hold-out, best rate on the training half | 0.85 / 1.45 | 0.85 / 1.35 |

DC stations show no relation to residential demand at any rate (|rho| < 0.08). That fits fast charging being driven by traffic and destinations, not by residents.

## Interpretation

- **The correction is clearly supported.** Every check improves strongly from rate 0 to rate 0.8–1.0. Stations in areas with many 1–2-family houses are less used, even after controlling for density (partial rho of house share −0.07 to −0.09).
- **The exact value between 0.8 and 1.0 is only weakly identified.** The differences are ≤ 0.01 in rho and ≤ 0.0004 in R². The hold-out halves disagree (0.85 vs. 1.35–1.45).
- **The rank-based optimum lies above 1.** This shows that some density confounding remains, which pushes the rank-based estimate up. Its best value within [0, 1] is therefore the boundary 1.0, which would mean that nobody living in a house ever uses public charging.
- **0.9 is chosen.** It is the regression optimum at the map's radius (1.5 km), the only optimum inside the feasible range, and plausible (some house dwellers have no parking space or wallbox, or rent). On both hold-out test halves it scores at least as well as 0.8. Against 1.0 it is within noise: better on one half, worse on the other.

## Limitations

- The occupancy feed covers only about a third of BW stations and favours larger networks (see `README.md`).
- Occupancy is per day, not per hour, so overnight (residential) charging can't be separated from daytime use.
- Occupancy also depends on price, operator and visibility, none of which are modelled. The model explains little of the variance (R² ≈ 0.07). The check calibrates one parameter; it does not validate the whole demand model.
- A single rate is used for all house types. Separate rates for detached and terraced houses would add a parameter the data can't identify reliably.
