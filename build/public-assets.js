import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

// Build a disposable public directory. Existing repositories may keep artwork
// in root/assets; native public assets take priority, including new process SVGs.
// Never move or delete the owner's source artwork, and never duplicate it in git.
export function preparePublicAssets(root) {
    const destination = resolve(root, ".cache/static-public");
    rmSync(destination, { recursive: true, force: true });
    mkdirSync(destination, { recursive: true });
    for (const name of ["assets", "fonts"]) {
        const source = resolve(root, name);
        if (existsSync(source)) cpSync(source, resolve(destination, name), { recursive: true });
    }
    const nativePublic = resolve(root, "public");
    if (existsSync(nativePublic)) cpSync(nativePublic, destination, { recursive: true });
    return destination;
}
