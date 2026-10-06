/* Progressively enhanced FAQ. Keep data hooks, unique IDs, aria-controls and
 * aria-labelledby together when rendering server-side. Defaults to one open item.
 */
export function initAccordions(scope = document) {
    scope.querySelectorAll("[data-faq]").forEach((root) => {
        if (root.dataset.initialized) return;
        root.dataset.initialized = "true";
        const buttons = [...root.querySelectorAll("[data-faq-trigger]")];
        const setOpen = (button, open) => {
            const item = button.closest("[data-faq-item]");
            const answer = item?.querySelector('[role="region"]');
            if (!answer) return;
            button.setAttribute("aria-expanded", String(open));
            item.classList.toggle("is-open", open);
            answer.hidden = !open;
        };
        buttons.forEach((button, index) => {
            button.addEventListener("click", () => {
                const open = button.getAttribute("aria-expanded") !== "true";
                if (open && root.dataset.singleOpen !== "false") buttons.forEach((other) => setOpen(other, false));
                setOpen(button, open);
            });
            button.addEventListener("keydown", (event) => {
                const next = {
                    ArrowDown: (index + 1) % buttons.length,
                    ArrowUp: (index - 1 + buttons.length) % buttons.length,
                    Home: 0,
                    End: buttons.length - 1,
                }[event.key];
                if (next === undefined) return;
                event.preventDefault();
                buttons[next].focus();
            });
        });
    });
}
