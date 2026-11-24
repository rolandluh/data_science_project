# Optimization ideas

Improvements to the v1 optimizer (greedy by predicted point-hours per € budget and class, hard spacing between picks; objective in `demand_estimation_v1.md` §9). Ranked for our scope: 3 people, submission 22 Jan 2027. Start only once the demand model works. Current limits: `optimization_limitations_v1.md`.

## At a glance

| Rank | Idea | Effort | When |
|---|---|---|---|
| 1 | Optimizer validation | ~1 day | First |
| 2 | Low-confidence filter | ~1 h | First |
| 3 | Best of two pick orders | ~1 h | First |
| 4 | Accessibility mode + strategy comparison | ~1.5 days | If time allows |
| 5 | Decay rule instead of hard spacing | ~0.5 day | If time allows |
| 6 | Exact solver check | ~0.5–1 day | Later |
| 7 | Re-score neighbours with the model | ~1 day | Later |
| 8 | Payback metric | depends on data | Later |

## First (about 1.5 days together)

**1. Optimizer validation**
- *What:* (a) Backtest: apply the pick rule (k picks with spacing) to the new-site test sites (§8); compare their observed usage with random, supply-gap and kNN picks. (b) Sensitivity: 3 spacing distances, costs ±30 %; report overlap of the picked sets and change in total. (c) Where picks land: distance to the nearest existing station, share within 500 m of one, share flagged low-confidence.
- *+* Grading rewards validation. Reuses existing predictions and baselines; the model stays untouched.
- *−* Backtest runs on existing sites, not real gaps. Parameters must be fixed beforehand, not tuned on the test.

**2. Low-confidence filter**
- *What:* leave out candidates with the §7 "Low confidence" flag by default; toggle in the app.
- *+* Counters the optimizer's curse: the top of many noisy predictions is mostly overestimates, which gather in gaps far from stations (H5; Smith & Winkler 2006, unverified).
- *−* Remote areas are never recommended by default. Needs the §7 flag built first.

**3. Best of two pick orders**
- *What:* run the greedy once by score, once by score per €; keep the set with more total point-hours.
- *+* Never worse than v1 on the objective; fixes budget waste (M6).
- *−* Only as good as the cost numbers (not researched yet). Score per € favours small sites, since sizing adds cost but not score. Still usage, not profit.

## If time allows

**4. Accessibility mode + strategy comparison**
- *What:* demand on 500 m cells (residents or public EV demand) counts once if a charger, existing or new, lies within radius R (e.g. 1 km AC, ~5 km DC). Greedy adds the site that covers the most new demand per €. Hybrid: λ mixes usage and coverage. One table compares strategies (random, usage, accessibility, hybrid) on point-hours, coverage % and low-confidence share.
- *+* The brief names accessibility and coverage and asks to compare deployment strategies. No double counting by construction. Standard maximal-coverage model, used for EV charging by Dong et al. 2019 (cited in `literature/Predicting_EV_charging_demand.md`).
- *−* Reopens the §9 rule "cells are not an optimizer input". Radius R is judgement.
- First in line once items 1–3 are done.

**5. Decay rule instead of hard spacing**
- *What:* after each pick, nearby candidates of the same class lose part of their score by distance ring (StandortTOOL Table 8: AC 80 / 20 / 0 %, DC 50 / 30 / 20 %); the list is re-sorted.
- *+* Softer than a hard cut-off.
- *−* The factors describe how a charger's capacity spreads, not how much a neighbour's usage drops; the seconds-to-metres conversion is our guess; more parameters. Hard spacing already prevents clusters, so ranked lower than in `demand_estimation_v1.md` §12.

## Later (probably not in this project)

**6. Exact solver check**
- *What:* solve the same problem exactly with `scipy.optimize.milp` (HiGHS, already installed) on 1–2 Kreise; report how far greedy is from the optimum.
- *+* Shows greedy is close enough. No new dependency.
- *−* Prediction noise matters far more than the solver gap. Too slow for all of BW.

**7. Re-score neighbours with the model**
- *What:* after each pick, update nearby candidates' competition features and predict again.
- *+* Uses our own model instead of borrowed factors.
- *−* Slower. Only valid if a partial-dependence check shows nearby supply lowers usage; supply is endogenous, so the learned effect may even be positive.

**8. Payback metric**
- *What:* rank by payback years = cost ÷ (yearly kWh × margin − running costs).
- *+* A real business metric for a CPO.
- *−* Needs price, margin and running-cost data we don't have.
