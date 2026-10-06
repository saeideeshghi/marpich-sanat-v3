/* Horizontal testimonial track; auto-advance only when content overflows.
 * Pauses for hover, focus, dragging, hidden documents and reduced-motion settings.
 * Cards are captured at initialization: render them before initSite().
 */
export function initTestimonials(scope = document) {
    scope.querySelectorAll("[data-testimonials-track]").forEach((track) => {
        if (track.dataset.initialized) return;
        track.dataset.initialized = "true";
        const cards = [...track.children];
        const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
        let index = 0;
        let timer;
        let dragging = false;
        let paused = false;
        const root = track.closest(".testimonials");
        const controls = root?.querySelector("[data-slider-controls]");
        const pause = root?.querySelector("[data-slider-pause]");
        const sliding = () => track.scrollWidth > track.clientWidth + 2;
        const stop = () => clearInterval(timer);
        const go = (next) => {
            if (!sliding()) return;
            index = (next + cards.length) % cards.length;
            const box = track.getBoundingClientRect();
            const card = cards[index].getBoundingClientRect();
            const rtl = getComputedStyle(track).direction === "rtl";
            // Relative geometry works for RTL negative scrollLeft and LTR tracks.
            track.scrollBy({
                left: rtl ? card.right - box.right : card.left - box.left,
                behavior: reduceMotion.matches ? "instant" : "smooth",
            });
        };
        const start = () => {
            stop();
            if (
                !sliding() ||
                reduceMotion.matches ||
                paused ||
                dragging ||
                document.hidden ||
                root?.matches(":hover, :focus-within")
            )
                return;
            timer = setInterval(() => go(index + 1), 5500);
        };
        track.addEventListener(
            "scroll",
            () => {
                const box = track.getBoundingClientRect();
                const rtl = getComputedStyle(track).direction === "rtl";
                let distance = Infinity;
                cards.forEach((card, n) => {
                    const rect = card.getBoundingClientRect();
                    const d = Math.abs(rtl ? rect.right - box.right : rect.left - box.left);
                    if (d < distance) {
                        distance = d;
                        index = n;
                    }
                });
            },
            { passive: true },
        );
        track.addEventListener("keydown", (event) => {
            if (!["ArrowLeft", "ArrowRight"].includes(event.key) || !sliding()) return;
            event.preventDefault();
            const rtl = getComputedStyle(track).direction === "rtl";
            go(index + ((event.key === "ArrowLeft") === rtl ? 1 : -1));
        });
        track.addEventListener("pointerdown", () => {
            dragging = true;
            stop();
        });
        for (const event of ["pointerup", "pointercancel"])
            window.addEventListener(event, () => {
                if (dragging) {
                    dragging = false;
                    start();
                }
            });
        root?.addEventListener("mouseenter", stop);
        root?.addEventListener("mouseleave", start);
        root?.addEventListener("focusin", stop);
        root?.addEventListener("focusout", () => requestAnimationFrame(start));
        root?.querySelector("[data-slider-next]")?.addEventListener("click", () => go(index + 1));
        root?.querySelector("[data-slider-prev]")?.addEventListener("click", () => go(index - 1));
        pause?.addEventListener("click", () => {
            paused = !paused;
            pause.setAttribute("aria-pressed", String(paused));
            pause.textContent = paused ? "ادامه پخش خودکار" : "توقف پخش خودکار";
            start();
        });
        const sync = () => {
            if (controls) controls.hidden = !sliding();
            if (pause) pause.hidden = reduceMotion.matches;
            start();
        };
        new ResizeObserver(sync).observe(track);
        reduceMotion.addEventListener("change", sync);
        document.addEventListener("visibilitychange", start);
        sync();
    });
}
