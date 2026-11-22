# Analysis Q&A

Running record of our design discussion on the analysis plan (demand estimation + recommendation optimization). Written 22 Nov 2026. Status: **discussion, no code yet.**

Abbreviations: CPO = charge point operator, CS = charging station, AC = slow (< 50 kW), DC = fast (≥ 50 kW), Weekx = Weekx et al. (2025).

---

## Agreed / leaning so far

- Demand model: a **top-20% classifier (Weekx replication)** plus a **continuous model** on occupancy, compared head to head.
- Training unit: a charging **site** (stations merged within ~50–100 m), not a day, not a grid cell, not a Kreis.
- Separate AC and DC models are to be tested against one pooled model. Context-dependent AC/DC recommendation is wanted.
- Optimization: one mode first (usage maximization), accessibility and hybrid modes later if time allows.
- Validation: spatial block CV, new-station test (commissioned 2025–26), comparison with the existing supply-gap score, later StandortTOOL.

Open: final target variable, whether competition goes into the features (my recommendation: yes), how AC and DC scores are compared on one scale.

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
| | Classifier (top 20%) | Regression on log or logit occupancy |
|---|---|---|
| Noisy target, outliers | Robust: only the rank around the cut matters | Sensitive. Needs a transform and a robust loss |
| Selection bias, censoring at ~100% | Ignores how saturated a station is | Same problem, but shows up as flat predictions at the top |
| Information used | Throws away variation inside the top and bottom classes | Uses all of it |
| What the optimizer needs | A probability is not additive and not on a usage scale. Cannot say "site A is twice as good as B" | A magnitude. Usable as a weight in "maximize Σ demand × covered", for sizing, and for returns |
| Communication / literature | Matches Weekx | Needs calibration to be believed |

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
- **Row = site.** Merge stations within ~50–100 m (same parking area) into one site. About 5,069 stations probably become roughly 3,500 sites (my estimate, to be computed). This avoids near-duplicate rows landing in both train and test.
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
- Mixes dwell time and throughput. One car plugged in overnight on AC gives 100% occupancy but little energy. A DC point with 30-minute sessions at 30% occupancy delivers more kWh.
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

## Next topics (not yet discussed)

- Optimization formulation in detail (objective, coverage radius per AC/DC, candidate filtering, cost parameters).
- Sizing rule (points per site, power class) and cost assumptions.
- Concrete feature table and pipeline steps.
- Reconcile stale docs (`docs/project_outline.md`, `todos.md`) with the ML plan.
