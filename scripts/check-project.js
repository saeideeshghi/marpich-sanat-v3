import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pages } from "../build/pages.js";
import { renderPage } from "../build/html-partials.js";

const root = resolve(import.meta.dirname, "..");
const rendered = new Map(
    pages.map((page) => [page.file, renderPage(readFileSync(resolve(root, page.file), "utf8"), page.file, root)]),
);
const ids = (html) => [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
let placeholders = 0;
assert.equal(pages.length, new Set(pages.map(({ name }) => name)).size, "duplicate page names");
assert.equal(pages.length, new Set(pages.map(({ file }) => file)).size, "duplicate page files");
for (const filename of readdirSync(root).filter((file) => file.endsWith(".html"))) {
    assert(
        pages.some((page) => page.file === filename),
        `${filename}: not registered in build/pages.js`,
    );
}

for (const page of pages) {
    const source = readFileSync(resolve(root, page.file), "utf8");
    const html = rendered.get(page.file);
    const prefix = `${page.file}: `;
    assert.equal((source.match(/<script\b/g) || []).length, 1, prefix + "use one page entry");
    assert(source.includes(`/src/js/pages/${page.name}.js`), prefix + "wrong entry");
    assert(existsSync(resolve(root, `src/css/pages/${page.name}.css`)), prefix + "missing page CSS");
    const entry = readFileSync(resolve(root, `src/js/pages/${page.name}.js`), "utf8");
    assert(entry.includes('"../../css/main.css"'), prefix + "missing shared stylesheet import");
    assert(entry.includes(`"../../css/pages/${page.name}.css"`), prefix + "missing page stylesheet import");
    assert.equal((entry.match(/\binitSite\(\)/g) || []).length, 1, prefix + "initialize shared behavior once");
    assert(!html.includes("@include"), prefix + "unresolved partial");
    assert(!html.includes("/src/assets/"), prefix + "old asset path");
    assert.equal((html.match(/<header\b/g) || []).length, 1, prefix + "duplicate/missing header");
    assert.equal((html.match(/<footer\b/g) || []).length, 1, prefix + "duplicate/missing footer");
    const heroTags = [...html.matchAll(/<(?:section|div)\b[^>]*\bdata-site-hero(?=\s|=|>)[^>]*>/gs)];
    assert.equal(heroTags.length, 1, prefix + "use one shared hero root");
    const heroId = `hero-${page.file.replace(/\.html$/, "")}`;
    assert(heroTags[0][0].includes(`id="${heroId}"`), prefix + "wrong per-page hero ID");
    assert.equal((html.match(/\bdata-mobile-menu(?:\s|=|>)/g) || []).length, 1, prefix + "duplicate/missing menu");
    assert.equal(
        (html.match(/\bdata-auth-modal(?:\s|=|>)/g) || []).length,
        1,
        prefix + "duplicate/missing auth dialog",
    );
    assert.equal((html.match(/\bdata-auth-open=/g) || []).length, 2, prefix + "missing desktop/mobile auth trigger");
    const pageIds = ids(html);
    assert.equal(pageIds.length, new Set(pageIds).size, prefix + "duplicate IDs");
    assert(html.includes('aria-current="'), prefix + "missing active navigation");

    for (const [, href] of html.matchAll(/\bhref="([^"]*)"/g)) {
        if (href === "#" || href === "") {
            placeholders++;
            continue;
        }
        if (/^(https?:|tel:|mailto:|\/assets\/)/.test(href)) continue;
        const [path, hash] = href.split("#");
        const target = path === "/" ? "index.html" : path.replace(/^\//, "") || page.file;
        assert(rendered.has(target), prefix + `missing local target ${href}`);
        if (hash) assert(ids(rendered.get(target)).includes(hash), prefix + `missing anchor ${href}`);
    }
}
console.log(
    `PASS: ${pages.length} pages; one entry, header, footer, menu and auth dialog each; valid imports, IDs and local links.`,
);
console.log(
    `INFO: ${placeholders} existing placeholder links remain across rendered pages; see README.md (open items).`,
);
