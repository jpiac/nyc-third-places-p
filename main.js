const MAPBOX_TOKEN = 'pk.eyJ1IjoianBpYWMiLCJhIjoiY21wZzNpazdvMGRlbzJxcHF1aXJ3cGNqMiJ9.G5Sxa6-8vxshvOvIWZwgkA'; // ← fill in your token here

const DATA_URL = './data/nyc_final.json';
const TOP_KINDRED = 8;

const COLOR_BY_TYPE = {
  cafe: '#E07A5F',
  bar: '#3D405B',
  pub: '#3D405B',
  library: '#81B29A',
  community_centre: '#F2CC8F',
  social_facility: '#F2CC8F',
  hackerspace: '#A8DADC',
  social_club: '#A8DADC',
  // New types
  arts_centre: '#C084FC',
  theatre: '#C084FC',
  cinema: '#C084FC',
  music_venue: '#818CF8',
  nightclub: '#818CF8',
  museum: '#34D399',
  gallery: '#34D399',
  park: '#6EE7B7',
  garden: '#6EE7B7',
  playground: '#6EE7B7',
  memorial: '#94A3B8',
  monument: '#94A3B8',
  artwork: '#F472B6',
  place_of_worship: '#FCD34D',
  hairdresser: '#FB923C',
  beauty: '#FB923C',
  fitness_centre: '#60A5FA',
  sports_centre: '#60A5FA',
  swimming_pool: '#60A5FA',
};
const COLOR_DEFAULT = '#888888';

const ATMOSPHERE_LABELS = {
  // Original 4
  outdoor_seating: 'outdoor seating',
  live_music: 'live music',
  good_for_groups: 'good for groups',
  serves_coffee: 'serves coffee',
  // New fields from 02d
  good_for_children: 'family friendly',
  allows_dogs: 'dog friendly',
  good_for_watching_sports: 'good for sports',
  serves_beer: 'serves beer',
  serves_cocktails: 'serves cocktails',
  serves_wine: 'serves wine',
  reservable: 'reservable',
};

const OSM_TYPE_LABELS = {
  cafe: 'Café',
  bar: 'Bar',
  pub: 'Pub',
  library: 'Library',
  community_centre: 'Community Center',
  social_facility: 'Social Facility',
  hackerspace: 'Hackerspace',
  social_club: 'Social Club',
  arts_centre: 'Arts Center',
  theatre: 'Theater',
  cinema: 'Cinema',
  music_venue: 'Music Venue',
  concert_hall: 'Concert Hall',
  nightclub: 'Nightclub',
  museum: 'Museum',
  gallery: 'Gallery',
  park: 'Park',
  garden: 'Garden',
  playground: 'Playground',
  pitch: 'Sports Field',
  sports_centre: 'Sports Center',
  fitness_centre: 'Fitness Center',
  swimming_pool: 'Swimming Pool',
  books: 'Bookshop',
  records: 'Record Shop',
  hairdresser: 'Hair Salon',
  beauty: 'Beauty Salon',
  tattoo: 'Tattoo Shop',
  bakery: 'Bakery',
  deli: 'Deli',
  laundry: 'Laundromat',
  coffee: 'Coffee Roaster',
  place_of_worship: 'Place of Worship',
  dance: 'Dance Venue',
  amusement_arcade: 'Arcade',
  bowling_alley: 'Bowling Alley',
  ice_rink: 'Ice Rink',
  escape_game: 'Escape Room',
  marketplace: 'Marketplace',
  food_court: 'Food Court',
  memorial: 'Memorial',
  monument: 'Monument',
  artwork: 'Public Art',
  attraction: 'Attraction',
  viewpoint: 'Viewpoint',
  bench: 'Bench',
  dog_park: 'Dog Park',
  nature_reserve: 'Nature Reserve',
  bandstand: 'Bandstand',
  firepit: 'Fire Pit',
  chess_table: 'Chess Table',
  miniature_golf: 'Mini Golf',
  sauna: 'Sauna',
  internet_cafe: 'Internet Café',
  public_bath: 'Public Bath',
  public_bookcase: 'Little Free Library',
  stripclub: 'Strip Club',
  social_club: 'Social Club',
  bbq: 'BBQ Area',
  fountain: 'Fountain',
  shelter: 'Shelter',
  outdoor_seating: 'Outdoor Seating',
  square: 'Public Square',
  pastry: 'Pastry Shop',
  florist: 'Florist',
  chocolate: 'Chocolate Shop',
  tea: 'Tea Shop',
  ice_cream: 'Ice Cream',
  antiques: 'Antique Shop',
  craft: 'Craft Shop',
  art: 'Art Shop',
  musical_instrument: 'Music Shop',
  zoo: 'Zoo',
  aquarium: 'Aquarium',
  concert_hall: 'Concert Hall',
};

function formatOsmType(type) {
  return OSM_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

let map;
let featuresById = new Map();
let pidToSourceId = new Map();
let hoveredId = null;
let selectedId = null;
let selectedPlaceId = null; // string id mirror of selectedId, used by toggleSecondTier
let connectedIds = new Set();
// Numeric source IDs of places currently styled as second-tier kindred —
// tracked so we can reset their feature-state when the toggle turns off or
// a new place is selected.
let secondConnectedIds = new Set();
let deckInstance;
let arcAnimFrame = null;
let secondTierAnimFrame = null;
// rAF handle for the places-circles-main "unfade" back to defaults on
// closeSidebar. Same pattern as the dot fade-ins: Mapbox's transitions on
// data-driven opacity expressions are unreliable, so we drive the case
// expression's default-branch value per frame instead.
let unfadeMainAnimFrame = null;
// 200ms start-delay handle for the second-tier draw. Cleared along with the
// rAF so a fast close/reselect during the gap can't race a stale animation.
let secondTierDelayTimer = null;
// Per-tier line data cached at module level so renderArcs() can re-emit both
// tiers together — deck.gl's setProps replaces all layers, so we have to
// pass both sets every time we want both visible.
let firstTierLineData = [];
let secondTierLineData = [];
let showSecondTier = false;
// One Mapbox sub-layer per reveal_group bucket — narrative.js drives each
// layer's literal opacity / radius / blur for staggered reveals and
// per-group twinkling.
const CONSTELLATION_GROUP_COUNT = 20;

// Stashed GeoJSON for reuse by addConstellationLayers() after teardown.
// Set in initMap(); referenced by the constellation source setup so we can
// remove + re-add the layers across a replay without re-fetching.
let geojsonData = null;

// Constellation styling moved to module scope so both initMap() and any
// replay path (which calls addConstellationLayers anew) reuse the same
// arrays. Memory-wise these are tiny — the win from removing constellation
// after the narrative ends is in the Mapbox tile state, not these consts.
const CONSTELLATION_TYPES = [
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
];
const CONSTELLATION_COLOR_EXPR = [
  'interpolate', ['linear'],
  ['get', 'reveal_group'],
  0,  '#ffffff',
  5,  '#fff9c4',
  10, '#ffe066',
  15, '#fff5a0',
  19, '#ffffff',
];

// Add the 'constellation' source + 20 per-reveal-group circle layers.
// Idempotent — bails if the source already exists, so it's safe to call
// from the replay path. Source intentionally re-uses geojsonData rather
// than re-fetching.
function addConstellationLayers(mapInstance) {
  if (!geojsonData) return;
  if (mapInstance.getSource('constellation')) return;
  mapInstance.addSource('constellation', { type: 'geojson', data: geojsonData });
  for (let g = 0; g < CONSTELLATION_GROUP_COUNT; g++) {
    mapInstance.addLayer({
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
}

// Remove all 20 layers AND the source, freeing the Mapbox tile state /
// internal geojson copy. Called by narrative.js after the intro fades.
// Layers must be removed first — Mapbox refuses to remove a source still
// referenced by any layer.
function removeConstellationLayers(mapInstance) {
  for (let g = 0; g < CONSTELLATION_GROUP_COUNT; g++) {
    const id = `constellation-stars-${g}`;
    if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
  }
  if (mapInstance.getSource('constellation')) {
    mapInstance.removeSource('constellation');
  }
}

const DEFAULT_OPACITY_EXPR = 0.9;
const SELECTION_OPACITY_EXPR = 0.1;

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

function buildColorExpression(propName = 'osm_type') {
  const expr = ['match', ['get', propName]];
  for (const [type, color] of Object.entries(COLOR_BY_TYPE)) {
    expr.push(type, color);
  }
  expr.push(COLOR_DEFAULT);
  return expr;
}

async function loadData() {
  // Try the gzipped artifact first. The deploy pipeline (build-site.sh) ships
  // nyc_final.json.gz (~10MB) instead of the raw 120MB .json because GitHub
  // refuses files over 100MB. Locally the .gz may not exist; fall back to
  // the raw .json so dev doesn't need to rebuild dist/ on every change.
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const gzRes = await fetch(DATA_URL + '.gz');
      if (gzRes.ok && gzRes.body) {
        const decompressed = gzRes.body.pipeThrough(new DecompressionStream('gzip'));
        return await new Response(decompressed).json();
      }
    } catch (e) { /* fall through to plain fetch */ }
  }
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

const VIBE_ICON_DEFS = {
  outdoor_seating: { label: 'Outdoor', svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.8 2c1 5 .5 10.5-6.8 12.4"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/></svg>' },
  live_music: { label: 'Live Music', svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' },
  good_for_groups: { label: 'Groups', svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
  serves_coffee: { label: 'Coffee', svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>' },
  good_for_children: { label: 'Family', svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' },
  allows_dogs: { label: 'Dogs', svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/></svg>' },
  good_for_watching_sports: { label: 'Sports', svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>' },
  serves_beer: { label: 'Beer', svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 11h1a3 3 0 0 1 0 6h-1"/><path d="M9 12v6"/><path d="M13 12v6"/><path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/><path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5C9.44 3.5 10 3 12 3s2.56.5 3.5.5c.94 0 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2-.5Z"/></svg>' },
  serves_cocktails: { label: 'Cocktails', svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M12 11v11"/><path d="M19 3H5l7 8 7-8Z"/></svg>' },
  serves_wine: { label: 'Wine', svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5V3H7v7a5 5 0 0 0 5 5Z"/></svg>' },
  reservable: { label: 'Reservable', svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' },
};

const RAINBOW_SVG = '<svg width="18" height="12" viewBox="0 0 18 12" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="18" height="2" fill="#e40303"/><rect x="0" y="2" width="18" height="2" fill="#ff8c00"/><rect x="0" y="4" width="18" height="2" fill="#ffed00"/><rect x="0" y="6" width="18" height="2" fill="#008026"/><rect x="0" y="8" width="18" height="2" fill="#004dff"/><rect x="0" y="10" width="18" height="2" fill="#750787"/></svg>';
const RAINBOW_SMALL_SVG = '<svg width="13" height="9" viewBox="0 0 18 12" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="18" height="2" fill="#e40303"/><rect x="0" y="2" width="18" height="2" fill="#ff8c00"/><rect x="0" y="4" width="18" height="2" fill="#ffed00"/><rect x="0" y="6" width="18" height="2" fill="#008026"/><rect x="0" y="8" width="18" height="2" fill="#004dff"/><rect x="0" y="10" width="18" height="2" fill="#750787"/></svg>';
const RELIGION_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 9h4"/><path d="M12 7v5"/><path d="M14 22v-4a2 2 0 0 0-4 0v4"/><path d="M18 22V5.618a1 1 0 0 0-.553-.894l-4.553-2.277a2 2 0 0 0-1.788 0L6.553 4.724A1 1 0 0 0 6 5.618V22"/></svg>';
const COMMUNITY_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/></svg>';

function formatCommunityValue(s) {
  return String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderVibeChart(place) {
  const atmosphere = place.atmosphere || {};
  const community = place.community_tags || {};

  const items = [];
  for (const [key, def] of Object.entries(VIBE_ICON_DEFS)) {
    const val = atmosphere[key];
    if (val !== true && val !== false) continue;
    const cls = val ? 'is-true' : 'is-false';
    items.push(
      '<div class="vibe-item ' + cls + '">' +
        def.svg +
        '<div class="vibe-item-label">' + escapeHtml(def.label) + '</div>' +
      '</div>'
    );
  }

  const communityTags = [];
  if (community.lgbtq_primary === true) {
    communityTags.push(
      '<span class="vibe-community-tag">' + RAINBOW_SVG +
      '<span>LGBTQ+ Primary</span></span>'
    );
  }
  if (community.lgbtq_friendly === true && community.lgbtq_primary !== true) {
    communityTags.push(
      '<span class="vibe-community-tag">' + RAINBOW_SMALL_SVG +
      '<span>LGBTQ+ Welcoming</span></span>'
    );
  }
  if (isPresent(community.religion)) {
    communityTags.push(
      '<span class="vibe-community-tag">' + RELIGION_SVG +
      '<span>' + escapeHtml(formatCommunityValue(community.religion)) + '</span></span>'
    );
  }
  if (isPresent(community.for_community)) {
    communityTags.push(
      '<span class="vibe-community-tag">' + COMMUNITY_SVG +
      '<span>' + escapeHtml(formatCommunityValue(community.for_community)) + '</span></span>'
    );
  }

  if (items.length === 0 && communityTags.length === 0) return '';

  return (
    '<div class="section-title">Vibe</div>' +
    '<div class="vibe-chart">' +
      '<div class="vibe-grid">' + items.join('') + '</div>' +
      (communityTags.length
        ? '<div class="vibe-community">' + communityTags.join('') + '</div>'
        : '') +
    '</div>'
  );
}

function renderKindredTypeBreakdown(similarityIds) {
  if (!Array.isArray(similarityIds) || !similarityIds.length) return '';

  const places = [];
  for (const id of similarityIds.slice(0, TOP_KINDRED)) {
    const p = featuresById.get(id);
    if (p) places.push(p);
  }
  if (!places.length) return '';

  const dots = places.map((p) => {
    const color = COLOR_BY_TYPE[p.osm_type] || COLOR_DEFAULT;
    const label = formatOsmType(p.osm_type || '');
    return '<span class="kindred-type-dot" style="background:' + color +
      '" title="' + escapeHtml(label) + '"></span>';
  }).join('');

  const seen = new Map();
  for (const p of places) {
    if (!seen.has(p.osm_type)) {
      seen.set(p.osm_type, formatOsmType(p.osm_type || ''));
    }
  }
  const legend = Array.from(seen.entries()).map(([type, label]) => {
    const color = COLOR_BY_TYPE[type] || COLOR_DEFAULT;
    return '<span class="kindred-type-legend-item">' +
      '<span class="kindred-type-legend-swatch" style="background:' + color + '"></span>' +
      '<span>' + escapeHtml(label) + '</span>' +
    '</span>';
  }).join('');

  return (
    '<div class="kindred-type-breakdown">' +
      '<div class="kindred-type-dots">' + dots + '</div>' +
      '<div class="kindred-type-legend">' + legend + '</div>' +
    '</div>'
  );
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

function renderKindred(similarityIds) {
  if (!Array.isArray(similarityIds) || !similarityIds.length) return '';
  const cards = [];
  for (const id of similarityIds.slice(0, TOP_KINDRED)) {
    const place = featuresById.get(id);
    if (!place) continue;
    cards.push(
      '<button class="kindred-card" data-id="' + escapeHtml(id) + '">' +
      '<div class="kindred-name">' + escapeHtml(place.name || '(unnamed)') + '</div>' +
      '<div class="kindred-type">' + escapeHtml(formatOsmType(place.osm_type || '')) + '</div>' +
      '</button>'
    );
  }
  if (!cards.length) return '';
  // The toggle's is-active class is set inline so a re-render of the
  // sidebar (e.g. after clicking a kindred card to navigate) reflects the
  // current showSecondTier state immediately, before toggleSecondTier()
  // would otherwise sync it on next interaction.
  const toggleActive = showSecondTier ? ' is-active' : '';
  return (
    '<div class="kindred-header">' +
      '<div class="section-title">Kindred Places</div>' +
      '<button id="second-tier-toggle" type="button" class="second-tier-toggle' + toggleActive + '" ' +
        'aria-pressed="' + (showSecondTier ? 'true' : 'false') + '">' +
        '<span class="second-tier-icon" aria-hidden="true">◎</span>' +
        '<span class="second-tier-label">Web of connections</span>' +
      '</button>' +
    '</div>' +
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

// Layer-builder helpers — kept separate so renderArcs() can emit both tiers
// together when both have data.
function buildFirstTierLayers(lineData) {
  return [
    new deck.LineLayer({
      id: 'kindred-arcs-glow',
      data: lineData,
      getSourcePosition: (d) => d.path[0],
      getTargetPosition: (d) => d.path[1],
      getColor: (d) => [d.color[0], d.color[1], d.color[2], 60],
      getWidth: 5,
      widthUnits: 'pixels',
    }),
    new deck.LineLayer({
      id: 'kindred-arcs',
      data: lineData,
      getSourcePosition: (d) => d.path[0],
      getTargetPosition: (d) => d.path[1],
      getColor: (d) => d.color,
      getWidth: 2.5,
      widthUnits: 'pixels',
    }),
  ];
}

function buildSecondTierLayers(lineData) {
  return [
    new deck.LineLayer({
      id: 'kindred-arcs-second-glow',
      data: lineData,
      getSourcePosition: (d) => d.path[0],
      getTargetPosition: (d) => d.path[1],
      getColor: (d) => [d.color[0], d.color[1], d.color[2], 60],
      getWidth: 3,
      widthUnits: 'pixels',
    }),
    new deck.LineLayer({
      id: 'kindred-arcs-second',
      data: lineData,
      getSourcePosition: (d) => d.path[0],
      getTargetPosition: (d) => d.path[1],
      getColor: (d) => [d.color[0], d.color[1], d.color[2], 200],
      getWidth: 1.5,
      widthUnits: 'pixels',
    }),
  ];
}

function renderArcs() {
  if (!deckInstance) return;
  const layers = [];
  if (firstTierLineData.length > 0) layers.push(...buildFirstTierLayers(firstTierLineData));
  if (secondTierLineData.length > 0) layers.push(...buildSecondTierLayers(secondTierLineData));
  deckInstance.setProps({ layers });
}

function drawKindredLines(placeId) {
  if (!deckInstance) return;
  const source = featuresById.get(placeId);
  if (!source || !Array.isArray(source.coordinates)) return;

  if (arcAnimFrame !== null) {
    cancelAnimationFrame(arcAnimFrame);
    arcAnimFrame = null;
  }
  // Starting a fresh first-tier draw — wipe any stale second-tier lines so
  // they don't linger over the new selection.
  clearSecondTierLines();

  const ids = Array.isArray(source.similarity_ids)
    ? source.similarity_ids.slice(0, TOP_KINDRED)
    : [];

  const sourceColor = hexToRgb(COLOR_BY_TYPE[source.osm_type] || COLOR_DEFAULT);

  const segments = ids.map((id) => {
    const dest = featuresById.get(id);
    if (!dest) return null;
    const destColor = hexToRgb(COLOR_BY_TYPE[dest.osm_type] || COLOR_DEFAULT);
    return {
      from: source.coordinates,
      to: dest.coordinates,
      sourceColor: [...sourceColor, 250],
      targetColor: [...destColor, 250],
    };
  }).filter(Boolean);

  if (segments.length === 0) {
    firstTierLineData = [];
    renderArcs();
    return;
  }

  const ARC_POINTS = 40;
  const ARC_HEIGHT = 0.5;
  const DURATION = 1500;
  const startTime = performance.now();

  const arcPaths = segments.map((seg) => ({
    points: sampleArc(seg.from, seg.to, ARC_HEIGHT, ARC_POINTS),
    sourceColor: seg.sourceColor,
    targetColor: seg.targetColor,
  }));

  function frame(now) {
    const t = Math.min(1, (now - startTime) / DURATION);
    const eased = 1 - Math.pow(1 - t, 2);
    syncDeckView();
    const lineData = [];
    arcPaths.forEach((arc) => {
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
    firstTierLineData = lineData;
    renderArcs();

    // Drive the connected-overlay dot's opacity + stroke from the same
    // `eased` value the arc growth uses — they fade in over the same
    // timeline the arc takes to reach them.
    try {
      map.setPaintProperty('places-circles-connected-overlay', 'circle-opacity', [
        'case',
        ['boolean', ['feature-state', 'connected'], false], eased,
        0,
      ]);
      map.setPaintProperty('places-circles-connected-overlay', 'circle-stroke-width', [
        'case',
        ['boolean', ['feature-state', 'connected'], false], eased * 1.5,
        0,
      ]);
    } catch (e) { /* layer not ready or torn down */ }

    if (t < 1) {
      arcAnimFrame = requestAnimationFrame(frame);
    } else {
      arcAnimFrame = null;
      // Restore the opacity transition so future fade-outs (closeSidebar,
      // selecting a new place) animate via Mapbox instead of snapping. The
      // case expression itself stays at the final eased=1 value, so when
      // feature-state.connected flips to false the per-feature output
      // changes from 1 → 0, which Mapbox interpolates over the new duration.
      try {
        map.setPaintProperty('places-circles-connected-overlay', 'circle-opacity-transition', { duration: 400, delay: 0 });
      } catch (e) {}
      // Second-tier kicks in only after the first-tier draw completes.
      if (showSecondTier && ids.length > 0) {
        drawSecondTierLines(ids);
      }
    }
  }

  arcAnimFrame = requestAnimationFrame(frame);
}

function resetSecondConnectedFeatureStates() {
  if (!map || secondConnectedIds.size === 0) return;
  for (const id of secondConnectedIds) {
    map.setFeatureState({ source: 'places', sourceLayer: 'nyc_places', id }, { second_connected: false });
  }
  secondConnectedIds.clear();
}

function drawSecondTierLines(firstTierIds) {
  if (!deckInstance) return;
  // Cancel any in-flight second-tier work — both the rAF (mid-animation)
  // and the start-delay timeout (pre-animation). Either can be live when a
  // new selection lands.
  if (secondTierAnimFrame !== null) {
    cancelAnimationFrame(secondTierAnimFrame);
    secondTierAnimFrame = null;
  }
  if (secondTierDelayTimer !== null) {
    clearTimeout(secondTierDelayTimer);
    secondTierDelayTimer = null;
  }
  // Reset any feature-states left over from a prior second-tier draw so
  // we don't accumulate `second_connected` flags across rapid retoggles.
  resetSecondConnectedFeatureStates();

  // Build the dest set: each first-tier place's similarity_ids, minus the
  // originally selected place, minus the first-tier places, minus duplicates.
  const exclude = new Set(firstTierIds);
  if (selectedPlaceId) exclude.add(selectedPlaceId);

  const seen = new Set();
  const segments = [];
  const destSourceIds = [];
  for (const firstId of firstTierIds) {
    const firstPlace = featuresById.get(firstId);
    if (!firstPlace || !Array.isArray(firstPlace.coordinates)) continue;
    if (!Array.isArray(firstPlace.similarity_ids)) continue;
    const firstColor = hexToRgb(COLOR_BY_TYPE[firstPlace.osm_type] || COLOR_DEFAULT);
    for (const secondId of firstPlace.similarity_ids.slice(0, TOP_KINDRED)) {
      if (exclude.has(secondId) || seen.has(secondId)) continue;
      seen.add(secondId);
      const secondPlace = featuresById.get(secondId);
      if (!secondPlace || !Array.isArray(secondPlace.coordinates)) continue;
      const secondColor = hexToRgb(COLOR_BY_TYPE[secondPlace.osm_type] || COLOR_DEFAULT);
      segments.push({
        from: firstPlace.coordinates,
        to: secondPlace.coordinates,
        sourceColor: [...firstColor, 240],
        targetColor: [...secondColor, 240],
      });
      // Collect dest source IDs — we'll flip feature-state inside the
      // setTimeout below so the dot fade-in starts the same instant the
      // arc animation does (rather than ~200ms earlier).
      destSourceIds.push(secondId);
    }
  }

  if (segments.length === 0) return;

  const ARC_POINTS = 40;
  const ARC_HEIGHT = 0.3;
  const DURATION = 1500;
  const START_DELAY_MS = 50;

  const arcPaths = segments.map((seg) => ({
    points: sampleArc(seg.from, seg.to, ARC_HEIGHT, ARC_POINTS),
    sourceColor: seg.sourceColor,
    targetColor: seg.targetColor,
  }));

  secondTierDelayTimer = setTimeout(() => {
    secondTierDelayTimer = null;
    // Prep: disable the layer's opacity transition and zero out the case
    // expression's target value BEFORE flipping feature-state. Otherwise
    // Mapbox would either snap the dots in instantly (feature-state
    // transitions are unreliable, same Mapbox quirk as the constellation
    // and first-tier issues) or fight our per-frame setPaintProperty
    // updates below.
    try {
      map.setPaintProperty('places-circles-second-tier-overlay', 'circle-opacity-transition', { duration: 0, delay: 0 });
      map.setPaintProperty('places-circles-second-tier-overlay', 'circle-opacity', [
        'case',
        ['boolean', ['feature-state', 'second_connected'], false], 0,
        0,
      ]);
      map.setPaintProperty('places-circles-second-tier-overlay', 'circle-stroke-width', [
        'case',
        ['boolean', ['feature-state', 'second_connected'], false], 0,
        0,
      ]);
    } catch (e) {}

    for (const id of destSourceIds) {
      map.setFeatureState({ source: 'places', sourceLayer: 'nyc_places', id }, { second_connected: true });
      secondConnectedIds.add(id);
    }
    const startTime = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - startTime) / DURATION);
      const eased = 1 - Math.pow(1 - t, 2);
      syncDeckView();
      const lineData = [];
      arcPaths.forEach((arc) => {
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
      secondTierLineData = lineData;
      renderArcs();

      // Drive the second-tier dot opacity + stroke from the same `eased`
      // value the arc growth uses — dot fade completes the instant the
      // arc tip reaches the dot.
      try {
        map.setPaintProperty('places-circles-second-tier-overlay', 'circle-opacity', [
          'case',
          ['boolean', ['feature-state', 'second_connected'], false], eased * 0.7,
          0,
        ]);
        map.setPaintProperty('places-circles-second-tier-overlay', 'circle-stroke-width', [
          'case',
          ['boolean', ['feature-state', 'second_connected'], false], eased * 1.0,
          0,
        ]);
      } catch (e) {}

      if (t < 1) {
        secondTierAnimFrame = requestAnimationFrame(frame);
      } else {
        secondTierAnimFrame = null;
        // Restore a non-zero transition so fade-out (toggle off, close
        // sidebar) animates instead of snapping. The case expression
        // already holds the final eased=1 value, so when feature-state
        // flips false, per-feature opacity goes from 0.9 → 0 over 400ms.
        try {
          map.setPaintProperty('places-circles-second-tier-overlay', 'circle-opacity-transition', { duration: 400, delay: 0 });
        } catch (e) {}
      }
    }
    secondTierAnimFrame = requestAnimationFrame(frame);
  }, START_DELAY_MS);
}

function clearSecondTierLines() {
  if (secondTierAnimFrame !== null) {
    cancelAnimationFrame(secondTierAnimFrame);
    secondTierAnimFrame = null;
  }
  // Also cancel the pre-animation start-delay — without this, a close/select
  // during the 200ms gap would let the queued setTimeout fire and start a
  // fresh rAF against captured (now stale) arcPaths.
  if (secondTierDelayTimer !== null) {
    clearTimeout(secondTierDelayTimer);
    secondTierDelayTimer = null;
  }
  // Drop the dot highlights too — both the arc layer and the dot overlay
  // come from the same toggle, so they should clear together.
  resetSecondConnectedFeatureStates();
  secondTierLineData = [];
  renderArcs();
}

function clearKindredLines() {
  if (arcAnimFrame !== null) {
    cancelAnimationFrame(arcAnimFrame);
    arcAnimFrame = null;
  }
  firstTierLineData = [];
  // clearSecondTierLines() also calls renderArcs(), which now sees both
  // tier arrays empty and pushes setProps({ layers: [] }).
  clearSecondTierLines();
}

function toggleSecondTier() {
  showSecondTier = !showSecondTier;
  // Mirror to window so narrative.js (and any other external caller) can
  // read the current state without reaching into the IIFE.
  window.showSecondTier = showSecondTier;
  const btn = document.getElementById('second-tier-toggle');
  if (btn) btn.classList.toggle('is-active', showSecondTier);

  if (!showSecondTier) {
    clearSecondTierLines();
    return;
  }
  // Turning on — only act if there's an active selection to draw against.
  if (!selectedPlaceId) return;
  const place = featuresById.get(selectedPlaceId);
  if (!place || !Array.isArray(place.similarity_ids)) return;
  drawSecondTierLines(place.similarity_ids.slice(0, TOP_KINDRED));
}
window.toggleSecondTier = toggleSecondTier;
// Initial state mirrored once on load so callers that read window.showSecondTier
// before any toggle still see the current value.
window.showSecondTier = showSecondTier;

// Constellation pulse animation moved to narrative.js so each reveal group
// can have its own start time — gives the twinkling effect instead of every
// star pulsing in unison.

// Bottom-sheet drag behavior for the sidebar on small screens.
// Desktop (>640px): no-op — the sidebar slides in from the right via CSS only.
// Mobile: drag-handle taps toggle expanded, vertical swipes either expand
// (up >50px), close (down >100px), or snap back. During a downward drag we
// drive transform per-frame so the sheet tracks the finger; we disable the
// CSS transition for the duration so it doesn't ease against the live drag.
// Idempotent — safe to re-call on resize. State + handlers are stashed on
// the sidebar node so a re-init can cleanly detach before re-binding.
function initMobileSheet() {
  const sidebar = document.getElementById('sidebar');
  const handle = document.getElementById('sidebar-drag-handle');
  if (!sidebar || !handle) return;

  if (sidebar._sheetHandlers) {
    const h = sidebar._sheetHandlers;
    handle.removeEventListener('touchstart', h.start);
    handle.removeEventListener('touchmove', h.move);
    handle.removeEventListener('touchend', h.end);
    handle.removeEventListener('click', h.click);
    sidebar._sheetHandlers = null;
    // Restore any inline state that a prior drag may have left behind.
    sidebar.style.transform = '';
    sidebar.style.transition = '';
  }

  if (window.innerWidth > 640) return;

  let startY = null;
  let lastDelta = 0;
  let dragging = false;
  let suppressNextClick = false;

  function onStart(e) {
    if (!e.touches || !e.touches.length) return;
    startY = e.touches[0].clientY;
    lastDelta = 0;
    dragging = true;
    // Kill the slide transition for the duration of the drag so each
    // touchmove paints exactly where the finger is. Restored on touchend.
    sidebar.style.transition = 'none';
  }

  function onMove(e) {
    if (!dragging || startY == null || !e.touches || !e.touches.length) return;
    const dy = e.touches[0].clientY - startY;
    lastDelta = dy;
    // Upward swipe past the threshold while collapsed → expand. Done mid-drag
    // (not on touchend) so the user sees the height jump while still pulling.
    if (dy < -50 && !sidebar.classList.contains('is-expanded')) {
      sidebar.classList.add('is-expanded');
    }
    // Only drag the sheet downward — translating up would pull it above the
    // viewport top, which isn't meaningful for a bottom sheet.
    if (dy > 0) {
      sidebar.style.transform = 'translateY(' + dy + 'px)';
    } else {
      sidebar.style.transform = '';
    }
  }

  function onEnd() {
    if (!dragging) return;
    dragging = false;
    sidebar.style.transition = '';
    sidebar.style.transform = '';
    if (lastDelta > 100) {
      closeSidebar();
      suppressNextClick = true;
    } else if (lastDelta < -50) {
      sidebar.classList.add('is-expanded');
      suppressNextClick = true;
    }
    startY = null;
  }

  function onClick() {
    // A real drag (close/expand by swipe) suppresses the synthetic click that
    // some browsers fire after touchend, so the tap-to-toggle below only runs
    // for actual taps with no significant movement.
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    sidebar.classList.toggle('is-expanded');
  }

  handle.addEventListener('touchstart', onStart, { passive: true });
  handle.addEventListener('touchmove', onMove, { passive: true });
  handle.addEventListener('touchend', onEnd);
  handle.addEventListener('click', onClick);
  sidebar._sheetHandlers = { start: onStart, move: onMove, end: onEnd, click: onClick };
}

// Re-init only when crossing the 640px breakpoint — every resize-pixel would
// be wasteful since the handler set doesn't depend on exact width.
let lastIsMobileForSheet = window.innerWidth <= 640;
window.addEventListener('resize', () => {
  const isMobile = window.innerWidth <= 640;
  if (isMobile !== lastIsMobileForSheet) {
    lastIsMobileForSheet = isMobile;
    initMobileSheet();
  }
});

function applyResponsiveLineVisibility() {
  if (!deckInstance) return;
  const canvas = deckInstance.canvas;
  if (canvas) {
    canvas.style.display = 'block'; // show on all screen sizes
  }
}

// Animate places-circles-main back from SELECTION_OPACITY_EXPR's dimmed
// default (0.2 currently) to DEFAULT_OPACITY_EXPR's full opacity (0.9 for
// tier 1/2, 0.45 for tier 3). The Mapbox transition swap is unreliable
// when the expression structure changes simultaneously with feature-state
// resets — it can leave per-feature opacity stuck on intermediate values.
// Driving the case expression's default branches per frame guarantees the
// final state is reached.
function unfadeMain() {
  if (unfadeMainAnimFrame !== null) {
    cancelAnimationFrame(unfadeMainAnimFrame);
    unfadeMainAnimFrame = null;
  }
  if (!map) return;
  try {
    // Stop Mapbox from competing with our per-frame snaps.
    map.setPaintProperty('places-circles-main', 'circle-opacity-transition', { duration: 0, delay: 0 });
  } catch (e) {}

  // Drive a LITERAL opacity value per frame instead of a case expression.
  // With 14k features, every per-frame `setPaintProperty(case-expr)` was
  // triggering a full re-evaluation across the layer and dragging the rAF
  // down to 3–5 fps — visually the animation took 5–10 seconds. Mapbox
  // applies a literal opacity as a single uniform update, no per-feature
  // work, so this stays at 60fps even on the full NYC dataset.
  const FROM = 0.1;   // SELECTION_OPACITY_EXPR's dimmed default
  const TO = 0.9;     // DEFAULT_OPACITY_EXPR's tier-1/2 value
  const DURATION = 300;
  const startTime = performance.now();

  function step(now) {
    const t = Math.min(1, (now - startTime) / DURATION);
    const eased = 1 - Math.pow(1 - t, 2);
    const current = FROM + (TO - FROM) * eased;
    try {
      map.setPaintProperty('places-circles-main', 'circle-opacity', current);
    } catch (e) {}
    if (t < 1) {
      unfadeMainAnimFrame = requestAnimationFrame(step);
    } else {
      unfadeMainAnimFrame = null;
      // Settle on DEFAULT_OPACITY_EXPR so tier 3 returns to its dimmer
      // 0.45 (only ~1 feature in the dataset, so the brief overshoot to
      // 0.9 during the animation is imperceptible). Also restore a non-
      // zero transition for setSelected's next fade-into-selection.
      try {
        map.setPaintProperty('places-circles-main', 'circle-opacity', DEFAULT_OPACITY_EXPR);
        map.setPaintProperty('places-circles-main', 'circle-opacity-transition', { duration: 300, delay: 0 });
      } catch (e) {}
    }
  }
  unfadeMainAnimFrame = requestAnimationFrame(step);
}

function setSelected(placeId) {
  if (selectedId !== null) {
    map.setFeatureState(
      { source: 'places', sourceLayer: 'nyc_places', id: selectedId },
      { selected: false }
    );
    selectedId = null;
  }
  for (const id of connectedIds) {
    map.setFeatureState(
      { source: 'places', sourceLayer: 'nyc_places', id },
      { connected: false }
    );
  }
  connectedIds.clear();

  const place = featuresById.get(placeId);
  // Use string placeId directly — promoteId maps the 'id' property
  map.setFeatureState(
    { source: 'places', sourceLayer: 'nyc_places', id: placeId },
    { selected: true }
  );
  selectedId = placeId;
  selectedPlaceId = placeId;

  if (place && Array.isArray(place.similarity_ids)) {
    for (const pid of place.similarity_ids.slice(0, TOP_KINDRED)) {
      map.setFeatureState(
        { source: 'places', sourceLayer: 'nyc_places', id: pid },
        { connected: true }
      );
      connectedIds.add(pid);
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
  escapeHtml(formatOsmType(place.osm_type || '')) + '</div>'
  );
  parts.push('<h2 class="place-name">' + escapeHtml(place.name || '(unnamed)') + '</h2>');

  if (isPresent(place.soul_summary)) {
    parts.push('<p class="place-soul">' + escapeHtml(place.soul_summary) + '</p>');
  }
  if (isPresent(place.editorial_summary)) {
    parts.push('<p class="place-editorial">' + escapeHtml(place.editorial_summary) + '</p>');
  }
  parts.push(renderVibeChart(place));
  parts.push(renderKindredTypeBreakdown(place.similarity_ids));
  parts.push(renderKindred(place.similarity_ids));

  const content = document.getElementById('sidebar-content');
  content.innerHTML = parts.join('');
  content.scrollTop = 0;

  const sidebar = document.getElementById('sidebar');
  const wasOpen = sidebar.classList.contains('is-open');
  // Every new place opens in the collapsed (50vh) state on mobile. Without
  // this, navigating between kindred cards would carry the previous sheet's
  // expanded height into the next one.
  sidebar.classList.remove('is-expanded');
  sidebar.style.transform = '';
  sidebar.classList.add('is-open');
  sidebar.setAttribute('aria-hidden', 'false');

  if (!wasOpen && window.innerWidth > 640) {
    map.easeTo({ padding: { right: 440 }, duration: 250 });
  }

  // Wire the second-tier toggle that renderKindred just injected. The
  // button is re-created on every openSidebar call (innerHTML replace), so
  // the listener has to be re-attached each time.
  const tierBtn = content.querySelector('#second-tier-toggle');
  if (tierBtn) {
    tierBtn.addEventListener('click', toggleSecondTier);
  }

  content.querySelectorAll('.kindred-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const target = featuresById.get(id);
      if (target && Array.isArray(target.coordinates)) {
        const flyOpts = {
          center: target.coordinates,
          zoom: 16,
          pitch: 65,
          duration: 5000,
        };
        // Mobile: the bottom sheet covers the lower ~50vh. Passing that as
        // bottom padding biases Mapbox's effective center into the visible
        // top half so the new place isn't hidden behind the sheet. Desktop
        // already has padding: { right: 440 } set by openSidebar's easeTo,
        // so we leave padding alone there and let that state persist.
        if (window.innerWidth <= 640) {
          flyOpts.padding = {
            top: 0,
            right: 0,
            bottom: Math.round(window.innerHeight * 0.4),
            left: 0,
          };
        }
        map.flyTo(flyOpts);
      }
      openSidebar(id);
    });
  });
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const wasOpen = sidebar.classList.contains('is-open');
  // Drop the expanded state BEFORE the close transform so the sheet animates
  // out from its current height — the next openSidebar() starts collapsed.
  sidebar.classList.remove('is-expanded');
  sidebar.style.transform = '';
  sidebar.classList.remove('is-open');
  sidebar.setAttribute('aria-hidden', 'true');
  if (selectedId !== null) {
    map.setFeatureState(
      { source: 'places', sourceLayer: 'nyc_places', id: selectedId },
      { selected: false }
    );
    selectedId = null;
  }
  selectedPlaceId = null;
  for (const id of connectedIds) {
    map.setFeatureState(
      { source: 'places', sourceLayer: 'nyc_places', id },
      { connected: false }
    );
  }
  connectedIds.clear();
  clearKindredLines();
  clearSecondTierLines();
  const tierBtn = document.getElementById('second-tier-toggle');
  if (tierBtn) tierBtn.style.display = 'none';
  if (map) {
  unfadeMain();
  if (wasOpen) map.easeTo({ padding: { right: 0 }, duration: 250 });
  }
  map.setConfigProperty('basemap', 'transition', { duration: 300, delay: 0 });
  map.setPaintProperty('faded-overlay', 'background-opacity', 0, { duration: 300 });
}

async function initMap() {
  const bounds = [
  [-74.259, 40.477], // Southwest coordinates (e.g., New York area)
  [-73.700, 40.917]  // Northeast coordinates
  ];

  mapboxgl.accessToken = MAPBOX_TOKEN;
  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/jpiac/cmpekflsk003801s3f6ky6n8y',
    center: [-73.98, 40.7],
    zoom: 10,
    pitch: 40,
    minZoom: 10,
    maxBounds: bounds,
  });
  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

  showLoading('Loading New York City...');
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
  window.setSelected = setSelected;
  window.featuresById = featuresById;
  window.drawKindredLines = drawKindredLines;
  window.clearKindredLines = clearKindredLines;
  window.CONSTELLATION_GROUP_COUNT = CONSTELLATION_GROUP_COUNT;
  // Color lookups for narrative.js's kindred card dot swatches.
  window.COLOR_BY_TYPE = COLOR_BY_TYPE;
  window.COLOR_DEFAULT = COLOR_DEFAULT;
  // narrative.js calls these to free the 20 constellation sub-layers +
  // duplicate geojson source after the intro finishes (and to re-add them
  // on replay). Removing them frees a sizable chunk of Mapbox tile state.
  window.addConstellationLayers = addConstellationLayers;
  window.removeConstellationLayers = removeConstellationLayers;

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

  // Stash the geojson for the constellation setup/teardown helpers (they
  // re-use it on replay without going back to the network).
  geojsonData = geojson;

  map.addSource('places', {
  type: 'vector',
  url: 'mapbox://jpiac.6vmp9rv4',
  promoteId: { 'nyc_places': 'id' },
  });

  // Add the constellation source/layers only if the narrative is going to
  // play this session — return visitors don't need 20 hidden layers eating
  // tile state and a duplicate geojson copy. narrative.js calls
  // window.addConstellationLayers on replay to bring them back.
  let narrativeSeen = false;
  try { narrativeSeen = localStorage.getItem('narrative_seen') === 'true'; } catch (e) {}
  if (!narrativeSeen) {
    addConstellationLayers(map);
  }

  // Main interactive places layer
  map.addLayer({
    id: 'places-circles-main',
    type: 'circle',
    source: 'places',
    'source-layer': 'nyc_places',
    slot: 'top',
    filter: ['match', ['get', 'osm_type'],
  ['cafe', 'bar', 'pub', 'library', 'community_centre',
   'social_facility', 'hackerspace', 'social_club',
   'arts_centre', 'theatre', 'cinema', 'music_venue', 'nightclub',
   'museum', 'gallery', 'park', 'garden', 'playground',
   'sports_centre', 'fitness_centre', 'swimming_pool',
   'books', 'records', 'hairdresser', 'beauty', 'tattoo',
   'bakery', 'deli', 'laundry', 'coffee',
   'place_of_worship',
   'dance', 'amusement_arcade', 'bowling_alley',
   'marketplace', 'memorial', 'monument', 'artwork',
   'attraction', 'viewpoint'], true, false],
    paint: {
      'circle-color': buildColorExpression(),
      'circle-radius': [
        'interpolate', ['linear'],
        ['zoom'],
        10,
        [
          'interpolate', ['linear'],
          ['coalesce', ['to-number', ['get', 'review_count']], 0],
          0, 1,
          1000, 2,
        ],
        15,
        [
          'interpolate', ['linear'],
          ['coalesce', ['to-number', ['get', 'review_count']], 0],
          0, 4,
          1000, 9,
        ]
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
        10, 0.2,
        15, 1.5,
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

  // Second-tier kindred overlay — sits beneath the first-tier (connected)
  // and selected overlays so first-tier dots always read as the strongest
  // signal. Slightly smaller circles + thinner stroke than the first-tier
  // overlay, per the spec.
  map.addLayer({
    id: 'places-circles-second-tier-overlay',
    type: 'circle',
    source: 'places',
    'source-layer': 'nyc_places',
    filter: ['match', ['get', 'osm_type'],
  ['cafe', 'bar', 'pub', 'library', 'community_centre',
   'social_facility', 'hackerspace', 'social_club',
   'arts_centre', 'theatre', 'cinema', 'music_venue', 'nightclub',
   'museum', 'gallery', 'park', 'garden', 'playground',
   'sports_centre', 'fitness_centre', 'swimming_pool',
   'books', 'records', 'hairdresser', 'beauty', 'tattoo',
   'bakery', 'deli', 'laundry', 'coffee',
   'place_of_worship',
   'dance', 'amusement_arcade', 'bowling_alley',
   'marketplace', 'memorial', 'monument', 'artwork',
   'attraction', 'viewpoint'], true, false],
    paint: {
      'circle-color': buildColorExpression(),
      'circle-radius': [
        'interpolate', ['linear'],
        ['coalesce', ['to-number', ['get', 'review_count']], 0],
        0, 4,
        1000, 8,
      ],
      'circle-emissive-strength': 1,
      'circle-opacity': [
        'case',
        ['boolean', ['feature-state', 'second_connected'], false], 0.5,
        0,
      ],
      // Matches the arc draw duration in drawSecondTierLines so dot
      // fade-in tracks the arc's progress and both complete together.
      'circle-opacity-transition': { duration: 1500, delay: 0 },
      'circle-stroke-color': [
        'case',
        ['match', ['get', 'osm_type'],
          ['community_centre', 'social_facility'], true, false],
        'rgba(0,0,0,0.5)',
        'rgba(255,255,255,0.85)',
      ],
      'circle-stroke-width': [
        'case',
        ['boolean', ['feature-state', 'second_connected'], false], 1,
        0,
      ],
    },
  });

  // Connected places overlay
  map.addLayer({
    id: 'places-circles-connected-overlay',
    type: 'circle',
    source: 'places',
    'source-layer': 'nyc_places',
    filter: ['match', ['get', 'osm_type'],
  ['cafe', 'bar', 'pub', 'library', 'community_centre',
   'social_facility', 'hackerspace', 'social_club',
   'arts_centre', 'theatre', 'cinema', 'music_venue', 'nightclub',
   'museum', 'gallery', 'park', 'garden', 'playground',
   'sports_centre', 'fitness_centre', 'swimming_pool',
   'books', 'records', 'hairdresser', 'beauty', 'tattoo',
   'bakery', 'deli', 'laundry', 'coffee',
   'place_of_worship',
   'dance', 'amusement_arcade', 'bowling_alley',
   'marketplace', 'memorial', 'monument', 'artwork',
   'attraction', 'viewpoint'], true, false],
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
    'source-layer': 'nyc_places',
    filter: ['match', ['get', 'osm_type'],
  ['cafe', 'bar', 'pub', 'library', 'community_centre',
   'social_facility', 'hackerspace', 'social_club',
   'arts_centre', 'theatre', 'cinema', 'music_venue', 'nightclub',
   'museum', 'gallery', 'park', 'garden', 'playground',
   'sports_centre', 'fitness_centre', 'swimming_pool',
   'books', 'records', 'hairdresser', 'beauty', 'tattoo',
   'bakery', 'deli', 'laundry', 'coffee',
   'place_of_worship',
   'dance', 'amusement_arcade', 'bowling_alley',
   'marketplace', 'memorial', 'monument', 'artwork',
   'attraction', 'viewpoint'], true, false],
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

  initMobileSheet();

  function onCircleMouseEnter(e) {
  if (!e.features.length) return;
  if (document.getElementById('narrative-overlay')?.classList.contains('is-interactive')) return;
  map.getCanvas().style.cursor = 'pointer';
  const id = e.features[0].properties.id; // use properties.id not feature.id
  if (hoveredId !== null && hoveredId !== id) {
    map.setFeatureState(
      { source: 'places', sourceLayer: 'nyc_places', id: hoveredId },
      { hover: false }
    );
  }
  hoveredId = id;
  map.setFeatureState(
    { source: 'places', sourceLayer: 'nyc_places', id: hoveredId },
    { hover: true }
  );
}

function onCircleMouseLeave() {
  map.getCanvas().style.cursor = '';
  if (hoveredId !== null) {
    map.setFeatureState(
      { source: 'places', sourceLayer: 'nyc_places', id: hoveredId },
      { hover: false }
    );
    hoveredId = null;
  }
}

  function onCircleClick(e) {
  if (!e.features.length) return;
  if (document.getElementById('narrative-overlay') && 
      document.getElementById('narrative-overlay').classList.contains('is-interactive')) return;
  const priorityHits = map.queryRenderedFeatures(e.point, {
    layers: [
      'places-circles-selected-overlay',
      'places-circles-connected-overlay',
      'places-circles-second-tier-overlay',
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
    'places-circles-second-tier-overlay',
    'places-circles-selected-overlay'].forEach(layer => {
    map.on('mouseenter', layer, onCircleMouseEnter);
    map.on('mouseleave', layer, onCircleMouseLeave);
    map.on('click', layer, onCircleClick);
  });

  // Click on empty map area → deselect
  map.on('click', (e) => {
    if (selectedId === null) return;
    if (document.getElementById('narrative-overlay') && 
      document.getElementById('narrative-overlay').classList.contains('is-interactive')) return;
    const hits = map.queryRenderedFeatures(e.point, {
      layers: [
        'places-circles-selected-overlay',
        'places-circles-connected-overlay',
        'places-circles-second-tier-overlay',
        'places-circles-main',
      ]
    });
    if (hits.length === 0) closeSidebar();
  });

  map.on('error', (e) => {
    console.error('Mapbox error:', e && e.error ? e.error : e);
  });
}

function toggleAbout() {
  const panel = document.getElementById('about-panel');
  if (!panel) return;
  const isOpen = panel.classList.contains('is-open');
  panel.classList.toggle('is-open');
  panel.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
}
window.toggleAbout = toggleAbout;

// Click anywhere outside the open panel (and not on the open-button)
// closes it. Mapbox's map.on('click') handles its own canvas-clicks
// separately, so this and the deselect logic don't collide.
document.addEventListener('click', (e) => {
  const panel = document.getElementById('about-panel');
  const btn = document.getElementById('about-btn');
  if (panel && panel.classList.contains('is-open')) {
    if (!panel.contains(e.target) && e.target !== btn) {
      panel.classList.remove('is-open');
      panel.setAttribute('aria-hidden', 'true');
    }
  }
});

function initUI() {
  document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
  });
  document.getElementById('sidebar-content').innerHTML =
    '<p class="empty-state">Click any point on the map to explore a place.</p>';
  // Wire the About panel's close (X) button.
  const aboutClose = document.getElementById('about-close');
  if (aboutClose) aboutClose.addEventListener('click', toggleAbout);
}

if (!MAPBOX_TOKEN) {
  showError('Set MAPBOX_TOKEN at the top of main.js before loading.');
} else {
  initUI();
  initMap();
}
