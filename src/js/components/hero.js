/* Keep image/summary overlaps clear of the final wrapped hero text.
 * The preferred overlap comes from type-settings.css. Its actual value is
 * clamped to the space below the text, so future per-page font edits are safe. */
export function initHeroLayout() {
    const hero = document.querySelector("[data-site-hero]");
    const content = hero?.querySelector(".site-hero__content");
    if (!hero || !content) return;

    const summaries = {
        about: ".about-team-wrap",
        "project-details": ".project-details__summary",
        "product-details": "main > section:first-child",
        "industry-textile": ".industry-textile__summary",
    };
    const summary = document.querySelector(summaries[document.body.dataset.page] || "[data-hero-summary]");
    if (!summary || hero.dataset.heroLayoutInitialized) return;
    hero.dataset.heroLayoutInitialized = "true";

    const fitOverlap = () => {
        const text = hero.querySelector(".site-hero__description") || hero.querySelector(".site-hero__title");
        if (!text) return;
        const heroBottom = hero.getBoundingClientRect().bottom;
        const textBottom = text.getBoundingClientRect().bottom;
        // Respect the actual root size when the preferred value uses rem.
        const raw = getComputedStyle(document.body).getPropertyValue("--hero-summary-overlap-preferred").trim();
        const preferred = parseFloat(raw) || 0;
        const pixels = raw.endsWith("rem")
            ? preferred * parseFloat(getComputedStyle(document.documentElement).fontSize)
            : preferred;
        const available = Math.max(0, heroBottom - textBottom - 24);
        const overlap = Math.min(pixels, available);
        const value = `${overlap}px`;
        if (document.body.style.getPropertyValue("--hero-summary-overlap") !== value) {
            document.body.style.setProperty("--hero-summary-overlap", value);
        }
    };
    const observer = new ResizeObserver(fitOverlap);
    observer.observe(hero);
    observer.observe(content);
    window.addEventListener("resize", fitOverlap, { passive: true });
    document.fonts.ready.then(fitOverlap);
    fitOverlap();
}
