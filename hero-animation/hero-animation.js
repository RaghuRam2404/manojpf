/**
 * hero-animation.js
 * Brush-reveal hero panel — canvas-based, GSAP-animated.
 *
 * Requires GSAP 3 to be loaded on the page before this script runs.
 * Cursor style is intentionally unset — inherits from the parent document.
 *
 * Usage:
 *   HeroAnimation.init({
 *     container : '#hr',               // CSS selector or DOM element
 *     bgImage   : 'image/base.jpeg',   // always-visible background
 *     topImage  : 'image/reveal.jpeg', // image revealed by the brush stroke
 *     label     : 'Hallstatt, Austria' // optional caption shown on hover
 *   });
 */
(function (global) {
  'use strict';

  const HeroAnimation = {
    init(options) {
      /* ---- resolve container ------------------------------------------ */
      const container =
        typeof options.container === 'string'
          ? document.querySelector(options.container)
          : options.container;

      if (!container) {
        console.warn('HeroAnimation: container not found');
        return;
      }

      /* ---- build DOM ----------------------------------------------------- */
      container.classList.add('ha-wrap');

      const pbase = document.createElement('div');
      pbase.className = 'ha-base';
      pbase.style.backgroundImage = `url('${options.bgImage}')`;

      const brushCanvas = document.createElement('canvas');
      brushCanvas.className = 'ha-canvas';

      const pring = document.createElement('div');
      pring.className = 'ha-ring';

      const plabel = document.createElement('div');
      plabel.className = 'ha-label';
      plabel.textContent = options.label || '';

      const pstaticLabel = document.createElement('div');
      pstaticLabel.className = 'ha-static-label';
      pstaticLabel.textContent = options.staticLabel || '';
      if (!options.staticLabel) pstaticLabel.style.display = 'none';

      container.append(pbase, brushCanvas, pring, plabel, pstaticLabel);

      /* ---- canvas setup -------------------------------------------------- */
      const bCtx = brushCanvas.getContext('2d');
      const maskCanvas = document.createElement('canvas');
      const mCtx = maskCanvas.getContext('2d');

      const topImg = new Image();
      topImg.src = options.topImage;

      function resizeCanvas() {
        brushCanvas.width = maskCanvas.width = container.offsetWidth;
        brushCanvas.height = maskCanvas.height = container.offsetHeight;
      }
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      /* ---- image helpers ------------------------------------------------- */
      // Replicates background-size:cover; background-position:center top
      function drawCoverImg(ctx, W, H) {
        if (!topImg.complete || !topImg.naturalWidth) return;
        const scale = Math.max(W / topImg.naturalWidth, H / topImg.naturalHeight);
        const dw = topImg.naturalWidth * scale;
        const dh = topImg.naturalHeight * scale;
        ctx.drawImage(topImg, (W - dw) / 2, 0, dw, dh);
      }

      function renderToCanvas() {
        const W = brushCanvas.width, H = brushCanvas.height;
        bCtx.clearRect(0, 0, W, H);
        drawCoverImg(bCtx, W, H);
        bCtx.globalCompositeOperation = 'destination-in';
        bCtx.drawImage(maskCanvas, 0, 0);
        bCtx.globalCompositeOperation = 'source-over';
      }

      function clearAll() {
        bCtx.clearRect(0, 0, brushCanvas.width, brushCanvas.height);
        mCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      }

      /* ---- stroke painters ----------------------------------------------- */

      // Demo stroke: sin taper (pointed at both ends), pre-baked randomness
      function paintDemoStroke(ctx, pts, maxW) {
        if (!pts || pts.length < 2) return;
        const n = pts.length;
        for (let i = 1; i < n; i++) {
          const t = i / (n - 1);
          const taper = Math.sin(t * Math.PI);
          const w = maxW * (0.06 + taper * 0.94);
          ctx.beginPath();
          ctx.lineWidth = Math.max(1, w * pts[i].w);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = 'white';
          ctx.globalAlpha = pts[i].a;
          ctx.moveTo(pts[i - 1].x + pts[i].jx * w, pts[i - 1].y + pts[i].jy * w);
          ctx.lineTo(pts[i].x + pts[i].jx * w, pts[i].y + pts[i].jy * w);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Hover stroke: tail taper only, full width at the cursor head
      function paintHoverStroke(ctx, pts, maxW) {
        if (!pts || pts.length < 2) return;
        const n = pts.length;
        const TAIL = 10;
        for (let i = 1; i < n; i++) {
          const taper = Math.min(1, i / TAIL);
          const w = maxW * taper;
          ctx.beginPath();
          ctx.lineWidth = Math.max(1, w);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = 'white';
          ctx.globalAlpha = Math.min(1, taper * 1.5);
          ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
          ctx.lineTo(pts[i].x, pts[i].y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      /* ---- path generation ---------------------------------------------- */

      function catmullRom(p0, p1, p2, p3, t) {
        const t2 = t * t, t3 = t2 * t;
        return {
          x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        };
      }

      // One long continuous Catmull-Rom path that meanders across the full image
      function generateContinuousPath() {
        const W = brushCanvas.width, H = brushCanvas.height;
        const wps = [{ x: -50, y: H * (0.25 + Math.random() * 0.5) }];
        for (let i = 0; i < 8; i++) {
          wps.push({
            x: W * (0.05 + Math.random() * 0.9),
            y: H * (0.06 + Math.random() * 0.88),
          });
        }
        wps.push({ x: W + 50, y: H * (0.25 + Math.random() * 0.5) });

        const pts = [];
        for (let i = 0; i < wps.length - 1; i++) {
          const p0 = wps[Math.max(0, i - 1)];
          const p1 = wps[i];
          const p2 = wps[i + 1];
          const p3 = wps[Math.min(wps.length - 1, i + 2)];
          for (let t = 0; t < 1; t += 0.007) {
            const pt = catmullRom(p0, p1, p2, p3, t);
            // Pre-bake randomness: stable across redraws, no per-frame shimmer
            pt.w = 1 + (Math.random() - 0.5) * 0.22;
            pt.a = 0.75 + Math.random() * 0.25;
            pt.jx = (Math.random() - 0.5) * 0.06;
            pt.jy = (Math.random() - 0.5) * 0.06;
            pts.push(pt);
          }
        }
        return pts;
      }

      /* ---- state --------------------------------------------------------- */
      let isUserInteracting = false;
      let demoActive = false;
      let demoTween = null;

      const TRAIL_LEN = 55;
      const MIN_TRAIL = 14; // stop retreating here — keeps cursor end at full width
      let hoverTrail = [];
      let hoverRaf = null;
      let lastMoveTime = 0;

      /* ---- hover loop ---------------------------------------------------- */
      function hoverLoop() {
        if (!isUserInteracting) { hoverRaf = null; return; }
        if (Date.now() - lastMoveTime > 40 && hoverTrail.length > MIN_TRAIL) {
          hoverTrail.shift();
        }
        mCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        if (hoverTrail.length >= 2) paintHoverStroke(mCtx, hoverTrail, 110);
        renderToCanvas();
        hoverRaf = requestAnimationFrame(hoverLoop);
      }

      function stopHoverLoop() {
        if (hoverRaf) { cancelAnimationFrame(hoverRaf); hoverRaf = null; }
      }

      /* ---- demo animation ----------------------------------------------- */
      function startDemoAnimation() {
        if (isUserInteracting || demoActive) return;
        demoActive = true;
        gsap.set(brushCanvas, { opacity: 1 });
        gsap.set([pring, plabel], { opacity: 0 });

        function doStroke() {
          if (!demoActive || isUserInteracting) return;
          const strokePath = generateContinuousPath();
          const totalPts = strokePath.length;
          const BRUSH_WIN = 160;
          const strokeW = 120 + Math.random() * 50;
          const prog = { t: 0 };
          clearAll();

          demoTween = gsap.to(prog, {
            t: 1,
            duration: 4.125 + Math.random() * 1.125,
            ease: 'sine.inOut',
            onUpdate: () => {
              const tipIdx = Math.floor(prog.t * (totalPts + BRUSH_WIN));
              const startIdx = Math.max(0, tipIdx - BRUSH_WIN);
              const endIdx = Math.min(tipIdx, totalPts);
              const visible = strokePath.slice(startIdx, endIdx);
              mCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
              if (visible.length >= 2) paintDemoStroke(mCtx, visible, strokeW);
              renderToCanvas();
            },
            onComplete: () => {
              if (!demoActive || isUserInteracting) return;
              gsap.to(brushCanvas, {
                opacity: 0,
                duration: 0.375,
                ease: 'power1.in',
                onComplete: () => {
                  clearAll();
                  if (demoActive && !isUserInteracting) {
                    gsap.set(brushCanvas, { opacity: 1 });
                    setTimeout(doStroke, 300 + Math.random() * 450);
                  }
                },
              });
            },
          });
        }

        doStroke();
      }

      /* ---- event listeners ---------------------------------------------- */
      container.addEventListener('mouseenter', () => {
        isUserInteracting = true;
        demoActive = false;
        if (demoTween) { demoTween.kill(); demoTween = null; }
        gsap.killTweensOf(brushCanvas);
        hoverTrail = [];
        clearAll();
        gsap.set(brushCanvas, { opacity: 1 });
        gsap.to([pring, plabel], { opacity: 1, duration: 0.2 });
        gsap.to(pstaticLabel, { opacity: 0, duration: 0.2 });
        container.classList.add('ha-active');
        if (!hoverRaf) hoverRaf = requestAnimationFrame(hoverLoop);
      });

      container.addEventListener('mouseleave', () => {
        isUserInteracting = false;
        stopHoverLoop();
        hoverTrail = [];
        container.classList.remove('ha-active');
        gsap.to([pring, plabel], { opacity: 0, duration: 0.2 });
        gsap.to(pstaticLabel, { opacity: 1, duration: 0.3 });
        gsap.to(brushCanvas, {
          opacity: 0,
          duration: 0.4,
          ease: 'power2.out',
          onComplete: () => {
            clearAll();
            setTimeout(startDemoAnimation, 200);
          },
        });
      });

      container.addEventListener('mousemove', e => {
        isUserInteracting = true;
        lastMoveTime = Date.now();
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        hoverTrail.push({ x, y });
        if (hoverTrail.length > TRAIL_LEN) hoverTrail.shift();
        gsap.set(pring, { x, y, xPercent: -50, yPercent: -50 });
        gsap.set(plabel, { x, y: y + 26, xPercent: -50 });
      });

      /* ---- auto-start ---------------------------------------------------- */
      function tryStart() {
        setTimeout(startDemoAnimation, 800);
      }

      if (topImg.complete && topImg.naturalWidth) {
        if (document.readyState === 'complete') {
          tryStart();
        } else {
          window.addEventListener('load', tryStart, { once: true });
        }
      } else {
        topImg.addEventListener('load', () => {
          if (document.readyState === 'complete') {
            tryStart();
          } else {
            window.addEventListener('load', tryStart, { once: true });
          }
        }, { once: true });
      }
    },
  };

  global.HeroAnimation = HeroAnimation;
})(window);
