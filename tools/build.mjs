// Bundles the app into one self-contained index.html (no build dependencies).
// Each ES module is wrapped in its own scope; imports become lookups.
//   node tools/build.mjs   ->   index.html
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const modules = [
  ["engine", "src/engine.js"],
  ["ledger", "app/ledger.js"],
  ["i18n", "app/i18n.js"],
  ["app", "app/app.js"],
];
const pathToName = { "../src/engine.js": "engine", "./ledger.js": "ledger", "./i18n.js": "i18n" };

function wrap(name, src) {
  const exported = [...src.matchAll(/^export\s+(?:async\s+)?(?:function|const|class|let)\s+(\w+)/gm)].map((m) => m[1]);
  let body = src.replace(/^export\s+/gm, "");
  body = body.replace(/^import\s*\{([^}]+)\}\s*from\s*"([^"]+)";?/gms, (_, names, from) => {
    const mod = pathToName[from];
    if (!mod) throw new Error(`unknown import ${from}`);
    return `const {${names}} = __m.${mod};`;
  });
  return `__m.${name} = (() => {\n${body}\nreturn { ${exported.join(", ")} };\n})();`;
}

const data = {
  RULES: JSON.parse(read("data/rules.json")),
  DEMO: JSON.parse(read("data/demo_families.json")),
  DASH: JSON.parse(read("data/dashboard.json")),
};
const js = [
  "const __m = {};",
  ...Object.entries(data).map(([k, v]) => `const ${k} = ${JSON.stringify(v)};`),
  ...modules.map(([n, p]) => wrap(n, read(p))),
].join("\n");

const html = `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CareTrail Screening Passport</title>
<meta name="description" content="CareTrail: a family screening passport and program view for Abu Dhabi's IFHAS and Well-Child programs. Prototype on synthetic data.">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#0b5d57"/><circle cx="10" cy="29" r="4" fill="#fff"/><circle cx="20" cy="20" r="4" fill="#fff"/><circle cx="30" cy="11" r="5" fill="#e0a53e"/></svg>')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
${read("app/styles.css")}
</style>
</head>
<body>
<div id="app"></div>
<noscript>CareTrail needs JavaScript.</noscript>
<script type="module">
${js}
</script>
</body>
</html>
`;
writeFileSync(new URL("../index.html", import.meta.url), html);
// Body-only variant for hosts that supply their own document skeleton.
const frag = html.replace(/^<!doctype html>\n<html[^>]*>\n<head>\n<meta charset="utf-8">\n<meta name="viewport"[^>]*>\n/, "").replace("</head>\n<body>\n", "").replace("</body>\n</html>\n", "");
mkdirSync(new URL("../dist/", import.meta.url), { recursive: true });
writeFileSync(new URL("../dist/caretrail-preview.html", import.meta.url), frag);
console.log(`index.html written (${(html.length / 1024).toFixed(0)} KB)`);
