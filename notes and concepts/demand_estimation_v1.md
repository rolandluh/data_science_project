# Demand estimation v1: decision record

What the first version of the demand model will be, where we are still unsure, and what hasn't been decided yet. It summarizes the discussion in `Analysis Q&A.md` (rounds 1–6) and the decision rounds that followed (22–23 Nov 2026). The Q&A file has the full reasoning and the numbers behind each choice.

Status: **design, no code yet.** Nothing here is final until it moves into `docs/analysis_plan.md`.

**Legend**
- ✅ **Decided:** agreed in the discussion.
- ❓ **Uncertain:** a leaning or default exists, but it needs a check or a veto.
- ⬜ **Unaddressed:** not discussed yet.

Each decision has a short *why* and, where relevant, *limits*.

---

## At a glance

| Area | v1 choice | Status |
|---|---|---|
| Question | Expected usage of a new charging site, given today's supply | ✅ |
| Training unit | Charging site: stations merged within 50 m (~4,500 sites) | ✅ |
| Target | Mean occupancy per point (site average), raw share; shown to users as hours per point per day | ✅ |
| Algorithm | RandomForest regressor on raw occupancy (feeds optimizer) | ✅ |
| AC vs DC | One pooled model with power class as a feature | ✅ |
| Features | Demographics, income, EV share, destinations (POIs), site type, roads (distances), competition, operator (6 groups), station age, power class | ✅ groups / ❓ exact list |
| Power recommendation | Context rule: motorway, primary road, supermarket → DC; rest → AC | ✅ |
| Sizing | Saturation rule: smallest point count whose site is full no more often than 3 in 4 of today's stations of its class (AC ≈ 31%, DC ≈ 5% of days with a fully occupied hour) | ✅ |
| Bias handling | Operator as control; no reweighting; "Low confidence" warning | ✅ |
| Validation | 2 km spatial block CV + baselines; combined new-site + later-months test; metrics per AC and DC | ✅ |
| Hand-off to optimizer | Precomputed predictions as point-hours per day; saturation for sizing and as a map layer only | ✅ |
| AC/DC split | Set by the user as separate AC and DC budgets (€); site counts follow from adjustable cost assumptions; optimizer ranks within each class, minimum spacing between picks | ✅ |

---

## 1. Problem framing

✅ **Estimand: expected usage of a new site if built the way stations are built today**, not latent "true" demand.
- *Why:* our data can answer this conditional question within its range. It is also the question a CPO asks.
- *Limits:* no causal claims about supply effects, and weak predictions in remote, unserved areas.

✅ **Data-driven model (Weekx approach), not a simulation like StandortTOOL.**
- *Why:* it is empirical and can be validated on held-out stations. Simulation needs behaviour assumptions that can't be validated.
- *Limits:* only demand where stations exist is observed. No StandortTOOL comparison in v1 (cut for time).

✅ **StandortTOOL's two demand types (en-route vs opportunity) are implicit in estimation and explicit in optimization.**
- *Why:* we have no trip simulation, so features plus AC/DC type capture both patterns. In v1 the optimizer handles them through separate AC and DC budgets and a larger spacing distance for DC (§9).

✅ **Primary user is a CPO (usage maximization). Municipalities are secondary.**
- *Why:* this is the presentation framing. Profit becomes usage, which becomes demand, because there's no revenue data.
- *Limits:* "profit" is really usage. Accessibility needs a separate optimizer mode (later).

✅ **The CPO sets a budget (€) for AC and one for DC; the tool picks where, and how many sites fit.**
- *Why:* the AC/DC mix is a business strategy decision (capital, grid connections, target customers), and CPOs tend to specialise: our operator groups separate fast-charging networks from city and regional AC operators (§4). We have no cost or revenue data to make that choice for them. Occupancy is also not comparable between AC and DC (§3), so a single ranking would favour AC.
- *Limits:* the tool doesn't say whether AC or DC pays off better. That needs cost and revenue data, not only costs per site.

---

## 2. Data and sample

✅ **Usage source: MobiData BW feed, time-weighted daily occupancy** (`auslastung_taeglich_bw.parquet`).
- *Why:* it is the only usage data available, and the time weighting handles the switch to change-only deltas on 14 Aug 2026.
- *Limits:* the feed covers part of the stations (47% of register rows have a feed station within 50 m), favouring large networks and DC. The data window is 28 Jan – 4 Oct 2026.

✅ **Stations kept: coordinates known, ≥ 14 valid days (≥ 18 h of live status per day).**
- *Why:* fewer days give an unreliable average.
- *Result:* 5,069 stations (3,909 AC, 1,160 DC).

✅ **Unit of analysis: site = stations within a 50 m radius (single linkage). About 4,500 sites.**
- *Why:* a site is what a driver sees as one option. Moving between 30 and 70 m changes the count by only 4%. 50 m is already used for matching in the app. A radius rather than a rectangle, because it joins point stations; rectangles would depend on an arbitrary orientation.
- *Limits:* chaining is rare, with at most 7 over-wide sites.

✅ **Duplicate coordinates are merged into one site.**
- *Why:* 1,568 station pairs share exact coordinates, because some feeds list each charge point separately (e.g. 90 at one car park in Konstanz). Without merging they would inflate the sample and leak between train and test.

✅ **Mixed sites (64 with AC and DC) are split into an AC part and a DC part.** The two parts share a location and therefore a CV fold.
- *Why:* AC and DC usage are different products.

✅ **AC/DC threshold: max power ≥ 50 kW = DC.**
- *Why:* this is the standard split and the one used in the sensitivity check.
- *Limits:* it lumps 50 kW and HPC together. Finer classes are postponed (§12).

✅ **Opening date of a site = earliest register `Inbetriebnahmedatum` within 50 m.**
- *Why:* extensions of an existing site are not new sites (14% of matched stations have rows from several years).
- *Limits:* 12% of dates fall on the 1st of a month (rounded), and batch registrations exist (e.g. Bosch, 372 rows on two dates). Recent months are incomplete because of reporting lag. Dates are taken as they are.

✅ **Row = site, aggregated over all valid days, not station-days.**
- *Why:* features are static, and daily rows would multiply the sample without independent information.

---

## 3. Target variable

✅ **Target: mean occupancy per point** = Σ charging point-hours ÷ Σ capacity point-hours over the site's valid days.
- *Why:* best measured and well defined. Mild censoring (5.4% of AC days have mean > 50%), consistent with the home-charging calibration.
- *Interpretation:* the expected share of time an average charging point at the site is in use, averaged over the valid days of the data window (so at 2026 fleet levels). Example: 0.15 means each point is busy about 3.6 h per day. Site usage = occupancy × points × 24 h.
- *Limits:* it mixes dwell time with throughput (overnight AC looks busy), and it isn't comparable between AC and DC. It is close to Weekx's weakest metric (duration), so expect modest performance.

✅ **Train on the share (0–1); show users hours per point per day** (share × 24, e.g. 0.15 → 3.6 h).
- *Why:* multiplying the target by a constant changes nothing for RF (same splits, scaled leaf values), so the share keeps code and metrics simple. Hours per day is easier to grasp for non-technical users.

✅ **Raw scale, no log or logit transform of the target.**
- *Why:* the optimizer needs magnitudes, and back-transformed log or logit predictions are biased low (Jensen's inequality; [arXiv 2208.12264](https://arxiv.org/pdf/2208.12264), [arXiv 2003.07445](https://arxiv.org/pdf/2003.07445)). Quick check (stations, 10 rough features, RF, 2 km block CV, 3 repeats): ranking almost equal (AC Spearman raw 0.340, log1p 0.348, logit 0.366; DC 0.341 / 0.342 / 0.333; lift@20% within noise), but logit underpredicts mean occupancy by ~27% and log1p by ~4%, while raw is unbiased.
- *Limits:* high-occupancy sites dominate the squared-error splits. Re-test log1p and logit with the final features (§12).

✅ **Only the mean is modelled. No separate peak-occupancy model.**
- *Why:* peak occupancy is heavily censored and depends on point count. Its information enters through sizing (§5) and the "overused stations" map layer (§9).

✅ **Energy (kWh) is not a target.** It is a documented conversion after prediction: occupancy × points × assumed kW per class.
- *Why:* it isn't observed, and as a target the model would mostly learn installed power (spurious accuracy).

✅ **Session starts are not used.**
- *Why:* a lower bound that depends on the polling interval (10 → 20 min on 14 Aug).

✅ **No window normalization in v1 (cut for time).** Site occupancy is the plain mean over its valid days.
- *Limits:* stations enter the feed in different months (most in Apr–Jun), so seasonal and network-wide shifts slightly bias site means. Documented as a limitation; daily normalization postponed (§12).

---

## 4. Features

✅ **Feature groups for v1, with buffers:**

| Group | Content | Buffer / form | Buffer reasoning | Source | Status of data |
|---|---|---|---|---|---|
| Residents and demographics | population, average age, ownership rate, household size, share 65+ / under 18, living space per person, apartment share (home-charging gap) | 1 km | Walk home after overnight charging; 1–1.5 km fitted best | Zensus 2022 | population and building type have; rest **to download** |
| Income | median wage at residence | 1 km | Same catchment as residents | BA | have |
| EV share | share of cars with electric drive | 5 km | Source resolution; smaller adds nothing | KBA | have |
| Destinations (POIs) | supermarket, retail, office, industrial, hospital, university, leisure, tourism, rail station, P+R | 500 m | Walking distance charger → destination | OSM | partly have; **re-extract** leisure, rail, P+R |
| Site type | parking type, fee, access, P+R | at the site | Property of the site itself | OSM / MobiData parking layer (same for sites and candidates) | partly have |
| Roads | distance to motorway junction / services; distance to nearest major road; major-road length within 1 km | distances, 1 km | Traffic is a line; short detour from the road | OSM | have major roads; **re-extract** local roads |
| Competition | charge points and kW (site's own points excluded), nearest station and nearest DC | 0.5 / 1 / 5 km | Next door / local / wider market | register | have |
| Operator | 6 groups (see below) | categorical | Not spatial | register / feed | have |
| Station age | days since opening at the middle of the observation window | numeric | Not spatial | register | have |
| Power class | AC or DC (≥ 50 kW); for candidates set by the AC/DC rule | categorical | Not spatial | register / feed | have |

- *Why the buffers:*
  - **500 m:** walking distance to a destination.
  - **1 km:** walk home after overnight charging (1–1.5 km fitted best in the home-charging check).
  - **5 km for EV share:** the source resolution, so smaller buffers return the same value.
  - **Roads as distances:** through traffic follows a line, not an area.
- *Limits:*
  - The EV share carries no information below 5 km.
  - No traffic volumes (DTV interpolation cut for time); road class and distances stand in for through traffic.
  - Income is the wage of full-time employees, not household income.
  - **Price, the strongest missing driver, isn't available.**

✅ **No log (or other monotone) transforms of features.**
- *Why:* tree splits depend only on the order of values, and a monotone transform keeps the order, so RF builds the same trees ([R-help explanation](https://stat.ethz.ch/pipermail/r-help/2011-December/297634.html); [Galili 2016](https://arxiv.org/pdf/1611.04561)).
- *Limits:* Galili reports that a quantile transform can slightly improve interpolation between training values. Ignored in v1.

✅ **Power class (AC/DC) is a feature.**
- *Why:* the model is pooled, so power class is how it separates AC from DC usage patterns. Candidates get it from the AC/DC rule (§6).

✅ **Competition goes in as features (estimation) *and* is handled in the optimizer.**
- *Why:* features give the marginal value of one new station. The optimizer must not double-count demand shared between nearby picks.
- *Limits:* supply is endogenous, so its effects aren't causal and extreme counterfactuals are unreliable.

✅ **Operator is a control feature. When scoring a candidate, predictions are averaged over a reference operator mix (marginalized).** Option: fix it to the user's own operator.
- *Why:* operator carries price, access and reliability. Without it, the model credits those effects to location.
- *Limits:* operator can act as a regional proxy, which spatial CV must reveal.

✅ **Operator groups: 6.** EnBW as its own group; the rest assigned by a data rule, not by name (operators with ≥ 20 feed stations; the rest = other): DC share ≥ 0.5 → fast-charging network; else spread of stations (RMS distance to centroid) < 15 km → city operator; < 50 km → regional; ≥ 50 km → statewide. Reference mix for marginalizing = training share (feed). One-hot encoded.
- *Why:* clustering the 44 larger operators on DC share, spread, cities per station and resident density (target excluded) shows no strong natural groups (silhouette 0.33–0.42); the stable splits are DC networks vs city vs wider AC operators. A rule is reproducible and assigns new operators automatically. EnBW is the one named exception: 17% of feed stations, its own data feed, statewide (414 cities), so it is no city label. Individual city utilities would act as city labels that 2 km block CV cannot detect.
- *Limits:* thresholds (0.5 / 15 / 50 km) are judgement; price differences inside a group fall into the location effect. The feed mix over-represents big networks, so candidates are scored a bit as if a big network built them (register mix: §12).

✅ **Station age is a feature. Candidates are scored at a fixed mature age (e.g. 1 year).**
- *Why:* new stations fill gradually, and age separates ramp-up from location quality.

✅ **Daily-profile features (night share, weekend ratio) are not used as model features.**
- *Why:* they are computed from the site's own occupancy (target leakage) and don't exist for candidates. They are used only for interpretation.

✅ **Feature priority:** Zensus extras → competition → site type and road context → transit / P+R. Commuters and tourism come later.
- *Why:* ordered by value per effort. Commuter and tourism data have no bulk download.

---

## 5. Models and sizing

✅ **One RandomForest regressor on raw occupancy (feeds the optimizer). No separate top-20% classifier.**
- *Why:* the optimizer needs magnitudes (additive weights, sizing), which a class probability can't give. Sorting the regressor's predictions already gives a top-20% list, so its top-20% AUC is the link to Weekx without a second model. Weekx's case against continuous models rests mostly on small samples; we have about 10× more stations.

✅ **Algorithm: RandomForest only in v1.** Small grid (`max_features`, `min_samples_leaf`, number of trees); inner tuning folds also 2 km blocks (`groups`); scikit-learn version pinned (NaN handling in RF depends on the version; local is 1.5.1).
- *Why:* likely as accurate as gradient boosting on our noisy target, fewer hyperparameters, works with defaults, easier to explain, matches Weekx.
- *Limits:* HistGradientBoosting comparison postponed (§12).

✅ **No formal learning-to-rank.**
- *Why:* a regressor judged by rank metrics does the same job and also gives magnitudes.

✅ **AC and DC: one pooled model with power class as a feature.** Separate models are postponed (§12).
- *Why:* pooling shares strength across the groups, which matters for the sparse DC sites. Trees learn the type interactions themselves (AC and DC have different drivers: residents |ρ| < 0.08 for DC). One model is less work and makes it easy to score both types (vary the power input).
- *Limits:* DC is sparse (about 1,100 sites, fewer in CV folds), so expect shallow trees and noisy estimates.

✅ **Number of points is not learned; a site's own point count is not a feature.**
- *Why:* operators choose point counts where they expect demand (endogenous), so the count would mostly tell the model what the operator expected.

✅ **Sizing: saturation rule.**
1. The prediction for a candidate is read as occupancy at the reference size of 2 points (median of sites opened 2025–26, AC and DC, after the 50 m merge).
2. Convert to site demand in point-hours per day: occupancy × 2 × 24.
3. Spread it over n = 2, 4, 6, … points (occupancy at n points = occupancy × 2 / n).
4. Choose the smallest n whose expected share of "full" days is ≤ the target of its class. **Full day** = the day's busiest hour had every point occupied for the whole hour (`peak_hour_occupancy` = 100% in the daily file). **Target** = the 75th percentile of today's stations of the same class: AC ≈ 31%, DC ≈ 5% of days (stations with ≥ 14 valid days). The expected share comes from a lookup table built from existing stations: median share of full days by power class, point-count class and mean-occupancy bin.
5. Cap at a maximum (parameter, e.g. 8 AC / 12 DC). The user can override the result.
- *Why:* it answers "how many points?" with data we have, and it uses the peak / saturation information. It is easy to explain: "a new site should be full no more often than 3 in 4 of today's stations of its type." Data: 2-point AC sites at 15–20% mean occupancy have a full hour on 25% of days, at 20–25% on 38%; 4-point DC sites are rarely full.
- *Why a full hour:* it is the finest level in the processed daily data (one peak-hour value per day), and it is unambiguous: anyone arriving in that hour found no free point.
- *Why per class and anchored to today:* a single 25% target was judgement; today only 5% of DC stations are that full (median AC station: 10% of days, median DC: 1%), and DC drivers are mid-trip and less willing to wait. Anchoring to today's 75th percentile gives each class the service level of today's typical stations.
- *Sensitivity check (passed):* defining a full day as busiest hour ≥ 90% occupied instead (targets then AC ≈ 37%, DC ≈ 9%) changes the recommended size for 18 of 5,134 AC and 3 of 1,457 DC stations, each by 2 points; mean size 2.54 vs 2.55 (AC), 2.94 vs 2.95 (DC). Check run on today's stations with their own demand as input; the target is re-anchored for each definition, which is part of why the result is stable.
- *Limits:* see M7 in `demand_limitations_v1.md`. A queueing (Erlang) model is postponed (§12).
- *Effort:* about 1 day, no new dependency.

---

## 6. AC/DC recommendation (v1 rule)

✅ **A candidate at a motorway (services, rest area, junction), on a primary road, or at a supermarket / discounter → DC. Everything else → AC. No exact kW in v1.**
- *Why:* transparent, easy to explain, and it follows StandortTOOL's en-route vs opportunity split.
- *Tie-breakers (supermarkets):* a low apartment share nearby **and** an existing DC within X km → AC instead.
- *Risk:* primary roads run through towns, so many urban sites may become DC. If that happens, restrict the rule to primary roads outside built-up areas, which needs the built-up area extract.
- *Limits:* it's a rule, not learned. The tie-breaker thresholds (X km, apartment share) are still open (§10).

✅ **Scoring every candidate as both AC and DC is postponed (§12); v1 keeps the rule.**
- *Why:* with user-set budgets (§1, §9) no common AC/DC scale is needed any more, but the rule is simpler for v1. The pooled model makes it easy later (vary the power input).
- *Limits:* the DC budget can only pick motorway, primary-road and supermarket spots, so DC hubs elsewhere (e.g. in town centres) are never found.

---

## 7. Bias, censoring, endogeneity

✅ **The approach is not invalidated. Claims are restricted to ranking within the data's range.**
- *Why:* we predict a conditional quantity (usage if built like today's stations). Candidates are close to training stations: half within 511 m (all candidates; the picks may lie further out, §12).
- *Limits:* weak in remote areas, no causal reading of supply effects, long-term ranking of sites.

✅ **No inverse-probability weights in the main model.** A weighted run is only a sensitivity check (§12).
- *Why:* the feed's selection runs mainly through operator, which is a feature and is marginalized. The DC over-representation is handled by the power-class feature and per-group metrics. Location differences are small (SMD +0.19 for residents). Weights would cost precision (effective sample 64%).
- *Limits:* differences in unobserved factors such as price remain uncorrected.

✅ **"Low confidence" warning for the user (technically an out-of-range flag).** Shown on a candidate when it is far from every existing station or some of its key features lie outside the training range (1st–99th percentile). User text: *"Few charging stations like this one exist nearby, so this estimate is less reliable."* No prediction intervals.
- *Method:* model error from block CV is plotted against distance to the nearest training site (site count per distance bin reported). The distance threshold is the largest well-populated bin where predictions are still reliable.
- *Why:* it makes the selection bias visible to the user.

✅ **Censoring is documented for the mean target. No Tobit model.**
- *Why:* censoring is mild for the mean, and tree models don't need a parametric fix. Peak-related censoring is handled through sizing (§5).

---

## 8. Validation

✅ **Core validation = spatial block CV + baselines. The combined new-site test is the only second test.** Leave-one-Kreis-out is postponed (§12).
- *Why:* the combined test is closest to the real use and needs only a split definition; the Kreis test adds little beyond block CV and the error-vs-distance plot.

✅ **Spatial block CV: 2 km grid squares, 5 folds, random block assignment, nested tuning, 5 repeated partitions.**
- *Why:* block size is matched to how far real prediction sites are from training stations. With 0.5–1 km blocks the test distances match all candidates (median 511 m). Recommended sites lie further out, so we use 2 km. Grids also give balanced folds of 900–1,100 stations.
- *Limits:* the 2 km choice is partly judgement (§10).

✅ **Combined new-site + later-months test, cut on 1 Jul 2026.** Train: sites opened before 2025, with ≥ 14 valid days before the cut (2,677 stations, 525 DC). Test: sites opened 2025–26, with ≥ 14 valid days after the cut (658, 312 DC). Tuning by block CV inside the training part; the test set is scored once.
- *Why:* it tests new places and new time at once, which is closest to the real use.
- *Limits:* the test sites have short histories and are still filling up; the test isn't random (new stations come from larger networks and more of them are HPC); it only tests months, not years; it checks agreement with operators' choices, not true demand.

✅ **Final model:** tuned by block CV and refit on all sites and all days. Only this model feeds the app; the fits inside the two experiments exist only to produce scores.

✅ **Metrics, reported separately for AC and DC** (pooled figure only as a footnote), one compact table per experiment (model × group × metric):
- Spearman rank correlation;
- top-20% AUC of the regressor's predictions, with the cutoff set within each group (top 20% of AC sites, top 20% of DC sites) from the test sites' own observed occupancy, so exactly 20% count as "top" even when the test period or site age lowers usage (new-site test: summer, young sites);
- lift and precision at k: realized occupancy of the model's top-k picks;
- decile plot (predicted vs actual); no further calibration study.
- *Why per group:* AC has higher occupancy than DC at equally good locations (DC is 23% of stations but 11% of the pooled top 20%). A pooled cutoff would partly measure "is AC", and pooled scores would hide a weak DC model.
- *Limits:* DC estimates are noisier (~1,100 sites; ~310 in the new-site test). The 20% follows Weekx (Straka et al. used 25%).

✅ **Baselines** (same folds and metrics as the model):
- **Random.**
- **Supply-gap score** (EV index ÷ charge points, site's own points excluded as for candidates): "demand is where chargers are missing". Its 0.9 rate was calibrated on all stations, test sites included, which slightly favours the baseline.
- **kNN spatial mean:** mean occupancy of the 5 nearest training sites of the same power class (`KNeighborsRegressor`, k = 5): "demand is where nearby stations are already busy".
- *Why both:* they are the two simple rival explanations of demand. If ML doesn't beat them, we report it; not beating kNN means the features add nothing beyond copying the neighbours. kNN is also the only meaningful baseline for DC, where the supply-gap score is close to random (|ρ| < 0.08).
- *Limits:* kNN is only a yardstick at existing stations, not usable for candidates far from any station.

✅ **Diagnostics:** feed vs register comparison, plus error vs distance. Both are automated in `src/validate.py`.

---

## 9. Hand-off to the optimizer

✅ **Demand weight = predicted site demand in point-hours per day** (occupancy × 2 reference points × 24, as in §5 step 2) at candidate sites only. The 500 m cell predictions are a map layer, labelled as expected usage of a typical station there, not as demand, and are not an optimizer input.

✅ **Separate AC and DC budgets in euros, set by the user (§1).** Each pick costs its site cost from cost assumptions per class (per-site costs such as the grid connection, plus per-point costs × points from sizing, §5); the user can adjust the assumptions. The optimizer picks the best AC sites and the best DC sites until their own budget is used; AC and DC are never ranked against each other.
- *Why:* point-hours are not comparable across classes (an overnight AC car collects many hours but little energy), and comparing them on kWh would hinge on assumed charging power and costs, not on the model. A monetary budget matches how a CPO plans.
- *Limits:* picking by point-hours doesn't maximize usage per euro: one expensive large site can use budget that two cheaper sites would use better. Cost values are still to be researched (cost list: `todos.md`).

✅ **Optimizer objective (per power class):** maximize the total predicted site demand of the picked candidates, in point-hours per day (§9 demand weight), subject to (1) the sum of their site costs staying within the class's € budget and (2) no two picks of the same class lying closer than the class's minimum spacing distance.
- *Why:* states what the greedy selection is trying to achieve, so results can be compared across strategies, baselines and parameter settings.
- *Limits:* the greedy rule below approximates this objective; it doesn't guarantee the optimum. The objective counts usage, not revenue or profit.

✅ **Spacing rule between picks:** greedy selection by predicted point-hours; a candidate is skipped if it lies within a minimum distance of an earlier pick of the same power class. One distance parameter per class (larger for DC), tested at a few values.
- *Why:* candidate scores are independent, so without it three spots 100 m apart could all be picked and double-count the same demand (§4). Simple and explainable; nearby existing stations are already handled by the competition features.
- *Limits:* a hard cutoff is crude, and the distances are judgement. A distance-decay rule is the planned replacement (§12).

✅ **Predictions are precomputed in the pipeline** for all public parking candidates (~117k) and 500 m cells (~49k), saved to `data/processed/`; the app only reads them. One shared feature function for training sites, candidates and cells. Cells get explicit defaults for site attributes; operator is marginalized; road distances via geopandas (EPSG:25832).
- *Why:* one place for the logic and a fast app. File size is small: ~166k rows × a few prediction columns is roughly 10–20 MB (estimate), less than the combined parking layer already served (93 MB). Features go to Parquet, not to the app.

✅ **Saturation (share of days with a fully occupied hour) is used for sizing new sites (§5) and shown as the "overused stations" map layer. It is not an optimizer input.**
- *Why:* it exists only for feed stations, which favour big networks, so as "unmet demand" it would pull picks toward big-network areas; areas of small operators would look unsaturated only because we can't see them. There is also no clean conversion from "full on X% of days" to point-hours.
- *Limits:* congestion at existing stations doesn't raise a nearby candidate's score directly; the competition features cover nearby supply only.

✅ **Future scenarios: 2030 and 2035 are shown per site for the business case; they are not an input** (changed 23 Nov 2026 after the concept mock-up; before: a year switch that re-ran sizing, costs and the optimizer). Picks, sizing and site costs use today's prediction only. Each recommended site shows its demand today, in 2030 and in 2035. Factor per Kreis = (StandortTOOL public demand in year Y ÷ 2026, Referenzszenario, dashboard download) ÷ (BW charging points in year Y ÷ 2026). Supply grows linearly by the 2023–25 average of points added per year from the register (~5,900 per year in BW). Site point-hours × factor, capped at the highest observed occupancy, spread over the recommended points (mock-up: cap = 99th percentile, since the maximum is 100 %).
- *Why:* our model can't forecast; NOW's demand rests on sales forecasts and a per-Kreis ramp-up we can't build. Supply additions have been roughly flat since 2022 while percentage growth fell (60% → 18%), so a linear trend fits better than compounding (2035: ×2.6 instead of ×4.4).
- *Limits:* a scenario, not a forecast; the factor is the same for all sites in a Kreis; NOW's figures are being updated (Nov 2026); the register lacks closed points and recent months; usage behaviour is assumed to stay as in 2026. 2035 is labelled long-term.

✅ **One optimizer mode first (usage maximization). Accessibility and hybrid (λ slider) later.** Objective weights are a parameter.

✅ **Energy and returns are not shown in v1** (changed 23 Nov 2026 after the concept mock-up; before: shown per site as labelled estimates). They would rest on assumed charging power, prices and running costs rather than on the model. The cost assumptions (cost list: `todos.md`) still decide site costs and how many sites fit each budget.

---

## 10. Still uncertain ❓

| Item | Current leaning / default | What decides it |
|---|---|---|
| Block size final | 2 km | Distance matching on sites and on the optimizer's picks |
| Ramp-up handling | Station age feature; test sites ≥ 60 days old | Sensitivity with / without filter (568 test sites if filtered) |
| Batch-registered / company / dealer sites | Flag, run with and without | Check whether they are public |
| 923 feed stations with no register match | Keep in CV, exclude from the new-site test | How many have early first-seen dates |
| Sample weights by valid days (√days) | Leaning yes | CV comparison |
| Tie-breaker thresholds for supermarkets | X km to the nearest DC, apartment share | Look at the distributions, set as parameters |
| Primary-road rule restriction | Unrestricted first | Share of urban sites that become DC |
| Zensus file resolution | 100 m hoped | Inspect after download |
| Discounter tagging in OSM | `shop=supermarket` + brand | Inspect extract |
| Feature list and preprocessing | Frozen v1 list from data on disk (including re-extracts from the local OSM file, §4) plus the Zensus downloads; one disc buffer per group as in §4; no correlation pruning; NaN only for "not published", 0 for "none present"; one shared feature function for sites, candidates and cells; unit test for train / score consistency (default, veto welcome) | Veto, or problems in the consistency test |

---

## 11. Not yet addressed ⬜

- **Residual spatial autocorrelation check** (Moran's I, from the original project outline; kept, cheap).
- **Retraining cadence and automation** (`run_pipeline.py`): when, on which window, how results are versioned.

---

## 12. Postponed (current list; `Analysis Q&A.md` → Future additions is an older version)

- **Model:** separate AC and DC models (vs pooled); HistGradientBoosting comparison against RF; log1p and logit target test with the final features; finer power classes (AC / 50–149 kW / HPC); panel model (site × day); register-based operator mix for marginalizing (operator groups of BW stations opened 2025–26 in the register, which matches "built the way stations are built today"; needs a register ↔ feed operator name-mapping table, e.g. "Albwerk Elektro- und Kommunikationstechnik GmbH" vs "Albwerk"; register-only operators fall into "other", the group the model knows worst; report top-k overlap between feed mix and register mix).
- **AC/DC and sizing:** score every candidate as both AC and DC (one extra prediction column); each budget picks from its own column, a spot can't be picked twice, and the context rule (§6) becomes a default or filter. DC predictions at residential spots will often get the low-confidence flag. Queueing (Erlang) sizing model.
- **Target:** daily window normalization: divide each station-day's occupancy by that day's mean over all stations of the same class (AC / DC), then average per site (about 1 h). Removes seasonal and network-wide shifts, so stations seen only in summer or only in spring become comparable; it also evens out holidays, weather and outage days, and makes the later-months test less dependent on the season it falls in.
- **Validation and bias:** paired block-bootstrap confidence intervals for model minus each baseline (resample 2 km blocks, about 2 h); robustness test scoring test sites at the fixed candidate age of 1 year instead of their real age (the main tests use real age; fixed age matches how candidates are scored in the app); leave-one-Kreis-out stress test; weighted (inverse-probability) sensitivity run; Heckman-type correction; external validation data (Weekx-style user requests); cannibalization event study.
- **Interpretation and scaling:** SHAP / feature-importance interpretation; usage archetypes; for the scenarios (§9): supply trend per Kreis (pulled toward the BW trend) and known future supply (Deutschlandnetz sites in planning or construction).
- **Features and targets:** saturation as its own target with hourly data; commuter and tourism features.
- **Optimizer:** **high priority:** StandortTOOL-style decay rule replacing the hard spacing rule. After each pick, nearby candidates of the same class lose part of their score by distance ring, using StandortTOOL's factors (AC 80% / 20% / 0%, DC 50% / 30% / 20% for ≤ 60 s / 60–120 s / 120–300 s drive time; Methodikbericht §3.3.2, Table 8), with straight-line rings standing in for drive time. About half a day of work. Limits: StandortTOOL uses the factors to subtract supply from demand, not to discount usage, and the seconds-to-metres conversion is our assumption. Also: accessibility and hybrid modes.
- **Concerns worth checking:** distance of the optimizer's picks to the nearest existing station. The "half within 511 m" in §7 covers all candidates, but the optimizer seeks gaps, so its picks likely lie further out, where the model is weaker. Check: report the picks' distance distribution and read their reliability off the error-vs-distance plot (about 1 h).

## 13. Cut from v1 (time)

Removed to fit the 8 weeks to submission; not planned unless time is left: forward test on Nov–Jan; StandortTOOL comparison; traffic-count (DTV) interpolation. Simplified: 5 repeated partitions instead of 50; calibration only as a decile plot.
