"use client";

import { useRef, useState, type CSSProperties } from "react";
import { gsap, useGSAP } from "@/animation/gsap";
import { withMotion } from "@/animation/motion";
import { createSparkleTrail } from "@/animation/sparkle-trail/sparkle-trail";
import { Art } from "@/components/Art";
import { getArt } from "@/data/art-manifest";
import { createRng } from "@/quiz/rng";
import { buildIntroTimeline } from "./intro-timeline";
import { createParallax, requestTiltAccess, type ParallaxLayer } from "./parallax";
import styles from "./intro.module.css";

interface IntroProps {
  title: string;
  tagline: string;
}

/** Parallax depth per layer, back to front. */
const DEPTH = { sky: 0.05, stars: 0.12, moon: 0.2, castle: 0.45, clouds: 0.8 } as const;

const FINE_POINTER = "(pointer: fine)";
const INTERACTIVE = "a, button, input, select, textarea, [tabindex]";

/** A fixed, seeded star field so server and client render the same sky. */
const STARS = (() => {
  const random = createRng(1997);
  return Array.from({ length: 64 }, () => {
    const size = 1 + random() * random() * 2.6;
    return {
      left: random() * 100,
      // Bias towards the top: the horizon glow washes out the low sky.
      top: Math.pow(random(), 1.5) * 70,
      size,
      bright: size > 2.6,
      twinkle: 2.5 + random() * 4,
      delay: -random() * 6,
    };
  });
})();

function StarField({ animated }: { animated: boolean }) {
  return STARS.map((star, i) => (
    <span
      key={i}
      className={styles.star}
      data-enter={animated || undefined}
      data-bright={star.bright || undefined}
      style={
        {
          left: `${star.left}%`,
          top: `${star.top}%`,
          "--size": `${star.size}px`,
          "--twinkle": `${star.twinkle}s`,
          "--delay": `${star.delay}s`,
        } as CSSProperties
      }
    />
  ));
}

const CLOUDS = ["cloudA", "cloudB", "cloudC", "cloudD"] as const;

function CloudBank({ animated }: { animated: boolean }) {
  return CLOUDS.map((name) => (
    <div key={name} className={`${styles.cloud} ${styles[name]}`} data-enter={animated || undefined}>
      <div className={styles.puff} />
    </div>
  ));
}

/** Battlement teeth along a wall top, one every 20 viewBox units. */
function merlons(from: number, to: number, y: number) {
  const teeth = [];
  for (let x = from; x <= to - 10; x += 20) teeth.push(<rect key={x} x={x} y={y} width="10" height="9" />);
  return teeth;
}

const WINDOWS: [number, number][] = [
  [247, 244], [404, 190], [404, 232], [460, 254], [484, 254], [508, 254], [532, 254],
  [588, 172], [612, 172], [600, 218], [690, 264], [720, 264], [750, 264],
  [802, 182], [802, 226], [944, 230],
];

/** An original castle silhouette on a hill: towers with conical roofs, a central spire, lit windows. */
function CastleSilhouette() {
  return (
    <svg className={styles.castleSvg} viewBox="0 0 1200 400" preserveAspectRatio="xMidYMax slice" focusable="false">
      <g className={styles.castleShape}>
        <rect x="236" y="214" width="32" height="120" />
        <polygon points="230,214 251,168 272,214" />
        <rect x="266" y="252" width="120" height="80" />
        {merlons(270, 386, 244)}
        <rect x="384" y="160" width="54" height="170" />
        <polygon points="378,160 410,92 442,160" />
        <rect x="436" y="222" width="132" height="110" />
        <polygon points="436,222 500,186 564,222" />
        <rect x="550" y="166" width="20" height="80" />
        <polygon points="546,166 560,128 574,166" />
        <rect x="566" y="138" width="72" height="195" />
        <polygon points="560,138 602,60 644,138" />
        <rect x="634" y="166" width="20" height="80" />
        <polygon points="630,166 644,128 658,166" />
        <rect x="636" y="232" width="150" height="100" />
        {merlons(658, 784, 224)}
        <rect x="784" y="150" width="50" height="180" />
        <polygon points="778,150 808,84 838,150" />
        <rect x="832" y="256" width="100" height="76" />
        {merlons(836, 932, 248)}
        <rect x="930" y="204" width="36" height="128" />
        <polygon points="924,204 948,156 972,204" />
        <rect x="1010" y="250" width="22" height="70" />
        <polygon points="1006,250 1021,216 1036,250" />
        <path d="M0 336 C 180 304 380 298 600 302 S 1010 298 1200 322 V400 H0 Z" />
      </g>
      <g className={styles.windows}>
        {WINDOWS.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="6" height="10" rx="3" />
        ))}
      </g>
    </svg>
  );
}

/**
 * The hero: a layered night sky over a castle. Layers are the owner's art when registered,
 * otherwise flat CSS/SVG shapes. With full motion it plays an entrance (skipped by the first
 * scroll), drifts the layers with the pointer, tilt or drag, sinks through the clouds on
 * scroll, and swaps the cursor for a sparkling wand tip. Reduced motion shows the final
 * scene with none of that, and the sparkle canvas is never mounted.
 */
export function Intro({ title, tagline }: IntroProps) {
  const root = useRef<HTMLElement>(null);
  const skyLayer = useRef<HTMLDivElement>(null);
  const starsLayer = useRef<HTMLDivElement>(null);
  const moonLayer = useRef<HTMLDivElement>(null);
  const castleLayer = useRef<HTMLDivElement>(null);
  const cloudsLayer = useRef<HTMLDivElement>(null);
  const sky = useRef<HTMLDivElement>(null);
  const starWrap = useRef<HTMLDivElement>(null);
  const moon = useRef<HTMLDivElement>(null);
  const castle = useRef<HTMLDivElement>(null);
  const cloudWrap = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const glint = useRef<HTMLSpanElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const cue = useRef<HTMLAnchorElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [wand, setWand] = useState(false);

  // Shaped fallbacks reveal piece by piece; a single artwork reveals as a whole.
  const starsAreArt = getArt("intro.stars") !== null;
  const cloudsAreArt = getArt("intro.clouds") !== null;

  useGSAP(
    () => {
      const section = root.current!;
      const layers: ParallaxLayer[] = [
        { el: skyLayer.current!, depth: DEPTH.sky },
        { el: starsLayer.current!, depth: DEPTH.stars },
        { el: moonLayer.current!, depth: DEPTH.moon },
        { el: castleLayer.current!, depth: DEPTH.castle },
        { el: cloudsLayer.current!, depth: DEPTH.clouds },
      ];
      const pieces = (wrap: HTMLElement) =>
        wrap.matches("[data-enter]") ? [wrap] : Array.from(wrap.querySelectorAll("[data-enter]"));

      withMotion(
        gsap.matchMedia(),
        () => {
          const entrance = buildIntroTimeline({
            sky: sky.current!,
            stars: pieces(starWrap.current!),
            moon: moon.current!,
            castle: castle.current!,
            clouds: pieces(cloudWrap.current!),
            title: { heading: heading.current!, glint: glint.current! },
            tagline: taglineRef.current!,
            cue: cue.current!,
          });
          const skipEntrance = () => entrance.progress(1);
          if (window.scrollY > 0) skipEntrance();
          else window.addEventListener("scroll", skipEntrance, { once: true, passive: true });

          // Scrolling away sinks the view: far layers lag, the clouds rise past, the title fades.
          const sink = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: { trigger: section, start: "top top", end: "bottom top", scrub: true },
          });
          for (const { el, depth } of layers) sink.to(el, { yPercent: (0.5 - depth) * 36, duration: 1 }, 0);
          sink
            .to(cloudsLayer.current, { scale: 1.2, duration: 1 }, 0)
            .to(content.current, { opacity: 0, yPercent: -8, duration: 0.55 }, 0);

          const parallax = createParallax(layers, { surface: section });
          const finePointer = window.matchMedia(FINE_POINTER).matches;
          parallax.setSource(finePointer ? "pointer" : "drag");
          let live = true;
          let asking = false;
          // Ask on the first touch. A request rejected without an answer (the touch didn't
          // count as a user gesture, e.g. a scroll swipe on iOS) re-arms for the next touch;
          // an answer or a missing sensor is final. Drag stays the source until granted.
          const askForTilt = () => {
            if (asking) return;
            asking = true;
            void requestTiltAccess().then((access) => {
              asking = false;
              if (!live || access === "failed") return;
              section.removeEventListener("touchend", askForTilt);
              if (access === "granted") parallax.setSource("tilt");
            });
          };
          if (!finePointer) section.addEventListener("touchend", askForTilt, { passive: true });

          setWand(true);
          return () => {
            live = false;
            window.removeEventListener("scroll", skipEntrance);
            section.removeEventListener("touchend", askForTilt);
            parallax.destroy();
            setWand(false);
          };
        },
        () => {
          // The resting scene is the default CSS state: nothing to animate.
        },
      );
    },
    { scope: root },
  );

  useGSAP(
    () => {
      if (!wand || !canvas.current) return;
      const finePointer = window.matchMedia(FINE_POINTER);
      const trail = createSparkleTrail(canvas.current, {
        poolSize: 120,
        // One cursor at a time: keyboard focus keeps the system cursor (see the CSS), and so
        // do links and buttons, whose own cursor wins over the inherited `cursor: none`.
        showWandTip: (target) =>
          finePointer.matches &&
          !root.current?.matches(":has(:focus-visible)") &&
          !(target instanceof Element && target.closest(INTERACTIVE)),
      });
      trail.start();
      return () => trail.destroy();
    },
    { dependencies: [wand], scope: root },
  );

  return (
    <section ref={root} id="top" aria-labelledby="intro-title" className={styles.intro} data-wand={wand || undefined}>
      <div className={styles.scene} aria-hidden="true">
        <div ref={skyLayer} className={styles.layer}>
          <div ref={sky} className={styles.fill} data-enter>
            <Art slot="intro.sky" sizes="100vw" fallback={<div className={styles.skyShape} />} />
          </div>
        </div>
        <div ref={starsLayer} className={styles.layer}>
          <div ref={starWrap} className={styles.fill} data-enter={starsAreArt || undefined}>
            <Art slot="intro.stars" sizes="100vw" fallback={<StarField animated={!starsAreArt} />} />
          </div>
        </div>
        <div ref={moonLayer} className={styles.layer}>
          <div ref={moon} className={styles.moon} data-enter>
            <Art slot="intro.moon" sizes="140px" fallback={<div className={styles.moonShape} />} />
          </div>
        </div>
        <div ref={castleLayer} className={styles.layer}>
          <div ref={castle} className={styles.castle} data-enter>
            <Art slot="intro.castle" sizes="100vw" fallback={<CastleSilhouette />} />
          </div>
        </div>
        <div ref={cloudsLayer} className={styles.layer}>
          <div ref={cloudWrap} className={styles.fill} data-enter={cloudsAreArt || undefined}>
            <Art slot="intro.clouds" sizes="100vw" fallback={<CloudBank animated={!cloudsAreArt} />} />
          </div>
        </div>
        <div className={styles.horizon} />
      </div>

      <div ref={content} className={styles.content}>
        <div className={styles.titleBlock}>
          <div className={styles.titleWrap}>
            <h1 ref={heading} id="intro-title" className={styles.title} data-enter>
              {title}
            </h1>
            <span ref={glint} className={`${styles.title} ${styles.glint}`} aria-hidden="true">
              {title}
            </span>
          </div>
          <p ref={taglineRef} className={styles.tagline} data-enter>
            {tagline}
          </p>
        </div>
        <a ref={cue} href="#classroom" className={styles.cue} aria-label="Scroll to the Classroom" data-enter>
          <span>Scroll</span>
          <svg className={styles.chevron} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </a>
      </div>

      {wand && <canvas ref={canvas} className={styles.sparkles} aria-hidden="true" />}
    </section>
  );
}
