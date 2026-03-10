# Market Watch Dashboard

For Chinese documentation, see [中文文档](./README.zh.md).

A Tampermonkey userscript for Charles Schwab and Interactive Brokers web platforms.

It combines:

- US market overview
- options analytics
- stock research
- AI-assisted market and stock analysis
- local caching, theme switching, and English/Chinese UI

## Overview

`Market Watch Dashboard` is a Tampermonkey userscript that adds a floating analytics dashboard to:

- `https://client.schwab.com/*`
- `https://ndcdyn.interactivebrokers.com/*`

The dashboard is organized into four main tabs:

- `US Market`
- `Stock`
- `Options Dashboard`
- `Settings`

The script can pull data from Schwab, IBKR, and optional AI providers depending on which module you use.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser.
2. Install the published script:

   **[Install Market Watch Dashboard](./dist/market-watch.user.js?raw=1)**

3. Open either Schwab or IBKR in the same browser profile.
4. Click the floating analytics button to open the dashboard.

## Recommended Login State

For the smoothest experience, keep these sessions active in the same browser:

- Schwab logged in at `client.schwab.com`
- IBKR Portal logged in at `ndcdyn.interactivebrokers.com`

Why this matters:

- Schwab powers the `US Market` tab and the `Options Dashboard`
- IBKR powers most of the `Stock` fundamentals and `News & Research` tabs
- AI modules need your own OpenAI or Gemini API key if you want AI output

## What The Script Supports

### 1. US Market

- real-time ticker bar for major indices
- indices charting by region or selected symbols
- market calendar and event views
- breaking news feed and story loading
- company movers with ranking, exchange, and sector filters
- AI market analysis panel with optional web search and citations

### 2. Stock

- stock symbol search and quote bar
- historical price chart
- live mode / live quote updates when available
- IBKR fundamentals tabs:
  - overview
  - company profile
  - social sentiment
  - short selling
  - financials
  - key ratios
  - ratings
  - analyst forecast
  - ownership
  - dividends
  - competitors
  - ESG
  - investment themes
  - TipRanks / Trading Central / Estimize entry tabs
- IBKR `News & Research` categories:
  - News
  - Research
  - Commentary
  - Press
  - Filings
  - Takeaways
  - Transcripts
  - RSS
- AI stock analysis panel

### 3. Options Dashboard

- Schwab symbol search
- quote + mini chain loading
- full option chain loading by expiration
- key levels such as:
  - call wall
  - put wall
  - max pain
  - gamma flip
- analytics such as:
  - net GEX
  - cumulative GEX
  - Greeks exposure
  - volume / OI structure
  - implied move
  - put/call OI ratio
  - automated option insights
- local IndexedDB caching
- cache preload / export / import / refresh

### 4. Settings

- light / dark / system theme
- English / Chinese language switch
- OpenAI API key
- Gemini API key
- cache management

## Module / Data Source / Login Matrix

| Module | Main Features | Main Data Source | What You Must Log In To |
|---|---|---|---|
| `US Market > Ticker Bar` | DJIA, Nasdaq, S&P 500, Russell quotes | Schwab APIs | `Schwab` |
| `US Market > Indices` | region chart, individual symbol chart | Schwab APIs | `Schwab` |
| `US Market > Calendar` | calendar events, ratings-related views | Schwab + Schwab WallSt | `Schwab` |
| `US Market > News` | headlines, story content, search | Schwab + Schwab WallSt | `Schwab` |
| `US Market > Movers` | movers by ranking / exchange / sector | Schwab APIs | `Schwab` |
| `US Market > AI Market Analysis` | AI summary from visible market data | visible dashboard data + OpenAI or Gemini | `Schwab` for market data, plus optional `OpenAI API key` or `Gemini API key` |
| `Stock > Quote / Price Chart` | stock quote, history, live updates | mostly Schwab APIs, page context for live stream when available | `Schwab` |
| `Stock > Fundamentals` | overview, profile, financials, ratios, ratings, forecast, ownership, dividends, competitors, ESG, themes | IBKR Portal APIs | `IBKR` |
| `Stock > Social Sentiment / Short Selling` | sentiment series, borrow / lending data | IBKR Portal APIs | `IBKR` |
| `Stock > TipRanks / Trading Central / Estimize` | third-party research entry tabs inside stock module | IBKR portal routes | `IBKR` |
| `Stock > News & Research` | article feed, categories, full article content | IBKR news APIs | `IBKR` |
| `Stock > AI Stock Analysis` | AI report based on stock quote and available news | stock dashboard data + OpenAI or Gemini | `Schwab` for quote/chart, `IBKR` if you want news context, plus optional `OpenAI API key` or `Gemini API key` |
| `Options Dashboard` | option chains, GEX, max pain, gamma flip, Greeks, insights | Schwab APIs | `Schwab` |
| `Settings > Cache` | refresh / clear / export / import | browser local storage + IndexedDB | no broker login required |

## Which Website Each Module Depends On

### Requires Schwab login

- `US Market` tab
- `Options Dashboard` tab
- stock quote / stock history parts inside `Stock`

### Requires IBKR login

- stock fundamentals
- stock social sentiment
- stock short selling
- stock news and full article loading
- IBKR third-party research entry tabs

### Requires API key only if you want AI output

- `AI Market Analysis`
- `AI Stock Analysis`

Supported AI providers:

- OpenAI
- Google Gemini

## AI Setup

1. Open the dashboard.
2. Go to `Settings`.
3. Enter either or both:
   - OpenAI API key
   - Gemini API key
4. Click `Save`.

Notes:

- API keys are stored locally in your browser
- keys are only sent to their corresponding API endpoints
- AI analysis can run without web search, or with web search/citations depending on the selected mode

## Important Notes

- If you open the script on the IBKR site, Schwab-powered modules still depend on a valid Schwab session in the same browser.
- If Schwab session expires, market / options requests can fail until you refresh and log in again.
- If IBKR session is not active, fundamentals and news tabs in the stock module will show errors or empty states.
- `AI Stock Analysis` mainly uses the currently loaded quote / chart context and stock news; it does not directly read every fundamentals tab as structured input.
- Option-chain cache is stored in browser IndexedDB.
- Theme, language, last symbol, and AI settings are stored locally.

## Troubleshooting

### The panel opens but market / options data does not load

Check:

- you are logged into Schwab
- the session is still active
- Tampermonkey is enabled for the page

### Stock fundamentals or stock news do not load

Check:

- you are logged into IBKR Portal
- the IBKR page is open in the same browser profile

### AI analysis button exists but no AI output is generated

Check:

- at least one AI API key is saved in `Settings`
- the selected model matches the saved provider
- your API key quota / billing is valid

## License

[MIT](./LICENSE)
