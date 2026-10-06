/* Product image tools only: CSS rotateY is a 2D image flip, not a 3D model.
 * Failed images reveal adjacent data-image-fallback; fullscreen depends on browser support.
 */
import "../../css/main.css";
import "../../css/pages/product-details.css";
import "../../css/components/content-flow.css";
import "../../css/components/detail-technical.css";
import "../../css/responsive.css";
import { initSite } from "../main.js";

initSite();

const productImage = document.querySelector("[data-product-image]");
const resetButton = document.querySelector("[data-view-reset]");
const rotateButton = document.querySelector("[data-view-rotate]");
const fullscreenButton = document.querySelector("[data-view-fullscreen]");

let rotation = 0;

const showImageFallback = (image) => {
    // Native hidden is backed by the shared [hidden] rule, even with img display:block.
    image.hidden = true;

    const fallback = image.nextElementSibling;
    if (fallback?.hasAttribute("data-image-fallback")) {
        fallback.classList.remove("hidden");
        fallback.classList.add("flex");
    }
};

document.querySelectorAll("[data-product-image], [data-fallback-image]").forEach((image) => {
    image.addEventListener("error", () => showImageFallback(image));

    if (image.complete && image.naturalWidth === 0) {
        showImageFallback(image);
    }
});

resetButton?.addEventListener("click", () => {
    rotation = 0;
    if (productImage) productImage.style.transform = "rotateY(0deg)";
});

rotateButton?.addEventListener("click", () => {
    rotation += 180;
    if (productImage) productImage.style.transform = `rotateY(${rotation}deg)`;
});

fullscreenButton?.addEventListener("click", async () => {
    if (!productImage?.requestFullscreen) return;

    try {
        await productImage.requestFullscreen();
    } catch {
        // Fullscreen can be blocked by the browser; the normal image remains usable.
    }
});
