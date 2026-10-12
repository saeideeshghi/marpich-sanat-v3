import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import sharp from "sharp";
import woff2 from "wawoff2";

const digest = (data) => createHash("sha256").update(data).digest("hex");
function files(directory) {
    if (!existsSync(directory)) return [];
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(directory, entry.name);
        return entry.isDirectory() ? files(path) : [path];
    });
}

// Work only on the disposable public copy. Cache by bytes, so changing an
// owner's image/font always invalidates the derived asset on the next build.
export async function optimizePublicAssets(root, publicRoot) {
    const cache = resolve(root, ".cache/asset-encoding-v1");
    mkdirSync(cache, { recursive: true });
    const imageMap = {},
        savings = { original: 0, optimized: 0, fonts: 0, images: 0, embedded: 0 };
    async function encode(bytes, kind) {
        const path = resolve(cache, `${digest(bytes)}.${kind}`);
        if (existsSync(path)) return readFileSync(path);
        const output =
            kind === "woff2"
                ? Buffer.from(await woff2.compress(bytes))
                : await sharp(bytes, { limitInputPixels: 40000000 }).webp({ lossless: true, effort: 4 }).toBuffer();
        writeFileSync(path, output);
        return output;
    }
    for (const path of files(publicRoot)) {
        const source = readFileSync(path);
        if (/\.ttf$/i.test(path)) {
            if (existsSync(path.replace(/\.ttf$/i, ".woff2"))) continue;
            const encoded = await encode(source, "woff2");
            writeFileSync(path.replace(/\.ttf$/i, ".woff2"), encoded);
            savings.fonts++;
            savings.original += source.length;
            savings.optimized += encoded.length;
        } else if (/\.(?:png|jpe?g)$/i.test(path) && source.length > 16000) {
            const metadata = await sharp(source).metadata();
            // Keep EXIF orientation/ICC-sensitive or animated custom assets
            // intact. Built-in photos have neither; WebP preserves their pixels.
            if (metadata.orientation || metadata.icc || metadata.pages > 1) continue;
            const encoded = await encode(source, "webp");
            if (encoded.length >= source.length) continue;
            writeFileSync(`${path}.webp`, encoded);
            const url = `/${relative(publicRoot, path).replaceAll("\\", "/")}`;
            imageMap[url] = `${url}.webp`;
            savings.images++;
            savings.original += source.length;
            savings.optimized += encoded.length;
        } else if (/\.svg$/i.test(path)) {
            let svg = source.toString("utf8");
            for (const match of [...svg.matchAll(/data:image\/(?:png|jpeg);base64,([a-z\d+/=\s]+)(?=["'])/gi)]) {
                const bitmap = Buffer.from(match[1].replace(/\s/g, ""), "base64");
                if (bitmap.length < 16000) continue;
                const metadata = await sharp(bitmap).metadata();
                if (metadata.orientation || metadata.icc || metadata.pages > 1) continue;
                const encoded = await encode(bitmap, "webp");
                if (encoded.length >= bitmap.length) continue;
                svg = svg.replace(match[0], `data:image/webp;base64,${encoded.toString("base64")}`);
                savings.embedded++;
                savings.original += bitmap.length;
                savings.optimized += encoded.length;
            }
            if (svg !== source.toString("utf8")) writeFileSync(path, svg);
        }
    }
    const assets = resolve(publicRoot, "assets");
    mkdirSync(assets, { recursive: true });
    writeFileSync(resolve(assets, "image-manifest.json"), JSON.stringify(imageMap, null, 2) + "\n");
    return { imageMap, savings };
}

export function optimizedImages(imageMap) {
    return {
        name: "marpich-optimized-images",
        transformIndexHtml: {
            order: "pre",
            handler(html) {
                return html.replace(/\b(src|poster)=(['"])(.*?)\2/g, (tag, attr, quote, url) =>
                    imageMap[url] ? `${attr}=${quote}${imageMap[url]}${quote}` : tag,
                );
            },
        },
    };
}
