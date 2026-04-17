const axios = require("axios");
const HttpError = require("../utils/HttpError");

function extractText(resp) {
  return (
    resp?.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    resp?.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    ""
  );
}

async function generateGeminiText(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpError(503, "GEMINI_API_KEY is not configured on backend");
  }

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: String(prompt || "") }],
      },
    ],
  };

  const preferredModel = String(process.env.GEMINI_MODEL || "").trim();
  const modelCandidates = [
    preferredModel,
    "gemini-flash-latest",
    "gemini-2.0-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
  ].filter(Boolean);

  let lastErr = null;
  for (const model of modelCandidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent`;
    try {
      const resp = await axios.post(`${url}?key=${encodeURIComponent(apiKey)}`, body, {
        timeout: 45_000,
        headers: { "Content-Type": "application/json" },
      });
      const text = extractText(resp).trim();
      if (!text) {
        throw new HttpError(502, "Gemini returned an empty response");
      }
      return text;
    } catch (err) {
      lastErr = err;
      const status = err?.response?.status;
      if (status !== 404) {
        throw err;
      }
    }
  }

  const status = lastErr?.response?.status;
  const msg = lastErr?.message || "Gemini request failed";
  throw new HttpError(
    502,
    `Gemini model not available (last status ${status ?? "?"}): ${msg}`
  );
}

module.exports = { generateGeminiText };

