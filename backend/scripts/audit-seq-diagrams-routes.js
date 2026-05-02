const fs = require("fs");
const path = require("path");

function readAllFiles(dir, { exts }) {
  const out = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) out.push(...readAllFiles(p, { exts }));
    else if (it.isFile()) {
      const lower = it.name.toLowerCase();
      if (exts.some((e) => lower.endsWith(e))) out.push(p);
    }
  }
  return out;
}

function normalizeRouteExample(s) {
  return s
    .replace(/\{[^}]+\}/g, ":id")
    .replace(/\/:id\b/g, "/:id")
    .replace(/\.\.\./g, "")
    .replace(/\/\*.*?\*\//g, "")
    .trim();
}

function fragmentsForBackendLookup(routeExample) {
  const noQuery = routeExample.split("?")[0];
  const out = new Set();
  out.add(noQuery);

  // Les fichiers backend définissent les chemins sans le préfixe "/api" (montage dans app).
  if (noQuery.startsWith("/api/")) {
    out.add(noQuery.slice("/api".length)); // "/projects/:id"

    // Enlever aussi le premier segment ressource (router monté sur "/<ressource>").
    // Exemple: "/api/projects/:id/archive" -> "/:id/archive"
    const parts = noQuery.split("/").filter(Boolean); // ["api","projects",":id","archive"]
    if (parts.length >= 3) {
      out.add("/" + parts.slice(2).join("/"));
    }
  }
  if (noQuery.startsWith("/api/admin/")) {
    out.add(noQuery.slice("/api/admin".length)); // "/notifications/:id/read"

    // Exemple: "/api/admin/projects/:id/publish" -> "/:id/publish" (monté sur "/projects")
    const parts = noQuery.split("/").filter(Boolean); // ["api","admin","projects",...]
    if (parts.length >= 4) {
      out.add("/" + parts.slice(3).join("/"));
    }
  }
  if (noQuery.startsWith("/internal/")) {
    out.add(noQuery); // les routes internal sont souvent définies avec "/run-risk-analysis"
    out.add(noQuery.slice("/internal".length));
  }

  return Array.from(out).filter(Boolean);
}

function main() {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const diagDir = path.join(repoRoot, "conception", "diagrame de sequence");
  const routesDir = path.join(repoRoot, "backend", "routes");

  if (!fs.existsSync(diagDir)) {
    console.log("[audit] Dossier de diagrammes introuvable:", diagDir);
    console.log("[audit] Rien à auditer. (Astuce: exportez vos diagrammes texte dans ce dossier ou adaptez le chemin.)");
    process.exit(0);
  }

  const diagramFiles = readAllFiles(diagDir, { exts: [".txt"] });
  const routeFiles = readAllFiles(routesDir, { exts: [".js", ".mjs", ".cjs"] });

  const routeSource = routeFiles.map((p) => fs.readFileSync(p, "utf8")).join("\n");

  const hits = new Map(); // routeExample -> {files:Set}
  const routeRegex = /(\/api\/[a-z0-9_\-\/:{}?=&.]+)|(\/internal\/[a-z0-9_\-\/:{}?=&.]+)/gi;

  for (const file of diagramFiles) {
    const txt = fs.readFileSync(file, "utf8");
    const m = txt.match(routeRegex) || [];
    for (const raw of m) {
      const norm = normalizeRouteExample(String(raw));
      if (!hits.has(norm)) hits.set(norm, { files: new Set() });
      hits.get(norm).files.add(path.relative(repoRoot, file));
    }
  }

  const missing = [];
  for (const [routeExample, meta] of hits) {
    const candidates = fragmentsForBackendLookup(routeExample);
    const ok = candidates.some((frag) => {
      const fragNoParams = frag.replace(/:id/g, "");
      return routeSource.includes(frag) || (fragNoParams && routeSource.includes(fragNoParams));
    });
    if (!ok) {
      missing.push({ routeExample, files: Array.from(meta.files) });
    }
  }

  missing.sort((a, b) => a.routeExample.localeCompare(b.routeExample));
  console.log("Routes uniques dans les diagrammes:", hits.size);
  console.log("Potentiellement manquantes dans les routes backend:", missing.length);
  for (const item of missing) {
    console.log("-", item.routeExample);
    for (const f of item.files) console.log("   ", f);
  }
}

main();

