// Draws a plain nutrition table as an image, for the label-scan test. node scripts/fixtures/make-label.mjs
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
const html = `<body style="margin:0;background:#fff"><pre style="font:44px/64px Helvetica,Arial,sans-serif;margin:30px 40px;color:#000">NUTRITIONAL INFORMATION
Per 100 g        Per 30 g serving
Energy           1050 kJ / 251 kcal
Protein          8.5 g
Carbohydrate     12.3 g
  of which sugars 3.1 g
Total Fat        18.2 g
  of which saturated 2.4 g
Dietary Fibre    5.0 g
Sodium           480 mg</pre></body>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 760 } });
await p.setContent(html);
await p.screenshot({ path: fileURLToPath(new URL("./label.png", import.meta.url)) });
await b.close();
