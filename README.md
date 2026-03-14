# Voyanta - Travel Booking Application

A JavaScript full-stack travel booking system featuring real-time availability sync, transaction-safe booking processing, responsive UI, and automated testing.

## Why this project is interview-ready

- Real-time database integration and state management with Socket.IO and SQLite
- Booking logic validation with edge-case handling and transaction safety
- End-to-end testing with Playwright plus API and unit tests with Vitest
- Responsive image-rich UI suitable for SaaS / startup product demos
- Optional account authentication with JWT-based sessions for one-click booking

## Stack

- Backend: Node.js, Express, Socket.IO, better-sqlite3
- Frontend: Vanilla JavaScript, HTML, CSS
- Testing: Vitest, Supertest, Playwright

## Free APIs used (no key required)

- Open-Meteo: live weather per destination coordinates
- REST Countries: capital, currency, language, and timezone metadata

## Quick start

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>

## Available scripts

- `npm run dev` - start local server on port 3000
- `npm run test` - run unit + integration tests
- `npm run test:e2e` - run Playwright browser-based e2e tests
- `npm run test:all` - run all tests

## Core features

- Live inventory updates via WebSockets
- Transaction-safe booking creation and cancellation
- Validation for date ranges, seat constraints, malformed inputs, and overbooking
- Responsive booking modal and destination cards with rich imagery
- Free API integration: live destination weather via Open-Meteo (no API key required)
- User-triggered per-card insights refresh with loading state
- Multi-page UX: Home booking page, Trips Explorer, and Bookings Management dashboard
- Booking operations tools: email search, cancellation controls, and real-time KPI stats
- Expanded catalog with 9 seeded global destinations for richer demos

## Page responsibilities

- Home (`/index.html`): traveler sign-in, live availability, and booking submission
- Trips (`/trips.html`): destination discovery, filtering/sorting, and on-demand insights
- Trips filters are URL-synced (`q`, `sort`, `availability`, `theme`) and shareable via copy-link action
- Trips includes saved favorites (local storage), favorites-only mode, quick filter reset, and 3-night cost snapshots
- Home and Bookings views are also URL-synced (`theme` on Home, `email` on Bookings) with copy-link actions
- Home includes a Favorites shelf showing Trips favorites instantly across pages
- Global Light/Dark theme toggle is available on all major pages
- Bookings (`/bookings.html`): operations dashboard, email lookup, cancellation workflow, and KPIs
- Destination (`/destination.html?id=<id>`): full destination profile, live insights, and related-trip suggestions
- Destination page now includes an adaptive 3-day itinerary timeline (theme + season aware)

## API overview

- `GET /api/destinations`
- `GET /api/availability`
- `GET /api/destinations/:id/weather`
- `GET /api/destinations/:id/insights`
- `GET /api/bookings`
- `GET /api/bookings/search?email=<value>`
- `GET /api/stats`
- `POST /api/bookings`
- `POST /api/bookings/:id/cancel`

## Example booking payload

```json
{
  "destinationId": 1,
  "customerName": "Ada Lovelace",
  "email": "ada@example.com",
  "seats": 2,
  "startDate": "2026-03-20",
  "endDate": "2026-03-24"
}
```
