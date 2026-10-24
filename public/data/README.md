# XAUUSD Daily Data

`XAUUSD_daily_real.csv` is a normalized copy of the public daily XAUUSD OHLCV dataset from:

https://raw.githubusercontent.com/FeziweMelvin/XAUUSD-Gold-Price/main/XAU_1d_data.csv

The source file was downloaded on 2026-09-16 and converted from semicolon-separated fields to the app's comma-separated upload format. It contains historical daily candles and is not a live feed; refresh it from the source when newer rows are required.

# XAUUSD 1H Data

`XAUUSD_1H_real.csv` is a normalized extract of the public MT5 historical archive from:

https://raw.githubusercontent.com/Gianniskas/mt5-m1-bars-us500-eurusd-xauusd/main/XAUUSD_h1.csv

The extract covers `2025-05-07` through `2025-06-05`, uses UTC timestamps, and contains real hourly OHLCV rows. It is historical data, not a live feed.

# XAUUSD 4H Data

`XAUUSD_4H_real.csv` is the public 4-hour OHLCV history from the same MT5 archive:

https://raw.githubusercontent.com/Gianniskas/mt5-m1-bars-us500-eurusd-xauusd/main/XAUUSD_h4.csv

It is loaded as the higher-timeframe context dataset while `XAUUSD_1H_real.csv` remains the lower-timeframe execution timeline.

# SBI (SBIN.NS) Intraday Data

`SBIN_15M_real.csv`, `SBIN_1H_real.csv`, and `SBIN_4H_real.csv` contain real SBI
(`SBIN.NS`) OHLCV data for the latest 30-day Yahoo Finance chart window
available when the fixtures were downloaded: `2026-09-09` through `2026-10-23`.
The source is:

https://query1.finance.yahoo.com/v8/finance/chart/SBIN.NS?range=30d&interval=15m&events=history

The 15-minute file contains the source bars. The 1-hour and 4-hour files are
OHLCV aggregations of those same bars, grouped from the NSE session open in
each trading day. Timestamps are stored as ISO-8601 UTC values; SBI trades on
the NSE in IST (UTC+05:30). These are fixtures, not a live market feed.
