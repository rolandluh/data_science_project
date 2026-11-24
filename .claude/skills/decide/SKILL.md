---
name: decide
description: Run one structured decision round on an open methodological question of the EV charging analysis. Drafts options, gets an independent critique from the method-reviewer subagent, returns a short decision brief and updates the decision record. Use only when the user asks to decide something or runs /decide.
disable-model-invocation: true
---

# Decision round

Decision record: `notes and concepts/demand_estimation_v1.md` (status legend ✅ decided / ❓ uncertain / ⬜ unaddressed). Full reasoning lives in `notes and concepts/Analysis Q&A.md`: search it for the topic (grep), do not read it whole.

Usage: `/decide <question>` for one question. `/decide` with no argument: take up to 5 items from §11 (⬜ not yet addressed) of the record, most blocking first, and run steps 1–4 for each, batching the briefs. Never pick items from §10 (❓ uncertain) on your own: the user raises those manually, by naming them in the question.

## Scope guardrails (apply at every step)

The project has 3 students, about 8 weeks to the submission (22 Jan 2027), and also needs the app, automation, documentation and a video. Every method must be explainable by the team in a presentation.

- Default to the simpler option. Choose the more complex one only for a concrete, testable benefit. If two options are within noise, take the simpler.
- Prefer what is already in `requirements.txt` (pandas, geopandas, scikit-learn, etc.). Flag every new dependency.
- Anything beyond standard sklearn / geopandas methods, or adding more than about 2 days of work, goes to the user.
- Something that is nice to have goes into the Postponed list (§12 of `demand_estimation_v1.md`), not into v1.

## Steps

1. **Frame.** State the question in one line and find what the record and Q&A already say about it. If it is already decided there, say so and stop.
2. **Research, then options.** Only if the question involves a non-standard, contested or uncertain choice (standard textbook choices need no search), look for established practice: `literature/` first, then at most 2–3 targeted web searches (papers, official docs, reputable method sources). Draft 2–3 options and, for each non-standard claim give one supporting source with a link, or say "no source found". Mark anything from general knowledge as unverified. Then draft the options. For each: one-sentence plain-language description, effort (hours/days), new dependencies, what we lose if we choose the simpler one. Give a recommendation.
3. **Critique.** Delegate to the `method-reviewer` subagent. Give it the question, the options and the file paths (not your reasoning). Ask it to answer: (a) the strongest objection to the recommendation, (b) what is wrong or risky in the other options, (c) the simplest version that still answers the question and what it costs us, (d) is anything here over-engineered for the scope above? (e) which claims have no source, and does a quick check (at most 2 searches) support or contradict them? One round only.
4. **Reconcile.** Adopt or reject each objection with a reason. If the critic found a real flaw, change the recommendation.
5. **Brief.** Reply in at most about 150 words (links don't count):
   - **Decision:** one line.
   - **Recommendation:** one line + one sentence why.
   - **Strongest objection:** and how it was resolved.
   - **Evidence:** the key source(s) with links, or "unverified".
   - **Complexity:** effort and new dependencies, one line.
   - **Needs you:** only if it is high-stakes (expensive to undo, changes what we claim, affects grading, needs a new method or data). Otherwise write "none".
6. **Record.**
   - Low-stakes, reversible items from §11: move them to a new row in §10 with the chosen default and "default, veto welcome", and remove them from §11. Do not mark them ✅. Do not touch other §10 rows.
   - High-stakes items: wait for the user's answer, then write the ✅ entry in the matching section (decision, *Why*, *Limits*), update the "At a glance" table, and remove the item from §11 (or from §10, if the user named a §10 item).
   - Edit only the affected entries. Never rewrite the file, change other decisions, or alter the legend. Add no new sections.

Never mark something ✅ that the user has not agreed to.
