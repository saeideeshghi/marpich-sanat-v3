// The browser and file-write endpoint share this generated, source-owned allowlist.
export function tokenContract(tokens) {
    const runtimeHelp = {
        "--articles-heading-bottom":
            "از انتهای واقعی عنوان مقالات محاسبه می‌شود؛ ارتفاع زمینه را با articles-backdrop-min-height تنظیم کن.",
        "--articles-search-backdrop-height":
            "از موقعیت فرم و دو سوم ارتفاع آن محاسبه می‌شود؛ خروجی اندازه‌گیری است و در هر عرض خودکار تغییر می‌کند.",
        "--contact-intro-background":
            "از ارتفاع متن تماس محاسبه می‌شود؛ ارتفاع زمینه را با contact-backdrop-min-height تنظیم کن.",
        "--hero-summary-overlap":
            "فاصلهٔ ایمن از محتوای هیرو خودکار است؛ مقدار درخواستی را با hero-summary-overlap-preferred تنظیم کن.",
        "--partners-scroll-distance": "مسافت برابر عرض واقعی لوگوهاست؛ تغییر دستی آن در حلقهٔ حرکت درز ایجاد می‌کند.",
        "--partners-scroll-duration": "مدت حرکت از عرض نوار محاسبه می‌شود؛ این مقدار خروجی محاسبه است.",
        "--site-pattern-scene-height": "ارتفاع خروجی پترن است؛ از تب پترن ← ارتفاع مبنا تنظیمش کن.",
    };
    return Object.fromEntries(
        tokens.map((token) => {
            const name = token.name;
            const kind =
                name === "--font-peyda"
                    ? "font"
                    : /(?:color|page-bg|shadow)/.test(name)
                      ? name.includes("shadow")
                          ? "shadow"
                          : "color"
                      : name === "--expertise-artwork-ratio"
                        ? "ratio"
                        : /(?:columns|lines|order|enabled)$/.test(name)
                          ? "integer"
                          : /(?:line-height|image-scale|background-opacity)$/.test(name)
                            ? "number"
                            : "length";
            const selectors = [
                ...new Set(
                    token.definitions
                        .filter((definition) => !definition.runtime && !definition.selector.startsWith("@"))
                        .map((definition) => definition.selector.replace(/::(?:before|after)\b/g, "")),
                ),
            ];
            const reason = token.runtime
                ? runtimeHelp[name]
                : name === "--breakpoint-laptop"
                  ? "شرط media هنگام ساخت تولید می‌شود؛ بازهٔ دلخواه را از انتخاب اندازهٔ همین پنل تنظیم کن."
                  : "";
            if (token.runtime && !reason) throw new Error(`Missing runtime token help: ${name}`);
            return [
                name,
                {
                    kind,
                    selectors,
                    editable: !reason,
                    ...(reason ? { reason } : {}),
                    ...(kind === "integer"
                        ? {
                              min: name.includes("order") ? -100 : /(?:lines|enabled)$/.test(name) ? 0 : 1,
                              max: name.endsWith("-enabled") ? 1 : 100,
                          }
                        : {}),
                    ...(kind === "number"
                        ? name.endsWith("-background-opacity")
                            ? { min: 0, max: 100 }
                            : { min: 0.1, max: 10 }
                        : {}),
                    property:
                        kind === "color"
                            ? "color"
                            : kind === "shadow"
                              ? "box-shadow"
                              : kind === "font"
                                ? "font-family"
                                : kind === "ratio"
                                  ? "aspect-ratio"
                                  : kind === "number"
                                    ? "line-height"
                                    : kind === "integer"
                                      ? "order"
                                      : /(?:image-left|image-top|summary-overlap|margin-top)/.test(name)
                                        ? "margin-left"
                                        : "width",
                },
            ];
        }),
    );
}
