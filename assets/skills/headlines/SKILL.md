---
name: headlines
category: information
description: Fetch and summarize top news headlines from RSS feeds of major international news outlets and press agencies (no API key required)
test_prompt: What are today's top headlines?
permissions:
 - android.permission.INTERNET
---
# Headlines Skill

Fetches top news headlines from public RSS feeds of major international news outlets and press agencies. No API key required – RSS is free and public.

## Tools

| Tool | Purpose |
|------|---------|
| `http` | GET requests to RSS feed URLs with `response_format: "text"` |
| `scheduler` | Schedule automatic daily news briefings |
| `tts` | Read headlines aloud |

---

## RSS Feed Sources

### 🌍 International / Global

| Outlet | Language | RSS URL |
|--------|----------|---------|
| BBC News (Top Stories) | EN | `https://feeds.bbci.co.uk/news/rss.xml` |
| BBC News (World) | EN | `https://feeds.bbci.co.uk/news/world/rss.xml` |
| AP (Associated Press) – Top News | EN | `https://apnews.com/hub/ap-top-news?format=rss` |
| AP (World News) | EN | `https://apnews.com/hub/world-news?format=rss` |
| Al Jazeera | EN | `https://www.aljazeera.com/xml/rss/all.xml` |
| Deutsche Welle | EN | `https://rss.dw.com/rdf/rss-en-all` |
| France 24 | EN | `https://www.france24.com/en/rss` |
| RFI (Radio France Int.) | EN | `https://www.rfi.fr/en/rss` |
| Euronews | EN | `https://www.euronews.com/rss` |

### 🇩🇪 Germany (Deutsch)

| Outlet | Content | RSS URL |
|--------|---------|---------|
| Tagesschau (ARD) | Top stories | `https://www.tagesschau.de/xml/rss2` |
| Spiegel Online | Top headlines | `https://www.spiegel.de/schlagzeilen/tops/index.rss` |
| Spiegel Online | All | `https://www.spiegel.de/schlagzeilen/index.rss` |
| Zeit Online | All | `https://newsfeed.zeit.de/all` |
| FAZ | Current | `https://www.faz.net/rss/aktuell/` |
| Stern | All | `https://www.stern.de/feed/standard/all/` |
| Heise Online | Tech | `https://www.heise.de/rss/heise-top-atom.xml` |
| n-tv | All | `https://www.n-tv.de/rss` |
| Deutsche Welle | DE | `https://rss.dw.com/rdf/rss-de-all` |

### 🇦🇹 Austria (Österreich)

| Outlet | Content | RSS URL |
|--------|---------|---------|
| ORF News | All | `https://rss.orf.at/news.xml` |
| Der Standard | All | `https://www.derstandard.at/rss` |
| Die Presse | Current | `https://diepresse.com/rss` |

### 🇨🇭 Switzerland (Schweiz)

| Outlet | Language | RSS URL |
|--------|----------|---------|
| SRF News | DE | `https://www.srf.ch/news/bnf/rss/1922` |
| NZZ | DE | `https://www.nzz.ch/recent.rss` |

### 🇬🇧 United Kingdom

| Outlet | RSS URL |
|--------|---------|
| BBC (Top Stories) | `https://feeds.bbci.co.uk/news/rss.xml` |
| The Guardian (World) | `https://www.theguardian.com/world/rss` |
| The Guardian (UK) | `https://www.theguardian.com/uk/rss` |
| Sky News | `https://feeds.skynews.com/feeds/rss/home.xml` |
| The Independent | `https://www.independent.co.uk/news/rss` |

### 🇫🇷 France

| Outlet | Language | RSS URL |
|--------|----------|---------|
| Le Monde | FR | `https://www.lemonde.fr/rss/une.xml` |
| Le Figaro | FR | `https://www.lefigaro.fr/rss/figaro_actualites.xml` |
| RFI | FR | `https://www.rfi.fr/fr/rss` |

### 🇺🇸 USA

| Outlet | RSS URL |
|--------|---------|
| AP Top News | `https://apnews.com/hub/ap-top-news?format=rss` |
| NPR News | `https://feeds.npr.org/1001/rss.xml` |
| CNN World | `http://rss.cnn.com/rss/edition_world.rss` |

### 🇮🇹 Italy / 🇪🇸 Spain

| Outlet | Language | RSS URL |
|--------|----------|---------|
| ANSA (Italy) – Top News | IT | `https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml` |
| ANSA (Italy) – World | IT | `https://www.ansa.it/sito/notizie/mondo/mondo_rss.xml` |
| EFE (Spain) | ES | `https://www.efe.com/efe/espana/1/rss` |

---

## Topic-specific BBC RSS feeds

| Topic | URL |
|-------|-----|
| Technology | `https://feeds.bbci.co.uk/news/technology/rss.xml` |
| Science | `https://feeds.bbci.co.uk/news/science_and_environment/rss.xml` |
| Business | `https://feeds.bbci.co.uk/news/business/rss.xml` |
| Health | `https://feeds.bbci.co.uk/news/health/rss.xml` |
| Sport | `https://feeds.bbci.co.uk/sport/rss.xml` |
| UK | `https://feeds.bbci.co.uk/news/uk/rss.xml` |
| World | `https://feeds.bbci.co.uk/news/world/rss.xml` |

---

## How to fetch headlines

### Basic RSS fetch

```json
{
  "method": "GET",
  "url": "https://feeds.bbci.co.uk/news/rss.xml",
  "response_format": "text"
}
```

The response is XML. Key parsing rules:
- Each news item is inside `<item>...</item>` (RSS) or `<entry>...</entry>` (Atom, e.g. Heise)
- Extract: `<title>`, `<description>`, `<pubDate>` (or `<updated>` for Atom), `<link>`
- Ignore the first `<title>` tag – it belongs to the `<channel>` (feed name), not a news item
- Strip HTML tags and `<![CDATA[...]]>` wrappers from descriptions
- Present max 5–10 headlines to avoid overwhelming the user

---

## Workflows

### "What are today's top headlines?"

1. `http` → GET `https://feeds.bbci.co.uk/news/rss.xml` with `response_format: "text"`
2. Parse XML: extract first 5–7 `<item>` titles and descriptions
3. Summarise: "Here are today's top headlines from BBC News: 1. … 2. … 3. …"

### "Read me the German news"

1. `http` → GET `https://www.tagesschau.de/xml/rss2` with `response_format: "text"`
2. Parse first 5 items
3. Summarise in the user's configured language

### "What's happening in Austria?"

1. `http` → GET `https://news.orf.at/stories/rss/` with `response_format: "text"`
2. Parse and summarise top 5 stories (ORF publishes large amounts of APA wire content)

### "Tech news"

1. `http` → GET `https://www.heise.de/rss/heise-top-atom.xml` with `response_format: "text"`
2. Note: Heise uses Atom format – items are in `<entry>` tags, not `<item>`
3. Summarise top 5 tech stories

### "Give me a global news overview"

Fetch 2–3 feeds from different regions, deduplicate overlapping stories, present a combined summary:

1. `http` → GET BBC RSS (global English perspective): `https://feeds.bbci.co.uk/news/rss.xml`
2. `http` → GET AP RSS (US/wire perspective): `https://apnews.com/hub/ap-top-news?format=rss`
3. `http` → GET Al Jazeera RSS (alternative perspective): `https://www.aljazeera.com/xml/rss/all.xml`
4. Merge, remove duplicates, summarise 7–10 unique headlines

### "Read me the news every morning at 7"

1. `datetime` → `absolute` with `base: "tomorrow"`, `time: "07:00"`, `output_unit: "milliseconds"`
2. `scheduler` → `create` with:
   - `label`: "Daily News Briefing"
   - `instruction`: "Fetch the top 5 headlines from https://feeds.bbci.co.uk/news/rss.xml using the http tool (method: GET, response_format: text). Parse the XML and extract the <item> titles. Then read them aloud via TTS."
   - `trigger_at_ms`: timestamp from step 1
   - `recurrence_type`: "daily"
   - `recurrence_time`: "07:00"
3. Confirm: "I'll read you the BBC headlines every morning at 7."

### "French news in French"

1. `http` → GET `https://www.france24.com/fr/rss` with `response_format: "text"`
2. Parse and summarise in French (AFP wire content via France 24)

### "News from multiple countries"

Fetch one feed per requested country:
- Germany → Tagesschau
- Austria → ORF
- Switzerland → SRF
- Global → BBC or AP

---

## Recommended source combinations

| Goal | Best sources |
|------|-------------|
| Global top stories (EN) | BBC + AP + Al Jazeera |
| German-speaking region | Tagesschau + ORF + SRF |
| Germany only | Tagesschau + Spiegel |
| Austria only | ORF + Der Standard |
| Switzerland only | SRF + NZZ |
| France / AFP content | France 24 + RFI |
| Tech news | Heise + BBC Tech |
| Neutral / multi-perspective | Deutsche Welle (available in 30+ languages via `https://rss.dw.com/rdf/rss-{lang}-all`) |

**Deutsche Welle language codes**: `en`, `de`, `fr`, `es`, `ar`, `pt`, `ru`, `zh`, `uk`, `tr`, `id`, `sw`, `ha`, `am`, `bn`, `fa`

---

## Output format rules

- **Voice (TTS)**: Read 3–5 headlines. One sentence each. Name the source: "According to BBC News: …"
- **Text response**: List 5–10 headlines with source name and one-line description
- **Always** mention the time/date of the headline if available from `<pubDate>`
- **Never** dump raw XML at the user – always summarise in natural language
- If a feed returns an HTTP error, fall back to an alternative source
- Summarise in the user's configured language, even if the feed is in a different language
- Atom feeds (e.g. Heise) use `<entry>` instead of `<item>` and `<updated>` instead of `<pubDate>`

---

## Notes

- Always use `response_format: "text"` for RSS feeds (they return XML, not JSON)
- No `auth_provider` needed – all listed feeds are public
- The `http` tool truncates responses at 5000 characters – sufficient for 10–15 headlines
- For best voice results, fetch only 1 feed and read 3–5 headlines
- Fetch multiple feeds only when the user asks for a cross-source overview
