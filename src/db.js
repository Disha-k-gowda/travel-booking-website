const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const DESTINATION_CATALOG = [
  {
    name: 'Santorini Escape',
    country: 'Greece',
    latitude: 36.3932,
    longitude: 25.4615,
    imageUrl:
      'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1400&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1571406258360-53030e8a3867?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1533658925622-ef423220a77e?auto=format&fit=crop&w=1400&q=80',
    ],
    description: 'Sunset cliff stays, volcanic beaches, and whitewashed luxury suites.',
    basePrice: 220,
    totalSlots: 30,
    availableSlots: 30,
  },
  {
    name: 'Kyoto Heritage',
    country: 'Japan',
    latitude: 35.0116,
    longitude: 135.7681,
    imageUrl:
      'https://images.unsplash.com/photo-1492571350019-22de08371fd3?auto=format&fit=crop&w=1400&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1492571350019-22de08371fd3?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=1400&q=80',
    ],
    description: 'Temple district journeys and curated cultural experiences in every season.',
    basePrice: 180,
    totalSlots: 24,
    availableSlots: 24,
  },
  {
    name: 'Bali Wellness Retreat',
    country: 'Indonesia',
    latitude: -8.4095,
    longitude: 115.1889,
    imageUrl:
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1400&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1518544866330-95a2dcf6a22f?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1589308078059-be1415eab4c3?auto=format&fit=crop&w=1400&q=80',
    ],
    description: 'Rice terrace villas, guided wellness plans, and private beach transfers.',
    basePrice: 200,
    totalSlots: 28,
    availableSlots: 28,
  },
  {
    name: 'Swiss Alpine Loop',
    country: 'Switzerland',
    latitude: 46.8182,
    longitude: 8.2275,
    imageUrl:
      'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1400&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1470163395405-d2b80e7450ed?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1400&q=80',
    ],
    description: 'Scenic mountain rail routes with premium lodges and guided day trips.',
    basePrice: 260,
    totalSlots: 20,
    availableSlots: 20,
  },
  {
    name: 'Reykjavik Aurora Nights',
    country: 'Iceland',
    latitude: 64.1466,
    longitude: -21.9426,
    imageUrl:
      'https://images.unsplash.com/photo-1476611338391-6f395a0ebc7b?auto=format&fit=crop&w=1400&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1476611338391-6f395a0ebc7b?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1483347756197-71ef80e95f73?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1482192597420-481c87f6e0f7?auto=format&fit=crop&w=1400&q=80',
    ],
    description:
      'Geothermal lagoons, ice cave day tours, and northern lights photography nights.',
    basePrice: 280,
    totalSlots: 18,
    availableSlots: 18,
  },
  {
    name: 'Marrakech Riad Trails',
    country: 'Morocco',
    latitude: 31.6295,
    longitude: -7.9811,
    imageUrl:
      'https://images.unsplash.com/photo-1597212618440-806262de4f6b?auto=format&fit=crop&w=1400&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1597212618440-806262de4f6b?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1400&q=80',
    ],
    description: 'Medina stays, Atlas foothill excursions, and artisan-led culinary evenings.',
    basePrice: 170,
    totalSlots: 22,
    availableSlots: 22,
  },
  {
    name: 'Patagonia Frontier',
    country: 'Chile',
    latitude: -51.7267,
    longitude: -72.506,
    imageUrl:
      'https://images.unsplash.com/photo-1501555088652-021faa106b9b?auto=format&fit=crop&w=1400&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1501555088652-021faa106b9b?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1400&q=80',
    ],
    description: 'Glacier hikes, dramatic fjords, and expedition-style eco lodges.',
    basePrice: 310,
    totalSlots: 16,
    availableSlots: 16,
  },
  {
    name: 'Dubrovnik Coastal Legacy',
    country: 'Croatia',
    latitude: 42.6507,
    longitude: 18.0944,
    imageUrl:
      'https://images.unsplash.com/photo-1549893074-79f9d5d57f42?auto=format&fit=crop&w=1400&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1549893074-79f9d5d57f42?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1520986606214-8b456906c813?auto=format&fit=crop&w=1400&q=80',
    ],
    description: 'Old-town history routes, island hopping, and luxury Adriatic views.',
    basePrice: 210,
    totalSlots: 21,
    availableSlots: 21,
  },
  {
    name: 'Queenstown Fjord Expedition',
    country: 'New Zealand',
    latitude: -45.0312,
    longitude: 168.6626,
    imageUrl:
      'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80&sat=-30',
      'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=1400&q=80',
    ],
    description: 'Heli-scenic flights, fjord cruises, and alpine adventure planning.',
    basePrice: 295,
    totalSlots: 19,
    availableSlots: 19,
  },
];

function ensureDirectoryForFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function buildReliableGallery(destination) {
  const fromCatalog = Array.isArray(destination.galleryImages)
    ? destination.galleryImages.filter((url) => typeof url === 'string' && url.trim())
    : [];

  const picsumSeeds = [1, 2, 3].map(
    (index) =>
      `https://picsum.photos/seed/${encodeURIComponent(`${destination.name}-${index}`)}/1400/900`,
  );

  const candidates = [destination.imageUrl, ...fromCatalog, ...picsumSeeds];
  return [...new Set(candidates)].slice(0, 6);
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
      galleryImages TEXT NOT NULL DEFAULT '[]',
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
  const hasGalleryImages = destinationColumns.some((column) => column.name === 'galleryImages');
  if (!hasLatitude) {
    db.exec('ALTER TABLE destinations ADD COLUMN latitude REAL DEFAULT 0;');
  }
  if (!hasLongitude) {
    db.exec('ALTER TABLE destinations ADD COLUMN longitude REAL DEFAULT 0;');
  }
  if (!hasGalleryImages) {
    db.exec("ALTER TABLE destinations ADD COLUMN galleryImages TEXT NOT NULL DEFAULT '[]';");
  }

  const insertDestination = db.prepare(`
    INSERT INTO destinations
    (name, country, latitude, longitude, imageUrl, galleryImages, description, basePrice, totalSlots, availableSlots)
    VALUES (@name, @country, @latitude, @longitude, @imageUrl, @galleryImages, @description, @basePrice, @totalSlots, @availableSlots)
  `);
  const findDestination = db.prepare(
    'SELECT id, latitude, longitude, galleryImages FROM destinations WHERE name = ? LIMIT 1',
  );
  const updateCatalogFields = db.prepare(`
    UPDATE destinations
    SET
      country = @country,
      latitude = @latitude,
      longitude = @longitude,
      imageUrl = @imageUrl,
      galleryImages = @galleryImages,
      description = @description,
      basePrice = @basePrice
    WHERE id = @id
  `);

  const syncCatalog = db.transaction((catalog) => {
    for (const destination of catalog) {
      const existing = findDestination.get(destination.name);
      const galleryImagesJson = JSON.stringify(buildReliableGallery(destination));

      if (!existing) {
        insertDestination.run({
          ...destination,
          galleryImages: galleryImagesJson,
        });
        continue;
      }

      updateCatalogFields.run({
        id: existing.id,
        ...destination,
        galleryImages: galleryImagesJson,
      });
    }
  });

  syncCatalog(DESTINATION_CATALOG);

  return db;
}

module.exports = { createDatabase };
