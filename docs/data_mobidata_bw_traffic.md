# BW Traffic Volumes

## Overview

Average daily traffic (DTV) in 2024 at the counting sites on motorways, federal, state and county roads in Baden-Württemberg. Script: `save_traffic_counters()` in `src/extract_traffic.py`.

## Source

- **Counts:** `data/raw/verkehr/Test_Ergebnisse_2024_Excel.zip`, added by hand, with `BW_VM_2024_{A,B,K,L}_Zeilenformat.csv` and the legend `Legende_Zeilenformat_2024.pdf`. It has no download link in the pipeline, so the step is skipped when the file is missing.
- **Positions:** [SVZ station list](https://mobidata-bw.de/dataset/karte_strassenverkehrszaehlung), `SVZ-Zaehlstellen_2026-06-26_augmented_SVZ2024.csv`, stored as `data/raw/verkehr/svz_zaehlstellen.csv`. The tables have no coordinates, so `TKZST` is joined to `svznr`.

## Output

**`data/processed/verkehr_svz_bw.geojson`:** 5,638 counting sites, shown on the map as "Traffic counting sites".

## Limits

- **Missing positions:** 200 of the 5,838 sites have no entry in the SVZ station list and are left out.
- **Most values are not measured in 2024:** only 1,104 of the 5,838 sites were last counted in 2024. `Hr-Art` shows the calculation: `F` (carried forward, 4,539 of the mapped sites) or `H` (extrapolated from a count, 1,065). The popup shows both the year and the method.
- **Zeros mean no value:** they are stored as empty. 10 mapped sites have no 2024 traffic, all marked `Zählstelle inaktiv`.
- **Points, not a network:** counts exist only at the sites. Traffic between sites has to be estimated.
- **Legend errors:** it gives `Länge` in metres, but the values look like kilometres. It also appears to swap the time ranges of `md`, `me` and `mn`. None of these columns are used.
- **Node codes:** direction labels that are only network node codes, such as `8411015A`, are stored as empty.
