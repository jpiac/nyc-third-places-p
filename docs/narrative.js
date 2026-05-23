(function () {
  'use strict';

  const LS_KEY = 'narrative_seen';
  const PLACES_LAYER = 'places-circles-main';
  const INITIAL_CENTER = [-73.98, 40.7];
  const INITIAL_ZOOM = 10;
  const INITIAL_PITCH = 40;
  // Hero places used across Beats 4–8. IDs match the place.id strings
  // produced by 01_filter_osm.js (`osm_<osm_id>`). If the underlying data
  // shifts and these IDs no longer resolve, the FALLBACK names render in
  // the right-side card and the arc draws become no-ops.
  const ISLAND_COORDS = [-73.9954421, 40.7167915];
  const ISLAND_ID = 'osm_12228581278';
  const ISLAND_NAME = 'Island NYC';
  const STRAND_COORDS = [-73.9909401, 40.7332796];
  const STRAND_ID = 'osm_999934639';
  const STRAND_NAME = 'Strand Bookstore';
  const TROPICANA_COORDS = [-73.89881, 40.81426];
  const TROPICANA_ID = 'osm_5172757288';
  const TROPICANA_NAME = 'Tropicana';

  // Star palette — used for ALL narrative arcs (first- and second-degree)
  // throughout Beats 4–8. The colored type-palette is reserved for the
  // post-CTA interactive map.
  const STAR_FIRST_SRC = [255, 249, 196, 220];
  const STAR_FIRST_DST = [255, 255, 255, 180];
  const STAR_SECOND_SRC = [255, 224, 102, 100];
  const STAR_SECOND_DST = [255, 245, 160, 60];

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

  // 9-beat narrative — right-side cards, web badge, and the four per-beat
  // staggered timers. All cleared by exitNarrative.
  let narrativePlaceCardEl = null;
  let narrativeKindredCardEl = null;
  let narrativeWebBadgeVisible = false;
  let islandSecondTierTimer = null;
  let strandKindredTimer = null;
  // Beat-4 island first-tier draw timer (the 2800ms wait between flyTo
  // start and arc start).
  let islandArcTimer = null;
  // Beat 7 Tropicana card-show timer + Beat 8 kindred-card and web-badge
  // and second-tier sub-timers.
  let tropicanaCardTimer = null;
  let tropicanaKindredCardTimer = null;
  let tropicanaWebBadgeTimer = null;
  let strandKindredCardTimer = null;

  // rAF handles for the narrative arc layers. drawNarrativeArcs uses
  // 'narrative-arcs-glow' / 'narrative-arcs'; the second-tier function
  // ADDS 'narrative-arcs-second-glow' / 'narrative-arcs-second' on top
  // (rather than replacing).
  let narrativeArcsAnimFrame = null;
  let narrativeArcsSecondAnimFrame = null;
  // Per-tier line data cached at module level so renderNarrativeArcs()
  // can re-emit both tiers together — deck.gl's setProps replaces all
  // layers, so we have to pass both sets every frame we want both
  // visible.
  let narrativeFirstLineData = [];
  let narrativeSecondLineData = [];

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

    // Base radius scales with zoom — same stops as the expression
    const zoom = map.getZoom();
    const baseRadius = 2 + Math.max(0, Math.min(1, (zoom - 10) / 5)) * 4; // 2 at z10, 6 at z15

    let anyActive = false;
    for (let g = 0; g < TOTAL_GROUPS; g++) {
      const startedAt = groupStartTimes[g];
      if (startedAt === null) continue;
      anyActive = true;
      const elapsed = (now - startedAt) / 1000;
      const phase = elapsed * PULSE_FREQUENCY_HZ;
      const r = baseRadius + Math.sin(phase) * (baseRadius * 0.4); // pulse amplitude scales with size
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
        map.setPaintProperty(id, 'circle-radius', ['interpolate',['linear'],['zoom'],13,2,15,6],);
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
        map.setPaintProperty(id, 'circle-radius', ['interpolate',['linear'],['zoom'],13,2,15,6],);
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

  // --- 9-beat narrative arc rendering ---
  // Reuses sampleArcLocal / interpolateColorRgbLocal (defined above) with
  // the star palette and dedicated deck.gl layer IDs:
  //   First-tier:  narrative-arcs-glow + narrative-arcs
  //   Second-tier: narrative-arcs-second-glow + narrative-arcs-second
  // Both tiers can render simultaneously — drawNarrativeSecondTierArcs
  // ADDS to the first-tier layers rather than replacing them.

  function syncDeckForNarrative() {
    if (!window.deckInstance || !map) return;
    const center = map.getCenter();
    const padding = map.getPadding();
    window.deckInstance.setProps({
      viewState: {
        longitude: center.lng,
        latitude: center.lat,
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
        padding: {
          left: padding.left || 0,
          right: padding.right || 0,
          top: padding.top || 0,
          bottom: padding.bottom || 0,
        },
      },
    });
  }

  function renderNarrativeArcs() {
    if (!window.deckInstance) return;
    const layers = [];
    if (narrativeFirstLineData.length > 0) {
      layers.push(
        new deck.LineLayer({
          id: 'narrative-arcs-glow',
          data: narrativeFirstLineData,
          getSourcePosition: (d) => d.path[0],
          getTargetPosition: (d) => d.path[1],
          getColor: (d) => [d.color[0], d.color[1], d.color[2], 40],
          getWidth: 4,
          widthUnits: 'pixels',
        }),
        new deck.LineLayer({
          id: 'narrative-arcs',
          data: narrativeFirstLineData,
          getSourcePosition: (d) => d.path[0],
          getTargetPosition: (d) => d.path[1],
          getColor: (d) => d.color,
          getWidth: 1.5,
          widthUnits: 'pixels',
        }),
      );
    }
    if (narrativeSecondLineData.length > 0) {
      layers.push(
        new deck.LineLayer({
          id: 'narrative-arcs-second-glow',
          data: narrativeSecondLineData,
          getSourcePosition: (d) => d.path[0],
          getTargetPosition: (d) => d.path[1],
          getColor: (d) => [d.color[0], d.color[1], d.color[2], 60],
          getWidth: 2,
          widthUnits: 'pixels',
        }),
        new deck.LineLayer({
          id: 'narrative-arcs-second',
          data: narrativeSecondLineData,
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

  function drawNarrativeArcs(placeId, onComplete) {
    if (!window.deckInstance) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }
    const fb = window.featuresById;
    const source = fb && fb.get(placeId);
    if (!source || !Array.isArray(source.coordinates)) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }
    if (narrativeArcsAnimFrame !== null) {
      cancelAnimationFrame(narrativeArcsAnimFrame);
      narrativeArcsAnimFrame = null;
    }

    const ids = Array.isArray(source.similarity_ids)
      ? source.similarity_ids.slice(0, 8)
      : [];
    const segments = [];
    for (const id of ids) {
      const dest = fb.get(id);
      if (!dest || !Array.isArray(dest.coordinates)) continue;
      segments.push({ from: source.coordinates, to: dest.coordinates });
    }
    if (segments.length === 0) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }

    const ARC_POINTS = 40;
    const ARC_HEIGHT = 0.5;
    const DURATION = 1200;
    const arcPaths = segments.map((s) => ({
      points: sampleArcLocal(s.from, s.to, ARC_HEIGHT, ARC_POINTS),
    }));
    const startTime = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - startTime) / DURATION);
      const eased = 1 - Math.pow(1 - t, 2);
      syncDeckForNarrative();
      const lineData = [];
      arcPaths.forEach((arc) => {
        const visibleCount = t >= 1
          ? arc.points.length
          : Math.max(2, Math.floor(eased * ARC_POINTS));
        const visiblePoints = arc.points.slice(0, visibleCount);
        for (let i = 0; i < visiblePoints.length - 1; i++) {
          const segT = i / (ARC_POINTS - 1);
          const color = interpolateColorRgbLocal(STAR_FIRST_SRC, STAR_FIRST_DST, segT);
          lineData.push({ path: [visiblePoints[i], visiblePoints[i + 1]], color });
        }
      });
      narrativeFirstLineData = lineData;
      renderNarrativeArcs();
      if (t < 1) {
        narrativeArcsAnimFrame = requestAnimationFrame(frame);
      } else {
        narrativeArcsAnimFrame = null;
        if (typeof onComplete === 'function') onComplete();
      }
    }
    narrativeArcsAnimFrame = requestAnimationFrame(frame);
  }

  function drawNarrativeSecondTierArcs(placeId) {
    if (!window.deckInstance) return;
    const fb = window.featuresById;
    const source = fb && fb.get(placeId);
    if (!source || !Array.isArray(source.similarity_ids)) return;
    if (narrativeArcsSecondAnimFrame !== null) {
      cancelAnimationFrame(narrativeArcsSecondAnimFrame);
      narrativeArcsSecondAnimFrame = null;
    }

    const firstIds = source.similarity_ids.slice(0, 8);
    const exclude = new Set(firstIds);
    exclude.add(placeId);
    const seen = new Set();
    const segments = [];
    for (const firstId of firstIds) {
      const firstPlace = fb.get(firstId);
      if (!firstPlace || !Array.isArray(firstPlace.coordinates)) continue;
      if (!Array.isArray(firstPlace.similarity_ids)) continue;
      for (const secondId of firstPlace.similarity_ids.slice(0, 5)) {
        if (exclude.has(secondId) || seen.has(secondId)) continue;
        seen.add(secondId);
        const secondPlace = fb.get(secondId);
        if (!secondPlace || !Array.isArray(secondPlace.coordinates)) continue;
        segments.push({ from: firstPlace.coordinates, to: secondPlace.coordinates });
      }
    }
    if (segments.length === 0) return;

    const ARC_POINTS = 40;
    const ARC_HEIGHT = 0.5;
    const DURATION = 1000;
    const arcPaths = segments.map((s) => ({
      points: sampleArcLocal(s.from, s.to, ARC_HEIGHT, ARC_POINTS),
    }));
    const startTime = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - startTime) / DURATION);
      const eased = 1 - Math.pow(1 - t, 2);
      syncDeckForNarrative();
      const lineData = [];
      arcPaths.forEach((arc) => {
        const visibleCount = t >= 1
          ? arc.points.length
          : Math.max(2, Math.floor(eased * ARC_POINTS));
        const visiblePoints = arc.points.slice(0, visibleCount);
        for (let i = 0; i < visiblePoints.length - 1; i++) {
          const segT = i / (ARC_POINTS - 1);
          const color = interpolateColorRgbLocal(STAR_SECOND_SRC, STAR_SECOND_DST, segT);
          lineData.push({ path: [visiblePoints[i], visiblePoints[i + 1]], color });
        }
      });
      narrativeSecondLineData = lineData;
      renderNarrativeArcs();
      if (t < 1) {
        narrativeArcsSecondAnimFrame = requestAnimationFrame(frame);
      } else {
        narrativeArcsSecondAnimFrame = null;
      }
    }
    narrativeArcsSecondAnimFrame = requestAnimationFrame(frame);
  }

  function clearNarrativeArcs() {
    if (narrativeArcsAnimFrame !== null) {
      cancelAnimationFrame(narrativeArcsAnimFrame);
      narrativeArcsAnimFrame = null;
    }
    if (narrativeArcsSecondAnimFrame !== null) {
      cancelAnimationFrame(narrativeArcsSecondAnimFrame);
      narrativeArcsSecondAnimFrame = null;
    }
    narrativeFirstLineData = [];
    narrativeSecondLineData = [];
    if (window.deckInstance) {
      try { window.deckInstance.setProps({ layers: [] }); } catch (e) {}
    }
  }

  // --- Right-side cards ---
  // Two stacked cards on the right edge of the viewport:
  //   #narrative-right-card     — place name + soul summary
  //   #narrative-kindred-card   — list of kindred places, with optional
  //                                web-active badge in the header
  // When the kindred card appears, the place card slides UP via
  // .is-slid-up (CSS translateY) so the kindred card sits beneath it.

  function lookupPlace(placeId) {
    const fb = window.featuresById;
    return (fb && fb.get(placeId)) || null;
  }

  function showNarrativePlaceCard(placeId, fallbackName) {
    if (!narrativePlaceCardEl) {
      narrativePlaceCardEl = document.createElement('div');
      narrativePlaceCardEl.id = 'narrative-right-card';
      narrativePlaceCardEl.innerHTML =
        '<div class="narrative-place-name"></div>' +
        '<div class="narrative-place-soul"></div>';
      document.body.appendChild(narrativePlaceCardEl);
    }
    const place = lookupPlace(placeId);
    narrativePlaceCardEl.querySelector('.narrative-place-name').textContent =
      (place && place.name) || fallbackName;
    narrativePlaceCardEl.querySelector('.narrative-place-soul').textContent =
      (place && place.soul_summary) || '';
    // Reset any prior slid-up state so a fresh show starts in the bottom
    // position.
    narrativePlaceCardEl.classList.remove('is-slid-up');
    // Force layout before adding is-visible so the transition runs.
    void narrativePlaceCardEl.offsetWidth;
    narrativePlaceCardEl.classList.add('is-visible');
  }

  function slideUpNarrativePlaceCard() {
    if (narrativePlaceCardEl) {
      narrativePlaceCardEl.classList.add('is-slid-up');
    }
  }

  function hideNarrativePlaceCard() {
    if (!narrativePlaceCardEl) return;
    narrativePlaceCardEl.classList.remove('is-visible');
    // Remove from DOM after the fade-out so a subsequent show rebuilds
    // cleanly with no slid-up class lingering.
    const el = narrativePlaceCardEl;
    narrativePlaceCardEl = null;
    setTimeout(() => { try { el.remove(); } catch (e) {} }, 450);
  }

  function buildKindredItemMarkup(placeId) {
    const place = lookupPlace(placeId);
    if (!place) return '';
    const colorByType = (window.COLOR_BY_TYPE || {});
    const defaultColor = window.COLOR_DEFAULT || '#888888';
    const color = colorByType[place.osm_type] || defaultColor;
    const name = place.name || '(unnamed)';
    // Minimal sanitization — names come from OSM and may include quotes;
    // textContent on the resulting element would be safer, but innerHTML
    // here lets us batch all rows in one assignment. Use a small escape.
    const safeName = String(name)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    return (
      '<div class="narrative-kindred-item">' +
        '<span class="narrative-kindred-dot" style="background:' + color + '"></span>' +
        '<span>' + safeName + '</span>' +
      '</div>'
    );
  }

  function showNarrativeKindredCard(placeId) {
    if (!narrativeKindredCardEl) {
      narrativeKindredCardEl = document.createElement('div');
      narrativeKindredCardEl.id = 'narrative-kindred-card';
      document.body.appendChild(narrativeKindredCardEl);
    }
    const place = lookupPlace(placeId);
    const ids = (place && Array.isArray(place.similarity_ids))
      ? place.similarity_ids.slice(0, 8)
      : [];
    const itemsHtml = ids.map(buildKindredItemMarkup).join('');
    narrativeKindredCardEl.innerHTML =
      '<div class="narrative-kindred-header">' +
        '<span class="narrative-kindred-title">Kindred Places</span>' +
        '<span class="narrative-web-badge">◎ Web active</span>' +
      '</div>' +
      itemsHtml;
    narrativeWebBadgeVisible = false;
    void narrativeKindredCardEl.offsetWidth;
    narrativeKindredCardEl.classList.add('is-visible');
  }

  function showNarrativeWebBadge() {
    if (!narrativeKindredCardEl) return;
    const badge = narrativeKindredCardEl.querySelector('.narrative-web-badge');
    if (!badge) return;
    badge.classList.add('is-visible');
    narrativeWebBadgeVisible = true;
  }

  function hideNarrativeKindredCard() {
    if (!narrativeKindredCardEl) return;
    narrativeKindredCardEl.classList.remove('is-visible');
    const el = narrativeKindredCardEl;
    narrativeKindredCardEl = null;
    narrativeWebBadgeVisible = false;
    setTimeout(() => { try { el.remove(); } catch (e) {} }, 550);
  }

  function clearAllNarrativeBeatTimers() {
    if (islandArcTimer) { clearTimeout(islandArcTimer); islandArcTimer = null; }
    if (islandSecondTierTimer) { clearTimeout(islandSecondTierTimer); islandSecondTierTimer = null; }
    if (strandKindredTimer) { clearTimeout(strandKindredTimer); strandKindredTimer = null; }
    if (strandKindredCardTimer) { clearTimeout(strandKindredCardTimer); strandKindredCardTimer = null; }
    if (tropicanaCardTimer) { clearTimeout(tropicanaCardTimer); tropicanaCardTimer = null; }
    if (tropicanaKindredTimer) { clearTimeout(tropicanaKindredTimer); tropicanaKindredTimer = null; }
    if (tropicanaKindredCardTimer) { clearTimeout(tropicanaKindredCardTimer); tropicanaKindredCardTimer = null; }
    if (tropicanaWebBadgeTimer) { clearTimeout(tropicanaWebBadgeTimer); tropicanaWebBadgeTimer = null; }
    if (tropicanaSecondTierTimer) { clearTimeout(tropicanaSecondTierTimer); tropicanaSecondTierTimer = null; }
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

    // The constellation interaction beat is gone in the 9-beat flow; this
    // remains as a safety net in case any prior interactive state lingers.
    if (overlayEl) {
      overlayEl.classList.remove('is-interactive');
      overlayEl.style.pointerEvents = '';
    }

    if (n === 1) {
      // Hide the colored interactive places layer for the entire
      // narrative. We don't restore it until the CTA is clicked (see
      // exitNarrative).
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
    }

    else if (n === 3) {
      // No interaction this beat — just trigger the constellation reveal
      // and let it play through. PLACES_LAYER stays hidden.
      constellationReveal();
    }

    else if (n === 4) {
      // Constellation stays visible (no fadeOut). Camera flies to Island
      // NYC; arcs (first + second tier in cascade) draw 2800ms after the
      // flyTo begins so they appear while the camera is still settling.
      clearAllNarrativeBeatTimers();
      map.flyTo({
        center: ISLAND_COORDS,
        zoom: 11,
        pitch: 45,
        bearing: 10,
        duration: 2500,
      });
      islandArcTimer = setTimeout(() => {
        islandArcTimer = null;
        drawNarrativeArcs(ISLAND_ID, () => {
          drawNarrativeSecondTierArcs(ISLAND_ID);
        });
      }, 2800);
    }

    else if (n === 5) {
      // Wipe Beat 4's arcs, fly to Strand, show its card. No arcs yet.
      clearNarrativeArcs();
      clearAllNarrativeBeatTimers();
      map.flyTo({
        center: STRAND_COORDS,
        zoom: 16,
        pitch: 45,
        bearing: -20,
        duration: 5000,
      });
      showNarrativePlaceCard(STRAND_ID, STRAND_NAME);
    }

    else if (n === 6) {
      // Slide the Strand card up, pull camera back, draw Strand's
      // kindred, then surface the kindred list card below.
      slideUpNarrativePlaceCard();
      map.easeTo({
        center: [-73.975, 40.74],
        zoom: 12,
        pitch: INITIAL_PITCH,
        bearing: 60,
        duration: 3500,
      });
      drawNarrativeArcs(STRAND_ID, () => {});
      if (strandKindredCardTimer) clearTimeout(strandKindredCardTimer);
      strandKindredCardTimer = setTimeout(() => {
        strandKindredCardTimer = null;
        showNarrativeKindredCard(STRAND_ID);
      }, 300);
    }

    else if (n === 7) {
      // Transition to Tropicana. Clean Strand state first.
      clearNarrativeArcs();
      hideNarrativeKindredCard();
      hideNarrativePlaceCard();
      clearAllNarrativeBeatTimers();
      map.flyTo({
        center: TROPICANA_COORDS,
        zoom: 15,
        pitch: 85,
        bearing: 210,
        duration: 3000,
      });
      tropicanaCardTimer = setTimeout(() => {
        tropicanaCardTimer = null;
        showNarrativePlaceCard(TROPICANA_ID, TROPICANA_NAME);
      }, 500);
    }

    else if (n === 8) {
      // Slide the Tropicana card up, draw its kindred, surface the
      // kindred list card, then a beat later add the "web active" badge
      // and draw the second-degree arcs.
      map.flyTo({
        center: [-73.92325, 40.76388],
        zoom: 12,
        pitch: 60,
        bearing: 210,
        duration: 5000,
      });
      slideUpNarrativePlaceCard();
      drawNarrativeArcs(TROPICANA_ID, () => {});
      if (tropicanaKindredCardTimer) clearTimeout(tropicanaKindredCardTimer);
      tropicanaKindredCardTimer = setTimeout(() => {
        tropicanaKindredCardTimer = null;
        showNarrativeKindredCard(TROPICANA_ID);
      }, 300);
      if (tropicanaWebBadgeTimer) clearTimeout(tropicanaWebBadgeTimer);
      tropicanaWebBadgeTimer = setTimeout(() => {
        tropicanaWebBadgeTimer = null;
        showNarrativeWebBadge();
      }, 1800);
      if (tropicanaSecondTierTimer) clearTimeout(tropicanaSecondTierTimer);
      tropicanaSecondTierTimer = setTimeout(() => {
        tropicanaSecondTierTimer = null;
        drawNarrativeSecondTierArcs(TROPICANA_ID);
      }, 2000);
    }

    else if (n === 9) {
      // Finale: clear arcs + cards, pull camera back, reveal CTA. The
      // constellation stays visible behind the wide view.
      clearNarrativeArcs();
      hideNarrativeKindredCard();
      hideNarrativePlaceCard();
      clearAllNarrativeBeatTimers();
      map.easeTo({
        center: INITIAL_CENTER,
        zoom: 11,
        pitch: INITIAL_PITCH,
        bearing: 0,
        duration: 5000,
      });
      setTimeout(() => {
        const cta = document.getElementById('narrative-cta');
        if (cta) {
          cta.style.opacity = '1';
          cta.style.pointerEvents = 'auto';
        }
      }, 5500);
    }
  }

  function exitNarrative() {
    safeSet(LS_KEY, 'true');
    teardownConstellationInteraction(map);
    // Cancel every narrative beat timer + the narrative arc rAFs + both
    // right-side cards, before the rest of the cleanup runs.
    clearAllNarrativeBeatTimers();
    clearNarrativeArcs();
    hideNarrativePlaceCard();
    hideNarrativeKindredCard();
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
      zoom: 11.5,
      pitch: INITIAL_PITCH,
      bearing: 0,
      duration: 5000,
    });

    clearConstellationTimers();
    hideConstellationLayer();

    try {
      // Restore full filter on exit
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
      if (currentStep < 9) goToStep(currentStep + 1);
    });

    document.addEventListener('keydown', (e) => {
      if (!isNarrativeActive()) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentStep < 9) goToStep(currentStep + 1);
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