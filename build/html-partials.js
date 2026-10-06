/* Compile-time composition: root HTML -> shared partials + page JSON -> native HTML.
 * @include is not Razor syntax and never runs in the browser. CMS content outside
 * these includes is still hardcoded in the root HTML; see the per-page handoff.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import { pages } from "./pages.js";
import { renderComponent } from "./components.js";

const partialNames = ["header", "mobile-menu", "footer", "auth-modal"];

// Native HTML is produced before Vite processes scripts and assets.
// There is no browser fetch, client-side HTML injection, or extra dependency.
export function renderPage(html, filename, root) {
    const page = pages.find((item) => item.file === basename(filename));
    if (!page) return html;

    const dataPath = resolve(root, "src/data/pages", `${page.name}.json`);
    const data = existsSync(dataPath) ? JSON.parse(readFileSync(dataPath, "utf8")) : {};
    return html.replace(/<!--\s*@include\s+([\w-]+)(?:\s+([\w-]+))?\s*-->/g, (_, name, key) => {
        if (key) {
            if (!Object.hasOwn(data, key)) throw new Error(`${page.file}: missing component data ${key}`);
            return renderComponent(name, data[key], root);
        }
        if (!partialNames.includes(name)) throw new Error(`Unknown HTML partial: ${name}`);
        const partial = readFileSync(resolve(root, "src/components", `${name}.html`), "utf8");
        return partial.replace(/<(?:a|button)\b[^>]*\bdata-nav="([^"]+)"[^>]*>/g, (tag, nav) => {
            if (nav !== page.activeNav) return tag;
            const destination = tag.match(/\bhref="([^"]+)"/)?.[1];
            const current = destination === page.file ? "page" : "true";
            return tag.replace(/>$/, ` aria-current="${current}">`);
        });
    });
}

export function htmlPartials(root) {
    const directory = resolve(root, "src/components");
    const dataDirectory = resolve(root, "src/data");
    return {
        name: "marpich-html-partials",
        transformIndexHtml: {
            order: "pre",
            handler(html, context) {
                return renderPage(html, context.filename, root);
            },
        },
        configureServer(server) {
            server.watcher.add([directory, dataDirectory]);
            server.watcher.on("change", (file) => {
                if (
                    file.startsWith(directory) ||
                    (file.startsWith(dataDirectory) &&
                        !file.startsWith(resolve(dataDirectory, "customizer")) &&
                        !file.startsWith(resolve(dataDirectory, "patterns")))
                )
                    server.ws.send({ type: "full-reload" });
            });
        },
    };
}
