import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import sharp from "sharp";
import { compilePatternModule } from "../build/pattern-runtime.js";
import { normalizePattern } from "../src/js/customizer/pattern-model.js";
import { optimizePublicAssets } from "../build/optimized-assets.js";
import { compositorFrames } from "../src/js/components/product-category-motion.js";

const root = resolve(import.meta.dirname, "..");
for (const alignment of ["left", "right"]) {
    const initial = {
        left: "30px",
        right: alignment === "right" ? "20px" : "",
        top: "10px",
        width: "100px",
        height: "50px",
    };
    const target = {
        ...(alignment === "right" ? { right: "80px" } : { left: "80px" }),
        top: "45px",
        width: "300px",
        height: "150px",
        borderRadius: "12px",
        offset: 1,
    };
    const frame = compositorFrames([target], initial)[0];
    const [dx, dy, sx, sy] = [...frame.transform.matchAll(/-?[\d.]+/g)].map((m) => Number(m[0]));
    assert.equal(100 * sx, 300);
    assert.equal(50 * sy, 150);
    assert.equal(10 + dy, 45);
    assert.equal(alignment === "right" ? 20 - dx : 30 + dx, 80);
    assert.equal(frame.borderRadius, "4px / 4px");
    assert.equal(frame.offset, 1);
    assert.equal(target.width, "300px", "Input frames remain immutable");
}
for (const name of ["site-pattern", "footer-pattern"]) {
    const source = JSON.parse(readFileSync(resolve(root, `src/data/patterns/${name}.json`)));
    const compiled = compilePatternModule(source);
    const imported = (await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)).default;
    assert.deepEqual(imported, normalizePattern(source), "Runtime compaction must preserve every setting and path");
    assert(compiled.length < JSON.stringify(source).length / 2, "Remove duplicate artwork/path data");
    console.log(`${name}: ${JSON.stringify(source).length} -> ${compiled.length} bytes`);
}
const fixture = mkdtempSync(resolve(tmpdir(), "marpich-assets-"));
try {
    const publicRoot = resolve(fixture, "public");
    mkdirSync(resolve(publicRoot, "assets"), { recursive: true });
    const pixels = Buffer.alloc(256 * 256 * 4);
    for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = (i / 4) % 256;
        pixels[i + 1] = Math.floor(i / 1024);
        pixels[i + 2] = 37;
        pixels[i + 3] = (i / 4) % 255;
    }
    const png = await sharp(pixels, { raw: { width: 256, height: 256, channels: 4 } })
        .png({ compressionLevel: 0 })
        .toBuffer();
    const original = resolve(publicRoot, "assets/photo.png");
    writeFileSync(original, png);
    const first = await optimizePublicAssets(fixture, publicRoot);
    assert(first.imageMap["/assets/photo.png"]);
    const derived = readFileSync(`${original}.webp`);
    // WebP may discard RGB under alpha=0; those colours cannot be displayed.
    // Every alpha value and every visible pixel must remain byte-identical.
    const visible = async (bytes) => {
        const raw = await sharp(bytes).ensureAlpha().raw().toBuffer();
        for (let i = 0; i < raw.length; i += 4) if (raw[i + 3] === 0) raw.fill(0, i, i + 3);
        return raw;
    };
    assert.deepEqual(
        await visible(derived),
        await visible(png),
        "Lossless visible RGBA pixels, including transparency",
    );
    assert.deepEqual(readFileSync(original), png, "Owner's original is untouched");
    const second = await optimizePublicAssets(fixture, publicRoot);
    assert.deepEqual(second.imageMap, first.imageMap, "Repeat builds produce the same map");
    assert.deepEqual(readFileSync(`${original}.webp`), derived);
} finally {
    rmSync(fixture, { recursive: true, force: true });
}
console.log(
    "PASS: exact pattern settings, lossless image pixels/transparency, source preservation and repeatable encoding.",
);
