// Build-time prerender: render <App/> to static HTML and inject it into the
// built index.html, so the page paints content before the JS hydrates.
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { render } = await import(
  pathToFileURL("dist/ssr-tmp/entry-server.js").href
);

const appHtml = render();
const tpl = readFileSync("dist/index.html", "utf-8");
const marker = '<div id="root"></div>';
if (!tpl.includes(marker)) {
  throw new Error("prerender: root placeholder not found in dist/index.html");
}
writeFileSync(
  "dist/index.html",
  tpl.replace(marker, `<div id="root">${appHtml}</div>`),
);
rmSync("dist/ssr-tmp", { recursive: true, force: true });
console.log(`prerender: injected ${appHtml.length} chars into dist/index.html`);
