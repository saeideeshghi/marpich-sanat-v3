/* RFQ enhancement: local file validation/drop and cancelable rfq:submit event.
 * No upload/API is performed by this module. attachment is optional, max 20 MiB;
 * server validation/storage/confirmation remain the backend adapter responsibility.
 */
import "../../css/main.css";
import "../../css/pages/contact.css";
import "../../css/components/content-flow.css";
import "../../css/responsive.css";
import { initSite } from "../main.js";

function initFileUpload() {
    const input = document.querySelector("[data-file-input]");
    const label = document.querySelector("[data-file-label]");
    const dropZone = document.querySelector("[data-drop-zone]");

    if (!input || !label || !dropZone) {
        return;
    }

    const maxFileSize = 20 * 1024 * 1024;

    const allowedExtensions = ["pdf", "dwg", "doc", "docx"];
    const defaultLabel = label.textContent;

    const showFile = (file) => {
        if (!file) {
            label.textContent = defaultLabel;
            return;
        }

        const extension = file.name.split(".").pop()?.toLowerCase();

        if (!extension || !allowedExtensions.includes(extension)) {
            label.textContent = "فرمت فایل مجاز نیست";
            input.value = "";

            return;
        }

        if (file.size > maxFileSize) {
            label.textContent = "حجم فایل بیشتر از ۲۰ مگابایت است";

            input.value = "";

            return;
        }

        label.textContent = file.name;
    };

    input.addEventListener("change", () => {
        showFile(input.files?.[0]);
    });
    input.form?.addEventListener("reset", (event) => {
        queueMicrotask(() => {
            if (!event.defaultPrevented) showFile(input.files?.[0]);
        });
    });

    ["dragenter", "dragover"].forEach((eventName) => {
        dropZone.addEventListener(eventName, (event) => {
            event.preventDefault();

            dropZone.classList.add("is-dragging");
        });
    });

    ["dragleave", "drop"].forEach((eventName) => {
        dropZone.addEventListener(eventName, (event) => {
            event.preventDefault();

            dropZone.classList.remove("is-dragging");
        });
    });

    dropZone.addEventListener("drop", (event) => {
        const file = event.dataTransfer?.files?.[0];

        if (!file) {
            return;
        }

        const transfer = new DataTransfer();

        transfer.items.add(file);

        input.files = transfer.files;

        showFile(file);
    });
}

function initContactForm() {
    const form = document.querySelector("[data-rfq-form]");

    const status = document.querySelector("[data-form-status]");

    if (!form || !status) {
        return;
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();

            return;
        }

        // The attachment input has a name so it participates in FormData.
        // Backend must revalidate type/size; browser checks are only UX.
        const request = new CustomEvent("rfq:submit", {
            bubbles: true,
            cancelable: true,
            detail: { form, formData: new FormData(form) },
        });
        if (!form.dispatchEvent(request)) return;

        status.textContent = "این فرم هنوز به سامانهٔ ارسال متصل نیست؛ لطفاً از راه‌های تماس با ما استفاده کنید.";

        status.classList.remove("hidden");
    });
}

function initMobileCooperation() {
    const requestType = document.querySelector("#request-type");
    if (!requestType) return;

    document.querySelectorAll("[data-contact-request-type]").forEach((link) => {
        link.addEventListener("click", () => {
            if (!matchMedia("(max-width: 639px)").matches) return;
            const { contactRequestType: value, contactRequestLabel: label } = link.dataset;
            if (!value || !label) return;
            let option = [...requestType.options].find((item) => item.value === value);
            if (!option) {
                option = new Option(label, value);
                requestType.add(option);
            }
            requestType.value = value;
            requestType.dispatchEvent(new Event("change", { bubbles: true }));
        });
    });
}

initSite();
initFileUpload();
initContactForm();
initMobileCooperation();

// Keep the dark surface behind the introduction and part of the first office
// card, matching the overlap in both references after fonts load or text wraps.
const contactIntro = document.querySelector(".contact-intro");
const contactHero = document.querySelector(".contact-hero");
const contactBranches = document.querySelector(".contact-branches");
if (contactIntro && contactHero && contactBranches) {
    const fitContactBackdrop = () => {
        const top = contactHero.getBoundingClientRect().top;
        const introBottom = contactIntro.getBoundingClientRect().bottom - top;
        const firstCard = contactBranches.querySelector(".branch-card")?.getBoundingClientRect();
        const overlap = window.innerWidth < 1180 ? 0.5 : 0.42;
        const bottom = firstCard ? firstCard.top - top + firstCard.height * overlap : introBottom + 28;
        const value = `${Math.ceil(Math.max(introBottom + 28, bottom))}px`;
        if (contactHero.style.getPropertyValue("--contact-intro-background") !== value)
            contactHero.style.setProperty("--contact-intro-background", value);
    };
    let backdropFrame = 0;
    const scheduleBackdrop = () => {
        if (backdropFrame) return;
        backdropFrame = requestAnimationFrame(() => {
            backdropFrame = 0;
            fitContactBackdrop();
        });
    };
    const backdropObserver = new ResizeObserver(scheduleBackdrop);
    backdropObserver.observe(contactIntro);
    backdropObserver.observe(contactBranches);
    window.addEventListener("resize", scheduleBackdrop, { passive: true });
    document.fonts.ready.then(fitContactBackdrop);
    fitContactBackdrop();
}
