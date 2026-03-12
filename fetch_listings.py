#!/usr/bin/env python3
"""
fetch_listings.py — Fetch farm/ranch/homestead property listings from Redfin
Outputs listings.js with real for-sale properties across major cattle states.
Uses Redfin's public API (no auth needed, CORS workaround via Python).
"""

import json
import urllib.request
import urllib.parse
import time
from datetime import datetime

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.redfin.com/",
    "Accept": "application/json",
}

# Major cattle/agriculture states — Redfin region IDs (type=4 = state)
# Verified by brute-force mapping all IDs 1-55
STATES = [
    {"id": 1,  "name": "Alabama", "abbr": "AL"},
    {"id": 2,  "name": "Missouri", "abbr": "MO"},
    {"id": 4,  "name": "Montana", "abbr": "MT"},
    {"id": 5,  "name": "Arizona", "abbr": "AZ"},
    {"id": 6,  "name": "Nebraska", "abbr": "NE"},
    {"id": 7,  "name": "Arkansas", "abbr": "AR"},
    {"id": 9,  "name": "California", "abbr": "CA"},
    {"id": 11, "name": "Colorado", "abbr": "CO"},
    {"id": 14, "name": "New Mexico", "abbr": "NM"},
    {"id": 16, "name": "New York", "abbr": "NY"},
    {"id": 18, "name": "North Carolina", "abbr": "NC"},
    {"id": 19, "name": "Florida", "abbr": "FL"},
    {"id": 21, "name": "Georgia", "abbr": "GA"},
    {"id": 22, "name": "Ohio", "abbr": "OH"},
    {"id": 23, "name": "Oklahoma", "abbr": "OK"},
    {"id": 24, "name": "Oregon", "abbr": "OR"},
    {"id": 27, "name": "Idaho", "abbr": "ID"},
    {"id": 30, "name": "South Carolina", "abbr": "SC"},
    {"id": 31, "name": "Indiana", "abbr": "IN"},
    {"id": 32, "name": "South Dakota", "abbr": "SD"},
    {"id": 33, "name": "Iowa", "abbr": "IA"},
    {"id": 34, "name": "Tennessee", "abbr": "TN"},
    {"id": 35, "name": "Kansas", "abbr": "KS"},
    {"id": 37, "name": "Kentucky", "abbr": "KY"},
    {"id": 42, "name": "Virginia", "abbr": "VA"},
    {"id": 48, "name": "Wisconsin", "abbr": "WI"},
    {"id": 49, "name": "Minnesota", "abbr": "MN"},
    {"id": 50, "name": "Wyoming", "abbr": "WY"},
    {"id": 51, "name": "Mississippi", "abbr": "MS"},
]


def fetch_state_listings(state):
    """Fetch land listings from Redfin for a given state (no keyword — all land)."""
    # uipt=6 = Land, status=9 = For Sale
    # No keyword — just get land listings in this state
    url = (
        f"https://www.redfin.com/stingray/api/gis?"
        f"al=1&num_homes=25&ord=redfin-recommended-asc&page_number=1"
        f"&region_id={state['id']}&region_type=4"
        f"&sf=1,2,5,6,7&status=9&uipt=6&v=8"
    )

    req = urllib.request.Request(url, headers=HEADERS)
    try:
        resp = urllib.request.urlopen(req, timeout=20)
        raw = resp.read().decode("utf-8")
        if raw.startswith("{}&&"):
            raw = raw[4:]
        data = json.loads(raw)
        return data.get("payload", {}).get("homes", [])
    except Exception as e:
        print(f"    Error: {e}")
        return []


def fetch_state_ranches(state):
    """Fetch specifically ranch-keyword listings."""
    url = (
        f"https://www.redfin.com/stingray/api/gis?"
        f"al=1&num_homes=15&ord=redfin-recommended-asc&page_number=1"
        f"&region_id={state['id']}&region_type=4"
        f"&sf=1,2,5,6,7&status=9&uipt=1,2,3,4,5,6,7,8&v=8"
        f"&kw=ranch+homestead"
    )

    req = urllib.request.Request(url, headers=HEADERS)
    try:
        resp = urllib.request.urlopen(req, timeout=20)
        raw = resp.read().decode("utf-8")
        if raw.startswith("{}&&"):
            raw = raw[4:]
        data = json.loads(raw)
        return data.get("payload", {}).get("homes", [])
    except Exception as e:
        print(f"    Error: {e}")
        return []


def classify_property(home):
    """Classify a property as farm, ranch, or homestead."""
    search_text = ""

    # Street address
    street_obj = home.get("streetLine", {})
    if isinstance(street_obj, dict) and "value" in street_obj:
        search_text += street_obj["value"].lower() + " "

    # URL contains descriptive info
    url = home.get("url", "").lower()
    search_text += url + " "

    # Location/subdivision name
    loc = home.get("location", {})
    if isinstance(loc, dict) and "value" in loc:
        search_text += str(loc["value"]).lower() + " "

    # Lot size hints
    lot_sqft = 0
    if "lotSize" in home:
        lot_val = home["lotSize"]
        if isinstance(lot_val, dict):
            lot_sqft = lot_val.get("value", 0)
        elif isinstance(lot_val, (int, float)):
            lot_sqft = lot_val
    acres = lot_sqft / 43560 if lot_sqft else 0

    if "ranch" in search_text:
        return "ranch"
    elif "homestead" in search_text or "historic" in search_text:
        return "homestead"
    elif "farm" in search_text or acres > 50:
        return "farm"
    elif acres > 10:
        return "ranch"
    else:
        return "farm"


def extract_listing(home, state_abbr):
    """Extract relevant fields from a Redfin home object."""
    price_obj = home.get("price", {})
    price = price_obj.get("value", 0) if isinstance(price_obj, dict) else 0
    if not price or price < 10000:
        return None

    lat_long = home.get("latLong", {})
    lat = lat_long.get("value", {}).get("latitude", 0) if isinstance(lat_long, dict) else 0
    lng = lat_long.get("value", {}).get("longitude", 0) if isinstance(lat_long, dict) else 0
    if not lat or not lng:
        return None

    # Address fields are top-level in Redfin's API
    street_obj = home.get("streetLine", {})
    address = street_obj.get("value", "") if isinstance(street_obj, dict) else ""
    city = home.get("city", "")
    state = home.get("state", state_abbr)
    zip_code = home.get("zip", "")

    # Lot size
    lot_sqft = 0
    if "lotSize" in home:
        lot_val = home["lotSize"]
        if isinstance(lot_val, dict):
            lot_sqft = lot_val.get("value", 0)
        elif isinstance(lot_val, (int, float)):
            lot_sqft = lot_val

    acres = round(lot_sqft / 43560, 1) if lot_sqft else 0

    # Beds/baths
    beds = home.get("beds", 0)
    baths = home.get("baths", 0)

    # URL
    redfin_url = home.get("url", "")
    if redfin_url and not redfin_url.startswith("http"):
        redfin_url = "https://www.redfin.com" + redfin_url

    category = classify_property(home)

    return {
        "address": address,
        "city": city,
        "state": state,
        "zip": str(zip_code),
        "price": price,
        "acres": acres,
        "beds": beds,
        "baths": baths,
        "lat": round(lat, 5),
        "lng": round(lng, 5),
        "category": category,
        "url": redfin_url,
        "source": "Redfin",
    }


def main():
    print("=" * 60)
    print("Fetching Farm/Ranch/Homestead Listings")
    print("=" * 60)

    all_listings = []
    seen_coords = set()

    for i, state in enumerate(STATES, 1):
        print(f"\n[{i}/{len(STATES)}] {state['name']} ({state['abbr']})...")

        # Fetch land with farm/ranch keyword
        homes = fetch_state_listings(state)
        print(f"  Farm/ranch land: {len(homes)} results")

        for h in homes:
            listing = extract_listing(h, state["abbr"])
            if listing and listing["state"] == state["abbr"]:
                key = f"{listing['lat']},{listing['lng']}"
                if key not in seen_coords:
                    seen_coords.add(key)
                    all_listings.append(listing)

        # Also fetch ranch/homestead keyword homes
        homes2 = fetch_state_ranches(state)
        print(f"  Ranch/homestead homes: {len(homes2)} results")

        for h in homes2:
            listing = extract_listing(h, state["abbr"])
            if listing and listing["state"] == state["abbr"]:
                key = f"{listing['lat']},{listing['lng']}"
                if key not in seen_coords:
                    seen_coords.add(key)
                    all_listings.append(listing)

        time.sleep(0.5)  # Be polite

    # Sort by price descending (most expensive first for visual interest)
    all_listings.sort(key=lambda x: x["price"], reverse=True)

    # Stats
    farms = [l for l in all_listings if l["category"] == "farm"]
    ranches = [l for l in all_listings if l["category"] == "ranch"]
    homesteads = [l for l in all_listings if l["category"] == "homestead"]

    print(f"\n{'=' * 60}")
    print(f"Total listings: {len(all_listings)}")
    print(f"  Farms: {len(farms)}")
    print(f"  Ranches: {len(ranches)}")
    print(f"  Homesteads: {len(homesteads)}")
    print(f"  States: {len(set(l['state'] for l in all_listings))}")

    # Write JS file
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    output = {
        "fetchedAt": datetime.now().isoformat(),
        "source": "Redfin public listings",
        "total": len(all_listings),
        "listings": all_listings,
    }

    with open("listings.js", "w") as f:
        f.write(f"// Auto-generated by fetch_listings.py — {now}\n")
        f.write(f"// Source: Redfin public property listings\n")
        f.write(f"const LISTINGS_DATA = {json.dumps(output, indent=2)};\n")

    size = len(open("listings.js").read())
    print(f"Written to listings.js ({size:,} bytes)")
    print("=" * 60)


if __name__ == "__main__":
    main()
