(function () {
  'use strict';

  const LS_KEY = 'narrative_seen';
  const PLACES_LAYER = 'places-circles-main';
  const INITIAL_CENTER = [-73.98, 40.73];
  const INITIAL_ZOOM = 10;
  const INITIAL_PITCH = 40;
  // Hero places used in Beats 4–6. IDs match the place.id strings produced
  // by 01_filter_osm.js (`osm_<osm_id>`). If the underlying data shifts and
  // these IDs no longer resolve, the FALLBACK names render in the place
  // card and the kindred draws are no-ops (drawKindredLines bails on
  // unknown ids).
  const STRAND_COORDS = [-73.9909401, 40.7332796];
  const STRAND_ID = 'osm_999934639';
  const STRAND_NAME = 'Strand Bookstore';
  const TROPICANA_COORDS = [-73.8872699, 40.8283426];
  const TROPICANA_ID = 'osm_5172757288';
  const TROPICANA_NAME = 'Tropicana';

  // One Mapbox layer per reveal_group — created in main.js. We control each
  // sub-layer's opacity / radius / blur with literal values so paint-property
  // transitions fire reliably.
  const TOTAL_GROUPS = 20;
  const REVEAL_STAGGER_MS = 400;     // delay between successive group reveals
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

  // Per-group pulse state.
  let groupStartTimes = new Array(TOTAL_GROUPS).fill(null);
  let pulseAnimFrame = null;
  let lastPulseUpdate = 0;

  // Listener-attachment guard so replay doesn't stack duplicates.
  let listenersAttached = false;

  // Beat 6 has two staggered timers (Tropicana kindred at +1500ms, second-
  // tier auto-toggle at +3000ms). Stored at module scope so step 7 / exit
  // can cancel them if the user advances early.
  let tropicanaKindredTimer = null;
  let tropicanaSecondTierTimer = null;

  // --- Beat 3 constellation interaction state ---
  let constellationWebAnimFrame = null;
  let constellationWebSecondAnimFrame = null;
  let constellationInteractionSetup = false;
  let constellationTooltipEl = null;
  let constellationHintTimer = null;
  let constellationInteractionDelayTimer = null;
  let onConstellationMouseEnter = null;
  let onConstellationMouseLeave = null;
  let onConstellationMouseMove = null;
  let onConstellationClick = null;

  const CONSTELLATION_FIRST_KINDRED = 8;
  const CONSTELLATION_SECOND_KINDRED = 5;
  const CONSTELLATION_FIRST_DURATION_MS = 1000;
  const CONSTELLATION_SECOND_DURATION_MS = 1200;
  const CONSTELLATION_SECOND_DELAY_MS = 50;
  const CONSTELLATION_INTERACTION_DELAY_MS = 4000;
  const CONSTELLATION_HINT_DELAY_MS = 4000;

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

  // Look up a hero place by its osm_id and call showPlaceCard with its
  // actual name + soul_summary if present, falling back to the provided
  // name and empty soul. Used by Beats 4 and 6.
  function showHeroCard(placeId, fallbackName) {
    const fb = window.featuresById;
    const place = fb && fb.get(placeId);
    showPlaceCard(
      (place && place.name) || fallbackName,
      (place && place.soul_summary) || ''
    );
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
      } catch (e) {}
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
        map.setPaintProperty(id, 'circle-opacity-transition', { duration: 0, delay: 0 });
        map.setPaintProperty(id, 'circle-opacity', 0);
        map.setPaintProperty(id, 'circle-radius', 2);
        map.setPaintProperty(id, 'circle-blur', 1.2);
        map.setLayoutProperty(id, 'visibility', 'none');
      } catch (e) {}
    }
  }

  function fadeOutConstellation() {
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

    try {
      map.setFilter(PLACES_LAYER, ['==', ['get', 'id'], '__hidden__']);
      map.setPaintProperty(PLACES_LAYER, 'circle-opacity-transition', { duration: 0, delay: 0 });
      map.setPaintProperty(PLACES_LAYER, 'circle-opacity', 0);
    } catch (e) {}

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

  // --- Constellation interaction (Beat 3) ---

  function sampleArcLocal(from, to, height, numPoints) {
    const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    const lift = dist * height;
    const points = [];
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const mt = 1 - t;
      const x = mt * mt * from[0] + 2 * mt * t * mid[0] + t * t * to[0];
      const y = mt * mt * from[1] + 2 * mt * t * mid[1] + t * t * to[1];
      const z = Math.sin(Math.PI * t) * lift * 111320;
      points.push([x, y, z]);
    }
    return points;
  }

  function interpolateColorRgbLocal(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
      Math.round(a[3] + (b[3] - a[3]) * t),
    ];
  }

  function buildConstellationHitGeoJSON() {
    const features = [];
    const fb = window.featuresById;
    if (!fb) return { type: 'FeatureCollection', features };
    const typeSet = new Set([
      'cafe', 'bar', 'pub', 'library', 'community_centre',
      'social_facility', 'hackerspace', 'social_club',
      'arts_centre', 'theatre', 'cinema', 'music_venue', 'nightclub',
      'museum', 'gallery', 'park', 'garden', 'playground',
      'sports_centre', 'fitness_centre', 'swimming_pool',
      'books', 'records', 'hairdresser', 'beauty', 'tattoo',
      'bakery', 'deli', 'laundry', 'coffee',
      'place_of_worship',
      'dance', 'amusement_arcade', 'bowling_alley',
      'marketplace', 'memorial', 'monument', 'artwork',
      'attraction', 'viewpoint',
    ]);
    for (const place of fb.values()) {
      if (!place || !Array.isArray(place.coordinates) || place.coordinates.length !== 2) continue;
      if (!typeSet.has(place.osm_type)) continue;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: place.coordinates },
        properties: { id: place.id, name: place.name || '' },
      });
    }
    return { type: 'FeatureCollection', features };
  }

  function showConstellationTooltip(name, evt) {
    if (!constellationTooltipEl) {
      constellationTooltipEl = document.createElement('div');
      constellationTooltipEl.id = 'constellation-tooltip';
      document.body.appendChild(constellationTooltipEl);
    }
    constellationTooltipEl.textContent = name || '(unnamed)';
    const point = evt && evt.point;
    if (point) {
      constellationTooltipEl.style.left = (point.x + 12) + 'px';
      constellationTooltipEl.style.top = (point.y + 12) + 'px';
    }
    constellationTooltipEl.classList.add('is-visible');
  }

  function hideConstellationTooltip() {
    if (constellationTooltipEl) constellationTooltipEl.classList.remove('is-visible');
  }

  function syncDeckForWeb(mapInstance) {
    if (!window.deckInstance || !mapInstance) return;
    const center = mapInstance.getCenter();
    const padding = mapInstance.getPadding();
    window.deckInstance.setProps({
      viewState: {
        longitude: center.lng,
        latitude: center.lat,
        zoom: mapInstance.getZoom(),
        pitch: mapInstance.getPitch(),
        bearing: mapInstance.getBearing(),
        padding: {
          left: padding.left || 0,
          right: padding.right || 0,
          top: padding.top || 0,
          bottom: padding.bottom || 0,
        },
      },
    });
  }

  function clearConstellationKindredWeb() {
    if (constellationWebAnimFrame !== null) {
      cancelAnimationFrame(constellationWebAnimFrame);
      constellationWebAnimFrame = null;
    }
    if (constellationWebSecondAnimFrame !== null) {
      cancelAnimationFrame(constellationWebSecondAnimFrame);
      constellationWebSecondAnimFrame = null;
    }
    if (window.deckInstance) {
      try { window.deckInstance.setProps({ layers: [] }); } catch (e) {}
    }
  }

  function drawConstellationKindredWeb(placeId, mapInstance) {
    if (!window.deckInstance) return;
    const fb = window.featuresById;
    const source = fb && fb.get(placeId);
    if (!source || !Array.isArray(source.coordinates)) return;

    clearConstellationKindredWeb();

    const firstIds = Array.isArray(source.similarity_ids)
      ? source.similarity_ids.slice(0, CONSTELLATION_FIRST_KINDRED)
      : [];
    if (firstIds.length === 0) return;

    const FIRST_SRC = [255, 249, 196, 220];
    const FIRST_DST = [255, 255, 255, 180];
    const SECOND_SRC = [255, 224, 102, 100];
    const SECOND_DST = [255, 245, 160, 60];

    const ARC_POINTS = 40;
    const ARC_HEIGHT = 0.5;

    const firstSegments = [];
    for (const id of firstIds) {
      const dest = fb.get(id);
      if (!dest || !Array.isArray(dest.coordinates)) continue;
      firstSegments.push({ from: source.coordinates, to: dest.coordinates });
    }
    if (firstSegments.length === 0) return;

    const firstArcs = firstSegments.map((s) => ({
      points: sampleArcLocal(s.from, s.to, ARC_HEIGHT, ARC_POINTS),
    }));

    let firstLineData = [];
    let secondLineData = [];

    function renderWeb() {
      const layers = [];
      if (firstLineData.length > 0) {
        layers.push(
          new deck.LineLayer({
            id: 'constellation-web-glow',
            data: firstLineData,
            getSourcePosition: (d) => d.path[0],
            getTargetPosition: (d) => d.path[1],
            getColor: (d) => [d.color[0], d.color[1], d.color[2], 40],
            getWidth: 4,
            widthUnits: 'pixels',
          }),
          new deck.LineLayer({
            id: 'constellation-web',
            data: firstLineData,
            getSourcePosition: (d) => d.path[0],
            getTargetPosition: (d) => d.path[1],
            getColor: (d) => d.color,
            getWidth: 1.5,
            widthUnits: 'pixels',
          }),
        );
      }
      if (secondLineData.length > 0) {
        layers.push(
          new deck.LineLayer({
            id: 'constellation-web-second-glow',
            data: secondLineData,
            getSourcePosition: (d) => d.path[0],
            getTargetPosition: (d) => d.path[1],
            getColor: (d) => [d.color[0], d.color[1], d.color[2], 60],
            getWidth: 2,
            widthUnits: 'pixels',
          }),
          new deck.LineLayer({
            id: 'constellation-web-second',
            data: secondLineData,
            getSourcePosition: (d) => d.path[0],
            getTargetPosition: (d) => d.path[1],
            getColor: (d) => d.color,
            getWidth: 1,
            widthUnits: 'pixels',
          }),
        );
      }
      window.deckInstance.setProps({ layers });
    }

    const firstStart = performance.now();
    function firstFrame(now) {
      const t = Math.min(1, (now - firstStart) / CONSTELLATION_FIRST_DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 2);
      syncDeckForWeb(mapInstance);
      const lineData = [];
      firstArcs.forEach((arc) => {
        const visibleCount = t >= 1
          ? arc.points.length
          : Math.max(2, Math.floor(eased * ARC_POINTS));
        const visiblePoints = arc.points.slice(0, visibleCount);
        for (let i = 0; i < visiblePoints.length - 1; i++) {
          const segT = i / (ARC_POINTS - 1);
          const color = interpolateColorRgbLocal(FIRST_SRC, FIRST_DST, segT);
          lineData.push({ path: [visiblePoints[i], visiblePoints[i + 1]], color });
        }
      });
      firstLineData = lineData;
      renderWeb();
      if (t < 1) {
        constellationWebAnimFrame = requestAnimationFrame(firstFrame);
      } else {
        constellationWebAnimFrame = null;
        setTimeout(startSecondDegree, CONSTELLATION_SECOND_DELAY_MS);
      }
    }

    function startSecondDegree() {
      const exclude = new Set(firstIds);
      exclude.add(placeId);
      const seen = new Set();
      const secondSegments = [];
      for (const firstId of firstIds) {
        const firstPlace = fb.get(firstId);
        if (!firstPlace || !Array.isArray(firstPlace.coordinates)) continue;
        if (!Array.isArray(firstPlace.similarity_ids)) continue;
        for (const secondId of firstPlace.similarity_ids.slice(0, CONSTELLATION_SECOND_KINDRED)) {
          if (exclude.has(secondId) || seen.has(secondId)) continue;
          seen.add(secondId);
          const secondPlace = fb.get(secondId);
          if (!secondPlace || !Array.isArray(secondPlace.coordinates)) continue;
          secondSegments.push({ from: firstPlace.coordinates, to: secondPlace.coordinates });
        }
      }
      if (secondSegments.length === 0) return;

      const secondArcs = secondSegments.map((s) => ({
        points: sampleArcLocal(s.from, s.to, ARC_HEIGHT, ARC_POINTS),
      }));
      const secondStart = performance.now();
      function secondFrame(now) {
        const t = Math.min(1, (now - secondStart) / CONSTELLATION_SECOND_DURATION_MS);
        const eased = 1 - Math.pow(1 - t, 2);
        syncDeckForWeb(mapInstance);
        const lineData = [];
        secondArcs.forEach((arc) => {
          const visibleCount = t >= 1
            ? arc.points.length
            : Math.max(2, Math.floor(eased * ARC_POINTS));
          const visiblePoints = arc.points.slice(0, visibleCount);
          for (let i = 0; i < visiblePoints.length - 1; i++) {
            const segT = i / (ARC_POINTS - 1);
            const color = interpolateColorRgbLocal(SECOND_SRC, SECOND_DST, segT);
            lineData.push({ path: [visiblePoints[i], visiblePoints[i + 1]], color });
          }
        });
        secondLineData = lineData;
        renderWeb();
        if (t < 1) {
          constellationWebSecondAnimFrame = requestAnimationFrame(secondFrame);
        } else {
          constellationWebSecondAnimFrame = null;
        }
      }
      constellationWebSecondAnimFrame = requestAnimationFrame(secondFrame);
    }

    constellationWebAnimFrame = requestAnimationFrame(firstFrame);
  }

  function setupConstellationInteraction(mapInstance) {
    if (constellationInteractionSetup) return;
    if (!mapInstance) return;

    if (!mapInstance.getSource('constellation-hit')) {
      mapInstance.addSource('constellation-hit', {
        type: 'geojson',
        data: buildConstellationHitGeoJSON(),
      });
    }
    if (!mapInstance.getLayer('constellation-hit-layer')) {
      mapInstance.addLayer({
        id: 'constellation-hit-layer',
        type: 'circle',
        source: 'constellation-hit',
        paint: {
          'circle-radius': 15,
          'circle-color': '#000000',
          'circle-opacity': 0,
        },
      });
    }

    onConstellationMouseEnter = (e) => {
      if (!e.features || !e.features.length) return;
      mapInstance.getCanvas().style.cursor = 'pointer';
      showConstellationTooltip(e.features[0].properties.name, e);
    };
    onConstellationMouseMove = (e) => {
      if (!e.features || !e.features.length) return;
      showConstellationTooltip(e.features[0].properties.name, e);
    };
    onConstellationMouseLeave = () => {
      mapInstance.getCanvas().style.cursor = '';
      hideConstellationTooltip();
    };
    onConstellationClick = (e) => {
      if (!e.features || !e.features.length) return;
      const pid = e.features[0].properties.id;
      if (pid) drawConstellationKindredWeb(pid, mapInstance);
    };

    mapInstance.on('mouseenter', 'constellation-hit-layer', onConstellationMouseEnter);
    mapInstance.on('mousemove', 'constellation-hit-layer', onConstellationMouseMove);
    mapInstance.on('mouseleave', 'constellation-hit-layer', onConstellationMouseLeave);
    mapInstance.on('click', 'constellation-hit-layer', onConstellationClick);

    constellationInteractionSetup = true;
  }

  function teardownConstellationInteraction(mapInstance) {
    if (!mapInstance) return;
    if (constellationInteractionDelayTimer) {
      clearTimeout(constellationInteractionDelayTimer);
      constellationInteractionDelayTimer = null;
    }
    if (constellationHintTimer) {
      clearTimeout(constellationHintTimer);
      constellationHintTimer = null;
    }

    if (constellationInteractionSetup) {
      try {
        if (onConstellationMouseEnter) mapInstance.off('mouseenter', 'constellation-hit-layer', onConstellationMouseEnter);
        if (onConstellationMouseMove) mapInstance.off('mousemove', 'constellation-hit-layer', onConstellationMouseMove);
        if (onConstellationMouseLeave) mapInstance.off('mouseleave', 'constellation-hit-layer', onConstellationMouseLeave);
        if (onConstellationClick) mapInstance.off('click', 'constellation-hit-layer', onConstellationClick);
      } catch (e) {}
      onConstellationMouseEnter = null;
      onConstellationMouseMove = null;
      onConstellationMouseLeave = null;
      onConstellationClick = null;
      try {
        if (mapInstance.getLayer('constellation-hit-layer')) {
          mapInstance.removeLayer('constellation-hit-layer');
        }
        if (mapInstance.getSource('constellation-hit')) {
          mapInstance.removeSource('constellation-hit');
        }
      } catch (e) {}
      constellationInteractionSetup = false;
    }

    if (constellationTooltipEl) {
      constellationTooltipEl.remove();
      constellationTooltipEl = null;
    }

    const hintEl = document.querySelector('.narrative-step[data-step="3"] .narrative-hint');
    if (hintEl) hintEl.remove();

    clearConstellationKindredWeb();
  }

  function showNarrativeHintForBeat3() {
    const textEl = document.querySelector('.narrative-step[data-step="3"] .narrative-text');
    if (!textEl) return;
    let hint = textEl.querySelector('.narrative-hint');
    if (!hint) {
      hint = document.createElement('p');
      hint.className = 'narrative-hint';
      hint.textContent = 'Explore the lights — each one is a gathering space';
      textEl.appendChild(hint);
    }
    void hint.offsetWidth;
    hint.classList.add('is-visible');
  }

  function goToStep(n) {
    currentStep = n;
    showStep(n);

    if (n !== 3 && overlayEl) {
      overlayEl.classList.remove('is-interactive');
      overlayEl.style.pointerEvents = '';
    }

    if (n === 1) {
      try {
        map.setFilter(PLACES_LAYER, ['==', ['get', 'id'], '__hidden__']);
        map.setPaintProperty(PLACES_LAYER, 'circle-opacity-transition', { duration: 0, delay: 0 });
        map.setPaintProperty(PLACES_LAYER, 'circle-opacity', 0);
      } catch (e) {}
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
      // Make overlay pointer-events passthrough so the map is interactable.
      if (overlayEl) {
        overlayEl.classList.add('is-interactive');
        overlayEl.style.pointerEvents = 'none';
      }
      constellationReveal();
      if (constellationInteractionDelayTimer) clearTimeout(constellationInteractionDelayTimer);
      constellationInteractionDelayTimer = setTimeout(() => {
        setupConstellationInteraction(map);
      }, CONSTELLATION_INTERACTION_DELAY_MS);
      if (constellationHintTimer) clearTimeout(constellationHintTimer);
      constellationHintTimer = setTimeout(() => {
        showNarrativeHintForBeat3();
      }, CONSTELLATION_HINT_DELAY_MS);
    }

    else if (n === 4) {
      // Crossfade: constellation out, interactive base layer in. Hero
      // place card appears as the camera flies to Strand.
      teardownConstellationInteraction(map);
      try {
        if (originalFilter != null) map.setFilter(PLACES_LAYER, originalFilter);
        else map.setFilter(PLACES_LAYER, null);
        map.setPaintProperty(PLACES_LAYER, 'circle-opacity-transition', { duration: 1500, delay: 0 });
        map.setPaintProperty(PLACES_LAYER, 'circle-opacity', 0.9);

        fadeOutConstellation();
        setTimeout(() => hideConstellationLayer(), FADE_OUT_MS + 100);
      } catch (e) {}

      map.flyTo({
        center: STRAND_COORDS,
        zoom: 16,
        pitch: 45,
        bearing: -20,
        duration: 3000,
      });
      showHeroCard(STRAND_ID, STRAND_NAME);
    }

    else if (n === 5) {
      // Pull back and draw Strand's kindred — show that connections span
      // neighborhoods, not just nearby blocks.
      if (typeof window.drawKindredLines === 'function') {
        window.drawKindredLines(STRAND_ID);
      }
      map.easeTo({
        center: [-73.975, 40.74],
        zoom: 13,
        pitch: INITIAL_PITCH,
        bearing: 0,
        duration: 2500,
      });
    }

    else if (n === 6) {
      // Clear Strand's lines, fly up to Tropicana, draw its kindred
      // (after 1.5s so the camera settles), then auto-toggle second-tier
      // (after 3s) to reveal the wider web.
      hidePlaceCard();
      if (typeof window.clearKindredLines === 'function') window.clearKindredLines();
      if (tropicanaKindredTimer) { clearTimeout(tropicanaKindredTimer); tropicanaKindredTimer = null; }
      if (tropicanaSecondTierTimer) { clearTimeout(tropicanaSecondTierTimer); tropicanaSecondTierTimer = null; }

      map.flyTo({
        center: TROPICANA_COORDS,
        zoom: 15,
        pitch: 45,
        bearing: 20,
        duration: 3000,
      });
      showHeroCard(TROPICANA_ID, TROPICANA_NAME);

      tropicanaKindredTimer = setTimeout(() => {
        tropicanaKindredTimer = null;
        if (typeof window.drawKindredLines === 'function') {
          window.drawKindredLines(TROPICANA_ID);
        }
      }, 1500);

     tropicanaSecondTierTimer = setTimeout(() => {
        if (typeof window.setSelected === 'function') {
          window.setSelected(TROPICANA_ID);  // sets selectedPlaceId so toggleSecondTier works
        }
        if (typeof window.toggleSecondTier === 'function') {
          window.toggleSecondTier();
        }
      }, 3000);
    }

    else if (n === 7) {
      // Finale: clear everything, pull back to the wide view, reveal CTA.
      hidePlaceCard();
      if (tropicanaKindredTimer) { clearTimeout(tropicanaKindredTimer); tropicanaKindredTimer = null; }
      if (tropicanaSecondTierTimer) { clearTimeout(tropicanaSecondTierTimer); tropicanaSecondTierTimer = null; }
      // Turn second-tier OFF if Beat 6 toggled it on, so the finale's
      // wide-view doesn't keep arcs from the previous beat live.
      if (typeof window.toggleSecondTier === 'function' && window.showSecondTier) {
        try { window.toggleSecondTier(); } catch (e) {}
      }
      if (typeof window.clearKindredLines === 'function') window.clearKindredLines();
      map.easeTo({
        center: INITIAL_CENTER,
        zoom: 10.5,
        pitch: INITIAL_PITCH,
        bearing: 0,
        duration: 2000,
      });
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
    teardownConstellationInteraction(map);
    // Cancel Beat 6's staggered Tropicana timers and turn off second-tier
    // if the auto-toggle had fired — otherwise the post-exit interactive
    // map would inherit second-tier mode without an active selection.
    if (tropicanaKindredTimer) { clearTimeout(tropicanaKindredTimer); tropicanaKindredTimer = null; }
    if (tropicanaSecondTierTimer) { clearTimeout(tropicanaSecondTierTimer); tropicanaSecondTierTimer = null; }
    if (typeof window.toggleSecondTier === 'function' && window.showSecondTier) {
      try { window.toggleSecondTier(); } catch (e) {}
    }
    if (overlayEl) {
      overlayEl.classList.remove('is-interactive');
      overlayEl.style.pointerEvents = '';
    }
    if (overlayEl) overlayEl.classList.add('is-leaving');
    document.body.classList.remove('narrative-active');
    hidePlaceCard();

    setLightPreset('day');
    applyExplorationConfig();

    map.easeTo({
      center: INITIAL_CENTER,
      zoom: 11,
      pitch: INITIAL_PITCH,
      bearing: 0,
      duration: 2500,
    });

    clearConstellationTimers();
    hideConstellationLayer();

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

    setTimeout(() => {
      if (overlayEl) {
        overlayEl.classList.remove('is-leaving');
        overlayEl.style.opacity = '';
      }
      if (typeof window.removeConstellationLayers === 'function' && map) {
        try { window.removeConstellationLayers(map); } catch (e) {}
      }
    }, 800);
  }

  function isNarrativeActive() {
    return document.body.classList.contains('narrative-active');
  }

  function attachListenersOnce() {
    if (listenersAttached) return;
    listenersAttached = true;

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

    overlayEl.addEventListener('click', (e) => {
      if (!isNarrativeActive()) return;
      if (e.target.closest && (e.target.closest('#narrative-cta') || e.target.closest('#narrative-skip'))) {
        return;
      }
      // Don't advance during Beat 3 interactive mode
      if (overlayEl.classList.contains('is-interactive')) return;
      if (currentStep < 7) goToStep(currentStep + 1);
    });

    document.addEventListener('keydown', (e) => {
      if (!isNarrativeActive()) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentStep < 7) goToStep(currentStep + 1);
      }
    });
  }

  function initNarrative(mapInstance) {
    if (!mapInstance) return;
    map = mapInstance;

    if (safeGet(LS_KEY) === 'true') {
      document.body.classList.remove('narrative-active');
      setLightPreset('day');
      applyExplorationConfig();
      return;
    }

    overlayEl = document.getElementById('narrative-overlay');
    if (!overlayEl) return;

    document.body.classList.add('narrative-active');

    if (originalFilter == null && originalOpacity == null) {
      try {
        originalFilter = map.getFilter(PLACES_LAYER);
        originalOpacity = map.getPaintProperty(PLACES_LAYER, 'circle-opacity');
      } catch (e) {}
    }

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
      overlay.classList.remove('is-leaving');
      overlay.classList.remove('is-interactive');
      overlay.style.opacity = '';
      overlay.style.display = '';
    }
    const cta = document.getElementById('narrative-cta');
    if (cta) {
      cta.style.opacity = '0';
      cta.style.pointerEvents = 'none';
    }
    currentStep = 0;
    setLightPreset('night');
    resetExplorationConfig();
    if (typeof window.addConstellationLayers === 'function' && map) {
      try { window.addConstellationLayers(map); } catch (e) {}
    }
    initNarrative(map);
  }

  window.initNarrative = initNarrative;
  window.replayNarrative = replayNarrative;
})();