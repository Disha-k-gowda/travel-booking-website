const path = require('node:path');
const express = require('express');
const http = require('node:http');
const { Server } = require('socket.io');
const { createDatabase } = require('./db');
const { createBooking, cancelBooking } = require('./bookingService');
const { registerUser, loginUser, authMiddleware } = require('./authService');
const { getDestinationWeather } = require('./weatherService');
const { getDestinationInsights } = require('./freeApis');

function createApp(options = {}) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const db = options.db || createDatabase(options.dbPath);

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

  app.get('/api/destinations', (req, res) => {
    const destinations = db.prepare('SELECT * FROM destinations ORDER BY id').all();
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

    try {
      const insights = await getDestinationInsights(destination);
      return res.json({ destinationId: destination.id, insights });
    } catch (_error) {
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

    return res.json(destination);
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
