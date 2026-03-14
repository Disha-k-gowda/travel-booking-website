const CACHE_TTL_MS = 10 * 60 * 1000;
const weatherCache = new Map();

function cacheKey(destination) {
  return `${destination.name}|${destination.country}`.toLowerCase();
}

function toCodeDescription(code) {
  const map = {
    0: 'Clear',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Rime fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Dense drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    80: 'Rain showers',
    95: 'Thunderstorm',
  };
  return map[code] || 'Conditions updating';
}

async function fetchJson(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function getDestinationWeather(destination) {
  const key = cacheKey(destination);
  const cached = weatherCache.get(key);
  const now = Date.now();

  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
  geoUrl.searchParams.set('name', destination.name);
  geoUrl.searchParams.set('count', '1');
  geoUrl.searchParams.set('language', 'en');

  const geoData = await fetchJson(geoUrl.toString());
  const place = geoData?.results?.[0];

  if (!place) {
    return {
      source: 'open-meteo',
      status: 'unavailable',
      summary: 'Weather unavailable',
    };
  }

  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
  forecastUrl.searchParams.set('latitude', String(place.latitude));
  forecastUrl.searchParams.set('longitude', String(place.longitude));
  forecastUrl.searchParams.set('current', 'temperature_2m,weather_code');
  forecastUrl.searchParams.set('timezone', 'auto');

  const forecast = await fetchJson(forecastUrl.toString());
  const current = forecast?.current;

  if (!current) {
    return {
      source: 'open-meteo',
      status: 'unavailable',
      summary: 'Weather unavailable',
    };
  }

  const weather = {
    source: 'open-meteo',
    status: 'ok',
    temperatureC: current.temperature_2m,
    weatherCode: current.weather_code,
    summary: `${Math.round(current.temperature_2m)}C - ${toCodeDescription(current.weather_code)}`,
    location: place.name,
    cachedAt: new Date().toISOString(),
  };

  weatherCache.set(key, { data: weather, cachedAt: now });
  return weather;
}

module.exports = { getDestinationWeather };
