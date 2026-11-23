---
name: methodology-review
description: Critically review a method, model design or analysis-plan section of the EV charging project (demand estimation, recommendation, spatial optimization) and return ranked, actionable findings. Use when asked to review, critique, stress-test or sanity-check methodology. Not for code review.
---

# Methodology review

Review exactly what the user points at (a section of `docs/analysis_plan.md`, a method idea, a model script). Read it fully first. Then read `CLAUDE.md`, `docs/model_inputs.md` and the relevant files in `literature/` before judging anything.

## Checklist

1. **Question and estimand.** What is estimated: latent demand, expected utilization, or coverage gap? Does the metric match the decision (where to put k new sites)?
2. **Proxy validity.** Is demand a proxy of a proxy? Known weak points in this project:
   - Existing stations reflect past supply decisions, not demand (endogeneity, selection bias).
   - Occupancy data covers only about a third of stations and favours large networks.
   - The EV share is a 5 km value distributed to 500 m cells; it carries no information below 5 km.
   - The home-charging rate (0.9) is calibrated on occupancy, so occupancy cannot also validate it.
   - Population-based demand misses through-traffic (motorways, rest areas); that needs traffic data.
3. **Units and definitions.** Charging points vs stations; slow (AC) vs fast (DC) power; coverage radius vs actual road distance.
4. **Leakage.** Are features built from the same stations the model is evaluated against? Is there a time or spatial split?
5. **Spatial issues.** Autocorrelation (use spatially blocked validation), grid-size sensitivity (MAUP), border effects at the BW boundary.
6. **Optimization.** Is the objective what we claim? Are constraints (budget k, minimum distance, grid or parking availability) explicit? Is a solver gap or a greedy comparison reported?
7. **Robustness.** Which parameters drive the result (radius, weights, rates)? Is a sensitivity check planned?
8. **Feasibility.** Can it run in the time left, automatically on new data, and be explained to a non-technical audience?

## Output

Rank findings **critical / worth fixing / minor**. For each: the issue, why it matters for this project, and the cheapest check or fix. Then list what is good enough as is, and give one recommended next step. Keep it to about one page.

Be pragmatic: do not demand methodological perfection where a documented limitation is enough. Cite only what is in `literature/`; anything from general knowledge is marked "verify". Never invent references or numbers.
