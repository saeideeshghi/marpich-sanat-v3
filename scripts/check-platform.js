// Exercise Windows/POSIX paths and checkout line endings without modifying any
// project files. Builtin mocks stay in this process and are always restored.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { syncBuiltinESMExports } from "node:module";
import { spawnSync } from "node:child_process";
import { collectDesignTokens, designTokenReference } from "../build/design-tokens.js";
import { tokenContract } from "../build/token-contract.js";
import { publishCommand } from "./publish-github.js";

const root = path.resolve(import.meta.dirname, "..");
const baseline = collectDesignTokens(root);
const contracts = tokenContract(baseline);
const native = {
    readFileSync: fs.readFileSync,
    readdirSync: fs.readdirSync,
    resolve: path.resolve,
    relative: path.relative,
};

for (const platform of ["posix", "win32"]) {
    for (const crlf of [false, true]) {
        const virtualRoot = platform === "win32" ? "C:\\fixture\\marpich-sanat" : "/fixture/marpich-sanat";
        const localPath = (file) =>
            typeof file === "string" && file.startsWith(virtualRoot)
                ? root + file.slice(virtualRoot.length).replaceAll("\\", "/")
                : file;
        let ignoredReads = 0;
        try {
            path.resolve = path[platform].resolve;
            path.relative = path[platform].relative;
            fs.readdirSync = (file, ...args) => native.readdirSync(localPath(file), ...args).reverse();
            fs.readFileSync = (file, ...args) => {
                const physical = localPath(file);
                let value = native.readFileSync(physical, ...args);
                if (typeof value !== "string") return value;
                const relative =
                    typeof physical === "string" ? native.relative(root, physical).replaceAll("\\", "/") : "";
                // This saved header override reproduced the user's assertion.
                // UI-only declarations also must stay out of the website catalog.
                if (relative === "src/css/template-overrides.css") {
                    ignoredReads++;
                    value += "\nbody[data-page] .site-header { --header-fixed-scroll-threshold: 128px; }\n";
                } else if (["src/css/customizer.css", "src/css/token-reference.css"].includes(relative)) {
                    ignoredReads++;
                    value += "\n.editor-fixture { --fixture-ui-only: #abcdef; }\n";
                }
                return crlf ? value.replace(/\r?\n/g, "\r\n") : value;
            };
            syncBuiltinESMExports();
            const tokens = collectDesignTokens(virtualRoot);
            assert.equal(ignoredReads, 0, "Generated/editor CSS must be excluded before parsing");
            assert.deepEqual(tokenContract(tokens), contracts, `${platform}/${crlf ? "CRLF" : "LF"} contracts`);
            assert.deepEqual(tokens, baseline, "Portable paths, page owners, lines and directory ordering");

            const plugin = designTokenReference(virtualRoot);
            const module = { id: "fixture" };
            let invalidations = 0;
            const context = (file) => ({
                file: path.resolve(virtualRoot, file),
                modules: [],
                server: {
                    moduleGraph: {
                        getModuleById: () => module,
                        invalidateModule: () => {
                            invalidations++;
                        },
                    },
                },
            });
            assert.deepEqual(plugin.handleHotUpdate(context("src/css/type-settings.css")), [module]);
            assert.equal(invalidations, 1);
            assert.equal(plugin.handleHotUpdate(context("src/css/template-overrides.css")), undefined);
            assert.equal(invalidations, 1, "Saved override CSS must not invalidate the source catalog");
        } finally {
            Object.assign(fs, { readFileSync: native.readFileSync, readdirSync: native.readdirSync });
            Object.assign(path, { resolve: native.resolve, relative: native.relative });
            syncBuiltinESMExports();
        }
    }
}

const node = "C:\\Program Files\\nodejs\\node.exe";
const npm = "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js";
assert.deepEqual(
    publishCommand("npm", ["run", "check"], {
        platform: "win32",
        execPath: node,
        npmExecPath: npm,
    }),
    { program: node, args: [npm, "run", "check"] },
);
const fallback = { platform: "win32", npmExecPath: null, comSpec: "cmd.exe" };
assert.deepEqual(publishCommand("npm", ["run", "check"], fallback), {
    program: "cmd.exe",
    args: ["/d", "/s", "/c", "npm run check"],
});
assert.throws(() => publishCommand("npm", ["run", "check; echo bad"], fallback), /Unsupported npm command/);
assert.deepEqual(publishCommand("git", ["status", "--short"], fallback), {
    program: "git",
    args: ["status", "--short"],
});
assert.deepEqual(publishCommand("npm", ["ci"], { platform: "linux" }), { program: "npm", args: ["ci"] });
if (process.env.npm_execpath && fs.existsSync(process.env.npm_execpath)) {
    const command = publishCommand("npm", ["--version"], { platform: "win32" });
    const result = spawnSync(command.program, command.args, { encoding: "utf8", shell: false });
    assert.equal(result.status, 0, result.stderr);
    assert(/^\d+\.\d+\.\d+/.test(result.stdout.trim()));
    assert(!result.stderr.includes("DEP0190"));
}
console.log(
    "PASS: Windows/POSIX catalog parity, LF/CRLF, saved CSS isolation, deterministic owners/HMR and npm invocation without shell:true.",
);
