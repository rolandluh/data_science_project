# Analysis Q&A

Running record of our design discussion on the analysis plan (demand estimation + recommendation optimization). Written 22 Nov 2026. Status: **discussion, no code yet.**

Abbreviations: CPO = charge point operator, CS = charging station, AC = slow (< 50 kW), DC = fast (≥ 50 kW), Weekx = Weekx et al. (2025).

---

## Agreed / leaning so far

- Demand model: a **top-20% classifier (Weekx replication)** plus a **continuous model** on occupancy, compared head to head.
	- Continuous model preferred if performance comparable or better.
- Training unit: a charging **site** (stations merged within **50 m**, single linkage; ~4,500 sites), not a day, not a grid cell, not a Kreis.
- **AC/DC: one pooled model** (power class as a feature). Separate models moved to Future additions (Round 6). Context-dependent AC/DC recommendation is wanted.
- **AC/DC choice v1: a simple context rule** (dwell-time rule, Q3.4). Contested-zone estimation goes to Future additions.
- Optimization: one mode first (usage maximization), accessibility and hybrid modes later if time allows.
- **Target:** mean occupancy only (Round 5: peak model dropped; peak and saturation go into the optimizer). Energy is a post-prediction conversion.
- **Operator** is a control (feature), marginalized when scoring.
- **Features v1:** Zensus demographics (to download), income (have), competition, site type and road context from OSM, transit / P+R.
- Validation: spatial block CV (grid blocks, size matched to prediction distances), new-site test (sites opened 2025–26), comparison with the existing supply-gap score. Forward test and StandortTOOL comparison cut for time (Round 6).

Open: how AC and DC scores are compared on one scale (only needed for Future additions), exact block size (to be fixed by the distance-matching check on sites).

### Decisions from Round 4 (22 Nov 2026)

- **AC/DC rule v1 (simplified, confirmed):** candidate at a motorway (services, rest area, junction), on a primary road, or at a supermarket/discounter → **DC**; everything else → **AC**. No exact kW in v1 (later version). Tie-breakers for supermarkets: low apartment share nearby **and** an existing DC within X km → AC instead. Risk to watch: primary roads run through towns, so many urban sites become DC; if that happens, restrict to primary roads outside built-up areas.
- **Site unit:** 50 m **radius** (single linkage between station points). Rectangles would depend on arbitrary grid alignment; the 50 m only joins point stations, parking polygons matter only for candidates.
- **Combined new-site + later-months test (confirmed):** cut at **1 Jul 2026**. Train = sites opened before 2025 with ≥ 14 valid days before the cut (2,677 stations, 525 DC); test = sites opened 2025–26 with ≥ 14 valid days after the cut (658, 312 DC). A June cut leaves only 699 training stations, because most stations enter the feed in Apr–Jun.
- **Feed bias / weighting:** selection is mostly by **operator**, much less by location. Diagnostic: 47% of register rows have a usable feed station within 50 m; DC 63% vs AC 43%; big networks 82–93%, "other" operators 36%, some (Bosch, Deer, Team-Emobility) ≈ 0%; residents within 1.5 km SMD +0.19; in-feed classifier AUC 0.77 with operator, 0.68 without; implied weights moderate (99th percentile 7.8, effective sample 64%). **Decision: no inverse-probability weights.** Reasoning: (1) the selection runs mainly through operator, which is a model feature and is marginalized when scoring; (2) AC and DC are handled separately, which absorbs the DC over-representation; (3) location differences are small (SMD +0.19), so weights would mostly correct operator mix, which we already control; (4) weights cost precision (effective sample 64%) and can be unstable. A weighted run remains an optional sensitivity check (Future additions).
- **Time information kept:** **station age is a model feature** (site age in days at the middle of its observation window; candidates scored at a fixed mature age, e.g. 1 year); window normalization cut for time (Round 6), documented as a limitation. Daily-profile features are **not** model features (they come from the target and do not exist for candidates); used only for interpretation and archetypes.
- **Peak/saturation in the optimizer (decision):** peak-related information is integrated into the optimization planning, not only into demand modelling. Saturation = share of valid days with a fully occupied hour per existing site (available now in the daily file) feeds the optimizer as unmet demand near overused stations, and the "overused stations" map view. Not a replacement for the demand target.
- **Default CV block: 2 km grid squares**, 5 folds, random block assignment; Kreis leave-one-out postponed (Round 6); still re-checked by distance matching on sites.
- **Buffers:** destinations 500 m; residents and demographics 1 km; competition 0.5 / 1 / 5 km; EV share = 5 km buffer (equals the source resolution; smaller buffers return the same value). **Roads and traffic:** distances instead of buffers: distance to nearest motorway junction / services and to nearest motorway, trunk and primary segment; major-road length within 1 km (DTV interpolation cut for time, Round 6). Rationale: through traffic is a line, and drivers leave it only for a short detour (assumption, verify).

---

## Practical To-Dos

Downloads and pipeline work needed before modelling. Each new output follows the `pipeline-step` skill.

**Downloads**
- [ ] Zensus 2022 grid (`https://www.destatis.de/static/DE/zensus/gitterdaten/<name>.zip`): `Durchschnittsalter_in_Gitterzellen`, `Eigentuemerquote_in_Gitterzellen`, `Durchschnittliche_Haushaltsgroesse_in_Gitterzellen`, `Anteil_ab_65-jaehrige_in_Gitterzellen`, `Anteil_unter_18-jaehrige_in_Gitterzellen`, `Durchschnittliche_Wohnflaeche_je_Bewohner_in_Gitterzellen`; optional `Durchschnittliche_Nettokaltmiete_und_Anzahl_der_Wohnungen` (income proxy). Check resolution (100 m / 1 km) per file.
- [ ] `Wohnungen_nach_Gebaeudetyp_Groesse.zip` is downloaded by `save_demand_gap_grid()` but missing on this machine; rerun.
- [ ] Hourly status from the weekly parquet (~44 GB) only if archetypes are built (Future additions).

**OSM re-extracts (Geofabrik PBF is already local; only new extracts needed)**
- [ ] Local roads: secondary, tertiary, residential (current file has only motorway, trunk, primary).
- [ ] Fuel stations, fast food and restaurants along roads (DC context).
- [ ] Railway stations and `park_ride=yes` parking (P+R).
- [ ] Leisure and tourism POIs (sports, attractions, hotels).
- [ ] Discounter tagging: confirm discounters (Aldi, Lidl etc.) are in `shop=supermarket` (brand tag).
- [ ] Built-up area (`landuse=residential` or place boundaries), for the "primary road outside town" rule.

**Integration**
- [ ] Match feed stations to register rows within 50 m (opening date = earliest date at the site; flag batch-registered and company or dealer sites).
- [ ] Merge stations into 50 m sites; split mixed sites into AC and DC parts.
- [ ] Parking-feature check: count how many training sites match a spot in the combined parking layer within 50 m. Candidates are all parking spots, so if few training sites match, the model learns from a "no match" value that candidates never have. If the share is low, drop the parking features (parking type, fee, access) or derive them the same way for sites and candidates. Parking capacity is only 36% filled.
- [ ] Site target table: mean occupancy, peak occupancy (point-count-normalized), saturation share, valid days, station age.
- [ ] Feature table builder (`src/prepare.py`): buffers and distances above, competition, operator group, for sites **and** candidates and 500 m cells.
- [ ] Split definitions in one config: grid blocks (2 km default, re-checked by distance matching on sites), combined new-site test (1 Jul cut); 5 repeated partitions.
- [ ] Feed versus register diagnostic as an automated report in `src/validate.py`.

**Costs and value assumptions**
- [ ] Research a list of costs, with sources: hardware and installation per AC point (11 / 22 kW) and per DC point (50 / 150 kW / HPC), grid connection, civil works, annual operation and maintenance; available subsidies.
- [ ] Value assumptions: average delivered kW per power class, selling price and energy cost per kWh (margin), lifetime and discount rate. All in one parameter file, each marked as sourced or assumed.

---

# Round 1: first thoughts on demand estimation

**Q1.1 Is it a classifier problem, since we only have occupancy?**
Not forced. Occupancy is continuous and we have ~5,000 stations (3,909 AC, 1,160 DC) versus 120–390 in Brussels. Classification is a design choice for robustness. The real limits are noisy signal, selection bias, endogeneity and censoring. Our own check reached only R² ≈ 0.07 with simple features.

**Q1.2 Can we predict number of stations and kW?**
- Number of points: not learned. Point count is endogenous (operators build more where they expect demand). Use a transparent sizing rule on top of predicted demand (point-hours ÷ target utilization, or peak-hour occupancy below a threshold).
- Power: `max_power` is known and DC use is unrelated to residents (|ρ| < 0.08 in the sensitivity check), so AC and DC behave differently.
- Energy (kWh): not observed. Only a crude proxy is possible.

**Q1.3 Is optimization needed, or just top-k?**
Yes. Top-k fails because the best candidates sit next to each other and share the same demand. A maximum-coverage / facility-location MILP (HiGHS or OR-Tools) with at most k sites handles a few thousand candidates per Kreis or radius.

**Q1.4 How do we differ from Weekx?**
(1) Spatial leakage risk, so spatial CV. (2) Only 9 months of data, so no year-to-year test. (3) Competition matters. (4) Operator, price and visibility are unobserved and the feed covers about a third of stations. (5) Coverage must be part of the optimization. (6) Metric choice matters more than spatial level. (7) Different feature set. (8) Row = site, not station-day.

---

# Round 2

## 1. Ranking model, continuous model, and which one to use

**Q2.1 What is a ranking model?**
A model trained so that the *order* of stations is right, not their values. In practice: learning-to-rank algorithms (LightGBM `lambdarank`, XGBoost `rank:pairwise`) that learn from pairs of stations within a group (e.g. within a Kreis) which one is higher. They are evaluated with rank metrics (NDCG@k, precision@k, Spearman).

For us this is more than we need. My earlier "regression or ranking" was loose. A regression on log-occupancy, **evaluated by rank metrics**, gives the same benefit and also gives magnitudes. I would skip formal learning-to-rank. Dropped from the plan.

**Q2.2 Don't Weekx argue against continuous models?**
Partly, and mostly on grounds that apply to their situation:
1. Earlier continuous models had low R² (10–61%). This is evidence, but the cited studies had other features and data.
2. Small training sets (100–390 stations) versus 18 predictors. We have roughly 10× more stations, although effective independent sites are fewer.
3. Demand shifts upward each year as the EV fleet grows, so absolute values drift. We have a single 9-month window, so this matters for later retraining, not for the first fit.
4. Planners need to discriminate between areas, not predict exact values. This still holds for us.

They never ran a head-to-head regression comparison. So their argument is a reason for caution, not proof. Reasons 2 and 3 are weaker for us; 1 and 4 still apply.

**Q2.3 Which is theoretically better for our data limits and for the optimizer?**
| Criterion | Classifier (top 20%) | Regression on log or logit occupancy |
| --- | --- | --- |
| Target noise & outliers | Ignores extreme values far from the cut, but label flips near the 20% threshold add noise | Log/logit helps scale, yet heavy-tailed residuals or small-sample noise near bounds still affect fit |
| Censoring & selection bias | Top-20% cutoff can saturate if ties or capped stations cluster near the top; does not fix selection bias | Capping/flooring distorts predictions unless modeled explicitly (e.g., Tobit/censored likelihood); selection bias remains |
| Information used | Discards variation within the top 20% and bottom 80% | Preserves continuous variation across the full range |
| Optimizer fit | Outputs top-20% membership score/probability, not a direct usage magnitude | Produces a continuous magnitude usable as a weight in objectives like maximizing covered demand |
| Literature / framing | Check exact reference ("Weekx" may be a typo or specific study) | Often requires calibration or back-transformation debiasing to match observed totals |

Opinion (a refinement of my earlier "classifier headline"): the **classifier is the benchmark and the sanity check** ("does the model separate good from bad sites at all?"). The **regressor is what feeds the optimizer**, unless it clearly loses the comparison below. The optimizer needs magnitudes, and only a regressor delivers them.

**Q2.4 How do we compare and decide?**
Same data, same spatial folds, same features, for both models.
1. **Ranking quality, common scale:** turn the regressor's prediction into a top-20% score and compute AUC next to the classifier's AUC. Also Spearman of both scores against true occupancy.
2. **Decision-relevant metric:** pick the top-k sites in each held-out fold by each model and compare the *realized* occupancy of the picks (lift@k, precision@k, regret versus the best possible k).
3. **Calibration (regressor only):** predicted versus actual by decile, since the optimizer uses magnitudes.
4. **Stability:** repeat with several different block partitions (like Weekx's 50 repeats) and compare paired differences per repeat.
5. **Decision rule:** if the regressor's AUC is within ~0.01–0.02 of the classifier and calibration is acceptable, use the regressor. Otherwise use the classifier probability as a relative weight and say so.
6. Baseline for both: the current supply-gap score (EV index ÷ charge points). If ML does not beat it on held-out stations, we say so.

## 2. AC / DC

**Q2.5 Do separate AC and DC models cause problems?**
- **Sparsity:** DC has ~1,160 stations, fewer after merging into sites and the ≥14-valid-days filter. With 15–25 features and spatial CV folds of ~200 sites, estimates get noisy. Shallow trees and regularization are required.
- **Heterogeneity inside DC:** 50 kW town chargers and 150+ kW motorway hubs are different products.
- **Mixed sites:** many sites have AC and DC. The feed gives point counts per station, so how a mixed station is split must be checked. Rule needed (e.g. DC if max power ≥ 50 kW).
- **Selection bias is stronger for DC:** operators place DC almost only on proven spots (motorway, retail), so there are few low-demand DC examples.
- **Different scales:** a DC session is minutes, an AC session is hours. Occupancy of 20% means different things. So the AC and DC scores cannot be compared directly (see Q2.6).
- **Alternative:** one pooled model with power class as a feature, plus interactions. Compare pooled versus separate by spatial CV and keep the winner. I'd test both. Tree models can share strength across groups when pooled.

**Q2.6 Is the AC/DC distinction strict? Is a context rule enough?**
Not strict.
- **Motorway and rest areas:** DC is nearly always right. A 20-minute stop does not fit AC. The EU AFIR regulation also requires fast chargers at regular spacing on core roads (check exact figures before citing).
- **Residential, workplace, overnight, local roads:** AC.
- **Contested zone:** supermarkets, retail, urban arterial roads, town centres. Here DC is increasingly used by people without home charging, and AC works for long dwell. This is where the model must decide.
- A context rule alone is a good first version (and it is what StandortTOOL effectively does with its two demand types). A rule plus model is better: define three zones (**DC-only**, **AC-only**, **contested**) from road class, POI type and density. In contested sites score both types.
- The hard part is comparing the AC score with the DC score. Occupancy cannot be compared across types. Needs a common unit: expected kWh (or revenue) per cost, which needs cost data we do not have yet. So: model AC and DC separately, put them on one scale **after** prediction through documented assumptions (see Q2.14).
- Finer power classes (AC / 50–149 kW / HPC ≥ 150 kW) would be nicer but make sparsity worse. Not for v1.

## 3. Validation

**Q2.7 What is spatial block CV?**
Normal k-fold CV puts random stations in test and train. Neighbouring stations share the same population cells, traffic and area demand, so the test set is almost a copy of the training set. Scores look better than they are. Our real use case is the opposite: predicting for places away from existing stations.

Spatial block CV assigns **whole regions** to folds. Train on k−1 regions, test on the held-out region, repeat.
- **Blocks:** Kreise (44) via `GroupKFold`, or grid squares or k-means clusters on coordinates, with blocks larger than the distance over which residuals are correlated (estimate with a variogram of residuals; likely 10–25 km).
- **Optional buffer:** drop training sites within distance d of the test block's edge.
- **Balance:** a block with Stuttgart holds a large share of stations. Use more folds than blocks per fold, balance station counts, and also report "leave one big city out".
- **Tuning:** hyperparameters are chosen **inside** the training folds (nested CV), never on the test block.
- **Cost:** scores are lower and more variable. That is honest. We report them as the main result and, if useful, random CV beside it to show the gap.

**Q2.8 Why is "test on stations commissioned in 2025–26" the most convincing, and what are its limits?**

*Argument for.* It simulates the real use: predicting demand at sites that did not have a station before. Features and supply are computed as of before the commissioning (so no hindsight). It ties directly to the promise in the project outline ("compare with real new installations"), and a supervisor understands it at once. It also tests extrapolation into areas the model did not train on, because new stations are often built in newly covered areas.

*Limits.*
1. **Sample size:** unknown. We must count how many stations commissioned in 2025–26 have ≥14 valid days in the feed. Could be a few hundred of ~5,000, with few DC.
2. **Ramp-up:** new stations fill gradually, so their occupancy is biased low in the first months. Need to control for station age or compare at equal age.
3. **Not random:** new stations come from larger networks and specific technologies (more HPC). It is a shifted distribution. A bad score can mean the model is bad or the new stations are different.
4. **No temporal test:** all occupancy comes from the same 2026 window. This tests new sites, **not** robustness over time (Weekx's second contribution).
5. **Operators' choices:** these sites were selected by operators using their own information. Agreeing with them shows our model matches operator judgement, not that it captures true demand (also the coverage point from Weekx: demand in unserved areas is never observed).
	1. **Implicit assumption:** Operators judge demand well.
6. **Data quality of `Inbetriebnahmedatum`:** may be missing, revised or wrong. Check against first-seen date in the feed.
7. **Leakage (small):** training stations' 2026 occupancy is already affected by the new stations nearby (shared demand).

So: best *pseudo-prospective* test, but not a replacement. It complements spatial block CV (which has more data). Better than either alone: a **true temporal test**. The feed keeps arriving. Train on Feb–Oct, then predict occupancy for Nov–Jan before the final submission (22 Jan). That is a real forward holdout, and it also demonstrates the automation requirement.

## 4. Competition, operator, coverage

**Q2.9 Competition: estimation or optimization?**
Both, because they do different jobs.
- **Estimation = marginal value of one new station given today's supply.** Observed occupancy is already net of neighbours: demand is shared. Training on it without competition features mixes gross demand with sharing and misreads dense areas. So add competition features: points and kW within 0.4 / 1.5 / 5 km, distance to the nearest station and nearest DC.
- **Optimization = joint value of a set.** The model trained on existing stations cannot see that five chosen sites in one neighbourhood split the same demand. Without handling this the optimizer picks five close sites, each with a high marginal score, and counts the same demand five times. The optimizer must therefore allocate demand (covered cell counts once) or penalize close pairs.

My recommendation: competition in the estimation features, and a coverage-style objective (each demand cell counted once, existing supply considered) in the optimizer. Caveat: competition features are endogenous (stations are built where demand is), so coefficients are not causal. They are fine for prediction within the range of observed supply, less so for extreme counterfactuals.

**Q2.10 Why use operator as a control?**
Occupancy depends on things that go with the operator: price, app and RFID access, roaming, reliability, brand visibility, closed networks (e.g. Tesla), typical site types. If operator is left out and correlates with location features (large networks sit in dense areas), the model gives the operator's effect to the location features. That is omitted-variable bias, and it would mis-rank locations.

Practicalities:
- Group operators: top ~8 networks plus "other".
- When scoring a candidate: average predictions over the operator mix (marginalize), or let the user choose their own operator (as with a CPO user like Lena). This could even be a feature of the app.
- Weighting: the feed covers about a third of stations and favours large networks. Compare operator × region × power in the feed versus the register and consider inverse-probability weights.
- Warning: a flexible model can use operator as a spatial proxy (a network that only exists in one region). Spatial CV shows if the score collapses.
- Price would be the better control. We do not have it.

**Q2.11 Is pure profit maximization separate from coverage? Do we need 3 modes?**
- **Profit is not independent of coverage.** A site's revenue is the demand it captures, which depends on how much demand lies in its catchment. A demand-weighted max-coverage objective *is* a profit proxy. Competition makes it spread out: once an area is served, extra stations add little, so a profit maximizer moves on.
- **Where they differ:** profit ignores low-demand places (rural areas, small towns). They get almost no stations, and that is exactly the gap Weekx found (user requests far from stations). Accessibility optimization covers those anyway (e.g. maximize population within X km of a charger, or minimum coverage per municipality).
- **One model, three settings.** The three modes are the same optimizer with different weights: w = predicted demand (usage mode), w = population or EV owners (accessibility mode), w = λ·demand + (1−λ)·population (hybrid). Hybrid is a slider, not a separate mode. Accessibility mode usually also needs constraints (minimum per municipality).
- **We have no revenue or cost data**, so "profit" is really "usage maximization" (as in the presentation note: profit → usage → demand).
- **Your plan is sensible:** build one mode first (usage-maximizing, CPO as primary user, municipalities secondary). Design the objective weights as a parameter and keep the coverage matrix (candidate × cell) explicit, so accessibility and hybrid mode are cheap additions later.

## 5. Features

**Q2.12 Can we get the missing features? What else could matter?**

*Research results (verified with searches; I could not open the files, so details are unconfirmed).*
- **Zensus 2022 grid:** Destatis publishes 100 m grid tables for population/demographics, households, families, dwellings and buildings. Its dataset list also names "Durchschnittsalter in Gitterzellen", "Eigentümerquote in Gitterzellen" and "Durchschnittliche Haushaltsgröße in Gitterzellen" ([dataset description for dwellings and buildings](https://www.zensus2022.de/static/DE/gitterzellen/Datensatzbeschreibung_Wohnungen_und_Gebaeude_im_100_Meter-Gitter.xlsx), [Destatis Zensus 2022 publications](https://www.destatis.de/DE/Themen/Gesellschaft-Umwelt/Bevoelkerung/Zensus2022/_publikationen.html)). Unconfirmed: whether each is at 100 m or only 1 km, and the exact definitions. We already download Zensus grid data, so adding age, tenure and household size is cheap. **Best next step.**
- **Education:** not found at grid level. Likely only at municipal level in the Zensus database (unverified).
- **Commuters:** the BA [Pendleratlas](https://statistik.arbeitsagentur.de/DE/Navigation/Statistiken/Interaktive-Statistiken/Pendleratlas/Pendleratlas-Nav.html) shows in- and out-commuters per municipality. I did not find a bulk download. Our income data already contains employees by **residence**, which is not the same as jobs at the **workplace**. OSM office and industrial POIs (already in the pipeline) are the free workplace proxy.
- **Tourism:** the state statistics office publishes overnight stays mostly as PDF reports by municipality group and travel region ([example thematic map](https://www.statistik-bw.de/Service/Veroeff/Thematische_Karten/44KM2301A.pdf)). No municipal bulk download found. Free proxy: OSM hotels and attractions.
- **Company cars:** a KBA municipal table exists, but I could not confirm a private/commercial split. Low priority.

*Features we have not considered (from experience; not researched online).*
1. **Station attributes from the register:** number of points, max power, connector types, station age, operator group. Check the 47 columns for opening hours and payment fields.
2. **Site type:** supermarket lot, street, hotel, train station, park-and-ride (MobiData parking has P+R). Commuter and park-and-ride sites drive AC use.
3. **Centrality:** distance to the town centre and population within 5 / 10 / 20 km (gravity-style), settlement size class.
4. **Road context for DC:** road class, speed limit, distance to motorway exit, nearest traffic count (needs interpolation; counts are sparse).
5. **Competition:** see Q2.9.
6. **Price:** the biggest missing driver. No open dataset found (not researched in depth). State it as a limitation.
7. Low priority: altitude, weather, substations (supply side, not demand).

Priority for v1: Zensus extras → competition → site type and road context → transit/P+R. Commuters and tourism later.

## 6. Unit of analysis

**Q2.13 How high or low do we aggregate?**
- **Row = site.** Merge stations within 50 m (same parking area, see Q3.14) into one site. About 5,069 stations become ~4,500 sites (computed in Round 3, Q3.14; my earlier guess of 3,500 was wrong). This avoids near-duplicate rows landing in both train and test.
- **Target** is aggregated over all valid days per site (≥14 valid days, optionally weighted by √valid days). Not daily rows: they would inflate sample size without adding independent information. Weekday/hour profiles can be an optional extension (site archetypes).
- **Features** in buffers around the site (e.g. 0.4, 1.5, 5 km), computed from the 500 m grid and OSM, like Weekx's buffer level.
- **Why not coarser:** Kreis level leaves 44 rows and the optimizer needs candidate sites. Weekx found accuracy barely changes across spatial levels, so finer is not penalized.
- **Scoring:** apply the model to every candidate parking site (features from its buffer), and also to 500 m cell centres for the demand map and the coverage layer.

## 7. Target variable: argued for and against

**Q2.14 Mean occupancy, peak-hour occupancy, kW-weighted energy proxy?**

### A. Mean occupancy (per point, time-weighted over valid days)
*For:*
- Directly measured and robust. Time-weighting already handles the polling change on 14 Aug.
- Clear unit: share of point-time in use. Links to sizing (point-hours).
- Already used in the home-charging-rate calibration, so the project is consistent.
- Weekx's closest analogue ("duration") is predictable above chance.

*Against:*
- ==🟡Mixes dwell time and throughput. One car plugged in overnight on AC gives 100% occupancy but little energy. A DC point with 30-minute sessions at 30% occupancy delivers more kWh.==
- "Occupied" includes cars parked after charging is done.
- Weekx's weakest metric (AUC 56–72%).
- Saturates near 100% (censored demand), and depends on the number of points. Must be per point.
- Not comparable between AC and DC.

### B. Peak-hour occupancy
*For:*
- Measures congestion and unmet demand, the thing a planner worries about. Weekx link high utilization to failed connection attempts.
- Directly useful for sizing: design for the peak, not the mean.
- Identifies places where adding points helps.

*Against:*
- An extreme-value statistic: noisy. A 2-point station jumps between 0 / 50 / 100%, so the distribution is lumpy and depends heavily on point count.
- Saturates at 100%, so it cannot rank the busiest stations.
- Sensitive to data issues (stuck "charging" status, outages, hours with little data).
- Says nothing about revenue.
- Fix if used: use the 90th percentile of hourly occupancy over valid days instead of a max, with a minimum data requirement per hour.

### C. kW-weighted energy proxy (occupancy × points × assumed average kW)
*For:*
- Closest to the CPO business model (revenue follows kWh), the primary user in our presentation.
- Puts AC and DC on one scale, which is needed for the type recommendation.
- Weekx note energy is what attracts CPOs.

*Against:*
- **Not observed.** The average draw is unknown: cars limit AC to 11 kW, DC output tapers. The assumed factor *is* the signal.
- It is mostly a known number (installed kW) multiplied by occupancy, so the model would largely learn installed power. R² would look good for trivial reasons, a spurious accuracy claim an examiner could call out.
- Cannot be validated.

### Opinion
1. **ML target: mean occupancy per point**, on a log or logit scale, as the primary one. It is the best measured and best-defined signal, and the one we can validate.
2. **Peak (p90 hourly) occupancy** is a second target if time allows. It is cheap with the same pipeline and drives the sizing rule. Treat it as a secondary model, not a replacement.
3. **Energy is not a model target.** Apply it **after** prediction as an explicit, documented conversion (occupancy × points × assumed average kW per power class, with the assumptions shown to the user). This keeps the model evaluation clean, gives the CPO view and the AC/DC comparison, and the assumption is visible and adjustable rather than hidden.
4. `session_starts` is not used as a target: it is a lower bound and depends on polling (10 → 20 min on 14 Aug). Possible robustness check using pre-switch weeks only.

---

# Round 3

Numbers in this round come from checks on `data/processed/` run on 22 Nov 2026 (scratch scripts, not in the repo). "Usable stations" = feed stations with coordinates in `historie_bw.geojson` and ≥ 14 valid days: **5,069 (3,909 AC, 1,160 DC)**.

## 1. Censoring

**Q3.1 What is the censoring issue, and does our concept need to address it?**
Censoring means we see a capped version of the true value. A station with 2 points can be at most 100% occupied. If a third driver arrives while both are busy, they leave and we never see them. So observed occupancy = min(demand, capacity), and at busy stations true demand is **higher than what we observe**. The cap is hit more often by small stations (fewer points fill up faster).

How big is it in our data (valid station-days):

| | AC | DC |
|---|---|---|
| Days with at least one hour 100% full | 20.5% | 4.3% |
| Days with mean occupancy > 50% | 5.4% | 0.9% |
| Station median of mean occupancy | 11.1% | 9.5% |

AC stations with 1 point have a full hour on 46% of days, with 5+ points on 2%.

What this means:
- **Mean occupancy:** mild censoring. Few days come close to the cap. No special treatment in v1. Document it.
- **Peak occupancy:** heavy censoring, and it depends on point count (a 1-point station is "100% full" whenever one car charges). Needs care (Q3.17): normalize for point count and treat the top as "at least".
- **Turn the problem into a signal:** the share of hours a site is fully occupied directly measures unmet demand. Saturated existing stations mean demand nearby that a new station could take. This is useful for the optimizer and for the "overused stations" view Lena wants. A daily version (share of valid days with a fully occupied hour) is already in `auslastung_taeglich_bw.parquet`; hourly detail needs the weekly parquet files.
- Formal censored regression (Tobit) is not needed for tree models. Not in v1.

## 2. Pooled model and AC/DC rules

**Q3.2 What is the output of the pooled model? Is power a useful feature? Why interactions?**
- **Output:** one model, one prediction: expected occupancy of a site *given its configuration*. Power class (or kW) is an input. To score a candidate as AC and as DC, run it twice with different power inputs.
- **Power is useful** because it separates usage patterns: DC sessions are short and driven by traffic, AC sessions long and driven by residents and destinations. Within DC, 50 kW and 150+ kW differ (HPC attracts through traffic). Within AC, 11 vs 22 kW differs little (many cars charge at max 11 kW on AC). Caveat: power is chosen by operators where they expect demand (endogenous), so its effect is not causal.
- **Interactions** are needed because drivers act differently by type: residents matter for AC and hardly for DC (|ρ| < 0.08 in our sensitivity check); motorway distance matters for DC and hardly for AC. A linear model needs these as explicit terms (residents × AC). **Tree models (RF, gradient boosting) learn interactions on their own** by splitting on type first, so nothing extra is needed there. Pooling then shares information where effects are common (e.g. POIs) and splits where they differ.

**Q3.3 Contested-zone estimation: later.**
Agreed and moved to Future additions. One nuance: contested-zone estimation works with either the pooled or the separate models. The pooled model makes it easier (vary the power input), but both still need a common scale (energy or revenue per cost) to compare AC and DC predictions.

**Q3.4 What should the simple context rule look like?**
Idea: **choose power from expected dwell time**. StandortTOOL splits demand into en-route (motorway nodes, fast charging) and opportunity charging (destinations, by location type). We generalize that: every site type has a typical parking time, and the right power is the one that delivers a useful top-up in that time.

Rule: required power ≈ target energy ÷ dwell time. Target energy is a parameter (e.g. 25 kWh, a typical top-up; assumption, to verify).

| Site context (from OSM / register) | Typical dwell (assumption) | kW needed for 25 kWh | Recommendation |
|---|---|---|---|
| Motorway services, rest area, ≤ 1 km from motorway junction | 20–30 min | 50–75 | **DC, HPC (≥ 150 kW)** |
| Fuel station, fast food on trunk / primary roads | 20–30 min | 50–75 | **DC (50–150 kW)** |
| Supermarket, discounter | 30–45 min | 33–50 | **DC (50 kW)** if no DC within X km, else AC 22 kW |
| Retail park, shopping centre, DIY store | 1–2 h | 12–25 | **AC 22 kW** |
| Hospital, leisure, sports, tourism | 1–3 h | 8–25 | **AC 22 kW** |
| University, office, industrial (workplace) | 4–8 h | 3–6 | **AC 11 kW** |
| Park-and-ride, station parking | 8–10 h | ~3 | **AC 11 kW** |
| Residential street / car park (overnight) | 10+ h | ~2 | **AC 11 kW** |

Two tie-breakers for the contested rows (supermarket, urban retail):
1. **Home-charging gap:** high apartment share nearby (many people without a wallbox) → DC. These drivers top up quickly while shopping instead of overnight.
2. **Existing DC supply:** no DC within X km (e.g. 5 km local, 50–60 km on motorways) → DC; plenty of DC → AC.

Why this is good for v1: transparent (a lookup table in one config file), defensible (physics: energy = power × time), and it covers the StandortTOOL split. All dwell times, the target energy and X are parameters, listed with their source or marked as assumptions.

**Q3.5 Do we need StandortTOOL's two demand types explicitly or implicitly?**
- ==🟡**Estimation: implicitly.** We have no trip simulation, so we can't build an en-route demand surface the way they do. Our features (road class, distance to junction, traffic, residents, POIs) plus the AC/DC type let the model pick up both patterns.==
- **Optimization: explicitly.** The two types need different geometry:
  - Candidate generation: motorway services and junctions are candidates even without a mapped car park.
  - Coverage: AC demand is covered within a walking radius of demand cells. DC demand along roads is covered by spacing (distance along the road to the next fast charger, similar to the AFIR spacing idea).

## 3. Spatial block CV

**Q3.6 Which spatial blocks? Grids, Kreise or something else?**
**Grids. But the reason is not that they are "more random".** Randomness is not the goal. The goal is that the test set is as far from the training data as real prediction sites will be. Too close and the score is too optimistic (random CV). Too far and it is too pessimistic (very large blocks, Kreise).

So we choose the block size by measuring how far real prediction sites are from training stations, and match that in CV. This is the idea behind "nearest-neighbour distance matching" CV (Milà et al. 2022, Linnenbrink et al. 2024; general knowledge, not in `literature/`, verify).

Result of the check:

| | Distance from a prediction point to the nearest training station (median / 90th percentile) | Mismatch with real prediction distances (lower = better) |
|---|---|---|
| **Real use: public parking candidates (117k)** | **511 m / 2.9 km** | — |
| Random CV | 283 m / 1.8 km | 0.98 |
| Grid blocks 0.5 km | 546 m / 2.6 km | **0.29** |
| Grid blocks 1 km | 723 m / 2.8 km | 0.41 |
| Grid blocks 2 km | 1.1 km / 3.3 km | 0.73 |
| Grid blocks 5 km | 2.1 km / 4.5 km | 1.27 |
| Grid blocks 10 km | 3.4 km / 6.6 km | 1.71 |
| Leave-one-Kreis-out (44) | 6.6 km / 13.8 km | 2.47 |

Mismatch = average gap between the two distance distributions on a log scale. Run on stations, not yet on 50 m sites.

What this tells us:
- Candidates are **close to existing stations** (half within ~500 m). Kreis blocks would test a much harder problem than we actually face, and random CV an easier one.
- The **recommended** sites will lie further out than the average candidate, because the optimizer prefers gaps. So the relevant distance is closer to the upper half of the candidate distribution (1–3 km).

Recommendation:
1. **Primary: square grid blocks of ~1–2 km**, randomly assigned to 5 folds. Final size is set by repeating this check on sites and on the candidates the optimizer actually picks. Grids also give balanced folds (900–1,100 stations each); Kreise range from 16 to 518 stations.
2. **Stress test: leave-one-Kreis-out.** Reported as "performance far from existing stations".
3. **Most useful output: error versus distance to the nearest training site.** It shows where predictions stay reliable. Candidates beyond that distance get a flag in the app ("outside the model's experience"), which ties in with the selection-bias point (Q3.18).
4. Tuning stays inside the training folds (nested), with the same blocking.

## 4. New-site test and temporal test

**Q3.7 How many stations were commissioned in 2025–26? How good is `Inbetriebnahmedatum`?**

Sample size:

| | Register (BW, snapshot 1 Sep 2026) | Usable feed stations, matched to register within 50 m (82% match) |
|---|---|---|
| Commissioned 2025 | 2,862 (781 DC) | 481 (208 DC) |
| Commissioned 2026 (Jan–Aug) | 1,448 (341 DC) | 177 (104 DC) |
| **2025–26 total** | 4,310 | **658 (312 DC)**; 829 if any nearby register row is new |

Valid days of these test stations: median 70 (10th percentile 19, 90th 122). Many are short histories.

Data quality of `Inbetriebnahmedatum`:
- **Good:** no missing or future dates. Only 3 implausible early dates (1992, 2001, 2008). Feed first-seen dates come after the commissioning date (median 41 days later), with no contradictions. That supports the dates.
- **Rounded dates:** 11.9% fall on the 1st of a month (~3% expected).
- **Batch registrations:** one operator, one date, many rows. Bosch 372 rows on 19 and 28 Feb 2026 at 12–15 places; Zweckverband Schwäbische Alb 259 rows on 1 Oct 2023; Audi 76 on 1 Jan 2022 (dealerships). Here the date may be the registration date, not the opening date. Some of these (company and dealer sites) may not really be public.
- **Reporting lag:** only 49 entries for Aug 2026. Recent months are incomplete.
- **Extended sites:** 14% of matched stations have register rows from different years within 50 m. Define a site's opening date as its **earliest** date. Extensions of old sites are not new sites.

Effect on our approach:
- ~650 test sites (~300 DC) is enough for AUC and Spearman with a usable confidence interval, and enough for a separate DC result.
- They must be removed from training (13% of usable stations). Acceptable.
- **Ramp-up:** median 70 valid days, and new stations fill gradually. Evaluate on occupancy after the first ~60 days, or add station age as a control, and report both.
- Flag batch-registered and company or dealer sites and run the test with and without them.

**Q3.8 What is the pseudo-prospective test? Is commissioning date better than a temporal split?**
- **Pseudo-prospective (new-site) test:** pretend it is the end of 2024. Train only on sites that existed then, with features and competition as of then. Predict how well the sites opened in 2025–26 are used. It is "pseudo" because all occupancy is observed in 2026 for both groups.
- **Temporal (forward) test:** same sites, later months. Train on Feb–Jun, test on Jul–Oct, or test on Nov–Jan once collected.

They answer different questions:

| | Question it answers | Weakness |
|---|---|---|
| New-site test | Does the model generalize to **new places**? | All in the 2026 window; short histories; ramp-up |
| Temporal test | Is the ranking **stable over time**? | Same stations in train and test, so it says nothing about new places and scores look good easily; months, not years |

On "we are predicting future demand": yes. But the decision is a station that runs 10+ years, and **neither test covers years**. What the temporal test mostly shows is whether a 9-month average is a stable target. Our core task is predicting at places that have no station, so the new-site test is more relevant.

**Best: combine them.** Train on sites existing before 2025 using early months, and test on new sites using later months. That tests new places and new time at once.

For the long-term future we rely on three things:
1. Relative targets (top 20%, Spearman), which survive fleet growth better than levels (Weekx's argument).
2. Automatic retraining as data arrives.
3. Scaling absolute levels by fleet-growth scenarios. StandortTOOL or NOW scenarios could provide future magnitudes, while our model provides the spatial pattern.

Plan: spatial block CV (main), combined new-site + later-months test, forward test on Nov–Jan (also shows the automation working).

## 5. Operator and weighting

**Q3.9 Is operator controlled for by putting it in as a feature?**
Yes. Top ~8 operator groups plus "other" as a categorical feature. When scoring a candidate:
- Default: **marginalize**. Predict the candidate once per operator in a reference mix and average. The location gets credit only for location effects.
- Option: fix the operator to the user's own (e.g. a CPO user).

Watch out: operator correlates with power and region. Check grouped feature importance and the spatial CV.

**Q3.10 Why inverse-probability weights?**
The feed is not a random sample of BW stations; it favours large networks. We train on feed stations but apply the model to all candidate places. If the feed under-represents, say, small municipal AC stations in villages, and occupancy works differently there, the model learns the big-network pattern and applies it everywhere.

Weighting fixes this **for differences we can observe**:
1. Fit a classifier for "is this register station in the feed?" using location features, power and operator group.
2. Weight each training site by 1 / P(in feed), trimmed to avoid extreme weights.

The weighted training sample then resembles the full register. It cannot fix differences in things we don't observe (price, reliability).

Priority: first a **diagnostic** (compare feed versus register distributions). Weighting only if they differ clearly. Report the model with and without weights.

## 6. Features

**Q3.11 Are the Zensus demographics already downloaded?**
**No.** We have only `Zensus2022_Bevoelkerungszahl.zip` (population) and the dwellings-by-building-type file (downloaded by `save_demand_gap_grid()`, not present on this machine). Destatis offers them in the same URL pattern (`https://www.destatis.de/static/DE/zensus/gitterdaten/<name>.zip`; the three main ones respond):
- `Durchschnittsalter_in_Gitterzellen.zip` (average age)
- `Eigentuemerquote_in_Gitterzellen.zip` (ownership rate)
- `Durchschnittliche_Haushaltsgroesse_in_Gitterzellen.zip` (household size)
- also available: `Anteil_ab_65-jaehrige_…`, `Anteil_unter_18-jaehrige_…`, `Alter_in_10er-Jahresgruppen.zip`, `Durchschnittliche_Wohnflaeche_je_Bewohner_…`, `Leerstandsquote_…`, `Gebaeude_nach_Eigentumsform_100mGitter.zip`, `Durchschnittliche_Nettokaltmiete_…` (rent, an income proxy).

Grid resolution per file not confirmed until downloaded. The population zip bundles 100 m, 1 km and 10 km. Adding them fits the existing pipeline pattern (`pipeline-step` skill).

**Q3.12 Don't we already have income?**
Yes: `einkommen_500m_bw.json` (BA median gross wage at residence, 1 km → 5 km → district fallback, plus resident employees). It is a v1 feature. Note it is wage at **residence** for full-time employees, not household income.

**Q3.13 Can site type and road context come from OSM?**
Yes, from the local Geofabrik PBF:
- **Site type:** parking tags (`parking=surface/multi-storey/underground/street_side`, `access`, `fee`, `park_ride=yes`), POIs at or next to the site (`shop`, `amenity`, `tourism`), railway stations, land use.
- **Road context:** road class, speed, lanes, motorway junctions and services (already extracted).
- **One gap:** `strassen_osm_bw.geojson` holds only motorway, trunk and primary. Local context (secondary, tertiary, residential) needs a re-extract.
- The register adds site information too: `Informationen zum Parkraum`, `Standortbezeichnung`, payment systems and opening hours (e.g. 24/7).

## 7. Unit of analysis and target

**Q3.14 Which site radius (30–70 m)?**
Single-linkage merging of usable stations (everything within r of another station joins its site):

| r | Sites | Multi-station sites (stations in them) | Mixed AC/DC sites | Sites with DC |
|---|---|---|---|---|
| 0 m (identical point) | 4,822 | 151 (398) | 10 | 1,140 |
| 30 m | 4,633 | 282 (718) | 45 | 1,120 |
| 40 m | 4,574 | 308 (803) | 54 | 1,111 |
| **50 m** | **4,519** | 348 (898) | 64 | 1,100 |
| 60 m | 4,475 | 376 (970) | 78 | 1,094 |
| 70 m | 4,441 | 384 (1,012) | 83 | 1,088 |

1,568 pairs of stations share the exact same coordinates. One car park in Konstanz has 90 feed "stations" at one point, one per charge point. Chaining (a site stretching much wider than r) is rare: at most 7 sites.

Decision: **50 m.**
- **Sample size:** irrelevant to the choice. 30 → 70 m changes the site count by only 4%.
- **Theory:** a site is a set of chargers a driver sees as one option (the same car park or street section). Supermarket and P+R car parks are typically 50–100 m across, and on-street stations 30–50 m apart are substitutes. 50 m captures that without merging separate locations across a street block.
- **Consistency:** 50 m is already used for matching register and feed in the app and in this check.
- **Leakage is not the reason:** block CV at ≥ 0.5 km keeps nearby sites in the same fold anyway, so the radius only defines the target unit.
- **Mixed sites (64):** split by type into an AC part and a DC part, which share a location and therefore a fold.
- **Site occupancy:** Σ charging point-hours ÷ Σ capacity point-hours over valid days.

**Q3.15 So the target is just total usage of a site? Doesn't that throw away the time component?**
Not a count: the target is the **average share of point-time in use** over all valid days, e.g. 0.12 = points busy 12% of the time.

And yes, it removes time from the **target**. That is deliberate:
- Our features are static (population, POIs, roads). They cannot explain why Tuesday differs from Wednesday. Daily variation is noise, or shocks common to all stations (season, weekday, holidays), from the model's point of view.
- Averaging over ~100+ days makes the target much more precise. Daily rows would multiply the sample size without adding independent information.

What is lost, and how to keep it:

| Lost | Why it matters | Keep it as |
|---|---|---|
| **Daily profile** (night vs day, weekday vs weekend) | Tells residential overnight from daytime destination use; helps AC/DC and site type | Derived **features** or a usage **archetype** per site (night share, weekend ratio). Needs hourly data |
| **Trend** (ramp-up of new sites) | Biases new-site occupancy | **Station age** control, ramp-up filter |
| **Variability** (how noisy a site is) | Sites with few days are less reliable | **Sample weights** (√valid days) |
| **Time order** | Needed to test the future | **Validation** (forward test, Q3.8) |

A panel model (site × day rows with weekday and month) predicts daily profiles. That is more than a location decision needs. Future addition.

**Q3.16 What buffer size for features? Empirical or theoretical? Different per feature?**
Both, and yes, different per feature. Theory sets the plausible range; data picks within it.

| Feature group | Theoretical range | Why |
|---|---|---|
| Destinations (POIs at the site) | 0–400 m | Walking distance from charger to destination; Weekx use 400 m as the max walking distance |
| Residents, apartments, demographics (AC) | 0.4–1.5 km | Overnight chargers walk home. Our home-charging check found 1–1.5 km best |
| Competition | 0.4 / 1.5 / 5 km | Next-door substitutes, local alternatives, the wider market |
| Road and traffic (DC) | Nearest segment, distance to junction; 5–20 km catchment | Through traffic is a line, not an area |
| EV share | Its own 5 km cell | Source resolution; smaller buffers add nothing |

Empirical part: compute 2–3 radii per group (as rings, e.g. 0–0.4 and 0.4–1.5 km, to limit correlation). Then either let the model use all of them, or pick the radius per group by CV (as in the home-charging check). Use grouped importance for interpretation, because neighbouring radii are correlated.

**Q3.17 How do we bring peak and mean occupancy into the product? Compare and pick one?**
Build both models and compare their predictive skill (same folds, Spearman, top-20% AUC, lift@k). But they answer **different questions**, so it is not a strict "pick one":

| | Mean occupancy model | Peak occupancy model |
|---|---|---|
| Question | How much will a site be used? | How crowded does it get at busy times? |
| Role in the product | **Demand weight in the optimizer** (which sites) | **Sizing** (how many points), congestion indicator for existing stations |
| User sees | Expected utilization | "Likely full at peak, plan more points" |

If the peak model is unreliable (likely, given censoring and dependence on point count), sizing falls back to a rule based on mean occupancy. The comparison then tells us which outputs we can show with confidence.

Peak definition: 90th percentile of hourly occupancy over valid days, or share of hours at 100%, **normalized for point count**, not the daily max. A 1-point station is otherwise always "100% at peak".

## 8. Endogeneity and selection bias

**Q3.18 Does this invalidate our approach compared with simulation like StandortTOOL? Can it be argued away for a business audience? Can it be addressed?**

The problems:
1. **Selection:** we only observe usage where operators chose to build, which is where they expected demand. Low-demand and unserved places are missing.
2. **Endogenous supply features:** points, power and competition were chosen in response to demand, so their effects are not causal.
3. **Censoring:** usage is capped by capacity (Q3.1).
4. **Sample bias:** the feed covers part of the stations, mostly large networks (Q3.10).

**Does it invalidate the approach? No, not for our question.** ==🟡We predict how well a new station would be used *if built like stations are built today*.== That is a conditional question, and our data answers it within its range. Candidates are mostly within that range: half are within ~500 m of a training station (Q3.6).

What it does invalidate:
- causal claims ("one more point raises use by x");
- predictions far from any station, i.e. remote, unserved areas, exactly where coverage matters;
- claims about "true latent demand".

**Versus StandortTOOL:** simulation has no selection bias from observed usage, but it rests on assumptions that are hard to validate (behaviour rules, national demand scenarios; its traffic assignment reaches 73% of count values within tolerance against an 85% target). Ours is empirical but biased; theirs is unbiased by construction but barely validated. Both proxies capture part of true demand (Weekx, Fig. 11), so they complement each other and comparing them is part of our validation.

**Business framing: largely yes.** A CPO asks "if I build here, the way the market builds, will it be used?" That is exactly the conditional question, and the competitors' behaviour is part of the market. For municipalities (coverage, equity) it cannot be argued away. That is why accessibility mode weights by population, not by the ML score.

**How to address it:**

| Step                                                                                                                                                                            | Effort     | v1?                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------- |
| Error versus distance to training sites; flag candidates outside the model's range in the app                                                                                   | Low        | **Yes**                     |
| Restrict claims: ranking within range, no causal reading of supply effects                                                                                                      | None       | **Yes**                     |
| Feed versus register diagnostic, optional inverse-probability weights (Q3.10)                                                                                                   | Low–medium | **Yes (diagnostic)**        |
| Coverage term in the optimizer for areas the model cannot see                                                                                                                   | Medium     | Accessibility / hybrid mode |
| Selection model (Heckman type): model "station built here?" and correct for it. Needs a variable that affects building but not usage (e.g. a funding programme); hard to defend | High       | No                          |
| Natural experiment: occupancy of existing stations before and after a new neighbour opens (151 stations opened after Feb 2026). Gives a near-causal estimate of cannibalization | Medium     | Future addition             |
| Compare with StandortTOOL demand for BW                                                                                                                                         | Medium     | Validation, later           |

---

## Future additions

Ideas we agreed to postpone. They move to `docs/analysis_plan.md` once the discussion is final.

- **Contested-zone estimation:** score supermarket and urban retail candidates as both AC and DC and pick by expected kWh (or revenue) per cost. Works with the pooled or separate models (easier with pooled). Needs cost data and the energy conversion.
- **Finer power classes:** AC / DC 50–149 kW / HPC ≥ 150 kW, if DC sample size allows.
- **Accessibility and hybrid optimization modes:** same optimizer, different weights (λ slider).
- **Saturation share** (hours at 100%) as an unmet-demand signal and target. Needs hourly data.
- **Usage archetypes** per site from hourly profiles (overnight residential, daytime destination, transit).
- **Panel model** (site × day) for daily profiles.
- **Cannibalization event study** around stations opened in 2026.
- **Inverse-probability weighting** as a sensitivity check only (decided against for the main model, see Round 4 decisions).
- **Heckman-type selection correction**, only with a defensible exclusion variable.
- **Scenario scaling** of absolute demand with fleet-growth scenarios (NOW / StandortTOOL).
- **Commuter and tourism features**, if bulk data is found.
- **HistGradientBoosting** as a comparison against RF (v1 uses RF only).
- **log1p and logit target** test with the final features (v1 uses raw occupancy; quick check showed similar ranking but biased magnitudes).
- **Queueing (Erlang) sizing model** instead of the saturation rule (needs reliable arrival counts; session starts are only a lower bound).
- **Cut for time (Round 6):** separate AC/DC models vs pooled, window normalization, forward test on Nov–Jan, StandortTOOL comparison, traffic-count (DTV) interpolation. Repeats reduced to 5, calibration only as a decile plot.

---

## Next topics (not yet discussed)

- Optimization formulation in detail (objective, coverage radius per AC/DC, candidate filtering, cost parameters).
- Sizing rule (points per site, power class) and cost assumptions.
- Concrete feature table and pipeline steps.
- Reconcile stale docs (`docs/project_outline.md`, `todos.md`) with the ML plan.
