const axios = require("axios");

function domainFromUrl(url) {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeSources(items, { limit = 6 } = {}) {
  const out = [];
  const seen = new Set();
  for (const it of items || []) {
    const url = String(it?.url || it?.link || "").trim();
    if (!url) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    const title = String(it?.title || it?.name || "").trim();
    const domain = domainFromUrl(url);
    out.push({ url, title, domain });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Web search provider (optional).
 *
 * Supported env:
 * - SERPAPI_API_KEY (https://serpapi.com/)
 * - BRAVE_SEARCH_API_KEY (https://brave.com/search/api/)
 *
 * If no key is configured, returns [] (fallback to LLM-only analysis).
 */
async function searchWebSources({ query, locale = "fr", limit = 6 }) {
  const q = String(query || "").trim();
  if (!q) return [];

  const serpKey = String(process.env.SERPAPI_API_KEY || "").trim();
  if (serpKey) {
    const resp = await axios.get("https://serpapi.com/search.json", {
      params: {
        engine: "google",
        q,
        hl: locale,
        num: Math.max(1, Math.min(limit, 10)),
        api_key: serpKey,
      },
      timeout: 15_000,
    });
    const results = resp?.data?.organic_results || [];
    return normalizeSources(
      results.map((r) => ({ url: r?.link, title: r?.title })),
      { limit }
    );
  }

  const braveKey = String(process.env.BRAVE_SEARCH_API_KEY || "").trim();
  if (braveKey) {
    const resp = await axios.get("https://api.search.brave.com/res/v1/web/search", {
      params: { q, count: Math.max(1, Math.min(limit, 10)) },
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": braveKey,
      },
      timeout: 15_000,
    });
    const results = resp?.data?.web?.results || [];
    return normalizeSources(
      results.map((r) => ({ url: r?.url, title: r?.title })),
      { limit }
    );
  }

  return [];
}

module.exports = { searchWebSources };

