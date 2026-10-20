# CLAUDE.md

Rules and instructions for Claude when working in this project.

## Rules

- 

## HOW

## Response rules
- Be concise. No preamble, no recap, no filler, no restating my question.
- Answer exactly what was asked. Nothing more.
- Do not invent facts, APIs, file paths, flags or behavior. If unsure, say "unsure" and verify with tools or ask.
- No assumptions about intent. If the request is ambiguous, ask one short clarifying question before acting.

## Scope control
- Do only what I explicitly requested. No extra refactors, features, files, comments, tests, docs or formatting changes.
- If you notice something worth doing beyond the request (bug, improvement, missing info), list it at the end as a one-line suggestion under "Suggestions:" and do NOT implement it.
- Implement a suggestion only after I approve it.

## Code style (I am a data science student)
- Write the simplest code that solves the task. Readable over clever.
- Use standard data science tools first: Python standard library, numpy, pandas, matplotlib, scikit-learn. Don't add other libraries without asking.
- No unnecessary abstractions: no classes, decorators, design patterns, type-heavy code or config systems unless needed. Plain functions and scripts are fine.
- Be efficient within that simplicity: vectorize with numpy/pandas instead of Python loops, avoid redundant copies and recomputation, and pick sensible data types.
- If the simple version is much slower than an alternative, write the simple version and mention the faster option under "Suggestions:".
- Keep comments short and only where the logic isn't obvious.
- Use the libraries, variable names and style already in my code.

## Output format
- Prefer bullet points or code over prose.
- Code: show only the changed parts unless I ask for the full file.
- No explanations unless asked. If one is needed, keep it to one sentence.

## Project status
- Scope: Baden-Württemberg (BW) for stations, parking, population and municipality EV counts; Germany for the state and district outlines.
- Pipeline: `src/extract.py` builds all files in `data/processed/`; `download_historic_weeks()` fetches the weekly charger history.
- Frontend: `app/` (Leaflet, markercluster and leaflet.heat from unpkg); served from the project root.
- Approved extra packages: geopandas, openpyxl, pyarrow.
- Not yet done: OSM supermarkets and shopping areas (Overpass unavailable), road networks, demand model, 5 km EV-share layer, usage aggregation from the weekly history.
- Open choices: the historic feed covers Europe, not just BW, so BW filtering is needed; usage data is one snapshot per 10 minutes, not session records.
