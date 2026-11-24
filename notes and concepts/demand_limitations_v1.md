# Demand limitations v1

Known limits of the v1 demand model and optimizer hand-off (`demand_estimation_v1.md`), ordered by severity. Section numbers (§) refer to that record.

- **High:** can change which sites are recommended, or mislead the main claim.
- **Medium:** biases parts of the output; the direction is known.
- **Low:** adds noise or concerns details.

Evidence: **measured** = checked on our data, **inferred** = plausible reason, not verified, **untested** = not checked yet.

## High

| # | Limit | Consequence | Evidence |
|---|---|---|---|
| H1 | **The feed covers only about half of public points.** 51% of register stations have a feed station within 50 m. Small operators: 15% (vs 69% for 200+ stations). Municipal utilities: all or nothing (Stuttgart 91%, SWU 0%). Slow AC ≤ 22 kW: 36%. | The model learns the usage of big networks and fast charging. Validation measures agreement within the feed, not the register. A station missing from the feed does not mean low demand. | measured (register 1 Sep vs feed 18 Oct 2026) |
| H2 | **Occupancy is an imperfect demand proxy.** It mixes dwell time with throughput (overnight AC looks busy) and is not comparable between AC and DC (§3). | Busy is not the same as useful. AC and DC are never ranked against each other (separate budgets), and the energy delivered is only estimated. | inferred; Weekx finds duration its weakest metric |
| H3 | **Price is missing**, though it is the strongest usage driver. | Price effects fall into the location and operator effects. | inferred |
| H4 | **Future demand is a scenario, not a forecast.** The model learns 2026 conditions; 2030 and 2035 come from one factor per Kreis (NOW demand ÷ linear supply trend, §9). | Same factor for every site in a Kreis; depends on NOW's assumptions (being updated) and on 2026 usage behaviour staying the same. 2035 is weakest. | inferred |
| H5 | **Weak where the gaps are.** Candidates lie close to training stations (median 511 m), but the optimizer looks for gaps, so its picks probably lie further out. Remote areas are least reliable (§7). | The recommendations themselves may be the least reliable predictions. A "Low confidence" flag is shown, and checking the picks' distances is a to-do (§12). | partly measured (median distance); picks untested |

## Medium

| # | Limit | Consequence |
|---|---|---|
| M1 | **Supply is endogenous; no causal reading.** Operators build where they expect demand. | Competition effects are associations, and extreme counterfactuals are unreliable. |
| M2 | **Cannibalization is not modelled.** Nearby competition enters as features, but not the usage a new site takes from existing stations, including the CPO's own. | For a CPO with stations nearby, the net gain is lower than the predicted site usage. Event study postponed (§12). |
| M3 | **Operator marginalized over the feed mix** (§4). | Candidates are scored a bit as if a big network built them. A register-based mix is postponed (§12). |
| M4 | **No seasonal correction** (§3). Stations enter the feed in different months (mostly Apr–Jun). AC occupancy in the Jun–Sep panel: 13.9 / 13.6 / 12.8 / 15.0%. | Stations seen mainly in summer look slightly worse. Daily normalization is postponed (§12). |
| M5 | **AC/DC choice is an oversimple rule, not learned and not validated** (§6). Three spot types decide DC; everything else is AC. | The DC budget only picks motorway, primary-road and supermarket spots; DC hubs in town centres are never found. Primary roads through towns may turn many urban sites into DC. With a DC-only input (`user_input.md`) the rule decides the whole result. Fix: score every spot as both (§12). |
| M6 | **Optimizer simplifications** (§9). | Greedy by point-hours is not usage per euro. The spacing rule is a hard, judged cutoff. Cost values are not researched yet. Congestion at existing stations doesn't raise nearby candidates (saturation is not an input). |
| M7 | **Sizing is approximate** (§5). | **(a)** It assumes demand doesn't grow with more points, and demand at already-full sites is hidden (drivers who left are not seen), so it tends to under-size. **(b)** "Full" means a whole hour with every point busy. Shorter peaks (e.g. full for 40 min) don't count, so how often drivers find a site full is undercounted. Finer resolution is possible: the raw history has 10–20 min status data (weekly parquet, ~44 GB), so "share of time full" could be measured directly (§12). **(c)** A full hour is rarer for large sites (all 8–12 points busy) and for DC (short sessions), so the measure is cautious there. **(d)** The targets (75th percentile of today's stations) and the caps are judgement; the 90% vs 100% check changed almost nothing, but the percentile itself was not varied yet. **(e)** Lookup cells for large DC sites are sparse, and 2030/2035 occupancies fall outside the observed bins (capped). **(f)** The relation is observed, not causal. |
| M8 | **The new-site test is not a forecast test** (§8). | Short histories and ramp-up; new sites come from larger networks and are more often HPC; it covers months, not years; it checks agreement with operators' choices, not true demand. |

## Low

- **DC is sparse:** about 1,100 sites, about 310 in the new-site test. DC metrics are noisy.
- **Feature resolution:** the EV share has no information below 5 km; income is the full-time wage, not household income; no traffic volumes (DTV cut).
- **Opening dates:** 12% are rounded to the 1st of a month, some are batch registrations, and recent months are incomplete.
- **Raw-scale target:** high-occupancy sites dominate the tree splits (§3).
- **Mild censoring** of the mean target (5.4% of AC days above 50%). No Tobit.
- **Judgement thresholds:** operator groups (0.5 / 15 / 50 km), 2 km CV blocks, the 50 m site merge.
- **The supply-gap baseline's 0.9 rate** was calibrated on all stations, test sites included. This slightly favours the baseline, so the comparison is conservative.
- **The register itself misses some public points:** normal points from before 2016/17, points up to 3.7 kW, and notifications still being processed (BNetzA statements, not measured).

## Feed coverage detail (H1)

- **Method:** register (18,863 BW stations, 1 Sep 2026) vs feed snapshot (6,031 stations, 18 Oct 2026); matched within 50 m. 51% overall (57% within 100 m, 69% within 250 m); the v1 record's own matching gives 47%. This is a lower bound, since it is a one-day snapshot.
- **Small operators:** 8.5% of register stations but 0.6% of feed stations. The register has 1,861 operators; the feed has 152.
- **Municipal, 0–8%:** SWU, Sindelfingen, Schwäbisch Gmünd, Weinstadt, Mühlacker, Oberkirch.
- **Cause (inferred):** the AFIR real-time data duty (since 14 Apr 2025) doesn't reach the feed for these operators.
- **Untested:** whether rural and small-town points are underrepresented, and which operators and regions the ≥ 14 valid-days filter drops (8,189 → 5,069).

## To do

- Say in the presentation: "observed usage covers about half of register stations, favouring large operators and fast charging".
- Redo the coverage check with full-year coordinates (weekly parquet files) and report it per Kreis.
- Report validation metrics by operator group and size class.
- Extend the "Low confidence" warning to candidates near operator types absent from the feed.
- Check the untested coverage items.
- Check the optimizer picks' distance to the nearest station (H5).
- Check the AC/DC rule against existing stations (M5): share of today's DC sites that sit on rule spots, and their occupancy on vs off rule spots.
