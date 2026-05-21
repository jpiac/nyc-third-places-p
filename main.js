const MAPBOX_TOKEN = 'pk.eyJ1IjoianBpYWMiLCJhIjoiY21wZzNpazdvMGRlbzJxcHF1aXJ3cGNqMiJ9.G5Sxa6-8vxshvOvIWZwgkA'; // ← fill in your token here

const DATA_URL = './data/brooklyn_final.json';
const REVIEW_TRUNCATE = 200;
const TOP_KINDRED = 5;

const COLOR_BY_TYPE = {
  cafe: '#E07A5F',
  bar: '#3D405B',
  pub: '#3D405B',
  library: '#81B29A',
  community_centre: '#F2CC8F',
  social_facility: '#F2CC8F',
  hackerspace: '#A8DADC',
  social_club: '#A8DADC',
};
const COLOR_DEFAULT = '#888888';

const ATMOSPHERE_LABELS = {
  outdoor_seating: 'outdoor seating',
  live_music: 'live music',
  good_for_groups: 'good for groups',
  serves_coffee: 'serves coffee',
};

let map;
let featuresById = new Map();
let pidToSourceId = new Map();
let hoveredId = null;
let selectedId = null;
let connectedIds = new Set();
let deckInstance;
let arcAnimFrame = null;
// One Mapbox sub-layer per reveal_group bucket — narrative.js drives each
// layer's literal opacity / radius / blur for staggered reveals and
// per-group twinkling.
const CONSTELLATION_GROUP_COUNT = 20;

const DEFAULT_OPACITY_EXPR = [
  'case',
  ['==', ['get', 'tier'], 3], 0.45,
  0.9,
];
const SELECTION_OPACITY_EXPR = [
  'case',
  ['boolean', ['feature-state', 'selected'], false], 0.95,
  ['boolean', ['feature-state', 'connected'], false], 0.9,
  ['==', ['get', 'tier'], 3], 0.4,
  0.3,
];

function showError(msg) {
  const el = document.getElementById('error');
  el.textContent = msg;
  el.style.display = 'block';
}

function showLoading(msg) {
  const el = document.getElementById('loading');
  el.textContent = msg;
  el.style.display = 'block';
}

function hideLoading() {
  const el = document.getElementById('loading');
  el.style.display = 'none';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function isPresent(v) {
  return v !== null && v !== undefined && v !== '' && v !== 'null' && v !== 'undefined';
}

function truncateText(text, n) {
  if (!text || text.length <= n) return { text: text || '', truncated: false };
  let cut = text.slice(0, n);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > n * 0.7) cut = cut.slice(0, lastSpace);
  return { text: cut + '…', truncated: true };
}

function buildColorExpression(propName = 'osm_type') {
  const expr = ['match', ['get', propName]];
  for (const [type, color] of Object.entries(COLOR_BY_TYPE)) {
    expr.push(type, color);
  }
  expr.push(COLOR_DEFAULT);
  return expr;
}

async function loadData() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function buildGeoJSON(raw) {
  const features = [];
  (raw.features || []).forEach((p, i) => {
    if (!Array.isArray(p.coordinates) || p.coordinates.length !== 2) return;
    featuresById.set(p.id, p);
    pidToSourceId.set(p.id, i);
    features.push({
      type: 'Feature',
      id: i,
      geometry: { type: 'Point', coordinates: p.coordinates },
      properties: {
        id: p.id,
        name: p.name || '',
        osm_type: p.osm_type || '',
        tier: p.tier == null ? 3 : p.tier,
        review_count: p.review_count,
        reveal_group: Math.floor(Math.random() * CONSTELLATION_GROUP_COUNT),
      },
    });
  });
  return { type: 'FeatureCollection', features };
}

function renderStars(rating) {
  if (!isPresent(rating)) return '';
  const num = Number(rating);
  const pct = Math.max(0, Math.min(5, num)) / 5 * 100;
  return (
    '<span class="rating" aria-label="' + escapeHtml(num.toFixed(1) + ' out of 5') + '">' +
    '<span class="rating-empty">★★★★★</span>' +
    '<span class="rating-filled" style="width:' + pct + '%">★★★★★</span>' +
    '</span>' +
    '<span class="rating-num">' + escapeHtml(num.toFixed(1)) + '</span>'
  );
}

function renderReviewCount(n) {
  if (!isPresent(n)) return '';
  const num = Number(n);
  if (!Number.isFinite(num)) return '';
  return '<span class="review-count">' + num.toLocaleString() + ' reviews</span>';
}

function renderAtmosphere(atmosphere) {
  if (!atmosphere) return '';
  const pills = [];
  for (const [key, label] of Object.entries(ATMOSPHERE_LABELS)) {
    if (atmosphere[key] === true) {
      pills.push('<span class="pill">' + escapeHtml(label) + '</span>');
    }
  }
  if (!pills.length) return '';
  return '<div class="atmosphere">' + pills.join('') + '</div>';
}

function renderReviews(reviews) {
  if (!Array.isArray(reviews) || !reviews.length) return '';
  const items = [];
  for (const r of reviews.slice(0, 3)) {
    if (!r || !r.text) continue;
    const { text, truncated } = truncateText(r.text, REVIEW_TRUNCATE);
    const author = r.author
      ? '<div class="review-author">— ' + escapeHtml(r.author) + '</div>'
      : '';
    items.push(
      '<div class="review' + (truncated ? ' is-truncated' : '') + '">' +
      '<div class="review-text">' + escapeHtml(text) + '</div>' +
      author +
      '</div>'
    );
  }
  if (!items.length) return '';
  return (
    '<div class="section-title">Reviews</div>' +
    '<div class="reviews">' + items.join('') + '</div>'
  );
}

function renderKindred(similarityIds) {
  if (!Array.isArray(similarityIds) || !similarityIds.length) return '';
  const cards = [];
  for (const id of similarityIds.slice(0, TOP_KINDRED)) {
    const place = featuresById.get(id);
    if (!place) continue;
    cards.push(
      '<button class="kindred-card" data-id="' + escapeHtml(id) + '">' +
      '<div class="kindred-name">' + escapeHtml(place.name || '(unnamed)') + '</div>' +
      '<div class="kindred-type">' + escapeHtml(place.osm_type || '') + '</div>' +
      '</button>'
    );
  }
  if (!cards.length) return '';
  return (
    '<div class="section-title">Kindred Places</div>' +
    '<div class="kindred">' + cards.join('') + '</div>'
  );
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function syncDeckView() {
  if (!deckInstance || !map) return;
  const center = map.getCenter();
  const padding = map.getPadding();
  deckInstance.setProps({
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
    }
  });
}

function sampleArc(from, to, height, numPoints) {
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

function interpolateColorRgb(colorA, colorB, t) {
  return [
    Math.round(colorA[0] + (colorB[0] - colorA[0]) * t),
    Math.round(colorA[1] + (colorB[1] - colorA[1]) * t),
    Math.round(colorA[2] + (colorB[2] - colorA[2]) * t),
    Math.round(colorA[3] + (colorB[3] - colorA[3]) * t),
  ];
}

function drawKindredLines(placeId) {
  if (!deckInstance) return;
  const source = featuresById.get(placeId);
  if (!source || !Array.isArray(source.coordinates)) return;

  if (arcAnimFrame !== null) {
    cancelAnimationFrame(arcAnimFrame);
    arcAnimFrame = null;
  }

  const ids = Array.isArray(source.similarity_ids)
    ? source.similarity_ids.slice(0, TOP_KINDRED)
    : [];

  const sourceColor = hexToRgb(COLOR_BY_TYPE[source.osm_type] || COLOR_DEFAULT);

  const segments = ids.map(id => {
    const dest = featuresById.get(id);
    if (!dest) return null;
    const destColor = hexToRgb(COLOR_BY_TYPE[dest.osm_type] || COLOR_DEFAULT);
    return {
      from: source.coordinates,
      to: dest.coordinates,
      sourceColor: [...sourceColor, 220],
      targetColor: [...destColor, 220],
    };
  }).filter(Boolean);

  if (segments.length === 0) {
    deckInstance.setProps({ layers: [] });
    return;
  }

  const ARC_POINTS = 40;
  const ARC_HEIGHT = 0.5;
  const DURATION = 1000;
  const startTime = performance.now();

  const arcPaths = segments.map(seg => ({
    points: sampleArc(seg.from, seg.to, ARC_HEIGHT, ARC_POINTS),
    sourceColor: seg.sourceColor,
    targetColor: seg.targetColor,
  }));

  function frame(now) {
    const t = Math.min(1, (now - startTime) / DURATION);
    const eased = 1 - Math.pow(1 - t, 2);
    syncDeckView();
    const lineData = [];
    arcPaths.forEach(arc => {
      const visibleCount = t >= 1
        ? arc.points.length
        : Math.max(2, Math.floor(eased * ARC_POINTS));
      const visiblePoints = arc.points.slice(0, visibleCount);
      for (let i = 0; i < visiblePoints.length - 1; i++) {
        const segT = i / (ARC_POINTS - 1);
        const color = interpolateColorRgb(arc.sourceColor, arc.targetColor, segT);
        lineData.push({ path: [visiblePoints[i], visiblePoints[i + 1]], color });
      }
    });
    deckInstance.setProps({
      layers: [
        new deck.LineLayer({
          id: 'kindred-arcs-glow',
          data: lineData,
          getSourcePosition: d => d.path[0],
          getTargetPosition: d => d.path[1],
          getColor: d => [d.color[0], d.color[1], d.color[2], 60],
          getWidth: 6,
          widthUnits: 'pixels',
        }),
        new deck.LineLayer({
          id: 'kindred-arcs',
          data: lineData,
          getSourcePosition: d => d.path[0],
          getTargetPosition: d => d.path[1],
          getColor: d => d.color,
          getWidth: 2,
          widthUnits: 'pixels',
        }),
      ]
    });
    if (t < 1) {
      arcAnimFrame = requestAnimationFrame(frame);
    } else {
      arcAnimFrame = null;
    }
  }

  arcAnimFrame = requestAnimationFrame(frame);
}

function clearKindredLines() {
  if (arcAnimFrame !== null) {
    cancelAnimationFrame(arcAnimFrame);
    arcAnimFrame = null;
  }
  if (deckInstance) deckInstance.setProps({ layers: [] });
}

// Constellation pulse animation moved to narrative.js so each reveal group
// can have its own start time — gives the twinkling effect instead of every
// star pulsing in unison.

function applyResponsiveLineVisibility() {
  if (!deckInstance) return;
  const canvas = deckInstance.canvas;
  if (canvas) {
    canvas.style.display = window.innerWidth > 640 ? 'block' : 'none';
  }
}

function setSelected(placeId) {
  if (selectedId !== null) {
    map.setFeatureState({ source: 'places', id: selectedId }, { selected: false });
    selectedId = null;
  }
  for (const id of connectedIds) {
    map.setFeatureState({ source: 'places', id }, { connected: false });
  }
  connectedIds.clear();

  const place = featuresById.get(placeId);
  const sourceId = pidToSourceId.get(placeId);
  if (sourceId != null) {
    map.setFeatureState({ source: 'places', id: sourceId }, { selected: true });
    selectedId = sourceId;
  }

  if (place && Array.isArray(place.similarity_ids)) {
    for (const pid of place.similarity_ids.slice(0, TOP_KINDRED)) {
      const kSourceId = pidToSourceId.get(pid);
      if (kSourceId == null) continue;
      map.setFeatureState({ source: 'places', id: kSourceId }, { connected: true });
      connectedIds.add(kSourceId);
    }
  }

  map.setPaintProperty('places-circles-main', 'circle-opacity', SELECTION_OPACITY_EXPR);
  map.setPaintProperty('faded-overlay', 'background-opacity', 0.3, { duration: 300 });
}

function openSidebar(placeId) {
  const place = featuresById.get(placeId);
  if (!place) return;

  setSelected(placeId);
  drawKindredLines(placeId);

  const badgeColor = COLOR_BY_TYPE[place.osm_type] || COLOR_DEFAULT;
  const parts = [];
  parts.push(
    '<div class="place-type-badge" style="background:' + badgeColor + '">' +
    escapeHtml(place.osm_type || '') + '</div>'
  );
  parts.push('<h2 class="place-name">' + escapeHtml(place.name || '(unnamed)') + '</h2>');

  if (isPresent(place.soul_summary)) {
    parts.push('<p class="place-soul">' + escapeHtml(place.soul_summary) + '</p>');
  }

  const ratingHtml = renderStars(place.rating);
  const reviewCountHtml = renderReviewCount(place.review_count);
  if (ratingHtml || reviewCountHtml) {
    parts.push('<div class="place-meta">' + ratingHtml + reviewCountHtml + '</div>');
  }

  if (isPresent(place.editorial_summary)) {
    parts.push('<p class="place-editorial">' + escapeHtml(place.editorial_summary) + '</p>');
  }

  parts.push(renderAtmosphere(place.atmosphere));
  parts.push(renderReviews(place.reviews));
  parts.push(renderKindred(place.similarity_ids));

  const content = document.getElementById('sidebar-content');
  content.innerHTML = parts.join('');
  content.scrollTop = 0;

  const sidebar = document.getElementById('sidebar');
  const wasOpen = sidebar.classList.contains('is-open');
  sidebar.classList.add('is-open');
  sidebar.setAttribute('aria-hidden', 'false');

  if (!wasOpen && window.innerWidth > 640) {
    map.easeTo({ padding: { right: 440 }, duration: 250 });
  }

  content.querySelectorAll('.kindred-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const target = featuresById.get(id);
      if (target && Array.isArray(target.coordinates)) {
        map.flyTo({ center: target.coordinates, zoom: 16, pitch: 40, duration: 1800 });
      }
      openSidebar(id);
    });
  });
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const wasOpen = sidebar.classList.contains('is-open');
  sidebar.classList.remove('is-open');
  sidebar.setAttribute('aria-hidden', 'true');
  if (selectedId !== null) {
    map.setFeatureState({ source: 'places', id: selectedId }, { selected: false });
    selectedId = null;
  }
  for (const id of connectedIds) {
    map.setFeatureState({ source: 'places', id }, { connected: false });
  }
  connectedIds.clear();
  clearKindredLines();
  if (map) {
    map.setPaintProperty('places-circles-main', 'circle-opacity', DEFAULT_OPACITY_EXPR);
    if (wasOpen) map.easeTo({ padding: { right: 0 }, duration: 250 });
  }
  map.setConfigProperty('basemap', 'transition', { duration: 300, delay: 0 });
  map.setPaintProperty('faded-overlay', 'background-opacity', 0, { duration: 300 });
}

async function initMap() {
  mapboxgl.accessToken = MAPBOX_TOKEN;
  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/jpiac/cmpekflsk003801s3f6ky6n8y',
    center: [-73.95, 40.65],
    zoom: 11,
    pitch: 40,
  });
  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

  showLoading('Loading Brooklyn...');
  let raw;
  try {
    raw = await loadData();
  } catch (e) {
    hideLoading();
    showError('Failed to load ' + DATA_URL + ': ' + e.message);
    return;
  }
  const geojson = buildGeoJSON(raw);
  hideLoading();

  // Expose populated globals for narrative.js
  window.featuresById = featuresById;
  window.drawKindredLines = drawKindredLines;
  window.clearKindredLines = clearKindredLines;
  window.CONSTELLATION_GROUP_COUNT = CONSTELLATION_GROUP_COUNT;

  await new Promise((resolve) => {
    if (map.isStyleLoaded()) resolve();
    else map.once('load', resolve);
  });

  // --- deck.gl standalone canvas setup ---
  const mapContainer = map.getContainer();
  const deckCanvas = document.createElement('canvas');
  deckCanvas.style.position = 'absolute';
  deckCanvas.style.top = '0';
  deckCanvas.style.left = '0';
  deckCanvas.style.width = '100%';
  deckCanvas.style.height = '100%';
  deckCanvas.style.pointerEvents = 'none';
  deckCanvas.id = 'deck-canvas';
  mapContainer.appendChild(deckCanvas);

  const center = map.getCenter();
  deckInstance = new deck.Deck({
    canvas: deckCanvas,
    width: '100%',
    height: '100%',
    initialViewState: {
      longitude: center.lng,
      latitude: center.lat,
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      bearing: map.getBearing(),
    },
    controller: false,
    layers: [],
    onWebGLInitialized: (gl) => {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    },
  });

  window.deckInstance = deckInstance;

  map.on('move', syncDeckView);
  map.on('zoom', syncDeckView);
  map.on('pitch', syncDeckView);
  map.on('bearing', syncDeckView);
  map.on('rotate', syncDeckView);
  map.on('moveend', syncDeckView);

  applyResponsiveLineVisibility();
  window.addEventListener('resize', applyResponsiveLineVisibility);
  // --- end deck.gl setup ---

  map.addSource('places', { type: 'geojson', data: geojson });

  // Constellation layers — narrative only, start hidden. We add one layer per
  // reveal_group so each can be revealed, pulsed, and faded out via LITERAL
  // paint property values. Literals transition reliably via the layer's
  // *-transition config; the previous feature-state / case-expression
  // approach wasn't firing transitions consistently and stars snapped in.
  map.addSource('constellation', { type: 'geojson', data: geojson });
  const CONSTELLATION_TYPES = ['cafe', 'bar', 'pub', 'library', 'community_centre',
    'social_facility', 'hackerspace', 'social_club'];
  const CONSTELLATION_COLOR_EXPR = [
    'interpolate', ['linear'],
    ['get', 'reveal_group'],
    0,  '#ffffff',
    5,  '#fff9c4',
    10, '#ffe066',
    15, '#fff5a0',
    19, '#ffffff',
  ];
  for (let g = 0; g < CONSTELLATION_GROUP_COUNT; g++) {
    map.addLayer({
      id: `constellation-stars-${g}`,
      type: 'circle',
      source: 'constellation',
      layout: { 'visibility': 'none' },
      filter: ['all',
        ['match', ['get', 'osm_type'], CONSTELLATION_TYPES, true, false],
        ['==', ['get', 'reveal_group'], g],
      ],
      paint: {
        'circle-radius': 2,
        'circle-color': CONSTELLATION_COLOR_EXPR,
        'circle-opacity': 0,
        'circle-opacity-transition': { duration: 2000, delay: 0 },
        'circle-blur': 1.2,
        'circle-emissive-strength': 1,
        'circle-stroke-width': 0,
      },
    });
  }

  // Main interactive places layer
  map.addLayer({
    id: 'places-circles-main',
    type: 'circle',
    source: 'places',
    slot: 'top',
    filter: ['match', ['get', 'osm_type'],
      ['cafe', 'bar', 'pub', 'library', 'community_centre',
        'social_facility', 'hackerspace', 'social_club'], true, false],
    paint: {
      'circle-color': buildColorExpression(),
      'circle-radius': [
        'interpolate', ['linear'],
        ['coalesce', ['to-number', ['get', 'review_count']], 0],
        0, 4,
        1000, 9,
      ],
      'circle-opacity': DEFAULT_OPACITY_EXPR,
      'circle-emissive-strength': 1,
      'circle-stroke-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false], '#1a1a1a',
        ['boolean', ['feature-state', 'hover'], false], 'rgba(0,0,0,0.55)',
        'rgba(255,255,255,0.85)',
      ],
      'circle-stroke-width': [
        'interpolate', ['linear'],
        ['zoom'],
        10, 0.5,
        15, 2,
      ],
    },
  });

  // Faded overlay — animates in when a place is selected
  map.addLayer({
    id: 'faded-overlay',
    type: 'background',
    paint: {
      'background-color': '#ffffff',
      'background-opacity': 0,
    },
  });

  // Connected places overlay
  map.addLayer({
    id: 'places-circles-connected-overlay',
    type: 'circle',
    source: 'places',
    filter: ['match', ['get', 'osm_type'],
      ['cafe', 'bar', 'pub', 'library', 'community_centre',
        'social_facility', 'hackerspace', 'social_club'], true, false],
    paint: {
      'circle-color': buildColorExpression(),
      'circle-radius': [
        'interpolate', ['linear'],
        ['coalesce', ['to-number', ['get', 'review_count']], 0],
        0, 5,
        1000, 10,
      ],
      'circle-emissive-strength': 1,
      'circle-opacity': [
        'case',
        ['boolean', ['feature-state', 'connected'], false], 1,
        0,
      ],
      'circle-stroke-color': [
        'case',
        ['match', ['get', 'osm_type'],
          ['community_centre', 'social_facility'], true, false],
        'rgba(0,0,0,0.55)',
        '#ffffff',
      ],
      'circle-stroke-width': [
        'case',
        ['boolean', ['feature-state', 'connected'], false], 1.5,
        0,
      ],
    },
  });

  // Selected place overlay — topmost layer
  map.addLayer({
    id: 'places-circles-selected-overlay',
    type: 'circle',
    source: 'places',
    filter: ['match', ['get', 'osm_type'],
      ['cafe', 'bar', 'pub', 'library', 'community_centre',
        'social_facility', 'hackerspace', 'social_club'], true, false],
    paint: {
      'circle-color': buildColorExpression(),
      'circle-radius': [
        'interpolate', ['linear'],
        ['coalesce', ['to-number', ['get', 'review_count']], 0],
        0, 5,
        1000, 10,
      ],
      'circle-emissive-strength': 1,
      'circle-opacity': [
        'case',
        ['boolean', ['feature-state', 'selected'], false], 1,
        0,
      ],
      'circle-stroke-color': [
        'case',
        ['match', ['get', 'osm_type'],
          ['community_centre', 'social_facility'], true, false],
        'rgba(0,0,0,0.55)',
        '#ffffff',
      ],
      'circle-stroke-width': [
        'case',
        ['boolean', ['feature-state', 'selected'], false], 2.5,
        0,
      ],
    },
  });

 if (typeof window.initNarrative === 'function') {
  window.initNarrative(map);
  }

  function onCircleMouseEnter(e) {
    if (!e.features.length) return;
    map.getCanvas().style.cursor = 'pointer';
    const id = e.features[0].id;
    if (hoveredId !== null && hoveredId !== id) {
      map.setFeatureState({ source: 'places', id: hoveredId }, { hover: false });
    }
    hoveredId = id;
    map.setFeatureState({ source: 'places', id: hoveredId }, { hover: true });
  }

  function onCircleMouseLeave() {
    map.getCanvas().style.cursor = '';
    if (hoveredId !== null) {
      map.setFeatureState({ source: 'places', id: hoveredId }, { hover: false });
      hoveredId = null;
    }
  }

  function onCircleClick(e) {
    if (!e.features.length) return;
    const priorityHits = map.queryRenderedFeatures(e.point, {
      layers: [
        'places-circles-selected-overlay',
        'places-circles-connected-overlay',
        'places-circles-main',
      ]
    });
    const hit = priorityHits.length > 0 ? priorityHits[0] : e.features[0];
    const pid = hit.properties.id;
    if (!pid) return;
    openSidebar(pid);
  }

  ['places-circles-main',
    'places-circles-connected-overlay',
    'places-circles-selected-overlay'].forEach(layer => {
    map.on('mouseenter', layer, onCircleMouseEnter);
    map.on('mouseleave', layer, onCircleMouseLeave);
    map.on('click', layer, onCircleClick);
  });

  // Click on empty map area → deselect
  map.on('click', (e) => {
    if (selectedId === null) return;
    const hits = map.queryRenderedFeatures(e.point, {
      layers: [
        'places-circles-selected-overlay',
        'places-circles-connected-overlay',
        'places-circles-main',
      ]
    });
    if (hits.length === 0) closeSidebar();
  });

  map.on('error', (e) => {
    console.error('Mapbox error:', e && e.error ? e.error : e);
  });
}

function initUI() {
  document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
  });
  document.getElementById('sidebar-content').innerHTML =
    '<p class="empty-state">Click any point on the map to explore a place.</p>';
}

if (!MAPBOX_TOKEN) {
  showError('Set MAPBOX_TOKEN at the top of main.js before loading.');
} else {
  initUI();
  initMap();
}
