(function () {
  'use strict';

  const LS_KEY = 'narrative_seen';
  const PLACES_LAYER = 'places-circles-main';
  const INITIAL_CENTER = [-73.98, 40.73];
  const INITIAL_ZOOM = 10;
  const INITIAL_PITCH = 40;
  const BARCADE_COORDS = [-73.951117, 40.7120257];
  const BARCADE_FALLBACK_SOUL = 'Adults and friends escape the typical Brooklyn bar scene at Barcade to reclaim their youth through rows of quarter-fed arcade cabinets paired with cheap well drinks and craft beer. The place buzzes with competitive energy and casual camaraderie, where strangers queue for turns at Street Fighter and Tetris while strategizing around rustic picnic tables between rounds.';

  // One Mapbox layer per reveal_group — created in main.js. We control each
  // sub-layer's opacity / radius / blur with literal values so paint-property
  // transitions fire reliably.
  const TOTAL_GROUPS = 20;
  const REVEAL_STAGGER_MS = 350;     // delay between successive group reveals
  const FADE_IN_MS = 2000;           // per-group fade duration (matches layer transition)
  const FADE_OUT_MS = 1500;          // step-4 constellation fade-out
  const PULSE_FREQUENCY_HZ = 1.5;    // sine cycles per second
  const PULSE_THROTTLE_MS = 33;      // ~30Hz radius/blur update cadence
  const STAR_OPACITY = 0.85;

  function constellationLayerId(g) {
    return `constellation-stars-${g}`;
  }

  let map = null;
  let currentStep = 0;
  let overlayEl = null;
  let placeCardEl = null;
  let arcFadeTimer = null;
  let constellationTimers = [];
  let originalFilter = null;
  let originalOpacity = null;

  // Per-group pulse state. groupStartTimes[g] is the rAF timestamp when
  // group g first appeared, or null if not yet revealed. Used to compute a
  // distinct sine phase per group so they twinkle instead of pulsing in
  // unison.
  let groupStartTimes = new Array(TOTAL_GROUPS).fill(null);
  let pulseAnimFrame = null;
  let lastPulseUpdate = 0;

  // Listener-attachment guard so replay doesn't stack duplicates.
  let listenersAttached = false;

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch(e) { return null; }
  }
  function safeSet(key, val) {
    try { localStorage.setItem(key, val); } catch(e) {}
  }

  function setLightPreset(preset) {
    try { map.setConfigProperty('basemap', 'lightPreset', preset); } catch(e) {}
  }

  function applyExplorationConfig() {
    try {
      map.setConfigProperty('basemap', 'showPlaceLabels', true);
      map.setConfigProperty('basemap', 'colorMotorways', '#ffffff');
      map.setConfigProperty('basemap', 'colorTrunks', '#ffffff');
      map.setConfigProperty('basemap', 'colorRoads', '#ffffff');
    } catch(e) {}
  }

  function resetExplorationConfig() {
  try {
    map.setConfigProperty('basemap', 'showPlaceLabels', false);
    map.setConfigProperty('basemap', 'colorMotorways', 'rgba(0,0,0,0)');
    map.setConfigProperty('basemap', 'colorTrunks', 'rgba(0,0,0,0)');
    map.setConfigProperty('basemap', 'colorRoads', 'rgba(0,0,0,0)');
  } catch(e) {}
}

  function showStep(n) {
    document.querySelectorAll('.narrative-step').forEach((stepEl) => {
      const textEl = stepEl.querySelector('.narrative-text');
      const stepNum = parseInt(stepEl.getAttribute('data-step'));
      if (textEl) {
        if (stepNum === n) {
          textEl.classList.add('is-active');
        } else {
          textEl.classList.remove('is-active');
        }
      }
    });
  }

  function findBarcade() {
    const fb = window.featuresById;
    if (!fb) return null;
    for (const p of fb.values()) {
      if (p && p.name === 'Barcade') return p;
    }
    return null;
  }

  function injectPlaceCard() {
    if (placeCardEl) return placeCardEl;
    placeCardEl = document.createElement('div');
    placeCardEl.id = 'narrative-place-card';
    placeCardEl.innerHTML =
      '<div class="narrative-place-name"></div>' +
      '<div class="narrative-place-soul"></div>';
    document.body.appendChild(placeCardEl);
    return placeCardEl;
  }

  function showPlaceCard(name, soul) {
    const card = injectPlaceCard();
    card.querySelector('.narrative-place-name').textContent = name;
    card.querySelector('.narrative-place-soul').textContent = soul;
    void card.offsetWidth;
    card.classList.add('is-visible');
  }

  function hidePlaceCard() {
    if (placeCardEl) placeCardEl.classList.remove('is-visible');
  }

  function drawNarrativeArcs() {
    const source = findBarcade();
    if (!source || typeof window.drawKindredLines !== 'function') return;
    window.drawKindredLines(source.id);
    if (arcFadeTimer) clearTimeout(arcFadeTimer);
    arcFadeTimer = setTimeout(() => {
      if (typeof window.clearKindredLines === 'function') window.clearKindredLines();
      arcFadeTimer = null;
    }, 2000);
  }

  function clearConstellationTimers() {
    constellationTimers.forEach((t) => clearTimeout(t));
    constellationTimers = [];
  }

  function resetPulseState() {
    if (pulseAnimFrame !== null) {
      cancelAnimationFrame(pulseAnimFrame);
      pulseAnimFrame = null;
    }
    groupStartTimes = new Array(TOTAL_GROUPS).fill(null);
    lastPulseUpdate = 0;
  }

  function pulseTick(now) {
    pulseAnimFrame = requestAnimationFrame(pulseTick);
    // Throttle to ~30Hz so we're not hammering setPaintProperty on 20 layers
    // every frame. Slow sine pulse stays visually smooth at this cadence.
    if (now - lastPulseUpdate < PULSE_THROTTLE_MS) return;
    lastPulseUpdate = now;

    let anyActive = false;
    for (let g = 0; g < TOTAL_GROUPS; g++) {
      const startedAt = groupStartTimes[g];
      if (startedAt === null) continue;
      anyActive = true;
      const elapsed = (now - startedAt) / 1000;
      const phase = elapsed * PULSE_FREQUENCY_HZ;
      const r = 2 + Math.sin(phase) * 1;
      const b = 0.9 + Math.sin(phase + 1) * 0.4;
      const id = constellationLayerId(g);
      try {
        map.setPaintProperty(id, 'circle-radius', r);
        map.setPaintProperty(id, 'circle-blur', b);
      } catch (e) { /* layer torn down mid-animation */ }
    }

    if (!anyActive) {
      cancelAnimationFrame(pulseAnimFrame);
      pulseAnimFrame = null;
    }
  }

  function startPulseLoopIfNeeded() {
    if (pulseAnimFrame === null) {
      pulseAnimFrame = requestAnimationFrame(pulseTick);
    }
  }

  function revealGroup(g) {
    const id = constellationLayerId(g);
    try {
      // The layer's circle-opacity-transition (set to 2000ms at addLayer
      // time) drives the fade from 0 → STAR_OPACITY here.
      map.setPaintProperty(id, 'circle-opacity', STAR_OPACITY);
    } catch (e) { return; }
    groupStartTimes[g] = performance.now();
    startPulseLoopIfNeeded();
  }

  function hideConstellationLayer() {
    resetPulseState();
    for (let g = 0; g < TOTAL_GROUPS; g++) {
      const id = constellationLayerId(g);
      try {
        // Snap, don't transition, so cleanup is instant.
        map.setPaintProperty(id, 'circle-opacity-transition', { duration: 0, delay: 0 });
        map.setPaintProperty(id, 'circle-opacity', 0);
        map.setPaintProperty(id, 'circle-radius', 2);
        map.setPaintProperty(id, 'circle-blur', 1.2);
        map.setLayoutProperty(id, 'visibility', 'none');
      } catch (e) {}
    }
  }

  function fadeOutConstellation() {
    // Used by step 4 to dim the constellation as we fly to Barcade.
    resetPulseState();
    for (let g = 0; g < TOTAL_GROUPS; g++) {
      const id = constellationLayerId(g);
      try {
        map.setPaintProperty(id, 'circle-opacity-transition', { duration: FADE_OUT_MS, delay: 0 });
        map.setPaintProperty(id, 'circle-opacity', 0);
      } catch (e) {}
    }
  }

  function constellationReveal() {
    clearConstellationTimers();
    resetPulseState();

    // Phase 1 — snap every sub-layer to a known starting state with NO
    // transition: visible, opacity 0, default radius/blur. This wipes any
    // leftover in-flight fade from step 4 or a prior run.
    for (let g = 0; g < TOTAL_GROUPS; g++) {
      const id = constellationLayerId(g);
      try {
        map.setLayoutProperty(id, 'visibility', 'visible');
        map.setPaintProperty(id, 'circle-opacity-transition', { duration: 0, delay: 0 });
        map.setPaintProperty(id, 'circle-opacity', 0);
        map.setPaintProperty(id, 'circle-radius', 2);
        map.setPaintProperty(id, 'circle-blur', 1.2);
      } catch (e) {}
    }

    // Hide the interactive dot layer underneath while the constellation runs.
    try {
      map.setFilter(PLACES_LAYER, ['==', ['get', 'id'], '__hidden__']);
      map.setPaintProperty(PLACES_LAYER, 'circle-opacity-transition', { duration: 0, delay: 0 });
      map.setPaintProperty(PLACES_LAYER, 'circle-opacity', 0);
    } catch (e) {}

    // Phase 2 — once the snap is committed (one frame later), restore the
    // fade-in transition and THEN schedule the staggered reveals. Scheduling
    // inside the rAF guarantees no setTimeout(0) fires before the transition
    // is back to 2000ms.
    requestAnimationFrame(() => {
      for (let g = 0; g < TOTAL_GROUPS; g++) {
        try {
          map.setPaintProperty(
            constellationLayerId(g),
            'circle-opacity-transition',
            { duration: FADE_IN_MS, delay: 0 }
          );
        } catch (e) {}
      }
      for (let g = 0; g < TOTAL_GROUPS; g++) {
        const timer = setTimeout(() => revealGroup(g), g * REVEAL_STAGGER_MS);
        constellationTimers.push(timer);
      }
    });
  }

  function goToStep(n) {
    currentStep = n;
    showStep(n);

    if (n === 1) {
      try {
        map.setFilter(PLACES_LAYER, ['==', ['get', 'id'], '__hidden__']);
        map.setPaintProperty(PLACES_LAYER, 'circle-opacity-transition', { duration: 0, delay: 0 });
        map.setPaintProperty(PLACES_LAYER, 'circle-opacity', 0);
      } catch(e) {}
      map.easeTo({
        center: INITIAL_CENTER,
        zoom: 10.5,
        pitch: INITIAL_PITCH,
        bearing: 0,
        duration: 2000,
      });
    }

    else if (n === 2) {
      const c = map.getCenter();
      map.easeTo({
        center: [c.lng, c.lat - 0.03],
        duration: 3000,
      });
    }

    else if (n === 3) {
      constellationReveal();
    }

    else if (n === 4) {
      // Transition: constellation fades out, interactive dots fade in
      try {
        if (originalFilter != null) map.setFilter(PLACES_LAYER, originalFilter);
        else map.setFilter(PLACES_LAYER, null);
        map.setPaintProperty(PLACES_LAYER, 'circle-opacity-transition', { duration: 1500, delay: 0 });
        map.setPaintProperty(PLACES_LAYER, 'circle-opacity', 0.9);

        fadeOutConstellation();
        setTimeout(() => hideConstellationLayer(), FADE_OUT_MS + 100);
      } catch(e) {}

      map.flyTo({
        center: BARCADE_COORDS,
        zoom: 16,
        pitch: 45,
        bearing: -20,
        duration: 4000,
      });
      const found = findBarcade();
      showPlaceCard(
        found ? found.name : 'Barcade',
        found && found.soul_summary ? found.soul_summary : BARCADE_FALLBACK_SOUL
      );
    }

    else if (n === 5) {
      hidePlaceCard();
      map.easeTo({
        center: INITIAL_CENTER,
        zoom: 10.5,
        pitch: INITIAL_PITCH,
        bearing: 0,
        duration: 4000,
      });
      map.setPaintProperty(PLACES_LAYER, 'circle-opacity-transition', { duration: 800, delay: 0 });
      map.setPaintProperty(PLACES_LAYER, 'circle-opacity', 1.0);
      drawNarrativeArcs();

      setTimeout(() => {
        const cta = document.getElementById('narrative-cta');
        if (cta) {
          cta.style.opacity = '1';
          cta.style.pointerEvents = 'auto';
        }
      }, 1500);
    }
  }

  function exitNarrative() {
    safeSet(LS_KEY, 'true');
    // Order matters with the new CSS that gates overlay display on body
    // class: add is-leaving FIRST so the overlay stays display:block while
    // it fades, THEN remove narrative-active so the chrome (header/legend)
    // can start fading back in.
    if (overlayEl) overlayEl.classList.add('is-leaving');
    document.body.classList.remove('narrative-active');
    hidePlaceCard();

    // Transition to day mode and apply exploration config
    setLightPreset('day');
    applyExplorationConfig();

    map.easeTo({
      center: INITIAL_CENTER,
      zoom: 11,
      pitch: INITIAL_PITCH,
      bearing: 0,
      duration: 2500,
    });

    // Clean up constellation
    clearConstellationTimers();
    hideConstellationLayer();

    // Restore interactive layer state
    try {
      if (originalFilter != null) map.setFilter(PLACES_LAYER, originalFilter);
      else map.setFilter(PLACES_LAYER, null);
      map.setPaintProperty(PLACES_LAYER, 'circle-opacity-transition', { duration: 300, delay: 0 });
      if (originalOpacity != null) {
        map.setPaintProperty(PLACES_LAYER, 'circle-opacity', originalOpacity);
      }
    } catch(e) {}

    if (arcFadeTimer) { clearTimeout(arcFadeTimer); arcFadeTimer = null; }
    if (typeof window.clearKindredLines === 'function') window.clearKindredLines();

    // After the fade-out, drop is-leaving so CSS reverts the overlay to
    // display:none. Don't set inline display:none — that would override the
    // CSS rule on replay until JS explicitly cleared it again.
    setTimeout(() => {
      if (overlayEl) {
        overlayEl.classList.remove('is-leaving');
        overlayEl.style.opacity = '';
      }
    }, 800);
  }

  function isNarrativeActive() {
    return document.body.classList.contains('narrative-active');
  }

  function attachListenersOnce() {
    if (listenersAttached) return;
    listenersAttached = true;

    // Inject skip button on first run.
    let skipBtn = document.getElementById('narrative-skip');
    if (!skipBtn) {
      skipBtn = document.createElement('button');
      skipBtn.id = 'narrative-skip';
      skipBtn.textContent = 'Skip';
      overlayEl.appendChild(skipBtn);
    }
    skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exitNarrative();
    });

    const cta = document.getElementById('narrative-cta');
    if (cta) {
      cta.style.transition = 'opacity 0.6s ease';
      cta.addEventListener('click', (e) => {
        e.stopPropagation();
        exitNarrative();
      });
    }

    // Overlay click advances unless the click came from a button.
    overlayEl.addEventListener('click', (e) => {
      if (!isNarrativeActive()) return;
      if (e.target.closest && (e.target.closest('#narrative-cta') || e.target.closest('#narrative-skip'))) {
        return;
      }
      if (currentStep < 5) goToStep(currentStep + 1);
    });

    document.addEventListener('keydown', (e) => {
      if (!isNarrativeActive()) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentStep < 5) goToStep(currentStep + 1);
      }
    });
  }

  function initNarrative(mapInstance) {
    if (!mapInstance) return;
    map = mapInstance;

    // Return visit — skip narrative, apply day mode and exploration config.
    // Body class is the source of truth for overlay visibility (CSS gates
    // #narrative-overlay display on `body.narrative-active`), so removing
    // the class is enough; the inline script in index.html may not have
    // added it for return visitors anyway.
    if (safeGet(LS_KEY) === 'true') {
      document.body.classList.remove('narrative-active');
      setLightPreset('day');
      applyExplorationConfig();
      return;
    }

    overlayEl = document.getElementById('narrative-overlay');
    if (!overlayEl) return;

    document.body.classList.add('narrative-active');

    // Snapshot original layer state for restoration on exit. Capture on the
    // first run only — replay would otherwise snapshot the already-mutated
    // narrative state and "restore" us into the wrong place.
    if (originalFilter == null && originalOpacity == null) {
      try {
        originalFilter = map.getFilter(PLACES_LAYER);
        originalOpacity = map.getPaintProperty(PLACES_LAYER, 'circle-opacity');
      } catch (e) {}
    }

    // Fresh-run state reset — these have to happen on every entry, not just
    // the first, so replay always starts at step 1 with a clean constellation.
    currentStep = 0;
    clearConstellationTimers();
    resetPulseState();
    hideConstellationLayer();

    const cta = document.getElementById('narrative-cta');
    if (cta) {
      cta.style.opacity = '0';
      cta.style.pointerEvents = 'none';
      cta.classList.remove('is-visible');
    }

    map.jumpTo({
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      pitch: INITIAL_PITCH,
      bearing: 0,
    });

    injectPlaceCard();
    attachListenersOnce();

    goToStep(1);
  }

  function replayNarrative() {
    localStorage.removeItem(LS_KEY);
    const overlay = document.getElementById('narrative-overlay');
    if (overlay) {
      // Clear leftover exit state. Display is governed by body class via CSS.
      overlay.classList.remove('is-leaving');
      overlay.style.opacity = '';
      overlay.style.display = '';
    }
    // Reset CTA
    const cta = document.getElementById('narrative-cta');
    if (cta) {
      cta.style.opacity = '0';
      cta.style.pointerEvents = 'none';
    }
    currentStep = 0;
    setLightPreset('night');
    resetExplorationConfig(); // hide labels and roads for narrative
    initNarrative(map);
  }

  window.initNarrative = initNarrative;
  window.replayNarrative = replayNarrative;
})();