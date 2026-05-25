(function () {
  'use strict';

  const LS_KEY = 'narrative_seen';
  const PLACES_LAYER = 'places-circles-main';
  const INITIAL_CENTER = [-73.95, 40.7];
  const INITIAL_ZOOM = 11;
  const INITIAL_PITCH = 40;
  // Hero places used across Beats 4–8. IDs match the place.id strings
  // produced by 01_filter_osm.js (`osm_<osm_id>`). If the underlying data
  // shifts and these IDs no longer resolve, the FALLBACK names render in
  // the right-side card and the arc draws become no-ops.
  const TROPICANA_COORDS = [-73.8872699, 40.8283426];
  const TROPICANA_ID = 'osm_5172757288';
  const TROPICANA_NAME = 'Tropicana';

  // Beats 4–5: Henrietta Hudson as the LGBTQ+ identity beat anchor. The
  // rainbow arc colors are sampled per-arc with slight alpha jitter so the
  // 50-arc bouquet reads as varied without an explicit per-target mapping.
  const HENRIETTA_COORDS = [-74.0065268, 40.7310628];
  const HENRIETTA_ID = 'osm_6182279414';
  const HENRIETTA_NAME = 'Henrietta Hudson';

  const RAINBOW_ARC_COLORS = [
    [255, 0, 24],
    [255, 125, 0],
    [255, 237, 0],
    [0, 158, 47],
    [0, 70, 200],
    [134, 0, 175],
    [255, 148, 200],
  ];

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

  // Real MTA subway line geometry is fetched at init time from NYC Open
  // Data (see fetchSubwayLines below) and cached in subwayLinesData. Colors
  // cycle through this star palette so the routes read as a constellation
  // of trunk lines rather than a categorical transit map.
  const STAR_PALETTE = [
    [255, 255, 255],   // white
    [255, 249, 196],   // warm white
    [255, 237, 120],   // light gold
    [255, 224, 102],   // gold
    [255, 245, 160],   // pale yellow
    [255, 235, 80],    // bright gold
    [255, 255, 220],   // cream
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
  // Beat 7 Tropicana card-show timer + Beat 8 kindred-card and web-badge
  // and second-tier sub-timers.
  let tropicanaCardTimer = null;
  let tropicanaKindredCardTimer = null;
  let tropicanaWebBadgeTimer = null;
  // Beat 5 Henrietta kindred-card-show timer — drives the same 300ms
  // delay-after-slide-up pattern Tropicana uses in Beat 7.
  let henriettaKindredCardTimer = null;

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

  // --- Beat 2 subway draw/undraw animation ---
  // subwayAnimFrame holds the rAF for whichever pass (draw or undraw) is
  // currently running. subwayUndrawTimer is the 1s wait between the two.
  // subwayLineData is the per-frame line-segment array — kept at module
  // scope so renderSubwayLines() can re-emit it on each frame.
  // subwayLinesData is the network-fetched trunk-line geometry (array of
  // { name, color, coords }); null until fetchSubwayLines completes.
  let subwayAnimFrame = null;
  let subwayUndrawTimer = null;
  let subwayLineData = [];
  let subwayLinesData = null;

  // --- Beat 4/5 Henrietta + LGBTQ web state ---
  // The Henrietta + LGBTQ highlight dots are rendered as Mapbox circle
  // layers with constellation-star paint properties (radius/blur driven
  // per-frame via setPaintProperty). Only the rainbow arcs ride on
  // deckInstance via renderAllNarrativeLayers.
  let lgbtqDotAnimFrame = null;        // post-wave radius pulse rAF
  // Per-wave setTimeout handles for drawLgbtqDots — cleared by clearLgbtqDots
  // so a teardown mid-stagger can't queue further setData calls.
  let lgbtqWaveTimers = [];
  let henriettaHighlightTimer = null;  // 1s delay before highlight starts
  let lgbtqDotsTimer = null;           // 2.5s delay before dots draw
  let rainbowArcsAnimFrame = null;
  let rainbowArcsSecondAnimFrame = null;
  let rainbowLineData = [];
  // Henrietta-highlight rAF lives separately so the pulse keeps running
  // while drawLgbtqDots animates the dot fade-in in parallel.
  let henriettaHighlightAnimFrame = null;
  // Tropicana highlight rAF — Beat 7 (n===6) star at the Tropicana
  // location, cleared on Beat 8 entry and in exitNarrative.
  let tropicanaHighlightAnimFrame = null;

  // Exposed for narrative beats so Beat 5 can reuse the same selection
  // Beat 4 picked, without re-running selectLgbtqPlaces().
  window.lgbtqPlaces = null;

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

  // --- Beat 2 subway lines ---
  // Progressive polyline draw on the shared window.deckInstance. Two deck
  // layers per render: a wide low-alpha glow + the main thin line. We share
  // the canvas with the narrative arc layers, but the subway runs only
  // during Beat 2 (before any arcs draw at Beat 4), so there's no overlap.

  function renderSubwayLines() {
    if (!window.deckInstance) return;
    // Each segment carries its own alpha (set by buildSubwaySegments). The
    // glow layer scales proportionally to the main line's alpha so both
    // fade together during undraw.
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

  // Fetch real subway-line geometry from /data/mta.json.
  async function fetchSubwayLines() {
    try {
      const res = await fetch('./data/mta.json');
      const geojson = await res.json();
      const features = (geojson.features || []).slice(0, 15);

      // Flatten each feature's geometry into a single coord array so each
      // gets its own animated trace. MultiLineString segments are
      // concatenated end-to-end — visually fine for the Beat 2 draw/undraw
      // pass since the gaps between adjacent boroughs read as one stroke.
      // Colors cycle through STAR_PALETTE by feature index.
      const lines = [];
      features.forEach((feature, i) => {
        if (!feature || !feature.geometry) return;
        const geom = feature.geometry;
        const color = STAR_PALETTE[i % STAR_PALETTE.length];
        if (geom.type === 'LineString') {
          lines.push({ coords: geom.coordinates, color });
        } else if (geom.type === 'MultiLineString') {
          // Each sub-line animates independently so there are no jumps across gaps
          geom.coordinates.forEach((seg) => {
            if (seg.length >= 2) lines.push({ coords: seg, color });
          });
        }
      });
      subwayLinesData = lines;
    } catch (e) {}
  }

  // Builds segments for ONE line between two fractional positions along its
  // polyline. Walking segment by segment lets a partial start AND a partial
  // end coexist, which we need for both draw (0 → t) and undraw (t → 1).
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
        // Each line grows from its start point (0 → eased).
        const segs = buildSubwaySegments(line.coords, 0, eased, 180, line.color);
        for (const s of segs) out.push(s);
      }
      subwayLineData = out;
      renderSubwayLines();
      if (t < 1) {
        subwayAnimFrame = requestAnimationFrame(frame);
      } else {
        subwayAnimFrame = null;
        // Hold the fully-drawn grid for 100ms, then start the undraw pass.
        subwayUndrawTimer = setTimeout(() => {
          subwayUndrawTimer = null;
          undrawSubwayLines();
        }, 100);
      }
    }
    subwayAnimFrame = requestAnimationFrame(frame);
  }

  // Wipe-forward undraw: the head of each line shrinks while the tail
  // remains, mirroring the direction of the draw. As undrawFrac walks
  // 0 → 1, each line shows segments from (undrawFrac, 1) — the start
  // disappears first, the end disappears last.
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
        // Visible portion is (eased, 1] — the start fraction climbs while
        // the end stays pinned at the polyline's last point.
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
    // Only nuke deck layers if subway is actually showing — otherwise we'd
    // also wipe whatever the narrative beats have drawn (arcs etc.) on the
    // shared deck canvas.
    if (subwayLineData.length > 0) {
      subwayLineData = [];
      try { window.deckInstance.setProps({ layers: [] }); } catch (e) {}
    }
  }

  // --- Beat 4/5 LGBTQ web ---
  // Filter the dataset to LGBTQ+ tagged places (excluding Henrietta itself),
  // then bucket into an 8×8 lat/lng grid and pick the highest-review-count
  // place from each bucket round-robin until we hit `count`. Geographic
  // spread is more visually striking than top-N-by-reviews, which would
  // cluster everything in Manhattan/Williamsburg.
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

  // Single combined setProps call so the highlight pulse + dot fade + arc
  // draw can all coexist on deckInstance without one frame's render wiping
  // another's layers. The order here matches the visual stack (back→front):
  // rainbow arcs → LGBTQ dots → Henrietta highlight.
  function renderAllNarrativeLayers() {
    if (!window.deckInstance) return;
    const layers = [];

    if (rainbowLineData.length > 0) {
      layers.push(new deck.LineLayer({
        id: 'rainbow-arcs-glow',
        data: rainbowLineData,
        getSourcePosition: (d) => d.path[0],
        getTargetPosition: (d) => d.path[1],
        // Fixed warm-gold glow under every rainbow arc — per-arc colors
        // live in the foreground line layer below; the glow reads as a
        // uniform constellation halo regardless of arc hue.
        getColor: () => [255, 224, 102, 45],
        getWidth: 4,
        widthUnits: 'pixels',
      }));
      // The post-draw pulse mutates each segment's color[3] in place (and
      // hands renderAllNarrativeLayers a fresh array reference so deck.gl
      // re-extracts the color buffer), so we can read d.color straight here.
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

    // The Henrietta + LGBTQ highlight dots live on Mapbox circle layers
    // (constellation-star paint props) rather than deck.gl scatterplots —
    // see startHenriettaHighlight, drawLgbtqDots, and startTropicanaHighlight.

    try { window.deckInstance.setProps({ layers }); } catch (e) {}
  }

  // Henrietta highlight — a Mapbox circle layer styled like a constellation
  // star (warm-white fill, blur 1.2, emissive 1) so it reads as part of the
  // sky rather than as a distinct deck.gl marker. The radius pulses between
  // 6 and 10px via setPaintProperty in the rAF, matching the sine cadence
  // of pulseTick. Runs continuously until stopHenriettaHighlight().
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
      const r = 18 + Math.sin(t) * 4; // pulses 6..10
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

  // Tropicana highlight — same constellation-star look as Henrietta (radius
  // 6..10 pulse, warm-white, blur 1.2, emissive 1). Added in Beat 7 right
  // after the Tropicana card appears so the user sees a single bright star
  // at the destination before the kindred arcs start fanning out.
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
      const r = 18 + Math.sin(t) * 4; // pulses 6..10
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

  // 5 waves of dots, 500ms apart. Each wave appends to a single Mapbox
  // GeoJSON source via setData(); the two circle layers above it (main +
  // glow) carry constellation paint props so each new dot reads as a star
  // that just lit up. Once all waves are in, the main layer's radius
  // pulses 5..8 via setPaintProperty, mirroring pulseTick.
  function drawLgbtqDots(places, onComplete) {
    if (!map) { if (onComplete) onComplete(); return; }
    // Cancel any in-flight pass — both the wave timers and the post-wave
    // pulse rAF.
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

    // Source + layers set up once; subsequent waves only call setData.
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
    // Glow layer added first so the bright main star draws on top.
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

  // Radius pulse 5..8 on lgbtq-highlight-layer once all waves are in. Same
  // sine pattern as pulseTick; the glow layer keeps its fixed 12px radius
  // so the breathing comes from the bright inner star alone.
  function startLgbtqDotPulse() {
    if (!map) return;
    if (lgbtqDotAnimFrame !== null) {
      cancelAnimationFrame(lgbtqDotAnimFrame);
      lgbtqDotAnimFrame = null;
    }
    const startTime = performance.now();
    function pulseFrame(now) {
      const t = ((now - startTime) / 1500) * Math.PI;
      const r = 14 + Math.sin(t) * 4; // 5..8
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

  // Progressive arc draw over 2000ms — same point-by-point reveal pattern
  // as drawNarrativeArcs, but each arc gets a random rainbow color with
  // jittered alpha (180–230) so the bouquet feels organic rather than
  // categorical.
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
        const alpha = 160 + Math.floor(Math.random() * 40); // 120..160
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

  // Continuous breathing on the fully-drawn rainbow web. Alpha range
  // 55..105 driven by Math.sin(Date.now()/1500). Mutates each segment's
  // color[3] in place AND reassigns rainbowLineData to a fresh array each
  // frame — both are needed: in-place keeps the closure-captured refs valid,
  // the new array reference invalidates deck.gl's cached color buffer so it
  // re-extracts.
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

  // Called at Beat 6 entry. Stops all Beat 4/5 animations and emits a final
  // empty setProps so the deck canvas is clear before Tropicana arcs draw.
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
      '<div class="narrative-kindred-item" data-place-id="' + placeId + '">' +
        '<span class="narrative-kindred-dot" style="background:' + color + '"></span>' +
        '<span>' + safeName + '</span>' +
      '</div>'
    );
  }

  // Wires click handlers on the kindred list items so each item updates
  // the right-side place card (name + soul summary) and re-centers the
  // map on the clicked kindred place. Beat advance is suppressed by the
  // overlay-click guard, which short-circuits on .narrative-kindred-item.
  // The placeId argument is the *host* place whose kindred list this is —
  // accepted for symmetry with show/hide calls; the actual click target
  // is read from each item's data-place-id attribute.
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

  // Tears down only the second-tier narrative arcs (leaves the first-tier
  // kindred bouquet intact). Used by the Tropicana web-toggle button.
  function clearNarrativeSecondTierArcs() {
    if (narrativeArcsSecondAnimFrame !== null) {
      cancelAnimationFrame(narrativeArcsSecondAnimFrame);
      narrativeArcsSecondAnimFrame = null;
    }
    narrativeSecondLineData = [];
    renderNarrativeArcs();
  }

  function showNarrativeKindredCard(placeId) {
    if (!narrativeKindredCardEl) {
      narrativeKindredCardEl = document.createElement('div');
      narrativeKindredCardEl.id = 'narrative-kindred-card';
      document.body.appendChild(narrativeKindredCardEl);
    }
    // Stash the host place id so showNarrativeWebBadge can bind the
    // toggle button to the right source for drawNarrativeSecondTierArcs.
    narrativeKindredCardEl.dataset.placeId = placeId;
    const place = lookupPlace(placeId);
    const ids = (place && Array.isArray(place.similarity_ids))
      ? place.similarity_ids.slice(0, 8)
      : [];
    const itemsHtml = ids.map(buildKindredItemMarkup).join('');
    narrativeKindredCardEl.innerHTML =
      '<div class="narrative-kindred-header">' +
        '<span class="narrative-kindred-title">Kindred Places</span>' +
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
    // Wire the toggle once the badge becomes visible. The button is
    // rebuilt on every showNarrativeKindredCard call (innerHTML replace),
    // so the listener has to be attached after each (re)show.
    const toggle = document.getElementById('narrative-web-toggle');
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation(); // suppress beat advance
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
      // Remember which host place the toggle is bound to — Beat 7 wires
      // this to TROPICANA_ID; future beats could rebind to other places.
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
        zoom: 11.1,
        pitch: INITIAL_PITCH,
        bearing: 0,
        duration: 3000,
      });
    }

    else if (n === 2) {
      const c = map.getCenter();
      // Constellation hint — prep the first 3 groups (visibility + fade-in
      // transition) so revealGroup can actually animate them in, then
      // stagger the reveals. constellationReveal() in Beat 3 redoes the
      // full setup for all 20 groups, so any prep here is harmless.
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
      // Subway lines fade in alongside the constellation hint.
      setTimeout(() => drawSubwayLines(), 400);
    }

    else if (n === 3) {
      // No interaction this beat — just trigger the constellation reveal
      // and let it play through. PLACES_LAYER stays hidden.
      clearSubwayLines();
      constellationReveal();
    }

    else if (n === 4) {
      // Henrietta Hudson arrival. Constellation stays visible behind. After
      // 1s the highlight dot starts pulsing on the bar's location; at 2.5s
      // (while the camera is still settling) the 50-place LGBTQ web fades
      // in across the city in 5 staggered waves.
      clearAllNarrativeBeatTimers();
      map.flyTo({
        center: HENRIETTA_COORDS,
        zoom: 16,
        pitch: 45,
        bearing: 100,
        duration: 5000,
      });
      henriettaHighlightTimer = setTimeout(() => {
        henriettaHighlightTimer = null;
        startHenriettaHighlight();
        // Same +1000ms beat as the highlight — the place card surfaces
        // alongside the pulsing star so the user sees Henrietta's name
        // and soul summary while the dots fade in around it.
        showNarrativePlaceCard(HENRIETTA_ID, HENRIETTA_NAME);
      }, 1000);
      lgbtqDotsTimer = setTimeout(() => {
        lgbtqDotsTimer = null;
        const places = selectLgbtqPlaces(50);
        drawLgbtqDots(places, () => {});
      }, 2500);
    }

    else if (n === 5) {
      // Rainbow arcs radiate from Henrietta to the same 50 places picked in
      // Beat 4 (cached on window.lgbtqPlaces so the bouquet matches what
      // the user just watched fade in). Camera pulls back to a city-wide
      // view in parallel so the full web becomes visible. Beat 4's place
      // card slides up to make room for the interactive kindred list.
      clearAllNarrativeBeatTimers();
      let places = window.lgbtqPlaces;
      if (!places || !places.length) places = selectLgbtqPlaces(50);
      const fb = window.featuresById;
      const henrietta =
        (fb && fb.get(HENRIETTA_ID)) ||
        { coordinates: HENRIETTA_COORDS, id: HENRIETTA_ID, name: HENRIETTA_NAME };
      if (window.innerWidth > 640) slideUpNarrativePlaceCard();
      henriettaKindredCardTimer = setTimeout(() => {
        henriettaKindredCardTimer = null;
        showNarrativeKindredCard(HENRIETTA_ID);
        attachKindredCardInteraction(HENRIETTA_ID);
      }, 300);
      drawRainbowArcs(henrietta, places, () => {});
      map.easeTo({
        center: INITIAL_CENTER,
        zoom: 11,
        pitch: INITIAL_PITCH,
        bearing: 0,
        duration: 3000,
      });
    }

    else if (n === 6) {
      // Transition to Tropicana. Wipe Beat 4/5 LGBTQ layers + any arcs
      // before flying so the deck canvas is clean for Tropicana's arcs.
      // (clearAllLgbtqLayers internally calls stopHenriettaHighlight, so
      // no separate Henrietta-cleanup call is needed.)
      clearAllLgbtqLayers();
      clearNarrativeArcs();
      hideNarrativeKindredCard();
      hideNarrativePlaceCard();
      clearAllNarrativeBeatTimers();
      map.flyTo({
        center: TROPICANA_COORDS,
        zoom: 12.75,
        pitch: 55,
        bearing: 210,
        duration: 3000,
      });
      tropicanaCardTimer = setTimeout(() => {
        tropicanaCardTimer = null;
        showNarrativePlaceCard(TROPICANA_ID, TROPICANA_NAME);
        // Static highlight star at Tropicana — pulses 6..10 until the
        // next beat clears it just before the kindred arcs draw.
        startTropicanaHighlight();
      }, 500);
    }

    else if (n === 7) {
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
      if (window.innerWidth > 640) slideUpNarrativePlaceCard();
      drawNarrativeArcs(TROPICANA_ID, () => {});
      if (tropicanaKindredCardTimer) clearTimeout(tropicanaKindredCardTimer);
      tropicanaKindredCardTimer = setTimeout(() => {
        tropicanaKindredCardTimer = null;
        showNarrativeKindredCard(TROPICANA_ID);
        attachKindredCardInteraction(TROPICANA_ID);
      }, 300);
      if (tropicanaWebBadgeTimer) clearTimeout(tropicanaWebBadgeTimer);
      tropicanaWebBadgeTimer = setTimeout(() => {
        tropicanaWebBadgeTimer = null;
        showNarrativeWebBadge();
      }, 1800);
      if (tropicanaSecondTierTimer) clearTimeout(tropicanaSecondTierTimer);
      tropicanaSecondTierTimer = setTimeout(() => {
        tropicanaSecondTierTimer = null;
        // The badge becomes clickable at +1800ms; if the user clicked
        // during the 200ms gap before this auto-draw fires, they've
        // already kicked off the same animation. Skip rather than
        // re-trigger and cause a double-draw flash.
        if (narrativeSecondLineData.length === 0 && narrativeArcsSecondAnimFrame === null) {
          drawNarrativeSecondTierArcs(TROPICANA_ID);
          const toggle = document.getElementById('narrative-web-toggle');
          if (toggle) {
            toggle.classList.add('is-active');
            toggle.textContent = '◎ Web active';
          }
        }
      }, 2000);
    }

    else if (n === 8) {
      // Finale: clear arcs + cards, pull camera back, reveal CTA. The
      // constellation stays visible behind the wide view.
      clearNarrativeArcs();
      clearTropicanaHighlight();
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
    clearSubwayLines();
    clearAllLgbtqLayers();
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
      zoom: 11.1,
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
      // Right-side cards + their controls are interactive surfaces from
      // Beat 4 onward. Clicks land on these elements (or bubble up to the
      // overlay) — guard the advance so users can browse the kindred
      // list and toggle the web without skipping to the next beat.
      if (e.target.closest && (
        e.target.closest('#narrative-right-card') ||
        e.target.closest('#narrative-kindred-card') ||
        e.target.closest('.narrative-kindred-item') ||
        e.target.closest('#narrative-web-toggle')
      )) {
        return;
      }
      // Don't advance during Beat 3 interactive mode
      if (overlayEl.classList.contains('is-interactive')) return;
      if (currentStep < 8) goToStep(currentStep + 1);
    });

    document.addEventListener('keydown', (e) => {
      if (!isNarrativeActive()) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentStep < 8) goToStep(currentStep + 1);
      }
    });
  }

  function initNarrative(mapInstance) {
    if (!mapInstance) return;
    map = mapInstance;

    // Kick off the subway-line fetch immediately. Beat 2 fires ~30s later
    // so the data is almost certainly ready by then; drawSubwayLines() skips
    // the animation cleanly if it isn't (or if the fetch failed).
    fetchSubwayLines();

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