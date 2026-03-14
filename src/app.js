const path = require('node:path');
const express = require('express');
const http = require('node:http');
const { Server } = require('socket.io');
const { createDatabase } = require('./db');
const { createBooking, cancelBooking } = require('./bookingService');
const { registerUser, loginUser, authMiddleware } = require('./authService');
const { getDestinationWeather } = require('./weatherService');
const { getDestinationInsights } = require('./freeApis');

const INSIGHTS_TTL_MS = 20 * 60 * 1000;

function detectTripTheme(destination) {
  const text = `${destination.name} ${destination.description}`.toLowerCase();
  if (/(alpine|glacier|fjord|mountain|frontier|aurora|snow|expedition)/.test(text)) {
    return 'adventure';
  }
  if (/(heritage|temple|medina|legacy|old-town|cultural|district)/.test(text)) {
    return 'culture';
  }
  if (/(wellness|retreat|lagoon|beach|coastal|island|spa)/.test(text)) {
    return 'relax';
  }
  return 'balanced';
}

function parseGalleryImages(raw, fallbackImageUrl) {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw;
  }

  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((value) => typeof value === 'string' && value.trim());
      }
    } catch (_error) {
      // Ignore malformed gallery data and fallback to the primary image.
    }
  }

  return fallbackImageUrl ? [fallbackImageUrl] : [];
}

function normalizeDestination(row) {
  if (!row) {
    return row;
  }

  const galleryImages = parseGalleryImages(row.galleryImages, row.imageUrl);
  return {
    ...row,
    galleryImages,
  };
}

function toPositiveInt(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  if (parsed < min) {
    return min;
  }
  if (parsed > max) {
    return max;
  }
  return parsed;
}

function createApp(options = {}) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const db = options.db || createDatabase(options.dbPath);
  const insightsCache = new Map();

  app.use(express.json());
  app.use(express.static(path.join(process.cwd(), 'public')));
  app.use(authMiddleware(db));

  app.post('/api/auth/register', (req, res) => {
    const result = registerUser(db, req.body);
    if (!result.ok) {
      return res.status(result.status).json({ errors: result.errors });
    }
    return res.status(result.status).json({ token: result.token, user: result.user });
  });

  app.post('/api/auth/login', (req, res) => {
    const result = loginUser(db, req.body);
    if (!result.ok) {
      return res.status(result.status).json({ errors: result.errors });
    }
    return res.status(result.status).json({ token: result.token, user: result.user });
  });

  app.get('/api/auth/me', (req, res) => {
    if (!req.user) {
      return res.status(401).json({ errors: ['Unauthorized.'] });
    }
    return res.json(req.user);
  });

  app.get('/api/health', (_req, res) => {
    const counts = db
      .prepare(
        `
        SELECT
          (SELECT COUNT(*) FROM destinations) AS destinations,
          (SELECT COUNT(*) FROM bookings) AS bookings,
          (SELECT COUNT(*) FROM users) AS users
        `,
      )
      .get();

    res.json({
      ok: true,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      counts,
    });
  });

  app.get('/api/destinations', (req, res) => {
    const query = String(req.query.q || '').trim().toLowerCase();
    const theme = String(req.query.theme || 'all').trim().toLowerCase();
    const availability = String(req.query.availability || 'all').trim().toLowerCase();
    const sort = String(req.query.sort || 'popular').trim();
    const page = toPositiveInt(req.query.page, 1, { min: 1, max: 1000 });
    const limit = toPositiveInt(req.query.limit, 100, { min: 1, max: 100 });
    const hasExplicitPagination = req.query.page !== undefined || req.query.limit !== undefined;

    let destinations = db
      .prepare('SELECT * FROM destinations ORDER BY id')
      .all()
      .map((item) => normalizeDestination(item));

    if (query) {
      destinations = destinations.filter((item) => {
        const haystack = `${item.name} ${item.country} ${item.description}`.toLowerCase();
        return haystack.includes(query);
      });
    }

    if (theme !== 'all') {
      destinations = destinations.filter((item) => detectTripTheme(item) === theme);
    }

    if (availability === 'available') {
      destinations = destinations.filter((item) => item.availableSlots > 0);
    } else if (availability === 'limited') {
      destinations = destinations.filter((item) => item.availableSlots > 0 && item.availableSlots <= 10);
    } else if (availability === 'soldout') {
      destinations = destinations.filter((item) => item.availableSlots === 0);
    }

    if (sort === 'priceAsc') {
      destinations.sort((a, b) => a.basePrice - b.basePrice);
    } else if (sort === 'priceDesc') {
      destinations.sort((a, b) => b.basePrice - a.basePrice);
    } else if (sort === 'availabilityDesc') {
      destinations.sort((a, b) => b.availableSlots - a.availableSlots);
    } else if (sort === 'nameAsc') {
      destinations.sort((a, b) => a.name.localeCompare(b.name));
    }

    const total = destinations.length;
    if (hasExplicitPagination) {
      const start = (page - 1) * limit;
      const end = start + limit;
      destinations = destinations.slice(start, end);
      res.setHeader('X-Total-Count', String(total));
      res.setHeader('X-Page', String(page));
      res.setHeader('X-Limit', String(limit));
    }

    res.json(destinations);
  });

  app.get('/api/availability', (req, res) => {
    const availability = db
      .prepare('SELECT id, name, totalSlots, availableSlots FROM destinations ORDER BY id')
      .all();
    res.json(availability);
  });

  app.get('/api/destinations/:id/weather', async (req, res) => {
    const destinationId = Number(req.params.id);
    if (!Number.isInteger(destinationId) || destinationId <= 0) {
      return res.status(400).json({ errors: ['Invalid destination id.'] });
    }

    const destination = db
      .prepare('SELECT id, name, country FROM destinations WHERE id = ?')
      .get(destinationId);
    if (!destination) {
      return res.status(404).json({ errors: ['Destination not found.'] });
    }

    try {
      const weather = await getDestinationWeather(destination);
      return res.json(weather);
    } catch (_error) {
      return res.status(502).json({ errors: ['Unable to fetch weather right now.'] });
    }
  });

  app.get('/api/destinations/:id/insights', async (req, res) => {
    const destinationId = Number(req.params.id);
    if (!Number.isInteger(destinationId) || destinationId <= 0) {
      return res.status(400).json({ errors: ['Invalid destination id.'] });
    }

    const destination = db
      .prepare('SELECT id, name, country FROM destinations WHERE id = ?')
      .get(destinationId);

    if (!destination) {
      return res.status(404).json({ errors: ['Destination not found.'] });
    }

    const refresh = String(req.query.refresh || '').trim() === '1';
    const now = Date.now();
    const cached = insightsCache.get(destinationId);

    if (!refresh && cached && cached.expiresAt > now) {
      return res.json({
        destinationId: destination.id,
        insights: cached.insights,
        cached: true,
        cachedAt: cached.cachedAt,
      });
    }

    try {
      const insights = await getDestinationInsights(destination);
      const cachedAt = new Date().toISOString();
      insightsCache.set(destinationId, {
        insights,
        cachedAt,
        expiresAt: now + INSIGHTS_TTL_MS,
      });

      return res.json({
        destinationId: destination.id,
        insights,
        cached: false,
        cachedAt,
      });
    } catch (_error) {
      if (cached) {
        return res.json({
          destinationId: destination.id,
          insights: cached.insights,
          cached: true,
          stale: true,
          cachedAt: cached.cachedAt,
        });
      }
      return res.status(502).json({ errors: ['Unable to fetch free travel insights right now.'] });
    }
  });

  app.get('/api/destinations/:id', (req, res) => {
    const destinationId = Number(req.params.id);
    if (!Number.isInteger(destinationId) || destinationId <= 0) {
      return res.status(400).json({ errors: ['Invalid destination id.'] });
    }

    const destination = db
      .prepare(
        `
        SELECT
          d.*,
          COALESCE(SUM(CASE WHEN b.status = 'confirmed' THEN 1 ELSE 0 END), 0) AS confirmedBookings,
          COALESCE(SUM(CASE WHEN b.status = 'confirmed' THEN b.seats ELSE 0 END), 0) AS confirmedTravelers,
          COALESCE(SUM(CASE WHEN b.status = 'cancelled' THEN b.seats ELSE 0 END), 0) AS cancelledTravelers
        FROM destinations d
        LEFT JOIN bookings b ON b.destinationId = d.id
        WHERE d.id = ?
        GROUP BY d.id
        `,
      )
      .get(destinationId);

    if (!destination) {
      return res.status(404).json({ errors: ['Destination not found.'] });
    }

    return res.json(normalizeDestination(destination));
  });

  app.get('/api/bookings', (req, res) => {
    const bookings = db
      .prepare(
        `
        SELECT b.*, d.name as destinationName
        FROM bookings b
        JOIN destinations d ON b.destinationId = d.id
        ORDER BY b.createdAt DESC
        `,
      )
      .all();
    res.json(bookings);
  });

  app.get('/api/bookings/search', (req, res) => {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ errors: ['email query is required.'] });
    }

    const bookings = db
      .prepare(
        `
        SELECT b.*, d.name as destinationName
        FROM bookings b
        JOIN destinations d ON b.destinationId = d.id
        WHERE b.email = ?
        ORDER BY b.createdAt DESC
        `,
      )
      .all(email);

    return res.json(bookings);
  });

  app.get('/api/stats', (req, res) => {
    const summary = db
      .prepare(
        `
        SELECT
          COUNT(*) AS totalBookings,
          SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmedBookings,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelledBookings,
          COALESCE(SUM(CASE WHEN status = 'confirmed' THEN totalPrice ELSE 0 END), 0) AS grossRevenue
        FROM bookings
        `,
      )
      .get();

    const inventory = db
      .prepare(
        `
        SELECT
          COALESCE(SUM(totalSlots), 0) AS totalSlots,
          COALESCE(SUM(availableSlots), 0) AS availableSlots
        FROM destinations
        `,
      )
      .get();

    return res.json({
      ...summary,
      ...inventory,
      bookedSlots: Math.max(0, inventory.totalSlots - inventory.availableSlots),
    });
  });

  app.post('/api/bookings', (req, res) => {
    const payload = {
      ...req.body,
      destinationId: Number(req.body.destinationId),
      seats: Number(req.body.seats),
      userId: req.user?.id,
      customerName: req.user?.name || req.body.customerName,
      email: req.user?.email || req.body.email,
    };

    const result = createBooking(db, payload);
    if (!result.ok) {
      return res.status(result.status).json({ errors: result.errors });
    }

    const availability = db
      .prepare('SELECT id, availableSlots, totalSlots FROM destinations WHERE id = ?')
      .get(result.booking.destinationId);

    io.emit('availability:update', availability);
    io.emit('booking:created', result.booking);

    return res.status(result.status).json(result.booking);
  });

  app.post('/api/bookings/:id/cancel', (req, res) => {
    const bookingId = Number(req.params.id);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ errors: ['Invalid booking id.'] });
    }

    const result = cancelBooking(db, bookingId);
    if (!result.ok) {
      return res.status(result.status).json({ errors: result.errors });
    }

    const booking = db.prepare('SELECT destinationId FROM bookings WHERE id = ?').get(bookingId);
    const availability = db
      .prepare('SELECT id, availableSlots, totalSlots FROM destinations WHERE id = ?')
      .get(booking.destinationId);

    io.emit('availability:update', availability);
    io.emit('booking:cancelled', { bookingId });

    return res.status(200).json({ ok: true });
  });

  return { app, server, io, db };
}

module.exports = { createApp };
