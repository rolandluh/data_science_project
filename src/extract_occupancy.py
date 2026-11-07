"""Daily occupancy of BW charging stations from the weekly MobiData BW history files.

The history stores one row per station status. At first every poll wrote a full snapshot of all
stations (about every 10 min). On 14 Aug 2026, 17:04 the feed switched to change-only deltas: only
stations whose status changed are written (about every 20 min). The switch is detected from the data
(the first snapshot with less than DELTA_ROW_SHARE of the rows of earlier snapshots). Averaging rows
would overweight busy stations after the switch. Instead each row is read as a status that holds
until the station's next row, and the time it holds is summed per station and hour:

- before the switch: a status holds until the next snapshot of the feed (absent from a full snapshot = no data)
- after the switch: a status holds until the station's next row, at most HOLD_DELTA (no row = unchanged)
- feed outages (no snapshot at all for more than OUTAGE_GAP) end every status, e.g. week 38

Rows from STATIC_SOURCES (BNetzA register dumps, one or two snapshots per week, no live status) are
dropped. Time counts as observed only while a station reports a live status (available + charging +
reserved > 0); stretches where all points are "unknown" (e.g. datex2_ecomovement in spring) are no data.

Occupancy = charging points / (available + charging + reserved points), time-weighted.
Out-of-order, inoperative and unknown points are left out of the denominator.
"""
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import pyarrow.parquet as pq

HIST_PARQUET_DIR = Path("data/processed/historie_parquet")
STATES_OUT = Path("data/processed/laender.geojson")
OCC_DAILY_OUT = Path("data/processed/auslastung_taeglich_bw.parquet")
OCC_STATIONS_OUT = Path("data/processed/auslastung_stationen_bw.parquet")
OCC_XLSX_OUT = Path("data/processed/auslastung_bw.xlsx")

TZ = "Europe/Berlin"
DELTA_ROW_SHARE = 0.25  # a snapshot with fewer rows than this share of the recent median is a delta
DELTA_WINDOW = 100  # snapshots in that recent median
STATIC_SOURCES = {"bnetza_api"}
HOLD_DELTA = pd.Timedelta(hours=72)
OUTAGE_GAP = pd.Timedelta(minutes=60)
OUTAGE_TAIL = pd.Timedelta(minutes=20)  # last status before an outage still counts for one poll
MIN_COVERAGE = 0.75  # a station-day counts as valid with at least 18 h of data
MIN_HOUR_OBS = 0.5  # an hour counts for the peak with at least 30 min of data
NO_END = 2**62  # "no next row / no outage" (far future, safe to add seconds to)

COUNTS = {
    "chargepoint_available_count": "available",
    "chargepoint_charging_count": "charging",
    "chargepoint_reserved_count": "reserved",
}
META = ["name", "operator_name", "city", "postal_code", "max_electric_power"]
READ_COLUMNS = ["id", "source", "datastore_updated_at", "geometry", *COUNTS, *META]


def _bw_flags(ids, geometries, bw):
    # Geometry is WKT; the axis order differs between sources, so take latitude as the larger number in Germany
    xy = geometries.str.extract(r"POINT \(([-\d.]+) ([-\d.]+)\)").astype(float)
    lat, lon = xy.max(axis=1), xy.min(axis=1)
    points = gpd.GeoDataFrame({"id": ids.values}, geometry=gpd.points_from_xy(lon, lat), crs="EPSG:4326")
    inside = gpd.sjoin(points, bw, predicate="within")["id"]
    return dict.fromkeys(ids, False) | dict.fromkeys(inside, True)


def _read_week(path, in_bw, meta, bw, snapshot_rows):
    """BW status rows of one weekly file; updates the BW lookup, station metadata and feed timestamps."""
    frames = []
    for batch in pq.ParquetFile(path).iter_batches(batch_size=2_000_000, columns=READ_COLUMNS):
        df = batch.to_pandas()
        df = df[~df["source"].isin(STATIC_SOURCES)]
        for stamp, count in df["datastore_updated_at"].value_counts().items():
            snapshot_rows[stamp] = snapshot_rows.get(stamp, 0) + count
        new = df.drop_duplicates("id")
        new = new[~new["id"].isin(in_bw.keys())]
        if len(new):
            in_bw.update(_bw_flags(new["id"], new["geometry"], bw))
        df = df[df["id"].map(in_bw)]
        meta.update(df.drop_duplicates("id", keep="last").set_index("id")[META].to_dict("index"))
        frames.append(df[["id", "datastore_updated_at", *COUNTS]])
    df = pd.concat(frames, ignore_index=True)
    stamps = df["datastore_updated_at"].unique()
    df["ts"] = df["datastore_updated_at"].map(dict(zip(stamps, pd.to_datetime(stamps, format="ISO8601", utc=True))))
    df = df.rename(columns=COUNTS).drop(columns="datastore_updated_at")
    df[list(COUNTS.values())] = df[list(COUNTS.values())].apply(pd.to_numeric, errors="coerce").fillna(0).astype("int32")
    return df.drop_duplicates(["id", "ts"])


def _seconds(values):
    return pd.to_datetime(values, utc=True).values.astype("datetime64[s]").astype(np.int64)


def _hourly(rows, feed, outage_starts, delta_from, feed_end, final):
    """Split each status interval at hour boundaries and sum its seconds per station and hour.

    Returns the hourly sums and the rows whose status may continue into the next file
    (only when final is False; their time is counted when the next file is read).
    """
    rows = rows.sort_values(["id", "ts"]).reset_index(drop=True)
    same_next = rows["id"].eq(rows["id"].shift(-1)).values
    start = _seconds(rows["ts"])
    next_ts = np.where(same_next, np.roll(start, -1), NO_END)
    # Next snapshot is a full one: the status ends there. Next snapshot is a delta: it holds up to HOLD_DELTA.
    next_snapshot = np.append(feed, NO_END)[np.searchsorted(feed, start, side="right")]
    limit = np.where(next_snapshot >= delta_from, start + int(HOLD_DELTA.total_seconds()), next_snapshot)
    # First feed outage at or after the status starts
    pos = np.searchsorted(outage_starts, start, side="left")
    outage = np.append(outage_starts, NO_END)[pos] + int(OUTAGE_TAIL.total_seconds())
    end = np.minimum.reduce([next_ts, limit, outage])
    if final:
        end = np.minimum(end, feed_end)
        carry = np.zeros(len(rows), dtype=bool)
    else:
        # A station's last row whose hold reaches past the end of this file continues in the next file
        carry = ~same_next & (end > feed_end)

    # Session starts: rises in the charging count between consecutive rows of a station
    rise = rows["charging"].diff().where(rows["id"].eq(rows["id"].shift())).clip(lower=0).fillna(0)
    starts = pd.DataFrame({"id": rows["id"], "hour": start // 3600 * 3600, "session_starts": rise.values})

    carried = rows[carry]
    keep = (end > start) & ~carry
    start, end, rows = start[keep], end[keep], rows[keep].reset_index(drop=True)

    first_hour = start // 3600 * 3600
    pieces = ((end - 1) // 3600 * 3600 - first_hour) // 3600 + 1
    idx = np.repeat(np.arange(len(rows)), pieces)
    hour = first_hour[idx] + 3600 * (np.arange(len(idx)) - np.repeat(np.cumsum(pieces) - pieces, pieces))
    seconds = np.minimum(end[idx], hour + 3600) - np.maximum(start[idx], hour)
    points = (rows["available"] + rows["charging"] + rows["reserved"]).values[idx]
    # Time without a live status (all points unknown, out of order, ...) is not observed
    out = pd.DataFrame({
        "id": rows["id"].values[idx],
        "hour": hour,
        "obs_s": seconds * (points > 0),
        "charging_ps": rows["charging"].values[idx] * seconds,
        "capacity_ps": points * seconds,
    })
    out = out.groupby(["id", "hour"], as_index=False).sum()
    starts = starts.groupby(["id", "hour"], as_index=False)["session_starts"].sum()
    out = out.merge(starts, on=["id", "hour"], how="outer").fillna(0)
    return out, carried


def _daily(hourly):
    local = pd.to_datetime(hourly["hour"], unit="s", utc=True).dt.tz_convert(TZ)
    hourly = hourly.assign(date=local.dt.date)
    hour_occ = (hourly["charging_ps"] / hourly["capacity_ps"]).where(
        (hourly["obs_s"] >= MIN_HOUR_OBS * 3600) & (hourly["capacity_ps"] > 0)
    )
    hourly = hourly.assign(hour_occ=hour_occ)
    day = hourly.groupby(["id", "date"]).agg(
        obs_s=("obs_s", "sum"),
        charging_ps=("charging_ps", "sum"),
        capacity_ps=("capacity_ps", "sum"),
        session_starts=("session_starts", "sum"),
        peak_hour_occupancy=("hour_occ", "max"),
    ).reset_index()
    day["observed_hours"] = day["obs_s"] / 3600
    day["coverage"] = (day["observed_hours"] / 24).clip(upper=1)
    day["charging_point_hours"] = day["charging_ps"] / 3600
    day["capacity_point_hours"] = day["capacity_ps"] / 3600
    day["mean_points"] = day["capacity_ps"] / day["obs_s"].where(day["obs_s"] > 0)
    day["occupancy"] = day["charging_ps"] / day["capacity_ps"].where(day["capacity_ps"] > 0)
    # Charging point-hours scaled to a full day, so days with gaps stay comparable
    day["charging_point_hours_24h"] = day["charging_point_hours"] / day["coverage"].where(day["coverage"] > 0)
    day["valid"] = day["coverage"] >= MIN_COVERAGE
    return day.drop(columns=["obs_s", "charging_ps", "capacity_ps"])


def save_daily_occupancy(weeks=None, out=OCC_DAILY_OUT):
    """Build daily occupancy per BW station; weeks and out can be set for a test run on a few files."""
    if out.exists():
        print(f"{out} already exists, skipping")
        return
    weeks = weeks or sorted(HIST_PARQUET_DIR.glob("*.parquet"))
    if not weeks:
        raise FileNotFoundError(f"no weekly history files in {HIST_PARQUET_DIR}")
    states = gpd.read_file(STATES_OUT)
    bw = states[states["AGS"] == "08"][["geometry"]].to_crs("EPSG:4326")

    in_bw, meta, snapshot_rows = {}, {}, {}
    delta_from = NO_END
    carry_rows, carry_hours, days = None, None, []
    for i, path in enumerate(weeks):
        final = i == len(weeks) - 1
        rows = _read_week(path, in_bw, meta, bw, snapshot_rows)
        if carry_rows is not None:
            rows = pd.concat([carry_rows, rows], ignore_index=True)
        snapshots = pd.Series(snapshot_rows)
        snapshots.index = _seconds(pd.to_datetime(snapshots.index, format="ISO8601", utc=True))
        snapshots = snapshots.groupby(level=0).sum().sort_index()
        feed = snapshots.index.values
        if delta_from == NO_END:
            recent = snapshots.rolling(DELTA_WINDOW, min_periods=10).median().shift()
            small = snapshots < DELTA_ROW_SHARE * recent
            if small.any():
                delta_from = int(snapshots.index[small.values.argmax()])
                print(f"change-only deltas from {pd.Timestamp(delta_from, unit='s', tz='UTC').tz_convert(TZ)}")
        outage_starts = feed[:-1][np.diff(feed) > OUTAGE_GAP.total_seconds()]
        feed_end = feed[-1] + int(OUTAGE_TAIL.total_seconds()) if final else feed[-1]
        hourly, carry_rows = _hourly(rows, feed, outage_starts, delta_from, feed_end, final)
        if carry_hours is not None:
            hourly = pd.concat([carry_hours, hourly]).groupby(["id", "hour"], as_index=False).sum()
        # Days touched by carried rows are still open: their hours grow with the next file
        local_day = pd.to_datetime(hourly["hour"], unit="s", utc=True).dt.tz_convert(TZ).dt.date
        if final:
            open_from = None
        else:
            open_from = min(
                pd.to_datetime(carry_rows["ts"], utc=True).dt.tz_convert(TZ).dt.date.min(),
                local_day.max(),
            )
        done = hourly if final else hourly[local_day < open_from]
        carry_hours = None if final else hourly[local_day >= open_from]
        days.append(_daily(done))
        print(f"{path.stem}: {sum(in_bw.values())} BW stations so far, {len(done)} station-hours closed")

    daily = pd.concat(days, ignore_index=True)
    # The tail after the last snapshot can reach past midnight; drop that stray day
    last_day = pd.Timestamp(int(feed[-1]), unit="s", tz="UTC").tz_convert(TZ).date()
    daily = daily[daily["date"] <= last_day]
    assert not daily.duplicated(["id", "date"]).any(), "a station-day was closed twice"
    daily["date"] = pd.to_datetime(daily["date"])
    daily["iso_week"] = daily["date"].dt.strftime("%G-W%V")
    daily["weekday"] = daily["date"].dt.day_name()
    daily["weekend"] = daily["date"].dt.dayofweek >= 5
    daily.to_parquet(out, index=False)

    stations = pd.DataFrame.from_dict(meta, orient="index").rename_axis("id").reset_index()
    switch = pd.Timestamp(delta_from, unit="s", tz="UTC").tz_convert(TZ) if delta_from != NO_END else None
    stations.attrs["delta_from"] = str(switch)
    stations.to_parquet(OCC_STATIONS_OUT, index=False)
    print(f"{len(daily)} station-days ({daily['valid'].sum()} valid) for {daily['id'].nunique()} stations saved to {out}")


# ---------------------------------------------------------------------------
# Excel report
# ---------------------------------------------------------------------------
FONT = "Arial"


def _style_table(ws, n_rows, widths, formats):
    """Header style, column widths, number formats, frozen header and filter for a table starting in A1."""
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter

    header_fill = PatternFill("solid", fgColor="1F2937")
    for col, width in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(col)].width = width
        cell = ws.cell(row=1, column=col)
        cell.font = Font(name=FONT, bold=True, color="FFFFFF")
        cell.fill = header_fill
        cell.alignment = Alignment(wrap_text=True, vertical="center")
        fmt = formats.get(col)
        for row in range(2, n_rows + 2):
            data = ws.cell(row=row, column=col)
            data.font = Font(name=FONT)
            if fmt:
                data.number_format = fmt
    ws.row_dimensions[1].height = 45
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(widths))}{n_rows + 1}"


def _color_scale(ws, ref):
    from openpyxl.formatting.rule import ColorScaleRule

    ws.conditional_formatting.add(ref, ColorScaleRule(
        start_type="num", start_value=0, start_color="F0FDFA",
        mid_type="percentile", mid_value=50, mid_color="5EEAD4",
        end_type="percentile", end_value=98, end_color="0F766E",
    ))


def _occupancy(table, keys):
    """Time-weighted occupancy per group: charging point-hours / available point-hours."""
    sums = table.groupby(keys)[["charging_point_hours", "capacity_point_hours"]].sum()
    return sums["charging_point_hours"] / sums["capacity_point_hours"].where(sums["capacity_point_hours"] > 0)


def save_occupancy_workbook():
    if OCC_XLSX_OUT.exists():
        print(f"{OCC_XLSX_OUT} already exists, skipping")
        return
    from openpyxl import Workbook
    from openpyxl.chart import LineChart, Reference
    from openpyxl.styles import Font
    from openpyxl.utils import get_column_letter

    def clean(value):
        return None if pd.isna(value) else value

    daily = pd.read_parquet(OCC_DAILY_OUT)
    stations = pd.read_parquet(OCC_STATIONS_OUT)
    switch = stations.attrs.get("delta_from") or "the switch to change-only deltas"
    valid = daily[daily["valid"]]

    # Network-wide sums per day over valid station-days; ratios are formulas in the sheet
    per_day = daily.groupby("date").agg(stations=("id", "size")).join(
        valid.groupby("date").agg(
            valid_days=("id", "size"),
            charging_h=("charging_point_hours", "sum"),
            capacity_h=("capacity_point_hours", "sum"),
            sessions=("session_starts", "sum"),
            peak=("peak_hour_occupancy", "mean"),
        )
    ).reset_index()
    per_day[["valid_days", "charging_h", "capacity_h", "sessions"]] = per_day[["valid_days", "charging_h", "capacity_h", "sessions"]].fillna(0)

    wb = Workbook()
    readme = wb.active
    readme.title = "Read me"

    # Daily: A date ... I session starts (values), J-L ratios (formulas), M mean peak (value)
    ws = wb.create_sheet("Daily")
    ws.append(["Date", "Weekday", "ISO week", "Weekend", "Stations reporting", "Valid station-days",
               "Charging point-hours", "Available point-hours", "Session starts", "Occupancy",
               "Charging point-hours per station-day", "Session starts per station-day", "Mean peak-hour occupancy"])
    for r in per_day.itertuples(index=False):
        row = ws.max_row + 1
        date = pd.Timestamp(r.date)
        ws.append([
            date.to_pydatetime(), date.day_name(), date.strftime("%G-W%V"), "yes" if date.dayofweek >= 5 else "no",
            int(r.stations), int(r.valid_days), float(r.charging_h), float(r.capacity_h), float(r.sessions),
            f'=IF(H{row}>0,G{row}/H{row},"")',
            f'=IF(F{row}>0,G{row}/F{row},"")',
            f'=IF(F{row}>0,I{row}/F{row},"")',
            clean(r.peak),
        ])
    n_days = len(per_day)
    _style_table(ws, n_days, [12, 11, 10, 9, 11, 11, 13, 13, 11, 11, 14, 13, 13],
                 {1: "yyyy-mm-dd", 5: "#,##0", 6: "#,##0", 7: "#,##0", 8: "#,##0", 9: "#,##0",
                  10: "0.0%", 11: "0.0", 12: "0.0", 13: "0.0%"})
    chart = LineChart()
    chart.title = "Daily occupancy, all BW stations in the feed"
    chart.y_axis.title = "Occupancy"
    chart.y_axis.number_format = "0%"
    chart.x_axis.number_format = "dd.mm"
    chart.height, chart.width = 9, 26
    chart.add_data(Reference(ws, min_col=10, min_row=1, max_row=n_days + 1), titles_from_data=True)
    chart.set_categories(Reference(ws, min_col=1, min_row=2, max_row=n_days + 1))
    chart.legend = None
    ws.add_chart(chart, "O2")

    # Weekly and weekday profile: SUMIFS over the Daily sheet
    last = n_days + 1

    def rng(col):
        return f"Daily!${col}$2:${col}${last}"

    weeks = sorted(per_day["date"].map(lambda d: pd.Timestamp(d).strftime("%G-W%V")).unique())
    weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    for title, label, key_col, keys in [("Weekly", "ISO week", "C", weeks), ("Weekday profile", "Weekday", "B", weekdays)]:
        sheet = wb.create_sheet(title)
        sheet.append([label, "Days", "Valid station-days", "Charging point-hours", "Available point-hours",
                      "Session starts", "Occupancy", "Charging point-hours per station-day",
                      "Session starts per station-day", "Mean stations reporting per day"])
        for key in keys:
            row = sheet.max_row + 1
            match = f"{rng(key_col)},A{row}"
            sheet.append([
                key,
                f"=COUNTIFS({match})",
                f"=SUMIFS({rng('F')},{match})",
                f"=SUMIFS({rng('G')},{match})",
                f"=SUMIFS({rng('H')},{match})",
                f"=SUMIFS({rng('I')},{match})",
                f'=IF(E{row}>0,D{row}/E{row},"")',
                f'=IF(C{row}>0,D{row}/C{row},"")',
                f'=IF(C{row}>0,F{row}/C{row},"")',
                f'=IF(B{row}>0,SUMIFS({rng("E")},{match})/B{row},"")',
            ])
        _style_table(sheet, len(keys), [14, 8, 13, 14, 14, 12, 11, 15, 14, 15],
                     {3: "#,##0", 4: "#,##0", 5: "#,##0", 6: "#,##0", 7: "0.0%", 8: "0.0", 9: "0.0", 10: "#,##0"})
        _color_scale(sheet, f"G2:G{len(keys) + 1}")

    # Stations: one row per station over its valid days
    per_station = valid.groupby("id").agg(
        valid_days=("date", "size"),
        points=("mean_points", "mean"),
        charging_h=("charging_point_hours", "sum"),
        capacity_h=("capacity_point_hours", "sum"),
        sessions=("session_starts", "mean"),
        peak=("peak_hour_occupancy", "mean"),
    )
    by_weekend = _occupancy(valid, ["id", "weekend"]).unstack()
    per_station["weekday_occ"] = by_weekend.get(False)
    per_station["weekend_occ"] = by_weekend.get(True)
    per_station = stations.set_index("id").join(per_station, how="right").reset_index()
    per_station["max_kw"] = pd.to_numeric(per_station["max_electric_power"], errors="coerce") / 1000
    per_station = per_station.sort_values("charging_h", ascending=False)

    st = wb.create_sheet("Stations")
    st.append(["Station ID", "Name", "Operator", "City", "Postal code", "Max power (kW)", "Valid days",
               "Mean available points", "Charging point-hours (total)", "Available point-hours (total)",
               "Occupancy", "Charging point-hours per day", "Occupancy weekdays", "Occupancy weekends",
               "Mean peak-hour occupancy", "Session starts per day"])
    for r in per_station.itertuples(index=False):
        row = st.max_row + 1
        st.append([r.id, clean(r.name), clean(r.operator_name), clean(r.city), clean(r.postal_code),
                   clean(r.max_kw), int(r.valid_days), clean(r.points), float(r.charging_h), float(r.capacity_h),
                   f'=IF(J{row}>0,I{row}/J{row},"")', f"=I{row}/G{row}",
                   clean(r.weekday_occ), clean(r.weekend_occ), clean(r.peak), clean(r.sessions)])
    n_st = len(per_station)
    _style_table(st, n_st, [11, 34, 24, 18, 10, 10, 8, 11, 13, 13, 11, 13, 12, 12, 12, 11],
                 {6: "0", 7: "0", 8: "0.0", 9: "#,##0", 10: "#,##0", 11: "0.0%", 12: "0.0",
                  13: "0.0%", 14: "0.0%", 15: "0.0%", 16: "0.0"})
    _color_scale(st, f"K2:K{n_st + 1}")

    # Station x week occupancy matrix
    weekly = _occupancy(valid, ["id", "iso_week"]).unstack().reindex(per_station["id"])
    names = per_station.set_index("id")
    sw = wb.create_sheet("Stations by week")
    sw.append(["Station ID", "Name", "City", *weekly.columns])
    for sid, values in weekly.iterrows():
        sw.append([sid, clean(names.at[sid, "name"]), clean(names.at[sid, "city"]), *[clean(v) for v in values]])
    n_weeks = weekly.shape[1]
    _style_table(sw, len(weekly), [11, 34, 18, *([9] * n_weeks)], {c: "0%" for c in range(4, 4 + n_weeks)})
    sw.freeze_panes = "D2"
    _color_scale(sw, f"D2:{get_column_letter(3 + n_weeks)}{len(weekly) + 1}")

    lines = [
        ("Occupancy of BW charging stations (MobiData BW history)", "title"),
        (f"Period: {per_day['date'].min():%d %b %Y} to {per_day['date'].max():%d %b %Y}. "
         f"Stations: {daily['id'].nunique():,}. Station-days: {len(daily):,}, of which {len(valid):,} valid.", None),
        ("", None),
        ("How the numbers are made", "head"),
        ("Each history row is a station status. It holds until the station's next row, so every minute is weighted the same.", None),
        (f"Before {switch} the feed wrote full snapshots: a status ends at the next snapshot (missing from it = no data).", None),
        (f"From {switch} the feed writes only changes: a status holds until the station's next change, at most {HOLD_DELTA.total_seconds() / 3600:.0f} h.", None),
        (f"Feed outages (no snapshot for more than {OUTAGE_GAP.total_seconds() / 60:.0f} min, e.g. week 38) end every status {OUTAGE_TAIL.total_seconds() / 60:.0f} min after the last snapshot.", None),
        ("Occupancy = charging point-hours / available point-hours. Available = available + charging + reserved points.", None),
        ("Out-of-order, inoperative and unknown points are not counted as available.", None),
        (f"A station-day is valid with at least {MIN_COVERAGE:.0%} of the day observed. All sums and averages use valid station-days only.", None),
        (f"Peak-hour occupancy: highest hourly occupancy of the day (hours with at least {MIN_HOUR_OBS * 60:.0f} min of data).", None),
        ("Session starts: rises in the number of charging points between two rows. A lower bound: short sessions between polls are missed.", None),
        ("", None),
        ("Sheets", "head"),
        ("Daily: one row per day over all BW stations in the feed, with a chart of occupancy.", None),
        ("Weekly / Weekday profile: formulas that add up the Daily sheet by ISO week and by weekday.", None),
        ("Stations: one row per station over the whole period, sorted by charging point-hours.", None),
        ("Stations by week: weekly occupancy per station (blank = no valid day that week).", None),
        ("", None),
        ("Limits", "head"),
        ("The feed covers only about a third of BW stations and favours larger networks.", None),
        (f"After the switch, a station without any update for more than {HOLD_DELTA.total_seconds() / 3600:.0f} h counts as no data, even if it was idle.", None),
        (f"Full table with one row per station and day: {OCC_DAILY_OUT.as_posix()}", None),
    ]
    for i, (text, kind) in enumerate(lines, start=1):
        readme.cell(row=i, column=1, value=text).font = Font(name=FONT, bold=kind is not None, size=14 if kind == "title" else 10)
    readme.column_dimensions["A"].width = 130

    wb.calculation.fullCalcOnLoad = True  # openpyxl stores no results; Excel computes them on open
    wb.save(OCC_XLSX_OUT)
    print(f"Workbook with {n_days} days and {n_st} stations saved to {OCC_XLSX_OUT}")
