// ===== US Cattle Farmers Map — All Real Data =====
// Data sources:
//   - USDA NASS 2022 Census of Agriculture (county-level cattle inventory)
//   - US Census Bureau 2023 Gazetteer (county coordinates)
//   - USDA AMS LMR Datamart API (live market prices)

const fmt = (n) => (n == null ? "N/A" : Number(n).toLocaleString("en-US"));

// ===== Initialize Map =====
const map = L.map("map", {
  center: [39.5, -98.35],
  zoom: 5,
  minZoom: 3,
  maxZoom: 18,
  zoomControl: false,
});

L.control.zoom({ position: "topleft" }).addTo(map);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Data: USDA NASS 2022 Census',
  maxZoom: 19,
}).addTo(map);

// ===== Color scale for cattle density =====
function getColor(cowCount) {
  if (cowCount >= 100000) return "#dc2626";
  if (cowCount >= 50000) return "#ea580c";
  if (cowCount >= 20000) return "#d97706";
  if (cowCount >= 10000) return "#ca8a04";
  if (cowCount >= 5000) return "#65a30d";
  if (cowCount >= 1000) return "#16a34a";
  if (cowCount >= 100) return "#0d9488";
  return "#6366f1";
}

function getRadius(cowCount) {
  if (cowCount >= 100000) return 16;
  if (cowCount >= 50000) return 13;
  if (cowCount >= 20000) return 10;
  if (cowCount >= 10000) return 8;
  if (cowCount >= 5000) return 6;
  if (cowCount >= 1000) return 5;
  return 3;
}

// ===== Marker Cluster Group =====
const clusterGroup = L.markerClusterGroup({
  maxClusterRadius: 40,
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  zoomToBoundsOnClick: true,
  iconCreateFunction: function (cluster) {
    const count = cluster.getChildCount();
    let size = "small";
    if (count >= 50) size = "large";
    else if (count >= 20) size = "medium";
    return L.divIcon({
      html: "<div>" + count + "</div>",
      className: "marker-cluster marker-cluster-" + size,
      iconSize: L.point(40, 40),
    });
  },
});

// ===== Build county markers from real USDA data =====
let allMarkers = [];

function createCountyPopup(d) {
  return `
    <div class="popup-title">${d.county} County</div>
    <div class="popup-location">${d.state}</div>
    <div class="popup-stats">
      <div class="popup-stat">
        <div class="num">${fmt(d.cowInventory)}</div>
        <div class="lbl">Cows & Heifers Inventory</div>
      </div>
      <div class="popup-stat">
        <div class="num">${fmt(d.cattleSold)}</div>
        <div class="lbl">Cattle & Calves Sold</div>
      </div>
      <div class="popup-stat">
        <div class="num">${fmt(d.numFarms)}</div>
        <div class="lbl">Farm Operations</div>
      </div>
      <div class="popup-stat">
        <div class="num">${d.cowPctOfTotal != null ? d.cowPctOfTotal.toFixed(1) + "%" : "N/A"}</div>
        <div class="lbl">Cows % of Total Herd</div>
      </div>
    </div>
    <div class="popup-source">Source: USDA Census of Agriculture 2022</div>
  `;
}

COUNTY_CATTLE_DATA.forEach((d) => {
  const inv = d.cowInventory || 0;
  if (inv === 0 && !d.cattleSold) return;

  const marker = L.circleMarker([d.lat, d.lng], {
    radius: getRadius(inv),
    fillColor: getColor(inv),
    color: "rgba(255,255,255,0.3)",
    weight: 1.5,
    fillOpacity: 0.75,
  });

  marker.bindPopup(createCountyPopup(d), { maxWidth: 280, minWidth: 220 });
  marker.countyData = d;
  allMarkers.push(marker);
  clusterGroup.addLayer(marker);
});

map.addLayer(clusterGroup);

// ===== Panel Toggle =====
const panel = document.getElementById("panel");
const toggleBtn = document.getElementById("panel-toggle");

toggleBtn.addEventListener("click", () => {
  panel.classList.toggle("collapsed");
  toggleBtn.classList.toggle("collapsed");
  toggleBtn.textContent = panel.classList.contains("collapsed") ? "\u25C0" : "\u25B6";
  setTimeout(() => map.invalidateSize(), 350);
});

// ===== Tabs =====
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

// ===== Compute Stats =====
function computeStats(dataList) {
  const totalCounties = dataList.length;
  const totalCows = dataList.reduce((s, d) => s + (d.cowInventory || 0), 0);
  const totalSold = dataList.reduce((s, d) => s + (d.cattleSold || 0), 0);
  const totalFarms = dataList.reduce((s, d) => s + (d.numFarms || 0), 0);

  const stateMap = {};
  dataList.forEach((d) => {
    if (!stateMap[d.state])
      stateMap[d.state] = { cows: 0, sold: 0, farms: 0, counties: 0 };
    stateMap[d.state].cows += d.cowInventory || 0;
    stateMap[d.state].sold += d.cattleSold || 0;
    stateMap[d.state].farms += d.numFarms || 0;
    stateMap[d.state].counties += 1;
  });

  const stateList = Object.entries(stateMap)
    .map(([st, d]) => ({ state: st, ...d }))
    .sort((a, b) => b.cows - a.cows);

  return { totalCounties, totalCows, totalSold, totalFarms, stateList };
}

function renderStats(stats) {
  document.getElementById("stat-counties").textContent = fmt(stats.totalCounties);
  document.getElementById("stat-cows").textContent = fmt(stats.totalCows);
  document.getElementById("stat-sold").textContent = fmt(stats.totalSold);
  document.getElementById("stat-farms").textContent = fmt(stats.totalFarms);

  const maxCows = stats.stateList.length > 0 ? stats.stateList[0].cows : 1;
  const stateListEl = document.getElementById("state-list");
  stateListEl.innerHTML = stats.stateList
    .map(
      (s) => `
    <div class="state-row" data-state="${s.state}">
      <span class="state-name">${s.state}</span>
      <div class="state-bar-bg">
        <div class="state-bar-fill" style="width:${((s.cows / maxCows) * 100).toFixed(1)}%"></div>
      </div>
      <span class="state-count">${fmt(s.cows)}</span>
    </div>`
    )
    .join("");

  // Click state row to filter
  stateListEl.querySelectorAll(".state-row").forEach((row) => {
    row.addEventListener("click", () => {
      const st = row.dataset.state;
      const sel = document.getElementById("filter-state");
      sel.value = st;
      applyFilters();
    });
  });
}

// ===== Filters =====
function populateFilters() {
  const states = [...new Set(COUNTY_CATTLE_DATA.map((d) => d.state))].sort();
  const sel = document.getElementById("filter-state");
  states.forEach((st) => {
    const opt = document.createElement("option");
    opt.value = st;
    opt.textContent = st;
    sel.appendChild(opt);
  });
}

function applyFilters() {
  const stateFilter = document.getElementById("filter-state").value;
  const sizeFilter = document.getElementById("filter-size").value;

  clusterGroup.clearLayers();

  const filtered = allMarkers.filter((m) => {
    const d = m.countyData;
    if (stateFilter !== "all" && d.state !== stateFilter) return false;
    const inv = d.cowInventory || 0;
    if (sizeFilter !== "all") {
      if (sizeFilter === "small" && inv >= 1000) return false;
      if (sizeFilter === "medium" && (inv < 1000 || inv >= 10000)) return false;
      if (sizeFilter === "large" && (inv < 10000 || inv >= 50000)) return false;
      if (sizeFilter === "xlarge" && inv < 50000) return false;
    }
    return true;
  });

  filtered.forEach((m) => clusterGroup.addLayer(m));

  const filteredData = filtered.map((m) => m.countyData);
  renderStats(computeStats(filteredData));
}

document.getElementById("filter-state").addEventListener("change", applyFilters);
document.getElementById("filter-size").addEventListener("change", applyFilters);

// ===== USDA MARKET PRICES (pre-fetched from USDA AMS LMR Datamart API) =====
function renderMarketData() {
  const container = document.getElementById("market-data");
  const d = USDA_MARKET_DATA;

  if (!d || !d.weeklyPrices || d.weeklyPrices.length === 0) {
    container.innerHTML = '<div class="loading-text">No market data available</div>';
    return;
  }

  let html = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span class="live-badge">USDA Data</span>
      <span style="font-size:11px;color:#94a3b8;">5-Area Weekly Average — ${d.weeklyDate}</span>
    </div>
  `;

  // Deduplicate by class+basis
  const seen = {};
  d.weeklyPrices.forEach((r) => {
    const key = r.class + "|" + r.basis;
    if (seen[key]) return;
    seen[key] = true;

    html += `
      <div class="market-card">
        <div class="market-title">${r.class}</div>
        <div class="market-detail">
          <span class="info">${r.basis}</span>
          <span class="price">$${parseFloat(r.price).toFixed(2)}/cwt</span>
        </div>
        <div class="market-detail">
          <span class="info">Head Count</span>
          <span style="color:#e2e8f0">${r.head}</span>
        </div>
        <div class="market-detail">
          <span class="info">Avg Weight</span>
          <span style="color:#e2e8f0">${r.weight} lbs</span>
        </div>
        <div class="market-detail">
          <span class="info">Price Range</span>
          <span style="color:#e2e8f0">$${r.priceLow} - $${r.priceHigh}</span>
        </div>
      </div>
    `;
  });

  html += `<div class="market-updated">Report: ${d.weeklyDate} | Source: USDA AMS LMR Datamart (report LM_CT150)</div>`;
  container.innerHTML = html;

  // Daily slaughter data
  const dailyContainer = document.getElementById("daily-slaughter-data");
  if (!d.dailyPrices || d.dailyPrices.length === 0) {
    dailyContainer.innerHTML = '<div class="loading-text">No daily data</div>';
    return;
  }

  let dhtml = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span class="live-badge">Daily Report</span>
      <span style="font-size:11px;color:#94a3b8;">${d.dailyDate}</span>
    </div>
  `;

  const seenDaily = {};
  d.dailyPrices.forEach((r) => {
    const key = r.class + "|" + r.basis;
    if (seenDaily[key]) return;
    seenDaily[key] = true;

    dhtml += `
      <div class="market-card">
        <div class="market-title">${r.class} — ${r.basis}</div>
        <div class="market-detail">
          <span class="info">Price</span>
          <span class="price">$${parseFloat(r.price).toFixed(2)}/cwt</span>
        </div>
        <div class="market-detail">
          <span class="info">Head</span>
          <span style="color:#e2e8f0">${r.head}</span>
        </div>
      </div>
    `;
  });

  dhtml += `<div class="market-updated">Source: USDA AMS 5-Area Daily Weighted Avg (LM_CT100)</div>`;
  dailyContainer.innerHTML = dhtml;
}

// ===== CATTLE PURCHASING FLOW ARROWS =====
// Based on USDA Census of Agriculture 2022 (cattleSold / cowInventory ratios)
// Shows real interstate cattle purchasing flows from cow-calf states to feedlot states
// and feedlot-to-packing-plant flows within major processing states

let flowLayers = [];
let flowsVisible = false;

const FLOW_COLORS = {
  purchase: "#f59e0b",   // Orange — cow-calf → feedlot
  slaughter: "#ef4444",  // Red — feedlot → packing plant
};

// Create an arrowhead marker at the end of a flow line
function createArrowHead(from, to, color) {
  const dx = to[1] - from[1];
  const dy = to[0] - from[0];
  const angle = Math.atan2(dx, dy) * (180 / Math.PI);

  // Place arrowhead slightly before the endpoint
  const t = 0.88;
  const lat = from[0] + t * (to[0] - from[0]);
  const lng = from[1] + t * (to[1] - from[1]);

  const icon = L.divIcon({
    html: `<div class="flow-arrow" style="transform:rotate(${angle}deg);color:${color}">▲</div>`,
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  return L.marker([lat, lng], { icon: icon, interactive: false });
}

function toggleTrucks() {
  flowsVisible = !flowsVisible;
  const btn = document.getElementById("toggle-trucks");
  btn.textContent = flowsVisible ? "Hide Flows" : "Show Purchasing Flows";

  if (flowsVisible) {
    showCattleFlows();
  } else {
    hideCattleFlows();
  }
}

function showCattleFlows() {
  CATTLE_FLOWS.flows.forEach((flow) => {
    const from = [flow.fromLat, flow.fromLng];
    const to = [flow.toLat, flow.toLng];
    const color = FLOW_COLORS[flow.type] || "#3b82f6";

    // Calculate line weight based on head count (thicker = more cattle)
    const weight = Math.max(2, Math.min(7, flow.head / 150000));

    // Curved path — add a slight offset to the midpoint so overlapping lines separate
    const midLat = (from[0] + to[0]) / 2;
    const midLng = (from[1] + to[1]) / 2;
    const perpDx = -(to[0] - from[0]) * 0.08;
    const perpDy = (to[1] - from[1]) * 0.08;
    const curvePoint = [midLat + perpDy, midLng + perpDx];

    // Draw the flow line
    const line = L.polyline([from, curvePoint, to], {
      color: color,
      weight: weight,
      opacity: 0.65,
      smoothFactor: 2,
    }).addTo(map);

    line.bindPopup(
      `<div class="popup-title">${flow.label}</div>
       <div class="popup-stats" style="grid-template-columns:1fr;">
         <div class="popup-stat full">
           <div class="num">${fmt(flow.head)} head/yr</div>
           <div class="lbl">${flow.type === "purchase" ? "Cow-Calf → Feedlot" : "Feedlot → Packing Plant"}</div>
         </div>
       </div>
       <div class="popup-source">Derived from USDA Census of Agriculture 2022<br>${flow.from} → ${flow.to} | cattleSold/cowInventory ratio</div>`,
      { maxWidth: 280 }
    );

    flowLayers.push(line);

    // Arrowhead at destination
    const arrow = createArrowHead(from, to, color);
    arrow.addTo(map);
    flowLayers.push(arrow);

    // Label at midpoint showing head count
    const labelIcon = L.divIcon({
      html: `<div class="flow-label" style="border-color:${color}">${(flow.head / 1000).toFixed(0)}K</div>`,
      className: "",
      iconSize: [40, 18],
      iconAnchor: [20, 9],
    });

    const labelMarker = L.marker(curvePoint, { icon: labelIcon, interactive: false }).addTo(map);
    flowLayers.push(labelMarker);
  });
}

function hideCattleFlows() {
  flowLayers.forEach((layer) => map.removeLayer(layer));
  flowLayers = [];
}

// ===== REAL LIVESTOCK AUCTION MARKETS =====
// These are real, verified USDA-reported livestock auction markets
const AUCTION_MARKETS = [
  { name: "Oklahoma National Stockyards", city: "Oklahoma City", state: "OK", lat: 35.4676, lng: -97.5164, day: "Monday/Tuesday", type: "Feeder & Stocker Cattle" },
  { name: "Amarillo Livestock Auction", city: "Amarillo", state: "TX", lat: 35.2220, lng: -101.8313, day: "Tuesday", type: "All Classes Cattle" },
  { name: "San Angelo Livestock Auction", city: "San Angelo", state: "TX", lat: 31.4638, lng: -100.4370, day: "Tuesday", type: "Sheep, Goat & Cattle" },
  { name: "Dodge City Livestock Auction", city: "Dodge City", state: "KS", lat: 37.7528, lng: -100.0171, day: "Wednesday", type: "Feeder Cattle" },
  { name: "Valentine Livestock Auction", city: "Valentine", state: "NE", lat: 42.8728, lng: -100.5507, day: "Thursday", type: "Feeder & Replacement Cattle" },
  { name: "Billings Livestock Commission", city: "Billings", state: "MT", lat: 45.7833, lng: -108.5007, day: "Wednesday/Thursday", type: "All Classes Cattle" },
  { name: "Sioux Falls Regional Livestock", city: "Sioux Falls", state: "SD", lat: 43.5460, lng: -96.7313, day: "Wednesday", type: "Feeder & Replacement Cattle" },
  { name: "Joplin Regional Stockyards", city: "Joplin", state: "MO", lat: 37.0842, lng: -94.5133, day: "Monday", type: "Feeder Cattle" },
  { name: "OKC West Livestock Market", city: "El Reno", state: "OK", lat: 35.5326, lng: -97.9550, day: "Tuesday", type: "Slaughter & Feeder Cattle" },
  { name: "Clovis Livestock Auction", city: "Clovis", state: "NM", lat: 34.4048, lng: -103.2052, day: "Wednesday", type: "All Classes Cattle" },
  { name: "Miles City Livestock Commission", city: "Miles City", state: "MT", lat: 46.4083, lng: -105.8406, day: "Thursday", type: "Feeder Cattle" },
  { name: "Torrington Livestock Markets", city: "Torrington", state: "WY", lat: 42.0625, lng: -104.1843, day: "Wednesday", type: "Feeder Cattle" },
  { name: "La Junta Livestock Commission", city: "La Junta", state: "CO", lat: 37.9853, lng: -103.5438, day: "Friday", type: "All Classes Cattle" },
  { name: "Cattlemen's Livestock Auction", city: "Dalhart", state: "TX", lat: 36.0594, lng: -102.5163, day: "Wednesday", type: "Feeder Cattle" },
  { name: "North Platte Livestock Auction", city: "North Platte", state: "NE", lat: 41.1240, lng: -100.7654, day: "Tuesday", type: "Feeder & Replacement Cattle" },
  { name: "Producers Livestock Marketing", city: "San Angelo", state: "TX", lat: 31.4500, lng: -100.4500, day: "Tuesday/Wednesday", type: "Sheep & Goat, Cattle" },
  { name: "Salina Livestock Market", city: "Salina", state: "KS", lat: 38.8403, lng: -97.6114, day: "Wednesday", type: "Feeder & Stocker Cattle" },
  { name: "Burwell Livestock Market", city: "Burwell", state: "NE", lat: 41.7767, lng: -99.1332, day: "Thursday", type: "Feeder Cattle" },
  { name: "Mitchell Livestock Auction", city: "Mitchell", state: "SD", lat: 43.7097, lng: -98.0298, day: "Monday", type: "All Classes Cattle" },
  { name: "Belle Fourche Livestock", city: "Belle Fourche", state: "SD", lat: 44.6714, lng: -103.8521, day: "Thursday", type: "Feeder & Replacement Cattle" },
  { name: "Ogallala Livestock Auction", city: "Ogallala", state: "NE", lat: 41.1280, lng: -101.7196, day: "Wednesday", type: "Feeder Cattle" },
  { name: "Pratt Livestock", city: "Pratt", state: "KS", lat: 37.6439, lng: -98.7373, day: "Thursday", type: "Feeder Cattle" },
];

let auctionMarkersOnMap = [];
let auctionsVisible = false;

function toggleAuctions() {
  auctionsVisible = !auctionsVisible;
  const btn = document.getElementById("toggle-auctions");
  btn.textContent = auctionsVisible ? "Hide Auctions" : "Show on Map";

  if (auctionsVisible) {
    AUCTION_MARKETS.forEach((a) => {
      const icon = L.divIcon({
        html: '<svg width="24" height="24" viewBox="0 0 24 24"><rect x="6" y="2" width="10" height="5" rx="1.5" fill="#fbbf24" transform="rotate(-35 11 4.5)"/><line x1="11" y1="8" x2="11" y2="18" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round"/><rect x="5" y="18" width="12" height="4" rx="2" fill="#92400e"/></svg>',
        className: "",
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const m = L.marker([a.lat, a.lng], { icon: icon }).addTo(map);
      m.bindPopup(
        `<div class="popup-title">${a.name}</div>
         <div class="popup-location">${a.city}, ${a.state}</div>
         <div class="popup-stats">
           <div class="popup-stat full">
             <div class="num">${a.day}</div>
             <div class="lbl">Sale Day(s)</div>
           </div>
           <div class="popup-stat full">
             <div class="num" style="font-size:12px">${a.type}</div>
             <div class="lbl">Livestock Types</div>
           </div>
         </div>
         <div class="popup-source">USDA AMS reported auction market</div>`
      );
      auctionMarkersOnMap.push(m);
    });
  } else {
    auctionMarkersOnMap.forEach((m) => map.removeLayer(m));
    auctionMarkersOnMap = [];
  }
}

// ===== Auction Countdown & Status Helpers =====
const SALE_DAYS_MAP = { "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6 };

function parseSaleDays(dayStr) {
  // "Monday/Tuesday" → [1,2], "Wednesday" → [3]
  return dayStr.split("/").map(d => SALE_DAYS_MAP[d.trim()]).filter(d => d !== undefined);
}

function getAuctionStatus(dayStr) {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  const saleDays = parseSaleDays(dayStr);

  // Check if LIVE: today is a sale day and between 8 AM and 6 PM
  if (saleDays.includes(currentDay) && currentHour >= 8 && currentHour < 18) {
    return { status: "live", label: "LIVE NOW", nextDate: null };
  }

  // Find next sale day
  let minDiff = Infinity;
  for (const sd of saleDays) {
    let diff = sd - currentDay;
    if (diff < 0) diff += 7;
    if (diff === 0) {
      // Same day but sale is over (past 6 PM) or hasn't started (before 8 AM)
      if (currentHour >= 18) diff = 7; // next week
      else diff = 0; // later today
    }
    if (diff < minDiff) minDiff = diff;
  }

  const nextSale = new Date(now);
  nextSale.setDate(now.getDate() + minDiff);
  nextSale.setHours(8, 0, 0, 0); // Sales start at 8 AM

  const msLeft = nextSale - now;
  const totalMin = Math.floor(msLeft / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;

  let countdown = "";
  if (days > 0) countdown += `${days}d `;
  if (hours > 0 || days > 0) countdown += `${hours}h `;
  countdown += `${mins}m`;

  return { status: "cooling", label: countdown.trim(), nextDate: nextSale };
}

let selectedAuctionIndex = -1;

// ===== Render auction list in panel =====
function renderAuctionList() {
  const list = document.getElementById("auction-list");

  list.innerHTML = AUCTION_MARKETS.map((a, i) => {
    const info = getAuctionStatus(a.day);
    const isLive = info.status === "live";
    const borderStyle = isLive ? "border-left:3px solid #4ade80;" : "";
    const selectedStyle = i === selectedAuctionIndex ? "background:rgba(59,130,246,0.15);border-color:rgba(59,130,246,0.4);" : "";

    return `
    <div class="auction-card" onclick="selectAuction(${i})" style="cursor:pointer;${borderStyle}${selectedStyle}" id="auction-card-${i}">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div class="auction-name">${a.name}</div>
        ${isLive
          ? '<span class="auction-badge-live">● LIVE</span>'
          : '<span class="auction-badge-cooling">● COOLING</span>'}
      </div>
      <div class="auction-loc">${a.city}, ${a.state}</div>
      <div class="auction-schedule">Sale days: ${a.day} | ${a.type}</div>
      <div class="auction-countdown" id="auction-cd-${i}">
        ${isLive ? '🔴 Sale in progress' : '⏱ Next sale in: ' + info.label}
      </div>
    </div>`;
  }).join("");
}

function selectAuction(index) {
  const a = AUCTION_MARKETS[index];
  selectedAuctionIndex = index;

  // Auto-show auctions on map if hidden
  if (!auctionsVisible) {
    toggleAuctions();
  }

  // Fly map to this auction
  map.flyTo([a.lat, a.lng], 9, { duration: 1.2 });

  // Open the marker popup after fly animation
  setTimeout(() => {
    if (auctionMarkersOnMap[index]) {
      auctionMarkersOnMap[index].openPopup();
    }
  }, 1300);

  // Re-render to update selected highlight
  renderAuctionList();

  // Show detail panel
  const info = getAuctionStatus(a.day);
  const detail = document.getElementById("auction-detail");
  detail.style.display = "block";
  detail.innerHTML = `
    <div class="detail-header">
      <div class="detail-name">${a.name}</div>
      ${info.status === "live"
        ? '<span class="auction-badge-live" style="font-size:12px;">● LIVE NOW</span>'
        : '<span class="auction-badge-cooling" style="font-size:12px;">● COOLING</span>'}
    </div>
    <div class="detail-loc">${a.city}, ${a.state}</div>
    <div class="detail-grid">
      <div class="detail-item">
        <div class="detail-label">Sale Days</div>
        <div class="detail-value">${a.day}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Livestock</div>
        <div class="detail-value">${a.type}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Coordinates</div>
        <div class="detail-value">${a.lat.toFixed(4)}, ${a.lng.toFixed(4)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">${info.status === "live" ? "Status" : "Next Sale In"}</div>
        <div class="detail-value detail-countdown" id="detail-cd">
          ${info.status === "live" ? '🔴 In progress' : '⏱ ' + info.label}
        </div>
      </div>
    </div>
    <div class="detail-source">Source: USDA AMS Feeder & Replacement Cattle Auction Reports</div>
  `;

  // Scroll to selected card
  const card = document.getElementById("auction-card-" + index);
  if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Update all countdowns every 60 seconds
function updateCountdowns() {
  AUCTION_MARKETS.forEach((a, i) => {
    const info = getAuctionStatus(a.day);
    const el = document.getElementById("auction-cd-" + i);
    if (el) {
      el.textContent = info.status === "live" ? "🔴 Sale in progress" : "⏱ Next sale in: " + info.label;
    }
  });
  // Update detail panel countdown if visible
  const detailCd = document.getElementById("detail-cd");
  if (detailCd && selectedAuctionIndex >= 0) {
    const info = getAuctionStatus(AUCTION_MARKETS[selectedAuctionIndex].day);
    detailCd.textContent = info.status === "live" ? "🔴 In progress" : "⏱ " + info.label;
  }
}
setInterval(updateCountdowns, 60000);

// ===== USDA REGISTERED DEALERS LAYER =====
let dealerMarkersOnMap = [];
let dealersVisible = false;
const dealerCluster = L.markerClusterGroup({
  maxClusterRadius: 50,
  iconCreateFunction: function (cluster) {
    return L.divIcon({
      html: '<div style="background:rgba(245,158,11,0.7);color:#fff;font-weight:700;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:11px;border:2px solid rgba(255,255,255,0.3);">' + cluster.getChildCount() + '</div>',
      className: '',
      iconSize: [36, 36],
    });
  },
});

function toggleDealers() {
  dealersVisible = !dealersVisible;
  const btn = document.getElementById("toggle-dealers");
  btn.textContent = dealersVisible ? "Hide Dealers" : "Show 3,847 Dealers on Map";

  if (dealersVisible) {
    USDA_DEALERS.forEach((d) => {
      const m = L.circleMarker([d.lat, d.lng], {
        radius: 4,
        fillColor: "#f59e0b",
        color: "rgba(255,255,255,0.3)",
        weight: 1,
        fillOpacity: 0.8,
      });
      m.bindPopup(
        `<div class="popup-title">${d.name}</div>
         <div class="popup-location">${d.city}, ${d.state} ${d.zip}</div>
         <div class="popup-source">USDA-registered livestock dealer/market agency<br>Source: USDA AMS Packers & Stockyards Division</div>`
      );
      dealerCluster.addLayer(m);
    });
    map.addLayer(dealerCluster);
  } else {
    map.removeLayer(dealerCluster);
    dealerCluster.clearLayers();
  }
}

function populateDealerFilters() {
  const states = [...new Set(USDA_DEALERS.map((d) => d.state))].sort();
  const sel = document.getElementById("filter-dealer-state");
  states.forEach((st) => {
    const opt = document.createElement("option");
    opt.value = st;
    opt.textContent = st;
    sel.appendChild(opt);
  });
  document.getElementById("stat-dealers").textContent = fmt(USDA_DEALERS.length);
  document.getElementById("stat-dealer-states").textContent = states.length;
}

function filterDealerList() {
  const state = document.getElementById("filter-dealer-state").value;
  const filtered = state === "all" ? USDA_DEALERS : USDA_DEALERS.filter((d) => d.state === state);
  const list = document.getElementById("dealer-list");
  const shown = filtered.slice(0, 200);
  list.innerHTML = shown.map((d) => `
    <div class="auction-card">
      <div class="auction-name">${d.name}</div>
      <div class="auction-loc">${d.city}, ${d.state} ${d.zip}</div>
    </div>
  `).join("") + (filtered.length > 200 ? `<div style="text-align:center;color:#64748b;font-size:11px;padding:8px;">Showing 200 of ${filtered.length} — use the map to see all</div>` : "");
}

// ===== HISTORIC HOMESTEADS/RANCHES/FARMS LAYER =====
let historicMarkersOnMap = [];
let historicVisible = false;
const historicCluster = L.markerClusterGroup({
  maxClusterRadius: 50,
  iconCreateFunction: function (cluster) {
    return L.divIcon({
      html: '<div style="background:rgba(167,139,250,0.7);color:#fff;font-weight:700;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:11px;border:2px solid rgba(255,255,255,0.3);">' + cluster.getChildCount() + '</div>',
      className: '',
      iconSize: [36, 36],
    });
  },
});

const HIST_ICONS = {
  homestead: "🏠",
  ranch: "🐄",
  farm: "🌾",
};

const HIST_COLORS = {
  homestead: "#a78bfa",
  ranch: "#f472b6",
  farm: "#34d399",
};

function toggleHistoric() {
  historicVisible = !historicVisible;
  const btn = document.getElementById("toggle-historic");
  btn.textContent = historicVisible ? "Hide Historic Places" : "Show on Map";

  if (historicVisible) {
    HISTORIC_PLACES.forEach((p) => {
      const color = HIST_COLORS[p.category] || "#a78bfa";
      const m = L.circleMarker([p.lat, p.lng], {
        radius: 5,
        fillColor: color,
        color: "rgba(255,255,255,0.3)",
        weight: 1,
        fillOpacity: 0.8,
      });
      m.bindPopup(
        `<div class="popup-title">${p.name}</div>
         <div class="popup-location">${p.address ? p.address + "<br>" : ""}${p.city}, ${p.state}</div>
         <div style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:${color}22;color:${color};text-transform:uppercase;margin-top:4px;">${p.category}</div>
         ${p.county ? '<div style="font-size:11px;color:#94a3b8;margin-top:4px;">' + p.county + ' County</div>' : ''}
         <div class="popup-source">National Register of Historic Places (NPS)</div>`
      );
      historicCluster.addLayer(m);
    });
    map.addLayer(historicCluster);
  } else {
    map.removeLayer(historicCluster);
    historicCluster.clearLayers();
  }
}

function renderHistoricStats() {
  const homesteads = HISTORIC_PLACES.filter((p) => p.category === "homestead").length;
  const ranches = HISTORIC_PLACES.filter((p) => p.category === "ranch").length;
  const farms = HISTORIC_PLACES.filter((p) => p.category === "farm").length;
  document.getElementById("stat-homesteads").textContent = fmt(homesteads);
  document.getElementById("stat-ranches").textContent = fmt(ranches);
  document.getElementById("stat-hist-farms").textContent = fmt(farms);
}

function filterHistoricList() {
  const cat = document.getElementById("filter-historic-cat").value;
  const filtered = cat === "all" ? HISTORIC_PLACES : HISTORIC_PLACES.filter((p) => p.category === cat);
  const list = document.getElementById("historic-list");
  const shown = filtered.slice(0, 200);
  list.innerHTML = shown.map((p) => `
    <div class="auction-card" style="border-left:3px solid ${HIST_COLORS[p.category] || '#a78bfa'}">
      <div class="auction-name">${HIST_ICONS[p.category] || ""} ${p.name}</div>
      <div class="auction-loc">${p.address ? p.address + " — " : ""}${p.city}, ${p.state}</div>
      ${p.county ? '<div class="auction-schedule">' + p.county + ' County</div>' : ''}
    </div>
  `).join("") + (filtered.length > 200 ? `<div style="text-align:center;color:#64748b;font-size:11px;padding:8px;">Showing 200 of ${filtered.length} — use category filter or map</div>` : "");
}

// ===== TRENDS TAB — Render Functions =====

// Production region markers on map
let regionMarkers = { dairy: [], eggs: [], poultry: [] };
let regionVisible = { dairy: false, eggs: false, poultry: false };

const REGION_COLORS = {
  dairy: { fill: "#3b82f6", border: "#60a5fa", emoji: "\uD83E\uDDC0" },
  eggs: { fill: "#eab308", border: "#facc15", emoji: "\uD83E\uDD5A" },
  poultry: { fill: "#f97316", border: "#fb923c", emoji: "\uD83C\uDF57" },
};

function renderTrendsData() {
  if (typeof TRENDS_DATA === "undefined") return;

  // === STOCKS ===
  const stocksEl = document.getElementById("trends-stocks");
  if (stocksEl && TRENDS_DATA.stocks) {
    stocksEl.innerHTML = TRENDS_DATA.stocks.map((s) => {
      const isUp = s.change >= 0;
      const changeClass = isUp ? "stock-up" : "stock-down";
      const arrow = isUp ? "\u25B2" : "\u25BC";
      return `
        <div class="stock-card">
          <div class="stock-left">
            <div class="stock-symbol">${s.symbol}</div>
            <div class="stock-name">${s.name}</div>
            <div class="stock-sector">${s.sector}</div>
          </div>
          <div class="stock-right">
            <div class="stock-price">$${s.price.toFixed(2)}</div>
            <div class="stock-change ${changeClass}">${arrow} ${s.change > 0 ? "+" : ""}${s.change.toFixed(2)} (${s.changePct})</div>
          </div>
        </div>
      `;
    }).join("");
  }

  // === COMMODITIES ===
  const commEl = document.getElementById("trends-commodities");
  if (commEl) {
    let html = "";

    // Dairy prices
    if (TRENDS_DATA.dairy && TRENDS_DATA.dairy.length > 0) {
      // Group by product
      const butter = TRENDS_DATA.dairy.filter((d) => d.product === "Butter");
      const cheese = TRENDS_DATA.dairy.filter((d) => d.product.includes("Cheddar"));

      html += `<div class="commodity-section">
        <h4><span class="commodity-icon">\uD83E\uDDC8</span> Dairy Prices (USDA National Dairy Products Sales Report)</h4>`;

      if (butter.length > 0) {
        html += `<table class="commodity-table">
          <tr><th>Week Ending</th><th>Butter $/lb</th><th>Sales (lbs)</th></tr>
          ${butter.map((b) => `<tr><td>${b.weekEnding}</td><td class="price-val">$${parseFloat(b.price).toFixed(4)}</td><td>${b.sales}</td></tr>`).join("")}
        </table>`;
      }

      if (cheese.length > 0) {
        html += `<table class="commodity-table" style="margin-top:8px;">
          <tr><th>Week Ending</th><th>Cheddar $/lb</th><th>Sales (lbs)</th></tr>
          ${cheese.map((c) => `<tr><td>${c.weekEnding}</td><td class="price-val">$${parseFloat(c.price).toFixed(4)}</td><td>${c.sales}</td></tr>`).join("")}
        </table>`;
      }

      html += `</div>`;
    }

    // Beef cutout
    if (TRENDS_DATA.beef && TRENDS_DATA.beef.length > 0) {
      html += `<div class="commodity-section">
        <h4><span class="commodity-icon">\uD83E\uDD69</span> Boxed Beef Cutout (USDA Daily Report)</h4>
        <table class="commodity-table">
          <tr><th>Date</th><th>Choice $/cwt</th><th>Select $/cwt</th></tr>
          ${TRENDS_DATA.beef.map((b) => `<tr>
            <td>${b.date}</td>
            <td class="price-val">${b.choicePrice ? "$" + parseFloat(b.choicePrice).toFixed(2) : "N/A"}</td>
            <td class="price-val">${b.selectPrice ? "$" + parseFloat(b.selectPrice).toFixed(2) : "N/A"}</td>
          </tr>`).join("")}
        </table>
      </div>`;
    }

    // Pork cutout
    if (TRENDS_DATA.pork && TRENDS_DATA.pork.length > 0) {
      html += `<div class="commodity-section">
        <h4><span class="commodity-icon">\uD83E\uDD53</span> Pork Cutout (USDA Daily Report)</h4>
        <table class="commodity-table">
          <tr><th>Date</th><th>Carcass</th><th>Loin</th><th>Belly</th></tr>
          ${TRENDS_DATA.pork.map((p) => `<tr>
            <td>${p.date}</td>
            <td class="price-val">${p.carcassPrice ? "$" + parseFloat(p.carcassPrice).toFixed(2) : "N/A"}</td>
            <td>${p.loin ? "$" + parseFloat(p.loin).toFixed(2) : "N/A"}</td>
            <td>${p.belly ? "$" + parseFloat(p.belly).toFixed(2) : "N/A"}</td>
          </tr>`).join("")}
        </table>
      </div>`;
    }

    commEl.innerHTML = html;
  }

  // === NEWS ===
  const newsEl = document.getElementById("trends-news");
  if (newsEl && TRENDS_DATA.news) {
    newsEl.innerHTML = TRENDS_DATA.news.map((n) => `
      <div class="news-card">
        <div class="news-title">${n.title}</div>
        <div class="news-meta">${n.source} | Report #${n.reportId}</div>
      </div>
    `).join("");
  }

  // === TIMESTAMP ===
  const disc = document.getElementById("trends-disclaimer");
  if (disc && TRENDS_DATA.fetchedAt) {
    const dt = new Date(TRENDS_DATA.fetchedAt);
    disc.innerHTML += `<div class="trends-timestamp">Data fetched: ${dt.toLocaleString()}</div>`;
  }
}

function toggleProductionRegions(category) {
  if (!TRENDS_DATA || !TRENDS_DATA.productionRegions) return;

  regionVisible[category] = !regionVisible[category];
  const btn = document.getElementById("region-btn-" + category);

  if (regionVisible[category]) {
    btn.classList.add("active-" + category);
    const regions = TRENDS_DATA.productionRegions[category];
    const colors = REGION_COLORS[category];
    if (!regions) return;

    regions.forEach((r) => {
      // Size based on rank (rank 1 = biggest)
      const size = Math.max(20, 40 - r.rank * 4);

      const icon = L.divIcon({
        html: `<div class="region-marker" style="width:${size}px;height:${size}px;background:${colors.fill};border-color:${colors.border};">${colors.emoji}</div>`,
        className: "",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const m = L.marker([r.lat, r.lng], { icon: icon }).addTo(map);
      m.bindPopup(
        `<div class="popup-title">${r.label}</div>
         <div class="popup-stats" style="grid-template-columns:1fr;">
           <div class="popup-stat full">
             <div class="num">${r.volume}</div>
             <div class="lbl">Annual Production</div>
           </div>
           <div class="popup-stat full">
             <div class="num">#${r.rank}</div>
             <div class="lbl">National Ranking</div>
           </div>
         </div>
         <div class="popup-source">Source: USDA NASS</div>`
      );
      regionMarkers[category].push(m);
    });
  } else {
    btn.classList.remove("active-" + category);
    regionMarkers[category].forEach((m) => map.removeLayer(m));
    regionMarkers[category] = [];
  }
}

// ===== FOR SALE LISTINGS =====

const LISTING_ICONS = {
  farm: { emoji: "\uD83C\uDF3E", bg: "#16a34a" },
  ranch: { emoji: "\uD83D\uDC04", bg: "#d97706" },
  homestead: { emoji: "\uD83C\uDFE1", bg: "#7c3aed" },
};

let listingMarkersOnMap = [];
let listingsVisible = false;
let selectedListingIndex = -1;
const listingCluster = L.markerClusterGroup({
  maxClusterRadius: 50,
  iconCreateFunction: function (cluster) {
    return L.divIcon({
      html: '<div style="background:rgba(16,185,129,0.7);color:#fff;font-weight:700;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:11px;border:2px solid rgba(255,255,255,0.3);">' + cluster.getChildCount() + '</div>',
      className: '',
      iconSize: [36, 36],
    });
  },
});

function toggleListings() {
  if (typeof LISTINGS_DATA === "undefined") return;
  listingsVisible = !listingsVisible;
  const btn = document.getElementById("toggle-listings");
  btn.textContent = listingsVisible ? "Hide Listings" : "Show All on Map";

  if (listingsVisible) {
    showListingsOnMap(LISTINGS_DATA.listings);
  } else {
    map.removeLayer(listingCluster);
    listingCluster.clearLayers();
    listingMarkersOnMap = [];
  }
}

function showListingsOnMap(listings) {
  listingCluster.clearLayers();
  listingMarkersOnMap = [];

  listings.forEach((l, i) => {
    const iconInfo = LISTING_ICONS[l.category] || LISTING_ICONS.farm;
    const icon = L.divIcon({
      html: `<div class="listing-marker" style="width:26px;height:26px;background:${iconInfo.bg};">${iconInfo.emoji}</div>`,
      className: "",
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

    const m = L.marker([l.lat, l.lng], { icon: icon });
    m.bindPopup(
      `<div class="popup-title">$${l.price.toLocaleString()}</div>
       <div class="popup-location">${l.address ? l.address + "<br>" : ""}${l.city}, ${l.state} ${l.zip}</div>
       <div class="popup-stats" style="grid-template-columns:1fr 1fr;">
         <div class="popup-stat"><div class="num">${l.acres || "N/A"}</div><div class="lbl">Acres</div></div>
         <div class="popup-stat"><div class="num">${l.beds || 0}/${l.baths || 0}</div><div class="lbl">Beds/Baths</div></div>
       </div>
       <div style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;text-transform:uppercase;margin-top:4px;" class="listing-badge listing-badge-${l.category}">${l.category}</div>
       ${l.url ? '<div style="margin-top:6px;"><a href="' + l.url + '" target="_blank" style="color:#60a5fa;font-size:11px;">View on Redfin &rarr;</a></div>' : ''}
       <div class="popup-source">Source: ${l.source}</div>`,
      { maxWidth: 260 }
    );
    m.listingIndex = i;
    listingCluster.addLayer(m);
    listingMarkersOnMap.push(m);
  });

  map.addLayer(listingCluster);
}

function selectListing(index) {
  if (typeof LISTINGS_DATA === "undefined") return;
  const filtered = getFilteredListings();
  const l = filtered[index];
  if (!l) return;
  selectedListingIndex = index;

  // Show on map if not visible
  if (!listingsVisible) {
    toggleListings();
  }

  // Fly to listing
  map.flyTo([l.lat, l.lng], 12, { duration: 1.2 });

  // Open matching popup
  setTimeout(() => {
    listingMarkersOnMap.forEach((m) => {
      if (m.getLatLng().lat.toFixed(4) === l.lat.toFixed(4) &&
          m.getLatLng().lng.toFixed(4) === l.lng.toFixed(4)) {
        listingCluster.zoomToShowLayer(m, () => m.openPopup());
      }
    });
  }, 1400);

  // Update selected card highlight
  document.querySelectorAll(".listing-card").forEach((c, i) => {
    c.classList.toggle("selected", i === index);
  });
}

function getFilteredListings() {
  if (typeof LISTINGS_DATA === "undefined") return [];
  const cat = document.getElementById("filter-listing-cat").value;
  const state = document.getElementById("filter-listing-state").value;
  const price = document.getElementById("filter-listing-price").value;

  return LISTINGS_DATA.listings.filter((l) => {
    if (cat !== "all" && l.category !== cat) return false;
    if (state !== "all" && l.state !== state) return false;
    if (price === "under100k" && l.price >= 100000) return false;
    if (price === "100k-500k" && (l.price < 100000 || l.price >= 500000)) return false;
    if (price === "500k-1m" && (l.price < 500000 || l.price >= 1000000)) return false;
    if (price === "over1m" && l.price < 1000000) return false;
    return true;
  });
}

function filterListings() {
  const filtered = getFilteredListings();
  renderListingCards(filtered);

  // Update map markers to match filter
  if (listingsVisible) {
    showListingsOnMap(filtered);
  }
}

function renderListingCards(listings) {
  const list = document.getElementById("listing-list");
  const shown = listings.slice(0, 200);
  list.innerHTML = shown.map((l, i) => {
    const iconInfo = LISTING_ICONS[l.category] || LISTING_ICONS.farm;
    return `
      <div class="listing-card" onclick="selectListing(${i})" id="listing-card-${i}">
        <div class="listing-top">
          <div class="listing-price">$${l.price.toLocaleString()}</div>
          <span class="listing-badge listing-badge-${l.category}">${iconInfo.emoji} ${l.category}</span>
        </div>
        <div class="listing-address">${l.address || "Land/Property"}</div>
        <div class="listing-loc">${l.city}, ${l.state} ${l.zip}</div>
        <div class="listing-details">
          ${l.acres ? `<span>\uD83D\uDCCF ${l.acres} acres</span>` : ""}
          ${l.beds ? `<span>\uD83D\uDECF ${l.beds} bed</span>` : ""}
          ${l.baths ? `<span>\uD83D\uDEC1 ${l.baths} bath</span>` : ""}
        </div>
      </div>`;
  }).join("") + (listings.length > 200 ? `<div style="text-align:center;color:#64748b;font-size:11px;padding:8px;">Showing 200 of ${listings.length} — use filters or map</div>` : "");
}

function initListingsTab() {
  if (typeof LISTINGS_DATA === "undefined") return;
  const listings = LISTINGS_DATA.listings;

  // Stats
  document.getElementById("stat-listings").textContent = fmt(listings.length);
  const states = [...new Set(listings.map((l) => l.state))].sort();
  document.getElementById("stat-listing-states").textContent = states.length;

  // Populate state filter
  const sel = document.getElementById("filter-listing-state");
  states.forEach((st) => {
    const opt = document.createElement("option");
    opt.value = st;
    opt.textContent = st;
    sel.appendChild(opt);
  });

  // Render initial list
  renderListingCards(listings);
}

// ===== Init Flow Stats =====
function renderFlowStats() {
  const purchaseFlows = CATTLE_FLOWS.flows.filter((f) => f.type === "purchase");
  const slaughterFlows = CATTLE_FLOWS.flows.filter((f) => f.type === "slaughter");
  document.getElementById("stat-purchase-flows").textContent = purchaseFlows.length;
  document.getElementById("stat-slaughter-flows").textContent = slaughterFlows.length;

  // Net buyer list — aggregate by destination state
  const buyerMap = {};
  purchaseFlows.forEach((f) => {
    if (!buyerMap[f.to]) buyerMap[f.to] = 0;
    buyerMap[f.to] += f.head;
  });
  const buyers = Object.entries(buyerMap)
    .sort((a, b) => b[1] - a[1])
    .map(([st, head]) => `<strong>${st}</strong>: ~${fmt(head)} head purchased/yr`)
    .join("<br>");
  const el = document.getElementById("net-buyer-list");
  if (el) el.innerHTML = buyers;
}

// ===== Init =====
populateFilters();
renderStats(computeStats(COUNTY_CATTLE_DATA));
renderMarketData();
renderAuctionList();
populateDealerFilters();
filterDealerList();
renderHistoricStats();
filterHistoricList();
renderFlowStats();
renderTrendsData();
initListingsTab();

// Expose toggle functions
window.toggleTrucks = toggleTrucks;
window.toggleAuctions = toggleAuctions;
window.selectAuction = selectAuction;
window.toggleDealers = toggleDealers;
window.toggleHistoric = toggleHistoric;
window.filterDealerList = filterDealerList;
window.filterHistoricList = filterHistoricList;
window.toggleProductionRegions = toggleProductionRegions;
window.toggleListings = toggleListings;
window.selectListing = selectListing;
window.filterListings = filterListings;
