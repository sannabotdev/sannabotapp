---
name: weather
description: Get current weather and forecasts for any location (no API key required)
test_prompt: What is the current weather in Vienna?
permissions:
 - android.permission.INTERNET
---
# Weather Skill

Provides current weather conditions and forecasts using free services – no API keys needed.

## Tools

| Tool | Purpose |
|------|---------|
| `http` | GET requests to wttr.in and Open-Meteo (no `auth_provider` needed) |
| `device` | `get_location` → current GPS coordinates (latitude, longitude) |

### Get current location

```json
{
  "action": "get_location"
}
```

Returns GPS coordinates, e.g. `GPS: 48.208200, 16.373800 (Genauigkeit: 12m)`.
Use latitude/longitude directly with Open-Meteo, or as `{LAT},{LON}` with wttr.in.

---

## Service 1: wttr.in (primary)

Lightweight, human-readable weather data via [wttr.in](https://wttr.in/:help).

### Current weather – compact one-liner

```json
{
  "method": "GET",
  "url": "https://wttr.in/{LOCATION}?format=%l:+%c+%t+%h+%w",
  "response_format": "text"
}
```

Returns e.g. `London: ⛅️ +8°C 71% ↙5km/h`

Format codes: `%c` condition · `%t` temperature · `%h` humidity · `%w` wind · `%l` location · `%m` moon phase

### Current weather – short format

```json
{
  "method": "GET",
  "url": "https://wttr.in/{LOCATION}?format=3",
  "response_format": "text"
}
```

Returns e.g. `London: ⛅️ +8°C`

### Full text forecast (today + 2 days)

```json
{
  "method": "GET",
  "url": "https://wttr.in/{LOCATION}?T",
  "response_format": "text"
}
```

### Today only

```json
{
  "method": "GET",
  "url": "https://wttr.in/{LOCATION}?1&T",
  "response_format": "text"
}
```

### Current conditions only (no forecast)

```json
{
  "method": "GET",
  "url": "https://wttr.in/{LOCATION}?0&T",
  "response_format": "text"
}
```

### Location encoding rules

- Replace spaces with `+`: `New+York`, `San+Francisco`
- Airport codes work: `JFK`, `CDG`, `VIE`
- Units: append `&m` for metric (default) or `&u` for USCS/Fahrenheit
- Umlauts can be used directly: `München`, `Zürich`

---

## Service 2: Open-Meteo (fallback, JSON)

Use when wttr.in is unavailable or when you need structured JSON data.
Free, no API key. Docs: https://open-meteo.com/en/docs

### Current weather by coordinates

```json
{
  "method": "GET",
  "url": "https://api.open-meteo.com/v1/forecast?latitude={LAT}&longitude={LON}&current_weather=true"
}
```

Returns JSON with `current_weather.temperature`, `current_weather.windspeed`, `current_weather.weathercode`.

### Find coordinates for a city

Use the Open-Meteo geocoding API first:

```json
{
  "method": "GET",
  "url": "https://geocoding-api.open-meteo.com/v1/search?name={CITY}&count=1"
}
```

Returns `results[0].latitude` and `results[0].longitude`.

### Full workflow (Open-Meteo)

**With city name:**
1. Geocode the city name → get `latitude` and `longitude`
2. Query the forecast API with those coordinates
3. Interpret `weathercode` (0 = clear, 1–3 = cloudy, 45–48 = fog, 51–55 = drizzle, 61–65 = rain, 71–75 = snow, 95 = thunderstorm)

**Without city name (current location):**
1. `device` → `get_location` → get `latitude` and `longitude` directly
2. Query the forecast API with those coordinates (skip geocoding)
3. Interpret `weathercode`

---

## Workflows

### "What's the weather?" (no location given)

1. `device` → `get_location` → returns e.g. `48.2082, 16.3738`
2. `http` → GET `https://wttr.in/48.2082,16.3738?format=%l:+%c+%t+%h+%w` with `response_format: "text"`
3. Summarise: "At your current location it's partly cloudy, 14 degrees, 65% humidity."

### "What's the weather in London?"

1. `http` → GET `https://wttr.in/London?format=%l:+%c+%t+%h+%w` with `response_format: "text"`
2. Read the result and summarise: "In London it's partly cloudy, 8 degrees, 71% humidity, light wind from the south-west."

### "Weather forecast for Berlin"

1. `http` → GET `https://wttr.in/Berlin?T` with `response_format: "text"`
2. Summarise the multi-day forecast for the user

### "Will it rain tomorrow in Vienna?"

1. `http` → GET `https://wttr.in/Vienna?1&T` with `response_format: "text"`
2. Check the forecast for rain indicators
3. Answer: "Tomorrow in Vienna light rain is expected in the afternoon, around 12 °C."

### "What's the temperature in New York right now?"

1. `http` → GET `https://wttr.in/New+York?format=%t` with `response_format: "text"`
2. Answer: "It's currently +5 °C in New York."

---

## Examples

- "What's the weather?" → `device` → `get_location`, then query wttr.in with coordinates
- "Weather in Tokyo" → `wttr.in/Tokyo?format=%l:+%c+%t+%h+%w`
- "Forecast for Munich" → `wttr.in/München?T`
- "Will it rain tomorrow?" → `wttr.in/{LOCATION}?1&T`, check for rain
- "Temperature in Sydney" → `wttr.in/Sydney?format=%t`
- "What's the moon phase?" → `wttr.in/?format=%m`

## Notes

- wttr.in is the preferred source – fast, no keys, human-friendly output
- Use `response_format: "text"` for wttr.in (it returns plain text, not JSON)
- Fall back to Open-Meteo if wttr.in returns an error or times out
- Always summarise the result in natural language – do not just read raw output
- If the user does not specify a location, use `device` → `get_location` to get GPS coordinates and query with those
