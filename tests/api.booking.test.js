const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const { createApp } = require('../src/app');

const testDbPath = path.join(process.cwd(), 'data', 'test.sqlite');

function removeTestDb() {
  if (fs.existsSync(testDbPath)) {
    fs.rmSync(testDbPath, { force: true });
  }
}

describe('Booking API', () => {
  let appContext;

  beforeEach(() => {
    removeTestDb();
    appContext = createApp({ dbPath: testDbPath });
  });

  afterEach(() => {
    appContext.io.close();
    appContext.server.close();
    appContext.db.close();
    removeTestDb();
  });

  test('creates a booking and updates availability', async () => {
    const destinations = await request(appContext.app).get('/api/destinations');
    const destination = destinations.body[0];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 2);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 5);

    const response = await request(appContext.app)
      .post('/api/bookings')
      .send({
        destinationId: destination.id,
        customerName: 'Grace Hopper',
        email: 'grace@example.com',
        seats: 2,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
      });

    expect(response.status).toBe(201);

    const availability = await request(appContext.app).get('/api/availability');
    const updated = availability.body.find((item) => item.id === destination.id);
    expect(updated.availableSlots).toBe(destination.availableSlots - 2);
  });

  test('registers and logs in a user', async () => {
    const register = await request(appContext.app)
      .post('/api/auth/register')
      .send({
        name: 'Jamie Doe',
        email: 'jamie@example.com',
        password: 'strongpass123',
      });

    expect(register.status).toBe(201);
    expect(register.body.user.email).toBe('jamie@example.com');
    expect(register.body.token).toBeTruthy();

    const login = await request(appContext.app)
      .post('/api/auth/login')
      .send({
        email: 'jamie@example.com',
        password: 'strongpass123',
      });

    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
  });

  test('blocks overbooking requests', async () => {
    const destinations = await request(appContext.app).get('/api/destinations');
    const destination = destinations.body[0];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 2);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 4);

    const response = await request(appContext.app)
      .post('/api/bookings')
      .send({
        destinationId: destination.id,
        customerName: 'Elena',
        email: 'elena@example.com',
        seats: destination.availableSlots + 1,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
      });

    expect(response.status).toBe(400);
  });

  test('supports search by traveler email and stats aggregation', async () => {
    const destinations = await request(appContext.app).get('/api/destinations');
    const destination = destinations.body[0];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 2);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 4);

    await request(appContext.app)
      .post('/api/bookings')
      .send({
        destinationId: destination.id,
        customerName: 'Lin',
        email: 'lin@example.com',
        seats: 1,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
      })
      .expect(201);

    const search = await request(appContext.app).get('/api/bookings/search?email=lin@example.com');
    expect(search.status).toBe(200);
    expect(search.body.length).toBe(1);
    expect(search.body[0].email).toBe('lin@example.com');

    const stats = await request(appContext.app).get('/api/stats');
    expect(stats.status).toBe(200);
    expect(stats.body.totalBookings).toBeGreaterThanOrEqual(1);
    expect(stats.body.grossRevenue).toBeGreaterThan(0);
  });

  test('returns destination details with metrics', async () => {
    const destinations = await request(appContext.app).get('/api/destinations');
    const destination = destinations.body[0];

    const details = await request(appContext.app).get(`/api/destinations/${destination.id}`);
    expect(details.status).toBe(200);
    expect(details.body.id).toBe(destination.id);
    expect(details.body.name).toBeTruthy();
    expect(details.body.confirmedBookings).toBeGreaterThanOrEqual(0);
  });

  test('supports health checks and destination query filters', async () => {
    const health = await request(appContext.app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.ok).toBe(true);
    expect(health.body.counts.destinations).toBeGreaterThanOrEqual(1);

    const filtered = await request(appContext.app).get('/api/destinations?theme=adventure&limit=3&page=1');
    expect(filtered.status).toBe(200);
    expect(Array.isArray(filtered.body)).toBe(true);
    expect(filtered.body.length).toBeLessThanOrEqual(3);

    const first = filtered.body[0];
    if (first) {
      expect(Array.isArray(first.galleryImages)).toBe(true);
      expect(first.galleryImages.length).toBeGreaterThan(0);
    }
  });
});
