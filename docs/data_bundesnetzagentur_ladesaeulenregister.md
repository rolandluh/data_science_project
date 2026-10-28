# Bundesnetzagentur Ladesäulenregister

## Overview

Official register of all public EV charging stations in Germany, maintained by the Federal Network Agency (Bundesnetzagentur).

## Source

- **URL:** https://data.bundesnetzagentur.de/Bundesnetzagentur/DE/Fachthemen/ElektrizitaetundGas/E-Mobilitaet/Ladesaeulenregister_BNetzA_2026-09-01.csv
- **License:** Open data (Bundesnetzagentur)
- **Date:** 1 September 2026
- **Format:** CSV (semicolon-separated, UTF-8 with BOM, 10 header comment lines)

## Contents

| Field | Description |
|---|---|
| Rows | 116,443 (Germany-wide), 18,863 in Baden-Württemberg |
| Columns | 47 |
| Key fields | Ladeeinrichtungs-ID, Betreiber, Status, Anzahl Ladepunkte, Nennleistung [kW], Inbetriebnahmedatum, Postleitzahl, Ort, Bundesland, Breitengrad, Längengrad |
| Connector details | Up to 6 connectors per station (Steckertypen, Nennleistung, EVSE-ID, Public Key) |

## Notes

- Coordinates use comma as decimal separator (German locale)
- Public Key columns are dropped in processing (cryptographic strings, not useful for the map)
- Filtered to `Bundesland == "Baden-Württemberg"` in the pipeline
- Processed output: `data/processed/ladesaeulen.json` (10.1 MB, columnar format)

## Usage in project

Primary source for the static charging station layer on the map. Provides station locations, operator names, power ratings, connector types, and commissioning dates.
