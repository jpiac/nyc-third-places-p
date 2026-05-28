(function () {
  'use strict';

  const LS_KEY = 'narrative_seen';
  const PLACES_LAYER = 'places-circles-main';
  const INITIAL_CENTER = [-73.95, 40.7];
  const INITIAL_ZOOM = 11;
  const INITIAL_PITCH = 40;
  const TROPICANA_COORDS = [-73.8872699, 40.8283426];
  const TROPICANA_ID = 'osm_5172757288';
  const TROPICANA_NAME = 'Tropicana';

  const HENRIETTA_COORDS = [-74.0065268, 40.7310628];
  const HENRIETTA_ID = 'osm_6182279414';
  const HENRIETTA_NAME = 'Henrietta Hudson';

  const CONNECTION_DEMO_SOURCE_ID = 'osm_2761570412'; // City Coffee Bar
  const CONNECTION_DEMO_TARGET_ID = 'osm_10776706633'; // Käfē Bar & Bistro

  const RAINBOW_ARC_COLORS = [
    [255, 0, 24],
    [255, 125, 0],
    [255, 237, 0],
    [0, 158, 47],
    [0, 70, 200],
    [134, 0, 175],
    [255, 148, 200],
  ];

  const STAR_FIRST_SRC = [255, 249, 196, 220];
  const STAR_FIRST_DST = [255, 255, 255, 180];
  const STAR_SECOND_SRC = [255, 224, 102, 100];
  const STAR_SECOND_DST = [255, 245, 160, 60];

  const TOTAL_GROUPS = 20;
  const REVEAL_STAGGER_MS = 400;
  const FADE_IN_MS = 2000;
  const FADE_OUT_MS = 1500;
  const PULSE_FREQUENCY_HZ = 1.5;
  const PULSE_THROTTLE_MS = 33;
  const STAR_OPACITY = 0.85;

  const STAR_PALETTE = [
    [255, 255, 255],
    [255, 249, 196],
    [255, 237, 120],
    [255, 224, 102],
    [255, 245, 160],
    [255, 235, 80],
    [255, 255, 220],
  ];

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

  let groupStartTimes = new Array(TOTAL_GROUPS).fill(null);
  let pulseAnimFrame = null;
  let lastPulseUpdate = 0;

  let listenersAttached = false;

  let tropicanaKindredTimer = null;
  let tropicanaSecondTierTimer = null;

  let narrativePlaceCardEl = null;
  let narrativeKindredCardEl = null;
  let narrativeWebBadgeVisible = false;
  let tropicanaCardTimer = null;
  let tropicanaKindredCardTimer = null;
  let tropicanaWebBadgeTimer = null;
  let henriettaKindredCardTimer = null;
  let lgbtqArcTimer = null;

  let narrativeArcsAnimFrame = null;
  let narrativeArcsSecondAnimFrame = null;
  let narrativeFirstLineData = [];
  let narrativeSecondLineData = [];

  let subwayAnimFrame = null;
  let subwayUndrawTimer = null;
  let subwayLineData = [];
  let subwayLinesData = null;

  let lgbtqDotAnimFrame = null;
  let lgbtqWaveTimers = [];
  let henriettaHighlightTimer = null;
  let lgbtqDotsTimer = null;
  let rainbowArcsAnimFrame = null;
  let rainbowArcsSecondAnimFrame = null;
  let rainbowLineData = [];
  let henriettaHighlightAnimFrame = null;
  let tropicanaHighlightAnimFrame = null;
  let cameraPathAnimFrame = null;

  window.lgbtqPlaces = null;

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

  // Guard against stacking zoom listeners across narrative replays.
  let roadLabelListenerAttached = false;

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch(e) { return null; }
  }
  function safeSet(key, val) {
    try { localStorage.setItem(key, val); } catch(e) {}
  }

  function setLightPreset(preset) {
    try { map.setConfigProperty('basemap', 'lightPreset', preset); } catch(e) {}
  }

  // Defer to main.js's full theme application (light preset + road
  // colors + circle strokes) when leaving the narrative. Falls back to
  // a bare lightPreset call if main.js hasn't loaded yet.
  function applyPostNarrativeTheme() {
    let saved = null;
    try { saved = localStorage.getItem('map_theme'); } catch (e) {}
    // Default to day for first-time visitors; honor saved preference for
    // returning visitors who have explicitly toggled to night.
    const theme = saved === 'night' ? 'night' : 'day';
    if (typeof window.applyMapTheme === 'function') {
      window.applyMapTheme(theme);
    } else {
      setLightPreset(theme);
    }
  }

  // Show road labels only above zoom 14 — driven by a zoom listener
  // that persists into exploration mode. Attached once via the
  // roadLabelListenerAttached guard so replays don't stack listeners.
  function applyRoadLabelsForZoom() {
  if (!map) return;
  const shouldShow = map.getZoom() >= 15;
  // Only call setConfigProperty when the value changes — calling it on
  // every zoom event triggers a style re-evaluation each time, which
  // can visibly slow tile loading during continuous zoom gestures.
  if (applyRoadLabelsForZoom._last === shouldShow) return;
  applyRoadLabelsForZoom._last = shouldShow;
  try {
    map.setConfigProperty('basemap', 'showRoadLabels', shouldShow);
  } catch (e) {}
}

  function applyExplorationConfig() {
    try {
      map.setConfigProperty('basemap', 'showPlaceLabels', true);
    } catch(e) {}
    // Road labels are zoom-conditional — apply immediately for current
    // zoom, then wire the listener so it stays correct as the user pans.
    applyRoadLabelsForZoom();
    if (!roadLabelListenerAttached) {
      map.on('zoom', applyRoadLabelsForZoom);
      roadLabelListenerAttached = true;
    }
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

    const zoom = map.getZoom();
    const baseRadius = 1 + Math.max(0, Math.min(1, (zoom - 10) / 5)) * 4;

    let anyActive = false;
    for (let g = 0; g < TOTAL_GROUPS; g++) {
      const startedAt = groupStartTimes[g];
      if (startedAt === null) continue;
      anyActive = true;
      const elapsed = (now - startedAt) / 1000;
      const phase = elapsed * PULSE_FREQUENCY_HZ;
      const r = baseRadius + Math.sin(phase) * (baseRadius * 0.4);
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
        map.setPaintProperty(id, 'circle-radius', ['interpolate',['linear'],['zoom'],13,1,15,6],);
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
        map.setPaintProperty(id, 'circle-radius', ['interpolate',['linear'],['zoom'],13,1,15,6],);
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

  // --- Beat 2 subway lines ---

  function renderSubwayLines() {
    if (!window.deckInstance) return;
    try {
      window.deckInstance.setProps({
        layers: [
          new deck.LineLayer({
            id: 'subway-lines-glow',
            data: subwayLineData,
            getSourcePosition: (d) => d.path[0],
            getTargetPosition: (d) => d.path[1],
            getColor: (d) => [d.color[0], d.color[1], d.color[2], Math.round(30 * d.alpha / 180)],
            getWidth: 6,
            widthUnits: 'pixels',
          }),
          new deck.LineLayer({
            id: 'subway-lines',
            data: subwayLineData,
            getSourcePosition: (d) => d.path[0],
            getTargetPosition: (d) => d.path[1],
            getColor: (d) => [d.color[0], d.color[1], d.color[2], d.alpha],
            getWidth: 2,
            widthUnits: 'pixels',
          }),
        ],
      });
    } catch (e) {}
  }

  async function fetchSubwayLines() {
    try {
      const res = await fetch('./data/mta.json');
      const geojson = await res.json();
      const features = (geojson.features || []).slice(0, 15);

      const lines = [];
      features.forEach((feature, i) => {
        if (!feature || !feature.geometry) return;
        const geom = feature.geometry;
        const color = STAR_PALETTE[i % STAR_PALETTE.length];
        if (geom.type === 'LineString') {
          lines.push({ coords: geom.coordinates, color });
        } else if (geom.type === 'MultiLineString') {
          geom.coordinates.forEach((seg) => {
            if (seg.length >= 2) lines.push({ coords: seg, color });
          });
        }
      });
      subwayLinesData = lines;
    } catch (e) {}
  }

  function buildSubwaySegments(coords, startFrac, endFrac, alpha, color) {
    const a = alpha == null ? 180 : alpha;
    const c = color || [255, 255, 255];
    const out = [];
    if (!coords || coords.length < 2) return out;
    if (endFrac <= startFrac) return out;

    const totalSegs = coords.length - 1;
    const sFloat = Math.max(0, startFrac) * totalSegs;
    const eFloat = Math.min(1, endFrac) * totalSegs;

    for (let i = 0; i < totalSegs; i++) {
      const segStart = i;
      const segEnd = i + 1;
      const lo = Math.max(sFloat, segStart);
      const hi = Math.min(eFloat, segEnd);
      if (hi <= lo) continue;
      const p0 = coords[i];
      const p1 = coords[i + 1];
      const fracLo = lo - segStart;
      const fracHi = hi - segStart;
      const start = [p0[0] + (p1[0] - p0[0]) * fracLo, p0[1] + (p1[1] - p0[1]) * fracLo];
      const end = [p0[0] + (p1[0] - p0[0]) * fracHi, p0[1] + (p1[1] - p0[1]) * fracHi];
      out.push({ path: [start, end], color: c, alpha: a });
    }
    return out;
  }

  function drawSubwayLines() {
    if (!window.deckInstance) return;
    if (subwayAnimFrame !== null) {
      cancelAnimationFrame(subwayAnimFrame);
      subwayAnimFrame = null;
    }
    if (subwayUndrawTimer !== null) {
      clearTimeout(subwayUndrawTimer);
      subwayUndrawTimer = null;
    }
    const DURATION = 3000;
    const startTime = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - startTime) / DURATION);
      const eased = 1 - Math.pow(1 - t, 2);
      const out = [];
      for (const line of subwayLinesData) {
        const segs = buildSubwaySegments(line.coords, 0, eased, 180, line.color);
        for (const s of segs) out.push(s);
      }
      subwayLineData = out;
      renderSubwayLines();
      if (t < 1) {
        subwayAnimFrame = requestAnimationFrame(frame);
      } else {
        subwayAnimFrame = null;
        subwayUndrawTimer = setTimeout(() => {
          subwayUndrawTimer = null;
          undrawSubwayLines();
        }, 100);
      }
    }
    subwayAnimFrame = requestAnimationFrame(frame);
  }

  function undrawSubwayLines() {
    if (!window.deckInstance) return;
    if (!subwayLinesData || subwayLinesData.length === 0) return;
    if (subwayAnimFrame !== null) {
      cancelAnimationFrame(subwayAnimFrame);
      subwayAnimFrame = null;
    }
    const DURATION = 2000;
    const startTime = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - startTime) / DURATION);
      const eased = 1 - Math.pow(1 - t, 2);
      const out = [];
      for (const line of subwayLinesData) {
        const segs = buildSubwaySegments(line.coords, eased, 1, 180, line.color);
        for (const s of segs) out.push(s);
      }
      subwayLineData = out;
      renderSubwayLines();
      if (t < 1) {
        subwayAnimFrame = requestAnimationFrame(frame);
      } else {
        subwayAnimFrame = null;
        subwayLineData = [];
        try { window.deckInstance.setProps({ layers: [] }); } catch (e) {}
      }
    }
    subwayAnimFrame = requestAnimationFrame(frame);
  }

  function clearSubwayLines() {
    if (subwayAnimFrame !== null) {
      cancelAnimationFrame(subwayAnimFrame);
      subwayAnimFrame = null;
    }
    if (subwayUndrawTimer !== null) {
      clearTimeout(subwayUndrawTimer);
      subwayUndrawTimer = null;
    }
    if (subwayLineData.length > 0) {
      subwayLineData = [];
      try { window.deckInstance.setProps({ layers: [] }); } catch (e) {}
    }
  }

  // --- Beat 4/5 LGBTQ web ---

  function selectLgbtqPlaces(count) {
    const fb = window.featuresById;
    if (!fb) { window.lgbtqPlaces = []; return []; }

    const candidates = [];
    for (const place of fb.values()) {
      if (!place || place.id === HENRIETTA_ID) continue;
      if (!Array.isArray(place.coordinates) || place.coordinates.length !== 2) continue;
      const ct = place.community_tags || {};
      if (ct.dfs_lgbtq_owned === true || ct.dfs_lgbtq_welcoming === true || ct.lgbtq_primary === true) {
        candidates.push(place);
      }
    }
    if (candidates.length === 0) { window.lgbtqPlaces = []; return []; }

    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const p of candidates) {
      const [lng, lat] = p.coordinates;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    const GRID = 8;
    const cellLng = (maxLng - minLng) / GRID || 1;
    const cellLat = (maxLat - minLat) / GRID || 1;
    const buckets = new Map();
    for (const p of candidates) {
      const [lng, lat] = p.coordinates;
      const cx = Math.min(GRID - 1, Math.floor((lng - minLng) / cellLng));
      const cy = Math.min(GRID - 1, Math.floor((lat - minLat) / cellLat));
      const key = cx + ',' + cy;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(p);
    }
    for (const bucket of buckets.values()) {
      bucket.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
    }
    const selected = [];
    const bucketList = Array.from(buckets.values());
    while (selected.length < count) {
      let added = false;
      for (const bucket of bucketList) {
        if (bucket.length === 0) continue;
        selected.push(bucket.shift());
        added = true;
        if (selected.length >= count) break;
      }
      if (!added) break;
    }
    window.lgbtqPlaces = selected;
    return selected;
  }

  function renderAllNarrativeLayers() {
    if (!window.deckInstance) return;
    const layers = [];

    if (rainbowLineData.length > 0) {
      layers.push(new deck.LineLayer({
        id: 'rainbow-arcs-glow',
        data: rainbowLineData,
        getSourcePosition: (d) => d.path[0],
        getTargetPosition: (d) => d.path[1],
        getColor: () => [255, 224, 102, 45],
        getWidth: 4,
        widthUnits: 'pixels',
      }));
      layers.push(new deck.LineLayer({
        id: 'rainbow-arcs',
        data: rainbowLineData,
        getSourcePosition: (d) => d.path[0],
        getTargetPosition: (d) => d.path[1],
        getColor: (d) => d.color,
        getWidth: 1.5,
        widthUnits: 'pixels',
      }));
    }

    try { window.deckInstance.setProps({ layers }); } catch (e) {}
  }

  function startHenriettaHighlight() {
    if (!map) return;
    if (henriettaHighlightAnimFrame !== null) return;

    if (!map.getSource('henrietta-highlight')) {
      map.addSource('henrietta-highlight', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: HENRIETTA_COORDS },
          properties: {},
        },
      });
    }
    if (!map.getLayer('henrietta-highlight-glow')) {
      map.addLayer({
        id: 'henrietta-highlight-glow',
        type: 'circle',
        source: 'henrietta-highlight',
        paint: {
          'circle-radius': 10,
          'circle-color': 'rgb(255, 249, 196)',
          'circle-blur': 0.5,
          'circle-emissive-strength': 1,
          'circle-opacity': 0.85,
          'circle-stroke-width': 0,
        },
      });
    }
    if (!map.getLayer('henrietta-highlight-layer')) {
      map.addLayer({
        id: 'henrietta-highlight-layer',
        type: 'circle',
        source: 'henrietta-highlight',
        paint: {
          'circle-radius': 18,
          'circle-color': 'rgb(255, 249, 196)',
          'circle-blur': 1.8,
          'circle-emissive-strength': 1,
          'circle-opacity': STAR_OPACITY,
          'circle-stroke-width': 0,
        },
      });
    }

    const startTime = performance.now();
    function frame(now) {
      const t = ((now - startTime) / 1000) * Math.PI;
      const r = 18 + Math.sin(t) * 4;
      try { map.setPaintProperty('henrietta-highlight-layer', 'circle-radius', r); } catch (e) {}
      henriettaHighlightAnimFrame = requestAnimationFrame(frame);
    }
    henriettaHighlightAnimFrame = requestAnimationFrame(frame);
  }

  function stopHenriettaHighlight() {
    if (henriettaHighlightAnimFrame !== null) {
      cancelAnimationFrame(henriettaHighlightAnimFrame);
      henriettaHighlightAnimFrame = null;
    }
    if (map) {
      try {
        if (map.getLayer('henrietta-highlight-glow')){map.removeLayer('henrietta-highlight-glow');}
        if (map.getLayer('henrietta-highlight-layer')) {map.removeLayer('henrietta-highlight-layer');}
        if (map.getSource('henrietta-highlight')) {map.removeSource('henrietta-highlight');}
      } catch (e) {}
    }
  }

  function startTropicanaHighlight() {
    if (!map) return;
    if (tropicanaHighlightAnimFrame !== null) return;

    if (!map.getSource('tropicana-highlight')) {
      map.addSource('tropicana-highlight', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: TROPICANA_COORDS },
          properties: {},
        },
      });
    }

    if (!map.getLayer('tropicana-highlight-glow')) {
      map.addLayer({
        id: 'tropicana-highlight-glow',
        type: 'circle',
        source: 'tropicana-highlight',
        paint: {
          'circle-radius': 10,
          'circle-color': 'rgb(255, 249, 196)',
          'circle-blur': 0.5,
          'circle-emissive-strength': 1,
          'circle-opacity': 0.85,
          'circle-stroke-width': 0,
        },
      });
    }
    if (!map.getLayer('tropicana-highlight-layer')) {
      map.addLayer({
        id: 'tropicana-highlight-layer',
        type: 'circle',
        source: 'tropicana-highlight',
        paint: {
          'circle-radius': 18,
          'circle-color': 'rgb(255, 249, 196)',
          'circle-blur': 1.8,
          'circle-emissive-strength': 1,
          'circle-opacity': STAR_OPACITY,
          'circle-stroke-width': 0,
        },
      });
    }

    const startTime = performance.now();
    function frame(now) {
      const t = ((now - startTime) / 1000) * Math.PI;
      const r = 18 + Math.sin(t) * 4;
      try { map.setPaintProperty('tropicana-highlight-layer', 'circle-radius', r); } catch (e) {}
      tropicanaHighlightAnimFrame = requestAnimationFrame(frame);
    }
    tropicanaHighlightAnimFrame = requestAnimationFrame(frame);
  }

  function clearTropicanaHighlight() {
    if (tropicanaHighlightAnimFrame !== null) {
      cancelAnimationFrame(tropicanaHighlightAnimFrame);
      tropicanaHighlightAnimFrame = null;
    }
    if (map) {
      try {
        if (map.getLayer('tropicana-highlight-glow')){map.removeLayer('tropicana-highlight-glow');}
        if (map.getLayer('tropicana-highlight-layer')) { map.removeLayer('tropicana-highlight-layer');}
        if (map.getSource('tropicana-highlight')) {map.removeSource('tropicana-highlight');}
      } catch (e) {}
    }
  }

  function drawLgbtqDots(places, onComplete) {
    if (!map) { if (onComplete) onComplete(); return; }
    lgbtqWaveTimers.forEach(clearTimeout);
    lgbtqWaveTimers = [];
    if (lgbtqDotAnimFrame !== null) {
      cancelAnimationFrame(lgbtqDotAnimFrame);
      lgbtqDotAnimFrame = null;
    }
    if (!Array.isArray(places) || places.length === 0) {
      if (onComplete) onComplete();
      return;
    }
    window.lgbtqPlaces = places;

    const features = places.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: p.coordinates },
      properties: {},
    }));

    if (!map.getSource('lgbtq-highlight')) {
      map.addSource('lgbtq-highlight', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    } else {
      try {
        map.getSource('lgbtq-highlight').setData({ type: 'FeatureCollection', features: [] });
      } catch (e) {}
    }
    if (!map.getLayer('lgbtq-highlight-glow')) {
      map.addLayer({
        id: 'lgbtq-highlight-glow',
        type: 'circle',
        source: 'lgbtq-highlight',
        paint: {
          'circle-radius': 7,
          'circle-color': 'rgb(255, 249, 196)',
          'circle-blur': 0.5,
          'circle-emissive-strength': 1,
          'circle-opacity': 0.85,
          'circle-stroke-width': 0,
        },
      });
    }
    if (!map.getLayer('lgbtq-highlight-layer')) {
      map.addLayer({
        id: 'lgbtq-highlight-layer',
        type: 'circle',
        source: 'lgbtq-highlight',
        paint: {
          'circle-radius': 14,
          'circle-color': 'rgb(255, 249, 196)',
          'circle-blur': 1.8,
          'circle-emissive-strength': 1,
          'circle-opacity': 0.8,
          'circle-stroke-width': 0,
        },
      });
    }

    const WAVE_COUNT = 5;
    const WAVE_STAGGER = 500;
    const waveSize = Math.ceil(features.length / WAVE_COUNT);

    for (let w = 0; w < WAVE_COUNT; w++) {
      const timer = setTimeout(() => {
        if (!map.getSource('lgbtq-highlight')) return;
        const subset = features.slice(0, Math.min(features.length, (w + 1) * waveSize));
        try {
          map.getSource('lgbtq-highlight').setData({
            type: 'FeatureCollection',
            features: subset,
          });
        } catch (e) {}
      }, w * WAVE_STAGGER);
      lgbtqWaveTimers.push(timer);
    }

    const pulseStart = setTimeout(() => {
      startLgbtqDotPulse();
      if (onComplete) onComplete();
    }, WAVE_COUNT * WAVE_STAGGER);
    lgbtqWaveTimers.push(pulseStart);
  }

  function startLgbtqDotPulse() {
    if (!map) return;
    if (lgbtqDotAnimFrame !== null) {
      cancelAnimationFrame(lgbtqDotAnimFrame);
      lgbtqDotAnimFrame = null;
    }
    const startTime = performance.now();
    function pulseFrame(now) {
      const t = ((now - startTime) / 1500) * Math.PI;
      const r = 14 + Math.sin(t) * 4;
      try { map.setPaintProperty('lgbtq-highlight-layer', 'circle-radius', r); } catch (e) {}
      lgbtqDotAnimFrame = requestAnimationFrame(pulseFrame);
    }
    lgbtqDotAnimFrame = requestAnimationFrame(pulseFrame);
  }

  function clearLgbtqDots() {
    lgbtqWaveTimers.forEach(clearTimeout);
    lgbtqWaveTimers = [];
    if (lgbtqDotAnimFrame !== null) {
      cancelAnimationFrame(lgbtqDotAnimFrame);
      lgbtqDotAnimFrame = null;
    }
    window.lgbtqPlaces = null;
    if (map) {
      try {
        if (map.getLayer('lgbtq-highlight-layer')) map.removeLayer('lgbtq-highlight-layer');
        if (map.getLayer('lgbtq-highlight-glow')) map.removeLayer('lgbtq-highlight-glow');
        if (map.getSource('lgbtq-highlight')) map.removeSource('lgbtq-highlight');
      } catch (e) {}
    }
  }

  function drawRainbowArcs(sourcePlace, targetPlaces, onComplete) {
    if (!window.deckInstance || !sourcePlace || !Array.isArray(sourcePlace.coordinates)) {
      if (onComplete) onComplete();
      return;
    }
    if (rainbowArcsAnimFrame !== null) {
      cancelAnimationFrame(rainbowArcsAnimFrame);
      rainbowArcsAnimFrame = null;
    }
    const ARC_POINTS = 40;
    const ARC_HEIGHT = 0.4;
    const DURATION = 2000;

    const arcPaths = (targetPlaces || [])
      .filter((t) => t && Array.isArray(t.coordinates) && t.coordinates.length === 2)
      .map((t) => {
        const base = RAINBOW_ARC_COLORS[Math.floor(Math.random() * RAINBOW_ARC_COLORS.length)];
        const alpha = 160 + Math.floor(Math.random() * 40);
        return {
          points: sampleArcLocal(sourcePlace.coordinates, t.coordinates, ARC_HEIGHT, ARC_POINTS),
          color: [base[0], base[1], base[2], alpha],
        };
      });

    if (arcPaths.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    const startTime = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - startTime) / DURATION);
      const eased = 1 - Math.pow(1 - t, 2);
      const lineData = [];
      arcPaths.forEach((arc) => {
        const visibleCount = t >= 1
          ? arc.points.length
          : Math.max(2, Math.floor(eased * ARC_POINTS));
        const visiblePoints = arc.points.slice(0, visibleCount);
        for (let i = 0; i < visiblePoints.length - 1; i++) {
          lineData.push({ path: [visiblePoints[i], visiblePoints[i + 1]], color: arc.color });
        }
      });
      rainbowLineData = lineData;
      renderAllNarrativeLayers();
      if (t < 1) {
        rainbowArcsAnimFrame = requestAnimationFrame(frame);
      } else {
        rainbowArcsAnimFrame = null;
        startRainbowPulse();
        if (onComplete) onComplete();
      }
    }
    rainbowArcsAnimFrame = requestAnimationFrame(frame);
  }

  function startRainbowPulse() {
    if (rainbowArcsSecondAnimFrame !== null) {
      cancelAnimationFrame(rainbowArcsSecondAnimFrame);
      rainbowArcsSecondAnimFrame = null;
    }
    function pulseFrame() {
      const alpha = Math.round(160 + 40 * Math.sin(Date.now() / 600));
      for (const seg of rainbowLineData) {
        seg.color[3] = alpha;
      }
      rainbowLineData = rainbowLineData.slice();
      renderAllNarrativeLayers();
      rainbowArcsSecondAnimFrame = requestAnimationFrame(pulseFrame);
    }
    rainbowArcsSecondAnimFrame = requestAnimationFrame(pulseFrame);
  }

  function clearRainbowArcs() {
    if (rainbowArcsAnimFrame !== null) {
      cancelAnimationFrame(rainbowArcsAnimFrame);
      rainbowArcsAnimFrame = null;
    }
    if (rainbowArcsSecondAnimFrame !== null) {
      cancelAnimationFrame(rainbowArcsSecondAnimFrame);
      rainbowArcsSecondAnimFrame = null;
    }
    rainbowLineData = [];
    renderAllNarrativeLayers();
  }

  function clearAllLgbtqLayers() {
    stopHenriettaHighlight();
    clearLgbtqDots();
    clearRainbowArcs();
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
    const ARC_HEIGHT = 0.3;

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
    const ARC_HEIGHT = 0.3;
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
    const ARC_HEIGHT = 0.3;
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
    narrativePlaceCardEl.classList.remove('is-slid-up');
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
    const el = narrativePlaceCardEl;
    narrativePlaceCardEl = null;
    setTimeout(() => { try { el.remove(); } catch (e) {} }, 450);
  }

  function showNarrativeConnectionCard(sourceId, targetId) {
  const source = lookupPlace(sourceId);
  const target = lookupPlace(targetId);
  if (!source || !target) return;

  const colorByType = window.COLOR_BY_TYPE || {};
  const defaultColor = window.COLOR_DEFAULT || '#888888';
  const sourceColor = colorByType[source.osm_type] || defaultColor;
  const targetColor = colorByType[target.osm_type] || defaultColor;

  // Get shared tokens from similarity_scores
  const scores = source.similarity_scores &&
    source.similarity_scores.find(s => s.id === targetId);
  const DISPLAY_STOPWORDS = new Set([
    'looking','draws','event','space','never','great','good','best',
    'always','makes','made','make','come','comes','back','away',
    'around','every','still','even','much','many','more','most',
    'well','real','little','long','old','new','big','small',
    'also','take','get','give','keep','talk','know','think',
    'scene','night','day','time','people','crowd','world','life',
    'city','local','place','spot','vibe','feel','kind','type',
    'offers','offer','serving','serves','service','located',
    'open','known','welcome','perfect','features','something',
    'someone','whether','while','since','often','within','between',
  ]);
  const tokens = scores && scores.shared_tokens
    ? scores.shared_tokens.filter(t => !DISPLAY_STOPWORDS.has(t) && t.length >= 4).slice(0, 5)
    : [];

  const formatType = (t) => {
    const LABELS = {
      cafe:'Café', bar:'Bar', pub:'Pub', nightclub:'Nightclub',
      music_venue:'Music Venue', library:'Library', park:'Park',
      community_centre:'Community Center', arts_centre:'Arts Center',
      theatre:'Theater', museum:'Museum', gallery:'Gallery',
      place_of_worship:'Place of Worship', fitness_centre:'Fitness Center',
      sports_centre:'Sports Center', hairdresser:'Hair Salon',
      beauty:'Beauty Salon', bakery:'Bakery', deli:'Deli',
    };
    return LABELS[t] || t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const safe = (s) => String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    // Normalized connection strength
  let strengthHtml = '';
  if (scores && scores.total != null) {
    const total = scores.total;
    const P_LOW = 0.219;
    const P_HIGH = 0.521;
    const normalized = Math.round(
      Math.min(100, Math.max(0, (total - P_LOW) / (P_HIGH - P_LOW) * 100))
    );
    let tier, tierColor;
    if (total >= 0.46) {
      tier = 'Exceptional Match';
      tierColor = '#00ccff';
    } else if (total >= 0.42) {
      tier = 'Strong Match';
      tierColor = '#4ac8ff';
    } else if (total >= 0.33) {
      tier = 'Notable Match';
      tierColor = '#80d8ff';
    } else {
      tier = 'Kindred';
      tierColor = 'rgba(255,255,255,0.6)';
    }
    strengthHtml =
      '<div class="narrative-connection-strength">' +
        '<span class="narrative-connection-strength-dot" style="background:' + tierColor + '"></span>' +
        '<span class="narrative-connection-strength-label" style="color:' + tierColor + '">' + tier + '</span>' +
        '<span class="narrative-connection-strength-pct">' + normalized + ' / 100</span>' +
      '</div>';
  }

  const tokenHtml = scores
    ? (() => {
        const bars = [
          { label: 'Character',  value: scores.text },
          { label: 'Community',  value: scores.community },
          { label: 'Atmosphere', value: scores.atmosphere },
          { label: 'Place Type', value: scores.osm },
          { label: 'Category',   value: scores.google },
        ];

        const ATM_LABELS = {
          outdoor_seating: 'Outdoor Seating',
          live_music: 'Live Music',
          good_for_groups: 'Good for Groups',
          serves_coffee: 'Serves Coffee',
          good_for_children: 'Family Friendly',
          allows_dogs: 'Dog Friendly',
          good_for_watching_sports: 'Sports Viewing',
          serves_beer: 'Serves Beer',
          serves_cocktails: 'Serves Cocktails',
          serves_wine: 'Serves Wine',
          reservable: 'Reservable',
        };

        const barsHtml =
          '<div class="narrative-connection-label">Connection Strength</div>' +
          '<div class="narrative-connection-scores">' +
          bars.map(b => {
            const pct = Math.round(b.value * 100);
            return (
              '<div class="narrative-connection-score-row">' +
                '<div class="narrative-connection-score-label">' + safe(b.label) + '</div>' +
                '<div class="narrative-connection-score-bar-wrap">' +
                  '<div class="narrative-connection-score-bar" style="width:' + pct + '%"></div>' +
                '</div>' +
                '<div class="narrative-connection-score-pct">' + pct + '%</div>' +
              '</div>'
            );
          }).join('') +
          '</div>';

        const sharedAtm = (scores.shared_atmosphere || [])
          .map(a => ATM_LABELS[a] || a)
          .filter(Boolean);

        const atmHtml = sharedAtm.length
          ? '<div class="narrative-connection-label" style="margin-top:12px">Shared Vibe</div>' +
            '<div class="narrative-connection-tokens">' +
            sharedAtm.map(a => '<span class="narrative-connection-token">' + safe(a) + '</span>').join('') +
            '</div>'
          : '';

        return barsHtml + atmHtml;
      })()
    : '';

  let card = document.getElementById('narrative-connection-card');
  if (!card) {
    card = document.createElement('div');
    card.id = 'narrative-connection-card';
    document.body.appendChild(card);
  }

  card.innerHTML =
    '<div class="narrative-connection-places">' +
      '<div class="narrative-connection-place">' +
        '<span class="narrative-connection-dot" style="background:' + sourceColor + '"></span>' +
        '<div>' +
          '<div class="narrative-connection-place-name">' + safe(source.name || '') + '</div>' +
          '<div class="narrative-connection-place-type">' + safe(formatType(source.osm_type)) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="narrative-connection-divider">↔</div>' +
      '<div class="narrative-connection-place">' +
        '<span class="narrative-connection-dot" style="background:' + targetColor + '"></span>' +
        '<div>' +
          '<div class="narrative-connection-place-name">' + safe(target.name || '') + '</div>' +
          '<div class="narrative-connection-place-type">' + safe(formatType(target.osm_type)) + '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    strengthHtml +
    tokenHtml;

  void card.offsetWidth;
  card.classList.add('is-visible');
}

function hideNarrativeConnectionCard() {
  const card = document.getElementById('narrative-connection-card');
  if (card) {
    card.classList.remove('is-visible');
    setTimeout(() => { try { card.remove(); } catch (e) {} }, 450);
  }
}

  function buildKindredItemMarkup(placeId) {
    const place = lookupPlace(placeId);
    if (!place) return '';
    const colorByType = (window.COLOR_BY_TYPE || {});
    const defaultColor = window.COLOR_DEFAULT || '#888888';
    const color = colorByType[place.osm_type] || defaultColor;
    const name = place.name || '(unnamed)';
    const safeName = String(name)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    return (
      '<div class="narrative-kindred-item" data-place-id="' + placeId + '">' +
        '<span class="narrative-kindred-dot" style="background:' + color + '"></span>' +
        '<span>' + safeName + '</span>' +
      '</div>'
    );
  }

  function attachKindredCardInteraction(/* placeId */) {
    if (!narrativeKindredCardEl) return;
    const items = narrativeKindredCardEl.querySelectorAll('.narrative-kindred-item');
    items.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = item.getAttribute('data-place-id');
        if (!id) return;
        const place = lookupPlace(id);
        if (!place) return;
        if (narrativePlaceCardEl) {
          const nameEl = narrativePlaceCardEl.querySelector('.narrative-place-name');
          const soulEl = narrativePlaceCardEl.querySelector('.narrative-place-soul');
          if (nameEl) nameEl.textContent = place.name || '';
          if (soulEl) soulEl.textContent = place.soul_summary || '';
        }
        if (Array.isArray(place.coordinates) && map) {
          const NYC_CENTER = [-73.98, 40.73];
          const dx = NYC_CENTER[0] - place.coordinates[0];
          const dy = NYC_CENTER[1] - place.coordinates[1];
          const bearingToCenter = Math.atan2(dx, dy) * (180 / Math.PI);
          map.easeTo({
            center: place.coordinates,
            zoom: map.getZoom(),
            bearing: bearingToCenter,
            duration: 2500,
            easing: (t) => 1 - Math.pow(1 - t, 3),
          });
        }
        items.forEach((other) => other.classList.remove('is-selected'));
        item.classList.add('is-selected');
      });
    });
  }

  function clearNarrativeSecondTierArcs() {
    if (narrativeArcsSecondAnimFrame !== null) {
      cancelAnimationFrame(narrativeArcsSecondAnimFrame);
      narrativeArcsSecondAnimFrame = null;
    }
    narrativeSecondLineData = [];
    renderNarrativeArcs();
  }

  function showNarrativeKindredCard(placeId, titleOverride, withPulse) {
    if (!narrativeKindredCardEl) {
      narrativeKindredCardEl = document.createElement('div');
      narrativeKindredCardEl.id = 'narrative-kindred-card';
      document.body.appendChild(narrativeKindredCardEl);
    }
    narrativeKindredCardEl.dataset.placeId = placeId;
    const place = lookupPlace(placeId);
    const ids = (place && Array.isArray(place.similarity_ids))
      ? place.similarity_ids.slice(0, 8)
      : [];
    const itemsHtml = ids.map(buildKindredItemMarkup).join('');
    const title = titleOverride || 'Kindred Places';
    const titleClass = 'narrative-kindred-title' + (withPulse ? ' is-pulsing' : '');
    narrativeKindredCardEl.innerHTML =
      '<div class="narrative-kindred-header">' +
        '<span class="' + titleClass + '">' + title + '</span>' +
        '<button class="narrative-web-badge" id="narrative-web-toggle">◎ Web active</button>' +
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
    const toggle = document.getElementById('narrative-web-toggle');
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (narrativeSecondLineData.length > 0) {
          clearNarrativeSecondTierArcs();
          toggle.classList.remove('is-active');
          toggle.textContent = '◎ Web off';
        } else {
          const currentPlaceId = toggle.dataset.placeId || TROPICANA_ID;
          drawNarrativeSecondTierArcs(currentPlaceId);
          toggle.classList.add('is-active');
          toggle.textContent = '◎ Web active';
        }
      });
      toggle.dataset.placeId = narrativeKindredCardEl.dataset.placeId || TROPICANA_ID;
    }
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
    if (henriettaHighlightTimer) { clearTimeout(henriettaHighlightTimer); henriettaHighlightTimer = null; }
    if (henriettaKindredCardTimer) { clearTimeout(henriettaKindredCardTimer); henriettaKindredCardTimer = null; }
    if (lgbtqDotsTimer) { clearTimeout(lgbtqDotsTimer); lgbtqDotsTimer = null; }
    if (lgbtqArcTimer) { clearTimeout(lgbtqArcTimer); lgbtqArcTimer = null; }
    if (tropicanaCardTimer) { clearTimeout(tropicanaCardTimer); tropicanaCardTimer = null; }
    if (tropicanaKindredTimer) { clearTimeout(tropicanaKindredTimer); tropicanaKindredTimer = null; }
    if (tropicanaKindredCardTimer) { clearTimeout(tropicanaKindredCardTimer); tropicanaKindredCardTimer = null; }
    if (tropicanaWebBadgeTimer) { clearTimeout(tropicanaWebBadgeTimer); tropicanaWebBadgeTimer = null; }
    if (tropicanaSecondTierTimer) { clearTimeout(tropicanaSecondTierTimer); tropicanaSecondTierTimer = null; }
    clearCameraPath();
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

  // --- Camera path animation ---

  function easeInOutQuad(x) {
    return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  }

  function catmullRom(p0, p1, p2, p3, u) {
    const u2 = u * u;
    const u3 = u2 * u;
    return 0.5 * (
      (2 * p1) +
      (-p0 + p2) * u +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * u3
    );
  }

  function animateCameraPath(keyframes, totalMs, onComplete) {
    clearCameraPath();
    if (!map || !Array.isArray(keyframes) || keyframes.length < 2) {
      if (onComplete) onComplete();
      return;
    }

    const startTime = performance.now();
    const last = keyframes[keyframes.length - 1];

    function frame(now) {
      const rawT = Math.min(1, (now - startTime) / totalMs);

      if (rawT >= 1) {
        cameraPathAnimFrame = null;
        try {
          map.jumpTo({
            center: last.center,
            zoom: last.zoom,
            pitch: last.pitch,
            bearing: last.bearing,
          });
        } catch (e) {}
        if (onComplete) onComplete();
        return;
      }

      const t = easeInOutQuad(rawT);

      let i = 0;
      for (; i < keyframes.length - 2; i++) {
        if (keyframes[i + 1].t >= t) break;
      }
      const a = keyframes[i];
      const b = keyframes[i + 1];
      const aPrev = keyframes[i - 1] || a;
      const bNext = keyframes[i + 2] || b;
      const span = b.t - a.t;
      const segT = span > 0 ? (t - a.t) / span : 0;

      try {
        const pitch = catmullRom(aPrev.pitch, a.pitch, b.pitch, bNext.pitch, segT);
        map.jumpTo({
          center: [
            catmullRom(aPrev.center[0], a.center[0], b.center[0], bNext.center[0], segT),
            catmullRom(aPrev.center[1], a.center[1], b.center[1], bNext.center[1], segT),
          ],
          zoom: catmullRom(aPrev.zoom, a.zoom, b.zoom, bNext.zoom, segT),
          pitch: Math.max(0, Math.min(85, pitch)),
          bearing: catmullRom(aPrev.bearing, a.bearing, b.bearing, bNext.bearing, segT),
        });
      } catch (e) {}

      cameraPathAnimFrame = requestAnimationFrame(frame);
    }

    cameraPathAnimFrame = requestAnimationFrame(frame);
  }

  function clearCameraPath() {
    if (cameraPathAnimFrame !== null) {
      cancelAnimationFrame(cameraPathAnimFrame);
      cameraPathAnimFrame = null;
    }
  }

  function goToStep(n) {
    currentStep = n;
    showStep(n);

    hideNarrativeHint();

    if (overlayEl) {
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
        zoom: 11.1,
        pitch: INITIAL_PITCH,
        bearing: 0,
        duration: 3000,
      });
      setTimeout(() => showNarrativeHint(), 4000);
    }

    else if (n === 2) {
      [0, 1].forEach((g) => {
        const id = constellationLayerId(g);
        try {
          map.setLayoutProperty(id, 'visibility', 'visible');
          map.setPaintProperty(id, 'circle-opacity-transition', { duration: FADE_IN_MS, delay: 0 });
          map.setPaintProperty(id, 'circle-opacity', 0);
        } catch (e) {}
      });
      constellationTimers.push(setTimeout(() => revealGroup(0), 500));
      constellationTimers.push(setTimeout(() => revealGroup(1), 1000));
      constellationTimers.push(setTimeout(() => fadeOutConstellation(), 4500));
      setTimeout(() => drawSubwayLines(), 400);
      setTimeout(() => showNarrativeHint(), 7000);
    }

    else if (n === 3) {
      clearSubwayLines();
      constellationReveal();
      map.easeTo({
        center: [-73.988045, 40.696544],
        zoom: 15.4,
        pitch: 65,
        bearing: -20,
        duration: 8000
      });
      setTimeout(() => showNarrativeHint(), 9000);
    }

    else if (n === 4) {
      clearAllNarrativeBeatTimers();
      const beat4Path = [
        { t: 0, center: [-73.988045, 40.696544],       zoom: 15.4,   pitch: 65, bearing: -20  },
        { t: 0.65, center: [-74.00608, 40.732055],      zoom: 15.7, pitch: 70, bearing: 0  },
        { t: 1.0,  center: HENRIETTA_COORDS,            zoom: 16,   pitch: 76, bearing: 40 },
      ];
      animateCameraPath(beat4Path, 8000, () => {});
      henriettaHighlightTimer = setTimeout(() => {
        henriettaHighlightTimer = null;
        startHenriettaHighlight();
      }, 2500);
      lgbtqDotsTimer = setTimeout(() => {
        lgbtqDotsTimer = null;
        const places = selectLgbtqPlaces(50);
        drawLgbtqDots(places, () => {});
      }, 2500);
      setTimeout(() => showNarrativeHint(), 9000);
    }

    else if (n === 5) {
      clearAllNarrativeBeatTimers();
      let places = window.lgbtqPlaces;
      if (!places || !places.length) places = selectLgbtqPlaces(50);
      const fb = window.featuresById;
      const henrietta =
        (fb && fb.get(HENRIETTA_ID)) ||
        { coordinates: HENRIETTA_COORDS, id: HENRIETTA_ID, name: HENRIETTA_NAME };

      // Show place card first, then slide it up when kindred card appears
      if (window.innerWidth > 640) showNarrativePlaceCard(HENRIETTA_ID, HENRIETTA_NAME);

      henriettaKindredCardTimer = setTimeout(() => {
        henriettaKindredCardTimer = null;
        if (window.innerWidth > 640) {
          slideUpNarrativePlaceCard();
          showNarrativeKindredCard(HENRIETTA_ID, 'LGBTQ+ Welcoming', true);
          attachKindredCardInteraction(HENRIETTA_ID);
        }
      }, 1200);

      lgbtqArcTimer = setTimeout(() => {
        lgbtqArcTimer = null;
        drawRainbowArcs(henrietta, places, () => {});
      }, 1200);

      map.easeTo({
        center: [-73.9588, 40.7029],
        zoom: 11.5,
        pitch:35,
        bearing: 165,
        duration: 8000,
      });
      setTimeout(() => showNarrativeHint(), 9000);
    }

    else if (n === 6) {
      clearAllLgbtqLayers();
      clearNarrativeArcs();
      hideNarrativeKindredCard();
      hideNarrativePlaceCard();
      clearAllNarrativeBeatTimers();
      map.flyTo({
        center: [-73.95, 40.76388],
        zoom: 11.7,
        pitch: 60,
        bearing: 185,
        duration: 4000,
      });
      tropicanaCardTimer = setTimeout(() => {
        tropicanaCardTimer = null;
        if (window.innerWidth > 640) showNarrativePlaceCard(TROPICANA_ID, TROPICANA_NAME);
        startTropicanaHighlight();
      }, 500);
      tropicanaKindredTimer = setTimeout(() => {
        tropicanaKindredTimer = null;
        if (window.innerWidth > 640) slideUpNarrativePlaceCard();
        drawNarrativeArcs(TROPICANA_ID, () => {});
      }, 1500);
      tropicanaKindredCardTimer = setTimeout(() => {
        tropicanaKindredCardTimer = null;
        if (window.innerWidth > 640) {
          showNarrativeKindredCard(TROPICANA_ID);
          attachKindredCardInteraction(TROPICANA_ID);
        }
      }, 1800);
      setTimeout(() => showNarrativeHint(), 5000);
    }

    else if (n === 7) {
      map.flyTo({
        center: [-73.92, 40.76388],
        zoom: 11.8,
        pitch: 65,
        bearing: 210,
        duration: 4000,
      });
      showNarrativeWebBadge();
      if (narrativeSecondLineData.length === 0 && narrativeArcsSecondAnimFrame === null) {
        drawNarrativeSecondTierArcs(TROPICANA_ID);
      }
      const toggle = document.getElementById('narrative-web-toggle');
      if (toggle) {
        toggle.classList.add('is-active');
        toggle.textContent = '◎ Web active';
      }
      setTimeout(() => showNarrativeHint(), 5000);
    }

    else if (n === 8) {
      clearAllNarrativeBeatTimers();
      hideNarrativeKindredCard();
      hideNarrativePlaceCard();

      // Fly to City Coffee Bar's location to frame the connection demo
      map.flyTo({
        center: [-73.932, 40.747],
        zoom: 12,
        pitch: 50,
        bearing:-45,
        duration: 4000,
      });

      // After camera settles open the connection view and show the card
      setTimeout(() => {
        if (typeof window.openConnectionView === 'function') {
          window.openConnectionView(CONNECTION_DEMO_SOURCE_ID, CONNECTION_DEMO_TARGET_ID);
        }
        showNarrativeConnectionCard(CONNECTION_DEMO_SOURCE_ID, CONNECTION_DEMO_TARGET_ID);
      }, 4000);
      setTimeout(() => showNarrativeHint(), 5000);
    }
    

    else if (n === 9) {
      hideNarrativeHint();
      hideNarrativeConnectionCard();
      clearNarrativeArcs();
      clearTropicanaHighlight();
      hideNarrativeKindredCard();
      hideNarrativePlaceCard();
      clearAllNarrativeBeatTimers();
      // Close any open connection/sidebar view from beat 8
      if (typeof window.closeSidebar === 'function') {
        try { window.closeSidebar(); } catch (e) {}
      }
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
    clearAllNarrativeBeatTimers();
    clearCameraPath();
    clearSubwayLines();
    clearAllLgbtqLayers();
    clearNarrativeArcs();
    hideNarrativeHint();
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

    applyExplorationConfig();
    applyPostNarrativeTheme();

    map.easeTo({
      center: INITIAL_CENTER,
      zoom: 11.1,
      pitch: INITIAL_PITCH,
      bearing: 0,
      duration: 5000,
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

  function injectNarrativeHint() {
  let hint = document.getElementById('narrative-hint');
  if (hint) return hint;
  hint = document.createElement('div');
  hint.id = 'narrative-hint';
  // Different text for touch vs mouse devices
  const isTouch = window.matchMedia('(hover: none)').matches;
  hint.textContent = isTouch ? 'Tap to continue' : 'Click to continue';
  document.body.appendChild(hint);
  return hint;
}

function showNarrativeHint() {
  const hint = document.getElementById('narrative-hint');
  if (hint) {
    hint.classList.remove('is-hidden');
    hint.classList.add('is-visible');
  }
}

function hideNarrativeHint() {
  const hint = document.getElementById('narrative-hint');
  if (hint) {
    hint.classList.remove('is-visible');
    hint.classList.add('is-hidden');
  }
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
      if (e.target.closest && (
        e.target.closest('#narrative-right-card') ||
        e.target.closest('#narrative-kindred-card') ||
        e.target.closest('.narrative-kindred-item') ||
        e.target.closest('#narrative-web-toggle')
      )) {
        return;
      }
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

    fetchSubwayLines();

    if (safeGet(LS_KEY) === 'true') {
      document.body.classList.remove('narrative-active');
      applyExplorationConfig();
      applyPostNarrativeTheme();
      return;
    }

    overlayEl = document.getElementById('narrative-overlay');
    if (!overlayEl) return;

    document.body.classList.add('narrative-active');

    setLightPreset('night');
    resetExplorationConfig();

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
    injectNarrativeHint();
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