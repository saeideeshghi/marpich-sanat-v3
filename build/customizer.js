import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { normalizeConfig, compileCSS } from "../src/js/customizer/model.js";
import { imageSourceRules } from "../src/js/customizer/image-source.js";
import { pages } from "./pages.js";
import { loadDesignConfig, settingsText } from "./design-config.js";

export function templateCustomizer(root, base) {
    const settingsPath = resolve(root, "src/data/customizer/settings.json");
    const cssPath = resolve(root, "src/css/template-overrides.css");
    const patternPaths = {
        header: resolve(root, "src/data/patterns/site-pattern.json"),
        footer: resolve(root, "src/data/patterns/footer-pattern.json"),
    };
    const token = randomBytes(24).toString("hex");
    const load = () => loadDesignConfig(root);
    const revision = (config) => createHash("sha256").update(JSON.stringify(config)).digest("hex");
    const atomicWrite = (path, content) => {
        mkdirSync(dirname(path), { recursive: true });
        const temp = `${path}.${process.pid}.tmp`;
        writeFileSync(temp, content, "utf8");
        renameSync(temp, path);
    };
    const updateCSS = () => {
        const css = compileCSS(load());
        if (!existsSync(cssPath) || readFileSync(cssPath, "utf8") !== css) atomicWrite(cssPath, css);
    };
    const json = (res, status, value) => {
        res.statusCode = status;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify(value));
    };
    updateCSS();
    return {
        name: "marpich-template-customizer",
        handleHotUpdate(context) {
            // Saving the shared artwork updates the live player without losing
            // the editor's selection/history to Vite's JSON module reload.
            if (Object.values(patternPaths).includes(context.file)) return [];
        },
        transformIndexHtml: {
            order: "post",
            handler(html, context) {
                if (!pages.some((page) => resolve(root, page.file) === context.filename)) return html;
                const config = load();
                const styleVersion = createHash("sha256").update(compileCSS(config)).digest("hex").slice(0, 12);
                return [
                    ...(context.filename === resolve(root, "about.html")
                        ? [
                              {
                                  tag: "script",
                                  attrs: { id: "mps-image-sources", type: "application/json" },
                                  children: JSON.stringify(imageSourceRules(config.rules)),
                                  injectTo: "head",
                              },
                          ]
                        : []),
                    {
                        tag: "link",
                        attrs: {
                            id: "mps-template-overrides",
                            rel: "stylesheet",
                            href: `${base}assets/customizer/template-overrides.css?v=${styleVersion}`,
                        },
                        injectTo: "head",
                    },
                ];
            },
        },
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const path = new URL(req.url || "/", "http://localhost").pathname;
                if (path === `${base}assets/customizer/template-overrides.css`) {
                    res.setHeader("Content-Type", "text/css; charset=utf-8");
                    res.setHeader("Cache-Control", "no-store");
                    res.end(compileCSS(load()));
                    return;
                }
                if (path === `${base}assets/customizer/settings.json`) return json(res, 200, load());
                if (path !== `${base}__customizer/settings`) return next();
                if (req.method === "GET")
                    return json(
                        res,
                        200,
                        (() => {
                            const config = load();
                            return { config, revision: revision(config), token, canSave: true };
                        })(),
                    );
                if (req.method !== "POST") return json(res, 405, { error: "روش درخواست معتبر نیست." });
                // File writes are available only to this same-origin editor.
                const origin = req.headers.origin;
                let originHost;
                try {
                    if (origin) originHost = new URL(origin).host;
                } catch {
                    return json(res, 403, { error: "مبدأ درخواست معتبر نیست." });
                }
                if (
                    req.headers["x-marpich-customizer"] !== token ||
                    req.headers["sec-fetch-site"] === "cross-site" ||
                    (originHost && originHost !== req.headers.host)
                )
                    return json(res, 403, { error: "ثبت فقط از ویرایشگر همین پروژه مجاز است." });
                if (!req.headers["content-type"]?.startsWith("application/json"))
                    return json(res, 415, { error: "درخواست JSON لازم است." });
                try {
                    let body = "";
                    for await (const chunk of req) {
                        body += chunk.toString("utf8");
                        if (Buffer.byteLength(body) > 2097152)
                            return json(res, 413, { error: "حجم تنظیمات بیش از حد است." });
                    }
                    const request = JSON.parse(body);
                    const current = load();
                    if (request.revision !== revision(current))
                        return json(res, 409, {
                            error: "تنظیمات در پنجره دیگری تغییر کرده. صفحه را تازه کن و دوباره بررسی کن.",
                        });
                    const config = normalizeConfig({
                        ...request.config,
                        patterns: request.config.patterns || current.patterns,
                    });
                    const css = compileCSS(config);
                    const updates = [
                        [cssPath, css],
                        [settingsPath, settingsText(config)],
                        ...Object.entries(patternPaths).map(([key, path]) => [
                            path,
                            `${JSON.stringify(config.patterns[key], null, 2)}\n`,
                        ]),
                    ];
                    const previous = updates.map(([path]) => [path, readFileSync(path, "utf8")]);
                    try {
                        for (const [path, text] of updates)
                            if (readFileSync(path, "utf8") !== text) atomicWrite(path, text);
                    } catch (error) {
                        for (const [path, text] of previous) atomicWrite(path, text);
                        throw error;
                    }
                    server.ws.send({
                        type: "custom",
                        event: "marpich:template-saved",
                        data: { revision: revision(config) },
                    });
                    return json(res, 200, { config, revision: revision(config), canSave: true });
                } catch (error) {
                    return json(res, 400, { error: error.message || "ثبت تنظیمات انجام نشد." });
                }
            });
        },
        generateBundle() {
            const config = load();
            this.emitFile({
                type: "asset",
                fileName: "assets/customizer/template-overrides.css",
                source: compileCSS(config),
            });
            this.emitFile({
                type: "asset",
                fileName: "assets/customizer/settings.json",
                source: `${JSON.stringify(config, null, 2)}\n`,
            });
        },
    };
}
