(function () {
  var componentScript = document.currentScript;
  var componentUrl = new URL('.', componentScript.src);

  function activateLegacyLoader() {
    var legacyLoader = document.getElementById('loading_holder');
    var pageContent = document.querySelector('.body');
    if (legacyLoader) legacyLoader.style.display = 'flex';
    if (pageContent) pageContent.style.display = 'none';
    if (typeof window.bodyLoad === 'function') window.bodyLoad();
  }

  function addStylesheet() {
    var stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('intro-gate.css', componentUrl).href;
    document.head.appendChild(stylesheet);
  }

  function initializeGate(gate) {
    var canvas = gate.querySelector('.intro-gate__canvas');
    var backdropCanvas = gate.querySelector('.intro-gate__backdrop');
    var skipButton = gate.querySelector('.intro-gate__skip');
    var brush = gate.querySelector('.intro-gate__brush');
    var context = canvas.getContext('2d');
    var backdropContext = backdropCanvas.getContext('2d');
    var points = [];
    var pendingPoints = [];
    var lastPoint = null;
    var drawing = false;
    var entered = false;
    var pixelRatio = window.devicePixelRatio || 1;
    var backdropWidth = 0;
    var backdropHeight = 0;
    var fieldPointer = { x: -1000, y: -1000, targetX: -1000, targetY: -1000, active: false };
    var failedStrokeFadeUntil = 0;
    var failedStrokeCleanupTimer = null;
    var introStartedAt = performance.now();
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function drawSignalPath(width, height, offset, opacity, lineWidth, phase, time, revealProgress, scale) {
      var isMobile = width <= 640;
      var pathScale = scale || 1;
      var anchors = isMobile ? [
        { x: width * 0.02, y: height * 0.71 },
        { x: width * 0.26, y: height * 0.3 },
        { x: width * 0.5, y: height * 0.54 },
        { x: width * 0.74, y: height * 0.3 },
        { x: width * 0.98, y: height * 0.71 }
      ] : [
        { x: width * 0.1, y: height * 0.77 },
        { x: width * 0.29, y: height * 0.2 },
        { x: width * 0.5, y: height * 0.59 },
        { x: width * 0.71, y: height * 0.2 },
        { x: width * 0.9, y: height * 0.77 }
      ];
      var centreX = width * 0.5;
      var centreY = height * 0.5;
      anchors = anchors.map(function (anchor) {
        return {
          x: centreX + (anchor.x - centreX) * pathScale,
          y: centreY + (anchor.y - centreY) * pathScale
        };
      });
      var repelRadius = Math.min(width, height) * (isMobile ? 0.34 : 0.42);
      anchors = anchors.map(function (anchor, index) {
        var driftScale = isMobile ? 0.55 : 1;
        var driftX = Math.sin(time * 0.00032 + phase + index * 1.17) * (10 + Math.abs(offset) * 0.035) * driftScale;
        var driftY = Math.cos(time * 0.00027 + phase * 1.4 + index * 0.93) * (8 + Math.abs(offset) * 0.025) * driftScale;
        var deltaX = anchor.x - fieldPointer.x;
        var deltaY = anchor.y - fieldPointer.y;
        var distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY) || 1;
        var proximity = fieldPointer.active ? Math.max(0, 1 - distance / repelRadius) : 0;
        var force = proximity * proximity * (isMobile ? 31 : 54) * (1 + Math.abs(offset) * 0.003);
        return {
          x: anchor.x + driftX + deltaX / distance * force,
          y: anchor.y + driftY + deltaY / distance * force
        };
      });
      var previous = { x: anchors[0].x + offset * 0.8, y: anchors[0].y + offset };
      backdropContext.beginPath();
      backdropContext.moveTo(previous.x, previous.y);
      for (var index = 1; index < anchors.length; index++) {
        var anchor = anchors[index];
        var target = { x: anchor.x + offset * (index % 2 ? -0.85 : 0.85), y: anchor.y + offset };
        var midpointX = (previous.x + target.x) / 2;
        var midpointY = (previous.y + target.y) / 2;
        backdropContext.quadraticCurveTo(previous.x, previous.y, midpointX, midpointY);
        previous = target;
      }
      backdropContext.lineTo(previous.x, previous.y);
      backdropContext.strokeStyle = 'rgba(83, 183, 114, ' + opacity + ')';
      backdropContext.lineWidth = lineWidth;
      if (revealProgress !== undefined && revealProgress < 1) {
        var pathLength = width * 2.2 + height * 0.55;
        backdropContext.setLineDash([pathLength, pathLength]);
        backdropContext.lineDashOffset = pathLength * (1 - revealProgress);
      }
      backdropContext.stroke();
      backdropContext.setLineDash([]);
      backdropContext.lineDashOffset = 0;
    }

    function drawTravellingHighlight(width, height, time) {
      var isMobile = width <= 640;
      var anchors = isMobile ? [
        { x: width * 0.02, y: height * 0.71 }, { x: width * 0.26, y: height * 0.3 },
        { x: width * 0.5, y: height * 0.54 }, { x: width * 0.74, y: height * 0.3 },
        { x: width * 0.98, y: height * 0.71 }
      ] : [
        { x: width * 0.1, y: height * 0.77 }, { x: width * 0.29, y: height * 0.2 },
        { x: width * 0.5, y: height * 0.59 }, { x: width * 0.71, y: height * 0.2 },
        { x: width * 0.9, y: height * 0.77 }
      ];
      var progress = (time % 9500) / 9500;
      var segment = Math.min(anchors.length - 2, Math.floor(progress * (anchors.length - 1)));
      var segmentProgress = progress * (anchors.length - 1) - segment;
      var start = anchors[segment];
      var end = anchors[segment + 1];
      var x = start.x + (end.x - start.x) * segmentProgress;
      var y = start.y + (end.y - start.y) * segmentProgress;
      var glow = backdropContext.createRadialGradient(x, y, 0, x, y, isMobile ? 38 : 52);
      glow.addColorStop(0, 'rgba(185, 244, 198, 0.58)');
      glow.addColorStop(0.14, 'rgba(83, 183, 114, 0.22)');
      glow.addColorStop(1, 'rgba(83, 183, 114, 0)');
      backdropContext.fillStyle = glow;
      backdropContext.beginPath();
      backdropContext.arc(x, y, isMobile ? 38 : 52, 0, Math.PI * 2);
      backdropContext.fill();
    }

    function drawBackdrop(time) {
      var width = backdropWidth;
      var height = backdropHeight;

      backdropContext.globalCompositeOperation = 'source-over';
      backdropContext.fillStyle = '#080808';
      backdropContext.fillRect(0, 0, width, height);

      var halo = backdropContext.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.65);
      halo.addColorStop(0, 'rgba(83, 183, 114, 0.16)');
      halo.addColorStop(0.5, 'rgba(83, 183, 114, 0.04)');
      halo.addColorStop(1, 'rgba(83, 183, 114, 0)');
      backdropContext.fillStyle = halo;
      backdropContext.fillRect(0, 0, width, height);

      backdropContext.globalCompositeOperation = 'screen';
      backdropContext.lineCap = 'round';
      var isMobile = width <= 640;
      var lineStep = isMobile ? 8 : 12;
      var lineCount = isMobile ? 8 : 12;
      for (var line = -lineCount; line <= lineCount; line++) {
        var distance = Math.abs(line);
        drawSignalPath(width, height, line * lineStep, 0.024 + (lineCount - distance) * 0.006, line === 0 ? 1.35 : 0.7, line * 0.2, time);
      }
      (isMobile ? [-48, 0, 48] : [-84, 0, 84]).forEach(function (offset, index) {
        var delay = index * 170;
        var revealProgress = reduceMotion ? 1 : Math.max(0, Math.min(1, (time - introStartedAt - delay) / 930));
        drawSignalPath(width, height, offset, index === 1 ? 0.3 : 0.15, index === 1 ? 1.55 : 1.05, index * 2.1 + 0.6, time, revealProgress, isMobile ? 1.12 : 1.16);
      });
      drawTravellingHighlight(width, height, time);
    }

    function resizeCanvas() {
      var backdropPixelRatio = Math.min(pixelRatio, 2);
      canvas.width = window.innerWidth * pixelRatio;
      canvas.height = window.innerHeight * pixelRatio;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      backdropWidth = window.innerWidth;
      backdropHeight = window.innerHeight;
      backdropCanvas.width = backdropWidth * backdropPixelRatio;
      backdropCanvas.height = backdropHeight * backdropPixelRatio;
      backdropContext.setTransform(backdropPixelRatio, 0, 0, backdropPixelRatio, 0, 0);
      drawBackdrop(performance.now());
    }

    function updatePointer(event) {
      var horizontalProgress = event.clientX / window.innerWidth - 0.5;
      var verticalProgress = event.clientY / window.innerHeight - 0.5;
      gate.style.setProperty('--intro-parallax-x', (horizontalProgress * -26).toFixed(2) + 'px');
      gate.style.setProperty('--intro-parallax-y', (verticalProgress * -14).toFixed(2) + 'px');
      gate.style.setProperty('--intro-parallax-x-strong', (horizontalProgress * -36).toFixed(2) + 'px');
      gate.style.setProperty('--intro-parallax-y-strong', (verticalProgress * -10).toFixed(2) + 'px');
      gate.style.setProperty('--intro-backdrop-x', (horizontalProgress * -18).toFixed(2) + 'px');
      gate.style.setProperty('--intro-backdrop-y', (verticalProgress * -8).toFixed(2) + 'px');
      fieldPointer.targetX = event.clientX;
      fieldPointer.targetY = event.clientY;
      fieldPointer.active = true;
      brush.style.transform = 'translate3d(' + event.clientX + 'px, ' + event.clientY + 'px, 0)';
      brush.classList.add('is-visible');
    }

    function drawFrame() {
      context.globalCompositeOperation = 'destination-out';
      context.fillStyle = 'rgba(0, 0, 0, ' + (performance.now() < failedStrokeFadeUntil ? '0.09' : '0.03') + ')';
      context.fillRect(0, 0, window.innerWidth, window.innerHeight);
      context.globalCompositeOperation = 'lighter';
      pendingPoints.forEach(function (point) {
        var glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, 22);
        glow.addColorStop(0, 'rgba(232, 255, 235, 0.98)');
        glow.addColorStop(0.25, 'rgba(185, 244, 198, 0.92)');
        glow.addColorStop(1, 'rgba(83, 183, 114, 0)');
        context.fillStyle = glow;
        context.beginPath(); context.arc(point.x, point.y, 22, 0, Math.PI * 2); context.fill();
      });
      pendingPoints = [];
      context.globalCompositeOperation = 'source-over';
      if (!entered) requestAnimationFrame(drawFrame);
    }

    function animateBackdrop(time) {
      fieldPointer.x += (fieldPointer.targetX - fieldPointer.x) * 0.08;
      fieldPointer.y += (fieldPointer.targetY - fieldPointer.y) * 0.08;
      drawBackdrop(time);
      if (!entered) requestAnimationFrame(animateBackdrop);
    }

    function enter(origin) {
      if (entered) return;
      entered = true;
      var reveal = document.createElement('div');
      reveal.className = 'intro-gate__reveal';
      reveal.style.left = origin.x + 'px'; reveal.style.top = origin.y + 'px';
      document.body.appendChild(reveal);
      requestAnimationFrame(function () { reveal.classList.add('is-active'); });
        setTimeout(function () { gate.classList.add('is-leaving'); }, 125);
        setTimeout(function () { gate.remove(); reveal.remove(); }, 360);
    }

    canvas.addEventListener('pointerdown', function (event) {
      if (entered) return;
      updatePointer(event);
      if (failedStrokeCleanupTimer) clearTimeout(failedStrokeCleanupTimer);
      failedStrokeFadeUntil = 0;
      drawing = true; lastPoint = { x: event.clientX, y: event.clientY }; points = [lastPoint]; pendingPoints.push(lastPoint);
      brush.classList.add('is-drawing');
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', function (event) {
      updatePointer(event);
      if (!drawing || entered) return;
      var point = { x: event.clientX, y: event.clientY };
      var deltaX = point.x - lastPoint.x, deltaY = point.y - lastPoint.y;
      var steps = Math.max(1, Math.min(16, Math.ceil(Math.sqrt(deltaX * deltaX + deltaY * deltaY) / 9)));
      for (var index = 1; index <= steps; index++) {
        var progress = index / steps;
        var interpolated = { x: lastPoint.x + deltaX * progress, y: lastPoint.y + deltaY * progress };
        points.push(interpolated); pendingPoints.push(interpolated);
      }
      lastPoint = point;
    });

    function isMStroke(stroke) {
      if (stroke.length < 10) return false;
      var xValues = stroke.map(function (point) { return point.x; });
      var yValues = stroke.map(function (point) { return point.y; });
      var minX = Math.min.apply(null, xValues);
      var maxX = Math.max.apply(null, xValues);
      var minY = Math.min.apply(null, yValues);
      var maxY = Math.max.apply(null, yValues);
      var width = maxX - minX;
      var height = maxY - minY;
      if (width < 80 || height < 50 || width < height * 0.4) return false;

      var leftToRightStroke = stroke[0].x <= stroke[stroke.length - 1].x ? stroke : stroke.slice().reverse();
      var start = leftToRightStroke[0];
      var end = leftToRightStroke[leftToRightStroke.length - 1];
      var leftPeakOffset = Infinity;
      var rightPeakOffset = Infinity;
      var valleyOffset = -Infinity;
      var forwardDistance = 0;
      var backwardDistance = 0;
      leftToRightStroke.forEach(function (point) {
        var normalizedX = (point.x - minX) / width;
        var baselineY = start.y + (end.y - start.y) * normalizedX;
        var verticalOffset = point.y - baselineY;
        if (normalizedX < 0.42) leftPeakOffset = Math.min(leftPeakOffset, verticalOffset);
        if (normalizedX > 0.58) rightPeakOffset = Math.min(rightPeakOffset, verticalOffset);
        if (normalizedX > 0.28 && normalizedX < 0.72) valleyOffset = Math.max(valleyOffset, verticalOffset);
      });
      for (var index = 1; index < leftToRightStroke.length; index++) {
        var horizontalDelta = leftToRightStroke[index].x - leftToRightStroke[index - 1].x;
        if (horizontalDelta >= 0) forwardDistance += horizontalDelta;
        else backwardDistance -= horizontalDelta;
      }
      var twoPeaks = leftPeakOffset < -height * 0.1 && rightPeakOffset < -height * 0.1;
      var centreValley = valleyOffset - Math.max(leftPeakOffset, rightPeakOffset) > height * 0.18;
      var progressesForward = forwardDistance > 0 && backwardDistance < forwardDistance * 0.3;
      return twoPeaks && centreValley && progressesForward;
    }

    function finishStroke() {
      if (!drawing) return;
      drawing = false;
      brush.classList.remove('is-drawing');
      if (isMStroke(points)) { enter(lastPoint); return; }
      failedStrokeFadeUntil = performance.now() + 650;
      failedStrokeCleanupTimer = setTimeout(function () {
        if (!drawing && !entered) context.clearRect(0, 0, canvas.width, canvas.height);
        failedStrokeCleanupTimer = null;
      }, 700);
      gate.classList.remove('is-missed'); void gate.offsetWidth; gate.classList.add('is-missed');
    }
    canvas.addEventListener('pointerup', finishStroke);
    canvas.addEventListener('pointercancel', finishStroke);
    canvas.addEventListener('pointerleave', function () { if (!drawing) brush.classList.remove('is-visible'); fieldPointer.active = false; });
    skipButton.addEventListener('pointerenter', function () { brush.classList.remove('is-visible'); });
    skipButton.addEventListener('click', function () { enter({ x: window.innerWidth / 2, y: window.innerHeight / 2 }); });
    window.addEventListener('keydown', function (event) { if (event.key === 'Escape') enter({ x: window.innerWidth / 2, y: window.innerHeight / 2 }); });
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas(); drawFrame(); requestAnimationFrame(animateBackdrop);
    requestAnimationFrame(function () { gate.classList.add('is-ready'); });
  }

  if (!window.USE_INTERACTIVE_INTRO) { activateLegacyLoader(); return; }
  addStylesheet();
  fetch(new URL('intro-gate.html', componentUrl))
    .then(function (response) { if (!response.ok) throw new Error('Unable to load intro gate markup'); return response.text(); })
    .then(function (markup) { document.body.insertAdjacentHTML('afterbegin', markup); initializeGate(document.getElementById('intro-gate')); })
    .catch(function (error) { console.error(error); });
})();