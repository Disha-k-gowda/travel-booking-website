const managementListEl = document.getElementById('managementList');
const bookingsSummaryEl = document.getElementById('bookingsSummary');
const statsGridEl = document.getElementById('statsGrid');
const searchFormEl = document.getElementById('searchForm');
const emailQueryEl = document.getElementById('emailQuery');
const clearSearchBtn = document.getElementById('clearSearch');
const copyBookingsLinkBtn = document.getElementById('copyBookingsLink');
const bookingsHealthCopyEl = document.getElementById('bookingsHealthCopy');
const bookingsHealthConfirmedBarEl = document.getElementById('bookingsHealthConfirmedBar');
const bookingsHealthCancelledBarEl = document.getElementById('bookingsHealthCancelledBar');
const bookingsHealthConfirmedValueEl = document.getElementById('bookingsHealthConfirmedValue');
const bookingsHealthCancelledValueEl = document.getElementById('bookingsHealthCancelledValue');

const state = {
  bookings: [],
  activeEmail: '',
};

function syncBookingsQueryParams() {
  const params = new URLSearchParams();
  if (state.activeEmail) {
    params.set('email', state.activeEmail);
  }
  const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
  window.history.replaceState({}, '', nextUrl);
}

function applyBookingsQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const email = String(params.get('email') || '').trim().toLowerCase();
  state.activeEmail = email;
  emailQueryEl.value = email;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
}

function renderBookingHealth(stats) {
  if (
    !bookingsHealthCopyEl ||
    !bookingsHealthConfirmedBarEl ||
    !bookingsHealthCancelledBarEl ||
    !bookingsHealthConfirmedValueEl ||
    !bookingsHealthCancelledValueEl
  ) {
    return;
  }

  const total = Number(stats?.totalBookings || 0);
  const confirmed = Number(stats?.confirmedBookings || 0);
  const cancelled = Number(stats?.cancelledBookings || 0);
  const confirmedPct = total > 0 ? Math.round((confirmed / total) * 100) : 0;
  const cancelledPct = total > 0 ? Math.round((cancelled / total) * 100) : 0;

  bookingsHealthConfirmedBarEl.style.width = `${confirmedPct}%`;
  bookingsHealthCancelledBarEl.style.width = `${cancelledPct}%`;
  bookingsHealthConfirmedValueEl.textContent = `${confirmedPct}%`;
  bookingsHealthCancelledValueEl.textContent = `${cancelledPct}%`;
  bookingsHealthCopyEl.textContent =
    total > 0
      ? `${confirmed} confirmed and ${cancelled} cancelled out of ${total} total bookings.`
      : 'No bookings yet. Create your first reservation from Home.';
}

async function fetchStats() {
  const response = await fetch('/api/stats');
  if (!response.ok) {
    return null;
  }
  return response.json();
}

function renderStats(stats) {
  if (!stats) {
    statsGridEl.innerHTML = '<article class="stat-card"><h4>Stats unavailable</h4></article>';
    renderBookingHealth(null);
    return;
  }

  const cards = [
    { label: 'Total Bookings', value: String(stats.totalBookings || 0) },
    { label: 'Confirmed', value: String(stats.confirmedBookings || 0) },
    { label: 'Cancelled', value: String(stats.cancelledBookings || 0) },
    { label: 'Gross Revenue', value: formatCurrency(stats.grossRevenue || 0) },
    { label: 'Booked Seats', value: String(stats.bookedSlots || 0) },
    { label: 'Available Seats', value: String(stats.availableSlots || 0) },
  ];

  statsGridEl.innerHTML = cards
    .map(
      (card) =>
        `<article class="stat-card"><p class="stat-label">${card.label}</p><h4>${card.value}</h4></article>`,
    )
    .join('');

  renderBookingHealth(stats);
}

function renderBookings() {
  managementListEl.innerHTML = '';

  if (state.bookings.length === 0) {
    bookingsSummaryEl.textContent = 'No booking records found.';
    managementListEl.innerHTML = '<p>No matching bookings.</p>';
    return;
  }

  bookingsSummaryEl.textContent = `${state.bookings.length} booking(s)`;

  for (const booking of state.bookings) {
    const row = document.createElement('div');
    row.className = 'booking-item management-item';

    const canCancel = booking.status === 'confirmed';

    row.innerHTML = `
      <div>
        <strong>${booking.customerName}</strong>
        <p>${booking.destinationName || `Destination #${booking.destinationId}`}</p>
        <p>${booking.email} · ${booking.seats} traveler(s)</p>
        <p>${formatDate(booking.createdAt)}</p>
      </div>
      <div class="booking-controls">
        <span class="status-pill ${booking.status}">${booking.status}</span>
        <strong>${formatCurrency(booking.totalPrice)}</strong>
        <button class="ghost-btn cancel-btn" ${canCancel ? '' : 'disabled'}>Cancel Booking</button>
      </div>
    `;

    row.querySelector('.cancel-btn').addEventListener('click', async () => {
      if (!canCancel) {
        return;
      }
      const response = await fetch(`/api/bookings/${booking.id}/cancel`, { method: 'POST' });
      if (response.ok) {
        await loadAllData();
      }
    });

    managementListEl.appendChild(row);
  }
}

async function loadBookings(email) {
  const endpoint = email ? `/api/bookings/search?email=${encodeURIComponent(email)}` : '/api/bookings';
  const response = await fetch(endpoint);
  if (!response.ok) {
    return [];
  }
  return response.json();
}

async function loadAllData(email) {
  state.activeEmail = String(email || '').trim().toLowerCase();
  syncBookingsQueryParams();
  const [bookings, stats] = await Promise.all([loadBookings(email), fetchStats()]);
  state.bookings = bookings;
  renderBookings();
  renderStats(stats);
}

searchFormEl.addEventListener('submit', async (event) => {
  event.preventDefault();
  await loadAllData(emailQueryEl.value.trim());
});

clearSearchBtn.addEventListener('click', async () => {
  emailQueryEl.value = '';
  await loadAllData('');
});

if (copyBookingsLinkBtn) {
  copyBookingsLinkBtn.addEventListener('click', async () => {
    syncBookingsQueryParams();
    try {
      await navigator.clipboard.writeText(window.location.href);
      copyBookingsLinkBtn.textContent = 'Copied';
      setTimeout(() => {
        copyBookingsLinkBtn.textContent = 'Copy Results Link';
      }, 1200);
    } catch (_error) {
      copyBookingsLinkBtn.textContent = 'Copy failed';
      setTimeout(() => {
        copyBookingsLinkBtn.textContent = 'Copy Results Link';
      }, 1200);
    }
  });
}

applyBookingsQueryParams();
loadAllData(state.activeEmail);
