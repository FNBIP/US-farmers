#!/usr/bin/env python3
"""
Fetch trends data for the US Cattle Farmers Map — News/Trends & Stock Market tab.

Data sources (all free, no auth):
  1. USDA AMS MPR Datamart — dairy (butter, cheese), beef cutout, pork cutout prices
  2. Yahoo Finance — agricultural stock quotes (TSN, CALM, PPC, BG, ADM, INGR)
  3. USDA reports list — recent market report titles as news

Run: python3 fetch_trends.py
Output: trends.js
"""

import json
import urllib.request
import urllib.error
from datetime import datetime

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

def fetch_json(url, label=""):
    """Fetch JSON from a URL, return parsed data or None on error."""
    print(f"  Fetching {label or url[:80]}...")
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print(f"    ✓ Got response")
            return data
    except Exception as e:
        print(f"    ✗ Error: {e}")
        return None


def fetch_usda_dairy():
    """Fetch dairy prices: butter and cheddar cheese from USDA National Dairy Products Sales Report."""
    results = []

    # Butter prices
    url = "https://mpr.datamart.ams.usda.gov/services/v1.1/reports/2993/Butter%20Prices%20and%20Sales"
    data = fetch_json(url, "USDA Dairy — Butter")
    if data and isinstance(data, dict) and "results" in data:
        items = data["results"]
        # Get latest 4 weeks only
        seen_dates = set()
        for item in items:
            d = item.get("week_ending_date", "")
            if d and d not in seen_dates and len(seen_dates) < 4:
                seen_dates.add(d)
                results.append({
                    "product": "Butter",
                    "weekEnding": d,
                    "price": item.get("Butter_Price", ""),
                    "sales": item.get("Butter_Sales", ""),
                    "unit": "$/lb",
                })

    # Cheddar cheese prices
    url = "https://mpr.datamart.ams.usda.gov/services/v1.1/reports/2993/40%20Pound%20Block%20Cheddar%20Cheese%20Prices%20and%20Sales"
    data = fetch_json(url, "USDA Dairy — Cheddar Cheese")
    if data and isinstance(data, dict) and "results" in data:
        items = data["results"]
        seen_dates = set()
        for item in items:
            d = item.get("week_ending_date", "")
            if d and d not in seen_dates and len(seen_dates) < 4:
                seen_dates.add(d)
                results.append({
                    "product": "Cheddar Cheese (40lb Block)",
                    "weekEnding": d,
                    "price": item.get("cheese_40_Price", ""),
                    "sales": item.get("cheese_40_Sales", ""),
                    "unit": "$/lb",
                })

    return results


def fetch_usda_beef():
    """Fetch boxed beef cutout values from USDA daily report."""
    url = "https://mpr.datamart.ams.usda.gov/services/v1.1/reports/2453/Current%20Cutout%20Values"
    data = fetch_json(url, "USDA Beef — Daily Boxed Beef Cutout")
    if not data or not isinstance(data, dict):
        return []

    results = []
    items = data.get("results", [])
    seen = set()
    for item in items:
        d = item.get("report_date", "") or item.get("published_date", "")
        key = d[:10] if d else ""
        choice = item.get("choice_600_900_current", "")
        select = item.get("select_600_900_current", "")
        if key and key not in seen and len(seen) < 5 and (choice or select):
            seen.add(key)
            results.append({
                "product": "Boxed Beef Cutout",
                "date": key,
                "choicePrice": choice,
                "selectPrice": select,
                "unit": "$/cwt",
            })
    return results


def fetch_usda_pork():
    """Fetch pork cutout values from USDA daily report."""
    url = "https://mpr.datamart.ams.usda.gov/services/v1.1/reports/2498/Cutout%20and%20Primal%20Values"
    data = fetch_json(url, "USDA Pork — Daily Pork Cutout")
    if not data or not isinstance(data, dict):
        return []

    results = []
    items = data.get("results", [])
    seen = set()
    for item in items:
        d = item.get("report_date", "") or item.get("published_date", "")
        key = d[:10] if d else ""
        carcass = item.get("pork_carcass", "")
        if key and key not in seen and len(seen) < 5 and carcass:
            seen.add(key)
            results.append({
                "product": "Pork Cutout",
                "date": key,
                "carcassPrice": carcass,
                "loin": item.get("pork_loin", ""),
                "butt": item.get("pork_butt", ""),
                "rib": item.get("pork_rib", ""),
                "ham": item.get("pork_ham", ""),
                "belly": item.get("pork_belly", ""),
                "loads": item.get("total_loads_date_1", ""),
                "unit": "$/cwt",
            })
    return results


def fetch_stock_quote(symbol):
    """Fetch stock quote from Yahoo Finance v8 public API."""
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=5d"
    data = fetch_json(url, f"Stock: {symbol}")
    if not data:
        return None
    try:
        result = data["chart"]["result"][0]
        meta = result["meta"]
        price = meta.get("regularMarketPrice", 0)
        prev_close = meta.get("chartPreviousClose", meta.get("previousClose", price))
        change = round(price - prev_close, 2)
        change_pct = round((change / prev_close) * 100, 2) if prev_close else 0
        return {
            "price": round(price, 2),
            "previousClose": round(prev_close, 2),
            "change": change,
            "changePct": f"{'+' if change >= 0 else ''}{change_pct}%",
        }
    except (KeyError, IndexError, TypeError) as e:
        print(f"    ✗ Parse error for {symbol}: {e}")
        return None


def fetch_stocks():
    """Fetch quotes for major agricultural stocks."""
    stocks_info = [
        {"symbol": "TSN", "name": "Tyson Foods", "sector": "Meat Processing"},
        {"symbol": "CALM", "name": "Cal-Maine Foods", "sector": "Eggs"},
        {"symbol": "PPC", "name": "Pilgrim's Pride", "sector": "Poultry"},
        {"symbol": "BG", "name": "Bunge Global", "sector": "Ag Commodities"},
        {"symbol": "ADM", "name": "Archer-Daniels-Midland", "sector": "Ag Processing"},
        {"symbol": "INGR", "name": "Ingredion", "sector": "Ag Ingredients"},
    ]
    results = []
    for s in stocks_info:
        quote = fetch_stock_quote(s["symbol"])
        entry = {**s, "currency": "USD"}
        if quote:
            entry.update(quote)
        else:
            entry.update({"price": 0, "change": 0, "changePct": "N/A", "error": True})
        results.append(entry)
    return results


def fetch_usda_report_titles():
    """Fetch recent USDA report titles from MPR Datamart as news items."""
    url = "https://mpr.datamart.ams.usda.gov/services/v1.1/reports"
    data = fetch_json(url, "USDA Reports List")
    if not data or not isinstance(data, list):
        return []

    news = []
    # Keywords for livestock/agriculture reports we care about
    keywords = ["cattle", "beef", "dairy", "milk", "cheese", "butter", "pork", "hog",
                 "swine", "poultry", "broiler", "egg", "lamb", "livestock", "feeder",
                 "slaughter", "cutout", "5 area", "carcass"]
    for r in data:
        title = r.get("report_title", "")
        pub = r.get("published_date", "")
        slug = r.get("slug_id", "")
        if title and pub:
            lower = title.lower()
            if any(kw in lower for kw in keywords):
                # Clean up title — remove (PDF) and report codes
                clean = title
                if "(PDF)" in clean:
                    clean = clean.split("(PDF)")[0].strip()
                news.append({
                    "title": clean,
                    "date": pub[:10] if pub else "",
                    "source": "USDA AMS Market News",
                    "reportId": str(slug),
                })

    # Sort by date and take most recent, deduplicate
    news.sort(key=lambda x: x["date"], reverse=True)
    seen_titles = set()
    unique = []
    for n in news:
        short = n["title"][:60]
        if short not in seen_titles:
            seen_titles.add(short)
            unique.append(n)
    return unique[:20]


def build_production_regions():
    """Static data for top production regions — from USDA NASS known rankings."""
    return {
        "dairy": [
            {"state": "CA", "lat": 36.8, "lng": -119.4, "label": "California — #1 Milk Production", "rank": 1, "volume": "42B lbs/yr"},
            {"state": "WI", "lat": 44.5, "lng": -89.5, "label": "Wisconsin — #2 Milk, #1 Cheese", "rank": 2, "volume": "32B lbs/yr"},
            {"state": "ID", "lat": 44.1, "lng": -114.7, "label": "Idaho — #3 Milk Production", "rank": 3, "volume": "16B lbs/yr"},
            {"state": "TX", "lat": 31.9, "lng": -99.9, "label": "Texas — #4 Milk Production", "rank": 4, "volume": "15B lbs/yr"},
            {"state": "NY", "lat": 42.2, "lng": -74.9, "label": "New York — #5 Milk Production", "rank": 5, "volume": "15B lbs/yr"},
            {"state": "MI", "lat": 44.3, "lng": -85.6, "label": "Michigan — #6 Milk Production", "rank": 6, "volume": "12B lbs/yr"},
            {"state": "MN", "lat": 46.7, "lng": -94.7, "label": "Minnesota — #7 Milk", "rank": 7, "volume": "10B lbs/yr"},
            {"state": "PA", "lat": 41.2, "lng": -77.2, "label": "Pennsylvania — #8 Milk Production", "rank": 8, "volume": "10B lbs/yr"},
        ],
        "eggs": [
            {"state": "IA", "lat": 42.0, "lng": -93.5, "label": "Iowa — #1 Egg Production", "rank": 1, "volume": "17B eggs/yr"},
            {"state": "OH", "lat": 40.4, "lng": -82.9, "label": "Ohio — #2 Egg Production", "rank": 2, "volume": "10B eggs/yr"},
            {"state": "IN", "lat": 40.3, "lng": -86.1, "label": "Indiana — #3 Egg Production", "rank": 3, "volume": "10B eggs/yr"},
            {"state": "PA", "lat": 40.6, "lng": -77.2, "label": "Pennsylvania — #4 Egg Production", "rank": 4, "volume": "9B eggs/yr"},
            {"state": "TX", "lat": 31.0, "lng": -97.5, "label": "Texas — #5 Egg Production", "rank": 5, "volume": "7B eggs/yr"},
            {"state": "GA", "lat": 32.2, "lng": -83.5, "label": "Georgia — #6 Egg Production", "rank": 6, "volume": "5B eggs/yr"},
        ],
        "poultry": [
            {"state": "GA", "lat": 33.0, "lng": -83.5, "label": "Georgia — #1 Broiler Production", "rank": 1, "volume": "1.4B birds/yr"},
            {"state": "AR", "lat": 35.2, "lng": -92.2, "label": "Arkansas — #2 Broiler Production", "rank": 2, "volume": "1.1B birds/yr"},
            {"state": "NC", "lat": 35.8, "lng": -79.0, "label": "North Carolina — #3 Broilers", "rank": 3, "volume": "900M birds/yr"},
            {"state": "AL", "lat": 32.3, "lng": -86.9, "label": "Alabama — #4 Broiler Production", "rank": 4, "volume": "800M birds/yr"},
            {"state": "MS", "lat": 32.4, "lng": -89.7, "label": "Mississippi — #5 Broilers", "rank": 5, "volume": "750M birds/yr"},
            {"state": "TX", "lat": 32.0, "lng": -95.0, "label": "Texas — #6 Broiler Production", "rank": 6, "volume": "650M birds/yr"},
        ],
    }


def main():
    print("=" * 60)
    print("Fetching Trends Data for US Cattle Farmers Map")
    print("=" * 60)

    print("\n[1/6] Fetching USDA Dairy Prices (Butter & Cheese)...")
    dairy = fetch_usda_dairy()

    print("\n[2/6] Fetching USDA Boxed Beef Cutout Prices...")
    beef = fetch_usda_beef()

    print("\n[3/6] Fetching USDA Pork Cutout Prices...")
    pork = fetch_usda_pork()

    print("\n[4/6] Fetching Agricultural Stock Quotes...")
    stocks = fetch_stocks()

    print("\n[5/6] Fetching USDA Market Report Titles (News)...")
    news = fetch_usda_report_titles()

    print("\n[6/6] Building production regions data...")
    regions = build_production_regions()

    # Build final data object
    trends = {
        "fetchedAt": datetime.now().isoformat(),
        "dairy": dairy,
        "beef": beef,
        "pork": pork,
        "stocks": stocks,
        "news": news,
        "productionRegions": regions,
    }

    # Write to trends.js
    js_content = f"// Auto-generated by fetch_trends.py — {datetime.now().strftime('%Y-%m-%d %H:%M')}\n"
    js_content += f"// Sources: USDA AMS MPR Datamart (dairy/beef/pork), Yahoo Finance (stocks)\n"
    js_content += f"const TRENDS_DATA = {json.dumps(trends, indent=2)};\n"

    with open("trends.js", "w") as f:
        f.write(js_content)

    print(f"\n{'=' * 60}")
    print(f"✓ Written to trends.js ({len(js_content):,} bytes)")
    print(f"  Dairy prices:   {len(trends['dairy'])}")
    print(f"  Beef cutout:    {len(trends['beef'])}")
    print(f"  Pork cutout:    {len(trends['pork'])}")
    print(f"  Stocks:         {len(trends['stocks'])}")
    print(f"  News headlines: {len(trends['news'])}")
    print(f"  Regions:        dairy={len(regions['dairy'])}, eggs={len(regions['eggs'])}, poultry={len(regions['poultry'])}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
