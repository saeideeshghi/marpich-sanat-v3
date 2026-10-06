// Page entry: shared foundation first, page styles next, responsive layer last.
import "../../css/main.css";
import "../../css/pages/home.css";
import "../../css/components/content-flow.css";
import "../../css/responsive.css";
import { initSite } from "../main.js";

import { initPartners } from "../components/partners.js";

initSite();
initPartners();
