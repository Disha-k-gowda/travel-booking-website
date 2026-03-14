const state = {
  destinations: [],
  filtered: [],
  activeTheme: 'all',
  favoritesOnly: false,
  favorites: new Set(),
};

const tripsGridEl = document.getElementById('tripsGrid');
const tripsSummaryEl = document.getElementById('tripsSummary');
const tripTemplate = document.getElementById('tripCardTemplate');
const searchTextEl = document.getElementById('searchText');
const sortByEl = document.getElementById('sortBy');
const availabilityFilterEl = document.getElementById('availabilityFilter');
const tripsThemeFiltersEl = document.getElementById('tripsThemeFilters');
const copyTripsLinkBtn = document.getElementById('copyTripsLink');
const toggleFavoritesOnlyBtn = document.getElementById('toggleFavoritesOnly');
const resetTripsFiltersBtn = document.getElementById('resetTripsFilters');
const tripsKpiVisibleEl = document.getElementById('tripsKpiVisible');
const tripsKpiStartingEl = document.getElementById('tripsKpiStarting');
const tripsKpiFavoritesEl = document.getElementById('tripsKpiFavorites');

function loadFavorites() {
  try {
    const raw = localStorage.getItem('voyanta_favorites');
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      state.favorites = new Set(parsed.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0));
    }
  } catch (_error) {
    state.favorites = new Set();
  }
}

function saveFavorites() {
  localStorage.setItem('voyanta_favorites', JSON.stringify([...state.favorites]));
}

function updateFavoritesUiLabel() {
  if (!toggleFavoritesOnlyBtn) {
    return;
  }
  toggleFavoritesOnlyBtn.textContent = `Favorites Only: ${state.favoritesOnly ? 'On' : 'Off'}`;
}

function estimateTripMath(item) {
  const nights = 3;
  const travelers = 2;
  const total = item.basePrice * nights * travelers;
  return `${nights}-night estimate for ${travelers} travelers: ${formatCurrency(total)}`;
}

function syncQueryParams() {
  const params = new URLSearchParams();
  const query = searchTextEl.value.trim();
  if (query) {
    params.set('q', query);
  }
  if (sortByEl.value && sortByEl.value !== 'popular') {
    params.set('sort', sortByEl.value);
  }
  if (availabilityFilterEl.value && availabilityFilterEl.value !== 'all') {
    params.set('availability', availabilityFilterEl.value);
  }
  if (state.activeTheme && state.activeTheme !== 'all') {
    params.set('theme', state.activeTheme);
  }
  if (state.favoritesOnly) {
    params.set('favorites', '1');
  }

  const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
  window.history.replaceState({}, '', nextUrl);
}

function applyQueryParamsFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q') || '';
  const sort = params.get('sort') || 'popular';
  const availability = params.get('availability') || 'all';
  const theme = params.get('theme') || 'all';
  const favorites = params.get('favorites') || '0';

  searchTextEl.value = q;
  sortByEl.value = ['popular', 'priceAsc', 'priceDesc', 'availabilityDesc'].includes(sort)
    ? sort
    : 'popular';
  availabilityFilterEl.value = ['all', 'available', 'limited'].includes(availability)
    ? availability
    : 'all';
  state.activeTheme = ['all', 'adventure', 'culture', 'relax', 'balanced'].includes(theme)
    ? theme
    : 'all';
  state.favoritesOnly = favorites === '1';

  if (tripsThemeFiltersEl) {
    tripsThemeFiltersEl
      .querySelectorAll('.filter-chip')
      .forEach((chip) => chip.classList.remove('active'));
    const selectedChip = tripsThemeFiltersEl.querySelector(`[data-theme="${state.activeTheme}"]`);
    if (selectedChip) {
      selectedChip.classList.add('active');
    }
  }

  updateFavoritesUiLabel();
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function detectTripTheme(item) {
  const text = `${item.name} ${item.description}`.toLowerCase();
  if (/(alpine|glacier|fjord|mountain|frontier|aurora|snow|expedition)/.test(text)) {
    return { key: 'adventure', label: 'Adventure' };
  }
  if (/(heritage|temple|medina|legacy|old-town|cultural|district)/.test(text)) {
    return { key: 'culture', label: 'Culture' };
  }
  if (/(wellness|retreat|lagoon|beach|coastal|island|spa)/.test(text)) {
    return { key: 'relax', label: 'Relax' };
  }
  return { key: 'balanced', label: 'Balanced' };
}

function applyFilters() {
  const query = searchTextEl.value.trim().toLowerCase();
  const sortBy = sortByEl.value;
  const availabilityFilter = availabilityFilterEl.value;

  let results = state.destinations.filter((item) => {
    const matchQuery =
      !query ||
      item.name.toLowerCase().includes(query) ||
      item.country.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query);

    if (!matchQuery) {
      return false;
    }

    if (availabilityFilter === 'available') {
      return item.availableSlots > 0;
    }

    if (availabilityFilter === 'limited') {
      return item.availableSlots > 0 && item.availableSlots <= 10;
    }

    if (state.activeTheme !== 'all') {
      if (detectTripTheme(item).key !== state.activeTheme) {
        return false;
      }
    }

    if (state.favoritesOnly && !state.favorites.has(item.id)) {
      return false;
    }

    return true;
  });

  if (sortBy === 'priceAsc') {
    results = [...results].sort((a, b) => a.basePrice - b.basePrice);
  } else if (sortBy === 'priceDesc') {
    results = [...results].sort((a, b) => b.basePrice - a.basePrice);
  } else if (sortBy === 'availabilityDesc') {
    results = [...results].sort((a, b) => b.availableSlots - a.availableSlots);
  }

  state.filtered = results;
  syncQueryParams();
  renderTrips();
}

async function loadInsightsForTrip(item) {
  try {
    const response = await fetch(`/api/destinations/${item.id}/insights`);
    if (!response.ok) {
      item.weatherSummary = 'Weather unavailable';
      item.factsSummary = 'Facts unavailable';
      return;
    }

    const payload = await response.json();
    const insights = payload.insights || {};
    const country = insights.country || {};

    item.weatherSummary = insights.weather?.summary || 'Weather unavailable';
    item.factsSummary = `${country.capital || 'N/A'} · ${country.currency || 'N/A'} · ${country.timezone || 'N/A'}`;
  } catch (_error) {
    item.weatherSummary = 'Weather unavailable';
    item.factsSummary = 'Facts unavailable';
  }
}

function renderTrips() {
  tripsGridEl.innerHTML = '';

  if (tripsKpiFavoritesEl) {
    tripsKpiFavoritesEl.textContent = String(state.favorites.size);
  }

  if (tripsKpiVisibleEl) {
    tripsKpiVisibleEl.textContent = String(state.filtered.length);
  }

  if (tripsKpiStartingEl) {
    if (state.filtered.length === 0) {
      tripsKpiStartingEl.textContent = '-';
    } else {
      const minPrice = Math.min(...state.filtered.map((item) => item.basePrice));
      tripsKpiStartingEl.textContent = formatCurrency(minPrice);
    }
  }

  if (state.filtered.length === 0) {
    tripsSummaryEl.textContent = 'No destinations match your filters.';
    return;
  }

  tripsSummaryEl.textContent = `${state.filtered.length} destination(s) shown`;

  for (const item of state.filtered) {
    const fragment = tripTemplate.content.cloneNode(true);

    fragment.querySelector('img').src = item.imageUrl;
    fragment.querySelector('.name').textContent = item.name;
    fragment.querySelector('.country').textContent = item.country;
    const theme = detectTripTheme(item);
    const tag = fragment.querySelector('.trip-tag');
    tag.textContent = theme.label;
    tag.classList.add(`tag-${theme.key}`);
    fragment.querySelector('.description').textContent = item.description;
    fragment.querySelector('.price').textContent = `${formatCurrency(item.basePrice)} / night`;
    fragment.querySelector('.availability').textContent = `${item.availableSlots}/${item.totalSlots} seats`;
    fragment.querySelector('.trip-math').textContent = estimateTripMath(item);
    fragment.querySelector('.weather').textContent = item.weatherSummary || 'Weather not loaded';
    fragment.querySelector('.facts').textContent = item.factsSummary || 'Facts not loaded';

    const insightsBtn = fragment.querySelector('.insights-btn');
    const favoriteBtn = fragment.querySelector('.favorite-btn');
    const detailsLink = fragment.querySelector('.details-link');
    const quickBookLink = fragment.querySelector('.quick-book-link');
    detailsLink.href = `/destination.html?id=${item.id}`;
    quickBookLink.href = `/index.html#destination-${item.id}`;

    const isFavorite = state.favorites.has(item.id);
    favoriteBtn.textContent = isFavorite ? 'Saved' : 'Save';
    favoriteBtn.classList.toggle('favorite-active', isFavorite);

    favoriteBtn.addEventListener('click', () => {
      if (state.favorites.has(item.id)) {
        state.favorites.delete(item.id);
      } else {
        state.favorites.add(item.id);
      }
      saveFavorites();
      applyFilters();
    });

    insightsBtn.addEventListener('click', async () => {
      insightsBtn.disabled = true;
      insightsBtn.textContent = 'Loading...';
      await loadInsightsForTrip(item);
      renderTrips();
    });

    tripsGridEl.appendChild(fragment);
  }
}

async function loadDestinations() {
  const response = await fetch('/api/destinations');
  state.destinations = await response.json();
  state.filtered = [...state.destinations];
  renderTrips();
}

searchTextEl.addEventListener('input', applyFilters);
sortByEl.addEventListener('change', applyFilters);
availabilityFilterEl.addEventListener('change', applyFilters);

document.getElementById('filterForm').addEventListener('submit', (event) => {
  event.preventDefault();
  applyFilters();
});

if (tripsThemeFiltersEl) {
  tripsThemeFiltersEl.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const theme = target.dataset.theme;
    if (!theme) {
      return;
    }

    state.activeTheme = theme;
    tripsThemeFiltersEl
      .querySelectorAll('.filter-chip')
      .forEach((chip) => chip.classList.remove('active'));
    target.classList.add('active');

    applyFilters();
  });
}

if (toggleFavoritesOnlyBtn) {
  toggleFavoritesOnlyBtn.addEventListener('click', () => {
    state.favoritesOnly = !state.favoritesOnly;
    updateFavoritesUiLabel();
    applyFilters();
  });
}

if (resetTripsFiltersBtn) {
  resetTripsFiltersBtn.addEventListener('click', () => {
    searchTextEl.value = '';
    sortByEl.value = 'popular';
    availabilityFilterEl.value = 'all';
    state.activeTheme = 'all';
    state.favoritesOnly = false;

    if (tripsThemeFiltersEl) {
      tripsThemeFiltersEl
        .querySelectorAll('.filter-chip')
        .forEach((chip) => chip.classList.remove('active'));
      const allChip = tripsThemeFiltersEl.querySelector('[data-theme="all"]');
      if (allChip) {
        allChip.classList.add('active');
      }
    }

    updateFavoritesUiLabel();
    applyFilters();
  });
}

if (copyTripsLinkBtn) {
  copyTripsLinkBtn.addEventListener('click', async () => {
    syncQueryParams();
    const shareUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(shareUrl);
      copyTripsLinkBtn.textContent = 'Copied';
      setTimeout(() => {
        copyTripsLinkBtn.textContent = 'Copy Filtered Link';
      }, 1200);
    } catch (_error) {
      copyTripsLinkBtn.textContent = 'Copy failed';
      setTimeout(() => {
        copyTripsLinkBtn.textContent = 'Copy Filtered Link';
      }, 1200);
    }
  });
}

applyQueryParamsFromUrl();
loadFavorites();
updateFavoritesUiLabel();
loadDestinations();
