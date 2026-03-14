const state = {
  destinations: [],
  bookings: [],
  authToken: localStorage.getItem('voyanta_token') || '',
  user: null,
  activeTheme: 'all',
  socketConnected: false,
};

const destinationsEl = document.getElementById('destinations');
const bookingsListEl = document.getElementById('bookingsList');
const connectionStatusEl = document.getElementById('connectionStatus');
const dialog = document.getElementById('bookingDialog');
const form = document.getElementById('bookingForm');
const formMessageEl = document.getElementById('formMessage');
const closeDialogBtn = document.getElementById('closeDialog');
const viewBookingsBtn = document.getElementById('viewBookingsBtn');
const template = document.getElementById('destinationCardTemplate');
const homeThemeFiltersEl = document.getElementById('homeThemeFilters');
const copyHomeLinkBtn = document.getElementById('copyHomeLink');
const favoritesShelfEl = document.getElementById('favoritesShelf');
const favoritesShelfListEl = document.getElementById('favoritesShelfList');
const favoritesShelfSummaryEl = document.getElementById('favoritesShelfSummary');
const homeInspirationGridEl = document.getElementById('homeInspirationGrid');
const homeGallerySummaryEl = document.getElementById('homeGallerySummary');
const authForm = document.getElementById('authForm');
const signupBtn = document.getElementById('signupBtn');
const signoutBtn = document.getElementById('signoutBtn');
const authStatusEl = document.getElementById('authStatus');
const homeKpiDestinationsEl = document.getElementById('homeKpiDestinations');
const homeKpiSeatsEl = document.getElementById('homeKpiSeats');
const homeKpiBookingsEl = document.getElementById('homeKpiBookings');

function renderHomeKpis() {
  if (!homeKpiDestinationsEl || !homeKpiSeatsEl || !homeKpiBookingsEl) {
    return;
  }

  const visibleCount = getVisibleDestinations().length;
  const totalOpenSeats = state.destinations.reduce((sum, item) => sum + Number(item.availableSlots || 0), 0);
  homeKpiDestinationsEl.textContent = String(visibleCount);
  homeKpiSeatsEl.textContent = String(totalOpenSeats);
  homeKpiBookingsEl.textContent = String(state.bookings.length);
}

function setAuthState(token, user) {
  state.authToken = token || '';
  state.user = user || null;
  if (state.authToken) {
    localStorage.setItem('voyanta_token', state.authToken);
  } else {
    localStorage.removeItem('voyanta_token');
  }
  renderAuthState();
}

function renderAuthState() {
  if (state.user) {
    authStatusEl.textContent = `Signed in as ${state.user.name} (${state.user.email})`;
    form.customerName.value = state.user.name;
    form.email.value = state.user.email;
  } else {
    authStatusEl.textContent = 'Continue as guest or sign in for one-click booking.';
    form.customerName.value = '';
    form.email.value = '';
  }
}

async function loadCurrentUser() {
  if (!state.authToken) {
    renderAuthState();
    return;
  }

  const response = await fetch('/api/auth/me', {
    headers: {
      Authorization: `Bearer ${state.authToken}`,
    },
  });

  if (!response.ok) {
    setAuthState('', null);
    return;
  }

  const user = await response.json();
  setAuthState(state.authToken, user);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUpdatedAt(value) {
  if (!value) {
    return 'Not refreshed yet';
  }

  const diffSeconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
  if (diffSeconds < 5) {
    return 'Updated just now';
  }
  if (diffSeconds < 60) {
    return `Updated ${diffSeconds}s ago`;
  }
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) {
    return `Updated ${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  return `Updated ${hours}h ago`;
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

function getVisibleDestinations() {
  if (state.activeTheme === 'all') {
    return state.destinations;
  }
  return state.destinations.filter((item) => detectTripTheme(item).key === state.activeTheme);
}

function getFavoriteIds() {
  try {
    const raw = localStorage.getItem('voyanta_favorites');
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);
  } catch (_error) {
    return [];
  }
}

function renderFavoritesShelf() {
  if (!favoritesShelfEl || !favoritesShelfListEl || !favoritesShelfSummaryEl) {
    return;
  }

  const favoriteIds = getFavoriteIds();
  const favorites = state.destinations.filter((item) => favoriteIds.includes(item.id));

  if (favorites.length === 0) {
    favoritesShelfEl.classList.add('shelf-empty');
    favoritesShelfSummaryEl.textContent = 'No favorites yet. Save from Trips page.';
    favoritesShelfListEl.innerHTML = '';
    return;
  }

  favoritesShelfEl.classList.remove('shelf-empty');
  favoritesShelfSummaryEl.textContent = `${favorites.length} saved trip(s)`;
  favoritesShelfListEl.innerHTML = '';

  for (const item of favorites) {
    const card = document.createElement('article');
    card.className = 'favorite-mini-card';
    card.innerHTML = `
      <div>
        <strong>${item.name}</strong>
        <p>${item.country} · ${formatCurrency(item.basePrice)} / night</p>
      </div>
      <div class="favorite-mini-actions">
        <a class="ghost-btn link-btn" href="/destination.html?id=${item.id}">Details</a>
        <button class="primary-btn" type="button">Reserve</button>
      </div>
    `;

    card.querySelector('.primary-btn').addEventListener('click', () => openDialog(item));
    favoritesShelfListEl.appendChild(card);
  }
}

function getDestinationGallery(item) {
  if (Array.isArray(item.galleryImages) && item.galleryImages.length > 0) {
    return item.galleryImages;
  }
  return item.imageUrl ? [item.imageUrl] : [];
}

function buildFallbackImageUrl(seed) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/1400/900`;
}

function applyImageWithFallback(imageEl, sources, altText, fallbackSeed) {
  if (!imageEl) {
    return;
  }

  const queue = [...new Set([...(sources || []), buildFallbackImageUrl(fallbackSeed)])].filter(Boolean);
  imageEl.alt = altText || 'destination image';

  const loadAt = (index) => {
    if (index >= queue.length) {
      return;
    }
    imageEl.src = queue[index];
    imageEl.onerror = () => loadAt(index + 1);
  };

  loadAt(0);
}

function renderHomeInspirationGallery() {
  if (!homeInspirationGridEl || !homeGallerySummaryEl) {
    return;
  }

  homeInspirationGridEl.innerHTML = '';
  const cards = state.destinations
    .slice(0, 6)
    .flatMap((destination) =>
      getDestinationGallery(destination).slice(0, 2).map((imageUrl) => ({
        id: destination.id,
        name: destination.name,
        imageUrl,
      })),
    )
    .slice(0, 12);

  if (cards.length === 0) {
    homeGallerySummaryEl.textContent = 'No images available yet.';
    return;
  }

  homeGallerySummaryEl.textContent = `${cards.length} curated travel image(s)`;

  for (const card of cards) {
    const anchor = document.createElement('a');
    anchor.className = 'inspiration-tile';
    anchor.href = `/destination.html?id=${card.id}`;
    const image = document.createElement('img');
    image.loading = 'lazy';
    applyImageWithFallback(image, [card.imageUrl], card.name, `${card.name}-home-tile`);
    const label = document.createElement('span');
    label.textContent = card.name;
    anchor.appendChild(image);
    anchor.appendChild(label);
    homeInspirationGridEl.appendChild(anchor);
  }
}

function syncHomeQueryParams() {
  const params = new URLSearchParams(window.location.search);
  if (state.activeTheme && state.activeTheme !== 'all') {
    params.set('theme', state.activeTheme);
  } else {
    params.delete('theme');
  }

  const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash || ''}`;
  window.history.replaceState({}, '', next);
}

function applyHomeQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const theme = params.get('theme') || 'all';
  state.activeTheme = ['all', 'adventure', 'culture', 'relax', 'balanced'].includes(theme)
    ? theme
    : 'all';

  if (homeThemeFiltersEl) {
    homeThemeFiltersEl
      .querySelectorAll('.filter-chip')
      .forEach((chip) => chip.classList.remove('active'));
    const selectedChip = homeThemeFiltersEl.querySelector(`[data-theme="${state.activeTheme}"]`);
    if (selectedChip) {
      selectedChip.classList.add('active');
    }
  }
}

function renderDestinations() {
  destinationsEl.innerHTML = '';
  const visibleDestinations = getVisibleDestinations();
  const statusPrefix = state.socketConnected ? 'Live updates connected' : 'Live updates disconnected';
  connectionStatusEl.textContent = `${statusPrefix} · ${visibleDestinations.length} shown`;
  renderHomeKpis();

  for (const item of visibleDestinations) {
    const fragment = template.content.cloneNode(true);
    const cardImage = fragment.querySelector('img');
    applyImageWithFallback(cardImage, getDestinationGallery(item), item.name, `${item.name}-card`);
    fragment.querySelector('.name').textContent = item.name;
    fragment.querySelector('.country').textContent = item.country;
    const theme = detectTripTheme(item);
    const tag = fragment.querySelector('.trip-tag');
    tag.textContent = theme.label;
    tag.classList.add(`tag-${theme.key}`);
    fragment.querySelector('.description').textContent = item.description;
    fragment.querySelector('.price').textContent = `${formatCurrency(item.basePrice)} / night`;
    fragment.querySelector('.availability').textContent = `Available: ${item.availableSlots}/${item.totalSlots}`;
    fragment.querySelector('.weather').textContent = item.weatherSummary || 'Live weather not loaded yet';
    fragment.querySelector('.facts').textContent = item.countryFactsSummary || 'Country facts not loaded yet';
    fragment.querySelector('.updated-at').textContent = formatUpdatedAt(item.insightsUpdatedAt);

    const button = fragment.querySelector('.book-btn');
    const insightsBtn = fragment.querySelector('.insights-btn');
    const detailLink = fragment.querySelector('.detail-link');
    detailLink.href = `/destination.html?id=${item.id}`;
    button.disabled = item.availableSlots === 0;
    button.textContent = item.availableSlots === 0 ? 'Sold Out' : 'Reserve';
    button.addEventListener('click', () => openDialog(item));

    insightsBtn.disabled = Boolean(item.isInsightsLoading);
    insightsBtn.textContent = item.isInsightsLoading ? 'Refreshing...' : 'Refresh Insights';

    insightsBtn.addEventListener('click', async () => {
      if (item.isInsightsLoading) {
        return;
      }

      item.isInsightsLoading = true;
      renderDestinations();

      const success = await loadInsightsForDestination(item);
      if (success) {
        item.insightsUpdatedAt = Date.now();
      }
      item.isInsightsLoading = false;
      renderDestinations();
    });

    destinationsEl.appendChild(fragment);
  }
}

async function loadInsightsForDestination(item) {
  try {
    const response = await fetch(`/api/destinations/${item.id}/insights`);
    if (!response.ok) {
      item.weatherSummary = 'Weather unavailable';
      item.countryFactsSummary = 'Country facts unavailable';
      return false;
    }
    const payload = await response.json();
    const insights = payload.insights || {};
    const country = insights.country || {};
    item.weatherSummary = insights.weather?.summary || 'Weather unavailable';
    item.countryFactsSummary = `${country.capital || 'N/A'} · ${country.currency || 'N/A'} · ${country.timezone || 'N/A'}`;
    return true;
  } catch (_error) {
    item.weatherSummary = 'Weather unavailable';
    item.countryFactsSummary = 'Country facts unavailable';
    return false;
  }
}

function renderBookings() {
  bookingsListEl.innerHTML = '';
  renderHomeKpis();
  if (state.bookings.length === 0) {
    bookingsListEl.innerHTML = '<p>No bookings yet. Your first customer is one click away.</p>';
    return;
  }

  for (const item of state.bookings.slice(0, 8)) {
    const row = document.createElement('div');
    row.className = 'booking-item';
    row.innerHTML = `
      <span>${item.customerName} booked ${item.destinationName || `destination #${item.destinationId}`}</span>
      <strong>${item.seats} traveler(s) · ${formatCurrency(item.totalPrice)}</strong>
    `;
    bookingsListEl.appendChild(row);
  }
}

function openDialog(destination) {
  formMessageEl.textContent = '';
  document.getElementById('destinationId').value = destination.id;
  document.getElementById('destinationName').value = destination.name;
  dialog.showModal();
}

function openDestinationFromHash() {
  const hash = window.location.hash || '';
  if (!hash.startsWith('#destination-')) {
    return;
  }

  const destinationId = Number(hash.replace('#destination-', ''));
  if (!Number.isInteger(destinationId) || destinationId <= 0) {
    return;
  }

  const destination = state.destinations.find((item) => item.id === destinationId);
  if (!destination) {
    return;
  }

  openDialog(destination);
}

function updateAvailability(eventPayload) {
  const destination = state.destinations.find((item) => item.id === eventPayload.id);
  if (!destination) {
    return;
  }
  destination.availableSlots = eventPayload.availableSlots;
  destination.totalSlots = eventPayload.totalSlots;
  renderDestinations();
}

async function loadData() {
  const [destinationsRes, bookingsRes] = await Promise.all([
    fetch('/api/destinations'),
    fetch('/api/bookings'),
  ]);

  state.destinations = await destinationsRes.json();
  state.bookings = await bookingsRes.json();
  renderDestinations();
  renderFavoritesShelf();
  renderHomeInspirationGallery();
  renderBookings();
  openDestinationFromHash();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formMessageEl.textContent = 'Submitting booking...';

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(state.authToken ? { Authorization: `Bearer ${state.authToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      formMessageEl.textContent = data.errors?.join(' ') || 'Booking failed.';
      return;
    }

    formMessageEl.textContent = 'Booking confirmed.';
    form.reset();
    setTimeout(() => {
      dialog.close();
      formMessageEl.textContent = '';
    }, 600);
  } catch (error) {
    formMessageEl.textContent = 'Network error. Try again.';
  }
});

closeDialogBtn.addEventListener('click', () => dialog.close());
viewBookingsBtn.addEventListener('click', () => {
  document.querySelector('.booking-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(authForm);
  const payload = Object.fromEntries(formData.entries());

  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();

  if (!response.ok) {
    authStatusEl.textContent = data.errors?.join(' ') || 'Unable to sign in.';
    return;
  }

  setAuthState(data.token, data.user);
});

signupBtn.addEventListener('click', async () => {
  const formData = new FormData(authForm);
  const payload = Object.fromEntries(formData.entries());

  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();

  if (!response.ok) {
    authStatusEl.textContent = data.errors?.join(' ') || 'Unable to sign up.';
    return;
  }

  setAuthState(data.token, data.user);
});

signoutBtn.addEventListener('click', () => {
  setAuthState('', null);
});

const socket = io();

socket.on('connect', () => {
  state.socketConnected = true;
  renderDestinations();
});

socket.on('disconnect', () => {
  state.socketConnected = false;
  renderDestinations();
});

socket.on('availability:update', (payload) => {
  updateAvailability(payload);
});

socket.on('booking:created', (booking) => {
  state.bookings.unshift(booking);
  renderBookings();
});

if (homeThemeFiltersEl) {
  homeThemeFiltersEl.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const theme = target.dataset.theme;
    if (!theme) {
      return;
    }

    state.activeTheme = theme;

    homeThemeFiltersEl
      .querySelectorAll('.filter-chip')
      .forEach((chip) => chip.classList.remove('active'));
    target.classList.add('active');

    syncHomeQueryParams();
    renderDestinations();
  });
}

if (copyHomeLinkBtn) {
  copyHomeLinkBtn.addEventListener('click', async () => {
    syncHomeQueryParams();
    try {
      await navigator.clipboard.writeText(window.location.href);
      copyHomeLinkBtn.textContent = 'Copied';
      setTimeout(() => {
        copyHomeLinkBtn.textContent = 'Copy Home View';
      }, 1200);
    } catch (_error) {
      copyHomeLinkBtn.textContent = 'Copy failed';
      setTimeout(() => {
        copyHomeLinkBtn.textContent = 'Copy Home View';
      }, 1200);
    }
  });
}

let freshnessTickerId = null;

function tickFreshnessLabels() {
  if (state.destinations.some((item) => item.insightsUpdatedAt)) {
    renderDestinations();
  }
}

function startFreshnessTicker() {
  if (freshnessTickerId !== null) {
    return;
  }
  freshnessTickerId = setInterval(tickFreshnessLabels, 30_000);
}

function stopFreshnessTicker() {
  if (freshnessTickerId === null) {
    return;
  }
  clearInterval(freshnessTickerId);
  freshnessTickerId = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopFreshnessTicker();
    return;
  }

  tickFreshnessLabels();
  renderFavoritesShelf();
  startFreshnessTicker();
});

startFreshnessTicker();

applyHomeQueryParams();

loadCurrentUser()
  .catch(() => {
    setAuthState('', null);
  })
  .finally(loadData);
