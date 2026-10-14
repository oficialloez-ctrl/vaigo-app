const https = require("https");
const cache = new Map();

const get = (url, headers = {}) => new Promise((resolve, reject) => {
  const req = https.get(url, {
    headers: {
      "User-Agent": "VaiGoApp/2.0 (urban-mobility-demo)",
      "Accept": "application/json",
      ...headers
    }
  }, res => {
    let s = "";
    res.on("data", x => { s += x; if (s.length > 500000) req.destroy(); });
    res.on("end", () => {
      if (res.statusCode !== 200) return reject(new Error("HTTP " + res.statusCode));
      try { resolve(JSON.parse(s)); } catch (e) { reject(e); }
    });
  });
  req.setTimeout(8000, () => req.destroy(new Error("Timeout")));
  req.on("error", reject);
});

const dist = (a, b, c, d) => {
  const r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r;
  const q = Math.sin(x / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(q)));
};

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ results: [] });

  const q = String(req.query.q || "").trim().slice(0, 160);
  const mode = String(req.query.mode || "suggest");
  // Default to Sao Paulo coordinates only if lat/lon not provided
  const lat = Number(req.query.lat) || -23.5617;
  const lon = Number(req.query.lon) || -46.6559;

  if (q.length < 3) return res.status(400).json({ results: [] });

  const cacheKey = [q.toLowerCase(), mode, lat.toFixed(2), lon.toFixed(2)].join("|");
  const previous = cache.get(cacheKey);
  if (previous && Date.now() - previous.at < 120000) {
    return res.json({ results: previous.data });
  }

  const results = [];

  // 1. Photon geocoder with spatial bias around user coordinates
  try {
    const phUrl = "https://photon.komoot.io/api/?" + new URLSearchParams({
      q,
      limit: "10",
      lat: String(lat),
      lon: String(lon)
    });
    const ph = await get(phUrl);
    for (const f of ph.features || []) {
      const p = f.properties || {};
      const c = f.geometry?.coordinates || [];
      if (c.length !== 2) continue;
      const title = p.housenumber && p.street ? `${p.street}, ${p.housenumber}` : (p.name || p.street || "Local");
      const hint = [p.street, p.city || p.county, p.state].filter(Boolean).join(", ");
      results.push({
        name: title,
        hint: hint || p.country || "",
        lat: c[1],
        lon: c[0],
        type: ["shop", "amenity", "tourism", "office"].includes(p.osm_key) ? "place" : "address"
      });
    }
  } catch (e) {
    // photon failed, proceed to nominatim
  }

  // 2. Nominatim fallback (without forcing fixed city)
  if (mode === "address" || results.length < 3) {
    try {
      const nomUrl = "https://nominatim.openstreetmap.org/search?" + new URLSearchParams({
        q,
        format: "jsonv2",
        addressdetails: "1",
        limit: "6",
        countrycodes: "br",
        "accept-language": "pt-BR"
      });
      const nom = await get(nomUrl);
      for (const p of nom || []) {
        const title = p.name || p.display_name.split(",").slice(0, 2).join(",");
        results.push({
          name: title,
          hint: p.display_name,
          lat: Number(p.lat),
          lon: Number(p.lon),
          type: p.class === "highway" ? "address" : "place"
        });
      }
    } catch (e) {
      // nominatim failed
    }
  }

  // Deduplicate and rank by distance to user
  const seen = new Set();
  const clean = results
    .filter(p => {
      const k = p.lat.toFixed(4) + "|" + p.lon.toFixed(4) + "|" + p.name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map(p => ({ ...p, km: dist(lat, lon, p.lat, p.lon) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 10);

  cache.set(cacheKey, { at: Date.now(), data: clean });
  return res.status(200).json({ results: clean });
};
