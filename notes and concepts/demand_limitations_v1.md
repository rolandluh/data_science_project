# Demand limitations v1: underrepresented public charging points

Which **public** charging points the usage data (MobiData BW feed) represents poorly, and what that means for `demand_estimation_v1.md`. Private and non-public points (company car parks, reserved spaces) are out of scope.

Evidence: **measured** = checked on our data, **inferred** = plausible reason, not verified, **untested** = not checked yet.

## How it was measured

- Register (18,863 BW stations, 1 Sep 2026) vs. feed snapshot of 18 Oct 2026 (6,031 stations). A register station counts as "in the feed" if a feed station lies within 50 m.
- Result: 51% overall (57% within 100 m, 69% within 250 m). The v1 record gives 47% with its own matching.
- This is a lower bound: the snapshot is one day, and the full-year list (8,189 stations) has no coordinates on the checked machine.

## What is underrepresented

| # | Underrepresented | Evidence | Status |
|---|---|---|---|
| 1 | **Small operators** (1–2 register stations) | 15% in feed, against 69% for operators with 200+. They are 8.5% of register stations but 0.6% of feed stations (48 of 8,189). 1,861 operators in the register, 152 in the feed | measured |
| 2 | **Municipal and Stadtwerke points without a feed route** | All or nothing: Stuttgart 91%, Heidelberg 97%, Konstanz 98%; but SWU 0%, Sindelfingen 0%, Schwäbisch Gmünd 0%, Weinstadt 0%, Mühlacker 7%, Oberkirch 8% | measured |
| 3 | **Slow AC points (≤ 22 kW)** | 36% in feed, against 61% (22–50 kW) and 68% (> 50 kW) | measured |
| 4 | **Cause of 1–3** | The AFIR duty to publish real-time data (since 14 Apr 2025, per one vendor source) seems not to reach the feed for these operators. Either they don't deliver, or their platform isn't ingested | inferred |
| 5 | **Public points missing from the register itself** | Normal points commissioned before 17 Mar 2016 (or 14 Jun 2017, sources conflict), points up to 3.7 kW, and notifications still in processing | BNetzA statements, not measured on our data |
| 6 | **Rural and small-town points** | Not shown. Postal-code counts are confounded by station granularity | untested |
| 7 | **Stations dropped by the ≥ 14 valid-days filter** (8,189 → 5,069) | Unknown which operators and regions are lost | untested |

## Consequences for v1

- The model learns usage of **large networks and platform-connected utilities**. Small municipal points are barely in training or validation.
- The operator feature (6 groups) cannot represent operators that have no feed rows. Marginalizing over the training operator mix hides the gap instead of showing it.
- Spatial CV and the new-site test measure agreement within the feed, not coverage of the register.
- A missing station in the feed does not mean low demand. Do not treat it as zero.

## To do

- Say in the presentation: "observed usage covers about half of register stations, favouring large operators and fast charging".
- Redo the check with full-year coordinates (weekly parquet files) and report coverage per Kreis.
- Report validation metrics by operator group and size class.
- Extend the "Low confidence" warning to candidates near operator types absent from the feed.
- Check items 6 and 7.
