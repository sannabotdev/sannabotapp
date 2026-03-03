---
name: web-research
category: information
description: Search the web for facts and current information. Brave Search (requires API key), Wikipedia and DuckDuckGo (free). Tools: http.
test_prompt: What is artificial intelligence?
permissions:
 - android.permission.INTERNET
credentials:
 - id: brave_search_api_key
   label: Brave Search API Key
   type: api_key
---
# Web Research Skill

Search the web, look up facts, read web pages, and synthesize information from multiple sources.

## Tools

| Tool | Purpose |
|------|---------|
| `http` | GET/POST requests to search APIs and web pages |
| `check_credential` | Verify if Brave Search API key is configured |
| `file_storage` | Save research results for later reference |
| `scheduler` | Schedule recurring research tasks |

---

## Source 1: Brave Search API (full web search – requires API key)

Brave Search provides comprehensive web results with snippets. Free tier: 2000 queries/month.

**Always check the API key first:**

```json
{
  "tool": "check_credential",
  "args": { "credential_id": "brave_search_api_key" }
}
```

If `configured: false` → fall back to Wikipedia/DuckDuckGo (see below). Do NOT attempt the Brave API call.

### Web search

```json
{
  "method": "GET",
  "url": "https://api.search.brave.com/res/v1/web/search?q={QUERY}&count=5",
  "auth_provider": "brave_search_api_key",
  "auth_header": "X-Subscription-Token"
}
```

**Response fields:**
- `web.results[]` – array of search results
  - `.title` – page title
  - `.url` – page URL
  - `.description` – snippet/summary (HTML stripped)
  - `.age` – how old the result is (e.g. "2 hours ago")
- `query.original` – the original search query

### News search

```json
{
  "method": "GET",
  "url": "https://api.search.brave.com/res/v1/news/search?q={QUERY}&count=5",
  "auth_provider": "brave_search_api_key",
  "auth_header": "X-Subscription-Token"
}
```

**Response fields:**
- `results[]` – array of news articles
  - `.title` – article title
  - `.url` – article URL
  - `.description` – summary snippet
  - `.age` – publication time (e.g. "3 hours ago")
  - `.meta_url.hostname` – source domain (e.g. "bbc.com")

---

## Source 2: Wikipedia REST API (free, no API key)

Perfect for factual lookups, definitions, biographies, historical events, and encyclopedic queries.

### Search Wikipedia

```json
{
  "method": "GET",
  "url": "https://en.wikipedia.org/api/rest_v1/page/summary/{TOPIC}",
  "headers": [{ "key": "User-Agent", "value": "SannaBot/1.0" }]
}
```

**Response fields:**
- `title` – article title
- `extract` – plain text summary (first paragraph)
- `description` – short description
- `content_urls.desktop.page` – full article URL

**Language support:** Replace `en` with the target language code:
- German: `https://de.wikipedia.org/api/rest_v1/page/summary/{TOPIC}`
- French: `https://fr.wikipedia.org/api/rest_v1/page/summary/{TOPIC}`
- Spanish: `https://es.wikipedia.org/api/rest_v1/page/summary/{TOPIC}`
- Italian: `https://it.wikipedia.org/api/rest_v1/page/summary/{TOPIC}`

### Wikipedia search (when exact title is unknown)

```json
{
  "method": "GET",
  "url": "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={QUERY}&utf8=&format=json&srlimit=5",
  "headers": [{ "key": "User-Agent", "value": "SannaBot/1.0" }]
}
```

**Response fields:**
- `query.search[]` – array of results
  - `.title` – article title (use this with the summary endpoint)
  - `.snippet` – text excerpt (contains `<span>` tags – strip HTML)

**Workflow:** Search → pick best matching title → fetch summary via REST API.

---

## Source 3: DuckDuckGo Instant Answer API (free, no API key)

Provides quick factual answers, definitions, and related topics. Best for simple "what is X?" queries.

```json
{
  "method": "GET",
  "url": "https://api.duckduckgo.com/?q={QUERY}&format=json&no_html=1&skip_disambig=1"
}
```

**Response fields:**
- `AbstractText` – short answer/summary (often from Wikipedia)
- `AbstractSource` – source name
- `AbstractURL` – source URL
- `Answer` – direct answer (e.g. for calculations, conversions)
- `RelatedTopics[]` – list of related topics
  - `.Text` – topic description
  - `.FirstURL` – link to more info

**Note:** If both `AbstractText` and `Answer` are empty, DuckDuckGo has no instant answer → fall back to Brave Search or Wikipedia.

---

## Source 4: Fetching web pages (reading articles)

Use the `http` tool with `response_format: "text"` to fetch and read a specific URL:

```json
{
  "method": "GET",
  "url": "{PAGE_URL}",
  "response_format": "text",
  "headers": [{ "key": "User-Agent", "value": "SannaBot/1.0" }]
}
```

**Important:**
- Raw HTML is noisy – the 5000-char truncation means you may only get the header/nav portion
- Prefer structured APIs (Wikipedia, search API snippets) over raw page fetches
- If you must fetch a page, extract key information from the HTML and summarize
- For news articles, prefer the headlines skill (RSS feeds) when available

---

## Decision Matrix: Which source to use

| User intent | Best source | Fallback |
|-------------|-------------|----------|
| "Search for …" / "Google …" / "Look up …" | Brave Search | Wikipedia search |
| "What is …?" / "Who is …?" / "Define …" | Wikipedia summary | DuckDuckGo Instant |
| "Latest news about …" | Brave News search | Headlines skill (RSS) |
| "Tell me about [person/place/concept]" | Wikipedia summary | Brave Search |
| "How does [X] work?" | Wikipedia + Brave Search | DuckDuckGo |
| "Compare X and Y" | Wikipedia (both) + Brave | – |
| "Read this article: [URL]" | Direct http fetch | – |
| Quick fact / number / date | DuckDuckGo Instant | Wikipedia |

---

## Workflows

### "Search the web for [topic]" (general web search)

1. `check_credential("brave_search_api_key")`
2. **If configured:**
   - `http` → GET `https://api.search.brave.com/res/v1/web/search?q={TOPIC}&count=5` with `auth_provider: "brave_search_api_key"`, `auth_header: "X-Subscription-Token"`
   - Parse `web.results[]`: extract title, description, URL for each result
   - Summarize: "Here's what I found about {TOPIC}: 1. … 2. … 3. …"
3. **If NOT configured:**
   - `http` → GET Wikipedia search API for `{TOPIC}`
   - Pick best result → fetch Wikipedia summary
   - Also try DuckDuckGo Instant Answer API
   - Summarize findings. Mention to the user: "For broader web search results, you can add a Brave Search API key in Settings."

### "What is [X]?" / "Who is [person]?" (factual lookup)

1. `http` → GET `https://en.wikipedia.org/api/rest_v1/page/summary/{X}` (use `de.wikipedia.org` for German users, etc.)
2. If Wikipedia returns a result → summarize `extract` field
3. If Wikipedia returns 404 (no article):
   - Try Wikipedia search API to find the correct title
   - Or fall back to DuckDuckGo Instant Answer API
4. Present the answer naturally, citing the source

### "Latest news about [topic]" (news search)

1. `check_credential("brave_search_api_key")`
2. **If configured:**
   - `http` → GET `https://api.search.brave.com/res/v1/news/search?q={TOPIC}&count=5` with auth
   - Summarize results with source names and publication times
3. **If NOT configured:**
   - Suggest using the headlines skill for RSS-based news instead
   - Or try Wikipedia for background on the topic

### "Tell me about [X] and [Y]" (comparison / multi-topic)

1. Fetch Wikipedia summaries for both X and Y (parallel `http` calls)
2. If more detail needed and Brave Search is configured, search for "X vs Y" or "X compared to Y"
3. Synthesize a comparison from the gathered information

### "Read this page: [URL]" (direct page fetch)

1. `http` → GET `{URL}` with `response_format: "text"`
2. Extract meaningful content from the HTML (skip navigation, ads, scripts)
3. Summarize the page content for the user
4. Note: content will be truncated at 5000 chars – warn the user if the article appears cut off

### Deep research (multi-step)

1. Start with a broad search (Brave or Wikipedia)
2. Identify the most relevant results
3. Optionally fetch 1–2 promising URLs for more detail
4. Synthesize all findings into a coherent answer
5. Cite sources: "According to [Source]: …"

---

## URL encoding rules

- Replace spaces with `+` or `%20`: `artificial+intelligence`
- Encode special chars: `&` → `%26`, `#` → `%23`, `?` → `%3F`
- Umlauts can be used directly in Wikipedia URLs: `Zürich`, `München`
- For Brave Search, URL-encode the query parameter

---

## Output format rules

- **Voice (TTS):** Summarize in 2–4 sentences. Name the source: "According to Wikipedia…" / "A web search shows…"
- **Text response:** Present results as a numbered list with source names, brief descriptions, and links
- **Always** summarize in natural language – never dump raw JSON/HTML
- **Always** cite sources – mention where the information comes from
- **Multiple results:** Present the top 3–5 most relevant results, not all
- If all sources return no results, tell the user honestly: "I couldn't find information about {topic}."
- Summarize in the user's configured language, even if the source is in a different language

---

## Notes

- Brave Search API free tier: 2000 queries/month – sufficient for personal use
- Wikipedia is always available as a free, high-quality fallback
- The `http` tool truncates responses at 5000 characters – this is enough for search results and Wikipedia summaries
- For Brave Search: get a free API key at https://brave.com/search/api/
- DuckDuckGo Instant Answer API often returns empty results for complex queries – use it only for simple factual lookups
- When the user says "Google X" or "search for X", they mean web search – use Brave Search or Wikipedia, not literally Google
