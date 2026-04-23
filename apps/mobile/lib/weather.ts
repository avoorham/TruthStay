// Open-Meteo geocoding + weather utilities — free, no API key required

const WMO_DESC: Record<number, string> = {
  0:  "Clear sky",
  1:  "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Icy fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Light showers", 81: "Showers", 82: "Heavy showers",
  85: "Snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm w/ hail", 99: "Heavy thunderstorm",
};

export function wmoDescription(code: number): string {
  return WMO_DESC[code] ?? "Variable";
}

export function wmoIcon(code: number): string {
  if (code === 0)        return "☀️";
  if (code <= 3)         return "⛅";
  if (code <= 48)        return "🌫️";
  if (code <= 67)        return "🌧️";
  if (code <= 77)        return "❄️";
  if (code <= 82)        return "🌦️";
  if (code <= 86)        return "🌨️";
  return "⛈️";
}

export interface GeoResult {
  lat: number;
  lon: number;
  country: string;
}

export interface WeatherResult {
  tempC: number;
  description: string;
  icon: string;
}

export async function geocodePlace(name: string): Promise<GeoResult | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    const r = data.results?.[0];
    if (!r) return null;
    return { lat: r.latitude as number, lon: r.longitude as number, country: (r.country as string) ?? "" };
  } catch {
    return null;
  }
}

export async function fetchWeather(
  lat: number,
  lon: number,
  date?: string,
): Promise<WeatherResult | null> {
  try {
    const today = new Date();
    const targetDate = date ? new Date(date) : null;
    const daysOut = targetDate
      ? Math.ceil((targetDate.getTime() - today.getTime()) / 86_400_000)
      : null;

    let tempC: number;
    let code: number;

    if (daysOut !== null && daysOut >= 0 && daysOut <= 15) {
      const start = targetDate!.toISOString().slice(0, 10);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,weathercode&timezone=auto&start_date=${start}&end_date=${start}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return null;
      const data = await res.json();
      tempC = Math.round(data.daily.temperature_2m_max[0] as number);
      code  = data.daily.weathercode[0] as number;
    } else {
      // Fall back to current conditions
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return null;
      const data = await res.json();
      tempC = Math.round(data.current_weather.temperature as number);
      code  = data.current_weather.weathercode as number;
    }

    return { tempC, description: wmoDescription(code), icon: wmoIcon(code) };
  } catch {
    return null;
  }
}

export async function fetchPlaceWeather(
  name: string,
  date?: string,
): Promise<{ geo: GeoResult; weather: WeatherResult } | null> {
  const geo = await geocodePlace(name);
  if (!geo) return null;
  const weather = await fetchWeather(geo.lat, geo.lon, date);
  if (!weather) return null;
  return { geo, weather };
}