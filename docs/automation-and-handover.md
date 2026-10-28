# Automation, ML, and team handover

## What changed

This project remains a static Leaflet web application. We deliberately did not
add FastAPI or a database because the current map data is about 44 MB and does
not need that complexity.

We added a repeatable pipeline:

```text
Public data sources
        |
        v
src.extract (refresh selected source files)
        |
        v
src.validate (schema, coordinate, and GeoJSON checks)
        |
        v
data/processed/update_status.json
        |
        v
Leaflet map shows the validation time and ML status
```

The pipeline is run with:

```powershell
python -m src.run_pipeline
```

Use this for a weekly refresh:

```powershell
python -m src.run_pipeline --refresh --history
```

`--refresh` updates the configured changing source files. It automatically
discovers the newest official Bundesnetzagentur CSV link, then refreshes the
MobiData parking feed. `--history` fetches only one current weekly historic
download rather than the full Europe-wide archive. The pipeline keeps the
processed Baden-Wurttemberg history snapshots in
`data/processed/history/YYYY-Www.geojson`.

No API key is needed for these public sources. `CHARGERS_URL` is optional and
should only be set when the team intentionally wants to pin a specific official
charger-register release instead of discovering the newest one.

## What is automated

- Re-download of the configured charger register and MobiData parking feed.
- Optional one-week historic status download.
- Processing of the current Baden-Wurttemberg historic status layer.
- A weekly training-history archive for ML.
- Validation that every required processed file exists and parses correctly.
- Validation of charger columns and Baden-Wurttemberg coordinate bounds.
- Validation of population rows and GeoJSON feature collections.
- A public update report in `data/processed/update_status.json`.
- A map header that reports the data-check time and ML readiness.

If an update fails, the command exits with an error and the team should inspect
the output before publishing it. Do not replace the hosted map files with an
unvalidated run.

## ML plan: do not train too early

There is no ML model in the repository yet. One historic status snapshot is not
enough to train or validate a credible utilisation model.

The pipeline now reports `ML: collecting_history` until at least four weekly
snapshots have been archived. Four weeks is only the minimum to start feature
engineering; collect more weeks whenever possible.

After enough history has been collected, the next implementation should be:

1. Build one row per station and week.
2. Define utilisation as charging charge points divided by known charge points.
3. Add features: nearby population, BEV/PHEV ownership, parking capacity,
   nearby charger supply, technology, and grid proximity.
4. Compare a transparent rule-based baseline with a scikit-learn gradient
   boosting model.
5. Split validation data by district and time, not by random rows.
6. Save `model.joblib`, `metrics.json`, `feature_columns.json`, the input-data
   version, and `recommendations.geojson`.

The trained model and its predictions can be loaded from files by the static
map. The website does not need the entire historical training dataset at
runtime, but the team must retain it in shared storage for reproducibility and
future retraining.

## API keys

No API key is currently configured in this repository, and none of the current
data-source requests sends an authentication header. The sources are:

| Source in this project | Needs a key? | Can the pipeline pull it automatically? | Practical rule |
| --- | --- | --- | --- |
| Bundesnetzagentur charger-register CSV | No | Yes, monthly | The pipeline discovers the CSV link from the official download page. Set `CHARGERS_URL` only to pin a specific release. |
| MobiData BW parking WFS | No | Yes | Use the existing WFS request in the weekly pipeline. |
| MobiData BW weekly historic status file | No | Yes | Fetch only one new week, then keep the Baden-Wurttemberg subset for ML. |
| BKG VG250 boundaries | No | Yes | Refresh only when an annual/official boundary release is needed. |
| Destatis Zensus population grid | No | Yes | This is a census snapshot; refresh only after a new official release. |
| KBA EV ownership spreadsheets | No | Yes | Refresh when KBA publishes a new table. |
| Overpass / OSM grid query | No on the current public endpoint | Technically yes, but not frequently | Cache it and do not make large statewide requests on every scheduled run. Use a regional OSM extract if this becomes regular. |
| OpenStreetMap map tiles | No | Yes, in the visitor's browser | Keep attribution and caching. For high public traffic, use a proper tile provider or host tiles. |

An API key does not make a public API more automatic. It only authenticates the
request, and often gives a higher quota or access to paid features.

If the team adds a key-protected API later:

- Put the key in a local `.env` file or server environment variable.
- Keep `.env` in `.gitignore`.
- Never put a key in `app.js`, HTML, a committed Python file, screenshots, or
  the project documentation.
- A browser-visible key is not a secret. Call a key-protected API only from a
  server-side scheduled Python process.

The exact API provider and intended data are needed before adding code that
uses an API key.

## Schedule the automatic update

The Python code is ready for automation, but a scheduler must start it. Do not
run it from the map page. Run the following command once a week on the computer
or bwCloud server that hosts the project:

```powershell
C:\Users\apexp\anaconda3\python.exe -m src.run_pipeline --refresh --history
```

In Windows Task Scheduler, create a weekly task with:

```text
Program/script: C:\Users\apexp\anaconda3\python.exe
Arguments: -m src.run_pipeline --refresh --history
Start in: C:\Users\apexp\Desktop\data_science_project
```

On a Linux/bwCloud server, schedule the equivalent command with cron or a
systemd timer. The task should run before the static site is published. If it
returns an error, retain the previous valid map files and inspect the validation
report rather than publishing the failed update.

## Team workflow

The three team members should share data through DVC with a shared storage
location, not by manually copying folders. GitHub stores code and documentation;
DVC stores ignored raw data, processed data, and later model artifacts.

Normal local workflow:

```powershell
git pull
dvc pull
python -m src.run_pipeline
python -m http.server 8000
```

For deployment, run the weekly refresh on the bwCloud host with a scheduler,
then publish the newly validated `data/processed/` files beside the static app.
The app must not start a download or model training process when a visitor
opens it.

## Short message for teammates

> I added a one-command data pipeline that refreshes the configured public
> sources, validates all map files, records the update status, and displays the
> check time in the web map. I also added weekly historic-data archiving for the
> future ML model. The project remains static because the current dataset is
> small; we will add a database or FastAPI only if the app later needs live
> queries or on-demand recommendation calculations.

## Push checklist

Before pushing this change:

```powershell
git status
git add README.md app src docs/automation-and-handover.md
git commit -m "Add automated public-data refresh and ML readiness checks"
git push
```

Do not add `data/`, `.env`, model files, or any API key to Git. Those files are
intentionally ignored and should be shared through the team's data storage.
