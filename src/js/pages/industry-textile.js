// Page entry: shared foundation first, page styles next, responsive layer last.
import "../../css/main.css";
import "../../css/pages/industry-textile.css";
import "../../css/components/content-flow.css";
import "../../css/components/catalog.css";
import "../../css/responsive.css";
import { initSite } from "../main.js";

initSite();

/* ---------------------------------------------------------
 * Main textile image fallback
 * Preferred industry asset -> existing project assets.
 * ------------------------------------------------------ */
const summaryImage = document.querySelector(".industry-textile__summary-image");

if (summaryImage) {
    const candidates = (summaryImage.dataset.imageCandidates || "")
        .split("|")
        .map((src) => src.trim())
        .filter(Boolean);

    let candidateIndex = Math.max(candidates.indexOf(summaryImage.getAttribute("src")), 0);

    const showNextCandidate = () => {
        candidateIndex += 1;

        if (candidateIndex < candidates.length) {
            summaryImage.src = candidates[candidateIndex];
        }
    };
    summaryImage.addEventListener("error", showNextCandidate);
    // Handle an image that failed before module initialization as well.
    if (summaryImage.complete && summaryImage.naturalWidth === 0) showNextCandidate();
}
