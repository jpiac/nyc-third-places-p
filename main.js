const MAPBOX_TOKEN = 'pk.eyJ1IjoianBpYWMiLCJhIjoiY21wZzNpazdvMGRlbzJxcHF1aXJ3cGNqMiJ9.G5Sxa6-8vxshvOvIWZwgkA'; // ← fill in your token here

const DATA_URL = './data/nyc_final.json';
const TOP_KINDRED = 8;

const FORMSPREE_URL = 'https://formspree.io/f/xlgvpgza';
let feedbackPlaceId = null;
let feedbackPlaceName = null;

function openFeedbackModal(placeId, placeName) {
  feedbackPlaceId = placeId || null;
  feedbackPlaceName = placeName || null;
  const modal = document.getElementById('feedback-modal');
  const title = document.getElementById('feedback-modal-title');
  const subtitle = document.getElementById('feedback-modal-subtitle');
  const success = document.getElementById('feedback-success');
  const textarea = document.getElementById('feedback-text');
  const submitBtn = document.getElementById('feedback-submit-btn');
  if (placeId && placeName) {
    title.textContent = 'Report an Issue';
    subtitle.textContent = placeName;
  } else {
    title.textContent = 'Share Feedback';
    subtitle.textContent = 'Help us improve the Third Places map.';
  }
  textarea.value = '';
  success.style.display = 'none';
  submitBtn.style.display = '';
  submitBtn.disabled = false;
  submitBtn.textContent = 'Submit';
  const cancelBtn = document.querySelector('.feedback-cancel-btn');
  if (cancelBtn) cancelBtn.textContent = 'Cancel';
  modal.setAttribute('aria-hidden', 'false');
  modal.classList.add('is-open');
  setTimeout(() => textarea.focus(), 100);
}
window.openFeedbackModal = openFeedbackModal;

function closeFeedbackModal() {
  const modal = document.getElementById('feedback-modal');
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
}
window.closeFeedbackModal = closeFeedbackModal;

async function submitFeedback() {
  const text = document.getElementById('feedback-text').value.trim();
  if (!text) return;
  const submitBtn = document.getElementById('feedback-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';
  const payload = {
    message: text,
    type: feedbackPlaceId ? 'place' : 'general',
    place_id: feedbackPlaceId || '',
    place_name: feedbackPlaceName || '',
    url: window.location.href,
  };
  try {
    const res = await fetch(FORMSPREE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      document.getElementById('feedback-success').style.display = 'block';
      submitBtn.style.display = 'none';
      document.querySelector('.feedback-cancel-btn').textContent = 'Close';
    } else {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Try again';
    }
  } catch (e) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Try again';
  }
}
window.submitFeedback = submitFeedback;

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('feedback-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeFeedbackModal();
    });
  }
});

const COLOR_BY_TYPE = {
  cafe: '#00a2ff',
  bar: '#E07A5F',
  pub: '#E07A5F',
  library: '#81B29A',
  community_centre: '#F2CC8F',
  social_facility: '#F2CC8F',
  hackerspace: '#A8DADC',
  social_club: '#A8DADC',
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
const COLOR_DEFAULT = '#2d7ac8';

const ATMOSPHERE_LABELS = {
  outdoor_seating: 'outdoor seating',
  live_music: 'live music',
  good_for_groups: 'good for groups',
  serves_coffee: 'serves coffee',
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
};

const NON_BUILDING_TYPES = new Set([
  'park', 'garden', 'playground', 'dog_park', 'nature_reserve',
  'pitch', 'outdoor_seating', 'square',
  'memorial', 'monument', 'artwork', 'fountain', 'bench',
  'viewpoint', 'shelter', 'attraction', 'zoo', 'aquarium',
  'antiques', 'art', 'chocolate', 'craft', 'florist',
  'ice_cream', 'musical_instrument', 'pastry', 'tea',
  'public_bookcase',
]);

function formatOsmType(type) {
  return OSM_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

let map;
let featuresById = new Map();
let pidToSourceId = new Map();
let hoveredId = null;
let selectedId = null;
let selectedPlaceId = null;
let connectedIds = new Set();
let secondConnectedIds = new Set();
let deckInstance;
let arcAnimFrame = null;
let secondTierAnimFrame = null;
let unfadeMainAnimFrame = null;
let secondTierDelayTimer = null;
let firstTierLineData = [];
let secondTierLineData = [];
let showSecondTier = false;
const CONSTELLATION_GROUP_COUNT = 20;
let geojsonData = null;
let selectedBuilding = null;
let connectionView = false;
let connectionSourceId = null;
let connectionTargetId = null;
let hoveredArcSourceId = null;
let hoveredArcTargetId = null;

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
const FILTER_OPACITY_EXPR = [
  'case',
  ['boolean', ['feature-state', 'filter_matched'], false], 0.9,
  0.1,
];

const PLACES_STROKE_DAY = [
  'case',
  ['boolean', ['feature-state', 'selected'], false], '#1a1a1a',
  ['boolean', ['feature-state', 'hover'], false], 'rgba(0,0,0,0.55)',
  'rgba(255,255,255,0.85)',
];
const PLACES_STROKE_NIGHT = [
  'case',
  ['boolean', ['feature-state', 'selected'], false], 'rgba(255,255,255,0.95)',
  ['boolean', ['feature-state', 'hover'], false], 'rgba(255,255,255,0.85)',
  'rgba(10,10,18,0.6)',
];

let activeFilterTag = null;
let activeFilterLabel = null;
let filterMatchIds = new Set();
let filterTypeFilter = 'all';
let filterBoroughFilter = 'all';

let fuseIndex = null;
let searchQuery = '';
let searchTypeFilter = '';
let searchBoroughFilter = '';
let searchTagFilter = '';
let searchActive = false;

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

const RAINBOW_SVG = "<svg viewBox='0 0 18 18' width='14' height='14'><rect y='2' width='18' height='2.3' fill='#FF0018'/><rect y='4.6' width='18' height='2.3' fill='#FFA52C'/><rect y='6.9' width='18' height='2.3' fill='#FFFF41'/><rect y='9.2' width='18' height='2.3' fill='#008018'/><rect y='11.5' width='18' height='2.3' fill='#0000F9'/><rect y='13.8' width='18' height='2.3' fill='#86007D'/></svg>";
const RAINBOW_SMALL_SVG = "<svg viewBox='0 0 18 18' width='12' height='12'><rect y='2' width='18' height='2.3' fill='#FF0018'/><rect y='4.6' width='18' height='2.3' fill='#FFA52C'/><rect y='6.9' width='18' height='2.3' fill='#FFFF41'/><rect y='9.2' width='18' height='2.3' fill='#008018'/><rect y='11.5' width='18' height='2.3' fill='#0000F9'/><rect y='13.8' width='18' height='2.3' fill='#86007D'/></svg>";
const TRANS_SVG = "<svg viewBox='0 0 18 18' width='14' height='14' fill='none' stroke='currentColor' stroke-width='1.5'><circle cx='9' cy='7' r='4'/><line x1='9' y1='11' x2='9' y2='16'/><line x1='6' y1='13.5' x2='12' y2='13.5'/><line x1='6' y1='16' x2='12' y2='16'/></svg>";
const WOMEN_SVG = "<svg viewBox='0 0 18 18' width='14' height='14' fill='none' stroke='currentColor' stroke-width='1.5'><circle cx='9' cy='7' r='5'/><line x1='9' y1='12' x2='9' y2='17'/><line x1='6' y1='15' x2='12' y2='15'/></svg>";
const FIST_SVG = "<svg viewBox='0 0 18 18' width='14' height='14' fill='currentColor'><rect x='5' y='8' width='8' height='7' rx='1'/><rect x='5' y='5' width='2.5' height='5' rx='1'/><rect x='7.5' y='4' width='2.5' height='6' rx='1'/><rect x='10' y='5' width='2.5' height='5' rx='1'/></svg>";
const WHEELCHAIR_SVG = "<svg viewBox='0 0 18 18' width='14' height='14' fill='currentColor'><circle cx='9' cy='2.5' r='1.8'/><path d='M7 6h2.5l1.5 4H14v1.5h-4l-1-3H7V6z'/><path d='M6 9.5C4.3 9.5 3 10.8 3 12.5S4.3 15.5 6 15.5s3-1.3 3-3'/></svg>";
const PERSON_SVG = "<svg viewBox='0 0 18 18' width='14' height='14' fill='none' stroke='currentColor' stroke-width='1.5'><circle cx='9' cy='5' r='3'/><path d='M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6'/><line x1='9' y1='11' x2='9' y2='14'/><line x1='7' y1='16' x2='11' y2='16'/></svg>";
const STAR_SVG = "<svg viewBox='0 0 18 18' width='14' height='14' fill='none' stroke='currentColor' stroke-width='1.5'><path d='M9 2l1.8 5.4H17l-4.9 3.6 1.8 5.4L9 13l-4.9 3.4 1.8-5.4L1 7.4h6.2z'/></svg>";
const RELIGION_SVG = "<svg viewBox='0 0 18 18' width='14' height='14' fill='none' stroke='currentColor' stroke-width='1.5'><path d='M9 2v14M3 7h12'/></svg>";

const SKIPPED_RELIGIONS = new Set(['none', 'ethical', 'pagan', 'mue']);

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

  const pill = (svg, label, tagKey) => {
    const attrs = tagKey
      ? ' data-filter-tag="' + escapeHtml(tagKey) +
        '" data-filter-label="' + escapeHtml(label) + '"'
      : '';
    const activeCls = (tagKey && activeFilterTag === tagKey) ? ' is-active' : '';
    return '<div class="vibe-community-tag' + activeCls + '"' + attrs + '>' +
      svg + '<span>' + escapeHtml(label) + '</span></div>';
  };

  const communityTags = [];

  const lgbtqOwned =
    community.lgbtq_primary === true || community.dfs_lgbtq_owned === true;
  const lgbtqWelcoming =
    community.lgbtq_friendly === true || community.dfs_lgbtq_welcoming === true;
  if (lgbtqOwned) communityTags.push(pill(RAINBOW_SVG, 'LGBTQ+ Owned', 'lgbtq_owned'));
  if (lgbtqWelcoming && !lgbtqOwned) {
    communityTags.push(pill(RAINBOW_SMALL_SVG, 'LGBTQ+ Welcoming', 'lgbtq_welcoming'));
  }
  if (community.dfs_transgender_safe === true) {
    communityTags.push(pill(TRANS_SVG, 'Transgender Safe Space', 'dfs_transgender_safe'));
  }
  if (community.dfs_women_owned === true) {
    communityTags.push(pill(WOMEN_SVG, 'Women-Owned', 'dfs_women_owned'));
  }
  if (community.dfs_asian_owned === true) {
    communityTags.push(pill(FIST_SVG, 'Asian-Owned', 'dfs_asian_owned'));
  }
  if (community.dfs_indigenous_owned === true) {
    communityTags.push(pill(FIST_SVG, 'Indigenous-Owned', 'dfs_indigenous_owned'));
  }
  if (community.dfs_wheelchair_accessible === true) {
    communityTags.push(pill(WHEELCHAIR_SVG, 'Wheelchair Accessible', 'dfs_wheelchair_accessible'));
  }

  const forCommunity = String(community.for_community || '').toLowerCase();
  const isSenior =
    community.facdb_category === 'senior_center' ||
    forCommunity.includes('senior');
  const isYouth =
    community.facdb_category === 'youth_services' ||
    forCommunity.includes('child') ||
    forCommunity.includes('juvenile');
  if (isSenior) communityTags.push(pill(PERSON_SVG, 'Senior Center', 'senior_center'));
  if (isYouth) communityTags.push(pill(PERSON_SVG, 'Youth Services', 'youth_services'));

  if (community.operator_type === 'ngo' ||
      community.operator_type === 'private_non_profit') {
    communityTags.push(pill(STAR_SVG, 'Non-profit', 'nonprofit'));
  }

  const religion = String(community.religion || '').toLowerCase().trim();
  if (religion && !SKIPPED_RELIGIONS.has(religion)) {
    const label = religion.charAt(0).toUpperCase() + religion.slice(1);
    communityTags.push(pill(RELIGION_SVG, label, 'religion:' + religion));
  }

  if (items.length === 0 && communityTags.length === 0) return '';

  return (
    '<div class="section-title">Vibe</div>' +
    '<div class="vibe-chart">' +
      '<div class="vibe-grid">' + items.join('') + '</div>' +
      (communityTags.length
        ? '<div class="section-title">Community</div>' +
          '<div class="vibe-community">' + communityTags.join('') + '</div>'
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

function buildFirstTierLayers(lineData) {
  return [
    new deck.LineLayer({
      id: 'kindred-arcs-glow',
      data: lineData,
      getSourcePosition: (d) => d.path[0],
      getTargetPosition: (d) => d.path[1],
      getColor: (d) => {
        const isHovered = hoveredArcSourceId === d.sourceId &&
                          hoveredArcTargetId === d.targetId;
        return isHovered
          ? [255, 255, 255, 120]
          : [d.color[0], d.color[1], d.color[2], 60];
      },
      getWidth: (d) => {
        const isHovered = hoveredArcSourceId === d.sourceId &&
                          hoveredArcTargetId === d.targetId;
        return isHovered ? 10 : 5;
      },
      widthUnits: 'pixels',
      pickable: true,
      updateTriggers: {
        getColor: [hoveredArcSourceId, hoveredArcTargetId],
        getWidth: [hoveredArcSourceId, hoveredArcTargetId],
      },
      parameters: {
        blendColorSrcFactor: 0x0302,
        blendColorDstFactor: 1,
        blendAlphaSrcFactor: 1,
        blendAlphaDstFactor: 1,
      },
    }),
    new deck.LineLayer({
      id: 'kindred-arcs',
      data: lineData,
      getSourcePosition: (d) => d.path[0],
      getTargetPosition: (d) => d.path[1],
      getColor: (d) => {
        const isHovered = hoveredArcSourceId === d.sourceId &&
                          hoveredArcTargetId === d.targetId;
        return isHovered
          ? [Math.min(255, d.color[0] + 80), Math.min(255, d.color[1] + 80), Math.min(255, d.color[2] + 80), 255]
          : d.color;
      },
      getWidth: (d) => {
        const isHovered = hoveredArcSourceId === d.sourceId &&
                          hoveredArcTargetId === d.targetId;
        return isHovered ? 4 : 2.5;
      },
      widthUnits: 'pixels',
      pickable: true,
      updateTriggers: {
        getColor: [hoveredArcSourceId, hoveredArcTargetId],
        getWidth: [hoveredArcSourceId, hoveredArcTargetId],
      },
      parameters: {
        blendColorSrcFactor: 0x0302,
        blendColorDstFactor: 1,
        blendAlphaSrcFactor: 1,
        blendAlphaDstFactor: 1,
      },
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
      getColor: (d) => {
        const isHovered = hoveredArcSourceId === d.sourceId &&
                          hoveredArcTargetId === d.targetId;
        return isHovered
          ? [255, 255, 255, 100]
          : [d.color[0], d.color[1], d.color[2], 60];
      },
      getWidth: (d) => {
        const isHovered = hoveredArcSourceId === d.sourceId &&
                          hoveredArcTargetId === d.targetId;
        return isHovered ? 8 : 3;
      },
      widthUnits: 'pixels',
      pickable: true,
      updateTriggers: {
        getColor: [hoveredArcSourceId, hoveredArcTargetId],
        getWidth: [hoveredArcSourceId, hoveredArcTargetId],
      },
      parameters: {
        blendColorSrcFactor: 0x0302,
        blendColorDstFactor: 1,
        blendAlphaSrcFactor: 1,
        blendAlphaDstFactor: 1,
      },
    }),
    new deck.LineLayer({
      id: 'kindred-arcs-second',
      data: lineData,
      getSourcePosition: (d) => d.path[0],
      getTargetPosition: (d) => d.path[1],
      getColor: (d) => {
        const isHovered = hoveredArcSourceId === d.sourceId &&
                          hoveredArcTargetId === d.targetId;
        return isHovered
          ? [Math.min(255, d.color[0] + 80), Math.min(255, d.color[1] + 80), Math.min(255, d.color[2] + 80), 255]
          : [d.color[0], d.color[1], d.color[2], 220];
      },
      getWidth: (d) => {
        const isHovered = hoveredArcSourceId === d.sourceId &&
                          hoveredArcTargetId === d.targetId;
        return isHovered ? 3 : 1.5;
      },
      widthUnits: 'pixels',
      pickable: true,
      updateTriggers: {
        getColor: [hoveredArcSourceId, hoveredArcTargetId],
        getWidth: [hoveredArcSourceId, hoveredArcTargetId],
      },
      parameters: {
        blendColorSrcFactor: 0x0302,
        blendColorDstFactor: 1,
        blendAlphaSrcFactor: 1,
        blendAlphaDstFactor: 1,
      },
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
      sourceColor: [...sourceColor, 255],
      targetColor: [...destColor, 255],
      sourceId: placeId,
      targetId: id,
    };
  }).filter(Boolean);

  if (segments.length === 0) {
    firstTierLineData = [];
    renderArcs();
    return;
  }

  const ARC_POINTS = 40;
  const ARC_HEIGHT = 0.3;
  const DURATION = 1500;
  const PAINT_THROTTLE_MS = 33;
  const startTime = performance.now();
  let lastPaintUpdate = 0;

  const arcPaths = segments.map((seg) => ({
    points: sampleArc(seg.from, seg.to, ARC_HEIGHT, ARC_POINTS),
    sourceColor: seg.sourceColor,
    targetColor: seg.targetColor,
    sourceId: seg.sourceId,
    targetId: seg.targetId,
  }));

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
        const segT = i / (ARC_POINTS - 1);
        const color = interpolateColorRgb(arc.sourceColor, arc.targetColor, segT);
        lineData.push({
          path: [visiblePoints[i], visiblePoints[i + 1]],
          color,
          sourceId: arc.sourceId,
          targetId: arc.targetId,
        });
      }
    });
    firstTierLineData = lineData;
    renderArcs();

    // Throttled literal paint update — no per-frame case expression
    if (now - lastPaintUpdate >= PAINT_THROTTLE_MS) {
      lastPaintUpdate = now;
      try {
        map.setPaintProperty('places-circles-connected-overlay', 'circle-opacity', [
          'case', ['boolean', ['feature-state', 'connected'], false], eased, 0,
        ]);
        map.setPaintProperty('places-circles-connected-overlay', 'circle-stroke-width', [
          'case', ['boolean', ['feature-state', 'connected'], false], eased * 1.5, 0,
        ]);
      } catch (e) {}
    }

    if (t < 1) {
      arcAnimFrame = requestAnimationFrame(frame);
    } else {
      arcAnimFrame = null;
      try {
        map.setPaintProperty('places-circles-connected-overlay', 'circle-opacity', [
          'case', ['boolean', ['feature-state', 'connected'], false], 1, 0,
        ]);
        map.setPaintProperty('places-circles-connected-overlay', 'circle-stroke-width', [
          'case', ['boolean', ['feature-state', 'connected'], false], 1.5, 0,
        ]);
        map.setPaintProperty('places-circles-connected-overlay', 'circle-opacity-transition', { duration: 400, delay: 0 });
      } catch (e) {}
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
  if (secondTierAnimFrame !== null) {
    cancelAnimationFrame(secondTierAnimFrame);
    secondTierAnimFrame = null;
  }
  if (secondTierDelayTimer !== null) {
    clearTimeout(secondTierDelayTimer);
    secondTierDelayTimer = null;
  }
  resetSecondConnectedFeatureStates();

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
        sourceColor: [...firstColor, 245],
        targetColor: [...secondColor, 245],
        sourceId: firstId,
        targetId: secondId,
      });
      destSourceIds.push(secondId);
    }
  }

  if (segments.length === 0) return;

  const ARC_POINTS = 40;
  const ARC_HEIGHT = 0.2;
  const DURATION = 1500;
  const START_DELAY_MS = 50;
  const PAINT_THROTTLE_MS = 33;

  const arcPaths = segments.map((seg) => ({
    points: sampleArc(seg.from, seg.to, ARC_HEIGHT, ARC_POINTS),
    sourceColor: seg.sourceColor,
    targetColor: seg.targetColor,
    sourceId: seg.sourceId,
    targetId: seg.targetId,
  }));

  secondTierDelayTimer = setTimeout(() => {
    secondTierDelayTimer = null;
    try {
      map.setPaintProperty('places-circles-second-tier-overlay', 'circle-opacity-transition', { duration: 0, delay: 0 });
      map.setPaintProperty('places-circles-second-tier-overlay', 'circle-opacity', 0);
      map.setPaintProperty('places-circles-second-tier-overlay', 'circle-stroke-width', 0);
    } catch (e) {}

    for (const id of destSourceIds) {
      map.setFeatureState({ source: 'places', sourceLayer: 'nyc_places', id }, { second_connected: true });
      secondConnectedIds.add(id);
    }

    const startTime = performance.now();
    let lastPaintUpdate = 0;

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
          const segT = i / (ARC_POINTS - 1);
          const color = interpolateColorRgb(arc.sourceColor, arc.targetColor, segT);
          lineData.push({
            path: [visiblePoints[i], visiblePoints[i + 1]],
            color,
            sourceId: arc.sourceId,
            targetId: arc.targetId,
          });
        }
      });
      secondTierLineData = lineData;
      renderArcs();

      // Throttled literal paint update — no per-frame case expression
      if (now - lastPaintUpdate >= PAINT_THROTTLE_MS) {
        lastPaintUpdate = now;
        try {
          map.setPaintProperty('places-circles-second-tier-overlay', 'circle-opacity', [
            'case', ['boolean', ['feature-state', 'second_connected'], false], eased * 0.7, 0,
          ]);
          map.setPaintProperty('places-circles-second-tier-overlay', 'circle-stroke-width', [
            'case', ['boolean', ['feature-state', 'second_connected'], false], eased * 1.0, 0,
          ]);
        } catch (e) {}
      }

      if (t < 1) {
        secondTierAnimFrame = requestAnimationFrame(frame);
      } else {
        secondTierAnimFrame = null;
        try {
          map.setPaintProperty('places-circles-second-tier-overlay', 'circle-opacity', [
            'case', ['boolean', ['feature-state', 'second_connected'], false], 0.7, 0,
          ]);
          map.setPaintProperty('places-circles-second-tier-overlay', 'circle-stroke-width', [
            'case', ['boolean', ['feature-state', 'second_connected'], false], 1.0, 0,
          ]);
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
  if (secondTierDelayTimer !== null) {
    clearTimeout(secondTierDelayTimer);
    secondTierDelayTimer = null;
  }
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
  clearSecondTierLines();
}

function toggleSecondTier() {
  showSecondTier = !showSecondTier;
  window.showSecondTier = showSecondTier;
  const btn = document.getElementById('second-tier-toggle');
  if (btn) btn.classList.toggle('is-active', showSecondTier);

  if (!showSecondTier) {
    if (activeFilterTag) {
      clearKindredLines();
    } else {
      clearSecondTierLines();
    }
    return;
  }
  if (!selectedPlaceId) return;
  if (activeFilterTag) {
    drawFilterLines(selectedPlaceId);
    return;
  }
  const place = featuresById.get(selectedPlaceId);
  if (!place || !Array.isArray(place.similarity_ids)) return;
  drawSecondTierLines(place.similarity_ids.slice(0, TOP_KINDRED));
}
window.toggleSecondTier = toggleSecondTier;
window.showSecondTier = showSecondTier;

// ---------- Community tag filter mode ----------

function matchesFilterTag(place, tagKey) {
  const c = place.community_tags || {};
  if (tagKey === 'lgbtq_owned') {
    return c.lgbtq_primary === true || c.dfs_lgbtq_owned === true;
  }
  if (tagKey === 'lgbtq_welcoming') {
    return c.lgbtq_friendly === true || c.dfs_lgbtq_welcoming === true;
  }
  if (tagKey === 'senior_center') {
    const fc = String(c.for_community || '').toLowerCase();
    return c.facdb_category === 'senior_center' || fc.includes('senior');
  }
  if (tagKey === 'youth_services') {
    const fc = String(c.for_community || '').toLowerCase();
    return c.facdb_category === 'youth_services' ||
      fc.includes('child') || fc.includes('juvenile');
  }
  if (tagKey === 'nonprofit') {
    return c.operator_type === 'ngo' || c.operator_type === 'private_non_profit';
  }
  if (tagKey.startsWith('religion:')) {
    const want = tagKey.slice('religion:'.length);
    return String(c.religion || '').toLowerCase().trim() === want;
  }
  return c[tagKey] === true;
}

function getPlacesForTag(tagKey) {
  const result = [];
  for (const place of featuresById.values()) {
    if (matchesFilterTag(place, tagKey)) result.push(place);
  }
  return result;
}

function setFilterMatchedState(ids, value) {
  if (!map) return;
  for (const id of ids) {
    try {
      map.setFeatureState(
        { source: 'places', sourceLayer: 'nyc_places', id },
        { filter_matched: value }
      );
    } catch (e) {}
  }
}

function enterFilterMode(tagKey, tagLabel) {
  if (activeFilterTag === tagKey) {
    exitFilterMode();
    return;
  }
  if (activeFilterTag) {
    setFilterMatchedState(filterMatchIds, false);
    filterMatchIds.clear();
  }

  activeFilterTag = tagKey;
  activeFilterLabel = tagLabel;
  filterTypeFilter = 'all';
  filterBoroughFilter = 'all';

  for (const place of getPlacesForTag(tagKey)) {
    filterMatchIds.add(place.id);
  }
  setFilterMatchedState(filterMatchIds, true);

  if (map) {
    try {
      map.setPaintProperty('places-circles-main', 'circle-opacity', FILTER_OPACITY_EXPR);
    } catch (e) {}
  }

  clearKindredLines();
  if (map) {
    for (const id of connectedIds) {
      try {
        map.setFeatureState(
          { source: 'places', sourceLayer: 'nyc_places', id },
          { connected: false }
        );
      } catch (e) {}
    }
    connectedIds.clear();
  }

  if (selectedPlaceId) {
    openSidebar(selectedPlaceId);
    if (showSecondTier) drawFilterLines(selectedPlaceId);
  }
}

function exitFilterMode(rerender = true) {
  if (!activeFilterTag) return;

  setFilterMatchedState(filterMatchIds, false);
  filterMatchIds.clear();
  activeFilterTag = null;
  activeFilterLabel = null;
  filterTypeFilter = 'all';
  filterBoroughFilter = 'all';

  if (map) {
    try {
      map.setPaintProperty(
        'places-circles-main',
        'circle-opacity',
        selectedPlaceId ? SELECTION_OPACITY_EXPR : DEFAULT_OPACITY_EXPR
      );
    } catch (e) {}
  }

  clearKindredLines();

  if (rerender && selectedPlaceId) {
    openSidebar(selectedPlaceId);
  }
}

window.exitFilterModeFromUI = function () {
  exitFilterMode(true);
};

function drawFilterLines(placeId) {
  if (!deckInstance) return;
  const source = featuresById.get(placeId);
  if (!source || !Array.isArray(source.coordinates)) return;

  if (arcAnimFrame !== null) {
    cancelAnimationFrame(arcAnimFrame);
    arcAnimFrame = null;
  }
  clearSecondTierLines();

  const sLng = source.coordinates[0];
  const sLat = source.coordinates[1];
  const candidates = [];
  for (const id of filterMatchIds) {
    if (id === placeId) continue;
    const dest = featuresById.get(id);
    if (!dest || !Array.isArray(dest.coordinates)) continue;
    const dx = dest.coordinates[0] - sLng;
    const dy = dest.coordinates[1] - sLat;
    candidates.push({ dest, dist: dx * dx + dy * dy });
  }
  candidates.sort((a, b) => a.dist - b.dist);
  const top = candidates.slice(0, 50);

  const sourceColor = hexToRgb(COLOR_BY_TYPE[source.osm_type] || COLOR_DEFAULT);
  const segments = top.map(({ dest }) => {
    const destColor = hexToRgb(COLOR_BY_TYPE[dest.osm_type] || COLOR_DEFAULT);
    return {
      from: source.coordinates,
      to: dest.coordinates,
      sourceColor: [...sourceColor, 250],
      targetColor: [...destColor, 250],
    };
  });

  if (segments.length === 0) {
    firstTierLineData = [];
    renderArcs();
    return;
  }

  const ARC_POINTS = 40;
  const ARC_HEIGHT = 0.3;
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
    if (t < 1) {
      arcAnimFrame = requestAnimationFrame(frame);
    } else {
      arcAnimFrame = null;
    }
  }
  arcAnimFrame = requestAnimationFrame(frame);
}

function renderFilterList(places) {
  if (!places.length) {
    return '<div class="filter-empty">No places match these filters.</div>';
  }
  return places.map((p) => {
    const color = COLOR_BY_TYPE[p.osm_type] || COLOR_DEFAULT;
    const meta = formatOsmType(p.osm_type || '') +
      (p.borough ? ' · ' + p.borough : '');
    return (
      '<button class="filter-place-item" data-id="' + escapeHtml(p.id) + '">' +
        '<span class="filter-place-dot" style="background:' + color + '"></span>' +
        '<span class="filter-place-name">' + escapeHtml(p.name || '(unnamed)') + '</span>' +
        '<span class="filter-place-meta">' + escapeHtml(meta) + '</span>' +
      '</button>'
    );
  }).join('');
}

function renderFilterSidebar() {
  const container = document.getElementById('filter-section');
  if (!container) return;

  const all = [];
  for (const id of filterMatchIds) {
    const p = featuresById.get(id);
    if (p) all.push(p);
  }

  const typeSet = new Set();
  for (const p of all) {
    if (p.osm_type) typeSet.add(p.osm_type);
  }
  const typeOpts = ['<option value="all">All types</option>'];
  for (const t of Array.from(typeSet).sort()) {
    const sel = (t === filterTypeFilter) ? ' selected' : '';
    typeOpts.push(
      '<option value="' + escapeHtml(t) + '"' + sel + '>' +
        escapeHtml(formatOsmType(t)) +
      '</option>'
    );
  }

  const boroughs = ['all', 'Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
  const boroughOpts = boroughs.map((b) => {
    const sel = (b === filterBoroughFilter) ? ' selected' : '';
    const label = b === 'all' ? 'All boroughs' : b;
    return '<option value="' + escapeHtml(b) + '"' + sel + '>' + escapeHtml(label) + '</option>';
  }).join('');

  let filtered = all;
  if (filterTypeFilter !== 'all') {
    filtered = filtered.filter((p) => p.osm_type === filterTypeFilter);
  }
  if (filterBoroughFilter !== 'all') {
    filtered = filtered.filter((p) => p.borough === filterBoroughFilter);
  }
  filtered.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
  const display = filtered.slice(0, 100);

  container.innerHTML =
    '<div class="filter-header">' +
      '<div class="filter-title">' +
        '<span class="filter-tag-name">' + escapeHtml(activeFilterLabel || '') + '</span>' +
        '<span class="filter-count">' + filtered.length + ' places</span>' +
      '</div>' +
      '<div class="filter-controls">' +
        '<select class="filter-select" id="filter-type-select">' + typeOpts.join('') + '</select>' +
        '<select class="filter-select" id="filter-borough-select">' + boroughOpts + '</select>' +
        '<button class="filter-done-btn" onclick="exitFilterModeFromUI()">Done</button>' +
      '</div>' +
    '</div>' +
    '<div class="filter-list">' + renderFilterList(display) + '</div>';

  const typeSel = container.querySelector('#filter-type-select');
  if (typeSel) {
    typeSel.addEventListener('change', (e) => {
      filterTypeFilter = e.target.value;
      renderFilterSidebar();
    });
  }
  const boroughSel = container.querySelector('#filter-borough-select');
  if (boroughSel) {
    boroughSel.addEventListener('change', (e) => {
      filterBoroughFilter = e.target.value;
      renderFilterSidebar();
    });
  }

  container.querySelectorAll('.filter-place-item').forEach((btn) => {
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
    sidebar.style.transition = 'none';
  }

  function onMove(e) {
    if (!dragging || startY == null || !e.touches || !e.touches.length) return;
    const dy = e.touches[0].clientY - startY;
    lastDelta = dy;
    if (dy < -50 && !sidebar.classList.contains('is-expanded')) {
      sidebar.classList.add('is-expanded');
    }
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

let lastIsMobileForSheet = window.innerWidth <= 640;
window.addEventListener('resize', () => {
  const isMobile = window.innerWidth <= 640;
  if (isMobile !== lastIsMobileForSheet) {
    lastIsMobileForSheet = isMobile;
    initMobileSheet();
  }
});

// Suppress sidebar transition during window resize so the layout
// shift from desktop (right panel) to mobile (bottom sheet) doesn't
// animate visibly as the sidebar flies across the screen.
let resizeTransitionTimer = null;
window.addEventListener('resize', () => {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.style.transition = 'none';
  if (resizeTransitionTimer) clearTimeout(resizeTransitionTimer);
  resizeTransitionTimer = setTimeout(() => {
    sidebar.style.transition = '';
    resizeTransitionTimer = null;
  }, 150);
});

function applyResponsiveLineVisibility() {
  if (!deckInstance) return;
  const canvas = deckInstance.canvas;
  if (canvas) {
    canvas.style.display = 'block';
  }
}

function unfadeMain() {
  if (unfadeMainAnimFrame !== null) {
    cancelAnimationFrame(unfadeMainAnimFrame);
    unfadeMainAnimFrame = null;
  }
  if (!map) return;
  try {
    map.setPaintProperty('places-circles-main', 'circle-opacity-transition', { duration: 0, delay: 0 });
  } catch (e) {}

  const FROM = 0.1;
  const TO = 0.9;
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
      try {
        map.setPaintProperty('places-circles-main', 'circle-opacity', DEFAULT_OPACITY_EXPR);
        map.setPaintProperty('places-circles-main', 'circle-opacity-transition', { duration: 300, delay: 0 });
      } catch (e) {}
    }
  }
  unfadeMainAnimFrame = requestAnimationFrame(step);
}

async function getBuildingCoordinate(place) {
  const tags = place.osm_tags || {};
  const num = tags['addr:housenumber'];
  const street = tags['addr:street'];
  const city = tags['addr:city'] || 'New York';
  const state = tags['addr:state'] || 'NY';

  if (num && street) {
    const query = encodeURIComponent(`${num} ${street}, ${city}, ${state}`);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json` +
      `?access_token=${MAPBOX_TOKEN}&limit=1&types=address` +
      `&proximity=${place.coordinates[0]},${place.coordinates[1]}`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (json.features && json.features.length > 0) {
        return json.features[0].center;
      }
    } catch (e) {}
  }
  return place.coordinates;
}

let buildingHighlightTimer = null;

async function highlightBuildingAtPlace(place) {
  clearBuildingHighlight();
  if (!map || !place || !Array.isArray(place.coordinates)) return;
  if (NON_BUILDING_TYPES.has(place.osm_type)) return;

  // Cancel any pending highlight from a prior rapid selection
  if (buildingHighlightTimer) {
    clearTimeout(buildingHighlightTimer);
    buildingHighlightTimer = null;
  }

  const color = COLOR_BY_TYPE[place.osm_type] || COLOR_DEFAULT;
  try { map.setConfigProperty('basemap', 'colorBuildingSelect', color); } catch (e) {}

  const coord = await getBuildingCoordinate(place);

  const doQuery = () => {
    if (!selectedPlaceId) return;

    const savedPitch = map.getPitch();
    const savedBearing = map.getBearing();
    const savedCenter = map.getCenter();
    const savedZoom = map.getZoom();

    if (savedPitch > 5) {
      map.jumpTo({ center: coord, zoom: Math.max(savedZoom, 16), pitch: 0, bearing: 0 });
    }

    const point = map.project(coord);
    const bbox = [
      [point.x - 8, point.y - 8],
      [point.x + 8, point.y + 8],
    ];

    try {
      const features = map.queryRenderedFeatures(bbox, {
        target: { featuresetId: 'buildings', importId: 'basemap' },
      });
      if (features.length > 0) {
        selectedBuilding = features[0];
        map.setFeatureState(selectedBuilding, { select: true });
      }
    } catch (e) {}

    if (savedPitch > 5) {
      map.jumpTo({
        center: savedCenter,
        zoom: savedZoom,
        pitch: savedPitch,
        bearing: savedBearing,
      });
    }
  };

  if (!map.isMoving()) {
    doQuery();
  } else {
    map.once('idle', doQuery);
  }
}

function clearBuildingHighlight() {
  if (selectedBuilding && map) {
    try {
      map.setFeatureState(selectedBuilding, { select: false });
    } catch (e) {}
    selectedBuilding = null;
  }
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
  map.setFeatureState(
    { source: 'places', sourceLayer: 'nyc_places', id: placeId },
    { selected: true }
  );
  selectedId = placeId;
  selectedPlaceId = placeId;
  // Highlight the building at this place
  if (place && Array.isArray(place.coordinates)) {
    highlightBuildingAtPlace(place);
  }

  if (!activeFilterTag && place && Array.isArray(place.similarity_ids)) {
    for (const pid of place.similarity_ids.slice(0, TOP_KINDRED)) {
      map.setFeatureState(
        { source: 'places', sourceLayer: 'nyc_places', id: pid },
        { connected: true }
      );
      connectedIds.add(pid);
    }
  }

  if (!activeFilterTag) {
    map.setPaintProperty('places-circles-main', 'circle-opacity', SELECTION_OPACITY_EXPR);
  }
  map.setPaintProperty('faded-overlay', 'background-opacity', 0.3, { duration: 300 });
}

function drawSingleArc(sourceId, targetId) {
  const source = featuresById.get(sourceId);
  const target = featuresById.get(targetId);
  if (!source || !target) return;

  const sourceColor = hexToRgb(COLOR_BY_TYPE[source.osm_type] || COLOR_DEFAULT);
  const targetColor = hexToRgb(COLOR_BY_TYPE[target.osm_type] || COLOR_DEFAULT);

  const ARC_POINTS = 40;
  const ARC_HEIGHT = 0.3;
  const points = sampleArc(source.coordinates, target.coordinates, ARC_HEIGHT, ARC_POINTS);

  const lineData = [];
  for (let i = 0; i < points.length - 1; i++) {
    const segT = i / (ARC_POINTS - 1);
    const color = interpolateColorRgb(
      [...sourceColor, 255],
      [...targetColor, 255],
      segT
    );
    lineData.push({
      path: [points[i], points[i + 1]],
      color,
      sourceId,
      targetId,
    });
  }
  firstTierLineData = lineData;
  secondTierLineData = [];
  renderArcs();
}

function renderConnectionPane(sourceId, targetId) {
  const source = featuresById.get(sourceId);
  const target = featuresById.get(targetId);
  if (!source || !target) return;

  // Find the breakdown scores — stored on whichever place has the other as a kindred
  const scores = source.similarity_scores &&
    source.similarity_scores.find(s => s.id === targetId);

  const sourceColor = COLOR_BY_TYPE[source.osm_type] || COLOR_DEFAULT;
  const targetColor = COLOR_BY_TYPE[target.osm_type] || COLOR_DEFAULT;

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

  const COMMUNITY_LABELS = {
    lgbtq: 'LGBTQ+',
    dfs_lgbtq_welcoming: 'LGBTQ+ Welcoming',
    dfs_lgbtq_owned: 'LGBTQ+ Owned',
    dfs_women_owned: 'Women-Owned',
    dfs_asian_owned: 'Asian-Owned',
    dfs_transgender_safe: 'Transgender Safe Space',
    dfs_wheelchair_accessible: 'Wheelchair Accessible',
    dfs_indigenous_owned: 'Indigenous-Owned',
  };

  const parts = [];

  // Back button
  parts.push(
    '<button class="connection-back-btn" id="connection-back-btn">' +
      '<span class="connection-back-arrow">←</span> Back' +
    '</button>'
  );

  // Header — two places
  parts.push('<div class="connection-header">');
  parts.push(
    '<div class="connection-place">' +
      '<span class="connection-place-dot" style="background:' + sourceColor + '"></span>' +
      '<div class="connection-place-info">' +
        '<div class="connection-place-name">' + escapeHtml(source.name || '') + '</div>' +
        '<div class="connection-place-type">' + escapeHtml(formatOsmType(source.osm_type)) + '</div>' +
      '</div>' +
    '</div>'
  );
  parts.push('<div class="connection-divider">↔</div>');
  parts.push(
    '<div class="connection-place">' +
      '<span class="connection-place-dot" style="background:' + targetColor + '"></span>' +
      '<div class="connection-place-info">' +
        '<div class="connection-place-name">' + escapeHtml(target.name || '') + '</div>' +
        '<div class="connection-place-type">' + escapeHtml(formatOsmType(target.osm_type)) + '</div>' +
      '</div>' +
    '</div>'
  );
  parts.push('</div>'); // connection-header

  // Score bars if available
  if (scores) {
    parts.push('<div class="section-title">Connection Strength</div>');
    parts.push('<div class="connection-scores">');

    const bars = [
      { label: 'Character', value: scores.text,       weight: 0.40 },
      { label: 'Community', value: scores.community,  weight: 0.20 },
      { label: 'Atmosphere', value: scores.atmosphere, weight: 0.20 },
      { label: 'Place Type', value: scores.osm,       weight: 0.10 },
      { label: 'Category',   value: scores.google,    weight: 0.10 },
    ];

    for (const bar of bars) {
      const pct = Math.round(bar.value * 100);
      const weighted = Math.round(bar.value * bar.weight * 100);
      parts.push(
        '<div class="connection-score-row">' +
          '<div class="connection-score-label">' + escapeHtml(bar.label) + '</div>' +
          '<div class="connection-score-bar-wrap">' +
            '<div class="connection-score-bar" style="width:' + Math.round(bar.value * 100) + '%"></div>' +
          '</div>' +
          '<div class="connection-score-pct">' + pct + '%</div>' +
        '</div>'
      );
    }
    parts.push('</div>');
  }

  // Shared soul tokens
  const DISPLAY_STOPWORDS = new Set([
    // Generic descriptive words that appear in most soul summaries
    'looking', 'draws', 'event', 'space', 'never', 'great', 'good', 'best',
    'always', 'makes', 'made', 'make', 'come', 'comes', 'back', 'away',
    'around', 'every', 'still', 'even', 'much', 'many', 'more', 'most',
    'well', 'real', 'little', 'long', 'old', 'new', 'big', 'small',
    'also', 'take', 'get', 'give', 'keep', 'talk', 'know', 'think',
    'scene', 'night', 'day', 'time', 'people', 'crowd', 'world', 'life',
    'city', 'local', 'place', 'spot', 'vibe', 'feel', 'kind', 'type',
    'offers', 'offer', 'serving', 'serves', 'service', 'located',
    'open', 'known', 'welcome', 'perfect', 'located', 'features',
    'something', 'someone', 'somewhere', 'everything', 'everyone',
    'whether', 'while', 'since', 'often', 'within', 'between',
  ]);

  const displayTokens = scores && scores.shared_tokens
    ? scores.shared_tokens.filter(t => !DISPLAY_STOPWORDS.has(t) && t.length >= 4)
    : [];

  if (displayTokens.length > 0) {
    parts.push('<div class="section-title">Shared Character</div>');
    parts.push('<div class="atmosphere">');
    for (const token of displayTokens) {
      parts.push('<span class="pill">' + escapeHtml(token) + '</span>');
    }
    parts.push('</div>');
  }

  // Shared atmosphere
  if (scores && scores.shared_atmosphere && scores.shared_atmosphere.length > 0) {
    parts.push('<div class="section-title">Shared Vibe</div>');
    parts.push('<div class="atmosphere">');
    for (const atm of scores.shared_atmosphere) {
      const label = ATM_LABELS[atm] || atm;
      parts.push('<span class="pill">' + escapeHtml(label) + '</span>');
    }
    parts.push('</div>');
  }

  // Shared community
  if (scores && scores.shared_community && scores.shared_community.length > 0) {
    parts.push('<div class="section-title">Shared Identity</div>');
    parts.push('<div class="atmosphere">');
    for (const tag of scores.shared_community) {
      const label = COMMUNITY_LABELS[tag] || tag.replace(/^(religion|cuisine|for):/, '');
      parts.push('<span class="pill">' + escapeHtml(label) + '</span>');
    }
    parts.push('</div>');
  }

  // Soul summaries side by side
  parts.push('<div class="section-title">Their Stories</div>');
  parts.push('<div class="connection-souls">');
  if (source.soul_summary) {
    parts.push(
      '<div class="connection-soul">' +
        '<div class="connection-soul-name">' + escapeHtml(source.name) + '</div>' +
        '<p class="connection-soul-text">' + escapeHtml(source.soul_summary) + '</p>' +
      '</div>'
    );
  }
  if (target.soul_summary) {
    parts.push(
      '<div class="connection-soul">' +
        '<div class="connection-soul-name">' + escapeHtml(target.name) + '</div>' +
        '<p class="connection-soul-text">' + escapeHtml(target.soul_summary) + '</p>' +
      '</div>'
    );
  }
  parts.push('</div>');

  return parts.join('');
}

function openConnectionView(sourceId, targetId) {
  // Resolve — the arc data has sourceId as the selected place, targetId as kindred.
  // But similarity_scores may be on either place. Check both.
  let resolvedSource = sourceId;
  let resolvedTarget = targetId;

  const sourcePlace = featuresById.get(sourceId);
  const hasScores = sourcePlace && sourcePlace.similarity_scores &&
    sourcePlace.similarity_scores.some(s => s.id === targetId);

  if (!hasScores) {
    // Try the other direction
    const targetPlace = featuresById.get(targetId);
    const hasScoresReverse = targetPlace && targetPlace.similarity_scores &&
      targetPlace.similarity_scores.some(s => s.id === sourceId);
    if (hasScoresReverse) {
      resolvedSource = targetId;
      resolvedTarget = sourceId;
    }
  }

  connectionView = true;
  connectionSourceId = resolvedSource;
  connectionTargetId = resolvedTarget;

 // Clear all arcs, draw just the single connection arc
  if (arcAnimFrame !== null) {
    cancelAnimationFrame(arcAnimFrame);
    arcAnimFrame = null;
  }
  clearSecondTierLines();
  drawSingleArc(resolvedSource, resolvedTarget);

  // Move selected highlight to the source endpoint of this arc,
  // clearing the previously selected place dot if it's different.
  if (selectedId !== null && selectedId !== resolvedSource) {
    map.setFeatureState(
      { source: 'places', sourceLayer: 'nyc_places', id: selectedId },
      { selected: false }
    );
  }
  map.setFeatureState(
    { source: 'places', sourceLayer: 'nyc_places', id: resolvedSource },
    { selected: true }
  );
  selectedId = resolvedSource;

  // Show only the two arc endpoint dots, hide all others
  for (const id of connectedIds) {
    if (id !== resolvedSource && id !== resolvedTarget) {
      map.setFeatureState(
        { source: 'places', sourceLayer: 'nyc_places', id },
        { connected: false }
      );
    }
  }
  connectedIds.clear();
  map.setFeatureState(
    { source: 'places', sourceLayer: 'nyc_places', id: resolvedTarget },
    { connected: true }
  );
  connectedIds.add(resolvedTarget);

  // Render connection pane
  const content = document.getElementById('sidebar-content');
  content.innerHTML = renderConnectionPane(resolvedSource, resolvedTarget);
  content.scrollTop = 0;

  // Wire back button
  const backBtn = document.getElementById('connection-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', closeConnectionView);
  }
}

function closeConnectionView() {
  if (!connectionView) return;
  connectionView = false;
  const prevSourceId = connectionSourceId;
  connectionSourceId = null;
  connectionTargetId = null;

  // Return to the place that was selected before
  if (prevSourceId) {
    openSidebar(prevSourceId);
  }
}
window.closeConnectionView = closeConnectionView;

function openSidebar(placeId) {
  const place = featuresById.get(placeId);
  if (!place) return;

  if (unfadeMainAnimFrame !== null) {
    cancelAnimationFrame(unfadeMainAnimFrame);
    unfadeMainAnimFrame = null;
  }

  setSelected(placeId);
  if (activeFilterTag) {
    clearKindredLines();
    if (showSecondTier) drawFilterLines(placeId);
  } else {
    drawKindredLines(placeId);
  }

  const badgeColor = COLOR_BY_TYPE[place.osm_type] || COLOR_DEFAULT;
  const parts = [];
  parts.push(
   '<div class="place-type-badge" style="background:' + badgeColor + '">' +
  escapeHtml(formatOsmType(place.osm_type || '')) + '</div>'
  );
  parts.push(
    '<button class="place-feedback-btn" onclick="openFeedbackModal(\'' +
    escapeHtml(place.id) + '\', \'' + escapeHtml(place.name || '') + '\')">' +
    '⚑ Report issue</button>'
  );
  parts.push('<h2 class="place-name">' + escapeHtml(place.name || '(unnamed)') + '</h2>');

  if (isPresent(place.soul_summary)) {
    parts.push('<p class="place-soul">' + escapeHtml(place.soul_summary) + '</p>');
  }
  if (isPresent(place.editorial_summary)) {
    parts.push('<p class="place-editorial">' + escapeHtml(place.editorial_summary) + '</p>');
  }
  parts.push(renderVibeChart(place));
  if (activeFilterTag) {
    parts.push('<div id="filter-section"></div>');
  } else {
    parts.push(renderKindredTypeBreakdown(place.similarity_ids));
    parts.push(renderKindred(place.similarity_ids));
  }

  const content = document.getElementById('sidebar-content');
  content.innerHTML = parts.join('');
  content.scrollTop = 0;

  if (activeFilterTag) {
    renderFilterSidebar();
  }

  const sidebar = document.getElementById('sidebar');
  const wasOpen = sidebar.classList.contains('is-open');
  sidebar.classList.remove('is-expanded');
  sidebar.style.transform = '';
  sidebar.classList.add('is-open');
  sidebar.setAttribute('aria-hidden', 'false');

  if (!wasOpen && window.innerWidth > 640) {
    map.easeTo({ padding: { right: 440 }, duration: 250 });
  }

  const tierBtn = content.querySelector('#second-tier-toggle');
  if (tierBtn) {
    tierBtn.addEventListener('click', toggleSecondTier);
  }

  content.querySelectorAll('.vibe-community-tag[data-filter-tag]').forEach((el) => {
    el.addEventListener('click', () => {
      const tag = el.getAttribute('data-filter-tag');
      const label = el.getAttribute('data-filter-label');
      enterFilterMode(tag, label);
    });
  });

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
  if (activeFilterTag) {
    exitFilterMode(false);
  }
  const sidebar = document.getElementById('sidebar');
  const wasOpen = sidebar.classList.contains('is-open');
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
  clearBuildingHighlight();
  const tierBtn = document.getElementById('second-tier-toggle');
  if (tierBtn) tierBtn.style.display = 'none';
  if (map) {
    unfadeMain();
    if (wasOpen) map.easeTo({ padding: { right: 0 }, duration: 250 });
  }
  map.setConfigProperty('basemap', 'transition', { duration: 300, delay: 0 });
  map.setPaintProperty('faded-overlay', 'background-opacity', 0, { duration: 300 });
}

// ---------- Header search ----------

function initSearch() {
  if (!window.Fuse) return;
  const places = Array.from(featuresById.values()).filter((p) => p && p.name);

  fuseIndex = new window.Fuse(places, {
    keys: [
      { name: 'name', weight: 0.7 },
      { name: 'osm_type', weight: 0.15 },
      { name: 'soul_summary', weight: 0.15 },
    ],
    threshold: 0.35,
    minMatchCharLength: 2,
    includeScore: true,
  });

  const types = [...new Set(places.map((p) => p.osm_type).filter(Boolean))].sort();
  const typeSelect = document.getElementById('search-type-filter');
  if (typeSelect) {
    types.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = formatOsmType(t);
      typeSelect.appendChild(opt);
    });
  }

  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');
  const filtersEl = document.getElementById('search-filters');
  const resultsEl = document.getElementById('search-results');
  if (!input || !clearBtn || !filtersEl || !resultsEl) return;

  input.addEventListener('focus', () => {
    searchActive = true;
    filtersEl.style.display = 'flex';
    if (searchQuery || searchTypeFilter || searchBoroughFilter || searchTagFilter) {
      resultsEl.style.display = 'block';
    }
    runSearch();
  });

  input.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    clearBtn.style.display = searchQuery ? 'block' : 'none';
    resultsEl.style.display = 'block';
    runSearch();
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    searchQuery = '';
    clearBtn.style.display = 'none';
    runSearch();
  });

  const searchIcon = document.querySelector('.search-icon');
  if (searchIcon) {
    searchIcon.style.cursor = 'pointer';
    searchIcon.addEventListener('click', () => {
      input.focus();
    });
  }

  document.getElementById('search-type-filter').addEventListener('change', (e) => {
    searchTypeFilter = e.target.value;
    runSearch();
  });
  document.getElementById('search-borough-filter').addEventListener('change', (e) => {
    searchBoroughFilter = e.target.value;
    runSearch();
  });
  document.getElementById('search-tag-filter').addEventListener('change', (e) => {
    searchTagFilter = e.target.value;
    runSearch();
  });

  document.addEventListener('click', (e) => {
    const container = document.getElementById('search-container');
    if (container && !container.contains(e.target)) {
      closeSearch();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSearch();
  });
}

const NINE_ELEVEN_RE = /9\/11|9-11|september\s*11|ground\s*zero/i;
function is911Related(name) {
  return NINE_ELEVEN_RE.test(name);
}

function runSearch() {
  if (!fuseIndex) return;
  const listEl = document.getElementById('search-results-list');
  const resultsEl = document.getElementById('search-results');
  if (!listEl) return;

  let candidates;
  if (searchQuery.length >= 2) {
    candidates = fuseIndex.search(searchQuery).map((r) => r.item);
  } else {
    candidates = Array.from(featuresById.values())
      .filter((p) => p && p.name && !is911Related(p.name))
      .sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
  }

  if (searchTypeFilter) {
    candidates = candidates.filter((p) => p.osm_type === searchTypeFilter);
  }
  if (searchBoroughFilter) {
    candidates = candidates.filter((p) => p.borough === searchBoroughFilter);
  }
  if (searchTagFilter) {
    candidates = candidates.filter((p) => {
      const ct = p.community_tags || {};
      if (searchTagFilter === 'facdb_senior') return ct.facdb_category === 'senior_center';
      if (searchTagFilter === 'facdb_youth') return ct.facdb_category === 'youth_services';
      if (searchTagFilter === 'facdb_library') return ct.facdb_category === 'library';
      if (searchTagFilter === 'lgbtq_primary') return ct.lgbtq_primary === true;
      return ct[searchTagFilter] === true;
    });
  }

  const total = candidates.length;
  const shown = candidates.slice(0, 50);

  if (shown.length === 0) {
    listEl.innerHTML = '<div class="search-no-results">No places found</div>';
    resultsEl.style.display = 'block';
    return;
  }

  const colorByType = window.COLOR_BY_TYPE || COLOR_BY_TYPE || {};
  const defaultColor = window.COLOR_DEFAULT || COLOR_DEFAULT || '#888888';

  const itemsHtml = shown.map((p) => {
    const color = colorByType[p.osm_type] || defaultColor;
    const type = formatOsmType(p.osm_type || '');
    const borough = p.borough || '';
    return (
      '<button class="search-result-item" data-id="' + escapeHtml(p.id) + '">' +
        '<span class="search-result-dot" style="background:' + color + '"></span>' +
        '<span class="search-result-name">' + escapeHtml(p.name || '') + '</span>' +
        '<span class="search-result-meta">' + escapeHtml(type) + (borough ? ' · ' + escapeHtml(borough) : '') + '</span>' +
      '</button>'
    );
  }).join('');

  const countHtml =
    '<div class="search-results-count">' +
      total + ' place' + (total !== 1 ? 's' : '') +
      (total > 50 ? ' (showing 50)' : '') +
    '</div>';

  listEl.innerHTML = countHtml + itemsHtml;

  listEl.querySelectorAll('.search-result-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const placeId = btn.dataset.id;
      if (!placeId) return;
      const place = featuresById.get(placeId);
      if (place && Array.isArray(place.coordinates)) {
        map.flyTo({
          center: place.coordinates,
          zoom: 15,
          duration: 1200,
        });
      }
      openSidebar(placeId);
      closeSearch();
    });
  });

  resultsEl.style.display = 'block';
}

function closeSearch() {
  searchActive = false;
  const filtersEl = document.getElementById('search-filters');
  const resultsEl = document.getElementById('search-results');
  if (filtersEl) filtersEl.style.display = 'none';
  if (resultsEl) resultsEl.style.display = 'none';
}

function initLegend() {
  const toggle = document.getElementById('legend-toggle');
  const content = document.getElementById('legend-content');
  if (!toggle || !content) return;

  if (window.innerWidth <= 640) {
    content.classList.add('is-collapsed');
    const icon = toggle.querySelector('.legend-toggle-icon');
    if (icon) icon.textContent = '▸';
  }

  toggle.addEventListener('click', () => {
    const collapsed = content.classList.toggle('is-collapsed');
    const icon = toggle.querySelector('.legend-toggle-icon');
    if (icon) icon.textContent = collapsed ? '▸' : '▾';
  });
}

// ---------- Day/night theme ----------

const THEME_STORAGE_KEY = 'map_theme';

function applyMapTheme(theme) {
  const isNight = theme === 'night';
  document.body.classList.toggle('theme-night', isNight);
  if (map) {
    try {
      map.setConfigProperty('basemap', 'lightPreset', isNight ? 'night' : 'day');
      if (isNight) {
        map.setConfigProperty('basemap', 'colorMotorways', 'rgb(42, 56, 100)');
        map.setConfigProperty('basemap', 'colorTrunks', 'rgb(42, 56, 100)');
        map.setConfigProperty('basemap', 'colorRoads', 'rgb(42, 56, 100)');
      } else {
        map.setConfigProperty('basemap', 'colorMotorways', '#ffffff');
        map.setConfigProperty('basemap', 'colorTrunks', '#ffffff');
        map.setConfigProperty('basemap', 'colorRoads', '#ffffff');
      }
    } catch (e) {}
    try {
      map.setPaintProperty(
        'places-circles-main',
        'circle-stroke-color',
        isNight ? PLACES_STROKE_NIGHT : PLACES_STROKE_DAY
      );
    } catch (e) {}

    // Re-establish feature-states after basemap config change.
    // setConfigProperty('lightPreset') triggers an internal Mapbox
    // re-evaluation that can temporarily drop feature-state-driven
    // expressions on overlay layers. Reapplying after a short delay
    // ensures selected/connected dots and opacity expressions are
    // restored to their correct values.
    setTimeout(() => {
      // FIX: cancel any in-flight unfadeMain before re-applying state —
      // unfadeMain and the theme restore can fight each other.
      if (unfadeMainAnimFrame !== null) {
        cancelAnimationFrame(unfadeMainAnimFrame);
        unfadeMainAnimFrame = null;
      }
      try {
        if (selectedId) {
          map.setFeatureState(
            { source: 'places', sourceLayer: 'nyc_places', id: selectedId },
            { selected: true }
          );
        }
        for (const id of connectedIds) {
          map.setFeatureState(
            { source: 'places', sourceLayer: 'nyc_places', id },
            { connected: true }
          );
        }
        for (const id of secondConnectedIds) {
          map.setFeatureState(
            { source: 'places', sourceLayer: 'nyc_places', id },
            { second_connected: true }
          );
        }
        if (activeFilterTag) {
          map.setPaintProperty('places-circles-main', 'circle-opacity', FILTER_OPACITY_EXPR);
          if (filterMatchIds.size > 0) {
            setFilterMatchedState(filterMatchIds, true);
          }
        } else if (selectedId) {
          map.setPaintProperty('places-circles-main', 'circle-opacity', SELECTION_OPACITY_EXPR);
        }
      } catch (e) {}
    }, 150);
  }

  const icon = document.getElementById('theme-toggle-icon');
  if (icon) icon.textContent = isNight ? '☼' : '☾';
}
window.applyMapTheme = applyMapTheme;

function initTheme() {
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;
  let saved = null;
  try { saved = localStorage.getItem(THEME_STORAGE_KEY); } catch (e) {}
  const initial = saved === 'day' ? 'day' : 'night';
  if (!document.body.classList.contains('narrative-active')) {
    applyMapTheme(initial);
  }
  toggle.addEventListener('click', () => {
    const next = document.body.classList.contains('theme-night') ? 'day' : 'night';
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch (e) {}
    applyMapTheme(next);
  });
}

// ---------- 3D objects toggle ----------

const THREE_D_STORAGE_KEY = 'map_3d_objects';

function apply3dObjects(enabled) {
  if (map) {
    try {
      map.setConfigProperty('basemap', 'show3dObjects', !!enabled);
    } catch (e) {}
  }
  const btn = document.getElementById('three-d-toggle');
  if (btn) btn.classList.toggle('is-active', !!enabled);
}

function init3dToggle() {
  const btn = document.getElementById('three-d-toggle');
  if (!btn) return;
  let saved = null;
  try { saved = localStorage.getItem(THREE_D_STORAGE_KEY); } catch (e) {}
  const initial = saved !== 'off';
  apply3dObjects(initial);
  btn.addEventListener('click', () => {
    const next = !btn.classList.contains('is-active');
    try { localStorage.setItem(THREE_D_STORAGE_KEY, next ? 'on' : 'off'); } catch (e) {}
    apply3dObjects(next);
  });
}

async function initMap() {
  const bounds = [
    [-74.259, 40.477],
    [-73.700, 40.917],
  ];

  mapboxgl.accessToken = MAPBOX_TOKEN;
  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/jpiac/cmpekflsk003801s3f6ky6n8y',
    center: [-73.95, 40.7],
    zoom: 11,
    pitch: 40,
    minZoom: 10,
    maxBounds: bounds,
  });
  map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'bottom-right');

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

  window.setSelected = setSelected;
  window.featuresById = featuresById;
  window.drawKindredLines = drawKindredLines;
  window.clearKindredLines = clearKindredLines;
  window.CONSTELLATION_GROUP_COUNT = CONSTELLATION_GROUP_COUNT;
  window.COLOR_BY_TYPE = COLOR_BY_TYPE;
  window.COLOR_DEFAULT = COLOR_DEFAULT;
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


  const mapCanvas = map.getCanvas();


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

  geojsonData = geojson;

  map.addSource('places', {
    type: 'vector',
    url: 'mapbox://jpiac.6vmp9rv4',
    promoteId: { 'nyc_places': 'id' },
  });

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
       'attraction', 'viewpoint',
       'florist', 'pastry', 'public_bookcase', 'craft', 'art', 'chocolate',
       'musical_instrument', 'antiques', 'food_court', 'tea', 'fountain',
       'ice_cream', 'sauna', 'pitch', 'ice_rink', 'internet_cafe',
       'escape_game', 'public_bath', 'nature_reserve', 'dog_park',
       'miniature_golf', 'shelter', 'aquarium', 'outdoor_seating',
       'square', 'zoo', 'concert_hall', 'bench',], true, false],
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

  // Faded overlay
  map.addLayer({
    id: 'faded-overlay',
    type: 'background',
    paint: {
      'background-color': '#ffffff',
      'background-opacity': 0,
    },
  });

  // Second-tier kindred overlay
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
       'attraction', 'viewpoint',
       'florist', 'pastry', 'public_bookcase', 'craft', 'art', 'chocolate',
       'musical_instrument', 'antiques', 'food_court', 'tea', 'fountain',
       'ice_cream', 'sauna', 'pitch', 'ice_rink', 'internet_cafe',
       'escape_game', 'public_bath', 'nature_reserve', 'dog_park',
       'miniature_golf', 'shelter', 'aquarium', 'outdoor_seating',
       'square', 'zoo', 'concert_hall', 'bench',], true, false],
    paint: {
      'circle-color': buildColorExpression(),
      'circle-radius': [
        'interpolate', ['linear'],
        ['coalesce', ['to-number', ['get', 'review_count']], 0],
        0, 3,
        1000, 6,
      ],
      'circle-emissive-strength': 1,
      'circle-opacity': [
        'case',
        ['boolean', ['feature-state', 'second_connected'], false], 0.5,
        0,
      ],
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
       'attraction', 'viewpoint',
       'florist', 'pastry', 'public_bookcase', 'craft', 'art', 'chocolate',
       'musical_instrument', 'antiques', 'food_court', 'tea', 'fountain',
       'ice_cream', 'sauna', 'pitch', 'ice_rink', 'internet_cafe',
       'escape_game', 'public_bath', 'nature_reserve', 'dog_park',
       'miniature_golf', 'shelter', 'aquarium', 'outdoor_seating',
       'square', 'zoo', 'concert_hall', 'bench',], true, false],
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

  // Selected place overlay
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
       'attraction', 'viewpoint',
       'florist', 'pastry', 'public_bookcase', 'craft', 'art', 'chocolate',
       'musical_instrument', 'antiques', 'food_court', 'tea', 'fountain',
       'ice_cream', 'sauna', 'pitch', 'ice_rink', 'internet_cafe',
       'escape_game', 'public_bath', 'nature_reserve', 'dog_park',
       'miniature_golf', 'shelter', 'aquarium', 'outdoor_seating',
       'square', 'zoo', 'concert_hall', 'bench',], true, false],
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
  initSearch();
  initLegend();
  initTheme();
  init3dToggle();
  initArcInteraction();

  function onCircleMouseEnter(e) {
    if (!e.features.length) return;
    if (document.getElementById('narrative-overlay')?.classList.contains('is-interactive')) return;
    map.getCanvas().style.cursor = 'pointer';
    const id = e.features[0].properties.id;
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

  // Query a wider bbox and filter to features actually in connectedIds
  // or secondConnectedIds — this ensures kindred dots win over nearby
  // main-layer dots without accidentally picking up an unrelated dot
  // that happens to be within the bbox.
  const pad = 8;
  const bbox = [
    [e.point.x - pad, e.point.y - pad],
    [e.point.x + pad, e.point.y + pad],
  ];

  if (connectedIds.size > 0 || secondConnectedIds.size > 0) {
    const overlayHits = map.queryRenderedFeatures(bbox, {
      layers: ['places-circles-connected-overlay', 'places-circles-second-tier-overlay'],
    });
    // Only accept hits whose id is actually in our connected sets
    const connectedHit = overlayHits.find(f => {
      const pid = f.properties.id;
      return connectedIds.has(pid) || secondConnectedIds.has(pid);
    });
    if (connectedHit) {
      const pid = connectedHit.properties.id;
      if (pid) { openSidebar(pid); return; }
    }
  }

  // Fall back to normal priority query
  const priorityHits = map.queryRenderedFeatures(e.point, {
    layers: ['places-circles-selected-overlay', 'places-circles-main'],
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

function initArcInteraction() {
  const mapCanvas = map.getCanvas();

  mapCanvas.addEventListener('mousemove', (e) => {
    if (!deckInstance || (firstTierLineData.length === 0 && secondTierLineData.length === 0)) {
      if (hoveredArcSourceId !== null) {
        hoveredArcSourceId = null;
        hoveredArcTargetId = null;
        renderArcs();
      }
      return;
    }

    const rect = mapCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const picked = deckInstance.pickObject({ x, y, radius: 6 });

    if (picked && picked.object && picked.object.sourceId) {
      const { sourceId, targetId } = picked.object;
      if (hoveredArcSourceId !== sourceId || hoveredArcTargetId !== targetId) {
        hoveredArcSourceId = sourceId;
        hoveredArcTargetId = targetId;
        renderArcs();
      }
      mapCanvas.style.cursor = 'pointer';
    } else {
      if (hoveredArcSourceId !== null) {
        hoveredArcSourceId = null;
        hoveredArcTargetId = null;
        renderArcs();
        mapCanvas.style.cursor = '';
      }
    }
  });

  mapCanvas.addEventListener('click', (e) => {
    if (!deckInstance || (firstTierLineData.length === 0 && secondTierLineData.length === 0)) return;

    const rect = mapCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const picked = deckInstance.pickObject({ x, y, radius: 6 });

    if (picked && picked.object && picked.object.sourceId && picked.object.targetId) {
      openConnectionView(picked.object.sourceId, picked.object.targetId);
      // Stop the event so Mapbox's own click handler doesn't also fire
      e.stopImmediatePropagation();
    }
  }, true); // useCapture:true so we get it before Mapbox
}

function toggleAbout() {
  const panel = document.getElementById('about-panel');
  if (!panel) return;
  const isOpen = panel.classList.contains('is-open');
  panel.classList.toggle('is-open');
  panel.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
}
window.toggleAbout = toggleAbout;

document.addEventListener('click', (e) => {
  const panel = document.getElementById('about-panel');
  const btn = document.getElementById('about-btn');
  const hamburgerMenu = document.getElementById('hamburger-menu');
  if (panel && panel.classList.contains('is-open')) {
    if (!panel.contains(e.target) && e.target !== btn &&
        !(hamburgerMenu && hamburgerMenu.contains(e.target))) {
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
  const aboutClose = document.getElementById('about-close');
  if (aboutClose) aboutClose.addEventListener('click', toggleAbout);
}

function toggleHamburger() {
  const btn = document.getElementById('hamburger-btn');
  const menu = document.getElementById('hamburger-menu');
  if (!btn || !menu) return;
  const isOpen = menu.classList.toggle('is-open');
  btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  menu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
}

function closeHamburger() {
  const btn = document.getElementById('hamburger-btn');
  const menu = document.getElementById('hamburger-menu');
  if (!btn || !menu) return;
  menu.classList.remove('is-open');
  btn.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-hidden', 'true');
}
window.closeHamburger = closeHamburger;

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('hamburger-btn');
  if (btn) btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleHamburger();
  });
  // Close when clicking outside
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('hamburger-menu');
    const btn = document.getElementById('hamburger-btn');
    if (menu && menu.classList.contains('is-open')) {
      if (!menu.contains(e.target) && e.target !== btn) {
        closeHamburger();
      }
    }
  });
});

if (!MAPBOX_TOKEN) {
  showError('Set MAPBOX_TOKEN at the top of main.js before loading.');
} else {
  initUI();
  initMap();
}