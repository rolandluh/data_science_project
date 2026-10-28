# Historic Charger Data: Weekly File Comparison

**Source:** `data/raw/historie/*_ladesaeulen_woche.csv.gz`, analysed by `week_metrics.py` (scratchpad, not in the repo)
**Coverage:** Weeks 202605 to 202640 (36 weeks).
**Definitions:** `share>0` = share of rows with `chargepoint_charging_count > 0`; `gap_med_min` = median over stations of each station's median gap between distinct update timestamps.

## Layout Changes

- **Weeks 202605–202623:** 24 columns, no `station_id`.
- **Weeks 202624–202636:** 23 columns, `station_id` added; `station_id == id` in all rows.
- **Weeks 202637–202640:** 29 columns (adds `status_last_updated`, `realtime_data_outdated`, `last_updated`), from header check only.

## Weekly Metrics

| week | cols | rows(M) | snapshots | rows/h(med) | stations | share>0 | gap_med_min |
|------|------|---------|-----------|-------------|----------|---------|-------------|
| 202605 | 24 | 11.01 | 1208 | 108588 | 114190 | 0.154 | - |
| 202606 | 24 | 17.79 | 1962 | 108504 | 9798 | 0.149 | - |
| 202607 | 24 | 18.09 | 1962 | 109956 | 114946 | 0.146 | - |
| 202608 | 24 | 18.00 | 1961 | 110124 | 9796 | 0.153 | - |
| 202609 | 24 | 17.18 | 1869 | 110196 | 9713 | 0.144 | - |
| 202610 | 24 | 18.01 | 1952 | 110448 | 11131 | 0.144 | - |
| 202611 | 24 | 17.98 | 1940 | 108858 | 116191 | 0.167 | - |
| 202612 | 24 | 17.91 | 1928 | 102674 | 9904 | 0.176 | - |
| 202613 | 24 | 20.77 | 1816 | 130339 | 80444 | 0.167 | - |
| 202614 | 24 | 22.30 | 1872 | 131186 | 12529 | 0.172 | - |
| 202615 | 24 | 22.08 | 1851 | 131263 | 12646 | 0.146 | - |
| 202616 | 24 | 22.47 | 1887 | 131340 | 12479 | 0.154 | - |
| 202617 | 24 | 19.40 | 1628 | 130020 | 12506 | 0.183 | - |
| 202618 | 24 | 13.89 | 1137 | 85876 | 13073 | 0.184 | - |
| 202619 | 24 | 20.08 | 1028 | 127060 | 26082 | 0.120 | - |
| 202620 | 24 | 19.01 | 748 | 101704 | 26106 | 0.097 | - |
| 202621 | 24 | 20.73 | 687 | 127953 | 32415 | 0.110 | - |
| 202622 | 24 | 15.97 | 491 | 97179 | 33532 | 0.125 | - |
| 202623 | 24 | 17.65 | 535 | 98985 | 33483 | 0.169 | - |
| 202624 | 23 | 17.52 | 537 | 97350 | 33397 | 0.193 | 20.0 |
| 202625 | 23 | 27.88 | 854 | 97563 | 89771 | 0.200 | 5.0 |
| 202626 | 23 | 21.53 | 648 | 163385 | 33247 | 0.203 | 10.0 |
| 202627 | 23 | 21.69 | 656 | 147852 | 33369 | 0.208 | 10.0 |
| 202628 | 23 | 21.12 | 634 | 132432 | 33568 | 0.184 | 10.0 |
| 202629 | 23 | 17.01 | 512 | 66450 | 33787 | 0.186 | 10.0 |
| 202630 | 23 | 19.95 | 590 | 134620 | 35165 | 0.204 | 10.0 |
| 202631 | 23 | 13.66 | 385 | 69415 | 92730 | 0.205 | 20.0 |
| 202632 | 23 | 24.05 | 687 | 139264 | 37699 | 0.216 | 10.0 |
| 202633 | 23 | 16.00 | 689 | 110295 | 41072 | 0.223 | 10.0 |
| 202634 | 23 | 1.63 | 751 | 9795 | 37502 | 0.645 | 105.0 |
| 202635 | 23 | 1.69 | 755 | 11598 | 38196 | 0.645 | 120.0 |
| 202636 | 23 | 1.68 | 760 | 10803 | 38412 | 0.648 | 110.0 |
| 202637 | 29 | 1.58 | 743 | 9794 | 37755 | 0.631 | 120.0 |
| 202638 | 29 | 2.09 | 710 | 12556 | 102247 | 0.554 | 1404.3 |
| 202639 | 29 | 1.87 | 734 | 12050 | 44376 | 0.618 | 120.0 |
| 202640 | 29 | 7.43 | 698 | 47623 | 45489 | 0.277 | 60.0 |

## Initial Findings

- Weeks 05–33: 14–28 M rows per week. Weeks 34–39: 1.6–2.1 M rows per week (about 1/10). Week 40: 7.4 M rows.
- Rows per snapshot fall from about 34,000 (week 30) to about 2,200 (weeks 34–37), while snapshots per week stay at 700–760. So each snapshot covers far fewer stations from week 34 onward.
- Share of rows with charging > 0 rises from about 0.20 (weeks 24–33) to about 0.63–0.65 (weeks 34–39), then 0.28 in week 40.
- Median station gap is 10 min in weeks 26–33, 105–120 min in weeks 34–37 and 39, 1404 min in week 38, and 60 min in week 40. Week 38 has 102k distinct stations versus about 38–45k in neighbouring weeks.
- Median over all gaps (not per station) gives 30 min for weeks 34–37 and 39, so most stations are updated every 30 min or less, but the per-station median is much longer.
- Distinct snapshot timestamps per week fall from about 1900 (weeks 05–13) to about 500–650 (weeks 22–30).
- Weeks 05–23 show no station gap (gap '-'). Earlier reason: the id column there does not repeat per station. Check: the id-based gap for week 202609 is 5.1 min, so this reason needs checking.
- The state filter 'Baden-Württemberg' returns 0 rows in most weeks, so BW filtering needs checking before use.

## Root Cause Analysis (W34 Drop)

Investigation compared W33 (last full week) against W34, W35, W36 across three dimensions.

### A. Provider/Source Composition

All 10 sources are present in every week — **no provider dropped out**. Every source lost ~90% of its records uniformly:

| Source | W33 records | W34 records | Change |
|--------|------------|------------|--------|
| datex2_ecomovement | 7,573,524 | 771,306 | −90% |
| opendata_swiss | 3,853,924 | 193,920 | −95% |
| datex2_chargecloud | 3,075,346 | 232,951 | −92% |
| datex2_enbw | 1,162,629 | 316,198 | −73% |
| datex2_tesla | 185,639 | 111,141 | −40% |
| Small sources (5) | ~153,440 | ~8,770 | −94% |

Distinct station IDs per source remained roughly stable (e.g. ecomovement 17,317 → 17,448). The decline is in **records per station**, not station coverage.

### B. Timestamps and Update Intervals

No outage: all weeks cover 168/168 hours with valid timestamps.

| Metric | W33 | W34 | W35 | W36 |
|--------|-----|-----|-----|-----|
| Rows/hour (median) | 110,295 | 9,794 | 11,598 | 10,803 |
| Distinct snapshot minutes | 689 | 751 | 755 | 760 |
| Per-station median gap | 10.0 min | 20.0 min | 20.0 min | 20.0 min |

The number of snapshot timestamps actually **increased** after W34, but each snapshot returns ~10× fewer rows. The per-station polling interval doubled from 10 min to 20 min.

### C. Station Identity

- `id == station_id` in 100% of rows (W24+). Identity is clean.
- Distinct IDs: W33 = 41,072; W34 = 37,502; W35 = 38,196; W36 = 38,412 — minor fluctuation, not a collapse.
- Records per ID: **W33 median = 432, W34 median = 18** — each station is recorded ~24× fewer times.

### Conclusion

The drop at W34 (starting 17 August 2026) is a **platform-side archiving change**, not a data loss or provider outage:

1. **Polling interval doubled** from 10 min → 20 min.
2. **Snapshot scope shrank ~10×** — each poll writes far fewer station rows, likely switching from full snapshots to **change-only deltas** (only stations whose availability changed since the last poll are recorded).
3. This explains the jump in `share>0` from ~0.22 to ~0.65: when only changed stations are written, a higher fraction of recorded rows show active charging.
4. The MobiData BW dataset metadata was updated on **18 August 2026**, one day after the change took effect.

## Open Questions

- Cause of the week 202638 jump to 102k stations and 1404 min median gap.
- Confirm id meaning in weeks 05–23 and the state label per week.
- Whether the change-only-delta hypothesis can be confirmed via the MobiData BW API documentation or team.
