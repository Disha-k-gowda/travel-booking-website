const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const DESTINATION_CATALOG = [
  [
    'Santorini Escape',
    'Greece',
    36.3932,
    25.4615,
    'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1400&q=80',
    'Sunset cliff stays, volcanic beaches, and whitewashed luxury suites.',
    220,
    30,
    30,
  ],
  [
    'Kyoto Heritage',
    'Japan',
    35.0116,
    135.7681,
    'https://images.unsplash.com/photo-1492571350019-22de08371fd3?auto=format&fit=crop&w=1400&q=80',
    'Temple district journeys and curated cultural experiences in every season.',
    180,
    24,
    24,
  ],
  [
    'Bali Wellness Retreat',
    'Indonesia',
    -8.4095,
    115.1889,
    'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1400&q=80',
    'Rice terrace villas, guided wellness plans, and private beach transfers.',
    200,
    28,
    28,
  ],
  [
    'Swiss Alpine Loop',
    'Switzerland',
    46.8182,
    8.2275,
    'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1400&q=80',
    'Scenic mountain rail routes with premium lodges and guided day trips.',
    260,
    20,
    20,
  ],
  [
    'Reykjavik Aurora Nights',
    'Iceland',
    64.1466,
    -21.9426,
    'https://images.unsplash.com/photo-1476611338391-6f395a0ebc7b?auto=format&fit=crop&w=1400&q=80',
    'Geothermal lagoons, ice cave day tours, and northern lights photography nights.',
    280,
    18,
    18,
  ],
  [
    'Marrakech Riad Trails',
    'Morocco',
    31.6295,
    -7.9811,
    'https://images.unsplash.com/photo-1597212618440-806262de4f6b?auto=format&fit=crop&w=1400&q=80',
    'Medina stays, Atlas foothill excursions, and artisan-led culinary evenings.',
    170,
    22,
    22,
  ],
  [
    'Patagonia Frontier',
    'Chile',
    -51.7267,
    -72.506,
    'https://images.unsplash.com/photo-1501555088652-021faa106b9b?auto=format&fit=crop&w=1400&q=80',
    'Glacier hikes, dramatic fjords, and expedition-style eco lodges.',
    310,
    16,
    16,
  ],
  [
    'Dubrovnik Coastal Legacy',
    'Croatia',
    42.6507,
    18.0944,
    'https://images.unsplash.com/photo-1549893074-79f9d5d57f42?auto=format&fit=crop&w=1400&q=80',
    'Old-town history routes, island hopping, and luxury Adriatic views.',
    210,
    21,
    21,
  ],
  [
    'Queenstown Fjord Expedition',
    'New Zealand',
    -45.0312,
    168.6626,
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80',
    'Heli-scenic flights, fjord cruises, and alpine adventure planning.',
    295,
    19,
    19,
  ],
];

function ensureDirectoryForFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createDatabase(dbPath = path.join(process.cwd(), 'data', 'travel.sqlite')) {
  ensureDirectoryForFile(dbPath);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS destinations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      country TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      imageUrl TEXT NOT NULL,
      description TEXT NOT NULL,
      basePrice INTEGER NOT NULL,
      totalSlots INTEGER NOT NULL,
      availableSlots INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      destinationId INTEGER NOT NULL,
      customerName TEXT NOT NULL,
      email TEXT NOT NULL,
      seats INTEGER NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      nights INTEGER NOT NULL,
      totalPrice INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (destinationId) REFERENCES destinations(id)
    );
  `);

  const bookingColumns = db.prepare('PRAGMA table_info(bookings)').all();
  const hasUserId = bookingColumns.some((column) => column.name === 'userId');
  if (!hasUserId) {
    db.exec('ALTER TABLE bookings ADD COLUMN userId INTEGER;');
  }

  const destinationColumns = db.prepare('PRAGMA table_info(destinations)').all();
  const hasLatitude = destinationColumns.some((column) => column.name === 'latitude');
  const hasLongitude = destinationColumns.some((column) => column.name === 'longitude');
  if (!hasLatitude) {
    db.exec('ALTER TABLE destinations ADD COLUMN latitude REAL DEFAULT 0;');
  }
  if (!hasLongitude) {
    db.exec('ALTER TABLE destinations ADD COLUMN longitude REAL DEFAULT 0;');
  }

  const insertDestination = db.prepare(`
    INSERT INTO destinations
    (name, country, latitude, longitude, imageUrl, description, basePrice, totalSlots, availableSlots)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const findDestination = db.prepare('SELECT id, latitude, longitude FROM destinations WHERE name = ? LIMIT 1');
  const updateCoordinates = db.prepare('UPDATE destinations SET latitude = ?, longitude = ? WHERE id = ?');

  const syncCatalog = db.transaction((catalog) => {
    for (const destination of catalog) {
      const [name, _country, latitude, longitude] = destination;
      const existing = findDestination.get(name);

      if (!existing) {
        insertDestination.run(...destination);
        continue;
      }

      const shouldBackfillCoordinates =
        Number(existing.latitude || 0) === 0 && Number(existing.longitude || 0) === 0;
      if (shouldBackfillCoordinates) {
        updateCoordinates.run(latitude, longitude, existing.id);
      }
    }
  });

  syncCatalog(DESTINATION_CATALOG);

  return db;
}

module.exports = { createDatabase };
