const params = new URLSearchParams(window.location.search);
const destinationId = Number(params.get('id'));

const destinationTitleEl = document.getElementById('destinationTitle');
const destinationSubtitleEl = document.getElementById('destinationSubtitle');
const detailImageEl = document.getElementById('detailImage');
const detailNameEl = document.getElementById('detailName');
const detailDescriptionEl = document.getElementById('detailDescription');
const detailMetaEl = document.getElementById('detailMeta');
const destinationStatsEl = document.getElementById('destinationStats');
const insightsUpdatedEl = document.getElementById('insightsUpdated');
const weatherSummaryEl = document.getElementById('weatherSummary');
const countryFactsEl = document.getElementById('countryFacts');
const countryLanguagesEl = document.getElementById('countryLanguages');
const refreshInsightsBtn = document.getElementById('refreshInsightsBtn');
const bookFromDetailsLinkEl = document.getElementById('bookFromDetailsLink');
const reserveNowLinkEl = document.getElementById('reserveNowLink');
const relatedGridEl = document.getElementById('relatedGrid');
const relatedSummaryEl = document.getElementById('relatedSummary');
const relatedTemplate = document.getElementById('relatedCardTemplate');
const itineraryTimelineEl = document.getElementById('itineraryTimeline');
const itineraryStepTemplate = document.getElementById('itineraryStepTemplate');

let currentDestination = null;

function getSeasonLabel(monthIndex) {
  if (monthIndex <= 1 || monthIndex === 11) {
    return 'winter';
  }
  if (monthIndex >= 2 && monthIndex <= 4) {
    return 'spring';
  }
  if (monthIndex >= 5 && monthIndex <= 7) {
    return 'summer';
  }
  return 'autumn';
}

function detectTripTheme(destination) {
  const text = `${destination.name} ${destination.description}`.toLowerCase();
  if (/(alpine|glacier|fjord|mountain|frontier|aurora|snow)/.test(text)) {
    return 'adventure';
  }
  if (/(heritage|temple|medina|legacy|old-town|cultural)/.test(text)) {
    return 'culture';
  }
  if (/(wellness|retreat|lagoon|beach|coastal|island)/.test(text)) {
    return 'relax';
  }
  return 'balanced';
}

function buildItinerary(destination) {
  const season = getSeasonLabel(new Date().getMonth());
  const theme = detectTripTheme(destination);

  const byTheme = {
    adventure: [
      {
        day: 'Day 1',
        title: 'Arrival + Scenic Orientation',
        note: `Check in and start with a guided scenic route suited for ${season} conditions.`,
      },
      {
        day: 'Day 2',
        title: 'Signature Outdoor Expedition',
        note: 'Plan a full-day hike/cruise/rail adventure with photo and recovery stops.',
      },
      {
        day: 'Day 3',
        title: 'Flexible Exploration + Departure',
        note: 'Keep a half-day buffer for weather shifts, then close with a local tasting.',
      },
    ],
    culture: [
      {
        day: 'Day 1',
        title: 'District Walk + Local Welcome',
        note: `Begin with a heritage walk and curated neighborhood food route for ${season}.`,
      },
      {
        day: 'Day 2',
        title: 'Landmark and Artisan Day',
        note: 'Visit core monuments, then reserve time for workshops and local crafts.',
      },
      {
        day: 'Day 3',
        title: 'Slow Morning + Signature Finale',
        note: 'Wrap with a slower morning and one high-impact cultural experience.',
      },
    ],
    relax: [
      {
        day: 'Day 1',
        title: 'Recovery Arrival Flow',
        note: `Ease in with spa/beach/pool time and a light sunset program (${season} mode).`,
      },
      {
        day: 'Day 2',
        title: 'Wellness + Nature Balance',
        note: 'Pair a wellness block with a gentle nature excursion and early evening dining.',
      },
      {
        day: 'Day 3',
        title: 'Mindful Closeout',
        note: 'Reserve final hours for unplanned relaxation before airport transfer.',
      },
    ],
    balanced: [
      {
        day: 'Day 1',
        title: 'Arrival + City Orientation',
        note: `Take a compact orientation tour and map key neighborhoods for ${season}.`,
      },
      {
        day: 'Day 2',
        title: 'Core Experience Day',
        note: 'Build the day around one anchor activity plus a local dining sequence.',
      },
      {
        day: 'Day 3',
        title: 'Open Slot + Departure',
        note: 'Use final hours for shopping or viewpoints with a stress-free transfer plan.',
      },
    ],
  };

  return byTheme[theme] || byTheme.balanced;
}

function renderItinerary(destination) {
  const itinerary = buildItinerary(destination);
  itineraryTimelineEl.innerHTML = '';

  for (const step of itinerary) {
    const fragment = itineraryStepTemplate.content.cloneNode(true);
    fragment.querySelector('.step-day').textContent = step.day;
    fragment.querySelector('.step-title').textContent = step.title;
    fragment.querySelector('.step-note').textContent = step.note;
    itineraryTimelineEl.appendChild(fragment);
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatUpdated(value) {
  if (!value) {
    return 'Not updated yet';
  }
  const date = new Date(value);
  return `Updated ${date.toLocaleString()}`;
}

function ensureValidId() {
  if (!Number.isInteger(destinationId) || destinationId <= 0) {
    destinationTitleEl.textContent = 'Destination not found';
    destinationSubtitleEl.textContent = 'Please return to Trips and choose a destination.';
    refreshInsightsBtn.disabled = true;
    return false;
  }
  return true;
}

function renderDestination(destination) {
  currentDestination = destination;
  destinationTitleEl.textContent = `${destination.name} · ${destination.country}`;
  destinationSubtitleEl.textContent = 'Detailed travel profile with performance and insight signals.';
  detailImageEl.src = destination.imageUrl;
  detailNameEl.textContent = destination.name;
  detailDescriptionEl.textContent = destination.description;

  detailMetaEl.innerHTML = `
    <span class="status-pill confirmed">${formatCurrency(destination.basePrice)} per night</span>
    <span class="status-pill">${destination.availableSlots}/${destination.totalSlots} seats available</span>
    <span class="status-pill">${destination.country}</span>
  `;

  bookFromDetailsLinkEl.href = `/index.html#destination-${destination.id}`;
  reserveNowLinkEl.href = `/index.html#destination-${destination.id}`;

  const stats = [
    { label: 'Confirmed Bookings', value: destination.confirmedBookings || 0 },
    { label: 'Confirmed Travelers', value: destination.confirmedTravelers || 0 },
    { label: 'Cancelled Travelers', value: destination.cancelledTravelers || 0 },
    { label: 'Live Availability', value: `${destination.availableSlots}/${destination.totalSlots}` },
  ];

  destinationStatsEl.innerHTML = stats
    .map((item) => `<article class="stat-card"><p class="stat-label">${item.label}</p><h4>${item.value}</h4></article>`)
    .join('');

  renderItinerary(destination);
}

async function loadInsights() {
  if (!currentDestination) {
    return;
  }

  refreshInsightsBtn.disabled = true;
  refreshInsightsBtn.textContent = 'Refreshing...';

  try {
    const response = await fetch(`/api/destinations/${currentDestination.id}/insights`);
    if (!response.ok) {
      weatherSummaryEl.textContent = 'Unavailable';
      countryFactsEl.textContent = 'Unavailable';
      countryLanguagesEl.textContent = 'Unavailable';
      return;
    }

    const payload = await response.json();
    const insights = payload.insights || {};
    const country = insights.country || {};

    weatherSummaryEl.textContent = insights.weather?.summary || 'Unavailable';
    countryFactsEl.textContent = `${country.capital || 'N/A'} · ${country.currency || 'N/A'} · ${country.timezone || 'N/A'}`;
    countryLanguagesEl.textContent = country.languages || 'N/A';
    insightsUpdatedEl.textContent = formatUpdated(new Date().toISOString());
  } catch (_error) {
    weatherSummaryEl.textContent = 'Unavailable';
    countryFactsEl.textContent = 'Unavailable';
    countryLanguagesEl.textContent = 'Unavailable';
  } finally {
    refreshInsightsBtn.disabled = false;
    refreshInsightsBtn.textContent = 'Refresh Live Insights';
  }
}

function renderRelated(destinations) {
  relatedGridEl.innerHTML = '';
  if (destinations.length === 0) {
    relatedSummaryEl.textContent = 'No related destinations found.';
    return;
  }

  relatedSummaryEl.textContent = `${destinations.length} suggestion(s)`;

  for (const item of destinations) {
    const fragment = relatedTemplate.content.cloneNode(true);
    fragment.querySelector('img').src = item.imageUrl;
    fragment.querySelector('.name').textContent = item.name;
    fragment.querySelector('.country').textContent = item.country;
    fragment.querySelector('.description').textContent = item.description;
    fragment.querySelector('.price').textContent = `${formatCurrency(item.basePrice)} / night`;
    fragment.querySelector('.availability').textContent = `${item.availableSlots}/${item.totalSlots} seats`;
    fragment.querySelector('.link-btn').href = `/destination.html?id=${item.id}`;
    relatedGridEl.appendChild(fragment);
  }
}

async function loadRelated() {
  if (!currentDestination) {
    return;
  }

  const response = await fetch('/api/destinations');
  const all = await response.json();

  const related = all
    .filter((item) => item.id !== currentDestination.id)
    .sort((a, b) => Math.abs(a.basePrice - currentDestination.basePrice) - Math.abs(b.basePrice - currentDestination.basePrice))
    .slice(0, 3);

  renderRelated(related);
}

async function boot() {
  if (!ensureValidId()) {
    return;
  }

  const response = await fetch(`/api/destinations/${destinationId}`);
  if (!response.ok) {
    destinationTitleEl.textContent = 'Destination not found';
    destinationSubtitleEl.textContent = 'This destination may have been removed.';
    refreshInsightsBtn.disabled = true;
    return;
  }

  const destination = await response.json();
  renderDestination(destination);
  await Promise.all([loadInsights(), loadRelated()]);
}

refreshInsightsBtn.addEventListener('click', loadInsights);

boot();
