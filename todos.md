Compared with the outline, the pipeline already covers supply, population, EV counts, parking and usage. What's missing falls into three groups.

**Needed for the planned methods**
- **Roads and traffic:** the topic names road networks. The two options are the OSM road network via Overpass, which you already use for parking, or BKG DLM. For traffic volumes, the BW DTV counts from the Statistisches Landesamt BW (the StandortTOOL report cites them) or BASt counting stations. Traffic is the most useful proxy for en-route charging demand.
- **Newer or finer EV data:** the KBA municipality data is from Oct 2024. The 5 km EV-share grid is documented but not integrated yet. Integrate it, and look for a newer KBA edition.
- **Home charging proxy:** StandortTOOL corrects demand for missing private parking. The Zensus 2022 grid data may have building-type or ownership indicators (e.g. share of single-family homes). I haven't checked this. Check what Destatis offers at grid level.

**Needed for better demand modelling**
- **POIs:** shops, supermarkets, workplaces and tourist sites, taken from OSM. They show where people park for a longer time.
- **Employment / commuters:** workplace counts or commuter flows from the Bundesagentur für Arbeit. Population alone misses workplace demand.

**Needed for the budget constraint**
- **Costs:** cost per slow and fast charger, and grid connection cost. Grid-operator data is not open, so you'd need assumptions from literature, for example NOW studies. Document these as parameters.

**Validation**
- **Ground truth:** you can probably use `Inbetriebnahmedatum` in the register for a time split, with no new download. Check that enough stations were commissioned in 2025–2026.
- **Optional benchmark:** StandortTOOL demand values for BW municipalities, if they can be exported. I haven't checked.

My priority is roads/traffic, the 5 km EV grid and OSM POIs. The others can wait until a first scoring model exists.

## overall todos

**Data**
- Integrate the KBA 5 km EV grid.
- Add roads/traffic and OSM POIs (see the data section above).
- Update the VG250 boundaries, which are from 2020. Municipal mergers may break joins.
- Add a pipeline step that checks outputs and reports implausible values. The course requires automated validation.

**Model (the main gap, nothing exists yet)**
- Fixed grid and feature table: demand score, coverage gap, utilization.
- Weighted scoring model with the parking-space correction and fast/slow weights.
- DBSCAN and Moran's I as planned.
- Budget-constrained selection (greedy or MIP), since the topic asks for it.
- Write the model output as a GeoJSON/JSON file in `data/processed/`.

**Validation**
- Time split on `Inbetriebnahmedatum`: do recommendations match 2025–26 installations?
- Sensitivity of the weights.

**Map**
- Add a recommendation layer with a budget and weight control.
- Check usability for non-technical users.

**Course requirements**
- Automation: a single entry point that runs everything on new data, with error handling.
- Host the app on bwCloud.
- README with run order and architecture.
- 3-minute video, 3-sentence summary and final presentation.
- Per-person contributions (grading is individual), so keep a clear commit history.
- Prepare the interim presentation (plan and first steps), if it hasn't happened yet.
- Add the deadlines to this file. They are not known yet.
