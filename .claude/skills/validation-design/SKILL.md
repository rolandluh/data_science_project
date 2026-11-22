---
name: validation-design
description: Design or check the validation of the EV charging demand model, recommendation output or spatial optimization (splits, baselines, sensitivity, solver checks). Use when planning or reviewing how results are validated.
---

# Validation design

The course grades whether results are validated and whether this runs automatically. Propose a validation that fits the method at hand, and write it into the Validation section of `docs/analysis_plan.md` when the user agrees.

## Building blocks

- **Baselines.** Always compare against something simple: population-weighted demand, EV-share x population (A0), greedy max coverage (B0).
- **Time split.** Use `Inbetriebnahmedatum` in `ladesaeulen.json`: build features with stations up to a cutoff, then check whether recommended sites match stations commissioned afterwards. Check first that enough stations were commissioned in 2025-2026.
- **Spatial hold-out.** Block cross-validation by district (`kreise_bw.geojson`) rather than random cells, to limit spatial autocorrelation.
- **Observed usage.** Station occupancy (`auslastung_*.parquet`) is a partial, biased ground truth; use it for rank agreement, not absolute accuracy, and state the coverage bias.
- **Sensitivity.** Vary the coverage radius R, the home-charging rate, the demand weights and k. Report how much the selected sites change (overlap of site sets), not only the objective value.
- **Optimization checks.** Solver status and optimality gap, constraint satisfaction, exact vs greedy comparison, and a check that the result is stable under a re-run.
- **Automated data checks.** Implausible values, empty cells and join losses are reported by the pipeline without manual steps (`src/validate.py`).

## Pitfalls

- Using features derived from existing stations to predict where stations exist, without a time split.
- Reporting a single metric without a baseline.
- Tuning a parameter and validating on the same data.

## Output

A short table: what is validated, how, against which baseline, the metric, and what result would count as failure.
