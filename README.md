# US Farmers

Interactive map of US cattle farmers, ranches, and agricultural data — built entirely with **real USDA data**.

## Features

**8 Tabs of Real Data:**

| Tab | Description | Source |
|-----|-------------|--------|
| **Inventory** | 3,039 counties with cattle inventory, sold counts, farm operations | USDA Census of Agriculture 2022 |
| **Dealers** | 3,847 USDA-registered livestock dealers & market agencies | USDA AMS Packers & Stockyards |
| **Historic** | 1,537 historic homesteads, ranches & farms | National Park Service NRHP |
| **Prices** | Weekly 5-area weighted average cattle prices & daily slaughter data | USDA AMS LMR Datamart API |
| **Auctions** | 22 USDA-reported livestock auction markets with live countdown timers | USDA AMS Auction Reports |
| **Flows** | Interstate cattle purchasing flows (cow-calf to feedlot) | USDA Census 2022 ratios |
| **Trends** | Agricultural stocks, dairy/beef/pork commodity prices, production regions | USDA MPR Datamart, Yahoo Finance |
| **For Sale** | 700+ farm/ranch/homestead property listings with prices | Redfin |

## Tech Stack

- **Leaflet.js** + OpenStreetMap (no API keys needed)
- **Vanilla HTML/CSS/JS** — no build tools, no frameworks
- **Python** data fetchers for CORS-restricted APIs
- Served via any static file server

## Quick Start

```bash
# Start the local server
python3 -m http.server 8080

# Open in browser
open http://localhost:8080
```

## Refresh Live Data

```bash
# Refresh commodity prices & stock quotes
python3 fetch_trends.py

# Refresh property listings
python3 fetch_listings.py
```

## Data Sources

All data is real and sourced from US government agencies:

- **USDA NASS** — Census of Agriculture 2022 (county-level cattle inventory)
- **US Census Bureau** — 2023 Gazetteer (county coordinates)
- **USDA AMS** — Livestock Mandatory Reporting Datamart API (live prices)
- **USDA AMS** — MPR Datamart (dairy, beef, pork commodity prices)
- **USDA AMS** — Packers & Stockyards Division (registered dealers)
- **National Park Service** — National Register of Historic Places
- **Yahoo Finance** — Agricultural stock quotes (TSN, CALM, PPC, BG, ADM, INGR)
- **Redfin** — Farm/ranch/homestead property listings

## License

Data is from public US government sources. Code is open source.
