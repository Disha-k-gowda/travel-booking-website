const { getDestinationWeather } = require('./weatherService');

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'VoyantaTravelBooking/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Upstream API request failed with ${response.status}`);
  }

  return response.json();
}

function toCurrencyText(currencies) {
  if (!currencies || typeof currencies !== 'object') {
    return 'N/A';
  }
  const first = Object.entries(currencies)[0];
  if (!first) {
    return 'N/A';
  }
  const [code, details] = first;
  return `${code} (${details?.name || 'Unknown'})`;
}

async function getDestinationInsights(destination) {
  if (!destination) {
    throw new Error('Destination is required.');
  }

  const countryUrl = `https://restcountries.com/v3.1/name/${encodeURIComponent(destination.country)}?fields=name,capital,currencies,languages,timezones`;

  const [weatherResult, countryResult] = await Promise.allSettled([
    getDestinationWeather(destination),
    fetchJson(countryUrl),
  ]);
  const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
  const countryJson = countryResult.status === 'fulfilled' ? countryResult.value : null;
  const country = Array.isArray(countryJson) ? countryJson[0] : null;

  return {
    weather: {
      summary: weather?.summary || 'Weather unavailable',
      status: weather?.status || 'unavailable',
    },
    country: {
      name: country?.name?.common || destination.country,
      capital: Array.isArray(country?.capital) ? country.capital[0] : 'N/A',
      currency: toCurrencyText(country?.currencies),
      languages: country?.languages ? Object.values(country.languages).join(', ') : 'N/A',
      timezone: Array.isArray(country?.timezones) ? country.timezones[0] : 'N/A',
    },
    source: {
      weather: 'Open-Meteo',
      country: 'REST Countries',
      pricing: 'No API key required',
    },
  };
}

module.exports = {
  getDestinationInsights,
};
