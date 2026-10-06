import { initMobileMenu } from "./components/menu.js";
import { initAuth } from "./components/auth.js";
import { initPendingForms } from "./components/pending-forms.js";
import { initAccordions } from "./components/accordion.js";
import { initTestimonials } from "./components/testimonials.js";
import { initCatalogs } from "./components/catalog.js";
import { initConsultationForms } from "./components/consultation.js";
import { initSitePatterns } from "./components/site-pattern.js";
import { initHeroLayout } from "./components/hero.js";
import { initLanguageSelectors } from "./components/language.js";
import { initTemplateStyles } from "./components/template-style.js";
import { initFixedHeader } from "./components/fixed-header.js";

// Shared behavior only. Never import a page module here.
export function initSite() {
    initTemplateStyles();
    // Mount decoration independently before interactive enhancements initialize.
    initSitePatterns();
    initHeroLayout();
    initFixedHeader();
    initMobileMenu();
    initLanguageSelectors();
    initAuth();
    initPendingForms();
    initAccordions();
    initTestimonials();
    initCatalogs();
    initConsultationForms();
    // Consumers such as the visual editor can wait for the page modules/CSS
    // before measuring its actual responsive layout.
    document.body.dataset.siteReady = "true";
    document.dispatchEvent(new Event("site:ready"));
}
