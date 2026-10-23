import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

// The single place plugins are registered; every animated component imports from here.
gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, Flip);

export { gsap, useGSAP, ScrollTrigger, SplitText, Flip };
