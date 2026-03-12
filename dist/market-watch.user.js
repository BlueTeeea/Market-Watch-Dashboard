// ==UserScript==
// @name         Market Watch Dashboard
// @version      0.5.3
// @description  Stock market analytics dashboard with real-time indices, breaking news, calendar, company movers, AI market analysis, and individual stock research module (price chart, IBKR fundamentals overview/profile/financials/key ratios/ratings/forecast/ownership/dividends/competitors/ESG/news/social sentiment, news & research feed, AI stock analysis)
// @match        https://client.schwab.com/*
// @match        https://ndcdyn.interactivebrokers.com/*
// @match        https://cdcdyn.interactivebrokers.com/*
// @match        https://gdcdyn.interactivebrokers.com/*
// @match        https://portal.interactivebrokers.com/*
// @match        https://www.interactivebrokers.com/*
// @require      https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js
// @require      https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js
// @require      https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js
// @resource     materialIcons https://fonts.googleapis.com/icon?family=Material+Icons
// @grant        GM_getResourceText
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @connect      api.openai.com
// @connect      generativelanguage.googleapis.com
// @connect      client.schwab.com
// @connect      ausgateway.schwab.com
// @connect      typeaheadsearch.schwab.com
// @connect      www.schwab.wallst.com
// @connect      ndcdyn.interactivebrokers.com
// @connect      cdcdyn.interactivebrokers.com
// @connect      gdcdyn.interactivebrokers.com
// @connect      portal.interactivebrokers.com
// @connect      www.interactivebrokers.com
// @run-at       document-idle
// @updateURL    https://github.com/BlueTeeea/Market-Watch-Dashboard/raw/refs/heads/main/dist/market-watch.user.js
// @downloadURL  https://github.com/BlueTeeea/Market-Watch-Dashboard/raw/refs/heads/main/dist/market-watch.user.js
// @homepageURL  https://github.com/BlueTeeea/Market-Watch-Dashboard
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';
  
    const TAG = '[SchwabOptDash]';
    console.log(TAG, 'Script loaded');
  
    /* ───────────────────────────────────────────
       §1  CONSTANTS & CONFIG
    ─────────────────────────────────────────── */
  
    const API = {
      AUTH: 'https://client.schwab.com/api/auth/authorize/scope/api',
      KEEP_ALIVE: 'https://client.schwab.com/KeepAlive/Nka.aspx',
      SEARCH: 'https://typeaheadsearch.schwab.com/marketdata/v1/symbols',
      QUOTE: 'https://ausgateway.schwab.com/api/is.ResearchExperience/v1/quote',
      MINI_CHAINS: 'https://ausgateway.schwab.com/api/quoteplant.MDSMiniChains/v1/MiniChains',
      CHAINS: 'https://ausgateway.schwab.com/api/is.CSOptionChainsWeb/v1/OptionChainsPort/OptionChains/chains',
      INDICES_HISTORY: 'https://ausgateway.schwab.com/api/is.ResearchExperience/v1/markets/indices/history',
      SYMBOL_HISTORY: 'https://ausgateway.schwab.com/api/is.SharedResearchExperience/V1/symbol/quotes/history',
      NEWS_HEADLINES: 'https://ausgateway.schwab.com/api/is.ResearchExperience/v1/news/headlines',
      COMPANY_MOVERS: 'https://ausgateway.schwab.com/api/is.ResearchExperience/v1/companymovers',
      CALENDAR_F2: 'https://www.schwab.wallst.com/TradeSource/F2/Apps/json?siteContext=schwabspa&mdApp=com_schwab_app_registry_market_calendar_v1-markets',
      CALENDAR_EVENTS: 'https://www.schwab.wallst.com/tradesource/Markets/Calendar/CalendarEventsModule',
      CALENDAR_RATINGS: 'https://www.schwab.wallst.com/tradesource/Markets/Calendar/RatingChanges',
      NEWS_F2: 'https://www.schwab.wallst.com/TradeSource/F2/Apps/json?siteContext=schwabspa&mdApp=com_schwab_app_registry_shared_search_news_v3-markets',
      NEWS_STORY: 'https://www.schwab.wallst.com/tradesource/News/LoadNewsStory',
      NEWS_SEARCH: 'https://www.schwab.wallst.com/tradesource/News/SearchNewsAdvancedV2',
      MARKIT_TOKEN: 'https://ausgateway.schwab.com/api/is.ResearchExperience/v1/markets/markittokenbyaccid',
    };
  
    const SESSION_KEEP_ALIVE_MS = 5 * 60 * 1000;   // 5 min
    const TOKEN_REFRESH_MS     = 8 * 60 * 1000;     // 8 min (token TTL ~10 min)
    let _keepAliveTimer = null;
    let _tokenRefreshTimer = null;
    let _sessionExpired = false;
    let _sessionExpiredToastShown = false;
  
    const THEME_KEY = 'schwab_opt_theme';
    const LAST_SYMBOL_KEY = 'schwab_opt_last_symbol';
    const LANG_KEY = 'schwab_opt_lang';
  
    function _safeLocalGet(key) {
      try { return localStorage.getItem(key); } catch (_) { return null; }
    }
    function _safeLocalSet(key, value) {
      try { localStorage.setItem(key, value); } catch (_) {}
    }

    function _xGet(key, fallback) {
      if (typeof GM_getValue !== 'undefined') { try { const v = GM_getValue(key); if (v !== undefined && v !== null) return v; } catch (_) {} }
      const localValue = _safeLocalGet(key);
      return (localValue !== null) ? localValue : fallback;
    }
    function _xSet(key, value) {
      if (typeof GM_setValue !== 'undefined') { try { GM_setValue(key, value); } catch (_) {} }
      _safeLocalSet(key, value);
    }
  
  
    function getSavedLang() { return _xGet(LANG_KEY, 'en'); }
    function saveLang(lang) { _xSet(LANG_KEY, lang); }
  
    const I18N = {
      'tab.market': { en: 'US Market', zh: '美股市场' },
      'tab.dashboard': { en: 'Options Dashboard', zh: '期权分析' },
      'tab.settings': { en: 'Settings', zh: '设置' },
      'ctrl.symbol': { en: 'Symbol', zh: '代码' },
      'ctrl.load': { en: 'Load', zh: '加载' },
      'ctrl.refresh': { en: 'Refresh', zh: '刷新' },
      'ctrl.expiration': { en: 'Expiration:', zh: '到期日:' },
      'ctrl.strikes': { en: 'Strikes:', zh: '行权价:' },
      'stat.spot': { en: 'SPOT', zh: '现价' },
      'stat.forward': { en: 'FORWARD', zh: '远期价' },
      'stat.dte': { en: 'DTE', zh: '剩余天数' },
      'stat.stmIv': { en: 'STM IV', zh: 'STM IV' },
      'stat.dnsSm': { en: 'DNS SM', zh: 'DNS SM' },
      'stat.impliedMove': { en: 'IMPLIED MOVE', zh: '隐含波动' },
      'stat.pcOi': { en: 'P/C OI', zh: 'P/C OI' },
      'stat.callOi': { en: 'CALL OI', zh: 'CALL OI' },
      'stat.putOi': { en: 'PUT OI', zh: 'PUT OI' },
      'stat.callVol': { en: 'CALL VOL', zh: 'CALL 成交量' },
      'stat.putVol': { en: 'PUT VOL', zh: 'PUT 成交量' },
      'stat.netGex': { en: 'NET GEX', zh: 'NET GEX' },
      'stat.timestamp': { en: 'TIMESTAMP', zh: '时间戳' },
      'insights.title': { en: 'Option Insights', zh: '期权分析洞察' },
      'insights.subtitle': { en: 'Automated analysis based on options positioning, flow, and volatility structure.', zh: '基于期权持仓、资金流向和波动率结构的自动分析。' },
      'insights.bullish': { en: 'Bullish', zh: '看涨' },
      'insights.bearish': { en: 'Bearish', zh: '看跌' },
      'insights.neutral': { en: 'Neutral', zh: '中性' },
      'insights.keyLevels': { en: 'KEY PRICE LEVELS', zh: '关键价格水平' },
      'insight.gamma.pos.title': { en: 'Positive Gamma Environment', zh: '正 Gamma 环境' },
      'insight.gamma.pos.text': { en: 'Dealers are long gamma — they buy dips and sell rips, suppressing volatility. Mean-reversion strategies favored. Expect range-bound behavior near key strikes.', zh: '做市商持有正 Gamma — 他们在下跌时买入、上涨时卖出，抑制波动。均值回归策略更有利，预计价格将在关键行权价附近区间震荡。' },
      'insight.gamma.neg.title': { en: 'Negative Gamma Environment', zh: '负 Gamma 环境' },
      'insight.gamma.neg.text': { en: 'Dealers are short gamma — they sell into dips and buy into rips, amplifying moves. Trend-following strategies favored. Expect larger directional moves.', zh: '做市商持有负 Gamma — 他们在下跌时卖出、上涨时买入，放大波动。趋势跟踪策略更有利，预计将出现较大方向性波动。' },
      'insight.flow.lowPc': { en: 'Call open interest dominates, indicating bullish positioning. Extreme readings can be contrarian bearish.', zh: 'Call 未平仓合约占主导，表明看涨持仓。极端读数可能是反向看跌信号。' },
      'insight.flow.highPc': { en: 'Put open interest dominates, indicating hedging/bearish positioning. Extreme readings can be contrarian bullish.', zh: 'Put 未平仓合约占主导，表明对冲/看跌持仓。极端读数可能是反向看涨信号。' },
      'insight.maxpain.text': { en: 'Spot is {0}% {1} Max Pain. Gravitational pull may increase as expiry approaches.', zh: '现价在 Max Pain {1} {0}%，随着到期日临近引力效应可能增强。' },
      'insight.maxpain.above': { en: 'above', zh: '上方' },
      'insight.maxpain.below': { en: 'below', zh: '下方' },
      'insight.support.text': { en: 'Key dealer gamma walls define the current range. Put Wall support at ${0} and Call Wall resistance at ${1}.', zh: '做市商 Gamma 壁定义了当前交易区间。Put Wall 支撑位 ${0}，Call Wall 阻力位 ${1}。' },
      'insight.vol.text': { en: 'ATM straddle-mid implies a ±{0}% move by expiry. Range: ${1} — ${2}.', zh: 'ATM Straddle 中间价暗示到期前波动 ±{0}%。范围：${1} — ${2}。' },
      'keylevels.title': { en: 'Key Levels', zh: '关键水平' },
      'keylevels.subtitle': { en: 'OI concentration panel. Key price levels from dealer gamma positioning.', zh: 'OI 集中度面板。基于做市商 Gamma 持仓的关键价格水平。' },
      'keylevels.putWall': { en: 'PUT WALL (SUPPORT)', zh: 'PUT WALL（支撑）' },
      'keylevels.callWall': { en: 'CALL WALL (RESISTANCE)', zh: 'CALL WALL（阻力）' },
      'keylevels.maxPain': { en: 'MAX PAIN', zh: 'MAX PAIN' },
      'keylevels.gammaFlip': { en: 'GAMMA FLIP', zh: 'GAMMA 翻转' },
      'keylevels.expiryMagnet': { en: 'Expiry magnet', zh: '到期吸引点' },
      'keylevels.minIvPrice': { en: 'MIN IV PRICE', zh: '最低 IV 价格' },
      'cumgex.title': { en: 'Cumulative Gamma Exposure', zh: '累计 Gamma 敞口' },
      'cumgex.subtitle': { en: 'Running sum of net GEX across strikes.', zh: '各行权价的净 GEX 累计总和。' },
      'cumgex.callGex': { en: 'Cum. Call GEX', zh: '累计 Call GEX' },
      'cumgex.putGex': { en: 'Cum. Put GEX', zh: '累计 Put GEX' },
      'dealergex.title': { en: 'Dealer Gamma Exposure (GEX)', zh: '做市商 Gamma 敞口 (GEX)' },
      'dealergex.positiveGex': { en: 'Positive GEX', zh: '正 GEX' },
      'dealergex.negativeGex': { en: 'Negative GEX', zh: '负 GEX' },
      'greeks.title': { en: 'Greeks Exposure', zh: 'Greeks 敞口' },
      'greeks.subtitle': { en: 'Net gamma exposure by strike. Positive = dealers short gamma (mean-reversion).', zh: '各行权价净 Gamma 敞口。正值 = 做市商做空 Gamma（均值回归）。' },
      'greeks.positive': { en: 'Positive', zh: '正值' },
      'greeks.negative': { en: 'Negative', zh: '负值' },
      'greeks.net': { en: 'Net', zh: '净值' },
      'volume.title': { en: 'Volume Profile', zh: '成交量分布' },
      'volume.subtitle': { en: 'Call and put trading volume by strike.', zh: '各行权价的 Call 和 Put 交易量。' },
      'volume.subtitleOI': { en: 'No volume data yet — showing open interest by strike.', zh: '暂无成交量数据 — 显示各行权价未平仓量。' },
      'volume.callVol': { en: 'Call Volume', zh: 'Call 成交量' },
      'volume.putVol': { en: 'Put Volume', zh: 'Put 成交量' },
      'volume.callOI': { en: 'Call OI', zh: 'Call 未平仓' },
      'volume.putOI': { en: 'Put OI', zh: 'Put 未平仓' },
      'dash.empty': { en: 'Enter a symbol and click Load to begin', zh: '输入代码并点击加载开始' },
      'settings.title': { en: 'Settings', zh: '设置' },
      'settings.theme': { en: 'Theme', zh: '主题' },
      'settings.light': { en: 'Light', zh: '浅色' },
      'settings.dark': { en: 'Dark', zh: '深色' },
      'settings.system': { en: 'System', zh: '跟随系统' },
      'settings.language': { en: 'Language', zh: '语言' },
      'settings.english': { en: 'English', zh: 'English' },
      'settings.chinese': { en: '简体中文', zh: '简体中文' },
      'settings.apiKeys': { en: 'AI API Keys', zh: 'AI API 密钥' },
      'settings.openaiApiKey': { en: 'ChatGPT', zh: 'ChatGPT' },
      'settings.openaiApiKeyPlaceholder': { en: 'OpenAI API Key (sk-...)', zh: 'OpenAI API 密钥 (sk-...)' },
      'settings.geminiApiKey': { en: 'Gemini', zh: 'Gemini' },
      'settings.geminiApiKeyPlaceholder': { en: 'Gemini API Key (AIza...)', zh: 'Gemini API 密钥 (AIza...)' },
      'settings.save': { en: 'Save', zh: '保存' },
      'settings.apiKeyNote': { en: 'Your API keys are stored locally and only sent to their respective API endpoints.', zh: 'API 密钥仅存储在本地，且只会发送到对应的 API 端点。' },
      'settings.cache': { en: 'Cache Management', zh: '缓存管理' },
      'settings.cacheNote': { en: "The cache is stored in your browser's local IndexedDB.", zh: '缓存存储在浏览器的本地的 IndexedDB 中。' },
      'settings.refreshAll': { en: 'Refresh All Data', zh: '刷新全部数据' },
      'settings.clearAll': { en: 'Clear All', zh: '清除全部' },
      'settings.exportAll': { en: 'Export All', zh: '导出全部' },
      'settings.import': { en: 'Import', zh: '导入' },
      'settings.cacheSummary': { en: '{0} cached entries across {1} symbols — {2} KB total', zh: '{0} 条缓存，涵盖 {1} 个代码 — 共 {2} KB' },
      'settings.noCache': { en: 'No cached data.', zh: '暂无缓存数据。' },
      'settings.version': { en: 'Version', zh: '版本' },
      'settings.currentVersion': { en: 'Current Version', zh: '当前版本' },
      'version.v05.desc': { en: 'Stock module: price chart, fundamentals, news & research feed, AI stock analysis', zh: 'Stock 个股研究模块：价格走势图、基本面、新闻研究流、AI 个股分析' },
      'version.v04.desc': { en: 'Gemini API support for AI analysis', zh: 'AI 分析支持 Gemini API' },
      'version.v03.desc': { en: 'i18n: Chinese language support, language switcher in Settings', zh: '国际化：中文语言支持，设置中增加语言切换' },
      'version.v02.desc': { en: 'US Market module: real-time indices, breaking news, calendar, company movers, AI market analysis with web search & citations', zh: '美股市场模块：实时指数、突发新闻、日历、公司异动、AI 市场分析（支持网络搜索和引用）' },
      'version.v01.desc': { en: 'Options Dashboard: GEX, Greeks exposure, volume profile, option chain analytics on Schwab', zh: '期权分析面板：GEX、Greeks 敞口、成交量分布、Schwab 期权链分析' },
      'market.indices': { en: 'Indices', zh: '指数' },
      'market.region': { en: 'Region', zh: '区域' },
      'market.individual': { en: 'Individual', zh: '个股' },
      'market.us': { en: 'U.S.', zh: '美国' },
      'market.europe': { en: 'Europe', zh: '欧洲' },
      'market.asia': { en: 'Asia', zh: '亚洲' },
      'market.majorIndices': { en: 'Major Indices', zh: '主要指数' },
      'market.spGlobal': { en: 'S&P Global BMI', zh: 'S&P 全球 BMI' },
      'market.load': { en: 'Load', zh: '加载' },
      'market.calendar': { en: 'Calendar', zh: '日历' },
      'market.todaysEvents': { en: "Today's Events", zh: '今日事件' },
      'market.economic': { en: 'Economic', zh: '经济数据' },
      'market.earnings': { en: 'Earnings', zh: '财报' },
      'market.dividends': { en: 'Dividends', zh: '股息' },
      'market.splits': { en: 'Splits', zh: '拆股' },
      'market.calls': { en: 'Calls', zh: '电话会议' },
      'market.ratings': { en: 'Ratings', zh: '评级' },
      'market.filterSymbol': { en: 'Filter symbol...', zh: '筛选代码...' },
      'market.events': { en: 'Events', zh: '事件' },
      'market.noMatchingEvents': { en: 'No matching events', zh: '没有匹配的事件' },
      'market.noEventsForDate': { en: 'No events for this date.', zh: '该日期无事件。' },
      'market.loadingEvents': { en: 'Loading events...', zh: '加载事件中...' },
      'market.items': { en: 'items', zh: '条' },
      'market.breakingNews': { en: 'Breaking News', zh: '突发新闻' },
      'market.searchNews': { en: 'Search news...', zh: '搜索新闻...' },
      'market.allSources': { en: 'All Sources', zh: '全部来源' },
      'market.loadMore': { en: 'Load More', zh: '加载更多' },
      'market.loading': { en: 'Loading...', zh: '加载中...' },
      'market.noNewsFound': { en: 'No news found', zh: '未找到新闻' },
      'market.loadingArticle': { en: 'Loading full article...', zh: '加载全文中...' },
      'market.companyMovers': { en: 'Company Movers', zh: '公司异动' },
      'market.symbol': { en: 'Symbol', zh: '代码' },
      'market.company': { en: 'Company', zh: '公司' },
      'market.price': { en: 'Price', zh: '价格' },
      'market.change': { en: 'Change', zh: '涨跌' },
      'market.52wRange': { en: '52W Range', zh: '52周范围' },
      'market.volume': { en: 'Volume', zh: '成交量' },
      'ai.title': { en: 'AI Market Analysis', zh: 'AI 市场分析' },
      'ai.apiKeySet': { en: 'API Key Set', zh: 'API 密钥已设置' },
      'ai.setApiKey': { en: 'Set API Key in Settings', zh: '请在设置中配置 API 密钥' },
      'ai.think': { en: 'Think', zh: '思考' },
      'ai.search': { en: 'Search', zh: '搜索' },
      'ai.analyzeMarket': { en: 'Analyze Market', zh: '分析市场' },
      'ai.generating': { en: 'Generating...', zh: '生成中...' },
      'ai.clickAnalyze': { en: 'Click Analyze to generate a market snapshot report', zh: '点击分析生成市场快照报告' },
      'ai.showThinking': { en: 'Show thinking', zh: '显示思考过程' },
      'ai.hideThinking': { en: 'Hide thinking', zh: '隐藏思考过程' },
      'ai.showPrompt': { en: 'Show prompt', zh: '显示提示词' },
      'ai.hidePrompt': { en: 'Hide prompt', zh: '隐藏提示词' },
      'ai.thinking': { en: 'Thinking', zh: '思考中' },
      'ai.sources': { en: 'Sources', zh: '来源' },
      'ai.streaming': { en: 'Streaming...', zh: '流式输出中...' },
      'toast.sessionExpired': { en: 'Session expired — please refresh the page and log in again.', zh: '会话已过期 — 请刷新页面并重新登录。' },
      'toast.apiKeySaved': { en: 'API Key saved!', zh: 'API 密钥已保存！' },
      'toast.apiKeyCleared': { en: 'API Key cleared.', zh: 'API 密钥已清除。' },
      'toast.setApiKeyFirst': { en: 'Set your API Key in Settings first.', zh: '请先在设置中配置 API 密钥。' },
      'toast.noMoreNews': { en: 'No more news available.', zh: '没有更多新闻了。' },
      'toast.noMoreArticles': { en: 'No more new articles found.', zh: '没有找到更多新文章。' },
      'tab.stock': { en: 'Stock', zh: '个股研究' },
      'stock.symbolPlaceholder': { en: 'Symbol', zh: '代码' },
      'stock.load': { en: 'Go', zh: '查询' },
      'stock.afterHours': { en: 'After hours', zh: '盘后' },
      'stock.preMarket': { en: 'Pre-market', zh: '盘前' },
      'stock.atClose': { en: 'At close', zh: '收盘' },
      'stock.bid': { en: 'Bid', zh: '买价' },
      'stock.ask': { en: 'Ask', zh: '卖价' },
      'stock.bidAskSize': { en: 'Bid/Ask Size', zh: '买/卖量' },
      'stock.prevClose': { en: 'Previous close', zh: '前收盘价' },
      'stock.open': { en: "Today's open", zh: '今日开盘' },
      'stock.volume': { en: "Today's volume", zh: '今日成交量' },
      'stock.todayRange': { en: "Today's range", zh: '今日范围' },
      'stock.52wRange': { en: '52-week range', zh: '52周范围' },
      'stock.priceChart': { en: 'Price Chart', zh: '价格走势' },
      'stock.live': { en: 'LIVE', zh: '实时' },
      'stock.noSymbol': { en: 'Enter a symbol above to view stock data', zh: '在上方输入代码以查看个股数据' },
      'stock.marketClosed': { en: 'Closed', zh: '已收盘' },
      'stock.marketOpen': { en: 'Open', zh: '开盘中' },
      'stock.marketPre': { en: 'Pre-Market', zh: '盘前交易' },
      'stock.marketPost': { en: 'After-Hours', zh: '盘后交易' },
      'stock.news': { en: 'News & Research', zh: '新闻研报' },
      'stock.newsTab.news': { en: 'News', zh: '新闻' },
      'stock.newsTab.research': { en: 'Research', zh: '研报' },
      'stock.newsTab.commentary': { en: 'Commentary', zh: '评论' },
      'stock.newsTab.press': { en: 'Press', zh: '新闻稿' },
      'stock.newsTab.filings': { en: 'Filings', zh: '文件' },
      'stock.newsTab.takeaways': { en: 'Takeaways', zh: '要点' },
      'stock.newsTab.transcripts': { en: 'Transcripts', zh: '纪要' },
      'stock.newsTab.rss': { en: 'RSS', zh: 'RSS' },
      'stock.newsLoading': { en: 'Loading news...', zh: '加载新闻中...' },
      'stock.newsNone': { en: 'No news available', zh: '暂无新闻' },
      'stock.newsNoIbkr': { en: 'IBKR session required. Open IBKR portal in another tab.', zh: '需要 IBKR 会话，请在其他标签页打开 IBKR 门户。' },
      'stock.newsReadFull': { en: 'Read Full Article', zh: '查看全文' },
      'stock.newsLoadingFull': { en: 'Loading full article...', zh: '加载全文中...' },
      'stock.newsFullFailed': { en: 'Failed to load article', zh: '加载全文失败' },
      'stock.ai.title': { en: 'AI Stock Analysis', zh: 'AI 个股分析' },
      'stock.ai.analyze': { en: 'Analyze Stock', zh: '分析个股' },
      'stock.ai.click': { en: 'Click Analyze to generate a stock analysis report', zh: '点击分析生成个股分析报告' },
      'fund.title': { en: 'Fundamentals', zh: '基本面' },
      'fund.overview': { en: 'Overview', zh: '概览' },
      'fund.profile': { en: 'Company Profile', zh: '公司概况' },
      'fund.financials': { en: 'Financials', zh: '财务报表' },
      'fund.keyRatios': { en: 'Key Ratios', zh: '关键比率' },
      'fund.ratings': { en: 'Ratings', zh: '评级' },
      'fund.forecast': { en: 'Analyst Forecast', zh: '分析师预测' },
      'fund.competitors': { en: 'Competitors', zh: '竞争对手' },
      'fund.ownership': { en: 'Ownership', zh: '持股' },
      'fund.dividends': { en: 'Dividends', zh: '分红' },
      'fund.esg': { en: 'ESG', zh: 'ESG' },
      'fund.socialSentiment': { en: 'Social Sentiment', zh: '社交情绪' },
      'fund.shortSelling': { en: 'Short Selling', zh: '做空' },
      'fund.investmentThemes': { en: 'Investment Themes', zh: '投资主题' },
      'fund.investmentThemeExposure': { en: 'Investment Theme Exposure', zh: '投资主题敞口' },
      'fund.brandProduct': { en: 'Brand & Product', zh: '品牌与产品' },
      'fund.countryExposure': { en: 'Country Exposure', zh: '国家敞口' },
      'fund.regionExposure': { en: 'Region Exposure', zh: '区域敞口' },
      'fund.rank': { en: 'Rank', zh: '排名' },
      'fund.noDescription': { en: 'No description.', zh: '暂无说明。' },
      'fund.connectionsTotal': { en: '{0} items', zh: '{0} 项' },
      'fund.loading': { en: 'Loading fundamentals...', zh: '加载基本面数据中...' },
      'fund.error': { en: 'Failed to load data', zh: '加载数据失败' },
      'fund.restricted': { en: 'Restricted', zh: '受限数据' },
      'fund.utilization': { en: 'Utilization', zh: '利用率' },
      'fund.avgDuration': { en: 'Avg Duration', zh: '平均久期' },
      'fund.lenderDepth': { en: 'Lender Depth', zh: '出借深度' },
      'fund.borrowerDepth': { en: 'Borrower Depth', zh: '借入深度' },
      'fund.daysTocover': { en: 'Days to Cover', zh: '空头回补天数' },
      'fund.shortInterest': { en: 'Short Interest', zh: '做空比例' },
      'fund.loanQty': { en: 'Loan Quantity', zh: '借入数量' },
      'fund.loanVal': { en: 'Loan Value', zh: '借入价值' },
      'fund.loanFeeRate': { en: 'Loan Fee Rate', zh: '借券费率' },
      'fund.rebateRate': { en: 'Rebate Rate', zh: '返利利率' },
      'fund.availableToBorrow': { en: 'Available to Borrow', zh: '可借数量' },
      'fund.borrowQuality': { en: 'Borrow Quality', zh: '借券质量' },
      'fund.buyInRisk': { en: 'Buy-in Risk', zh: '强平风险' },
      'fund.shortSellingTrend': { en: 'Short Selling Trend', zh: '做空趋势' },
      'fund.feeRateTrend': { en: 'Fee Rate Trend', zh: '费率趋势' },
      'fund.inventoryTrend': { en: 'Inventory Trend', zh: '库存趋势' },
      'fund.marketVolume': { en: 'Market Volume', zh: '市场成交量' },
      'fund.shortDataPartial': { en: 'Partial data shown (subscription or endpoint limits).', zh: '当前显示部分数据（受订阅或接口限制）。' },
      'fund.themes': { en: 'Themes', zh: '主题' },
      'fund.relatedCompanies': { en: 'Related', zh: '关联公司' },
      'fund.performance1Y': { en: '1Y Perf', zh: '1年表现' },
      'fund.totalScore': { en: 'Total Score', zh: '总分' },
      'fund.environmental': { en: 'Environmental', zh: '环境' },
      'fund.social': { en: 'Social', zh: '社会' },
      'fund.governance': { en: 'Governance', zh: '治理' },
      'fund.controversy': { en: 'Controversy', zh: '争议' },
      'fund.sScore': { en: 'S-Score', zh: 'S-Score' },
      'fund.sVolume': { en: 'S-Volume', zh: 'S-Volume' },
      'fund.sDelta': { en: 'S-Delta', zh: 'S-Delta' },
      'fund.sBuzz': { en: 'S-Buzz', zh: 'S-Buzz' },
      'fund.sVolatility': { en: 'S-Volatility', zh: 'S-Volatility' },
      'fund.sDispersion': { en: 'S-Dispersion', zh: 'S-Dispersion' },
      'fund.consensus': { en: 'Consensus', zh: '共识评级' },
      'fund.outperform': { en: 'Outperform', zh: '跑赢' },
      'fund.underperform': { en: 'Underperform', zh: '跑输' },
      'fund.actual': { en: 'Actual', zh: '实际' },
      'fund.estimate': { en: 'Estimate', zh: '预估' },
      'fund.surprise': { en: 'Surprise', zh: '惊喜' },
      'fund.insiders': { en: 'Insiders', zh: '内部人' },
      'fund.institutions': { en: 'Institutions', zh: '机构' },
      'fund.tradeLog': { en: 'Trade Log', zh: '交易日志' },
      'fund.tipranks': { en: 'TipRanks', zh: 'TipRanks' },
      'fund.tradingCentral': { en: 'Trading Central', zh: 'Trading Central' },
      'fund.estimize': { en: 'Estimize', zh: 'Estimize' },
      'fund.noData': { en: 'No fundamentals data available', zh: '暂无基本面数据' },
      'fund.needIbkr': { en: 'IBKR session required', zh: '需要 IBKR 会话' },
      'fund.incomeStatement': { en: 'Income Statement', zh: '利润表' },
      'fund.balanceSheet': { en: 'Balance Sheet', zh: '资产负债表' },
      'fund.cashFlow': { en: 'Cash Flow', zh: '现金流量表' },
      'fund.annual': { en: 'Annual', zh: '年度' },
      'fund.quarterly': { en: 'Quarterly', zh: '季度' },
      'fund.buy': { en: 'Buy', zh: '买入' },
      'fund.hold': { en: 'Hold', zh: '持有' },
      'fund.sell': { en: 'Sell', zh: '卖出' },
      'fund.targetPrice': { en: 'Target Price', zh: '目标价' },
      'fund.sector': { en: 'Sector', zh: '行业' },
      'fund.industry': { en: 'Industry', zh: '细分行业' },
      'fund.employees': { en: 'Employees', zh: '员工数' },
      'fund.headquarters': { en: 'Headquarters', zh: '总部' },
      'fund.exchange': { en: 'Exchange', zh: '交易所' },
      'fund.description': { en: 'Description', zh: '公司简介' },
      'fund.revenue': { en: 'Revenue', zh: '营收' },
      'fund.netIncome': { en: 'Net Income', zh: '净利润' },
      'fund.eps': { en: 'EPS', zh: '每股收益' },
      'fund.peRatio': { en: 'P/E Ratio', zh: '市盈率' },
      'fund.pbRatio': { en: 'P/B Ratio', zh: '市净率' },
      'fund.marketCap': { en: 'Market Cap', zh: '总市值' },
      'fund.dividendYield': { en: 'Dividend Yield', zh: '股息率' },
      'fund.roe': { en: 'ROE', zh: '净资产收益率' },
      'fund.debtToEquity': { en: 'Debt/Equity', zh: '负债权益比' },
      'fund.grossMargin': { en: 'Gross Margin', zh: '毛利率' },
      'fund.operatingMargin': { en: 'Operating Margin', zh: '营业利润率' },
      'fund.netMargin': { en: 'Net Margin', zh: '净利率' },
      'fund.about': { en: 'About', zh: '简介' },
      'fund.keyMetrics': { en: 'Key Metrics', zh: '关键指标' },
      'fund.vsIndustry': { en: 'vs Industry', zh: '对比行业' },
      'fund.dividendDate': { en: 'Dividend Date', zh: '分红日期' },
      'fund.nextDividend': { en: 'Next Dividend', zh: '下次分红' },
      'fund.dividendYieldTtm': { en: 'Div. Yield TTM', zh: '股息率 TTM' },
      'fund.dividendTtm': { en: 'Dividend TTM', zh: '股息 TTM' },
      'fund.payoutRatio': { en: 'Payout Ratio', zh: '派息率' },
      'fund.esgRatings': { en: 'ESG Ratings', zh: 'ESG 评级' },
      'fund.current': { en: 'Current', zh: '当前' },
      'fund.analystRatings': { en: 'Analyst Ratings', zh: '分析师评级' },
      'fund.avgTarget': { en: 'Avg Target', zh: '平均目标价' },
      'fund.ratingsBasedOn': { en: 'Based on {0} Ratings', zh: '基于 {0} 份评级' },
      'fund.range': { en: 'Range', zh: '区间' },
      'fund.firm': { en: 'Firm', zh: '机构' },
      'fund.rating': { en: 'Rating', zh: '评级' },
      'fund.target': { en: 'Target', zh: '目标价' },
      'fund.date': { en: 'Date', zh: '日期' },
      'fund.forecastEps': { en: 'Forecast: EPS', zh: '预测：每股收益' },
      'fund.period': { en: 'Period', zh: '期间' },
      'fund.news': { en: 'News', zh: '新闻' },
      'fund.topHolders': { en: 'Top Holders', zh: '主要持仓' },
      'fund.ticker': { en: 'Ticker', zh: '代码' },
      'fund.company': { en: 'Company', zh: '公司' },
      'fund.financialSummary': { en: 'Financial Summary', zh: '财务摘要' },
      'fund.website': { en: 'Website', zh: '官网' },
      'fund.general': { en: 'General', zh: '通用信息' },
      'fund.directorsOfficers': { en: 'Directors & Officers', zh: '董事及高管' },
      'fund.name': { en: 'Name', zh: '名称' },
      'fund.titleCol': { en: 'Title', zh: '职位' },
      'fund.since': { en: 'Since', zh: '任职起始' },
      'fund.analysts': { en: 'Analysts', zh: '分析师数量' },
      'fund.targetRange': { en: 'Target Range', zh: '目标价区间' },
      'fund.ratingBreakdown': { en: 'Rating Breakdown', zh: '评级拆分' },
      'fund.ratingLog': { en: 'Rating Log', zh: '评级历史' },
      'fund.metric': { en: 'Metric', zh: '指标' },
      'fund.action': { en: 'Action', zh: '动作' },
      'fund.others': { en: 'Others', zh: '其他' },
      'fund.topInstitutionalHolders': { en: 'Top Institutional Holders', zh: '机构主要持仓' },
      'fund.shares': { en: 'Shares', zh: '持股数' },
      'fund.value': { en: 'Value', zh: '市值' },
      'fund.exDate': { en: 'Ex-Date', zh: '除息日' },
      'fund.payment': { en: 'Payment', zh: '派发日' },
      'fund.lastPaid': { en: 'Last Paid', zh: '最近分红' },
      'fund.dividendHistory': { en: 'Dividend History', zh: '分红历史' },
      'fund.dividendLabel': { en: 'Dividend', zh: '分红' },
      'fund.controversyCategory': { en: 'Controversy Cat.', zh: '争议类别' },
      'fund.asOf': { en: 'As of {0}', zh: '截至 {0}' },
      'fund.trend': { en: 'Trend', zh: '趋势' },
      'fund.industryComparison': { en: 'Industry Comparison', zh: '行业对比' },
      'fund.highLow7d': { en: '7D High / Low', zh: '7日高低点' },
      'fund.sScoreHigh': { en: 'S-Score High', zh: 'S-Score 高点' },
      'fund.sScoreLow': { en: 'S-Score Low', zh: 'S-Score 低点' },
      'fund.svScoreHigh': { en: 'S-V Score High', zh: 'S-V Score 高点' },
      'fund.svScoreLow': { en: 'S-V Score Low', zh: 'S-V Score 低点' },
      'fund.trend7d': { en: '7D Trend', zh: '7日趋势' },
      'fund.sScoreChange': { en: 'S-Score Change', zh: 'S-Score 变化' },
      'fund.svScoreChange': { en: 'S-V Score Change', zh: 'S-V Score 变化' },
      'fund.samples': { en: 'Samples', zh: '样本数' },
      'fund.indSScore': { en: 'Ind. S-Score', zh: '行业 S-Score' },
      'fund.indSVolume': { en: 'Ind. S-Volume', zh: '行业 S-Volume' },
      'fund.indSBuzz': { en: 'Ind. S-Buzz', zh: '行业 S-Buzz' },
      'fund.indChange': { en: 'Ind. Change', zh: '行业变化' },
      'fund.sentiment': { en: 'Sentiment', zh: '情绪' },
      'fund.volumeMetric': { en: 'Volume', zh: '成交量' },
      'fund.delta15m': { en: '15m Delta', zh: '15分钟变化' },
      'fund.tweetSentimentScore': { en: 'Tweet Sentiment Score', zh: '推文情绪评分' },
      'fund.tweetVolumeScore': { en: 'Tweet Volume Score', zh: '推文热度评分' },
      'fund.min15SentimentChange': { en: '15 Min Sentiment Change', zh: '15分钟情绪变化' },
      'fund.sourceDiversity': { en: 'Source Diversity', zh: '来源分散度' },
      'fund.buzzScore': { en: 'Buzz Score', zh: '热度评分' },
      'fund.caMetric': { en: "CA's {0}", zh: '该股 {0}' },
      'fund.low': { en: 'Low', zh: '低位' },
      'fund.high': { en: 'High', zh: '高位' },
      'fund.pastMonth': { en: 'Past Month', zh: '过去一个月' },
      'fund.currentTag': { en: 'Current', zh: '当前' },
      'fund.industryAvg': { en: 'Industry Avg', zh: '行业均值' },
      'fund.socialSentimentTrend': { en: 'Social Sentiment Trend', zh: '社交情绪趋势' },
      'fund.cumulativePerformance': { en: 'Cumulative Performance', zh: '累计表现' },
      'fund.industryScore': { en: 'Industry Score', zh: '行业评分' },
      'fund.positive': { en: 'Positive', zh: '积极' },
      'fund.negative': { en: 'Negative', zh: '消极' },
      'fund.period1d': { en: '1D', zh: '1天' },
      'fund.period1w': { en: '1W', zh: '1周' },
      'fund.period1m': { en: '1M', zh: '1月' },
      'fund.period6m': { en: '6M', zh: '6月' },
      'fund.period1y': { en: '1Y', zh: '1年' },
      'fund.noTrendData': { en: 'No trend data available.', zh: '暂无趋势数据。' },
      'fund.buzzDesc1': { en: 'S-Buzz measures unusual social media activity versus a broad market universe.', zh: 'S-Buzz 用于衡量该标的相对于全市场基准的异常社交媒体活跃度。' },
      'fund.buzzDesc2': { en: 'Values above 1 are above average; values below 1 are below average.', zh: '数值高于 1 表示高于平均水平，低于 1 表示低于平均水平。' },
      'fund.buzzDescToggle': { en: 'What is S-Buzz?', zh: '什么是 S-Buzz？' },
      'fund.resourceUseScore': { en: 'Resource Use Score', zh: '资源使用评分' },
      'fund.emissionsScore': { en: 'Emissions Score', zh: '排放评分' },
      'fund.environmentalInnovationScore': { en: 'Environmental Innovation Score', zh: '环保创新评分' },
      'fund.workforceScore': { en: 'Workforce Score', zh: '劳工评分' },
      'fund.humanRightsScore': { en: 'Human Rights Score', zh: '人权评分' },
      'fund.communityScore': { en: 'Community Score', zh: '社区评分' },
      'fund.productResponsibilityScore': { en: 'Product Responsibility Score', zh: '产品责任评分' },
      'fund.managementScore': { en: 'Management Score', zh: '管理层评分' },
      'fund.shareholdersScore': { en: 'Shareholders Score', zh: '股东评分' },
      'fund.csrStrategyScore': { en: 'CSR Strategy Score', zh: '企业社会责任战略评分' },
      'fund.dataSource': { en: 'Data source: {0} ({1})', zh: '数据来源：{0}（{1}）' },
      'fund.thirdPartySessionRequired': { en: 'Third-party data requires IBKR portal session', zh: '第三方数据需要 IBKR 门户会话' },
      'fund.openInIbkrPortal': { en: 'Open in IBKR Portal', zh: '在 IBKR 门户打开' },
      'fund.more': { en: '+{0} more', zh: '另有 {0} 项' },
    };
  
    function t(key, ...args) {
      const lang = getSavedLang();
      const entry = I18N[key];
      if (!entry) return key;
      let text = entry[lang] || entry.en || key;
      args.forEach((a, i) => { text = text.replace(new RegExp(`\\{${i}\\}`, 'g'), a); });
      return text;
    }
  
    const COLORS = {
      green: '#34C759', blue: '#007AFF', red: '#FF3B30', orange: '#FF9500',
      purple: '#AF52DE', indigo: '#5856D6', teal: '#5AC8FA', pink: '#FF2D55',
      yellow: '#FFCC00', gray: '#8E8E93',
      callGreen: '#34C759', putRed: '#FF3B30',
      posGex: 'rgba(52,199,89,0.7)', negGex: 'rgba(255,59,48,0.7)',
    };
  
    let _token = null;
    let _tokenExpiry = 0;
    let _markitToken = null;
    let _markitTokenExpiry = 0;
    let _tokenFetchPromise = null;
    let _markitTokenFetchPromise = null;
    let _state = {
      symbol: '',
      expirations: [],
      selectedExpIdx: 0,
      chainData: null,
      quoteData: null,
      computed: null,
      strikesCount: 30,
      activeTab: 'market',
      greeksExposureTab: 'Gamma',
      marketIndicesData: null,
    };
    let _charts = {};
    let _root = null;
  
    /* ───────────────────────────────────────────
       §2  API MODULE
    ─────────────────────────────────────────── */
  
    const _isOnSchwab = () => window.location.hostname.includes('schwab.com');
    const _isOnIBKR = () => window.location.hostname.includes('interactivebrokers.com');
    const IBKR_HOST_KEY = 'schwab_opt_ibkr_host';
    const IBKR_DEFAULT_HOST = 'ndcdyn.interactivebrokers.com';
  
    function _normalizeIBKRHost(raw) {
      if (!raw) return '';
      const s = String(raw).trim().toLowerCase();
      if (!s) return '';
      try {
        const host = new URL(s.includes('://') ? s : `https://${s}`).hostname.toLowerCase();
        return host.endsWith('interactivebrokers.com') ? host : '';
      } catch (_) {
        return '';
      }
    }
  
    function _isPreferredIBKRApiHost(host) {
      return /(^|\.)(?:[a-z]*dcdyn|portal)\.interactivebrokers\.com$/i.test(String(host || ''));
    }
  
    function _rememberIBKRHost(host) {
      const normalized = _normalizeIBKRHost(host);
      if (!normalized || !_isPreferredIBKRApiHost(normalized)) return;
      _xSet(IBKR_HOST_KEY, normalized);
    }
  
    function _getIBKRHost() {
      if (_isOnIBKR()) _rememberIBKRHost(window.location.hostname || '');
      const stored = _normalizeIBKRHost(_xGet(IBKR_HOST_KEY, ''));
      if (stored) return stored;
      const current = _normalizeIBKRHost(window.location.hostname || '');
      if (current && _isPreferredIBKRApiHost(current)) return current;
      return IBKR_DEFAULT_HOST;
    }
  
    function _ibkrOrigin() {
      return `https://${_getIBKRHost()}`;
    }
  
    function _ibkrUrl(path = '') {
      if (!path) return _ibkrOrigin();
      if (/^https?:\/\//i.test(path)) return path;
      return `${_ibkrOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
    }
  
    function _ibkrFundBase() {
      return _ibkrUrl('/tws.proxy/');
    }
  
    function _schwabFetch(url, options = {}) {
      if (_isOnSchwab()) {
        return fetch(url, options);
      }
      if (typeof GM_xmlhttpRequest !== 'undefined') {
        return new Promise((resolve, reject) => {
          const method = options.method || 'GET';
          const hdrs = {
            origin: 'https://client.schwab.com',
            referer: 'https://client.schwab.com/',
          };
          if (options.headers) {
            if (options.headers instanceof Headers) {
              options.headers.forEach((v, k) => { hdrs[k] = v; });
            } else {
              Object.assign(hdrs, options.headers);
            }
          }
          GM_xmlhttpRequest({
            method,
            url,
            headers: hdrs,
            data: options.body || undefined,
            anonymous: false,
            onload: (res) => {
              const finalUrl = res.finalUrl || url;
              const wasRedirected = finalUrl !== url && !finalUrl.startsWith(new URL(url).origin + '/api/');
              resolve({
                ok: res.status >= 200 && res.status < 300,
                status: res.status,
                redirected: wasRedirected,
                json: () => { try { return Promise.resolve(JSON.parse(res.responseText)); } catch (e) { return Promise.reject(e); } },
                text: () => Promise.resolve(res.responseText),
              });
            },
            onerror: () => reject(new Error(`Network error fetching ${url}`)),
          });
        });
      }
      throw new Error('GM_xmlhttpRequest not available — please use Tampermonkey');
    }
  
    async function getToken(force = false) {
      if (!force && _token && Date.now() < _tokenExpiry) return _token;
      if (_tokenFetchPromise) return _tokenFetchPromise;
      _tokenFetchPromise = (async () => {
        console.log(TAG, 'Fetching auth token...');
        try {
          const r = await _schwabFetch(API.AUTH, { credentials: 'include' });
          const markExpired = (reason = 'Session expired') => {
            _token = null;
            _tokenExpiry = 0;
            _sessionExpired = true;
            if (!_sessionExpiredToastShown) {
              _sessionExpiredToastShown = true;
              showToast(t('toast.sessionExpired'), 'error', 0);
            }
            throw new Error(reason);
          };
          const looksLikeLoginHtml = (text) => {
            if (!text || typeof text !== 'string') return false;
            return /<html|<form|sso\/login|log\s*in|sign\s*in|username|password/i.test(text);
          };
  
          if (r.status === 401 || r.status === 403) {
            markExpired('Session expired');
          }
          if (!r.ok && !r.redirected) throw new Error(`Auth failed: ${r.status}`);
          const raw = await r.text();
          let d = null;
          try { d = JSON.parse(raw); } catch (_) {}
  
          // Avoid false "session expired" toasts on transient non-JSON responses.
          // Only treat as expired when response clearly looks like a login page / redirect.
          if (!d || !d.token) {
            if (r.redirected || looksLikeLoginHtml(raw)) {
              markExpired('Session expired (login page response)');
            }
            throw new Error(d ? 'No token in response' : 'Auth returned non-JSON response');
          }
          _token = d.token;
          _tokenExpiry = Date.now() + (d.time || 600) * 1000 - 30000;
          _sessionExpired = false;
          _sessionExpiredToastShown = false;
          console.log(TAG, 'Token obtained, expires in', d.time, 's');
          return _token;
        } catch (e) {
          if (!_sessionExpired) {
            console.warn(TAG, 'Token fetch failed:', e.message);
          }
          throw e;
        } finally {
          _tokenFetchPromise = null;
        }
      })();
      return _tokenFetchPromise;
    }
  
    const ACCOUNT_ID_KEY = 'schwab_opt_account_id';
    let _cachedAccountId = null;
    let _accountIdFetchPromise = null;
    let _schwabMarketWarmupPromise = null;
  
    function _extractAccountIdFromCookieString(cookieStr) {
      if (!cookieStr) return null;
      const match = cookieStr.match(/CustAccessInfo=[^|]*\|(\d+)\|/);
      return match ? match[1] : null;
    }
  
    function _getAccountIdFromCookie() {
      return _extractAccountIdFromCookieString(document.cookie || '');
    }
  
    function _saveAccountId(id) {
      _cachedAccountId = id;
      _xSet(ACCOUNT_ID_KEY, id);
    }
  
    async function _resolveAccountId() {
      if (_cachedAccountId) return _cachedAccountId;
      const fromCookie = _getAccountIdFromCookie();
      if (fromCookie) { _saveAccountId(fromCookie); return fromCookie; }
      const stored = _xGet(ACCOUNT_ID_KEY, '');
      if (stored) { _cachedAccountId = stored; return stored; }
      if (typeof GM_xmlhttpRequest === 'undefined') return null;
      if (_accountIdFetchPromise) return _accountIdFetchPromise;
      _accountIdFetchPromise = (async () => {
        try {
          const res = await new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
              method: 'GET',
              url: 'https://client.schwab.com/clientapps/accounts/summary/',
              anonymous: false,
              headers: { accept: 'text/html', origin: 'https://client.schwab.com', referer: 'https://client.schwab.com/' },
              onload: (r) => resolve(r),
              onerror: () => reject(new Error('network')),
            });
          });
          const m = res.responseText.match(/CustAccessInfo=[^|]*\|(\d+)\|/);
          if (m) { _saveAccountId(m[1]); return m[1]; }
          const hm = (res.responseHeaders || '').match(/CustAccessInfo=[^|]*\|(\d+)\|/);
          if (hm) { _saveAccountId(hm[1]); return hm[1]; }
        } catch (e) {
          console.warn(TAG, 'Account ID fetch failed:', e.message);
        } finally {
          _accountIdFetchPromise = null;
        }
        return null;
      })();
      return _accountIdFetchPromise;
    }
  
    function warmupSchwabMarketContext() {
      if (_schwabMarketWarmupPromise) return _schwabMarketWarmupPromise;
      _schwabMarketWarmupPromise = (async () => {
        const t0 = Date.now();
        try {
          await getMarkitToken();
          console.log(TAG, 'Schwab market warmup ready in', Date.now() - t0, 'ms');
        } catch (e) {
          console.warn(TAG, 'Schwab market warmup failed:', e.message);
        } finally {
          _schwabMarketWarmupPromise = null;
        }
      })();
      return _schwabMarketWarmupPromise;
    }
  
    async function getMarkitToken(force = false) {
      if (!force && _markitToken && Date.now() < _markitTokenExpiry) return _markitToken;
      if (_markitTokenFetchPromise) return _markitTokenFetchPromise;
      _markitTokenFetchPromise = (async () => {
        const [, accountId] = await Promise.all([getToken(force), _resolveAccountId()]);
        if (!accountId) throw new Error('Account ID not found');
        const r = await _schwabFetch(API.MARKIT_TOKEN, {
          method: 'POST',
          headers: { ...marketHeaders('1') },
          body: JSON.stringify(accountId),
        });
        if (!r.ok) throw new Error(`Markit token failed: ${r.status}`);
        const d = await r.json();
        if (!d.accessToken) throw new Error('No Markit token in response');
        _markitToken = d.accessToken;
        _markitTokenExpiry = Date.now() + (d.expiresIn || 3600) * 1000 - 30000;
        console.log(TAG, 'Markit token obtained, expires in', d.expiresIn, 's');
        return _markitToken;
      })();
      try {
        return await _markitTokenFetchPromise;
      } finally {
        _markitTokenFetchPromise = null;
      }
    }
  
    function apiHeaders(appId = 'AD00007322', resVer = '3', extra = {}) {
      return {
        authorization: `Bearer ${_token}`,
        'schwab-client-channel': 'IO',
        'schwab-client-appid': appId,
        'schwab-environment': 'PROD',
        'schwab-env': 'PROD',
        'schwab-resource-version': resVer,
        'content-type': 'application/json;charset=UTF-8',
        origin: 'https://client.schwab.com',
        ...extra,
      };
    }
  
    /* ── Session & Token keep-alive ── */
  
    async function pingKeepAlive() {
      if (_sessionExpired) return false;
      try {
        const r = await _schwabFetch(API.KEEP_ALIVE, { credentials: 'include' });
        console.log(TAG, 'KeepAlive ping:', r.status);
        return r.ok;
      } catch (e) {
        console.warn(TAG, 'KeepAlive failed:', e.message);
        return false;
      }
    }
  
    async function proactiveTokenRefresh() {
      if (_sessionExpired) return;
      try {
        await getToken(true);
        console.log(TAG, 'Proactive token refresh OK');
      } catch (_) { /* getToken already handles notifications */ }
    }
  
    function startKeepAlive() {
      stopKeepAlive();
      pingKeepAlive();
      _keepAliveTimer = setInterval(pingKeepAlive, SESSION_KEEP_ALIVE_MS);
      proactiveTokenRefresh();
      _tokenRefreshTimer = setInterval(proactiveTokenRefresh, TOKEN_REFRESH_MS);
      console.log(TAG, 'Keep-alive started: session every',
        SESSION_KEEP_ALIVE_MS / 60000, 'min, token every', TOKEN_REFRESH_MS / 60000, 'min');
    }
  
    function stopKeepAlive() {
      if (_keepAliveTimer) { clearInterval(_keepAliveTimer); _keepAliveTimer = null; }
      if (_tokenRefreshTimer) { clearInterval(_tokenRefreshTimer); _tokenRefreshTimer = null; }
    }
  
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        console.log(TAG, 'Tab resumed, refreshing session...');
        (async () => {
          const alive = await pingKeepAlive();
          if (!alive) {
            showToast('Session may have expired while tab was inactive.', 'warn');
          }
          try {
            await getToken(true);
            console.log(TAG, 'Token refreshed after tab resume');
          } catch (_) { /* handled inside getToken */ }
        })();
  
        // If AI is streaming, refresh visible panel immediately from state cache.
        if (_state.activeTab === 'market' && _aiState.generating) renderAIModule();
        if (_state.activeTab === 'stock' && _stockAIState.generating) renderStockAIModule();
      }
    }
  
    async function searchSymbol(query) {
      console.log(TAG, 'Searching symbol:', query);
      const r = await _schwabFetch(`${API.SEARCH}?query=${encodeURIComponent(query)}&limit=8`);
      if (!r.ok) throw new Error(`Search failed: ${r.status}`);
      const d = await r.json();
      console.log(TAG, 'Search results:', d.data?.length);
      return d.data || [];
    }
  
    async function getQuote(symbol, options = {}) {
      const silent = !!options.silent;
      await getToken();
      if (!silent) console.log(TAG, 'Fetching quote:', symbol);
      const r = await _schwabFetch(`${API.QUOTE}?symbols=${symbol}&isComplex=true`, {
        headers: apiHeaders('AD00007800', '2'),
      });
      if (!r.ok) throw new Error(`Quote failed: ${r.status}`);
      const d = await r.json();
      if (!silent) console.log(TAG, 'Quote:', d.quotes?.[0]?.regularQuote?.lastPrice);
      return d.quotes?.[0] || null;
    }
  
    async function getMiniChains(symbol) {
      await getToken();
      console.log(TAG, 'Fetching mini chains:', symbol);
      const r = await _schwabFetch(`${API.MINI_CHAINS}?symbol=${symbol}`, {
        headers: apiHeaders('AD00007322', '3', { 'schwab-client-functionid': 'OCY21' }),
      });
      if (!r.ok) throw new Error(`MiniChains failed: ${r.status}`);
      const d = await r.json();
      console.log(TAG, 'Expirations:', d.expirationList?.length);
      return d;
    }
  
    async function getOptionChains(symbol, expirationDate) {
      await getToken();
      const dt = new Date(expirationDate);
      const dateStr = `${dt.getMonth() + 1}/${dt.getDate()}/${dt.getFullYear()}`;
      console.log(TAG, 'Fetching option chains:', symbol, dateStr);
      const r = await _schwabFetch(
        `${API.CHAINS}?Symbol=${symbol}&ExpirationDates=${dateStr}&ExpirationTypes=ALL&disableGreeks=false`,
        {
          headers: apiHeaders('AD00007322', '1.0', {
            containerid: 'RESEARCH_CHAINS',
            includeadjusted: 'false',
          }),
        }
      );
      if (!r.ok) throw new Error(`Chains failed: ${r.status}`);
      const d = await r.json();
      const cnt = d.Expirations?.[0]?.Chains?.length || 0;
      console.log(TAG, 'Chains loaded:', cnt, 'strikes');
      return d;
    }
  
    /* ───────────────────────────────────────────
       §3  CALCULATION MODULE
    ─────────────────────────────────────────── */
  
    function parseNum(v) { return parseFloat(typeof v === 'string' ? v.replace(/,/g, '') : v) || 0; }
  
    function normalPDF(x) {
      return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    }
  
    function normalCDF(x) {
      const sign = x < 0 ? -1 : 1;
      const t = 1 / (1 + 0.3275911 * Math.abs(x));
      const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
      return 0.5 * (1 + sign * y);
    }
  
    function computeAll(chainData, quoteData) {
      const underlying = chainData.UnderlyingData;
      const spot = parseNum(underlying?.Last);
      const chains = chainData.Expirations?.[0]?.Chains || [];
      const expGroup = chainData.Expirations?.[0]?.ExpirationGroup;
      const dte = expGroup?.DaysUntil || 0;
  
      const strikes = [];
      const callMap = {};
      const putMap = {};
  
      chains.forEach(c => {
        const legs = c.Legs || [];
        legs.forEach(l => {
          const strk = parseNum(l.Strk);
          if (!strikes.includes(strk)) strikes.push(strk);
          const entry = {
            strike: strk, oi: parseNum(l.OI), vol: parseNum(l.Vol),
            bid: parseNum(l.Bid), ask: parseNum(l.Ask), mark: parseNum(l.Mark),
            last: parseNum(l.Lst), iv: parseNum(l.IV) / 100,
            delta: parseNum(l.Delta), gamma: parseNum(l.Gamma),
            theta: parseNum(l.Theta), vega: parseNum(l.Vega), rho: parseNum(l.Rho),
          };
          if (l.OptionType === 'C') callMap[strk] = entry;
          else putMap[strk] = entry;
        });
      });
  
      strikes.sort((a, b) => a - b);
  
      let atmStrike = strikes[0] || spot;
      let minDiff = Infinity;
      strikes.forEach(s => {
        const diff = Math.abs(s - spot);
        if (diff < minDiff) { minDiff = diff; atmStrike = s; }
      });
  
      const atmCall = callMap[atmStrike];
      const atmPut = putMap[atmStrike];
      const atmCallMid = atmCall ? (atmCall.bid + atmCall.ask) / 2 : 0;
      const atmPutMid = atmPut ? (atmPut.bid + atmPut.ask) / 2 : 0;
  
      const forwardPrice = atmStrike + atmCallMid - atmPutMid;
      const impliedMoveAbs = atmCallMid + atmPutMid;
      const impliedMovePct = spot > 0 ? (impliedMoveAbs / spot) * 100 : 0;
      const stmIV = ((atmCall?.iv || 0) + (atmPut?.iv || 0)) / 2 * 100;
  
      const atmCallIV = (atmCall?.iv || 0) * 100;
      const atmPutIV = (atmPut?.iv || 0) * 100;
      const avgATMIV = (atmCallIV + atmPutIV) / 2;
      const dnsSM = avgATMIV > 0 ? ((atmCallIV - atmPutIV) / avgATMIV * 100) : 0;
  
      let totalCallOI = 0, totalPutOI = 0, totalCallVol = 0, totalPutVol = 0;
      let maxCallOI = 0, maxPutOI = 0, callWall = spot, putWall = spot;
      const gexByStrike = {};
      const callGexByStrike = {};
      const putGexByStrike = {};
      let netGEX = 0;
  
      strikes.forEach(s => {
        const c = callMap[s];
        const p = putMap[s];
        const cOI = c?.oi || 0;
        const pOI = p?.oi || 0;
        const cVol = c?.vol || 0;
        const pVol = p?.vol || 0;
        totalCallOI += cOI;
        totalPutOI += pOI;
        totalCallVol += cVol;
        totalPutVol += pVol;
  
        if (cOI > maxCallOI) { maxCallOI = cOI; callWall = s; }
        if (pOI > maxPutOI) { maxPutOI = pOI; putWall = s; }
  
        const cGamma = c?.gamma || 0;
        const pGamma = p?.gamma || 0;
        const cGEX = cOI * cGamma * 100 * spot * spot * 0.01;
        const pGEX = pOI * pGamma * 100 * spot * spot * 0.01 * -1;
  
        callGexByStrike[s] = cGEX;
        putGexByStrike[s] = pGEX;
        gexByStrike[s] = cGEX + pGEX;
        netGEX += cGEX + pGEX;
      });
  
      let maxPainStrike = atmStrike;
      let minPain = Infinity;
      strikes.forEach(settlePrice => {
        let pain = 0;
        strikes.forEach(s => {
          const c = callMap[s];
          const p = putMap[s];
          if (c && settlePrice > s) pain += (settlePrice - s) * c.oi * 100;
          if (p && settlePrice < s) pain += (s - settlePrice) * p.oi * 100;
        });
        if (pain < minPain) { minPain = pain; maxPainStrike = settlePrice; }
      });
  
      let cumGEX = 0;
      const cumGexByStrike = {};
      const cumCallGexByStrike = {};
      const cumPutGexByStrike = {};
      let cumCallGex = 0, cumPutGex = 0;
      let gammaFlip = null;
      let prevCum = null;
      strikes.forEach(s => {
        cumGEX += gexByStrike[s] || 0;
        cumCallGex += callGexByStrike[s] || 0;
        cumPutGex += putGexByStrike[s] || 0;
        cumGexByStrike[s] = cumGEX;
        cumCallGexByStrike[s] = cumCallGex;
        cumPutGexByStrike[s] = cumPutGex;
        if (prevCum !== null && ((prevCum >= 0 && cumGEX < 0) || (prevCum < 0 && cumGEX >= 0))) {
          gammaFlip = s;
        }
        prevCum = cumGEX;
      });
  
      const minIVStrike = strikes.reduce((best, s) => {
        const c = callMap[s];
        const p = putMap[s];
        const avgIV = ((c?.iv || 999) + (p?.iv || 999)) / 2;
        return avgIV < best.iv ? { strike: s, iv: avgIV } : best;
      }, { strike: atmStrike, iv: 999 }).strike;
  
      const pcOIRatio = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;
  
      const T = dte / 365;
      const r = 0.045;
      if (T > 0 && spot > 0) {
        strikes.forEach(s => {
          [callMap[s], putMap[s]].forEach(opt => {
            if (!opt || opt.iv <= 0) { if (opt) { opt.vanna = 0; opt.charm = 0; } return; }
            const sigma = opt.iv;
            const sqrtT = Math.sqrt(T);
            const d1 = (Math.log(spot / s) + (r + sigma * sigma / 2) * T) / (sigma * sqrtT);
            const d2 = d1 - sigma * sqrtT;
            const pdf = normalPDF(d1);
            opt.vanna = -pdf * d2 / sigma;
            opt.charm = -pdf * (2 * r * T - d2 * sigma * sqrtT) / (2 * T * sigma * sqrtT);
          });
        });
      } else {
        strikes.forEach(s => {
          [callMap[s], putMap[s]].forEach(opt => { if (opt) { opt.vanna = 0; opt.charm = 0; } });
        });
      }
  
      const greeksExposure = {};
      ['gamma', 'delta', 'theta', 'vega', 'vanna', 'charm'].forEach(greek => {
        greeksExposure[greek] = { positive: {}, negative: {}, net: {} };
        const negPut = greek === 'gamma' || greek === 'vanna' ? -1 : 1;
        strikes.forEach(s => {
          const c = callMap[s];
          const p = putMap[s];
          const cVal = (c?.oi || 0) * (c?.[greek] || 0) * 100;
          const pVal = (p?.oi || 0) * (p?.[greek] || 0) * 100 * negPut;
          const netVal = cVal + pVal;
          greeksExposure[greek].positive[s] = Math.max(0, netVal);
          greeksExposure[greek].negative[s] = Math.min(0, netVal);
          greeksExposure[greek].net[s] = netVal;
        });
      });
  
      const gammaEnv = netGEX > 0 ? 'positive' : 'negative';
      const bullishScore = computeBullishScore(spot, forwardPrice, putWall, callWall, maxPainStrike, pcOIRatio, gammaEnv);
  
      const insights = generateInsights(spot, forwardPrice, putWall, callWall, maxPainStrike, pcOIRatio, gammaEnv, impliedMovePct, impliedMoveAbs, dte);
  
      const result = {
        spot, atmStrike, forwardPrice, impliedMoveAbs, impliedMovePct, stmIV, dnsSM,
        totalCallOI, totalPutOI, totalCallVol, totalPutVol, pcOIRatio,
        callWall, putWall, maxPainStrike, gammaFlip, minIVStrike, netGEX,
        strikes, callMap, putMap,
        gexByStrike, callGexByStrike, putGexByStrike,
        cumGexByStrike, cumCallGexByStrike, cumPutGexByStrike,
        greeksExposure, gammaEnv, bullishScore, insights, dte,
        expGroup, underlying,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
      };
      console.log(TAG, 'Computed:', { spot, atmStrike, forwardPrice, maxPainStrike, callWall, putWall, gammaFlip, netGEX: netGEX.toFixed(0), pcOIRatio: pcOIRatio.toFixed(2) });
      return result;
    }
  
    function computeBullishScore(spot, forward, putWall, callWall, maxPain, pcRatio, gammaEnv) {
      let score = 50;
      if (spot > maxPain) score += 8; else score -= 8;
      if (forward > spot) score += 5; else score -= 5;
      if (pcRatio < 0.7) score += 10; else if (pcRatio > 1.3) score -= 10;
      if (gammaEnv === 'positive') score += 7; else score -= 7;
      if (spot > putWall && spot < callWall) score += 5;
      return Math.max(0, Math.min(100, score));
    }
  
    function generateInsights(spot, forward, putWall, callWall, maxPain, pcRatio, gammaEnv, implMvPct, implMvAbs, dte) {
      const insights = [];
      if (gammaEnv === 'positive') {
        insights.push({ type: 'GAMMA', color: COLORS.green, title: t('insight.gamma.pos.title'),
          text: t('insight.gamma.pos.text') });
      } else {
        insights.push({ type: 'GAMMA', color: COLORS.red, title: t('insight.gamma.neg.title'),
          text: t('insight.gamma.neg.text') });
      }
  
      const lowHigh = pcRatio < 1 ? (getSavedLang() === 'zh' ? '低' : 'Low') : (getSavedLang() === 'zh' ? '高' : 'High');
      insights.push({ type: 'DEALER FLOW', color: COLORS.orange,
        title: `${lowHigh} Put/Call OI Ratio (${pcRatio.toFixed(2)})`,
        text: pcRatio < 1 ? t('insight.flow.lowPc') : t('insight.flow.highPc') });
  
      const maxPainDist = ((spot - maxPain) / spot * 100).toFixed(1);
      const aboveBelow = parseFloat(maxPainDist) > 0 ? t('insight.maxpain.above') : t('insight.maxpain.below');
      insights.push({ type: 'KEY LEVELS', color: COLORS.teal,
        title: `Max Pain @ $${maxPain}`,
        text: t('insight.maxpain.text', Math.abs(maxPainDist), aboveBelow) });
  
      insights.push({ type: 'KEY LEVELS', color: COLORS.yellow,
        title: `Support $${putWall} / Resistance $${callWall}`,
        text: t('insight.support.text').replace('${0}', '$' + putWall).replace('${1}', '$' + callWall) });
  
      const rangeHigh = (spot * (1 + implMvPct / 100)).toFixed(2);
      const rangeLow = (spot * (1 - implMvPct / 100)).toFixed(2);
      insights.push({ type: 'VOL STATUS', color: COLORS.purple,
        title: `Expected Move (Straddle-mid): ±${implMvPct.toFixed(2)}% ($${implMvAbs.toFixed(2)})`,
        text: t('insight.vol.text', implMvPct.toFixed(2)).replace('${1}', '$' + rangeLow).replace('${2}', '$' + rangeHigh) });
  
      return insights;
    }
  
    /* ───────────────────────────────────────────
       §4  CACHE MODULE (IndexedDB)
    ─────────────────────────────────────────── */
  
    const IDB_NAME = 'SchwabOptDash';
    const IDB_VERSION = 1;
    const IDB_STORE = 'chains';
    let _db = null;
  
    function openDB() {
      if (_db) return Promise.resolve(_db);
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            const store = db.createObjectStore(IDB_STORE, { keyPath: 'id' });
            store.createIndex('symbol', 'symbol', { unique: false });
            store.createIndex('date', 'date', { unique: false });
            store.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };
        req.onsuccess = (e) => { _db = e.target.result; requestPersistentStorage(); resolve(_db); };
        req.onerror = (e) => { console.error(TAG, 'IndexedDB open failed:', e); reject(e); };
      });
    }
  
    async function requestPersistentStorage() {
      if (!navigator.storage?.persist) return;
      try {
        const already = await navigator.storage.persisted();
        if (already) {
          console.log(TAG, 'Storage already persistent');
          return;
        }
        const granted = await navigator.storage.persist();
        console.log(TAG, 'Persistent storage:', granted ? 'granted' : 'denied');
        if (!granted) {
          console.warn(TAG, 'Browser may evict IndexedDB data under storage pressure');
        }
      } catch (e) {
        console.warn(TAG, 'Persistent storage request failed:', e.message);
      }
    }
  
    function idbTx(mode = 'readonly') {
      return _db.transaction(IDB_STORE, mode).objectStore(IDB_STORE);
    }
  
    function idbReq(req) {
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
  
    async function idbCacheGet(symbol, dateStr) {
      try {
        await openDB();
        const rec = await idbReq(idbTx().get(`${symbol}_${dateStr}`));
        if (!rec) return null;
        console.log(TAG, 'Cache hit:', symbol, dateStr);
        return { data: rec.data, timestamp: rec.timestamp };
      } catch (e) { console.warn(TAG, 'cacheGet error:', e); return null; }
    }
  
    async function idbCacheSet(symbol, dateStr, data) {
      try {
        await openDB();
        const json = JSON.stringify(data);
        const rec = {
          id: `${symbol}_${dateStr}`,
          symbol,
          date: dateStr,
          timestamp: Date.now(),
          size: json.length,
          data,
        };
        await idbReq(idbTx('readwrite').put(rec));
        console.log(TAG, 'Cached:', symbol, dateStr, (json.length / 1024).toFixed(1), 'KB');
      } catch (e) { console.warn(TAG, 'cacheSet error:', e); }
    }
  
    async function idbCacheList() {
      try {
        await openDB();
        const all = await idbReq(idbTx().getAll());
        const items = {};
        for (const rec of all) {
          if (!items[rec.symbol]) items[rec.symbol] = [];
          items[rec.symbol].push({
            dateStr: rec.date,
            key: rec.id,
            size: rec.size || 0,
            timestamp: rec.timestamp || 0,
          });
        }
        Object.values(items).forEach(arr => arr.sort((a, b) => a.dateStr.localeCompare(b.dateStr)));
        return items;
      } catch (e) { console.warn(TAG, 'cacheList error:', e); return {}; }
    }
  
    async function idbCacheDelete(key) {
      try {
        await openDB();
        await idbReq(idbTx('readwrite').delete(key));
        console.log(TAG, 'Cache deleted:', key);
      } catch (e) { console.warn(TAG, 'cacheDelete error:', e); }
    }
  
    async function idbCacheDeleteSymbol(symbol) {
      try {
        await openDB();
        const list = await idbCacheList();
        const store = idbTx('readwrite');
        for (const item of (list[symbol] || [])) {
          store.delete(item.key);
        }
        console.log(TAG, 'Cache cleared for symbol:', symbol);
      } catch (e) { console.warn(TAG, 'cacheDeleteSymbol error:', e); }
    }
  
    async function idbCacheClearAll() {
      try {
        await openDB();
        await idbReq(idbTx('readwrite').clear());
        console.log(TAG, 'All cache cleared');
      } catch (e) { console.warn(TAG, 'cacheClearAll error:', e); }
    }
  
    async function idbCacheExport(symbolFilter) {
      await openDB();
      const all = await idbReq(idbTx().getAll());
      const filtered = symbolFilter ? all.filter(r => r.symbol === symbolFilter) : all;
      const payload = filtered.map(r => ({ id: r.id, symbol: r.symbol, date: r.date, timestamp: r.timestamp, data: r.data }));
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const label = symbolFilter || 'all';
      a.download = `schwab-opt-${label}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      console.log(TAG, 'Exported', filtered.length, 'entries for', label);
    }
  
    async function idbCacheImport() {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
          try {
            const file = e.target.files[0];
            if (!file) { resolve(0); return; }
            const text = await file.text();
            const records = JSON.parse(text);
            if (!Array.isArray(records)) throw new Error('Invalid format: expected array');
            await openDB();
            const store = idbTx('readwrite');
            let count = 0;
            for (const rec of records) {
              if (!rec.id || !rec.symbol || !rec.date || !rec.data) continue;
              store.put({
                id: rec.id,
                symbol: rec.symbol,
                date: rec.date,
                timestamp: rec.timestamp || Date.now(),
                size: JSON.stringify(rec.data).length,
                data: rec.data,
              });
              count++;
            }
            console.log(TAG, 'Imported', count, 'entries from', file.name);
            resolve(count);
          } catch (err) {
            console.error(TAG, 'Import failed:', err);
            alert('Import failed: ' + err.message);
            resolve(0);
          }
        };
        input.click();
      });
    }
  
    /* ───────────────────────────────────────────
       §4b  CACHE ALIASES
    ─────────────────────────────────────────── */
  
    function cacheGet(symbol, dateStr) { return idbCacheGet(symbol, dateStr); }
    function cacheSet(symbol, dateStr, data) { return idbCacheSet(symbol, dateStr, data); }
    function cacheList() { return idbCacheList(); }
    function cacheDelete(key) { return idbCacheDelete(key); }
    function cacheDeleteSymbol(symbol) { return idbCacheDeleteSymbol(symbol); }
    function cacheClearAll() { return idbCacheClearAll(); }
    function cacheExport(symbolFilter) { return idbCacheExport(symbolFilter); }
    function cacheImport() { return idbCacheImport(); }
  
    /* ───────────────────────────────────────────
       §5  THEME MODULE
    ─────────────────────────────────────────── */
  
    function getSavedTheme() { return _xGet(THEME_KEY, 'system'); }
    function saveTheme(mode) { _xSet(THEME_KEY, mode); }
  
    function resolveTheme(mode) {
      if (mode === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return mode;
    }
  
    function applyTheme() {
      const mode = getSavedTheme();
      const resolved = resolveTheme(mode);
      if (_root) _root.setAttribute('data-theme', resolved);
      console.log(TAG, 'Theme applied:', mode, '->', resolved);
    }
  
    function watchSystemTheme() {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (getSavedTheme() === 'system') applyTheme();
      });
    }
  
    /* ───────────────────────────────────────────
       §6  STYLES
    ─────────────────────────────────────────── */
  
    function injectStyles() {
      const css = `
        @import url('https://fonts.googleapis.com/icon?family=Material+Icons');
  
        #schwab-opt-root {
          --bg: rgba(245,245,247,0.92);
          --card: rgba(255,255,255,0.85);
          --card-solid: #ffffff;
          --text: #1c1c1e;
          --text2: #636366;
          --text3: #aeaeb2;
          --border: rgba(0,0,0,0.06);
          --shadow: 0 2px 16px rgba(0,0,0,0.08);
          --input-bg: rgba(255,255,255,0.9);
          --hover: rgba(0,0,0,0.04);
          --tag-bg: rgba(0,0,0,0.05);
          position: fixed; inset: 0; z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro', 'Helvetica Neue', Arial, sans-serif;
          font-size: 13px; color: var(--text); line-height: 1.43; letter-spacing: 0.15px;
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          background: var(--bg);
          overflow: hidden;
          display: none;
          flex-direction: column;
        }
        #schwab-opt-root[data-theme="dark"] {
          --bg: rgba(28,28,30,0.94);
          --card: rgba(44,44,46,0.85);
          --card-solid: #2c2c2e;
          --text: #f5f5f7;
          --text2: #a1a1a6;
          --text3: #636366;
          --border: rgba(255,255,255,0.08);
          --shadow: 0 2px 16px rgba(0,0,0,0.3);
          --input-bg: rgba(58,58,60,0.9);
          --hover: rgba(255,255,255,0.06);
          --tag-bg: rgba(255,255,255,0.1);
        }
        #schwab-opt-root *, #schwab-opt-root *::before, #schwab-opt-root *::after { box-sizing: border-box; }
        #schwab-opt-root button, #schwab-opt-root input, #schwab-opt-root select, #schwab-opt-root textarea {
          font-family: inherit; line-height: inherit; letter-spacing: inherit;
        }
        #schwab-opt-root button:focus, #schwab-opt-root select:focus, #schwab-opt-root input:focus, #schwab-opt-root textarea:focus { outline: none; }
        /* Neutralize host-page form-control styles (Schwab injects large margins/heights globally). */
        #schwab-opt-root :is(button, input, select, textarea) {
          margin: 0 !important;
          height: auto !important;
          min-height: 0 !important;
          line-height: inherit !important;
        }
        #schwab-opt-root input[type="checkbox"],
        #schwab-opt-root input[type="radio"] {
          height: auto !important;
          min-height: 0 !important;
        }
        #schwab-opt-root table {
          margin: 0 !important;
          border-spacing: 0;
        }
        /* Reset host-page form control spacing inside Settings (Schwab injects aggressive input margins). */
        #schwab-opt-root #sod-page-settings .sod-secret-input,
        #schwab-opt-root #sod-page-settings input[type="text"],
        #schwab-opt-root #sod-page-settings .sod-m-input {
          margin: 0 !important;
          height: auto !important;
          min-height: 0 !important;
        }
        #schwab-opt-root .sod-secret-input {
          -webkit-text-security: disc;
          text-security: disc;
        }
        #schwab-opt-root ::-webkit-scrollbar { width: 0; height: 0; }
        #schwab-opt-root { scrollbar-width: none; }
        #schwab-opt-root * { scrollbar-width: none; }
  
        .sod-inner { width: 100%; padding: 0 16px 0; flex: 1; overflow: hidden; display: flex; flex-direction: column; }
  
        /* Tab bar */
        .sod-tabs {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 16px; flex-shrink: 0; z-index: 10;
          background: var(--bg);
        }
        .sod-tab {
          padding: 7px 18px; border-radius: 20px; cursor: pointer;
          font-weight: 600; font-size: 13px; border: none;
          background: transparent; color: var(--text2); transition: all 0.2s;
        }
        .sod-tab:hover { background: var(--hover); }
        .sod-tab.active { background: ${COLORS.blue}; color: #fff; }
        .sod-close {
          position: absolute; top: 10px; right: 12px; z-index: 100;
          width: 36px !important; height: 36px !important; border-radius: 50%; padding: 0;
          border: none; background: var(--hover); color: var(--text2);
          cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .sod-close:hover { background: ${COLORS.red}; color: #fff; }
  
        /* Control bar */
        #schwab-opt-root .sod-controls {
          display: flex !important; flex-wrap: wrap !important; align-items: center !important; gap: 6px !important;
          width: 100% !important; max-width: 100% !important; margin: 0 !important;
          padding: 6px 0 !important; border-bottom: 1px solid var(--border); flex-shrink: 0;
        }
        #schwab-opt-root .sod-controls > * { margin: 0 !important; align-self: center !important; flex: 0 0 auto; }
        #schwab-opt-root .sod-input {
          padding: 7px 12px; border-radius: 10px; border: 1px solid var(--border);
          background: var(--input-bg); color: var(--text); font-size: 13px;
          outline: none; min-width: 100px; margin: 0 !important;
        }
        #schwab-opt-root .sod-input:focus { border-color: ${COLORS.blue}; box-shadow: 0 0 0 3px rgba(0,122,255,0.15); }
        #schwab-opt-root .sod-btn {
          padding: 7px 16px; border-radius: 10px; border: none;
          font-weight: 600; font-size: 12px; cursor: pointer;
          display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s;
          margin: 0 !important;
        }
        #schwab-opt-root .sod-btn-primary { background: ${COLORS.green}; color: #fff; }
        #schwab-opt-root .sod-btn-primary:hover { filter: brightness(1.1); }
        #schwab-opt-root .sod-btn-secondary { background: var(--tag-bg); color: var(--text); }
        #schwab-opt-root .sod-btn-secondary:hover { background: var(--hover); }
        #schwab-opt-root .sod-btn-blue { background: ${COLORS.blue}; color: #fff; }
        #schwab-opt-root .sod-btn-blue:hover { filter: brightness(1.1); }
        #schwab-opt-root .sod-btn-red { background: ${COLORS.red}; color: #fff; }
        #schwab-opt-root .sod-btn-red:hover { filter: brightness(1.1); }
        #schwab-opt-root .sod-btn-sm { padding: 4px 10px; font-size: 11px; border-radius: 8px; }
        #schwab-opt-root .sod-select {
          padding: 7px 28px 7px 12px; border-radius: 10px; border: 1px solid var(--border);
          background: var(--input-bg); color: var(--text); font-size: 13px;
          outline: none; appearance: none; cursor: pointer;
          width: auto !important; max-width: 100%; margin: 0 !important;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' stroke='%23888' fill='none' stroke-width='1.5'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 10px center;
        }
        .sod-mode-toggle {
          display: inline-flex; border-radius: 10px; overflow: hidden; border: 1px solid var(--border);
        }
        .sod-mode-btn {
          padding: 6px 14px; border: none; font-size: 12px; font-weight: 600;
          cursor: pointer; background: var(--input-bg); color: var(--text2); transition: all 0.15s;
        }
        .sod-mode-btn.active { background: ${COLORS.blue}; color: #fff; }
        #schwab-opt-root .sod-label { font-size: 11px; color: var(--text3); font-weight: 500; }
  
        /* Stats bar */
        .sod-stats {
          display: flex; flex-wrap: nowrap; gap: 2px; padding: 4px 0;
          border-bottom: 1px solid var(--border); font-size: 11px; flex-shrink: 0;
          overflow-x: auto;
        }
        .sod-stat {
          display: flex; flex-direction: column; align-items: center;
          padding: 2px 8px; min-width: 60px;
        }
        .sod-stat-label { color: var(--text3); font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
        .sod-stat-value { font-weight: 700; font-size: 12px; margin-top: 1px; }
        .sod-stat-value.green { color: ${COLORS.green}; }
        .sod-stat-value.red { color: ${COLORS.red}; }
        .sod-stat-value.blue { color: ${COLORS.blue}; }
        .sod-stat-value.orange { color: ${COLORS.orange}; }
        .sod-stat-value.purple { color: ${COLORS.purple}; }
  
        /* Grid */
        .sod-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: 1fr 1fr;
          gap: 10px; padding: 10px 0 10px; flex: 1; min-height: 0;
        }
        @media (max-width: 1200px) { .sod-grid { grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(3, 1fr); } }
        @media (max-width: 800px) { .sod-grid { grid-template-columns: 1fr; grid-template-rows: auto; overflow-y: auto; } }
  
        /* Cards */
        .sod-card {
          background: var(--card); border-radius: 14px; padding: 12px;
          box-shadow: var(--shadow); border: 1px solid var(--border);
          backdrop-filter: blur(12px); overflow-y: auto; overflow-x: hidden;
          display: flex; flex-direction: column; min-height: 0;
        }
        .sod-card-title {
          font-size: 15px; font-weight: 700; margin-bottom: 6px; flex-shrink: 0;
          display: flex; align-items: center; letter-spacing: -0.2px;
        }
        .sod-card-subtitle {
          font-size: 10px; color: var(--text3); margin-bottom: 8px; flex-shrink: 0;
        }
  
        /* Insights panel */
        .sod-insights-meter {
          height: 6px; border-radius: 3px; margin: 6px 0 4px;
          background: linear-gradient(90deg, ${COLORS.red}, ${COLORS.orange}, ${COLORS.yellow}, ${COLORS.green}, ${COLORS.teal});
          position: relative; flex-shrink: 0;
        }
        .sod-insights-dot {
          width: 14px; height: 14px; border-radius: 50%; background: #fff;
          border: 2px solid var(--text); position: absolute; top: -4px;
          transform: translateX(-50%); box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          transition: left 0.4s ease;
        }
        .sod-insights-label {
          font-size: 10px; font-weight: 700; margin-bottom: 2px; flex-shrink: 0;
        }
        .sod-insight-item {
          padding: 6px 10px; border-radius: 10px; margin-bottom: 5px;
          border-left: 3px solid; background: var(--tag-bg);
        }
        .sod-insight-type {
          display: inline-block; padding: 1px 6px; border-radius: 5px;
          font-size: 9px; font-weight: 700; color: #fff; margin-bottom: 2px;
        }
        .sod-insight-title { font-weight: 700; font-size: 11px; margin-bottom: 1px; }
        .sod-insight-text { font-size: 10px; color: var(--text2); line-height: 1.3; }
  
        /* Key levels cards */
        .sod-key-levels-row {
          display: flex; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; flex-shrink: 0;
        }
        .sod-key-card {
          flex: 1; min-width: 70px; padding: 5px 8px; border-radius: 10px;
          text-align: center; color: #fff; font-size: 10px;
        }
        .sod-key-card-label { opacity: 0.85; font-size: 8px; font-weight: 500; }
        .sod-key-card-value { font-size: 14px; font-weight: 800; }
        .sod-key-card-sub { font-size: 8px; opacity: 0.7; }
        .sod-price-row {
          display: flex; gap: 12px; justify-content: space-around; margin-bottom: 6px; text-align: center; flex-shrink: 0;
        }
        .sod-price-label { font-size: 9px; color: var(--text3); text-transform: uppercase; font-weight: 600; }
        .sod-price-value { font-size: 14px; font-weight: 800; }
  
        /* Greeks exposure tabs */
        .sod-greek-tabs {
          display: flex; gap: 3px; margin-bottom: 6px; flex-wrap: wrap; flex-shrink: 0;
        }
        .sod-greek-tab {
          padding: 4px 10px; border-radius: 7px; border: none;
          font-size: 10px; font-weight: 600; cursor: pointer;
          background: var(--tag-bg); color: var(--text2); transition: all 0.15s;
        }
        .sod-greek-tab.active { background: ${COLORS.blue}; color: #fff; }
  
        /* Chart containers */
        .sod-chart-wrap { position: relative; width: 100%; flex: 1; min-height: 80px; }
        .sod-chart-wrap canvas { width: 100% !important; height: 100% !important; cursor: grab; }
        .sod-chart-wrap canvas:active { cursor: grabbing; }
  
        /* Settings page */
        .sod-settings { max-width: 1080px; width: 100%; margin: 0 auto; padding: 20px 16px; }
        .sod-settings-title { font-size: 22px; font-weight: 800; text-align: center; margin-bottom: 24px; }
        .sod-settings-columns { display: flex; gap: 16px; align-items: flex-start; }
        .sod-settings-col-left { flex: 0 0 520px; max-width: 520px; min-width: 0; }
        .sod-settings-col-right { flex: 0 0 520px; max-width: 520px; min-width: 0; }
        .sod-settings-section {
          background: var(--card); border-radius: 16px; padding: 20px;
          box-shadow: var(--shadow); border: 1px solid var(--border); margin-bottom: 16px;
        }
        .sod-settings-heading {
          font-size: 15px; font-weight: 700; margin-bottom: 12px;
          display: flex; align-items: center; gap: 8px;
        }
        .sod-theme-options { display: flex; gap: 8px; }
        .sod-theme-btn {
          padding: 8px 20px; border-radius: 10px; border: 2px solid var(--border);
          background: var(--input-bg); color: var(--text); font-size: 13px;
          font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;
          transition: all 0.15s;
        }
        .sod-theme-btn.active { border-color: ${COLORS.blue}; background: ${COLORS.blue}; color: #fff; }
  
        /* Cache tree */
        .sod-cache-summary { font-size: 12px; color: var(--text2); margin: 8px 0 12px; }
        .sod-cache-group {
          border: 1px solid var(--border); border-radius: 12px;
          margin-bottom: 8px; overflow: hidden;
        }
        .sod-cache-group-header {
          display: flex; align-items: center; gap: 8px; padding: 10px 14px;
          cursor: pointer; font-weight: 600; font-size: 13px;
          background: var(--tag-bg); user-select: none;
        }
        .sod-cache-group-header:hover { background: var(--hover); }
        .sod-cache-arrow { transition: transform 0.2s; font-size: 16px; }
        .sod-cache-arrow.open { transform: rotate(90deg); }
        .sod-cache-items { display: none; }
        .sod-cache-items.open { display: block; }
        .sod-cache-item {
          display: flex; align-items: center; gap: 8px; padding: 8px 14px 8px 36px;
          font-size: 12px; border-top: 1px solid var(--border);
        }
        .sod-cache-item:hover { background: var(--hover); }
        .sod-cache-item-info { flex: 1; color: var(--text2); }
        .sod-cache-actions { display: flex; gap: 4px; margin-left: auto; }
  
        /* Search dropdown */
        #schwab-opt-root .sod-search-wrap { position: relative; margin: 0 !important; }
        #schwab-opt-root .sod-search-dropdown {
          position: absolute; top: 100%; left: 0; min-width: 260px;
          background: var(--card); border: 1px solid var(--border);
          border-radius: 12px; box-shadow: var(--shadow); z-index: 100;
          max-height: 240px; overflow-y: auto; margin-top: 4px;
          backdrop-filter: blur(20px);
        }
        #schwab-opt-root .sod-search-item {
          padding: 8px 14px; cursor: pointer; display: flex;
          justify-content: space-between; align-items: center;
          font-size: 12px;
        }
        #schwab-opt-root .sod-search-item:hover { background: var(--hover); }
        #schwab-opt-root .sod-search-item-sym { font-weight: 700; }
        #schwab-opt-root .sod-search-item-name { color: var(--text2); font-size: 11px; max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  
        /* Trigger button */
        #schwab-opt-trigger {
          position: fixed; bottom: 20px; right: 20px; z-index: 999998;
          width: 48px; height: 48px; border-radius: 50%;
          background: linear-gradient(135deg, ${COLORS.blue}, ${COLORS.purple});
          color: #fff; border: none; cursor: pointer;
          box-shadow: 0 4px 16px rgba(0,122,255,0.4);
          font-size: 22px; display: flex; align-items: center; justify-content: center;
          transition: transform 0.2s;
        }
        #schwab-opt-trigger:hover { transform: scale(1.1); }
  
        /* Loading spinner */
        .sod-loading {
          display: inline-block; width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
          border-radius: 50%; animation: sod-spin 0.6s linear infinite;
        }
        @keyframes sod-spin { to { transform: rotate(360deg); } }
  
        .sod-page { display: none; width: 100%; }
        .sod-page.active { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; width: 100%; }
        #sod-page-settings.active { overflow-y: auto; align-items: center; }
  
        .sod-empty { text-align: center; padding: 60px 20px; color: var(--text3); font-size: 14px; }
  
        /* Toast notifications */
        .sod-toast-container {
          position: fixed; top: 16px; right: 16px; z-index: 1000000;
          display: flex; flex-direction: column; gap: 8px; pointer-events: none;
        }
        .sod-toast {
          pointer-events: auto;
          display: flex; align-items: center; gap: 8px;
          padding: 10px 16px; border-radius: 12px;
          font-size: 12px; font-weight: 500; line-height: 1.4;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
          animation: sod-toast-in 0.3s ease;
          max-width: 380px; cursor: pointer;
        }
        .sod-toast.sod-toast-out { animation: sod-toast-out 0.25s ease forwards; }
        .sod-toast-info  { background: rgba(0,122,255,0.92); color: #fff; }
        .sod-toast-warn  { background: rgba(255,149,0,0.92); color: #fff; }
        .sod-toast-error { background: rgba(255,59,48,0.92); color: #fff; }
        .sod-toast .material-icons { font-size: 18px; flex-shrink: 0; }
        @keyframes sod-toast-in  { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes sod-toast-out { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(40px); } }
  
        /* ═══════════════════════════════════════════
           US MARKET MODULE STYLES
        ═══════════════════════════════════════════ */
  
        /* Market ticker bar */
        .sod-market-ticker {
          display: flex; flex-wrap: nowrap; gap: 2px; padding: 7px 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          margin: 4px 0 6px;
          font-size: 12px; flex-shrink: 0; overflow-x: auto;
        }
  
        /* Colorful card titles — iOS vibrant */
        .sod-card-title-indices { color: #FF6384; }
        .sod-card-title-calendar { color: ${COLORS.indigo}; }
        .sod-card-title-news { color: ${COLORS.orange}; }
        .sod-card-title-movers { color: ${COLORS.green}; }
        .sod-card-title-ai { color: ${COLORS.purple}; }
        .sod-card-icon { font-size: 18px; vertical-align: -3px; margin-right: 6px; }
  
        .sod-market-layout {
          display: flex; flex: 1; min-height: 0; padding: 0; gap: 0;
        }
        .sod-market-col {
          display: flex; flex-direction: column; min-width: 80px; gap: 0; min-height: 0;
        }
        .sod-market-col > .sod-card { flex: 1; min-height: 60px; overflow: hidden; }
        .sod-resize-h {
          width: 6px; cursor: col-resize; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          position: relative; z-index: 5;
        }
        .sod-resize-h::after {
          content: ''; width: 2px; height: 28px; border-radius: 1px;
          background: var(--border); transition: background 0.15s;
        }
        .sod-resize-h:hover::after, .sod-resize-h.active::after {
          background: ${COLORS.blue}; width: 3px;
        }
        .sod-resize-v {
          height: 6px; cursor: row-resize; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          position: relative; z-index: 5;
        }
        .sod-resize-v::after {
          content: ''; height: 2px; width: 28px; border-radius: 1px;
          background: var(--border); transition: background 0.15s;
        }
        .sod-resize-v:hover::after, .sod-resize-v.active::after {
          background: ${COLORS.blue}; height: 3px;
        }
  
        /* Module internal controls */
        .sod-m-controls {
          display: flex; flex-wrap: wrap; align-items: center; gap: 5px;
          padding-bottom: 7px; border-bottom: 1px solid var(--border); flex-shrink: 0;
          margin-bottom: 7px;
        }
        .sod-m-tabs {
          display: flex; gap: 2px; flex-wrap: wrap; flex-shrink: 0;
        }
        .sod-m-tab {
          padding: 4px 10px; border-radius: 8px; border: none;
          font-size: 11px; font-weight: 600; cursor: pointer;
          background: var(--tag-bg); color: var(--text2); transition: all 0.15s;
          white-space: nowrap;
        }
        .sod-m-tab:hover { background: var(--hover); }
        .sod-m-tab.active { background: ${COLORS.blue}; color: #fff; }
  
        .sod-m-select {
          padding: 4px 22px 4px 8px; border-radius: 8px; border: 1px solid var(--border);
          background: var(--input-bg); color: var(--text); font-size: 11px;
          outline: none; appearance: none; cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' stroke='%23888' fill='none' stroke-width='1.5'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 6px center;
        }
        .sod-m-input {
          padding: 4px 9px; border-radius: 8px; border: 1px solid var(--border);
          background: var(--input-bg); color: var(--text); font-size: 11px; outline: none;
        }
        .sod-m-input:focus { border-color: ${COLORS.blue}; box-shadow: 0 0 0 2px rgba(0,122,255,0.12); }
        #schwab-opt-root #sod-cal-search { padding: 5px 8px !important; font-size: 12px !important; min-height: 26px !important; }
        .sod-m-btn {
          padding: 4px 11px; border-radius: 8px; border: none;
          font-weight: 600; font-size: 11px; cursor: pointer;
          display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s;
        }
        .sod-m-btn-primary { background: ${COLORS.blue}; color: #fff; }
        .sod-m-btn-primary:hover { filter: brightness(1.1); }
  
        /* Indices module */
        .sod-idx-mode { display: inline-flex; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
        .sod-idx-mode-btn {
          padding: 4px 11px; border: none; font-size: 11px; font-weight: 600;
          cursor: pointer; background: var(--input-bg); color: var(--text2); transition: all 0.12s;
        }
        .sod-idx-mode-btn.active { background: ${COLORS.blue}; color: #fff; }
        .sod-idx-dropdown {
          position: relative; display: inline-block;
        }
        .sod-idx-dropdown-menu {
          position: absolute; top: 100%; left: 0; min-width: 180px;
          background: var(--card); border: 1px solid var(--border);
          border-radius: 10px; box-shadow: var(--shadow); z-index: 100; margin-top: 2px;
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          display: none;
        }
        .sod-idx-dropdown-menu.open { display: block; }
        .sod-idx-group-label {
          padding: 8px 12px; font-size: 11px; font-weight: 600; color: var(--text);
          display: flex; justify-content: space-between; align-items: center; cursor: pointer;
          position: relative;
        }
        .sod-idx-group-label:hover { background: var(--hover); }
        .sod-idx-group-label::after { content: '▸'; font-size: 10px; color: var(--text3); margin-left: auto; padding-left: 8px; }
        .sod-idx-submenu {
          display: none; position: absolute; left: calc(100% + 2px); top: -1px;
          min-width: 260px; max-height: 360px; overflow-y: auto;
          background: var(--card); border: 1px solid var(--border);
          border-radius: 10px; box-shadow: var(--shadow); z-index: 101;
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
        }
        .sod-idx-group-label:hover > .sod-idx-submenu { display: block; }
        .sod-idx-opt {
          padding: 5px 10px; font-size: 11px; cursor: pointer;
          display: flex; align-items: center; gap: 8px;
        }
        .sod-idx-opt:hover { background: var(--hover); }
        .sod-idx-opt input[type="checkbox"] {
          width: 14px; height: 14px; margin: 0; cursor: pointer;
          accent-color: ${COLORS.blue}; flex-shrink: 0;
        }
        .sod-idx-opt label { cursor: pointer; flex: 1; pointer-events: none; }
  
  
        /* Calendar module */
        .sod-cal-mini {
          display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; font-size: 11px;
          text-align: center; flex-shrink: 0; margin-bottom: 4px;
        }
        .sod-cal-mini-hdr { font-weight: 700; color: var(--text3); padding: 3px 0; font-size: 10px; }
        .sod-cal-mini-day {
          padding: 4px 0; cursor: pointer; border-radius: 6px; transition: all 0.1s;
          color: var(--text2); font-size: 11px;
        }
        .sod-cal-mini-day:hover:not(.off):not(.selected) { background: var(--hover); }
        .sod-cal-mini-day.today { font-weight: 700; color: ${COLORS.blue}; }
        .sod-cal-mini-day.selected { background: ${COLORS.blue}; color: #fff; }
        .sod-cal-mini-day.off { color: var(--text3); opacity: 0.25; cursor: default; pointer-events: none; }
        .sod-cal-month-nav {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 2px; flex-shrink: 0;
        }
        .sod-cal-month-nav span { font-size: 10px; font-weight: 700; }
        .sod-cal-month-btn {
          background: none; border: none; cursor: pointer; color: var(--text2);
          font-size: 14px; padding: 0 4px; line-height: 1;
        }
        .sod-cal-month-btn:hover { color: var(--text); }
        .sod-cal-events {
          flex: 1; overflow: auto; min-height: 0;
          scrollbar-width: none; -ms-overflow-style: none;
        }
        .sod-cal-events::-webkit-scrollbar { display: none; }
        .sod-cal-event {
          padding: 5px 7px; border-bottom: 1px solid var(--border); font-size: 11px;
        }
        .sod-cal-event:last-child { border-bottom: none; }
        .sod-cal-event-sym { font-weight: 700; color: ${COLORS.blue}; margin-right: 4px; }
        .sod-cal-event-time { color: var(--text3); font-size: 10px; }
        .sod-cal-event-detail { color: var(--text2); }
  
        /* News module */
        .sod-news-list { flex: 1; overflow-y: auto; min-height: 0; }
        .sod-news-item {
          padding: 7px 9px; border-bottom: 1px solid var(--border); cursor: pointer;
        }
        .sod-news-item:hover { background: var(--hover); }
        .sod-news-meta { display: flex; gap: 6px; align-items: center; margin-bottom: 3px; }
        .sod-news-source {
          font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 6px;
        }
        .sod-news-time { font-size: 10px; color: var(--text3); }
        .sod-news-headline { font-size: 12px; font-weight: 600; line-height: 1.35; margin-bottom: 2px; }
        .sod-news-teaser {
          font-size: 11px; color: var(--text2); line-height: 1.5;
          max-height: 0; overflow: hidden; transition: max-height 0.35s ease;
          white-space: pre-wrap; word-break: break-word;
        }
        .sod-news-item.expanded .sod-news-teaser { max-height: 3000px; padding-top: 4px; }
        .sod-news-full { font-size: 12px; color: var(--text1); line-height: 1.6; padding-top: 6px; }
        .sod-news-full p { margin: 6px 0; }
        .sod-news-item:not(.expanded) .sod-news-full { display: none !important; }
        .sod-news-item:not(.expanded) .sod-news-headline::after {
          content: ' ▸'; font-size: 9px; color: var(--text3);
        }
        .sod-news-item.expanded .sod-news-headline::after {
          content: ' ▾'; font-size: 9px; color: var(--text3);
        }
        .sod-news-item.expanded .sod-news-headline { color: ${COLORS.blue}; }
  
        /* Company Movers module */
        .sod-movers-wrap {
          flex: 1; overflow: auto; min-height: 0;
          scrollbar-width: none; -ms-overflow-style: none;
        }
        .sod-movers-wrap::-webkit-scrollbar { display: none; }
        .sod-movers-table {
          width: 100%; border-collapse: collapse; font-size: 11px;
        }
        .sod-movers-table thead { position: sticky; top: 0; z-index: 2; }
        .sod-movers-table th {
          padding: 5px 6px; text-align: left; font-weight: 700; font-size: 10px;
          color: var(--text3); text-transform: uppercase; letter-spacing: 0.3px;
          border-bottom: 1px solid var(--border); cursor: pointer; user-select: none;
          white-space: nowrap; background: var(--card-solid);
        }
        .sod-movers-table th:hover { color: var(--text); }
        .sod-movers-table td {
          padding: 3px 6px; border-bottom: 1px solid var(--border); white-space: nowrap;
        }
        .sod-movers-sym { font-weight: 700; color: ${COLORS.blue}; }
        .sod-clickable-sym { cursor: pointer; transition: opacity 0.15s; }
        .sod-clickable-sym:hover { opacity: 0.7; text-decoration: underline; }
        .sod-movers-table tr:hover td { background: var(--hover); }
  
        /* AI module */
        .sod-ai-status {
          padding: 8px 10px; border-radius: 10px; font-size: 12px;
          text-align: center; margin-bottom: 8px; flex-shrink: 0;
        }
        .sod-ai-status.ok { background: rgba(52,199,89,0.15); color: ${COLORS.green}; }
        .sod-ai-status.err { background: rgba(255,59,48,0.15); color: ${COLORS.red}; }
        .sod-ai-output {
          flex: 1; overflow-y: auto; min-height: 0; font-size: 13px;
          line-height: 1.65; color: var(--text); padding: 4px 0;
          word-break: break-word;
        }
        .sod-ai-top-row {
          display: flex; gap: 6px; margin-bottom: 6px;
          flex-shrink: 0; align-items: center; min-width: 0;
        }
        .sod-ai-top-row .sod-ai-status { flex: 1; min-width: 0; }
        .sod-ai-model-select {
          font-size: 12px; width: auto; min-width: 140px; max-width: 100%;
          flex: 0 1 155px; flex-shrink: 1; padding: 5px 22px 5px 8px;
        }
        .sod-ai-control-row {
          display: flex; gap: 4px; margin-bottom: 6px; flex-shrink: 0;
          align-items: center; flex-wrap: wrap; min-width: 0; padding-right: 2px;
        }
        .sod-ai-control-row .sod-m-btn { max-width: 100%; }
        .sod-ai-mode-tabs { display: flex; gap: 0; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); margin-bottom: 6px; }
        .sod-ai-mode-tab {
          flex: 1; padding: 5px 10px; font-size: 11px; font-weight: 600; text-align: center;
          cursor: pointer; background: var(--card-bg); color: var(--text3); border: none; transition: all 0.15s;
        }
        .sod-ai-mode-tab.active { background: ${COLORS.blue}; color: #fff; }
        .sod-ai-mode-tab:not(.active):hover { background: var(--hover); }
        .sod-ai-output p { margin: 3px 0; }
        .sod-ai-output ul { padding-left: 16px; margin: 3px 0; }
        .sod-ai-output strong { font-weight: 700; }
        .sod-ai-output em { font-style: italic; }
        .sod-ai-output code { background: var(--tag-bg); padding: 1px 4px; border-radius: 3px; font-size: 0.9em; }
  
        /* 52-week range bar */
        .sod-range-bar { position: relative; height: 4px; background: var(--border); border-radius: 2px; min-width: 50px; }
        .sod-range-dot {
          position: absolute; top: -2px; width: 8px; height: 8px; border-radius: 50%;
          background: ${COLORS.blue}; transform: translateX(-50%);
        }
  
        /* ═══════════════════════════════════════════
           STOCK MODULE STYLES
        ═══════════════════════════════════════════ */
  
        #schwab-opt-root .sod-stock-header {
          display: flex !important; flex-wrap: nowrap !important; align-items: center !important; gap: 6px !important;
          width: 100% !important; max-width: 100% !important; margin: 0 !important;
          padding: 6px 0 !important; border-bottom: 1px solid var(--border); flex-shrink: 0;
        }
        #schwab-opt-root .sod-stock-header > * { margin: 0 !important; align-self: center !important; flex: 0 0 auto; }
        #schwab-opt-root .sod-stock-search-wrap { position: relative; margin: 0 !important; }
        #schwab-opt-root .sod-stock-input {
          padding: 7px 12px; border-radius: 10px; border: 1px solid var(--border);
          background: var(--input-bg); color: var(--text); font-size: 13px;
          font-weight: 700; text-transform: uppercase; width: 120px;
          outline: none; transition: all 0.2s; min-width: 100px; margin: 0 !important;
        }
        #schwab-opt-root .sod-stock-input:focus { border-color: ${COLORS.blue}; box-shadow: 0 0 0 3px rgba(0,122,255,0.15); }
        #schwab-opt-root .sod-stock-input::placeholder { text-transform: none; font-weight: 400; }
        #schwab-opt-root .sod-stock-go-btn {
          padding: 7px 16px; border-radius: 10px; border: none;
          background: ${COLORS.green}; color: #fff;
          font-weight: 600; font-size: 12px; cursor: pointer; transition: all 0.15s;
          display: inline-flex; align-items: center; gap: 4px;
          margin: 0 !important;
        }
        #schwab-opt-root .sod-stock-go-btn:hover { filter: brightness(1.1); }
        #schwab-opt-root .sod-stock-dd {
          position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px;
          background: var(--card); border: 1px solid var(--border); border-radius: 12px;
          box-shadow: var(--shadow); z-index: 100; overflow: hidden;
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
        }
        #schwab-opt-root .sod-stock-dd-item {
          padding: 8px 14px; cursor: pointer; font-size: 12px;
          display: flex; justify-content: space-between; align-items: center;
        }
        #schwab-opt-root .sod-stock-dd-item:hover { background: var(--hover); }
        #schwab-opt-root .sod-stock-dd-sym { font-weight: 700; color: ${COLORS.blue}; }
        #schwab-opt-root .sod-stock-dd-name { color: var(--text2); font-size: 11px; text-align: right; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  
        /* Quote bar — single-row compact design like Options Dashboard stats bar */
        .sod-stock-quote-bar {
          display: flex; flex-wrap: nowrap; gap: 2px; padding: 4px 0;
          border-bottom: 1px solid var(--border); font-size: 11px; flex-shrink: 0;
          overflow-x: auto; align-items: center; scrollbar-width: none;
        }
        .sod-stock-quote-bar::-webkit-scrollbar { display: none; }
        .sod-stock-qb-empty {
          text-align: center; padding: 8px; color: var(--text3); font-size: 12px; width: 100%;
        }
        .sod-stock-qb-name-block {
          display: flex; flex-direction: column; padding: 2px 10px;
          white-space: nowrap; flex-shrink: 0;
        }
        .sod-stock-qb-company { font-size: 14px; font-weight: 800; color: var(--text); }
        .sod-stock-qb-symex { font-size: 11px; color: var(--text2); font-weight: 600; }
        .sod-stock-qb-symex b { color: var(--text); }
        .sod-stock-qb-badge {
          font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 4px;
          display: inline-block; line-height: 1.4;
        }
        .sod-stock-qb-sector { font-size: 10px; color: ${COLORS.teal}; font-weight: 600; white-space: nowrap; line-height: 1.2; }
        .sod-stock-qb-divider {
          width: 1px; height: 20px; background: var(--border); flex-shrink: 0; margin: 0 4px;
        }
        .sod-stock-qb-price-block {
          display: flex; flex-direction: column; align-items: center; padding: 2px 8px;
          white-space: nowrap; flex-shrink: 0;
        }
        .sod-stock-qb-price-row { display: flex; align-items: baseline; gap: 3px; }
        .sod-stock-qb-price { font-size: 16px; font-weight: 800; letter-spacing: -0.3px; }
        .sod-stock-qb-change { font-size: 12px; font-weight: 700; }
        .sod-stock-qb-session-label { font-size: 8px; color: var(--text3); font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
        .sod-stock-qb-sec-block {
          display: flex; flex-direction: column; align-items: center; padding: 2px 8px;
          white-space: nowrap; flex-shrink: 0;
        }
        .sod-stock-qb-price-sm { font-size: 12px; font-weight: 700; }
        .sod-stock-qb-field {
          display: flex; flex-direction: column; align-items: center; padding: 2px 8px;
          min-width: 55px;
        }
        .sod-stock-qb-field-label {
          font-size: 8px; color: var(--text3); font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.3px; white-space: nowrap;
        }
        .sod-stock-qb-field-value {
          font-size: 12px; font-weight: 700; margin-top: 1px; white-space: nowrap;
        }
        .sod-stock-qb-range-group {
          display: flex; align-items: center; gap: 3px; padding: 0 6px;
          white-space: nowrap; flex-shrink: 0;
        }
        .sod-stock-qb-range-label { font-size: 8px; color: var(--text3); font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
        .sod-stock-qb-range-val { font-weight: 700; color: var(--text2); font-size: 12px; }
        .sod-stock-range-bar {
          position: relative; height: 4px; width: 60px; border-radius: 2px;
          background: linear-gradient(90deg, ${COLORS.red}40, ${COLORS.green}40);
        }
        .sod-stock-range-fill {
          position: absolute; top: 0; left: 0; height: 100%; border-radius: 2px;
          background: linear-gradient(90deg, ${COLORS.red}, ${COLORS.orange}, ${COLORS.green});
        }
        .sod-stock-range-dot {
          position: absolute; top: -2px; width: 8px; height: 8px; border-radius: 50%;
          background: ${COLORS.blue}; transform: translateX(-50%);
        }
  
        /* Stock modules resizable layout — default 35/35/30 */
        .sod-stock-modules {
          flex: 1; min-height: 0; display: flex;
          gap: 0; padding: 8px 0; overflow: hidden;
        }
        .sod-stock-col {
          display: flex; flex-direction: column; min-width: 120px; min-height: 0;
        }
        .sod-stock-col > .sod-stock-card { flex: 1; min-height: 60px; }
        @media (max-width: 900px) {
          .sod-stock-modules { flex-direction: column; gap: 8px; overflow-y: auto; }
          .sod-stock-col { min-width: 0; flex: 0 0 auto !important; }
          .sod-stock-modules .sod-resize-h { display: none; }
        }
        @media (max-width: 760px) {
          .sod-ai-top-row { flex-wrap: wrap; }
          .sod-ai-model-select { flex: 1 1 180px; min-width: 0; }
        }
        .sod-stock-card {
          background: var(--card); border-radius: 14px; padding: 12px;
          box-shadow: var(--shadow); border: 1px solid var(--border);
          backdrop-filter: blur(12px); display: flex; flex-direction: column;
          min-height: 0; overflow: hidden;
        }
        .sod-stock-card-title {
          font-size: 15px; font-weight: 700; margin-bottom: 6px; flex-shrink: 0;
          display: flex; align-items: center; letter-spacing: -0.2px;
        }
        .sod-stock-card-title-chart { color: #FF6384; }
        .sod-stock-card-title-news { color: ${COLORS.orange}; }
        .sod-stock-card-title-ai { color: ${COLORS.purple}; }
  
        /* Stock chart module */
        .sod-stock-chart-controls {
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
          margin-bottom: 8px; flex-shrink: 0;
        }
        .sod-stock-period-tabs {
          display: flex; gap: 2px; flex-wrap: wrap;
        }
        .sod-stock-period-tab {
          padding: 4px 10px; border-radius: 8px; border: none;
          font-size: 11px; font-weight: 600; cursor: pointer;
          background: var(--tag-bg); color: var(--text2); transition: all 0.15s;
          white-space: nowrap;
        }
        .sod-stock-period-tab:hover { background: var(--hover); }
        .sod-stock-period-tab.active { background: ${COLORS.blue}; color: #fff; }
        .sod-stock-live-btn {
          padding: 4px 12px; border-radius: 8px; border: 2px solid transparent;
          font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.2s;
          background: var(--tag-bg); color: var(--text2);
          display: inline-flex; align-items: center; gap: 4px;
        }
        .sod-stock-live-btn.active {
          background: ${COLORS.red}18; color: ${COLORS.red}; border-color: ${COLORS.red};
        }
        .sod-stock-live-dot {
          width: 6px; height: 6px; border-radius: 50%; background: currentColor;
        }
        .sod-stock-live-btn.active .sod-stock-live-dot {
          animation: sod-live-pulse 1.2s infinite;
        }
        @keyframes sod-live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .sod-stock-chart-wrap {
          flex: 1; min-height: 0; position: relative;
        }
        .sod-stock-empty-card {
          display: flex; align-items: center; justify-content: center;
          color: var(--text3); font-size: 12px; flex: 1;
        }
  
        /* Stock News module */
        .sod-stock-news-tabs {
          display: flex; gap: 2px; flex-wrap: wrap; margin-bottom: 6px; flex-shrink: 0;
        }
        .sod-stock-news-tab {
          padding: 4px 10px; border-radius: 7px; border: none;
          font-size: 11px; font-weight: 600; cursor: pointer;
          transition: all 0.15s; white-space: nowrap;
        }
        .sod-stock-news-list {
          flex: 1; overflow-y: auto; min-height: 0; scrollbar-width: none;
        }
        .sod-stock-news-list::-webkit-scrollbar { display: none; }
        .sod-stock-news-item {
          padding: 6px 8px; border-bottom: 1px solid var(--border); cursor: default;
        }
        .sod-stock-news-item:hover { background: var(--hover); }
        .sod-stock-news-head {
          font-size: 13px; font-weight: 600; line-height: 1.4; color: var(--text);
        }
        .sod-stock-news-meta {
          display: flex; gap: 6px; align-items: center; margin-top: 2px;
        }
        .sod-stock-news-src {
          font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 4px;
        }
        .sod-stock-news-time { font-size: 9px; color: var(--text3); }
        .sod-stock-news-read { font-size: 9px; color: var(--text3); }
        .sod-stock-news-teaser {
          font-size: 10px; color: var(--text2); line-height: 1.4; margin-top: 3px;
          max-height: 0; overflow: hidden; transition: max-height 0.3s ease;
        }
        .sod-stock-news-item.expanded .sod-stock-news-teaser { max-height: 200px; }
        .sod-stock-news-item .sod-stock-news-head::after { content: ' ▸'; font-size: 8px; color: var(--text3); }
        .sod-stock-news-item.expanded .sod-stock-news-head::after { content: ' ▾'; }
        .sod-stock-news-full-btn {
          display: none; margin-top: 4px; padding: 3px 10px; font-size: 10px; font-weight: 600;
          border: 1px solid ${COLORS.blue}; border-radius: 6px; background: ${COLORS.blue}12;
          color: ${COLORS.blue}; cursor: pointer; transition: all 0.15s;
        }
        .sod-stock-news-full-btn:hover { background: ${COLORS.blue}; color: #fff; }
        .sod-stock-news-item.expanded .sod-stock-news-full-btn { display: inline-block; }
        .sod-stock-news-full-content {
          display: none; margin-top: 6px; font-size: 11px; line-height: 1.55; color: var(--text);
          border-left: 3px solid ${COLORS.blue}; padding: 6px 10px;
          max-height: 400px; overflow-y: auto;
        }
        .sod-stock-news-full-content a { color: ${COLORS.blue}; text-decoration: underline; }
        .sod-stock-news-full-content ul, .sod-stock-news-full-content ol { padding-left: 18px; margin: 4px 0; }
        .sod-stock-news-full-content li { margin-bottom: 3px; }
        .sod-stock-news-full-content p { margin: 4px 0; }
        .sod-stock-news-item.expanded .sod-stock-news-full-content.loaded { display: block; }
        .sod-stock-news-hot { color: ${COLORS.red}; font-size: 9px; font-weight: 700; }
        .sod-stock-news-ago {
          font-size: 9px; font-weight: 600; color: ${COLORS.red};
          background: ${COLORS.red}12; padding: 1px 5px; border-radius: 4px;
          white-space: nowrap;
        }
  
        /* ── Fundamentals Module ── */
        .sod-stock-chart-fund-split {
          display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden;
        }
        .sod-stock-chart-pane {
          display: flex; flex-direction: column; min-height: 80px; overflow: hidden;
        }
        .sod-stock-chart-pane > .sod-stock-card { flex: 1; min-height: 0; }
        .sod-stock-fund-pane {
          display: flex; flex-direction: column; min-height: 80px; overflow: hidden;
        }
        .sod-resize-v-fund {
          flex: 0 0 6px; cursor: row-resize; display: flex; align-items: center;
          justify-content: center; z-index: 5; user-select: none;
        }
        .sod-resize-v-fund::after {
          content: ''; height: 2px; width: 28px; border-radius: 1px;
          background: var(--border); transition: background 0.15s;
        }
        .sod-resize-v-fund:hover::after, .sod-resize-v-fund.active::after {
          background: ${COLORS.blue}; height: 3px;
        }
  
        .sod-fund-card {
          background: var(--card); border-radius: 14px; padding: 10px;
          box-shadow: var(--shadow); border: 1px solid var(--border);
          backdrop-filter: blur(12px); display: flex; flex-direction: column;
          min-height: 0; overflow: hidden; flex: 1;
        }
        .sod-fund-card-title {
          font-size: 14px; font-weight: 700; margin-bottom: 4px; flex-shrink: 0;
          display: flex; align-items: center; gap: 6px; letter-spacing: -0.2px;
          color: ${COLORS.indigo};
        }
        .sod-fund-tabs-wrap {
          flex-shrink: 0; overflow-x: auto; scrollbar-width: none;
          padding: 2px 0 6px; position: relative;
        }
        .sod-fund-tabs-wrap::-webkit-scrollbar { display: none; }
        .sod-fund-tabs {
          display: flex; gap: 4px; white-space: nowrap; padding: 0 2px;
        }
        .sod-fund-tab {
          padding: 5px 12px; border-radius: 10px; border: none;
          font-size: 11px; font-weight: 600; cursor: pointer;
          transition: all 0.2s ease; white-space: nowrap;
          display: inline-flex; align-items: center; gap: 4px;
          flex-shrink: 0;
        }
        .sod-fund-tab .material-icons { font-size: 14px; }
        .sod-fund-tab:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .sod-fund-tab.active { box-shadow: 0 2px 8px rgba(0,0,0,0.15); transform: translateY(-1px); }
  
        .sod-fund-content {
          flex: 1; overflow-y: auto; min-height: 0; padding: 4px 2px;
          scrollbar-width: thin; scrollbar-color: var(--border) transparent;
        }
        .sod-fund-content::-webkit-scrollbar { width: 4px; }
        .sod-fund-content::-webkit-scrollbar-track { background: transparent; }
        .sod-fund-content::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
  
        .sod-fund-loading {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          color: var(--text3); font-size: 12px; padding: 20px; flex: 1;
        }
        .sod-fund-loading .material-icons {
          animation: sod-spin 1s linear infinite; font-size: 18px;
        }
        @keyframes sod-spin { to { transform: rotate(360deg); } }
  
        .sod-fund-empty {
          display: flex; align-items: center; justify-content: center;
          color: var(--text3); font-size: 12px; flex: 1; padding: 20px; text-align: center;
        }
  
        /* Fundamentals — Metric Cards Grid */
        .sod-fund-metrics {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 6px; margin-bottom: 8px;
        }
        .sod-fund-metric {
          background: var(--input-bg); border-radius: 12px; padding: 10px;
          border: 1px solid var(--border); transition: transform 0.15s, box-shadow 0.15s;
        }
        .sod-fund-metric:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .sod-fund-metric-label {
          font-size: 9px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.4px; color: var(--text3); margin-bottom: 4px;
        }
        .sod-fund-metric-value {
          font-size: 16px; font-weight: 800; letter-spacing: -0.3px;
        }
        .sod-fund-metric-sub {
          font-size: 9px; color: var(--text3); margin-top: 2px;
        }
        /* Fundamentals metric cards: colorful gradient theme by default */
        .sod-fund-metrics > .sod-fund-metric:not(.sod-fund-fin-kpi):not(.sod-fund-ov-kpi) {
          position: relative; overflow: hidden;
          border-left: 3px solid var(--kpi-color, ${COLORS.blue});
          background: linear-gradient(145deg, var(--kpi-tint, ${COLORS.blue}12), var(--input-bg) 62%);
        }
        .sod-fund-metrics > .sod-fund-metric:not(.sod-fund-fin-kpi):not(.sod-fund-ov-kpi) .sod-fund-metric-label {
          color: var(--kpi-color, ${COLORS.blue});
        }
        .sod-fund-metrics > .sod-fund-metric:not(.sod-fund-fin-kpi):not(.sod-fund-ov-kpi):nth-child(6n + 1) {
          --kpi-color: ${COLORS.blue}; --kpi-tint: ${COLORS.blue}1a;
        }
        .sod-fund-metrics > .sod-fund-metric:not(.sod-fund-fin-kpi):not(.sod-fund-ov-kpi):nth-child(6n + 2) {
          --kpi-color: ${COLORS.purple}; --kpi-tint: ${COLORS.purple}1a;
        }
        .sod-fund-metrics > .sod-fund-metric:not(.sod-fund-fin-kpi):not(.sod-fund-ov-kpi):nth-child(6n + 3) {
          --kpi-color: ${COLORS.teal}; --kpi-tint: ${COLORS.teal}1a;
        }
        .sod-fund-metrics > .sod-fund-metric:not(.sod-fund-fin-kpi):not(.sod-fund-ov-kpi):nth-child(6n + 4) {
          --kpi-color: ${COLORS.orange}; --kpi-tint: ${COLORS.orange}1a;
        }
        .sod-fund-metrics > .sod-fund-metric:not(.sod-fund-fin-kpi):not(.sod-fund-ov-kpi):nth-child(6n + 5) {
          --kpi-color: ${COLORS.pink}; --kpi-tint: ${COLORS.pink}1a;
        }
        .sod-fund-metrics > .sod-fund-metric:not(.sod-fund-fin-kpi):not(.sod-fund-ov-kpi):nth-child(6n + 6) {
          --kpi-color: ${COLORS.indigo}; --kpi-tint: ${COLORS.indigo}1a;
        }
  
        /* Fundamentals — Section Headers */
        .sod-fund-section {
          margin-bottom: 10px;
        }
        .sod-fund-section-title {
          font-size: 13px; font-weight: 700; margin-bottom: 6px;
          display: flex; align-items: center; gap: 6px;
          padding-bottom: 4px; border-bottom: 2px solid var(--border);
        }
        .sod-fund-section-title .material-icons { font-size: 16px; }
  
        /* Fundamentals — Tables */
        .sod-fund-table-wrap { overflow-x: auto; margin-bottom: 8px; }
        .sod-fund-table {
          width: 100%; border-collapse: collapse; font-size: 11px;
        }
        .sod-fund-table th {
          font-size: 9px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.3px; color: var(--text3); padding: 6px 8px;
          border-bottom: 2px solid var(--border); text-align: right;
          white-space: nowrap; position: sticky; top: 0; background: var(--card);
        }
        .sod-fund-table th:first-child { text-align: left; }
        .sod-fund-table td {
          padding: 5px 8px; border-bottom: 1px solid var(--border);
          text-align: right; white-space: nowrap;
        }
        .sod-fund-table td:first-child {
          text-align: left; font-weight: 600; color: var(--text);
        }
        .sod-fund-table tr:hover { background: var(--hover); }
        .sod-fund-table .positive { color: ${COLORS.green}; }
        .sod-fund-table .negative { color: ${COLORS.red}; }
  
        /* Fundamentals — Sub-tabs (Annual/Quarterly) */
        .sod-fund-subtabs {
          display: flex; gap: 3px; margin-bottom: 6px;
        }
        .sod-fund-subtab {
          padding: 3px 10px; border-radius: 7px; border: none;
          font-size: 10px; font-weight: 600; cursor: pointer;
          background: var(--tag-bg); color: var(--text2); transition: all 0.15s;
        }
        .sod-fund-subtab.active { background: ${COLORS.blue}; color: #fff; }
  
        /* Fundamentals — Financials (Colorful, aligned with Overview) */
        .sod-fund-fin-toolbar {
          display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px;
          padding: 6px; border-radius: 10px; border: 1px solid var(--border);
          background: linear-gradient(135deg, ${COLORS.blue}12, ${COLORS.purple}0 40%, ${COLORS.teal}12);
        }
        .sod-fund-fin-toolbar .sod-fund-subtabs { margin-bottom: 0; }
        .sod-fund-fin-toolbar .sod-fund-fin-subtabs-left {
          margin-right: auto; justify-content: flex-start;
        }
        .sod-fund-fin-toolbar .sod-fund-fin-subtabs-right {
          margin-left: auto; justify-content: flex-end;
        }
        .sod-fund-fin-toolbar .sod-fund-subtab {
          border: 1px solid transparent;
        }
        .sod-fund-fin-toolbar .sod-fund-subtab.active {
          box-shadow: 0 4px 10px rgba(0,0,0,0.12);
          transform: translateY(-1px);
        }
        @media (max-width: 760px) {
          .sod-fund-fin-toolbar .sod-fund-fin-subtabs-left,
          .sod-fund-fin-toolbar .sod-fund-fin-subtabs-right {
            margin-left: 0; margin-right: 0;
          }
        }
        .sod-fund-fin-toolbar .sod-fund-subtab[data-subtab-group="period"][data-subtab-val="quarterly"].active {
          background: ${COLORS.blue}; color: #fff;
        }
        .sod-fund-fin-toolbar .sod-fund-subtab[data-subtab-group="period"][data-subtab-val="annual"].active {
          background: ${COLORS.orange}; color: #fff;
        }
        .sod-fund-fin-toolbar .sod-fund-subtab[data-subtab-group="type"][data-subtab-val="income"].active {
          background: ${COLORS.blue}; color: #fff;
        }
        .sod-fund-fin-toolbar .sod-fund-subtab[data-subtab-group="type"][data-subtab-val="balance"].active {
          background: ${COLORS.purple}; color: #fff;
        }
        .sod-fund-fin-toolbar .sod-fund-subtab[data-subtab-group="type"][data-subtab-val="cash"].active {
          background: ${COLORS.teal}; color: #fff;
        }
  
        .sod-fund-fin-summary { margin-bottom: 0; }
        .sod-fund-fin-kpi {
          position: relative; overflow: hidden;
          border-left: 3px solid var(--kpi-color, ${COLORS.blue});
          background: linear-gradient(145deg, var(--kpi-tint, ${COLORS.blue}12), var(--input-bg) 62%);
        }
        .sod-fund-fin-kpi .sod-fund-metric-label { color: var(--text3); }
        .sod-fund-fin-kpi .sod-fund-metric-value {
          color: var(--kpi-color, ${COLORS.blue});
        }
        .sod-fund-fin-kpi .sod-fund-metric-sub {
          font-weight: 700;
        }
  
        .sod-fund-fin-table th {
          background: linear-gradient(180deg, var(--card), var(--input-bg));
        }
        .sod-fund-fin-table th:first-child {
          color: ${COLORS.indigo};
        }
        .sod-fund-fin-row-summary {
          background: linear-gradient(90deg, ${COLORS.indigo}0d, transparent);
        }
        .sod-fund-fin-cell-metric {
          font-weight: 600;
        }
        .sod-fund-fin-trend {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: 0.6px; color: var(--text2);
        }
  
        /* Fundamentals — Overview KPI Cards (sync with Financials gradient style) */
        .sod-fund-ov-kpi {
          position: relative; overflow: hidden;
          border-left: 3px solid var(--ov-color, ${COLORS.blue});
          background: linear-gradient(145deg, var(--ov-tint, ${COLORS.blue}12), var(--input-bg) 62%);
        }
        .sod-fund-ov-kpi .sod-fund-metric-value {
          color: var(--ov-color, ${COLORS.blue});
        }
        .sod-fund-ov-kpi .sod-fund-metric-sub {
          font-weight: 600;
        }
  
        /* Fundamentals — Ratings Bar */
        .sod-fund-rating-bar {
          display: flex; height: 22px; border-radius: 6px; overflow: hidden;
          margin: 8px 0;
        }
        .sod-fund-rating-seg {
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700; color: #fff;
          transition: flex 0.3s ease;
        }
        .sod-fund-rating-legend {
          display: flex; gap: 12px; flex-wrap: wrap; margin-top: 4px;
        }
        .sod-fund-rating-legend-item {
          display: flex; align-items: center; gap: 4px; font-size: 10px;
        }
        .sod-fund-rating-dot {
          width: 8px; height: 8px; border-radius: 50%;
        }
  
        /* Fundamentals — Profile Card */
        .sod-fund-profile-header {
          display: flex; align-items: center; gap: 12px; margin-bottom: 10px;
          padding: 10px; background: var(--input-bg); border-radius: 12px;
          border: 1px solid var(--border);
        }
        .sod-fund-profile-logo {
          width: 48px; height: 48px; border-radius: 12px;
          background: linear-gradient(135deg, ${COLORS.blue}30, ${COLORS.purple}30);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; font-weight: 800; color: ${COLORS.blue};
        }
        .sod-fund-profile-info { flex: 1; }
        .sod-fund-profile-name { font-size: 16px; font-weight: 800; }
        .sod-fund-profile-meta {
          font-size: 10px; color: var(--text2); margin-top: 2px;
          display: flex; gap: 8px; flex-wrap: wrap;
        }
        .sod-fund-profile-tag {
          font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 5px;
          display: inline-block;
        }
        .sod-fund-profile-desc {
          font-size: 11px; line-height: 1.6; color: var(--text2);
          max-height: 120px; overflow-y: auto; padding: 8px;
          background: var(--input-bg); border-radius: 10px;
          border: 1px solid var(--border); margin-top: 8px;
        }
  
        /* Fundamentals — Competitor Row */
        .sod-fund-comp-row {
          display: flex; flex-direction: column; gap: 8px;
          overflow: visible; padding-bottom: 2px;
        }
        .sod-fund-comp-card {
          flex: 0 0 auto; width: 100%;
          background: var(--input-bg); border-radius: 10px;
          padding: 10px; border: 1px solid var(--border);
          display: flex; flex-direction: column; gap: 4px;
          border-left: 3px solid var(--comp-color, ${COLORS.blue});
          background: linear-gradient(145deg, var(--comp-tint, ${COLORS.blue}12), var(--input-bg) 62%);
          cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
        }
        .sod-fund-comp-card:hover {
          transform: scale(1.008); box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }
        .sod-fund-comp-card:nth-child(6n + 1) { --comp-color: ${COLORS.blue}; --comp-tint: ${COLORS.blue}1a; }
        .sod-fund-comp-card:nth-child(6n + 2) { --comp-color: ${COLORS.purple}; --comp-tint: ${COLORS.purple}1a; }
        .sod-fund-comp-card:nth-child(6n + 3) { --comp-color: ${COLORS.teal}; --comp-tint: ${COLORS.teal}1a; }
        .sod-fund-comp-card:nth-child(6n + 4) { --comp-color: ${COLORS.orange}; --comp-tint: ${COLORS.orange}1a; }
        .sod-fund-comp-card:nth-child(6n + 5) { --comp-color: ${COLORS.pink}; --comp-tint: ${COLORS.pink}1a; }
        .sod-fund-comp-card:nth-child(6n + 6) { --comp-color: ${COLORS.indigo}; --comp-tint: ${COLORS.indigo}1a; }
        .sod-fund-comp-sym {
          font-size: 13px; font-weight: 800; color: var(--comp-color, ${COLORS.blue});
        }
        .sod-fund-comp-name {
          font-size: 9px; color: var(--text3); white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
        }
        .sod-fund-comp-stat {
          display: flex; justify-content: space-between; font-size: 10px;
        }
        .sod-fund-comp-stat-label { color: var(--text3); }
        .sod-fund-comp-stat-value { font-weight: 700; }
  
        /* Fundamentals — Events List */
        .sod-fund-event-item {
          display: flex; gap: 10px; align-items: flex-start; padding: 8px 0;
          border-bottom: 1px solid var(--border);
        }
        .sod-fund-event-date {
          flex: 0 0 50px; text-align: center; padding: 4px 6px;
          background: var(--input-bg); border-radius: 8px;
          border: 1px solid var(--border);
        }
        .sod-fund-event-month { font-size: 8px; font-weight: 700; text-transform: uppercase; color: var(--text3); }
        .sod-fund-event-day { font-size: 18px; font-weight: 800; line-height: 1.2; }
        .sod-fund-event-info { flex: 1; }
        .sod-fund-event-title { font-size: 12px; font-weight: 600; }
        .sod-fund-event-desc { font-size: 10px; color: var(--text3); margin-top: 2px; }
  
        /* Fundamentals — Ownership Holders */
        .sod-fund-holder {
          display: flex; align-items: center; gap: 8px; padding: 6px 0;
          border-bottom: 1px solid var(--border);
        }
        .sod-fund-holder-rank {
          flex: 0 0 24px; height: 24px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 800; color: #fff;
        }
        .sod-fund-holder-name { flex: 1; font-size: 11px; font-weight: 600; }
        .sod-fund-holder-pct {
          font-size: 12px; font-weight: 800; white-space: nowrap;
        }
        .sod-fund-holder-shares { font-size: 9px; color: var(--text3); white-space: nowrap; }
  
        /* Fundamentals — ESG Gauge */
        .sod-fund-esg-gauges {
          display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;
          margin: 10px 0;
        }
        .sod-fund-esg-gauge {
          text-align: center; flex: 0 0 80px;
        }
        .sod-fund-esg-circle {
          width: 64px; height: 64px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 4px; font-size: 18px; font-weight: 800; color: #fff;
          position: relative;
        }
        .sod-fund-esg-label {
          font-size: 9px; font-weight: 600; color: var(--text3);
          text-transform: uppercase;
        }
  
        /* Fundamentals — Social Sentiment */
        .sod-ss-module { display: flex; flex-direction: column; gap: 10px; }
        .sod-ss-head { display: flex; flex-direction: column; gap: 2px; }
        .sod-ss-title {
          font-size: 24px; font-weight: 800; letter-spacing: -0.4px;
          color: var(--text);
        }
        .sod-ss-tm { font-size: 11px; font-weight: 700; vertical-align: top; margin-left: 2px; color: var(--text3); }
        .sod-ss-asof { font-size: 12px; color: var(--text3); }
  
        .sod-ss-grid {
          display: grid; grid-template-columns: 1.1fr 0.8fr 1.1fr; gap: 8px;
        }
        .sod-ss-card {
          border-radius: 14px; border: 1px solid var(--border); padding: 12px;
          background: linear-gradient(145deg, rgba(0,122,255,0.08), var(--input-bg) 58%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.16);
          overflow: hidden;
        }
        .sod-ss-card-mid { background: linear-gradient(145deg, rgba(90,200,250,0.12), var(--input-bg) 58%); }
        .sod-ss-card-right { background: linear-gradient(145deg, rgba(88,86,214,0.12), var(--input-bg) 58%); display: flex; flex-direction: column; }
        .sod-ss-divider { height: 1px; background: var(--border); margin: 12px 0; }
  
        .sod-ss-gauge-block { position: relative; }
        .sod-ss-gauge-title { font-size: 14px; font-weight: 700; color: var(--text); }
        .sod-ss-gauge-sub { font-size: 11px; color: var(--text3); margin-top: 2px; }
        .sod-ss-gauge-track {
          margin-top: 46px; height: 12px; border-radius: 999px; position: relative;
          background: linear-gradient(90deg, rgba(255,59,48,0.16), rgba(255,204,0,0.14), rgba(52,199,89,0.16));
        }
        .sod-ss-gauge-dot {
          position: absolute; top: 50%; transform: translate(-50%, -50%);
          width: 16px; height: 16px; border-radius: 50%;
          border: 2px solid ${COLORS.blue}; background: #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.16);
        }
        .sod-ss-gauge-bubble {
          position: absolute; top: -38px; transform: translateX(-50%);
          background: #fff; border-radius: 10px; padding: 4px 10px;
          font-size: 11px; font-weight: 800; color: ${COLORS.blue};
          box-shadow: 0 6px 14px rgba(0,0,0,0.16); white-space: nowrap;
        }
        .sod-ss-gauge-bubble::after {
          content: ''; position: absolute; left: 50%; transform: translateX(-50%);
          bottom: -6px; width: 0; height: 0;
          border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid #fff;
        }
        .sod-ss-gauge-range {
          display: flex; justify-content: space-between; margin-top: 8px;
          font-size: 11px; color: var(--text2); font-weight: 600;
        }
        .sod-ss-gauge-main { margin-top: 10px; display: flex; align-items: baseline; gap: 6px; }
        .sod-ss-val { font-size: 31px; font-weight: 800; letter-spacing: -0.5px; color: var(--text); }
        .sod-ss-chg { font-size: 17px; font-weight: 700; }
        .sod-ss-gauge-ind { margin-top: 2px; font-size: 11px; color: var(--text3); }
  
        .sod-ss-mid-val {
          margin-top: 14px; font-size: 34px; font-weight: 800; letter-spacing: -0.6px;
          color: var(--text);
        }
        .sod-ss-mid-val span { font-size: 19px; margin-left: 3px; }
        .sod-ss-split { min-height: 120px; }
  
        .sod-ss-buzz-top {
          margin-top: 8px; font-size: 44px; font-weight: 800; line-height: 1;
          color: ${COLORS.blue};
        }
        .sod-ss-buzz-row { margin-top: 8px; display: flex; justify-content: flex-end; align-items: stretch; flex: 1; min-height: 80px; }
        .sod-ss-buzz-text { flex: 1; min-width: 0; }
        .sod-ss-buzz-text p {
          margin: 0 0 10px; font-size: 11px; line-height: 1.6; color: var(--text2);
        }
        .sod-ss-buzz-text p:last-child { margin-bottom: 0; }
        .sod-ss-buzz-meter-wrap { display: flex; gap: 8px; align-items: stretch; flex-shrink: 0; }
        .sod-ss-buzz-meter {
          width: 44px; height: 100%; min-height: 80px; border-radius: 8px; position: relative; overflow: hidden;
          background: repeating-linear-gradient(
            to top,
            rgba(120,120,128,0.16) 0 1px,
            rgba(120,120,128,0.06) 1px 17px
          );
        }
        .sod-ss-buzz-fill {
          position: absolute; left: 0; bottom: 0; width: 100%;
          background: linear-gradient(180deg, #66C1FF, #007AFF);
        }
        .sod-ss-buzz-avg {
          position: absolute; left: 0; right: 0; bottom: 50%;
          border-top: 1px dashed rgba(255,255,255,0.9);
        }
        .sod-ss-buzz-axis {
          display: flex; flex-direction: column; justify-content: space-between;
          font-size: 10px; color: var(--text3); padding: 2px 0;
        }
        .sod-ss-buzz-axis span { white-space: nowrap; }
        .sod-ss-buzz-details {
          margin-top: 10px; border-top: 1px solid var(--border); padding-top: 8px;
        }
        .sod-ss-buzz-summary {
          list-style: none; cursor: pointer; user-select: none;
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 700; color: var(--text2);
        }
        .sod-ss-buzz-summary::-webkit-details-marker { display: none; }
        .sod-ss-buzz-summary::before {
          content: '▸'; font-size: 10px; transition: transform 0.16s ease;
        }
        .sod-ss-buzz-details[open] .sod-ss-buzz-summary::before { transform: rotate(90deg); }
        .sod-ss-buzz-details .sod-ss-buzz-text { margin-top: 8px; }
  
        .sod-ss-trend-card {
          border-radius: 14px; border: 1px solid var(--border); padding: 12px;
          background: linear-gradient(145deg, rgba(175,82,222,0.09), var(--input-bg) 62%);
        }
        .sod-ss-trend-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
        .sod-ss-trend-title { font-size: 16px; font-weight: 800; color: var(--text); }
        .sod-ss-period-tabs { display: inline-flex; gap: 3px; flex-wrap: wrap; }
        .sod-ss-period-tab {
          border: none; border-radius: 8px; padding: 4px 10px; cursor: pointer;
          font-size: 11px; font-weight: 700; color: var(--text2);
          background: var(--tag-bg); transition: all 0.15s;
        }
        .sod-ss-period-tab:hover { background: var(--hover); }
        .sod-ss-period-tab.active {
          background: linear-gradient(135deg, ${COLORS.blue}, ${COLORS.purple});
          color: #fff; box-shadow: 0 4px 12px rgba(0,122,255,0.25);
        }
        .sod-ss-chart-main { position: relative; height: 260px; }
        .sod-ss-chart-vol { margin-top: 8px; height: 116px; }
        .sod-ss-chart-main canvas, .sod-ss-chart-vol canvas {
          width: 100% !important; height: 100% !important;
        }
        .sod-ss-polarity {
          position: absolute; right: 8px; top: 8px;
          display: flex; flex-direction: column; gap: 4px; pointer-events: none;
        }
        .sod-ss-polarity span {
          font-size: 10px; font-weight: 700; color: var(--text3);
          background: rgba(255,255,255,0.72); border: 1px solid var(--border);
          border-radius: 7px; padding: 2px 7px;
        }
  
        @media (max-width: 1180px) {
          .sod-ss-grid { grid-template-columns: 1fr; }
          .sod-ss-buzz-row { flex-direction: column; }
          .sod-ss-buzz-meter-wrap { align-self: flex-start; }
          .sod-ss-trend-top { flex-direction: column; align-items: flex-start; }
        }
  
        /* Fundamentals — Dividend Chart */
        .sod-fund-div-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: 5px 0; border-bottom: 1px solid var(--border);
          font-size: 11px;
        }
        .sod-fund-div-date { color: var(--text2); font-weight: 600; }
        .sod-fund-div-amount { font-weight: 800; color: ${COLORS.green}; }
        .sod-fund-div-type {
          font-size: 9px; padding: 1px 6px; border-radius: 4px;
          font-weight: 600;
        }
  
        /* Fundamentals — Forecast */
        .sod-fund-forecast-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 8px;
        }
        .sod-fund-forecast-card {
          background: var(--input-bg); border-radius: 10px; padding: 10px;
          border: 1px solid var(--border); text-align: center;
          border-left: 3px solid var(--fc-color, ${COLORS.blue});
          background: linear-gradient(145deg, var(--fc-tint, ${COLORS.blue}12), var(--input-bg) 62%);
        }
        .sod-fund-forecast-card:nth-child(6n + 1) { --fc-color: ${COLORS.blue}; --fc-tint: ${COLORS.blue}1a; }
        .sod-fund-forecast-card:nth-child(6n + 2) { --fc-color: ${COLORS.purple}; --fc-tint: ${COLORS.purple}1a; }
        .sod-fund-forecast-card:nth-child(6n + 3) { --fc-color: ${COLORS.teal}; --fc-tint: ${COLORS.teal}1a; }
        .sod-fund-forecast-card:nth-child(6n + 4) { --fc-color: ${COLORS.orange}; --fc-tint: ${COLORS.orange}1a; }
        .sod-fund-forecast-card:nth-child(6n + 5) { --fc-color: ${COLORS.pink}; --fc-tint: ${COLORS.pink}1a; }
        .sod-fund-forecast-card:nth-child(6n + 6) { --fc-color: ${COLORS.indigo}; --fc-tint: ${COLORS.indigo}1a; }
        .sod-fund-forecast-period {
          font-size: 10px; font-weight: 700; color: var(--text3);
          text-transform: uppercase; margin-bottom: 4px;
        }
        .sod-fund-forecast-value {
          font-size: 18px; font-weight: 800;
        }
        .sod-fund-forecast-label {
          font-size: 9px; color: var(--text3); margin-top: 2px;
        }
  
        /* Fundamentals — Connections / Investment Themes */
        .sod-fund-theme-tabs-wrap {
          overflow-x: auto; padding-bottom: 4px; margin-bottom: 8px;
          scrollbar-width: none;
        }
        .sod-fund-theme-tabs-wrap::-webkit-scrollbar { display: none; }
        .sod-fund-theme-tabs {
          display: flex; gap: 4px; white-space: nowrap;
        }
        .sod-fund-theme-tab {
          border: none; border-radius: 10px; cursor: pointer;
          padding: 5px 12px; font-size: 11px; font-weight: 700;
          display: inline-flex; align-items: center; gap: 5px;
          transition: all 0.16s ease;
        }
        .sod-fund-theme-tab .material-icons { font-size: 14px; }
        .sod-fund-theme-tab:hover { filter: brightness(1.08); transform: translateY(-1px); }
        .sod-fund-theme-tab.active { box-shadow: 0 3px 10px rgba(0,0,0,0.14); transform: translateY(-1px); }
  
        .sod-fund-theme-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 8px;
        }
        .sod-fund-theme-title {
          font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;
        }
        .sod-fund-theme-count {
          font-size: 10px; color: var(--text3); font-weight: 600;
        }
        .sod-fund-theme-list {
          display: flex; flex-direction: column; gap: 7px;
        }
        .sod-fund-theme-item {
          border-radius: 12px; border: 1px solid var(--border); padding: 10px;
          background: linear-gradient(145deg, var(--theme-tint, rgba(0,122,255,0.12)), var(--input-bg) 64%);
          border-left: 3px solid var(--theme-color, ${COLORS.blue});
        }
        .sod-fund-theme-item-head {
          display: flex; align-items: center; gap: 6px; margin-bottom: 5px; flex-wrap: wrap;
        }
        .sod-fund-theme-rank {
          font-size: 10px; font-weight: 800; color: #fff;
          background: var(--theme-color, ${COLORS.blue}); border-radius: 6px;
          padding: 1px 6px; line-height: 1.5;
        }
        .sod-fund-theme-name {
          font-size: 12px; font-weight: 700; color: var(--theme-color, ${COLORS.blue});
        }
        .sod-fund-theme-id {
          margin-left: auto; font-size: 9px; font-weight: 700; color: var(--text2);
          background: var(--tag-bg); border-radius: 5px; padding: 1px 6px;
        }
        .sod-fund-theme-id-btn {
          border: none; cursor: pointer; line-height: 1.4;
        }
        .sod-fund-theme-desc {
          font-size: 10px; color: var(--text2); line-height: 1.6; white-space: normal;
        }
      `;
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    }
  
    /* ── Toast notification helper ── */
  
    let _toastContainer = null;
  
    function showToast(message, level = 'info', durationMs = 6000) {
      if (!_toastContainer) {
        _toastContainer = document.createElement('div');
        _toastContainer.className = 'sod-toast-container';
        document.body.appendChild(_toastContainer);
      }
      const icons = { info: 'info', warn: 'warning', error: 'error' };
      const el = document.createElement('div');
      el.className = `sod-toast sod-toast-${level}`;
      el.innerHTML = `<span class="material-icons">${icons[level] || 'info'}</span><span>${message}</span>`;
      el.addEventListener('click', () => dismissToast(el));
      _toastContainer.appendChild(el);
      if (durationMs > 0) setTimeout(() => dismissToast(el), durationMs);
      console.log(TAG, `[${level.toUpperCase()}]`, message);
    }
  
    function dismissToast(el) {
      if (!el.parentNode) return;
      el.classList.add('sod-toast-out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }
  
    /* ───────────────────────────────────────────
       §7  UI MODULE
    ─────────────────────────────────────────── */
  
    function createRoot() {
      if (_root) return _root;
  
      _root = document.createElement('div');
      _root.id = 'schwab-opt-root';
      document.body.appendChild(_root);
      applyTheme();
  
      _root.innerHTML = `
        <div class="sod-tabs">
          <button class="sod-tab active" data-tab="market">${t('tab.market')}</button>
          <button class="sod-tab" data-tab="stock">${t('tab.stock')}</button>
          <button class="sod-tab" data-tab="dashboard">${t('tab.dashboard')}</button>
          <button class="sod-tab" data-tab="settings">${t('tab.settings')}</button>
        </div>
        <button class="sod-close" title="Close" style="width:36px!important;height:36px!important;min-width:36px!important;min-height:36px!important;max-width:36px!important;max-height:36px!important;padding:0!important;border-radius:50%!important;"><span class="material-icons" style="font-size:20px">close</span></button>
        <div class="sod-inner">
          <div class="sod-page active" id="sod-page-market">
            <div class="sod-market-ticker" id="sod-market-ticker">
              <div class="sod-stat"><span class="sod-stat-label">DATE</span><span class="sod-stat-value blue" id="sod-ticker-date">—</span></div>
              <div class="sod-stat"><span class="sod-stat-label">DJIA</span><span class="sod-stat-value" id="sod-tk-dji-p">—</span></div>
              <div class="sod-stat"><span class="sod-stat-label">DJIA CHG</span><span class="sod-stat-value" id="sod-tk-dji-c">—</span></div>
              <div class="sod-stat"><span class="sod-stat-label">NASDAQ</span><span class="sod-stat-value" id="sod-tk-compx-p">—</span></div>
              <div class="sod-stat"><span class="sod-stat-label">NASDAQ CHG</span><span class="sod-stat-value" id="sod-tk-compx-c">—</span></div>
              <div class="sod-stat"><span class="sod-stat-label">S&P 500</span><span class="sod-stat-value" id="sod-tk-spx-p">—</span></div>
              <div class="sod-stat"><span class="sod-stat-label">S&P CHG</span><span class="sod-stat-value" id="sod-tk-spx-c">—</span></div>
              <div class="sod-stat"><span class="sod-stat-label">RUSSELL 2000</span><span class="sod-stat-value" id="sod-tk-rut-p">—</span></div>
              <div class="sod-stat"><span class="sod-stat-label">RUSSELL CHG</span><span class="sod-stat-value" id="sod-tk-rut-c">—</span></div>
            </div>
            <div class="sod-market-layout" id="sod-market-layout">
              <div class="sod-market-col" style="flex:34" data-col="0">
                <div class="sod-card" id="sod-market-indices" style="flex:9"></div>
                <div class="sod-resize-v" data-rv="0"></div>
                <div class="sod-card" id="sod-market-news" style="flex:11"></div>
              </div>
              <div class="sod-resize-h" data-rh="0"></div>
              <div class="sod-market-col" style="flex:38" data-col="1">
                <div class="sod-card" id="sod-market-calendar" style="flex:3"></div>
                <div class="sod-resize-v" data-rv="1"></div>
                <div class="sod-card" id="sod-market-movers" style="flex:2"></div>
              </div>
              <div class="sod-resize-h" data-rh="1"></div>
              <div class="sod-market-col" style="flex:28" data-col="2">
                <div class="sod-card" id="sod-market-ai"></div>
              </div>
            </div>
          </div>
          <div class="sod-page" id="sod-page-dashboard">
            <div class="sod-controls" id="sod-controls"></div>
            <div class="sod-stats" id="sod-stats"></div>
            <div class="sod-grid" id="sod-grid"></div>
          </div>
          <div class="sod-page" id="sod-page-stock">
            <div class="sod-stock-header" id="sod-stock-header"></div>
            <div class="sod-stock-quote-bar" id="sod-stock-quote-bar"></div>
            <div class="sod-stock-modules" id="sod-stock-modules"></div>
          </div>
          <div class="sod-page" id="sod-page-settings"></div>
        </div>
      `;
  
      _root.querySelector('.sod-close').addEventListener('click', () => {
        _root.style.display = 'none';
        _root.style.flexDirection = '';
      });
  
      _root.querySelector('.sod-tabs').addEventListener('click', (e) => {
        const tab = e.target.closest('.sod-tab');
        if (!tab || !tab.dataset.tab) return;
        _root.querySelectorAll('.sod-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        _root.querySelectorAll('.sod-page').forEach(p => p.classList.remove('active'));
        const page = _root.querySelector(`#sod-page-${tab.dataset.tab}`);
        if (page) page.classList.add('active');
        _state.activeTab = tab.dataset.tab;
        if (tab.dataset.tab === 'settings') renderSettings();
        if (tab.dataset.tab === 'stock') initStockModule();
        if (tab.dataset.tab === 'market') {
          if (_aiState.generating) renderAIModule();
          if (_indicesState.mode === 'region' && _state.marketIndicesData) {
            drawIndicesChart(_state.marketIndicesData);
          } else if (_indicesState.mode === 'individual' && _indicesState.selectedSymbols.length) {
            loadIndicesIndividual();
          }
        }
      });
  
      renderControls();
      renderSettings();
      initMarketModules();
      return _root;
    }
  
    function renderControls() {
      const el = _root.querySelector('#sod-controls');
      el.innerHTML = `
        <div class="sod-search-wrap">
          <input class="sod-input" id="sod-sym-input" placeholder="${t('ctrl.symbol')}" value="${_state.symbol}" autocomplete="off" style="width:100px;text-transform:uppercase;font-weight:700"/>
          <div class="sod-search-dropdown" id="sod-search-dd" style="display:none"></div>
        </div>
        <button class="sod-btn sod-btn-primary" id="sod-load-btn">
          <span class="material-icons" style="font-size:15px">download</span> ${t('ctrl.load')}
        </button>
        <button class="sod-btn sod-btn-secondary" id="sod-refresh-btn">
          <span class="material-icons" style="font-size:15px">refresh</span> ${t('ctrl.refresh')}
        </button>
        <span class="sod-label">${t('ctrl.expiration')}</span>
        <select class="sod-select" id="sod-exp-select" style="min-width:180px">
          <option>—</option>
        </select>
        <span class="sod-label">${t('ctrl.strikes')}</span>
        <select class="sod-select" id="sod-strikes-select">
          ${[20, 30, 40, 50, 60, 80, 100].map(n => `<option value="${n}" ${n === _state.strikesCount ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      `;
  
      let searchTimeout;
      const symInput = el.querySelector('#sod-sym-input');
      const searchDD = el.querySelector('#sod-search-dd');
  
      symInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const q = symInput.value.trim();
        if (q.length < 1) { searchDD.style.display = 'none'; return; }
        searchTimeout = setTimeout(async () => {
          try {
            const results = await searchSymbol(q);
            if (!results.length) { searchDD.style.display = 'none'; return; }
            searchDD.innerHTML = results.filter(r => r.optionable).map(r => `
              <div class="sod-search-item" data-sym="${r.symbol}">
                <span class="sod-search-item-sym">${r.symbol}</span>
                <span class="sod-search-item-name">${r.name}</span>
              </div>
            `).join('');
            searchDD.style.display = 'block';
            searchDD.querySelectorAll('.sod-search-item').forEach(item => {
              item.addEventListener('click', () => {
                symInput.value = item.dataset.sym;
                searchDD.style.display = 'none';
                _state.symbol = item.dataset.sym;
              });
            });
          } catch (e) { console.warn(TAG, 'Search error:', e); }
        }, 300);
      });
  
      symInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          searchDD.style.display = 'none';
          _state.symbol = symInput.value.trim().toUpperCase();
          doLoad();
        }
      });
  
      document.addEventListener('click', e => {
        if (!searchDD.contains(e.target) && e.target !== symInput) searchDD.style.display = 'none';
      });
  
      el.querySelector('#sod-load-btn').addEventListener('click', doLoad);
      el.querySelector('#sod-refresh-btn').addEventListener('click', () => doLoad(true));
  
      el.querySelector('#sod-exp-select').addEventListener('change', e => {
        _state.selectedExpIdx = parseInt(e.target.value) || 0;
        loadChainForExpiration();
      });
  
      el.querySelector('#sod-strikes-select').addEventListener('change', e => {
        _state.strikesCount = parseInt(e.target.value);
        if (_state.computed) renderDashboardContent();
      });
  
    }
  
    function renderStats() {
      const el = _root.querySelector('#sod-stats');
      const c = _state.computed;
      if (!c) { el.innerHTML = ''; return; }
  
      const items = [
        { label: t('stat.spot'), value: `$${c.spot.toFixed(2)}`, cls: 'blue' },
        { label: t('stat.forward'), value: `$${c.forwardPrice.toFixed(2)}`, cls: '' },
        { label: t('stat.dte'), value: `${c.dte}d`, cls: '' },
        { label: t('stat.stmIv'), value: `${c.stmIV.toFixed(1)}%`, cls: 'purple' },
        { label: t('stat.dnsSm'), value: `${c.dnsSM.toFixed(2)}%`, cls: '' },
        { label: t('stat.impliedMove'), value: `±${c.impliedMovePct.toFixed(2)}% ($${c.impliedMoveAbs.toFixed(2)})`, cls: 'orange' },
        { label: t('stat.pcOi'), value: c.pcOIRatio.toFixed(2), cls: c.pcOIRatio < 1 ? 'green' : 'red' },
        { label: t('stat.callOi'), value: fmtNum(c.totalCallOI), cls: 'green' },
        { label: t('stat.putOi'), value: fmtNum(c.totalPutOI), cls: 'red' },
        { label: t('stat.callVol'), value: fmtNum(c.totalCallVol), cls: 'green' },
        { label: t('stat.putVol'), value: fmtNum(c.totalPutVol), cls: 'red' },
        { label: t('stat.netGex'), value: fmtNum(c.netGEX, true), cls: c.netGEX >= 0 ? 'green' : 'red' },
        { label: t('stat.timestamp'), value: c.timestamp, cls: '' },
      ];
  
      el.innerHTML = items.map(i => `
        <div class="sod-stat">
          <span class="sod-stat-label">${i.label}</span>
          <span class="sod-stat-value ${i.cls}">${i.value}</span>
        </div>
      `).join('');
    }
  
    function renderDashboardContent() {
      const c = _state.computed;
      if (!c) {
        _root.querySelector('#sod-grid').innerHTML = `<div class="sod-empty">${t('dash.empty')}</div>`;
        return;
      }
      renderStats();
  
      const strikesCount = _state.strikesCount;
      const filtered = filterStrikes(c.strikes, c.spot, strikesCount);
      const allStrikes = c.strikes;
      const viewMin = filtered[0];
      const viewMax = filtered[filtered.length - 1];
  
      const grid = _root.querySelector('#sod-grid');
      grid.innerHTML = `
        <div class="sod-card" id="sod-panel-insights"></div>
        <div class="sod-card" id="sod-panel-keylevels"></div>
        <div class="sod-card" id="sod-panel-cumgex"></div>
        <div class="sod-card" id="sod-panel-dealergex"></div>
        <div class="sod-card" id="sod-panel-greeks"></div>
        <div class="sod-card" id="sod-panel-volume"></div>
      `;
  
      renderInsightsPanel(c);
      renderKeyLevelsPanel(c, allStrikes, viewMin, viewMax);
      renderCumGexPanel(c, allStrikes, viewMin, viewMax);
      renderDealerGexPanel(c, allStrikes, viewMin, viewMax);
      renderGreeksPanel(c, allStrikes, viewMin, viewMax);
      renderVolumePanel(c, allStrikes, viewMin, viewMax);
    }
  
    function filterStrikes(strikes, spot, count) {
      const half = Math.floor(count / 2);
      const atmIdx = strikes.reduce((best, s, i) => Math.abs(s - spot) < Math.abs(strikes[best] - spot) ? i : best, 0);
      const start = Math.max(0, atmIdx - half);
      const end = Math.min(strikes.length, start + count);
      return strikes.slice(start, end);
    }
  
    /* ─── Panel: Insights ─── */
  
    function renderInsightsPanel(c) {
      const panel = _root.querySelector('#sod-panel-insights');
      const score = c.bullishScore;
      const sentiment = score >= 60 ? t('insights.bullish') : score <= 40 ? t('insights.bearish') : t('insights.neutral');
  
      panel.innerHTML = `
        <div class="sod-card-title">${t('insights.title')}</div>
        <div class="sod-card-subtitle">${t('insights.subtitle')}</div>
        <div class="sod-insights-label" style="color:${score >= 60 ? COLORS.green : score <= 40 ? COLORS.red : COLORS.yellow}">${sentiment}</div>
        <div class="sod-insights-meter">
          <div class="sod-insights-dot" style="left:${score}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);margin-bottom:12px">
          <span>${t('insights.bearish')}</span><span>${t('insights.neutral')}</span><span>${t('insights.bullish')}</span>
        </div>
        <div class="sod-insights-label">${t('insights.keyLevels')}</div>
        ${c.insights.map(ins => `
          <div class="sod-insight-item" style="border-left-color:${ins.color}">
            <div class="sod-insight-type" style="background:${ins.color}">${ins.type}</div>
            <div class="sod-insight-title">${ins.title}</div>
            <div class="sod-insight-text">${ins.text}</div>
          </div>
        `).join('')}
      `;
    }
  
    /* ─── Panel: Key Levels ─── */
  
    function renderKeyLevelsPanel(c, allStrikes, viewMin, viewMax) {
      const panel = _root.querySelector('#sod-panel-keylevels');
      panel.innerHTML = `
        <div class="sod-card-title">${t('keylevels.title')}</div>
        <div class="sod-card-subtitle">${t('keylevels.subtitle')}</div>
        <div class="sod-key-levels-row">
          <div class="sod-key-card" style="background:${COLORS.red}">
            <div class="sod-key-card-label">${t('keylevels.putWall')}</div>
            <div class="sod-key-card-value">$${c.putWall}</div>
            <div class="sod-key-card-sub">OI: ${fmtNum(c.putMap[c.putWall]?.oi || 0)}</div>
          </div>
          <div class="sod-key-card" style="background:${COLORS.green}">
            <div class="sod-key-card-label">${t('keylevels.callWall')}</div>
            <div class="sod-key-card-value">$${c.callWall}</div>
            <div class="sod-key-card-sub">OI: ${fmtNum(c.callMap[c.callWall]?.oi || 0)}</div>
          </div>
          <div class="sod-key-card" style="background:${COLORS.orange}">
            <div class="sod-key-card-label">${t('keylevels.maxPain')}</div>
            <div class="sod-key-card-value">$${c.maxPainStrike}</div>
            <div class="sod-key-card-sub">${t('keylevels.expiryMagnet')}</div>
          </div>
          <div class="sod-key-card" style="background:${COLORS.purple}">
            <div class="sod-key-card-label">${t('keylevels.gammaFlip')}</div>
            <div class="sod-key-card-value">$${c.gammaFlip || '—'}</div>
            <div class="sod-key-card-sub">${c.gammaFlip ? (c.spot > c.gammaFlip ? 'Positive δ' : 'Negative δ') : '—'}</div>
          </div>
        </div>
        <div class="sod-price-row">
          <div><div class="sod-price-label">${t('stat.spot')}</div><div class="sod-price-value" style="color:${COLORS.blue}">$${c.spot.toFixed(2)}</div></div>
          <div><div class="sod-price-label">${t('stat.forward')}</div><div class="sod-price-value">$${c.forwardPrice.toFixed(2)}</div></div>
          <div><div class="sod-price-label">${t('keylevels.minIvPrice')}</div><div class="sod-price-value">$${c.minIVStrike}</div></div>
        </div>
        <div class="sod-chart-wrap"><canvas id="sod-chart-keylevels"></canvas></div>
      `;
      drawKeyLevelsChart(c, allStrikes, viewMin, viewMax);
    }
  
    /* ─── Panel: Cumulative GEX ─── */
  
    function renderCumGexPanel(c, allStrikes, viewMin, viewMax) {
      const panel = _root.querySelector('#sod-panel-cumgex');
      panel.innerHTML = `
        <div class="sod-card-title">${t('cumgex.title')}</div>
        <div class="sod-card-subtitle">${t('cumgex.subtitle')}</div>
        <div style="display:flex;gap:12px;font-size:11px;margin-bottom:8px">
          <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${COLORS.green};margin-right:4px"></span>${t('cumgex.callGex')}</span>
          <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${COLORS.red};margin-right:4px"></span>${t('cumgex.putGex')}</span>
        </div>
        <div class="sod-chart-wrap"><canvas id="sod-chart-cumgex"></canvas></div>
      `;
      drawCumGexChart(c, allStrikes, viewMin, viewMax);
    }
  
    /* ─── Panel: Dealer GEX ─── */
  
    function renderDealerGexPanel(c, allStrikes, viewMin, viewMax) {
      const panel = _root.querySelector('#sod-panel-dealergex');
      panel.innerHTML = `
        <div class="sod-card-title">${t('dealergex.title')}</div>
        <div class="sod-card-subtitle">▲ Positive: ${fmtNum(Math.max(0, c.netGEX))} | Put Wall OI: $${c.putWall} | Call Wall OI: $${c.callWall}</div>
        <div style="display:flex;gap:12px;font-size:11px;margin-bottom:8px">
          <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${COLORS.green};margin-right:4px"></span>${t('dealergex.positiveGex')}</span>
          <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${COLORS.red};margin-right:4px"></span>${t('dealergex.negativeGex')}</span>
        </div>
        <div class="sod-chart-wrap"><canvas id="sod-chart-dealergex"></canvas></div>
      `;
      drawDealerGexChart(c, allStrikes, viewMin, viewMax);
    }
  
    /* ─── Panel: Greeks Exposure ─── */
  
    function renderGreeksPanel(c, allStrikes, viewMin, viewMax) {
      const panel = _root.querySelector('#sod-panel-greeks');
      const greeksList = ['Gamma', 'Vanna', 'Charm', 'Delta', 'Theta', 'Vega'];
      panel.innerHTML = `
        <div class="sod-card-title">${t('greeks.title')}</div>
        <div class="sod-card-subtitle">${t('greeks.subtitle')}</div>
        <div class="sod-greek-tabs">
          ${greeksList.map(g => `<button class="sod-greek-tab ${g === _state.greeksExposureTab ? 'active' : ''}" data-greek="${g}">${g}</button>`).join('')}
        </div>
        <div style="display:flex;gap:12px;font-size:11px;margin-bottom:8px">
          <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${COLORS.green};margin-right:4px"></span>${t('greeks.positive')}</span>
          <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${COLORS.red};margin-right:4px"></span>${t('greeks.negative')}</span>
          <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${COLORS.yellow};margin-right:4px"></span>${t('greeks.net')}</span>
        </div>
        <div class="sod-chart-wrap"><canvas id="sod-chart-greeks"></canvas></div>
      `;
  
      panel.querySelectorAll('.sod-greek-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          panel.querySelectorAll('.sod-greek-tab').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          _state.greeksExposureTab = btn.dataset.greek;
          drawGreeksChart(c, allStrikes, viewMin, viewMax);
        });
      });
  
      drawGreeksChart(c, allStrikes, viewMin, viewMax);
    }
  
    /* ─── Panel: Volume Profile ─── */
  
    function renderVolumePanel(c, allStrikes, viewMin, viewMax) {
      const panel = _root.querySelector('#sod-panel-volume');
      const hasVolume = c.totalCallVol + c.totalPutVol > 0;
      const subtitle = hasVolume ? t('volume.subtitle') : t('volume.subtitleOI');
      const callLabel = hasVolume ? t('volume.callVol') : t('volume.callOI');
      const putLabel = hasVolume ? t('volume.putVol') : t('volume.putOI');
      panel.innerHTML = `
        <div class="sod-card-title">${t('volume.title')}</div>
        <div class="sod-card-subtitle">${subtitle}</div>
        <div style="display:flex;gap:12px;font-size:11px;margin-bottom:8px">
          <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${COLORS.green};margin-right:4px"></span>${callLabel}</span>
          <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${COLORS.red};margin-right:4px"></span>${putLabel}</span>
        </div>
        <div class="sod-chart-wrap"><canvas id="sod-chart-volume"></canvas></div>
      `;
      drawVolumeChart(c, allStrikes, viewMin, viewMax, hasVolume);
    }
  
    function _rebuildUI() {
      if (!_root) return;
      _root.querySelectorAll('.sod-tab').forEach(tab => {
        const key = tab.dataset.tab;
        if (key === 'market') tab.textContent = t('tab.market');
        else if (key === 'dashboard') tab.textContent = t('tab.dashboard');
        else if (key === 'stock') tab.textContent = t('tab.stock');
        else if (key === 'settings') tab.textContent = t('tab.settings');
      });
      if (_state.computed) {
        _state.computed.insights = generateInsights(
          _state.computed.spot, _state.computed.forwardPrice,
          _state.computed.putWall, _state.computed.callWall,
          _state.computed.maxPainStrike, _state.computed.pcOIRatio,
          _state.computed.gammaEnv, _state.computed.impliedMovePct,
          _state.computed.impliedMoveAbs, _state.computed.dte
        );
      }
      renderControls();
      if (_state.computed) renderDashboardContent();
      renderSettings();
      renderIndicesModule();
      renderCalendarModule();
      renderNewsModule();
      renderMoversModule();
      renderAIModule();
      if (_stockState.symbol) initStockModule();
    }
  
    /* ─── Settings Page ─── */
  
    async function renderSettings() {
      const page = _root.querySelector('#sod-page-settings');
      const currentTheme = getSavedTheme();
      const cacheItems = await cacheList();
      const allKeys = Object.values(cacheItems).flat();
      const totalSize = allKeys.reduce((s, i) => s + i.size, 0);
      const totalCount = allKeys.length;
      const symbolCount = Object.keys(cacheItems).length;
  
      const currentLang = getSavedLang();
      page.innerHTML = `
        <div class="sod-settings">
          <div class="sod-settings-title"><span class="material-icons" style="font-size:24px;vertical-align:-4px;margin-right:6px;color:${COLORS.gray}">settings</span>${t('settings.title')}</div>
          <div class="sod-settings-columns">
          <div class="sod-settings-col-left">
          <div class="sod-settings-section">
            <div class="sod-settings-heading">
              <span class="material-icons" style="font-size:20px;color:${COLORS.orange}">palette</span> <span style="color:${COLORS.orange}">${t('settings.theme')}</span>
            </div>
            <div class="sod-theme-options">
              ${[
                { mode: 'light', icon: 'light_mode', labelKey: 'settings.light' },
                { mode: 'dark', icon: 'dark_mode', labelKey: 'settings.dark' },
                { mode: 'system', icon: 'settings_suggest', labelKey: 'settings.system' },
              ].map(th => `
                <button class="sod-theme-btn ${currentTheme === th.mode ? 'active' : ''}" data-mode="${th.mode}">
                  <span class="material-icons" style="font-size:16px">${th.icon}</span> ${t(th.labelKey)}
                </button>
              `).join('')}
            </div>
          </div>
          <div class="sod-settings-section">
            <div class="sod-settings-heading">
              <span class="material-icons" style="font-size:20px;color:${COLORS.green}">language</span> <span style="color:${COLORS.green}">${t('settings.language')}</span>
            </div>
            <div class="sod-theme-options">
              <button class="sod-theme-btn ${currentLang === 'en' ? 'active' : ''}" data-lang="en">
                <span class="material-icons" style="font-size:16px">translate</span> ${t('settings.english')}
              </button>
              <button class="sod-theme-btn ${currentLang === 'zh' ? 'active' : ''}" data-lang="zh">
                <span class="material-icons" style="font-size:16px">translate</span> ${t('settings.chinese')}
              </button>
            </div>
          </div>
          <div class="sod-settings-section">
            <div class="sod-settings-heading">
              <span class="material-icons" style="font-size:20px;color:${COLORS.purple}">vpn_key</span> <span style="color:${COLORS.purple}">${t('settings.apiKeys')}</span>
            </div>
            <div style="margin-bottom:8px">
              <div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px">${t('settings.openaiApiKey')}</div>
              <div style="display:flex;gap:6px;align-items:center">
                <input class="sod-m-input sod-secret-input" id="sod-settings-ai-key" type="text" placeholder="${t('settings.openaiApiKeyPlaceholder')}" value="${_aiState.apiKey}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" data-form-type="other" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" style="flex:1;font-size:11px;padding:6px 10px"/>
              </div>
            </div>
            <div style="margin-bottom:8px">
              <div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px">${t('settings.geminiApiKey')}</div>
              <div style="display:flex;gap:6px;align-items:center">
                <input class="sod-m-input sod-secret-input" id="sod-settings-gemini-key" type="text" placeholder="${t('settings.geminiApiKeyPlaceholder')}" value="${_aiState.geminiApiKey}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" data-form-type="other" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" style="flex:1;font-size:11px;padding:6px 10px"/>
              </div>
            </div>
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px">
              <button class="sod-btn sod-btn-blue sod-btn-sm" id="sod-settings-ai-save">
                <span class="material-icons" style="font-size:13px">save</span> ${t('settings.save')}
              </button>
            </div>
            <div style="font-size:10px;color:var(--text3)">${t('settings.apiKeyNote')}</div>
          </div>
          <div class="sod-settings-section">
            <div class="sod-settings-heading">
              <span class="material-icons" style="font-size:20px;color:${COLORS.indigo}">info</span> <span style="color:${COLORS.indigo}">${t('settings.version')}</span>
            </div>
            <div style="display:inline-block;font-size:12px;font-weight:700;color:#fff;background:${COLORS.indigo};padding:3px 10px;border-radius:8px;margin-bottom:10px">${t('settings.currentVersion')}: v0.5</div>
            <div style="font-size:11px;color:var(--text2);line-height:1.7">
              <div style="display:flex;gap:8px;align-items:baseline;margin-bottom:6px"><span style="font-weight:700;color:#fff;background:${COLORS.purple};padding:1px 7px;border-radius:6px;font-size:10px;flex-shrink:0">v0.5</span> <span>${t('version.v05.desc')}</span></div>
              <div style="display:flex;gap:8px;align-items:baseline;margin-bottom:6px"><span style="font-weight:700;color:#fff;background:${COLORS.teal};padding:1px 7px;border-radius:6px;font-size:10px;flex-shrink:0">v0.4</span> <span>${t('version.v04.desc')}</span></div>
              <div style="display:flex;gap:8px;align-items:baseline;margin-bottom:6px"><span style="font-weight:700;color:#fff;background:${COLORS.orange};padding:1px 7px;border-radius:6px;font-size:10px;flex-shrink:0">v0.3</span> <span>${t('version.v03.desc')}</span></div>
              <div style="display:flex;gap:8px;align-items:baseline;margin-bottom:6px"><span style="font-weight:700;color:#fff;background:${COLORS.green};padding:1px 7px;border-radius:6px;font-size:10px;flex-shrink:0">v0.2</span> <span>${t('version.v02.desc')}</span></div>
              <div style="display:flex;gap:8px;align-items:baseline"><span style="font-weight:700;color:#fff;background:${COLORS.blue};padding:1px 7px;border-radius:6px;font-size:10px;flex-shrink:0">v0.1</span> <span>${t('version.v01.desc')}</span></div>
            </div>
          </div>
          </div>
          <div class="sod-settings-col-right">
          <div class="sod-settings-section">
            <div class="sod-settings-heading">
              <span class="material-icons" style="font-size:20px;color:${COLORS.teal}">storage</span> <span style="color:${COLORS.teal}">${t('settings.cache')}</span>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
              <button class="sod-btn sod-btn-blue sod-btn-sm" id="sod-refresh-all-cache">
                <span class="material-icons" style="font-size:13px">refresh</span> ${t('settings.refreshAll')}
              </button>
              <button class="sod-btn sod-btn-red sod-btn-sm" id="sod-clear-all-cache">
                <span class="material-icons" style="font-size:13px">delete</span> ${t('settings.clearAll')}
              </button>
              <button class="sod-btn sod-btn-secondary sod-btn-sm" id="sod-export-all" style="border:1px solid var(--border)">
                <span class="material-icons" style="font-size:13px">file_download</span> ${t('settings.exportAll')}
              </button>
              <button class="sod-btn sod-btn-secondary sod-btn-sm" id="sod-import-cache" style="border:1px solid var(--border)">
                <span class="material-icons" style="font-size:13px">file_upload</span> ${t('settings.import')}
              </button>
            </div>
            <div class="sod-cache-summary">${t('settings.cacheSummary', totalCount, symbolCount, (totalSize / 1024).toFixed(0))}</div>
            <div id="sod-cache-tree">
              ${Object.keys(cacheItems).length === 0 ? `<div style="color:var(--text3);font-size:12px;padding:12px">${t('settings.noCache')}</div>` : ''}
              ${Object.entries(cacheItems).map(([sym, entries]) => {
                const symSize = entries.reduce((s, e) => s + e.size, 0);
                return `
                  <div class="sod-cache-group" data-symbol="${sym}">
                    <div class="sod-cache-group-header">
                      <span class="sod-cache-arrow material-icons" style="font-size:16px">chevron_right</span>
                      <span style="flex:1"><span style="color:${COLORS.blue};font-weight:700">■</span> ${sym} <span style="color:var(--text3);font-weight:400">${entries.length} exp · ${(symSize / 1024).toFixed(0)} KB</span></span>
                      <div class="sod-cache-actions" style="display:flex;gap:4px">
                        <button class="sod-btn sod-btn-secondary sod-btn-sm sod-cache-export-sym" data-symbol="${sym}" title="Export ${sym}">
                          <span class="material-icons" style="font-size:12px">file_download</span>
                        </button>
                        <button class="sod-btn sod-btn-secondary sod-btn-sm sod-cache-refresh-sym" data-symbol="${sym}" title="Refresh all">
                          <span class="material-icons" style="font-size:12px">refresh</span>
                        </button>
                        <button class="sod-btn sod-btn-red sod-btn-sm sod-cache-del-sym" data-symbol="${sym}" title="Delete all">
                          <span class="material-icons" style="font-size:12px">delete</span>
                        </button>
                      </div>
                    </div>
                    <div class="sod-cache-items">
                      ${entries.map(e => `
                        <div class="sod-cache-item">
                          <span style="font-weight:600">${e.dateStr}</span>
                          <span class="sod-cache-item-info">${(e.size / 1024).toFixed(0)} KB · ${e.timestamp ? new Date(e.timestamp).toLocaleString() : '—'}</span>
                          <div class="sod-cache-actions">
                            <button class="sod-btn sod-btn-secondary sod-btn-sm sod-cache-load-item" data-key="${e.key}" data-sym="${sym}" data-date="${e.dateStr}" title="Load to dashboard">
                              <span class="material-icons" style="font-size:12px">open_in_new</span>
                            </button>
                            <button class="sod-btn sod-btn-red sod-btn-sm sod-cache-del-item" data-key="${e.key}" title="Delete">
                              <span class="material-icons" style="font-size:12px">delete</span>
                            </button>
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
            <div style="font-size:10px;color:var(--text3);margin-top:8px">${t('settings.cacheNote')}</div>
          </div>
          </div>
          </div>
        </div>
      `;
  
      page.querySelectorAll('.sod-theme-btn[data-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
          page.querySelectorAll('.sod-theme-btn[data-mode]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          saveTheme(btn.dataset.mode);
          applyTheme();
        });
      });
  
      page.querySelectorAll('.sod-theme-btn[data-lang]').forEach(btn => {
        btn.addEventListener('click', () => {
          page.querySelectorAll('.sod-theme-btn[data-lang]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          saveLang(btn.dataset.lang);
          _rebuildUI();
        });
      });
  
      page.querySelectorAll('.sod-cache-group-header').forEach(hdr => {
        hdr.addEventListener('click', e => {
          if (e.target.closest('.sod-cache-actions')) return;
          const group = hdr.closest('.sod-cache-group');
          const items = group.querySelector('.sod-cache-items');
          const arrow = hdr.querySelector('.sod-cache-arrow');
          items.classList.toggle('open');
          arrow.classList.toggle('open');
        });
      });
  
      page.querySelector('#sod-settings-ai-save')?.addEventListener('click', () => {
        _aiState.apiKey = page.querySelector('#sod-settings-ai-key')?.value?.trim() || '';
        _aiState.geminiApiKey = page.querySelector('#sod-settings-gemini-key')?.value?.trim() || '';
        _saveAISettings();
        showToast((_aiState.apiKey || _aiState.geminiApiKey) ? t('toast.apiKeySaved') : t('toast.apiKeyCleared'), 'info');
        if (_state.activeTab === 'market') renderAIModule();
      });
  
      page.querySelector('#sod-clear-all-cache')?.addEventListener('click', async () => {
        await cacheClearAll();
        renderSettings();
      });
  
      page.querySelector('#sod-refresh-all-cache')?.addEventListener('click', async () => {
        const items = await cacheList();
        for (const [sym, entries] of Object.entries(items)) {
          for (const e of entries) {
            try {
              const data = await getOptionChains(sym, e.dateStr);
              await cacheSet(sym, e.dateStr, data);
            } catch (err) { console.warn(TAG, 'Refresh failed:', sym, e.dateStr, err); }
          }
        }
        renderSettings();
      });
  
      page.querySelector('#sod-export-all')?.addEventListener('click', () => cacheExport());
      page.querySelector('#sod-import-cache')?.addEventListener('click', async () => {
        const count = await cacheImport();
        if (count > 0) renderSettings();
      });
  
      page.querySelectorAll('.sod-cache-del-sym').forEach(btn => {
        btn.addEventListener('click', async e => {
          e.stopPropagation();
          await cacheDeleteSymbol(btn.dataset.symbol);
          renderSettings();
        });
      });
  
      page.querySelectorAll('.sod-cache-export-sym').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          cacheExport(btn.dataset.symbol);
        });
      });
  
      page.querySelectorAll('.sod-cache-del-item').forEach(btn => {
        btn.addEventListener('click', async e => {
          e.stopPropagation();
          await cacheDelete(btn.dataset.key);
          renderSettings();
        });
      });
  
      page.querySelectorAll('.sod-cache-refresh-sym').forEach(btn => {
        btn.addEventListener('click', async e => {
          e.stopPropagation();
          const sym = btn.dataset.symbol;
          const items = (await cacheList())[sym] || [];
          for (const item of items) {
            try {
              const data = await getOptionChains(sym, item.dateStr);
              await cacheSet(sym, item.dateStr, data);
            } catch (err) { console.warn(TAG, 'Refresh failed:', err); }
          }
          renderSettings();
        });
      });
  
      page.querySelectorAll('.sod-cache-load-item').forEach(btn => {
        btn.addEventListener('click', async e => {
          e.stopPropagation();
          const cached = await cacheGet(btn.dataset.sym, btn.dataset.date);
          if (cached?.data) {
            _state.symbol = btn.dataset.sym;
            _state.chainData = cached.data;
            const symInput = _root.querySelector('#sod-sym-input');
            if (symInput) symInput.value = btn.dataset.sym;
            const quote = await getQuote(btn.dataset.sym);
            _state.quoteData = quote;
            _state.computed = computeAll(cached.data, quote);
            _root.querySelectorAll('.sod-tab').forEach(t => t.classList.remove('active'));
            _root.querySelector('.sod-tab[data-tab="dashboard"]').classList.add('active');
            _root.querySelectorAll('.sod-page').forEach(p => p.classList.remove('active'));
            _root.querySelector('#sod-page-dashboard').classList.add('active');
            renderDashboardContent();
          }
        });
      });
    }
  
    /* ───────────────────────────────────────────
       §8  CHART MODULE (Chart.js)
    ─────────────────────────────────────────── */
  
    function destroyChart(id) {
      if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
    }
  
    const crosshairPlugin = {
      id: 'crosshair',
      afterEvent(chart, args) {
        const { event } = args;
        if (event.type === 'mousemove' && chart.chartArea) {
          chart._crosshairX = event.x >= chart.chartArea.left && event.x <= chart.chartArea.right ? event.x : null;
        } else if (event.type === 'mouseout') {
          chart._crosshairX = null;
        }
        chart.draw();
      },
      afterDraw(chart) {
        if (!chart._crosshairX) return;
        const { ctx, chartArea: { top, bottom } } = chart;
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(136,136,136,0.5)';
        ctx.lineWidth = 1;
        ctx.moveTo(chart._crosshairX, top);
        ctx.lineTo(chart._crosshairX, bottom);
        ctx.stroke();
        ctx.restore();
      },
    };
  
    function chartDefaults(viewMin, viewMax) {
      const xScale = {
        ticks: { font: { size: 9 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 20, color: '#888' },
        grid: { display: false },
      };
      if (viewMin != null) xScale.min = String(viewMin);
      if (viewMax != null) xScale.max = String(viewMax);
  
      return {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true, mode: 'index', intersect: false, position: 'nearest',
            backgroundColor: 'rgba(0,0,0,0.85)', titleFont: { size: 11, weight: '600' },
            bodyFont: { size: 11 }, cornerRadius: 8, padding: 10,
            caretPadding: 6, caretSize: 6,
            displayColors: true, boxWidth: 8, boxHeight: 8, boxPadding: 4,
            callbacks: {
              title: items => items.length ? `Strike $${items[0].label}` : '',
              label: ctx => ` ${ctx.dataset.label}: ${fmtNum(ctx.parsed.y)}`,
            },
          },
          zoom: {
            pan: { enabled: true, mode: 'x', threshold: 5 },
            limits: { x: { minRange: 8 } },
          },
        },
        scales: {
          x: xScale,
          y: {
            ticks: { font: { size: 10 }, color: '#888', callback: v => fmtNum(v, true) },
            grid: { color: 'rgba(128,128,128,0.1)' },
          },
        },
        onHover(event, elements, chart) {
          chart.canvas.style.cursor = event.native?.type === 'mousemove' && elements.length ? 'pointer' : 'grab';
        },
      };
    }
  
    function spotAnnotationPlugin(spot, labels) {
      const spotIdx = labels.indexOf(spot) !== -1 ? labels.indexOf(spot) : labels.reduce((b, l, i) => Math.abs(l - spot) < Math.abs(labels[b] - spot) ? i : b, 0);
      return {
        id: 'spotLine',
        afterDraw(chart) {
          const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
          const xPos = x.getPixelForValue(spotIdx);
          ctx.save();
          ctx.beginPath();
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = '#888';
          ctx.lineWidth = 1;
          ctx.moveTo(xPos, top);
          ctx.lineTo(xPos, bottom);
          ctx.stroke();
          ctx.fillStyle = '#888';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Spot', xPos, bottom + 14);
          ctx.restore();
        },
      };
    }
  
    function drawKeyLevelsChart(c, allStrikes, viewMin, viewMax) {
      destroyChart('keylevels');
      const ctx = _root.querySelector('#sod-chart-keylevels')?.getContext('2d');
      if (!ctx) return;
  
      const callOI = allStrikes.map(s => c.callMap[s]?.oi || 0);
      const putOI = allStrikes.map(s => (c.putMap[s]?.oi || 0) * -1);
      const defaults = chartDefaults(viewMin, viewMax);
  
      _charts.keylevels = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: allStrikes.map(String),
          datasets: [
            { label: 'Call OI', data: callOI, backgroundColor: COLORS.posGex, borderRadius: 3 },
            { label: 'Put OI', data: putOI, backgroundColor: COLORS.negGex, borderRadius: 3 },
          ],
        },
        options: {
          ...defaults,
          plugins: { ...defaults.plugins, tooltip: { ...defaults.plugins.tooltip, callbacks: {
            title: items => items.length ? `Strike $${items[0].label}` : '',
            label: ctx => ` ${ctx.dataset.label}: ${fmtNum(Math.abs(ctx.raw))}`,
          } } },
          scales: {
            ...defaults.scales,
            x: { ...defaults.scales.x, stacked: true },
            y: { ...defaults.scales.y, stacked: true, ticks: { ...defaults.scales.y.ticks, callback: v => fmtNum(Math.abs(v), true) } },
          },
        },
        plugins: [spotAnnotationPlugin(c.spot, allStrikes), crosshairPlugin],
      });
    }
  
    function drawCumGexChart(c, allStrikes, viewMin, viewMax) {
      destroyChart('cumgex');
      const ctx = _root.querySelector('#sod-chart-cumgex')?.getContext('2d');
      if (!ctx) return;
  
      const cumCall = allStrikes.map(s => c.cumCallGexByStrike[s] || 0);
      const cumPut = allStrikes.map(s => c.cumPutGexByStrike[s] || 0);
  
      _charts.cumgex = new Chart(ctx, {
        type: 'line',
        data: {
          labels: allStrikes.map(String),
          datasets: [
            { label: 'Cum. Call GEX', data: cumCall, borderColor: COLORS.green, backgroundColor: 'rgba(52,199,89,0.15)', fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2 },
            { label: 'Cum. Put GEX', data: cumPut, borderColor: COLORS.red, backgroundColor: 'rgba(255,59,48,0.15)', fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2 },
          ],
        },
        options: chartDefaults(viewMin, viewMax),
        plugins: [spotAnnotationPlugin(c.spot, allStrikes), crosshairPlugin],
      });
    }
  
    function drawDealerGexChart(c, allStrikes, viewMin, viewMax) {
      destroyChart('dealergex');
      const ctx = _root.querySelector('#sod-chart-dealergex')?.getContext('2d');
      if (!ctx) return;
  
      const gexVals = allStrikes.map(s => c.gexByStrike[s] || 0);
      const colors = gexVals.map(v => v >= 0 ? COLORS.posGex : COLORS.negGex);
  
      _charts.dealergex = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: allStrikes.map(String),
          datasets: [{ label: 'Net GEX', data: gexVals, backgroundColor: colors, borderRadius: 3 }],
        },
        options: chartDefaults(viewMin, viewMax),
        plugins: [spotAnnotationPlugin(c.spot, allStrikes), crosshairPlugin],
      });
    }
  
    function drawGreeksChart(c, allStrikes, viewMin, viewMax) {
      destroyChart('greeks');
      const ctx = _root.querySelector('#sod-chart-greeks')?.getContext('2d');
      if (!ctx) return;
  
      const greekKey = _state.greeksExposureTab.toLowerCase();
      const ge = c.greeksExposure[greekKey];
      if (!ge) return;
  
      const pos = allStrikes.map(s => ge.positive[s] || 0);
      const neg = allStrikes.map(s => ge.negative[s] || 0);
      const net = allStrikes.map(s => ge.net[s] || 0);
      const defaults = chartDefaults(viewMin, viewMax);
  
      _charts.greeks = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: allStrikes.map(String),
          datasets: [
            { label: 'Positive', data: pos, backgroundColor: 'rgba(52,199,89,0.6)', borderRadius: 2, order: 2 },
            { label: 'Negative', data: neg, backgroundColor: 'rgba(255,59,48,0.6)', borderRadius: 2, order: 2 },
            { label: 'Net', data: net, type: 'line', borderColor: COLORS.yellow, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.3, order: 1 },
          ],
        },
        options: {
          ...defaults,
          scales: {
            ...defaults.scales,
            x: { ...defaults.scales.x, stacked: true },
            y: { ...defaults.scales.y, stacked: true },
          },
        },
        plugins: [spotAnnotationPlugin(c.spot, allStrikes), crosshairPlugin],
      });
    }
  
    function drawVolumeChart(c, allStrikes, viewMin, viewMax, hasVolume = true) {
      destroyChart('volume');
      const ctx = _root.querySelector('#sod-chart-volume')?.getContext('2d');
      if (!ctx) return;
  
      const callData = allStrikes.map(s => hasVolume ? (c.callMap[s]?.vol || 0) : (c.callMap[s]?.oi || 0));
      const putData = allStrikes.map(s => hasVolume ? (c.putMap[s]?.vol || 0) : (c.putMap[s]?.oi || 0));
      const callLabel = hasVolume ? 'Call Volume' : 'Call OI';
      const putLabel = hasVolume ? 'Put Volume' : 'Put OI';
  
      _charts.volume = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: allStrikes.map(String),
          datasets: [
            { label: callLabel, data: callData, backgroundColor: COLORS.posGex, borderRadius: 3 },
            { label: putLabel, data: putData, backgroundColor: COLORS.negGex, borderRadius: 3 },
          ],
        },
        options: chartDefaults(viewMin, viewMax),
        plugins: [spotAnnotationPlugin(c.spot, allStrikes), crosshairPlugin],
      });
    }
  
    /* ───────────────────────────────────────────
       §8B  US MARKET MODULES
    ─────────────────────────────────────────── */
  
    const MAJOR_INDICES = {
      'Americas': [
        { sym: '$SPX', name: 'S&P 500' },
        { sym: '$DJI', name: 'Dow Jones Industrial Average' },
        { sym: '$NYA', name: 'NYSE Composite' },
        { sym: '$COMPX', name: 'NASDAQ' },
        { sym: '$XAX', name: 'NYSE MKT Composite' },
        { sym: '$RUT', name: 'Russell 2000' },
        { sym: '$SCH1000', name: 'Schwab 1000' },
        { sym: '$DWCF', name: 'Dow Jones Total Stock Market' },
        { sym: '$MID', name: 'S&P 400 Mid Cap' },
        { sym: '$SML', name: 'S&P 600 Small Cap' },
        { sym: '$NDX', name: 'Nasdaq 100' },
        { sym: '$IXF', name: 'NYSE Financials' },
        { sym: '$VIX', name: 'CBOE Market Volatility' },
        { sym: '$UTIL', name: 'Dow Jones Utilities' },
        { sym: '$TRAN', name: 'Dow Jones Transportation' },
        { sym: '$TNX', name: '10 Yr Treasury Index' },
        { sym: '$TYX', name: '30 Yr Treasury Index' },
        { sym: '$CADOW', name: 'Dow Jones Canada' },
        { sym: '$ILX', name: 'S&P Latin America 40' },
      ],
      'Europe': [
        { sym: '$SXXP', name: 'S&P Euro 350' },
        { sym: '$FCHI', name: 'CAC 40' },
        { sym: '$GDAXI', name: 'DAX' },
        { sym: '$BFX', name: 'Euronext 100' },
      ],
      'Asia': [
        { sym: '$N225', name: 'Nikkei 225' },
        { sym: '$HSI', name: 'Hang Seng' },
        { sym: '$AORD', name: 'Australia ASX' },
      ],
    };
  
    const SP_GLOBAL_BMI = {
      'Developed Europe': [
        { sym: '$SPEU', name: 'S&P Europe' },
        { sym: '$SPAT', name: 'S&P Austria' },
        { sym: '$SPBE', name: 'S&P Belgium' },
        { sym: '$SPDK', name: 'S&P Denmark' },
        { sym: '$SPFI', name: 'S&P Finland' },
        { sym: '$SPFR', name: 'S&P France' },
        { sym: '$SPDE', name: 'S&P Germany' },
        { sym: '$SPGR', name: 'S&P Greece' },
        { sym: '$SPIE', name: 'S&P Ireland' },
        { sym: '$SPIT', name: 'S&P Italy' },
        { sym: '$SPNL', name: 'S&P Netherlands' },
        { sym: '$SPNO', name: 'S&P Norway' },
        { sym: '$SPPT', name: 'S&P Portugal' },
        { sym: '$SPES', name: 'S&P Spain' },
        { sym: '$SPSE', name: 'S&P Sweden' },
        { sym: '$SPCH', name: 'S&P Switzerland' },
        { sym: '$SPGB', name: 'S&P United Kingdom' },
      ],
      'Emerging Europe, Middle East & Africa': [
        { sym: '$SPEMEA', name: 'S&P Emerging EMEA' },
        { sym: '$SPCZ', name: 'S&P Czech Republic' },
        { sym: '$SPHU', name: 'S&P Hungary' },
        { sym: '$SPPL', name: 'S&P Poland' },
        { sym: '$SPRU', name: 'S&P Russia' },
        { sym: '$SPTR', name: 'S&P Turkey' },
        { sym: '$SPEG', name: 'S&P Egypt' },
        { sym: '$SPIL', name: 'S&P Israel' },
        { sym: '$SPMA', name: 'S&P Morocco' },
        { sym: '$SPZA', name: 'S&P South Africa' },
        { sym: '$SPAE', name: 'S&P UAE' },
      ],
      'Developed Asia/Pacific Ex-Japan': [
        { sym: '$SPAPXJ', name: 'S&P Asia/Pacific Ex-Japan' },
        { sym: '$SPAU', name: 'S&P Australia' },
        { sym: '$SPHK', name: 'S&P Hong Kong' },
        { sym: '$SPNZ', name: 'S&P New Zealand' },
        { sym: '$SPSG', name: 'S&P Singapore' },
        { sym: '$SPKR', name: 'S&P South Korea' },
      ],
      'Emerging Asia/Pacific': [
        { sym: '$SPAPEM', name: 'S&P Asia/Pacific Emerging' },
        { sym: '$SPCN', name: 'S&P China' },
        { sym: '$SPIN', name: 'S&P India' },
        { sym: '$SPID', name: 'S&P Indonesia' },
        { sym: '$SPMY', name: 'S&P Malaysia' },
        { sym: '$SPPH', name: 'S&P Philippines' },
        { sym: '$SPTW', name: 'S&P Taiwan' },
        { sym: '$SPTH', name: 'S&P Thailand' },
      ],
      'Latin America': [
        { sym: '$SPLA', name: 'S&P Latin America' },
        { sym: '$SPAR', name: 'S&P Argentina' },
        { sym: '$SPBR', name: 'S&P Brazil' },
        { sym: '$SPCL', name: 'S&P Chile' },
        { sym: '$SPMX', name: 'S&P Mexico' },
        { sym: '$SPPE', name: 'S&P Peru' },
      ],
      'Japan': [{ sym: '$SPJP', name: 'S&P Japan' }],
      'Canada': [{ sym: '$SPCA', name: 'S&P Canada' }],
    };
  
    const REGION_COLORS = {
      '$DJI': '#FF6384', '$COMPX': '#36A2EB', '$SPX': '#4BC0C0', '$RUT': '#FF9F40',
    };
  
    /* ── Market API helpers ── */
  
    function marketHeaders(resVer = '2') {
      return {
        authorization: `Bearer ${_token}`,
        'schwab-client-channel': 'IO',
        'schwab-client-appid': 'AD00007800',
        'schwab-resource-version': resVer,
        'content-type': 'application/json',
        accept: 'application/json',
        origin: 'https://client.schwab.com',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
      };
    }
  
    async function fetchIndicesHistory(region = 'americas', period = 'day') {
      await getToken();
      const apiRegion = REGION_MAP[region] || region;
      const apiPeriod = PERIOD_MAP[period] || period;
      const r = await _schwabFetch(`${API.INDICES_HISTORY}?region=${apiRegion}&period=${apiPeriod}`, {
        headers: marketHeaders('2'),
      });
      if (!r.ok) throw new Error(`Indices history failed: ${r.status}`);
      return r.json();
    }
  
    async function fetchSymbolHistory(symbols, period = 'day') {
      await getToken();
      const symArr = Array.isArray(symbols) ? symbols : [symbols];
      const hdrs = marketHeaders('2');
      const settled = await Promise.allSettled(symArr.map(sym =>
        _schwabFetch(`${API.SYMBOL_HISTORY}?symbols=${encodeURIComponent(sym)}&period=${period}&needExtendedHoursData=false`, { headers: hdrs })
          .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
          .then(data => data.stockChart?.[0] ? { symbol: sym, chart: data.stockChart[0] } : null)
      ));
      return settled
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value);
    }
  
    async function fetchNewsHeadlines(limit = 10, start = 0) {
      await getToken();
      const r = await _schwabFetch(`${API.NEWS_HEADLINES}?newsType=Market&limit=${limit}&start=${start}&language=en-US`, {
        headers: { ...marketHeaders('1'), markit: 'true' },
      });
      if (!r.ok) throw new Error(`News failed: ${r.status}`);
      return r.json();
    }

    function _safeRandomUUID() {
      const c = (typeof globalThis !== 'undefined') ? globalThis.crypto : null;
      if (c && typeof c.randomUUID === 'function') return c.randomUUID();
      return `mw-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  
    async function fetchNewsViaF2() {
      const markitTk = await getMarkitToken();
      const params = [{
        appId: 'com_schwab_app_registry_shared_search_news_v3',
        manifestUrl: API.NEWS_F2,
        context: {
          width: 900, isInvestorSource: true, appIndex: 0, isRMS: true,
          isZoomed: false, symbol: '', type: 'markets', wsodIssue: null, UseModDomain: true,
        },
        siteContext: 'schwabspa',
        instanceId: _safeRandomUUID(),
        views: ['home'],
      }];
      const body = `params=${encodeURIComponent(JSON.stringify(params))}&siteContext=schwabspa`;
      const r = await _schwabFetch(API.NEWS_F2, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${markitTk}`,
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          accept: 'application/json, text/javascript, */*; q=0.01',
          origin: 'https://client.schwab.com',
        },
        body,
      });
      if (!r.ok) throw new Error(`News F2 failed: ${r.status}`);
      const data = await r.json();
      const html = data?.apps?.[0]?.html || '';
      return _parseNewsF2Html(html);
    }
  
    function _parseNewsF2Html(html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const articles = [];
      doc.querySelectorAll('article[data-module-name="NewsItemPreviewModuleV1"]').forEach(item => {
        const linkEl = item.querySelector('a[data-dockey]');
        const headline = linkEl?.textContent?.trim() || item.querySelector('h4')?.textContent?.trim();
        const meta = item.querySelector('.text-muted')?.textContent?.trim() || '';
        const abstract = item.querySelector('.news-abstract')?.textContent?.trim() || '';
        const docKey = linkEl?.getAttribute('data-dockey') || '';
        const parts = meta.split(' - ');
        const time = parts.pop()?.trim() || '';
        const source = parts.join(' - ')?.trim() || '';
        if (headline) {
          articles.push({ headline, source, teaser: abstract, date: time || new Date().toISOString(), docKey });
        }
      });
      return articles;
    }
  
    async function fetchNewsStory(docKey) {
      const markitTk = await getMarkitToken();
      const url = `${API.NEWS_STORY}?DocKey=${encodeURIComponent(docKey)}&ShowSaveNewsLink=True&ShowMentionedCompaniesCharts=True`;
      const r = await _schwabFetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${markitTk}`,
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          accept: 'application/json, text/javascript, */*; q=0.01',
          origin: 'https://client.schwab.com',
        },
        body: '',
      });
      if (!r.ok) throw new Error(`News story failed: ${r.status}`);
      const data = await r.json();
      const moduleHtml = data?.Module || '';
      const parser = new DOMParser();
      const doc = parser.parseFromString(moduleHtml, 'text/html');
      const storyEl = doc.querySelector('.full-news-story');
      return storyEl?.innerHTML || moduleHtml;
    }
  
    async function fetchNewsSearch(row = 10, start = 0, source = 'All', keyword = '') {
      const markitTk = await getMarkitToken();
      const params = new URLSearchParams();
      params.set('criteria[FreeText]', keyword);
      params.set('criteria[SymbolText]', '');
      params.set('criteria[FromDate]', '');
      params.set('criteria[ToDate]', '');
      params.set('criteria[Sources]', source);
      params.set('criteria[SearchKeyword]', 'on');
      params.set('criteria[SearchSymbol]', '');
      params.set('criteria[TopicType]', 'Any');
      params.set('row', String(row));
      if (start > 0) params.set('start', String(start));
      const r = await _schwabFetch(API.NEWS_SEARCH, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${markitTk}`,
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          accept: 'application/json, text/javascript, */*; q=0.01',
          origin: 'https://client.schwab.com',
        },
        body: params.toString(),
      });
      if (!r.ok) throw new Error(`News search failed: ${r.status}`);
      const data = await r.json();
      return _parseNewsSearchHtml(data?.Module || '');
    }
  
    function _parseNewsSearchHtml(html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const articles = [];
      doc.querySelectorAll('article[data-module-name="NewsItemPreviewModuleV2"]').forEach(item => {
        const linkEl = item.querySelector('a[data-dockey]');
        const headline = linkEl?.textContent?.trim() || item.querySelector('h4')?.textContent?.trim();
        const meta = item.querySelector('.text-muted')?.textContent?.trim() || '';
        const abstract = item.querySelector('.news-abstract')?.textContent?.trim() || '';
        const docKey = linkEl?.getAttribute('data-dockey') || '';
        const parts = meta.split(' - ');
        const time = parts.pop()?.trim() || '';
        const source = parts.join(' - ')?.trim() || '';
        if (headline) {
          articles.push({ headline, source, teaser: abstract, date: time || new Date().toISOString(), docKey });
        }
      });
      return articles;
    }
  
    const RANKING_TYPE_MAP = {
      MostActive: 'MostActive',
      PctChangeGainers: 'PctChgGainers',
      PctChangeLosers: 'PctChgLosers',
      NetGainers: 'NetGainers',
      NetLosers: 'NetLosers',
      '52WkHigh': 'High52Wk',
      '52WkLow': 'Low52Wk',
    };
  
    async function fetchCompanyMovers(exchange = 'all', rankingType = 'MostActive', sector = 'all') {
      await getToken();
      const apiRanking = RANKING_TYPE_MAP[rankingType] || rankingType;
      const r = await _schwabFetch(`${API.COMPANY_MOVERS}?exchange=${exchange}&rankingType=${apiRanking}&sector=${sector}`, {
        headers: { ...marketHeaders('1'), markit: 'true' },
      });
      if (!r.ok) throw new Error(`Movers failed: ${r.status}`);
      return r.json();
    }
  
    async function fetchCalendar(eventType = 'TodaysEvents', activeDate = null) {
      const markitTk = await getMarkitToken();
      const oa = activeDate || dateToOA(_calState.selectedDate);
      const body = `ActiveDate=${oa}&ActiveEventType=${encodeURIComponent(eventType)}&Holdings=%5B%5D&SearchSymbol=&HidePortfolio=true`;
      const r = await _schwabFetch(API.CALENDAR_EVENTS, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${markitTk}`,
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          accept: 'text/plain, */*; q=0.01',
          origin: 'https://client.schwab.com',
        },
        body,
      });
      if (!r.ok) throw new Error(`Calendar events failed: ${r.status}`);
      const html = await r.text();
      const sections = _parseCalendarHTML(html);
      return { _sections: sections, _parsed: sections?.length ? [{ symbol: '', detail: 'loaded', time: '' }] : [] };
    }
  
    async function fetchRatingChanges() {
      const markitTk = await getMarkitToken();
      const r = await _schwabFetch(API.CALENDAR_RATINGS, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${markitTk}`,
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          accept: 'text/plain, */*; q=0.01',
          origin: 'https://client.schwab.com',
        },
        body: 'ActiveEventType=RatingChanges',
      });
      if (!r.ok) throw new Error(`Rating changes failed: ${r.status}`);
      const html = await r.text();
      return _parseRatingChangesHTML(html);
    }
  
    function _parseRatingChangesHTML(html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const sections = [];
      const providerContainer = doc.querySelector('.provider-container') || doc;
      const heading = providerContainer.querySelector('h4')?.textContent?.trim() || 'Rating Changes';
      const table = providerContainer.querySelector('table');
      if (!table) return null;
  
      const ths = table.querySelectorAll('thead th');
      const headers = Array.from(ths).map(th => th.textContent.trim()).filter(Boolean);
      const rows = [];
      table.querySelectorAll('tbody tr').forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('td')).map(td => {
          const serIcon = td.querySelector('i[class*="font-icon-ser-"]');
          if (serIcon) {
            const cls = serIcon.className;
            const m = cls.match(/font-icon-ser-([a-f])/i);
            return m ? m[1].toUpperCase() : td.textContent.trim();
          }
          const ariaLink = td.querySelector('a[aria-label*="Rating"]');
          if (ariaLink) {
            const m = ariaLink.getAttribute('aria-label')?.match(/Rating of ([A-F])/i);
            return m ? m[1].toUpperCase() : td.textContent.trim();
          }
          const link = td.querySelector('a.snapshot-link, a.btn-action');
          if (link) return link.textContent.trim();
          return td.textContent.trim();
        });
        if (cells.some(c => c.length > 0)) rows.push(cells);
      });
  
      if (rows.length > 0) {
        sections.push({ section: heading, headers, rows });
      }
      return sections.length ? sections : null;
    }
  
    function _parseCalendarHTML(html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const sections = [];
      let currentSection = '';
  
      const elements = doc.querySelectorAll('h3, h4, table');
      elements.forEach(el => {
        if (el.tagName === 'H3' || el.tagName === 'H4') {
          const text = el.textContent.trim();
          if (text && text !== 'Calendar' && !text.match(/^\d{4}$/) &&
              !text.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/)) {
            currentSection = text;
          }
          return;
        }
        if (el.tagName !== 'TABLE') return;
        if (el.closest('.calendar-months-module') || el.closest('.months')) return;
  
        const ths = el.querySelectorAll('thead th');
        const headers = Array.from(ths).map(th => th.textContent.trim()).filter(Boolean);
        if (headers.length === 7 && headers[0] === 'S') return;
        if (headers.length === 0) return;
  
        const rowData = [];
        el.querySelectorAll('tbody tr').forEach(tr => {
          const cells = Array.from(tr.querySelectorAll('td')).map(td => {
            const link = td.querySelector('a');
            return (link || td).textContent.trim();
          });
          if (cells.some(c => c.length > 0)) rowData.push(cells);
        });
  
        if (rowData.length > 0) {
          sections.push({ section: currentSection, headers, rows: rowData });
        }
      });
  
      return sections.length ? sections : null;
    }
  
    /* ══════════════════════════════════════════════
       MODULE 1: INDICES
    ══════════════════════════════════════════════ */
  
    const PERIOD_MAP = { 'day': 'day', '5d': 'Week', '1m': 'Month', 'ytd': 'YTD', '1y': 'Year', '3y': 'ThreeYears', '5y': 'FiveYears' };
    const REGION_MAP = { 'americas': 'Americas', 'europe': 'Europe', 'asia': 'Asia' };
    let _indicesState = { mode: 'region', region: 'americas', period: 'day', selectedSymbols: [] };
    let _indicesDocClickHandler = null;
  
    function renderIndicesModule() {
      const panel = _root.querySelector('#sod-market-indices');
      if (!panel) return;
  
      const regionBtns = ['americas', 'europe', 'asia'].map(r =>
        `<button class="sod-idx-mode-btn ${_indicesState.region === r ? 'active' : ''}" data-region="${r}">${r === 'americas' ? t('market.us') : r === 'europe' ? t('market.europe') : t('market.asia')}</button>`
      ).join('');
  
      const periodLabels = { day: '1D', '5d': '5D', '1m': '1M', ytd: 'YTD', '1y': '1Y', '3y': '3Y', '5y': '5Y' };
      const periodBtns = ['day', '5d', '1m', 'ytd', '1y', '3y', '5y'].map(p =>
        `<button class="sod-m-tab ${_indicesState.period === p ? 'active' : ''}" data-period="${p}">${periodLabels[p]}</button>`
      ).join('');
  
      function buildDDMenu(source) {
        let html = '';
        for (const [group, items] of Object.entries(source)) {
          let subItems = items.map(it => {
            const checked = _indicesState.selectedSymbols.includes(it.sym) ? 'checked' : '';
            return `<div class="sod-idx-opt" data-sym="${it.sym}"><input type="checkbox" data-sym="${it.sym}" ${checked}/><label>${it.sym} — ${it.name}</label></div>`;
          }).join('');
          html += `<div class="sod-idx-group-label" data-group="${group}"><span>${group}</span><div class="sod-idx-submenu">${subItems}</div></div>`;
        }
        return html;
      }
  
      panel.innerHTML = `
        <div class="sod-card-title sod-card-title-indices"><span class="material-icons sod-card-icon">show_chart</span>${t('market.indices')}</div>
        <div class="sod-m-controls">
          <div class="sod-idx-mode">
            <button class="sod-idx-mode-btn ${_indicesState.mode === 'region' ? 'active' : ''}" data-mode="region">${t('market.region')}</button>
            <button class="sod-idx-mode-btn ${_indicesState.mode === 'individual' ? 'active' : ''}" data-mode="individual">${t('market.individual')}</button>
          </div>
          <div id="sod-idx-region-btns" style="display:${_indicesState.mode === 'region' ? 'flex' : 'none'};gap:2px;margin-left:4px">
            <div class="sod-idx-mode">${regionBtns}</div>
          </div>
          <div id="sod-idx-individual" style="display:${_indicesState.mode === 'individual' ? 'flex' : 'none'};gap:4px;margin-left:4px;align-items:center;flex-wrap:wrap">
            <div class="sod-idx-dropdown">
              <button class="sod-m-btn sod-m-btn-primary" id="sod-idx-dd-major">${t('market.majorIndices')} ▾</button>
              <div class="sod-idx-dropdown-menu" id="sod-idx-dd-menu-major">${buildDDMenu(MAJOR_INDICES)}</div>
            </div>
            <div class="sod-idx-dropdown">
              <button class="sod-m-btn sod-m-btn-primary" id="sod-idx-dd-sp">${t('market.spGlobal')} ▾</button>
              <div class="sod-idx-dropdown-menu" id="sod-idx-dd-menu-sp">${buildDDMenu(SP_GLOBAL_BMI)}</div>
            </div>
            <button class="sod-m-btn sod-m-btn-primary" id="sod-idx-load-sel">${t('market.load')}</button>
          </div>
          <div class="sod-m-tabs" style="margin-left:8px">${periodBtns}</div>
        </div>
        <div class="sod-chart-wrap"><canvas id="sod-chart-indices"></canvas></div>
      `;
  
      panel.querySelectorAll('.sod-idx-mode-btn[data-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
          _indicesState.mode = btn.dataset.mode;
          renderIndicesModule();
          if (_indicesState.mode === 'region') loadIndicesRegion();
        });
      });
  
      panel.querySelectorAll('.sod-idx-mode-btn[data-region]').forEach(btn => {
        btn.addEventListener('click', () => {
          _indicesState.region = btn.dataset.region;
          panel.querySelectorAll('.sod-idx-mode-btn[data-region]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          loadIndicesRegion();
        });
      });
  
      panel.querySelectorAll('.sod-m-tab[data-period]').forEach(btn => {
        btn.addEventListener('click', () => {
          _indicesState.period = btn.dataset.period;
          panel.querySelectorAll('.sod-m-tab[data-period]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          if (_indicesState.mode === 'region') loadIndicesRegion();
          else if (_indicesState.selectedSymbols.length) loadIndicesIndividual();
        });
      });
  
      const ddMajorBtn = panel.querySelector('#sod-idx-dd-major');
      const ddMajorMenu = panel.querySelector('#sod-idx-dd-menu-major');
      const ddSpBtn = panel.querySelector('#sod-idx-dd-sp');
      const ddSpMenu = panel.querySelector('#sod-idx-dd-menu-sp');
      const allMenus = [ddMajorMenu, ddSpMenu];
  
      function closeAllDD() { allMenus.forEach(m => m?.classList.remove('open')); }
  
      ddMajorBtn?.addEventListener('click', (e) => { e.stopPropagation(); ddSpMenu?.classList.remove('open'); ddMajorMenu.classList.toggle('open'); });
      ddSpBtn?.addEventListener('click', (e) => { e.stopPropagation(); ddMajorMenu?.classList.remove('open'); ddSpMenu.classList.toggle('open'); });
      allMenus.forEach(m => m?.addEventListener('click', (e) => e.stopPropagation()));
      if (_indicesDocClickHandler) document.removeEventListener('click', _indicesDocClickHandler);
      _indicesDocClickHandler = (e) => {
        if (!allMenus.some(m => m?.contains(e.target)) && e.target !== ddMajorBtn && e.target !== ddSpBtn) closeAllDD();
      };
      document.addEventListener('click', _indicesDocClickHandler);
  
      function syncCheckboxes() {
        allMenus.forEach(m => m?.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.checked = _indicesState.selectedSymbols.includes(cb.dataset.sym);
        }));
      }
  
      allMenus.forEach(menu => {
        menu?.querySelectorAll('.sod-idx-opt').forEach(opt => {
          opt.addEventListener('click', (e) => {
            e.stopPropagation();
            const sym = opt.dataset.sym;
            if (!sym) return;
            const cb = opt.querySelector('input[type="checkbox"]');
            if (e.target !== cb) { cb.checked = !cb.checked; }
            if (cb.checked && !_indicesState.selectedSymbols.includes(sym)) {
              _indicesState.selectedSymbols.push(sym);
            } else if (!cb.checked) {
              _indicesState.selectedSymbols = _indicesState.selectedSymbols.filter(s => s !== sym);
            }
            syncCheckboxes();
          });
        });
      });
  
      panel.querySelector('#sod-idx-load-sel')?.addEventListener('click', () => {
        closeAllDD();
        if (_indicesState.selectedSymbols.length) loadIndicesIndividual();
      });
    }
  
    const REGION_API_PERIODS = new Set(['day', '5d', '1m', '1y']);
    const REGION_DEFAULT_SYMBOLS = {
      americas: ['$DJI', '$COMPX', '$SPX', '$RUT'],
      europe: ['$SXXP', '$FCHI', '$GDAXI', '$BFX'],
      asia: ['$N225', '$HSI', '$AORD'],
    };
  
    async function loadIndicesRegion() {
      try {
        if (REGION_API_PERIODS.has(_indicesState.period)) {
          const data = await fetchIndicesHistory(_indicesState.region, _indicesState.period);
          _state.marketIndicesData = data;
          drawIndicesChart(data);
        } else {
          const syms = REGION_DEFAULT_SYMBOLS[_indicesState.region] || REGION_DEFAULT_SYMBOLS.americas;
          const p = SYMBOL_PERIOD_MAP[_indicesState.period] || 'Day';
          const data = await fetchSymbolHistory(syms, p);
          _state.marketIndicesData = null;
          drawIndicesChartFromSymbols(data);
        }
      } catch (e) {
        console.error(TAG, 'Indices load error:', e);
        showToast('Failed to load indices: ' + e.message, 'error');
      }
    }
  
    const SYMBOL_PERIOD_MAP = { 'day': 'Day', '5d': 'Week', '1m': 'OneMonth', 'ytd': 'YTD', '1y': 'OneYear', '3y': 'ThreeYear', '5y': 'FiveYear' };
  
    function showSymbolInIndices(symbol) {
      if (!symbol || symbol.startsWith('$')) return;
      _indicesState.mode = 'individual';
      _indicesState.selectedSymbols = [symbol];
      renderIndicesModule();
      loadIndicesIndividual();
      const panel = _root.querySelector('#sod-market-indices');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  
    async function loadIndicesIndividual() {
      try {
        const p = SYMBOL_PERIOD_MAP[_indicesState.period] || 'Day';
        const data = await fetchSymbolHistory(_indicesState.selectedSymbols, p);
        drawIndicesChartFromSymbols(data);
      } catch (e) {
        console.error(TAG, 'Individual indices error:', e);
        showToast('Failed to load symbol history: ' + e.message, 'error');
      }
    }
  
    function drawIndicesChartFromSymbols(symbolData) {
      destroyChart('indices');
      const ctx = _root.querySelector('#sod-chart-indices')?.getContext('2d');
      if (!ctx || !symbolData?.length) return;
  
      const useAbsolute = symbolData.length === 1;
      const allColors = ['#FF6384', '#36A2EB', '#4BC0C0', '#FF9F40', '#9966FF', '#FF6633', '#33CC99', '#FF3366'];
      const datasets = symbolData.map((sd, i) => {
        const ts = sd.chart.timeSeries || [];
        return {
          label: sd.symbol,
          data: ts.map(t => {
            if (useAbsolute) return t.lastPrice;
            const pctChange = sd.chart.previousClose > 0
              ? ((t.lastPrice - sd.chart.previousClose) / sd.chart.previousClose) * 100
              : 0;
            return pctChange;
          }),
          borderColor: allColors[i % allColors.length],
          backgroundColor: useAbsolute ? 'rgba(255,99,132,0.08)' : 'transparent',
          fill: useAbsolute,
          borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 3, tension: 0.2,
        };
      });
  
      const longest = symbolData.reduce((a, b) => (b.chart.timeSeries?.length || 0) > (a.chart?.timeSeries?.length || 0) ? b : a, symbolData[0]);
      const filteredRef = longest.chart.timeSeries || [];
      const labels = filteredRef.map(t => {
        const d = new Date(t.lastPriceDate);
        return _indicesState.period === 'day'
          ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
          : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });
  
      _charts.indices = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: true, position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 6, boxHeight: 6, font: { size: 10 }, padding: 8 } },
            tooltip: {
              enabled: true, mode: 'index', intersect: false,
              backgroundColor: 'rgba(0,0,0,0.85)', titleFont: { size: 10 }, bodyFont: { size: 10 },
              cornerRadius: 6, padding: 8, usePointStyle: true, boxWidth: 6, boxHeight: 6, boxPadding: 3,
              callbacks: {
                title: items => items.length ? labels[items[0].dataIndex] : '',
                label: ctx => useAbsolute
                  ? ` ${ctx.dataset.label}: $${ctx.parsed.y?.toFixed(2)}`
                  : ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2)}%`,
              },
            },
            zoom: { pan: { enabled: true, mode: 'x', threshold: 5 }, limits: { x: { minRange: 10 } } },
          },
          scales: {
            x: { ticks: { font: { size: 8 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12, color: '#888' }, grid: { display: false } },
            y: { ticks: { font: { size: 9 }, color: '#888', callback: v => useAbsolute ? '$' + v.toFixed(2) : v.toFixed(1) + '%' }, grid: { color: 'rgba(128,128,128,0.1)' } },
          },
        },
        plugins: [crosshairPlugin],
      });
    }
  
    function drawIndicesChart(data) {
      destroyChart('indices');
      const ctx = _root.querySelector('#sod-chart-indices')?.getContext('2d');
      if (!ctx || !data?.quotesHistory?.length) return;
  
      const useAbsolute = data.quotesHistory.length === 1;
      const datasets = data.quotesHistory.map((qh, i) => {
        const sym = qh.lastQuote?.symbol || `Index ${i}`;
        const history = qh.quoteHistory || [];
        const color = REGION_COLORS[sym] || Object.values(COLORS)[i % Object.values(COLORS).length];
        return {
          label: `${sym} (${qh.lastQuote?.name || ''})`,
          data: history.map(h => useAbsolute ? (h.value ?? h.changePercent) : h.changePercent),
          borderColor: color,
          backgroundColor: useAbsolute ? (color + '14') : 'transparent',
          fill: useAbsolute,
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 3,
          tension: 0.2,
        };
      });
  
      const refHistory = data.quotesHistory[0]?.quoteHistory || [];
      const labels = refHistory.map(h => {
        const d = new Date(h.dateTime);
        return _indicesState.period === 'day'
          ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
          : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });
  
      _charts.indices = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: true, position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 6, boxHeight: 6, font: { size: 10 }, padding: 8 } },
            tooltip: {
              enabled: true, mode: 'index', intersect: false,
              backgroundColor: 'rgba(0,0,0,0.85)', titleFont: { size: 10 }, bodyFont: { size: 10 },
              cornerRadius: 6, padding: 8, usePointStyle: true, boxWidth: 6, boxHeight: 6, boxPadding: 3,
              callbacks: {
                title: items => items.length ? labels[items[0].dataIndex] : '',
                label: ctx => useAbsolute
                  ? ` ${ctx.dataset.label.split(' (')[0]}: ${ctx.parsed.y?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : ` ${ctx.dataset.label.split(' (')[0]}: ${ctx.parsed.y?.toFixed(2)}%`,
              },
            },
            zoom: { pan: { enabled: true, mode: 'x', threshold: 5 }, limits: { x: { minRange: 10 } } },
          },
          scales: {
            x: { ticks: { font: { size: 8 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12, color: '#888' }, grid: { display: false } },
            y: { ticks: { font: { size: 9 }, color: '#888', callback: v => useAbsolute ? v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : v.toFixed(1) + '%' }, grid: { color: 'rgba(128,128,128,0.1)' } },
          },
        },
        plugins: [crosshairPlugin],
      });
    }
  
    /* ══════════════════════════════════════════════
       MODULE 2: CALENDAR
    ══════════════════════════════════════════════ */
  
    let _calState = {
      tab: 'TodaysEvents', year: new Date().getFullYear(), month: new Date().getMonth(),
      selectedDate: new Date(), events: [], sections: null, searchFilter: '',
      sectionSorts: {},
      loaded: false,
    };
    const CALENDAR_CACHE_TTL_MS = 60 * 1000;
    let _calendarDataCache = {};
    let _calendarDataInflight = {};
  
    function dateToOA(d) {
      return Math.floor((d.getTime() - new Date('1899-12-30T00:00:00Z').getTime()) / 86400000);
    }
  
    function isMarketDay(year, month, day) {
      const d = new Date(year, month, day);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) return false;
      const mmdd = `${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const fixedHolidays = ['01-01','07-04','12-25'];
      if (fixedHolidays.includes(mmdd)) return false;
      return true;
    }
  
    function _calendarRequestKey(tabKey, oaDate) {
      return `${tabKey}::${oaDate}`;
    }
  
    function _getCachedCalendarData(tabKey, oaDate) {
      const entry = _calendarDataCache[_calendarRequestKey(tabKey, oaDate)];
      if (!entry) return null;
      if ((Date.now() - entry.updatedAt) > CALENDAR_CACHE_TTL_MS) {
        delete _calendarDataCache[_calendarRequestKey(tabKey, oaDate)];
        return null;
      }
      return entry.sections;
    }
  
    function _storeCalendarData(tabKey, oaDate, sections) {
      _calendarDataCache[_calendarRequestKey(tabKey, oaDate)] = {
        sections,
        updatedAt: Date.now(),
      };
    }
  
    async function _fetchCalendarSectionsCached(tabKey, oaDate, opts = {}) {
      const cacheKey = _calendarRequestKey(tabKey, oaDate);
      if (!opts.force) {
        const cached = _getCachedCalendarData(tabKey, oaDate);
        if (cached) return cached;
        if (_calendarDataInflight[cacheKey]) return _calendarDataInflight[cacheKey];
      }
      const promise = (async () => {
        let sections;
        if (tabKey === 'RatingChanges') {
          sections = await fetchRatingChanges();
        } else {
          const resp = await fetchCalendar(tabKey, oaDate);
          sections = resp._sections;
        }
        _storeCalendarData(tabKey, oaDate, sections || null);
        return sections || null;
      })().finally(() => {
        delete _calendarDataInflight[cacheKey];
      });
      _calendarDataInflight[cacheKey] = promise;
      return promise;
    }
  
    function prefetchCalendarDefault() {
      const oa = dateToOA(_calState.selectedDate);
      _fetchCalendarSectionsCached('TodaysEvents', oa).catch(e => {
        console.warn(TAG, 'Calendar prefetch failed:', e.message);
      });
    }
  
    function _buildCalendarMiniGridHTML() {
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const firstDay = new Date(_calState.year, _calState.month, 1).getDay();
      const daysInMonth = new Date(_calState.year, _calState.month + 1, 0).getDate();
      const today = new Date();
      const selD = _calState.selectedDate;
  
      let calCells = ['S','M','T','W','T','F','S'].map(d => `<div class="sod-cal-mini-hdr">${d}</div>`).join('');
      for (let i = 0; i < firstDay; i++) calCells += '<div class="sod-cal-mini-day off"></div>';
      for (let d = 1; d <= daysInMonth; d++) {
        const isToday = d === today.getDate() && _calState.month === today.getMonth() && _calState.year === today.getFullYear();
        const isSel = d === selD.getDate() && _calState.month === selD.getMonth() && _calState.year === selD.getFullYear();
        const market = isMarketDay(_calState.year, _calState.month, d);
        calCells += `<div class="sod-cal-mini-day ${isToday ? 'today' : ''} ${isSel ? 'selected' : ''} ${!market ? 'off' : ''}" ${market ? `data-day="${d}"` : ''}>${d}</div>`;
      }
      return {
        monthLabel: `${monthNames[_calState.month]} ${_calState.year}`,
        gridHtml: calCells,
        dateLabel: `${selD.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} ${t('market.events')}`,
      };
    }
  
    function _buildCalendarTabsHTML() {
      const tabs = [
        { key: 'TodaysEvents', label: t('market.todaysEvents') },
        { key: 'Economic', label: t('market.economic') },
        { key: 'Earnings', label: t('market.earnings') },
        { key: 'Dividends', label: t('market.dividends') },
        { key: 'Splits', label: t('market.splits') },
        { key: 'Conference Calls', label: t('market.calls') },
        { key: 'RatingChanges', label: t('market.ratings') },
      ];
  
      const calTabColors = {
        TodaysEvents: COLORS.blue, Economic: '#FF9500', Earnings: '#34C759',
        Dividends: '#5AC8FA', Splits: '#AF52DE', 'Conference Calls': '#FF2D55', RatingChanges: '#5856D6',
      };
  
      return tabs.map(tab => {
        const c = calTabColors[tab.key] || COLORS.blue;
        const active = _calState.tab === tab.key;
        return `<button class="sod-m-tab" data-cal-tab="${tab.key}" style="width:100%;text-align:center;padding:6px 10px;font-size:11px;font-weight:600;border-radius:8px;border:none;cursor:pointer;transition:all 0.15s;${active ? `background:${c};color:#fff` : `background:${c}18;color:${c}`}">${tab.label}</button>`;
      }).join('');
    }
  
    function _ensureCalendarModuleShell() {
      const panel = _root.querySelector('#sod-market-calendar');
      if (!panel) return;
      if (panel.dataset.shellReady === '1') return panel;
      panel.innerHTML = `
        <div class="sod-card-title sod-card-title-calendar" style="flex-shrink:0"><span class="material-icons sod-card-icon">event</span>${t('market.calendar')}</div>
        <div style="display:flex;flex:1;min-height:0;gap:8px">
          <div style="width:170px;flex-shrink:0;display:flex;flex-direction:column;gap:6px;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none">
            <input class="sod-m-input" id="sod-cal-search" placeholder="${t('market.filterSymbol')}" autocomplete="off" style="width:100%;padding:5px 8px;font-size:11px"/>
            <div class="sod-cal-month-nav">
              <button class="sod-cal-month-btn" id="sod-cal-prev" style="font-size:16px;padding:2px 6px">◀</button>
              <span id="sod-cal-month-label" style="font-size:12px;font-weight:700"></span>
              <button class="sod-cal-month-btn" id="sod-cal-next" style="font-size:16px;padding:2px 6px">▶</button>
            </div>
            <div class="sod-cal-mini" id="sod-cal-mini"></div>
            <div id="sod-cal-tab-list" style="display:flex;flex-direction:column;gap:3px"></div>
          </div>
          <div style="flex:1;display:flex;flex-direction:column;min-height:0;border-left:1px solid var(--border);padding-left:8px">
            <div id="sod-cal-date-label" style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;flex-shrink:0"></div>
            <div class="sod-cal-events"></div>
          </div>
        </div>
      `;
      panel.querySelector('#sod-cal-search')?.addEventListener('input', e => {
        _calState.searchFilter = e.target.value;
        renderCalendarEvents();
      });
  
      panel.querySelector('#sod-cal-prev')?.addEventListener('click', () => {
        _calState.month--;
        if (_calState.month < 0) { _calState.month = 11; _calState.year--; }
        renderCalendarModule();
      });
      panel.querySelector('#sod-cal-next')?.addEventListener('click', () => {
        _calState.month++;
        if (_calState.month > 11) { _calState.month = 0; _calState.year++; }
        renderCalendarModule();
      });
  
      panel.querySelector('#sod-cal-mini')?.addEventListener('click', e => {
        const cell = e.target.closest('.sod-cal-mini-day[data-day]');
        if (!cell) return;
        _calState.selectedDate = new Date(_calState.year, _calState.month, parseInt(cell.dataset.day));
        renderCalendarModule();
        loadCalendarData();
      });
  
      panel.querySelector('#sod-cal-tab-list')?.addEventListener('click', e => {
        const btn = e.target.closest('.sod-m-tab[data-cal-tab]');
        if (!btn) return;
        _calState.tab = btn.dataset.calTab;
        _calState.sectionSorts = {};
        _calState.sections = null;
        _calState.events = [];
        _calState.loaded = false;
        renderCalendarModule();
        loadCalendarData();
      });
      panel.dataset.shellReady = '1';
      return panel;
    }
  
    function renderCalendarModule() {
      const panel = _ensureCalendarModuleShell();
      if (!panel) return;
      const chrome = _buildCalendarMiniGridHTML();
      const searchInput = panel.querySelector('#sod-cal-search');
      if (searchInput && searchInput.value !== _calState.searchFilter) searchInput.value = _calState.searchFilter;
      const monthLabel = panel.querySelector('#sod-cal-month-label');
      if (monthLabel) monthLabel.textContent = chrome.monthLabel;
      const mini = panel.querySelector('#sod-cal-mini');
      if (mini) mini.innerHTML = chrome.gridHtml;
      const tabList = panel.querySelector('#sod-cal-tab-list');
      if (tabList) tabList.innerHTML = _buildCalendarTabsHTML();
      const dateLabel = panel.querySelector('#sod-cal-date-label');
      if (dateLabel) dateLabel.textContent = chrome.dateLabel;
      renderCalendarEvents();
    }
  
    const SECTION_COLORS = {
      Economic: '#FF9500', Earnings: '#34C759', Dividends: '#5AC8FA',
      Splits: '#AF52DE', 'Conference Calls': '#FF2D55', RatingChanges: '#5856D6',
      'Rating Changes': '#5856D6', 'Schwab Equity Ratings Upgrades': '#5856D6',
      'Schwab Equity Ratings Downgrades': '#5856D6',
    };
  
    const TAB_COLORS = {
      TodaysEvents: '#007AFF', Economic: '#FF9500', Earnings: '#34C759',
      Dividends: '#5AC8FA', Splits: '#AF52DE', 'Conference Calls': '#FF2D55', RatingChanges: '#5856D6',
    };
  
    function _buildSectionTable(sec, filter, secIdx) {
      const color = SECTION_COLORS[sec.section] || TAB_COLORS[_calState.tab] || COLORS.blue;
      let rows = sec.rows;
      if (filter) {
        rows = rows.filter(r => r.some(c => c.toLowerCase().includes(filter)));
      }
      if (rows.length === 0) return '';
  
      const sortState = _calState.sectionSorts[secIdx];
      const badge = `<div style="display:flex;align-items:center;gap:6px;margin:8px 0 4px">
        <span style="background:${color};color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px">${sec.section || 'Events'}</span>
        <span style="font-size:9px;color:var(--text3)">${rows.length} ${t('market.items')}</span>
      </div>`;
  
      const hdrRow = sec.headers.length
        ? `<thead><tr>${sec.headers.map((h, i) => `<th data-sort-col="${i}" data-section-idx="${secIdx}" style="padding:4px 5px;font-size:9px;font-weight:700;color:var(--text3);text-align:left;border-bottom:2px solid ${color}40;white-space:nowrap;cursor:pointer;user-select:none">${h}${sortState?.col === i ? (sortState.asc ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>`
        : '';
  
      const bodyHTML = rows.map(cells =>
        `<tr>${cells.map((c, i) => {
          const isSymbol = i === 0 && c && /^[A-Z]{1,5}$/.test(c);
          const symAttr = isSymbol ? ` class="sod-clickable-sym" data-chart-sym="${c}"` : '';
          const style = `padding:3px 5px;font-size:10px;border-bottom:1px solid var(--border);${i === 0 && c ? 'font-weight:600;color:' + color : ''}`;
          return `<td style="${style}"${symAttr}>${c}</td>`;
        }).join('')}</tr>`
      ).join('');
  
      return `${badge}<table style="width:100%;border-collapse:collapse">${hdrRow}<tbody>${bodyHTML}</tbody></table>`;
    }
  
    function buildCalendarEventsHTML() {
      const filter = _calState.searchFilter?.toLowerCase() || '';
  
      if (_calState.sections?.length) {
        const parts = _calState.sections.map((sec, idx) => _buildSectionTable(sec, filter, idx)).filter(Boolean);
        return parts.length ? parts.join('') : `<div style="text-align:center;padding:20px;color:var(--text3);font-size:11px">${t('market.noMatchingEvents')}</div>`;
      }
  
      const evts = filter
        ? _calState.events.filter(e => (e.symbol + ' ' + e.detail).toLowerCase().includes(filter))
        : _calState.events;
      if (evts.length) {
        return evts.map(e => `<div class="sod-cal-event">${e.symbol ? `<span class="sod-cal-event-sym sod-clickable-sym" data-chart-sym="${e.symbol}">${e.symbol}</span>` : ''}<span class="sod-cal-event-detail">${e.detail}</span></div>`).join('');
      }
      if (_calState.loaded) {
        return `<div style="text-align:center;padding:20px;color:var(--text3);font-size:11px">${t('market.noEventsForDate')}</div>`;
      }
      return `<div style="text-align:center;padding:20px;color:var(--text3);font-size:11px"><span class="sod-loading" style="border-color:rgba(0,122,255,0.3);border-top-color:#007AFF;margin-right:6px;vertical-align:middle"></span>${t('market.loadingEvents')}</div>`;
    }
  
    function renderCalendarEvents() {
      const panel = _root.querySelector('#sod-market-calendar');
      if (!panel) return;
      const eventsDiv = panel.querySelector('.sod-cal-events');
      if (!eventsDiv) return;
      eventsDiv.innerHTML = buildCalendarEventsHTML();
      _attachCalSortHandlers(eventsDiv);
      _attachCalSymClickHandlers(eventsDiv);
    }
  
    function _attachCalSymClickHandlers(container) {
      container.querySelectorAll('.sod-clickable-sym[data-chart-sym]').forEach(el => {
        el.addEventListener('click', e => {
          e.stopPropagation();
          showSymbolInIndices(el.dataset.chartSym);
        });
      });
    }
  
    function _attachCalSortHandlers(container) {
      container.querySelectorAll('th[data-sort-col]').forEach(th => {
        th.addEventListener('click', () => {
          const col = parseInt(th.dataset.sortCol);
          const secIdx = parseInt(th.dataset.sectionIdx);
          if (isNaN(secIdx) || !_calState.sections?.[secIdx]) return;
  
          const prev = _calState.sectionSorts[secIdx];
          const asc = prev?.col === col ? !prev.asc : true;
          _calState.sectionSorts[secIdx] = { col, asc };
  
          _calState.sections[secIdx].rows.sort((a, b) => {
            const va = (a[col] || '').toLowerCase();
            const vb = (b[col] || '').toLowerCase();
            const na = parseFloat(va.replace(/[$,%]/g, ''));
            const nb = parseFloat(vb.replace(/[$,%]/g, ''));
            if (!isNaN(na) && !isNaN(nb)) return asc ? na - nb : nb - na;
            return asc ? va.localeCompare(vb) : vb.localeCompare(va);
          });
          renderCalendarEvents();
        });
      });
    }
  
    async function loadCalendarData() {
      _calState.loaded = false;
      renderCalendarEvents();
      try {
        const oa = dateToOA(_calState.selectedDate);
        const tabKey = _calState.tab;
        const sections = await _fetchCalendarSectionsCached(tabKey, oa);
        if (_calState.tab !== tabKey || dateToOA(_calState.selectedDate) !== oa) return;
        if (sections) {
          _calState.sections = sections;
          _calState.events = [];
        } else {
          _calState.sections = null;
          _calState.events = [];
        }
        _calState.loaded = true;
        renderCalendarEvents();
      } catch (e) {
        console.error(TAG, 'Calendar load error:', e);
        _calState.sections = null;
        _calState.events = [{ symbol: '', detail: 'Failed to load: ' + e.message, time: '' }];
        _calState.loaded = true;
        renderCalendarEvents();
      }
    }
  
    /* ══════════════════════════════════════════════
       MODULE 3: BREAKING NEWS
    ══════════════════════════════════════════════ */
  
    let _newsState = { allArticles: [], sourceFilter: 'all', searchQuery: '', sources: [], loading: false, hasMore: true };
  
    const _newsSourcePalette = ['#FF9500','#34C759','#5AC8FA','#AF52DE','#FF2D55','#5856D6','#E85D75','#E67E22','#16A085','#C0392B','#2980B9','#D35400','#6C3483','#229954','#CA6F1E','#2E86C1'];
    const _newsSourceColorMap = { 'Associated Press': '#AF52DE', 'Reuters': '#66BB6A' };
    let _newsSourceColorIdx = 0;
    function _newsSourceColor(src) {
      if (!_newsSourceColorMap[src]) {
        _newsSourceColorMap[src] = _newsSourcePalette[_newsSourceColorIdx % _newsSourcePalette.length];
        _newsSourceColorIdx++;
      }
      return _newsSourceColorMap[src];
    }
  
    function _getFilteredNewsArticles() {
      return _newsState.allArticles.filter(a => {
        const matchSource = _newsState.sourceFilter === 'all' || a.source === _newsState.sourceFilter;
        const matchSearch = !_newsState.searchQuery ||
          (a.headline + ' ' + a.teaser).toLowerCase().includes(_newsState.searchQuery.toLowerCase());
        return matchSource && matchSearch;
      });
    }
  
    function _renderNewsList() {
      const panel = _root.querySelector('#sod-market-news');
      if (!panel) return;
      const listEl = panel.querySelector('.sod-news-list');
      if (!listEl) return;
      const filtered = _getFilteredNewsArticles();
      const newsHTML = filtered.length
        ? filtered.map((a, idx) => {
            const timeStr = a.date || '';
            const sc = _newsSourceColor(a.source || 'News');
            return `<div class="sod-news-item" data-news-idx="${idx}" ${a.docKey ? `data-dockey="${a.docKey}"` : ''}>
              <div class="sod-news-meta"><span class="sod-news-source" style="color:${sc};background:${sc}18">${a.source}</span><span class="sod-news-time">${timeStr}</span></div>
              <div class="sod-news-headline">${a.headline}</div>
              <div class="sod-news-teaser">${a.teaser || ''}</div>
              <div class="sod-news-full" style="display:none"></div>
            </div>`;
          }).join('')
        : `<div style="text-align:center;padding:20px;color:var(--text3);font-size:11px">${t('market.noNewsFound')}</div>`;
  
      const loadMoreHTML = filtered.length && _newsState.hasMore
        ? `<div style="text-align:center;padding:8px 0">
            <button class="sod-m-btn sod-m-btn-primary" id="sod-news-loadmore" style="width:100%;justify-content:center;padding:6px" ${_newsState.loading ? 'disabled' : ''}>
              ${_newsState.loading ? '<span class="sod-loading"></span> ' + t('market.loading') : t('market.loadMore')}
            </button>
          </div>`
        : '';
      listEl.innerHTML = `${newsHTML}${loadMoreHTML}`;
    }
  
    function _renderNewsControls() {
      const panel = _root.querySelector('#sod-market-news');
      if (!panel) return;
      const searchInput = panel.querySelector('#sod-news-search');
      if (searchInput && document.activeElement !== searchInput && searchInput.value !== _newsState.searchQuery) {
        searchInput.value = _newsState.searchQuery;
      }
      const sourceSelect = panel.querySelector('#sod-news-source');
      if (!sourceSelect) return;
      const sourceOpts = ['all', ..._newsState.sources].map(s =>
        `<option value="${s}" ${_newsState.sourceFilter === s ? 'selected' : ''}>${s === 'all' ? t('market.allSources') : s}</option>`
      ).join('');
      sourceSelect.innerHTML = sourceOpts;
      sourceSelect.value = _newsState.sourceFilter;
    }
  
    function _ensureNewsModuleShell() {
      const panel = _root.querySelector('#sod-market-news');
      if (!panel) return null;
      if (panel.dataset.shellReady === '1') return panel;
      panel.innerHTML = `
        <div class="sod-card-title sod-card-title-news"><span class="material-icons sod-card-icon">feed</span>${t('market.breakingNews')}</div>
        <div class="sod-m-controls">
          <input class="sod-m-input" id="sod-news-search" placeholder="${t('market.searchNews')}" autocomplete="off" style="flex:1;min-width:80px"/>
          <select class="sod-m-select" id="sod-news-source"></select>
          <button class="sod-m-btn sod-m-btn-primary" id="sod-news-refresh"><span class="material-icons" style="font-size:12px">refresh</span></button>
        </div>
        <div class="sod-news-list"></div>
      `;
      panel.querySelector('#sod-news-search')?.addEventListener('input', e => {
        _newsState.searchQuery = e.target.value;
        _renderNewsList();
      });
      panel.querySelector('#sod-news-source')?.addEventListener('change', e => {
        _newsState.sourceFilter = e.target.value;
        _renderNewsList();
      });
      panel.querySelector('#sod-news-refresh')?.addEventListener('click', loadNewsData);
      panel.querySelector('.sod-news-list')?.addEventListener('click', (e) => {
        const loadMoreBtn = e.target.closest('#sod-news-loadmore');
        if (loadMoreBtn) {
          loadMoreNews();
          return;
        }
        const item = e.target.closest('.sod-news-item');
        if (!item || e.target.closest('a')) return;
        const fullDiv = item.querySelector('.sod-news-full');
        const teaserDiv = item.querySelector('.sod-news-teaser');
        const isExpanded = item.classList.contains('expanded');
        if (isExpanded) {
          item.classList.remove('expanded');
          if (fullDiv) fullDiv.style.display = 'none';
          if (teaserDiv) teaserDiv.style.display = '';
          return;
        }
        item.classList.add('expanded');
        const docKey = item.dataset.dockey;
        if (docKey && fullDiv && !fullDiv.dataset.loaded) {
          fullDiv.style.display = 'block';
          fullDiv.innerHTML = `<div style="padding:6px 0;color:var(--text3);font-size:10px">${t('market.loadingArticle')}</div>`;
          if (teaserDiv) teaserDiv.style.display = 'none';
          fetchNewsStory(docKey).then(fullHtml => {
            fullDiv.innerHTML = fullHtml;
            fullDiv.dataset.loaded = 'true';
          }).catch(err => {
            console.warn(TAG, 'Failed to load story:', err);
            fullDiv.innerHTML = '';
            fullDiv.style.display = 'none';
            if (teaserDiv) teaserDiv.style.display = '';
          });
        } else if (fullDiv?.dataset.loaded) {
          fullDiv.style.display = 'block';
          if (teaserDiv) teaserDiv.style.display = 'none';
        }
      });
      panel.dataset.shellReady = '1';
      return panel;
    }
  
    function renderNewsModule() {
      const panel = _ensureNewsModuleShell();
      if (!panel) return;
      _renderNewsControls();
      _renderNewsList();
    }
  
    async function loadNewsData() {
      try {
        const applyArticles = (articles) => {
          _newsState.allArticles = articles.filter(a => !_isTraditionalChinese(a.headline || ''));
          _newsState.hasMore = articles.length >= 5;
          const srcSet = new Set(articles.map(a => a.source).filter(Boolean));
          _newsState.sources = [...srcSet].sort();
          renderNewsModule();
        };
  
        if (_isOnIBKR()) {
          // IBKR cross-site mode: render quick headlines first, then upgrade to richer F2 payload.
          const richPromise = fetchNewsViaF2();
          let hasQuickData = false;
          try {
            const quick = await fetchNewsHeadlines(10, 0);
            const quickArticles = (quick.news || []).map(a => ({ ...a, docKey: a.docKey || '' }));
            if (quickArticles.length) {
              applyArticles(quickArticles);
              hasQuickData = true;
            }
          } catch (quickErr) {
            console.warn(TAG, 'Headlines quick path failed on IBKR:', quickErr);
          }
          try {
            const richArticles = await richPromise;
            if (richArticles?.length) applyArticles(richArticles);
            else if (!hasQuickData) applyArticles([]);
            return;
          } catch (richErr) {
            if (hasQuickData) return;
            throw richErr;
          }
        }
  
        let articles = [];
        try {
          articles = await fetchNewsViaF2();
        } catch (e) {
          console.warn(TAG, 'F2 news failed, falling back to headlines API:', e);
          const data = await fetchNewsHeadlines(10, 0);
          articles = (data.news || []).map(a => ({ ...a, docKey: '' }));
        }
        applyArticles(articles);
      } catch (e) {
        console.error(TAG, 'News load error:', e);
        showToast('Failed to load news: ' + e.message, 'error');
      }
    }
  
    async function loadMoreNews() {
      if (_newsState.loading) return;
      _newsState.loading = true;
      renderNewsModule();
      try {
        const batchSize = 10;
        const start = _newsState.allArticles.length;
        let newArticles = [];
        try {
          newArticles = await fetchNewsSearch(batchSize, start);
        } catch (e) {
          console.warn(TAG, 'News search fallback to headlines:', e);
          const data = await fetchNewsHeadlines(batchSize, start);
          newArticles = (data.news || []).map(a => ({ ...a, docKey: a.docKey || '' }));
        }
        if (newArticles.length === 0) {
          _newsState.hasMore = false;
          showToast(t('toast.noMoreNews'), 'info');
        } else {
          const existingKeys = new Set(_newsState.allArticles.map(a => a.headline));
          const dedupedArticles = newArticles.filter(a => !existingKeys.has(a.headline) && !_isTraditionalChinese(a.headline || ''));
          if (dedupedArticles.length === 0) {
            _newsState.hasMore = false;
            showToast(t('toast.noMoreArticles'), 'info');
          } else {
            _newsState.allArticles = [..._newsState.allArticles, ...dedupedArticles];
            _newsState.hasMore = newArticles.length >= batchSize;
            const srcSet = new Set(_newsState.allArticles.map(a => a.source).filter(Boolean));
            _newsState.sources = [...srcSet].sort();
          }
        }
      } catch (e) {
        console.error(TAG, 'Load more news error:', e);
        showToast('Failed to load more news: ' + e.message, 'error');
      } finally {
        _newsState.loading = false;
        renderNewsModule();
      }
    }
  
    /* ══════════════════════════════════════════════
       MODULE 4: COMPANY MOVERS
    ══════════════════════════════════════════════ */
  
    let _moversState = {
      rankingType: 'MostActive', exchange: 'all', sector: 'all',
      movers: [], config: null, sortCol: 'volume', sortAsc: false,
    };
  
    function renderMoversModule() {
      const panel = _root.querySelector('#sod-market-movers');
      if (!panel) return;
  
      const cfg = _moversState.config || {};
      const rankOpts = (cfg.rankingSets || [{ displayName: 'Most Actives', field: 'MostActive' }])
        .map(r => `<option value="${r.field}" ${_moversState.rankingType === r.field ? 'selected' : ''}>${r.displayName}</option>`).join('');
      const exchOpts = (cfg.exchanges || [{ shortName: 'All Exchanges', field: 'all' }])
        .map(e => `<option value="${e.field}" ${_moversState.exchange === e.field ? 'selected' : ''}>${e.shortName}</option>`).join('');
      const sectorOpts = (cfg.sectors || [{ displayName: 'All Sectors', field: 'all' }])
        .map(s => `<option value="${s.field}" ${_moversState.sector === s.field ? 'selected' : ''}>${s.displayName}</option>`).join('');
  
      let sorted = [..._moversState.movers];
      const col = _moversState.sortCol;
      sorted.sort((a, b) => {
        let va = a[col], vb = b[col];
        if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
        if (va < vb) return _moversState.sortAsc ? -1 : 1;
        if (va > vb) return _moversState.sortAsc ? 1 : -1;
        return 0;
      });
  
      const rows = sorted.map(m => {
        const chg = m.priceChange || 0;
        const chgPct = m.priceChangePercent || 0;
        const chgColor = chg >= 0 ? COLORS.green : COLORS.red;
        const lo = m.priceLow52Week || 0;
        const hi = m.priceHigh52Week || 1;
        const pct = hi > lo ? ((m.priceLast - lo) / (hi - lo)) * 100 : 50;
        return `<tr>
          <td class="sod-movers-sym sod-clickable-sym" data-chart-sym="${m.symbol}">${m.symbol}</td>
          <td style="max-width:100px;overflow:hidden;text-overflow:ellipsis">${m.companyName}</td>
          <td>${m.ser || '—'}</td>
          <td>$${(m.priceLast || 0).toFixed(2)}</td>
          <td style="color:${chgColor}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)} (${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(2)}%)</td>
          <td style="white-space:nowrap"><span style="font-size:9px;color:var(--text3)">$${lo.toFixed(0)}</span> <div class="sod-range-bar" style="display:inline-block;width:40px;vertical-align:middle"><div class="sod-range-dot" style="left:${Math.max(0, Math.min(100, pct))}%"></div></div> <span style="font-size:9px;color:var(--text3)">$${hi.toFixed(0)}</span></td>
          <td>${fmtNum(m.volume, true)}</td>
        </tr>`;
      }).join('');
  
      const sortIcon = col2 => _moversState.sortCol === col2 ? (_moversState.sortAsc ? ' ▲' : ' ▼') : '';
  
      panel.innerHTML = `
        <div class="sod-card-title sod-card-title-movers"><span class="material-icons sod-card-icon">trending_up</span>${t('market.companyMovers')}</div>
        <div class="sod-m-controls">
          <select class="sod-m-select" id="sod-movers-rank">${rankOpts}</select>
          <select class="sod-m-select" id="sod-movers-exch">${exchOpts}</select>
          <select class="sod-m-select" id="sod-movers-sector">${sectorOpts}</select>
        </div>
        <div class="sod-movers-wrap">
          <table class="sod-movers-table">
            <thead><tr>
              <th data-sort="symbol">${t('market.symbol')}${sortIcon('symbol')}</th>
              <th data-sort="companyName">${t('market.company')}${sortIcon('companyName')}</th>
              <th data-sort="ser">SER${sortIcon('ser')}</th>
              <th data-sort="priceLast">${t('market.price')}${sortIcon('priceLast')}</th>
              <th data-sort="priceChangePercent">${t('market.change')}${sortIcon('priceChangePercent')}</th>
              <th>${t('market.52wRange')}</th>
              <th data-sort="volume">${t('market.volume')}${sortIcon('volume')}</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
  
      panel.querySelector('#sod-movers-rank')?.addEventListener('change', e => { _moversState.rankingType = e.target.value; loadMoversData(); });
      panel.querySelector('#sod-movers-exch')?.addEventListener('change', e => { _moversState.exchange = e.target.value; loadMoversData(); });
      panel.querySelector('#sod-movers-sector')?.addEventListener('change', e => { _moversState.sector = e.target.value; loadMoversData(); });
  
      panel.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
          const col2 = th.dataset.sort;
          if (_moversState.sortCol === col2) _moversState.sortAsc = !_moversState.sortAsc;
          else { _moversState.sortCol = col2; _moversState.sortAsc = true; }
          renderMoversModule();
        });
      });
  
      panel.querySelectorAll('.sod-clickable-sym[data-chart-sym]').forEach(el => {
        el.addEventListener('click', e => {
          e.stopPropagation();
          showSymbolInIndices(el.dataset.chartSym);
        });
      });
    }
  
    async function loadMoversData() {
      try {
        const data = await fetchCompanyMovers(_moversState.exchange, _moversState.rankingType, _moversState.sector);
        _moversState.movers = data.companyMovers || [];
        _moversState.config = data.config || _moversState.config;
        renderMoversModule();
      } catch (e) {
        console.error(TAG, 'Movers load error:', e);
        showToast('Failed to load movers: ' + e.message, 'error');
      }
    }
  
    /* ══════════════════════════════════════════════
       MODULE 5: AI Market Analysis (OpenAI + Gemini)
    ══════════════════════════════════════════════ */
  
    const AI_SETTINGS_KEY = 'schwab_opt_ai_settings';
    function _loadAISettings() {
      try {
        const raw = _xGet(AI_SETTINGS_KEY, null);
        if (raw) return typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {}
      return {};
    }
    function _saveAISettings() {
      try {
        const payload = JSON.stringify({
          apiKey: _aiState.apiKey,
          geminiApiKey: _aiState.geminiApiKey,
          apiModel: _aiState.apiModel,
          thinking: _aiState.thinking,
          webSearch: _aiState.webSearch,
          dataSources: _aiState.dataSources,
        });
        _xSet(AI_SETTINGS_KEY, payload);
      } catch {}
    }
    const _savedAI = _loadAISettings();
    let _aiState = {
      generating: false, output: '', lastPrompt: '',
      apiKey: _savedAI.apiKey || '',
      geminiApiKey: _savedAI.geminiApiKey || '',
      apiModel: _savedAI.apiModel || 'gpt-5-mini',
      thinking: _savedAI.thinking ?? true,
      webSearch: _savedAI.webSearch ?? true,
      dataSources: _savedAI.dataSources ?? { indices: true, calendar: true, news: true, movers: true },
    };
  
    function _isGeminiModel(model) { return model?.startsWith('gemini-'); }
    function _getActiveApiKey() { return _isGeminiModel(_aiState.apiModel) ? _aiState.geminiApiKey : _aiState.apiKey; }
    function _isAIReady() { return !!_getActiveApiKey(); }
  
    const AI_MODELS = [
      { id: 'gpt-5-mini', label: 'GPT-5 Mini' }, { id: 'gpt-5.2', label: 'GPT-5.2' }, { id: 'gpt-5.2-pro', label: 'GPT-5.2 Pro' },
      { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' }, { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
    ];
    const AI_DISCLOSURE_TOGGLE_TEXT_STYLE = 'font-size:11px;line-height:1.35';
    const AI_DISCLOSURE_BODY_TEXT_STYLE = 'font-size:10px;line-height:1.45';
  
    function _resolveAIPanelOutputEl(ctx, fallbackEl = null) {
      const liveEl = ctx?.panelEl?.querySelector?.(`.sod-ai-output-${ctx.uid}`);
      if (liveEl) return liveEl;
      if (fallbackEl && document.contains(fallbackEl)) return fallbackEl;
      return fallbackEl || null;
    }
  
    function _isAIPanelVisible(ctx, targetEl) {
      if (!targetEl || !document.contains(targetEl)) return false;
      if (document.visibilityState !== 'visible') return false;
      if (_root?.style?.display === 'none') return false;
      if (!ctx?.uid) return true;
      const tabByUid = { market: 'market', stock: 'stock' };
      const requiredTab = tabByUid[ctx.uid];
      if (requiredTab && _state.activeTab !== requiredTab) return false;
      const page = targetEl.closest('.sod-page');
      if (page && !page.classList.contains('active')) return false;
      return true;
    }
  
    async function _runAIStream(prompt, outputEl, ctx = null) {
      if (_isGeminiModel(_aiState.apiModel)) {
        await _runGeminiStream(prompt, outputEl, ctx);
      } else {
        await _runOpenAIStream(prompt, outputEl, ctx);
      }
    }
  
    function _renderAIPanel(panelEl, ctx) {
      if (!panelEl) return;
      const modelOpts = AI_MODELS.map(m => `<option value="${m.id}" ${_aiState.apiModel === m.id ? 'selected' : ''}>${m.label}</option>`).join('');
      const activeKey = _getActiveApiKey();
      const statusCls = activeKey ? 'ok' : 'err';
      const statusTxt = activeKey ? t('ai.apiKeySet') : t('ai.setApiKey');
      const uid = ctx.uid;
  
      const srcBtnsHTML = ctx.dataSources ? ctx.dataSources.map(s => {
        const on = ctx.state.dataSources[s.key];
        return `<button class="sod-m-btn sod-ai-src-btn-${uid}" data-src="${s.key}" style="font-size:10px;padding:4px 8px;border-radius:8px;border:1px solid ${on ? s.color : 'var(--border)'};${on ? 'background:' + s.color + ';color:#fff' : 'background:transparent;color:var(--text2)'}">
          <span class="material-icons" style="font-size:12px;vertical-align:-2px">${s.icon}</span> ${s.label}
        </button>`;
      }).join('') : '';
  
      const promptHTML = ctx.state.lastPrompt
        ? `<div style="margin:6px 0"><div class="sod-ai-prompt-toggle-${uid}" style="${AI_DISCLOSURE_TOGGLE_TEXT_STYLE};color:${COLORS.teal};cursor:pointer;user-select:none;display:flex;align-items:center;gap:3px"><span class="material-icons" style="font-size:13px">data_object</span> <span>▸ ${t('ai.showPrompt')}</span></div><div class="sod-ai-prompt-box-${uid}" style="display:none;${AI_DISCLOSURE_BODY_TEXT_STYLE};color:var(--text2);border-left:2px solid ${COLORS.teal};padding:4px 8px;margin-top:4px;max-height:180px;overflow-y:auto;white-space:pre-wrap;word-break:break-word">${ctx.state.lastPrompt.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div></div>`
        : '';
  
      panelEl.innerHTML = `
        <div class="${ctx.titleClass}"><span class="material-icons sod-card-icon">auto_awesome</span>${ctx.title}</div>
        <div class="sod-ai-top-row">
          <div class="sod-ai-status ${statusCls}" style="flex:1;margin:0;padding:5px 8px">${statusTxt}</div>
          <select class="sod-m-select sod-ai-model-${uid} sod-ai-model-select">${modelOpts}</select>
        </div>
        <div class="sod-ai-control-row">
          ${srcBtnsHTML}
          ${srcBtnsHTML ? `<span style="width:1px;height:20px;background:var(--border);flex-shrink:0;margin:0 1px"></span>` : ''}
          <button class="sod-m-btn ${_aiState.thinking ? 'sod-m-btn-primary' : ''} sod-ai-thinking-${uid}" style="font-size:10px;padding:4px 8px;border:1px solid ${_aiState.thinking ? COLORS.blue : 'var(--border)'};border-radius:8px">
            <span class="material-icons" style="font-size:12px;vertical-align:-2px">psychology</span> ${t('ai.think')}
          </button>
          <button class="sod-m-btn ${_aiState.webSearch ? 'sod-m-btn-primary' : ''} sod-ai-websearch-${uid}" style="font-size:10px;padding:4px 8px;border:1px solid ${_aiState.webSearch ? COLORS.blue : 'var(--border)'};border-radius:8px">
            <span class="material-icons" style="font-size:12px;vertical-align:-2px">travel_explore</span> ${t('ai.search')}
          </button>
        </div>
        <button class="sod-m-btn sod-m-btn-primary sod-ai-analyze-${uid}" style="width:100%;justify-content:center;padding:6px;margin-bottom:6px" ${ctx.state.generating ? 'disabled' : ''}>
          ${ctx.state.generating ? '<span class="sod-loading"></span> ' + t('ai.generating') : '<span class="material-icons" style="font-size:14px">auto_awesome</span> ' + ctx.analyzeLabel}
        </button>
        ${promptHTML}
        <div class="sod-ai-output sod-ai-output-${uid}">${ctx.state.output || `<div style="text-align:center;padding:20px;color:var(--text3)">${ctx.emptyText}</div>`}</div>
      `;
  
      panelEl.querySelector(`.sod-ai-model-${uid}`)?.addEventListener('change', e => {
        _aiState.apiModel = e.target.value; _saveAISettings(); ctx.onRender();
      });
      panelEl.querySelector(`.sod-ai-thinking-${uid}`)?.addEventListener('click', () => {
        _aiState.thinking = !_aiState.thinking; _saveAISettings(); ctx.onRender();
      });
      panelEl.querySelector(`.sod-ai-websearch-${uid}`)?.addEventListener('click', () => {
        _aiState.webSearch = !_aiState.webSearch; _saveAISettings(); ctx.onRender();
      });
      panelEl.querySelectorAll(`.sod-ai-src-btn-${uid}`).forEach(btn => {
        btn.addEventListener('click', () => {
          ctx.state.dataSources[btn.dataset.src] = !ctx.state.dataSources[btn.dataset.src];
          if (ctx.onSaveDataSources) ctx.onSaveDataSources();
          ctx.onRender();
        });
      });
      panelEl.querySelector(`.sod-ai-analyze-${uid}`)?.addEventListener('click', ctx.onAnalyze);
      panelEl.querySelector(`.sod-ai-prompt-toggle-${uid}`)?.addEventListener('click', () => {
        const box = panelEl.querySelector(`.sod-ai-prompt-box-${uid}`);
        const toggle = panelEl.querySelector(`.sod-ai-prompt-toggle-${uid} span:last-child`);
        if (box) { const show = box.style.display === 'none'; box.style.display = show ? 'block' : 'none'; if (toggle) toggle.textContent = show ? '▾ ' + t('ai.hidePrompt') : '▸ ' + t('ai.showPrompt'); }
      });
      panelEl.querySelector(`.sod-ai-output-${uid}`)?.addEventListener('click', (e) => {
        const target = e.target instanceof Element ? e.target : e.target?.parentElement;
        if (!target) return;
        const toggleEl = target.closest('.sod-ai-thinking-toggle');
        if (!toggleEl) return;
        const w = toggleEl.closest('.sod-ai-thinking-wrap');
        if (!w) return;
        const c = w.querySelector('.sod-ai-thinking-body');
        if (!c) return;
        const show = c.style.display === 'none' || getComputedStyle(c).display === 'none';
        c.style.display = show ? 'block' : 'none';
        const label = toggleEl.querySelector('span:last-child');
        if (label) label.textContent = show ? '▾ ' + t('ai.hideThinking') : '▸ ' + t('ai.showThinking');
      });
    }
  
    async function _runAIPanelAnalysis(ctx) {
      if (ctx.state.generating) return;
      if (!_isAIReady()) { showToast(t('toast.setApiKeyFirst'), 'warn'); return; }
  
      ctx.state.generating = true;
      ctx.state.output = '';
      const prompt = ctx.buildPrompt();
      ctx.state.lastPrompt = prompt;
      ctx.onRender();
  
      const outputEl = ctx.panelEl?.querySelector(`.sod-ai-output-${ctx.uid}`);
      const modelLabel = _aiState.apiModel;
      const modeLabel = [_aiState.thinking ? 'Thinking' : '', _aiState.webSearch ? 'Web Search' : ''].filter(Boolean).join(' + ') || 'Standard';
      const streamingHTML = `<div style="color:var(--text3)"><span class="sod-loading" style="border-color:rgba(0,122,255,0.3);border-top-color:#007AFF"></span> ${modeLabel} · ${modelLabel} · ${t('ai.streaming')}</div>`;
      ctx.state.output = streamingHTML;
      if (outputEl) outputEl.innerHTML = streamingHTML;
  
      try {
        await _runAIStream(prompt, outputEl, ctx);
        ctx.state.output = ctx.state.output || outputEl?.innerHTML || '';
      } catch (e) {
        console.error(TAG, `AI (${ctx.uid}) error:`, e);
        ctx.state.output = `<div style="color:${COLORS.red}">Error: ${e.message}</div>`;
      } finally {
        ctx.state.generating = false;
        ctx.onRender();
      }
    }
  
    const _marketAICtx = {
      uid: 'market',
      titleClass: 'sod-card-title sod-card-title-ai',
      state: _aiState,
      panelEl: null,
      dataSources: [
        { key: 'indices', icon: 'show_chart', color: '#FF6384' },
        { key: 'calendar', icon: 'event', color: COLORS.indigo },
        { key: 'news', icon: 'feed', color: COLORS.orange },
        { key: 'movers', icon: 'trending_up', color: COLORS.green },
      ],
      buildPrompt: () => buildMarketPrompt(),
      onRender: () => renderAIModule(),
      onSaveDataSources: () => _saveAISettings(),
    };
    _marketAICtx.onAnalyze = () => _runAIPanelAnalysis(_marketAICtx);
  
    function renderAIModule() {
      const panel = _root.querySelector('#sod-market-ai');
      if (!panel) return;
      _marketAICtx.panelEl = panel;
      _marketAICtx.title = t('ai.title');
      _marketAICtx.analyzeLabel = t('ai.analyzeMarket');
      _marketAICtx.emptyText = t('ai.clickAnalyze');
      _marketAICtx.dataSources[0].label = t('market.indices');
      _marketAICtx.dataSources[1].label = t('market.calendar');
      _marketAICtx.dataSources[2].label = getSavedLang() === 'zh' ? '新闻' : 'News';
      _marketAICtx.dataSources[3].label = getSavedLang() === 'zh' ? '异动' : 'Movers';
      _renderAIPanel(panel, _marketAICtx);
    }
  
    function buildMarketPrompt() {
      const parts = [];
      const isZh = getSavedLang() === 'zh';
      if (isZh) {
        parts.push('你是一位资深金融分析师。请分析以下来自用户当前仪表盘的实时美股市场数据，生成一份全面而简洁的市场快照报告。请使用中文撰写报告。使用 Markdown 格式，包含 ## 标题和项目符号。使用水平分割线 (---) 分隔各主要部分以提高可读性。\n');
      } else {
        parts.push('You are a senior financial analyst. Analyze the following live US market data from the user\'s current dashboard view. Produce a comprehensive but concise market snapshot report. Use markdown formatting with ## headers and bullet points. Separate each major section with a horizontal rule (---) for readability.\n');
      }
  
      const ds = _aiState.dataSources;
  
      // 1. Indices — use actual displayed data
      if (ds.indices && _indicesState.mode === 'region' && _state.marketIndicesData?.quotesHistory) {
        parts.push(`## Indices (Region: ${_indicesState.region}, Period: ${_indicesState.period})`);
        _state.marketIndicesData.quotesHistory.forEach(qh => {
          const lq = qh.lastQuote;
          if (!lq) return;
          const history = qh.quoteHistory || [];
          const first = history[0], last = history[history.length - 1];
          parts.push(`- **${lq.name}** (${lq.symbol}): ${lq.value?.toFixed(2)} | Day Change: ${lq.changePercent?.toFixed(2)}% | Status: ${lq.marketStatus}`);
          if (first && last) parts.push(`  Period range: ${first.value?.toFixed(2)} → ${last.value?.toFixed(2)} (${((last.value - first.value) / first.value * 100).toFixed(2)}%)`);
        });
      } else if (ds.indices && _indicesState.mode === 'individual' && _indicesState.selectedSymbols.length) {
        parts.push(`## Individual Symbols (${_indicesState.selectedSymbols.join(', ')}, Period: ${_indicesState.period})`);
        parts.push('(User is tracking these specific symbols on the Indices chart)');
      }
  
      // 2. Calendar — current tab and visible events
      if (ds.calendar && _calState.sections?.length) {
        parts.push(`\n## Calendar (${_calState.tab}, Date: ${_calState.selectedDate.toLocaleDateString('en-US')})`);
        _calState.sections.forEach(sec => {
          if (sec.section) parts.push(`### ${sec.section}`);
          if (sec.headers?.length) parts.push(`| ${sec.headers.join(' | ')} |`);
          sec.rows?.slice(0, 8).forEach(r => parts.push(`- ${r.join(' | ')}`));
          if (sec.rows?.length > 8) parts.push(`  ... and ${sec.rows.length - 8} more`);
        });
      }
  
      // 3. Breaking News — all visible headlines
      if (ds.news && _newsState.allArticles?.length) {
        parts.push('\n## Breaking News Headlines');
        _newsState.allArticles.forEach(n => {
          parts.push(`- [${n.source || 'News'}] ${n.headline}`);
        });
      }
  
      // 4. Company Movers — current filter view
      if (ds.movers && _moversState.movers?.length) {
        parts.push(`\n## Company Movers (${_moversState.rankingType}, Exchange: ${_moversState.exchange}, Sector: ${_moversState.sector})`);
        _moversState.movers.forEach(m => {
          parts.push(`- **${m.symbol}** ${m.companyName}: $${m.priceLast?.toFixed(2)} | ${m.priceChangePercent >= 0 ? '+' : ''}${m.priceChangePercent?.toFixed(2)}% | Vol: ${fmtNum(m.volume, true)} | 52W Range: $${m.priceLow52Week?.toFixed(2)}-$${m.priceHigh52Week?.toFixed(2)}`);
        });
      }
  
      const asks = [];
      let askIdx = 0;
      if (isZh) {
        if (ds.indices)  asks.push(`${++askIdx}) **市场概览** — 基于指数数据的整体市场方向、关键水平和驱动因素`);
        if (ds.movers)   asks.push(`${++askIdx}) **重要异动分析** — 特定股票大幅波动的原因、板块影响`);
        if (ds.news)     asks.push(`${++askIdx}) **新闻影响评估** — 突发新闻如何影响市场和情绪`);
        if (ds.calendar) asks.push(`${++askIdx}) **事件与日历展望** — 即将到来的经济事件、财报或催化剂及其预期影响`);
        if (ds.indices || ds.movers) asks.push(`${++askIdx}) **关键板块分析** — 基于现有数据，哪些板块表现优异/不佳`);
        asks.push(`${++askIdx}) **风险因素** — 与所提供数据相关的当前风险和关注点`);
        asks.push(`${++askIdx}) **短期展望** — 下一个交易日/周的预期`);
      } else {
        if (ds.indices)  asks.push(`${++askIdx}) **Market Summary** — overall market direction, key levels, and drivers based on the index data`);
        if (ds.movers)   asks.push(`${++askIdx}) **Notable Movers Analysis** — why specific stocks moved significantly, sector implications`);
        if (ds.news)     asks.push(`${++askIdx}) **News Impact Assessment** — how breaking news headlines affect markets and sentiment`);
        if (ds.calendar) asks.push(`${++askIdx}) **Event & Calendar Outlook** — upcoming economic events, earnings, or catalysts and their expected impact`);
        if (ds.indices || ds.movers) asks.push(`${++askIdx}) **Key Sector Analysis** — which sectors are outperforming/underperforming based on available data`);
        asks.push(`${++askIdx}) **Risk Factors** — current risks and concerns relevant to the data provided`);
        asks.push(`${++askIdx}) **Short-term Outlook** — next trading day/week expectations`);
      }
      parts.push('\n---');
      if (_aiState.webSearch) {
        if (isZh) {
          parts.push('重要：你已启用网络搜索。请使用它查找上述股票代码和新闻标题的最新消息、分析师评论和实时背景。请在行文中使用标准引用格式标注网络来源，以便读者验证。');
        } else {
          parts.push('IMPORTANT: You have web search enabled. Use it to look up the latest news, analyst commentary, and real-time context for the tickers and headlines above. Cite your web sources inline using the standard citation format so the reader can verify.');
        }
      }
      parts.push(isZh ? '基于以上数据，请提供：' : 'Based on the data above, provide:');
      asks.forEach(a => parts.push(a));
      return parts.join('\n');
    }
  
    function renderMarkdown(md) {
      let html = md
        .replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:10px 0">')
        .replace(/^### (.+)$/gm, '<div style="font-size:13.5px;font-weight:700;margin:8px 0 2px;color:var(--text)">$1</div>')
        .replace(/^## (.+)$/gm, '<div style="font-size:15px;font-weight:700;margin:10px 0 3px;color:var(--text)">$1</div>')
        .replace(/^# (.+)$/gm, '<div style="font-size:17px;font-weight:800;margin:12px 0 4px;color:var(--text)">$1</div>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code style="background:var(--tag-bg);padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>')
        .replace(/^ {2,}- (.+)$/gm, '<div style="padding-left:26px;text-indent:-11px;margin:1px 0">• $1</div>')
        .replace(/^- (.+)$/gm, '<div style="padding-left:14px;text-indent:-11px;margin:1px 0">• $1</div>')
        .replace(/^\d+\) (.+)$/gm, (m, p1) => `<div style="padding-left:14px;text-indent:-11px;margin:1px 0">${m.match(/^\d+/)[0]}) ${p1}</div>`)
        .replace(/^\d+\. (.+)$/gm, (m, p1) => `<div style="padding-left:14px;text-indent:-11px;margin:1px 0">${m.match(/^\d+/)[0]}. ${p1}</div>`)
        .replace(/\n{2,}/g, '<div style="height:5px"></div>')
        .replace(/\n/g, '<br>');
      return html
        .replace(/<br>\s*(<div[\s>])/g, '$1').replace(/(<\/div>)\s*<br>/g, '$1')
        .replace(/<br>\s*(<hr[\s/])/g, '$1').replace(/(style="[^"]*">)\s*<br>/g, '$1');
    }
  
    function _buildOpenAIPayload(prompt) {
      const model = _aiState.apiModel || 'gpt-5-mini';
      const payload = {
        model,
        stream: true,
        input: [{ role: 'user', content: prompt }],
      };
      if (_aiState.webSearch) {
        payload.tools = [{ type: 'web_search' }];
      }
      if (_aiState.thinking) {
        payload.reasoning = { effort: 'medium', summary: 'auto' };
      }
      console.log(TAG, 'OpenAI payload:', JSON.stringify(payload, null, 2));
      return payload;
    }
  
    function _buildGeminiPayload(prompt) {
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {},
      };
      if (_aiState.webSearch) {
        payload.tools = [{ google_search: {} }];
      }
      const model = _aiState.apiModel || '';
      const minThinking = model.includes('3-flash') ? 'minimal' : 'low';
      if (_aiState.thinking) {
        payload.generationConfig.thinkingConfig = { thinkingLevel: 'high', includeThoughts: true };
      } else {
        payload.generationConfig.thinkingConfig = { thinkingLevel: minThinking };
      }
      console.log(TAG, 'Gemini payload:', JSON.stringify(payload, null, 2));
      return payload;
    }
  
    function _parseResponsesStreamChunk(line) {
      if (!line.startsWith('data: ')) return null;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') return { done: true };
      try { return JSON.parse(jsonStr); } catch { return null; }
    }
  
    function _applyAnnotations(text, annotations) {
      if (!annotations?.length) return { html: renderMarkdown(text), sourcesHTML: '' };
      const valid = [...annotations].filter(a => a.url && a.start_index != null && a.end_index != null
        && a.start_index >= 0 && a.end_index <= text.length && a.start_index < a.end_index);
      if (!valid.length) return { html: renderMarkdown(text), sourcesHTML: '' };
      const urlMap = new Map();
      let citIdx = 0;
      valid.sort((a, b) => a.start_index - b.start_index).forEach(a => {
        if (!urlMap.has(a.url)) urlMap.set(a.url, { idx: ++citIdx, title: a.title || a.url, url: a.url });
      });
      let result = text;
      valid.sort((a, b) => b.start_index - a.start_index).forEach(a => {
        const ref = urlMap.get(a.url);
        if (!ref) return;
        const marker = `\u00AB${ref.idx}\u00BB`;
        result = result.slice(0, a.start_index) + marker + result.slice(a.end_index);
      });
      result = result.replace(/\s*\[[\d.,\s]+\]/g, '');
      let html = renderMarkdown(result);
      html = html.replace(/\u00AB(\d+)\u00BB/g, (_, n) =>
        `<sup style="font-size:0.75em;color:${COLORS.blue};font-weight:700;margin-left:1px"><a href="#sod-cite-${n}" style="color:${COLORS.blue};text-decoration:none">[${n}]</a></sup>`
      );
      let sourcesHTML = '';
      if (urlMap.size > 0) {
        sourcesHTML = '<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">'
          + `<div style="font-size:11px;font-weight:700;color:var(--text2);margin-bottom:4px"><span class="material-icons" style="font-size:13px;vertical-align:-2px">link</span> ${t('ai.sources')}</div>`
          + [...urlMap.values()].map(s =>
            `<div id="sod-cite-${s.idx}" style="font-size:11px;margin-bottom:3px;line-height:1.5"><span style="color:${COLORS.blue};font-weight:700">[${s.idx}]</span> <a href="${s.url}" target="_blank" rel="noopener" style="color:${COLORS.blue};text-decoration:none" title="${s.url}">${s.title || s.url}</a></div>`
          ).join('')
          + '</div>';
      }
      return { html, sourcesHTML };
    }
  
    function _renderStreamOutput(outputEl, fullText, thinkingText, annotations, done, ctx = null) {
      const ft = fullText.trim(), tt = thinkingText.trim();
      let html = '';
      if (tt) {
        if (ft) {
          html += '<div class="sod-ai-thinking-wrap" style="margin-bottom:6px">'
            + `<div class="sod-ai-thinking-toggle" style="${AI_DISCLOSURE_TOGGLE_TEXT_STYLE};color:${COLORS.purple};cursor:pointer;user-select:none;display:flex;align-items:center;gap:3px">`
            + `<span class="material-icons" style="font-size:13px">psychology</span> <span>▸ ${t('ai.showThinking')}</span></div>`
            + `<div class="sod-ai-thinking-body" style="display:none;${AI_DISCLOSURE_BODY_TEXT_STYLE};color:var(--text2);border-left:2px solid ${COLORS.purple};padding:4px 8px;margin-top:4px;max-height:200px;overflow-y:auto">${renderMarkdown(tt)}</div>`
            + '</div>';
        } else {
          html += `<div style="font-size:10px;color:var(--text2);border-left:2px solid ${COLORS.purple};padding:4px 8px;margin-bottom:4px">`
            + `<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;color:${COLORS.purple};font-weight:600"><span class="material-icons" style="font-size:13px">psychology</span> ${t('ai.thinking')}<span class="sod-loading" style="border-color:rgba(175,82,222,0.3);border-top-color:${COLORS.purple};width:10px;height:10px;border-width:1.5px"></span></div>`
            + renderMarkdown(tt) + '</div>';
        }
      }
      if (ft) {
        const { html: bodyHTML, sourcesHTML } = _applyAnnotations(fullText, annotations);
        html += bodyHTML + (done ? sourcesHTML : '');
      } else if (!tt) {
        html = `<div style="color:var(--text3)"><span class="sod-loading" style="border-color:rgba(0,122,255,0.3);border-top-color:#007AFF"></span> ${t('ai.generating')}</div>`;
      }
      if (ctx?.state) ctx.state.output = html;
      else _aiState.output = html;
      const targetEl = _resolveAIPanelOutputEl(ctx, outputEl);
      if (!targetEl) return;
      // Hidden panels only keep state cache; repaint happens when visible again.
      if (!done && !_isAIPanelVisible(ctx, targetEl)) return;
      targetEl.innerHTML = html;
      targetEl.scrollTop = targetEl.scrollHeight;
    }
  
    function _applyOpenAIResponsesEvent(evt, streamState) {
      if (!evt || evt.done) return null;
      const annotations = streamState.annotations;
      if (evt.type === 'response.output_text.delta') {
        streamState.fullText += evt.delta || '';
      } else if (evt.type === 'response.reasoning_summary_text.delta') {
        streamState.thinkingText += evt.delta || '';
      } else if (evt.type === 'response.output_text.annotation.added') {
        const a = evt.annotation;
        if (a?.type === 'url_citation' && a.url) {
          annotations.push({ url: a.url, title: a.title || '', start_index: a.start_index, end_index: a.end_index });
        }
      } else if (evt.type === 'response.content_part.done') {
        const part = evt.part;
        if (part?.type === 'output_text' && part.annotations?.length && !annotations.length) {
          part.annotations.forEach(a => {
            if (a?.type === 'url_citation' && a.url) {
              annotations.push({ url: a.url, title: a.title || '', start_index: a.start_index, end_index: a.end_index });
            }
          });
          if (part.text && annotations.length) streamState.fullText = part.text;
        }
      } else if (evt.type === 'response.completed') {
        const output = evt.response?.output;
        if (output && !annotations.length) {
          for (const item of output) {
            if (item.type !== 'message' || !item.content) continue;
            for (const c of item.content) {
              if (c.type !== 'output_text' || !c.annotations?.length) continue;
              c.annotations.forEach(a => {
                if (a?.type === 'url_citation' && a.url) {
                  annotations.push({ url: a.url, title: a.title || '', start_index: a.start_index, end_index: a.end_index });
                }
              });
              if (annotations.length) streamState.fullText = c.text;
            }
          }
        }
      }
      return evt;
    }

    function _parseAndApplyOpenAIResponseLine(line, streamState) {
      const evt = _parseResponsesStreamChunk(line);
      return _applyOpenAIResponsesEvent(evt, streamState);
    }

    async function _processSSEStream(reader, outputEl, ctx = null) {
      const decoder = new TextDecoder();
      const streamState = { fullText: '', thinkingText: '', annotations: [] };
      let buffer = '';
      let eventCount = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const evt = _parseAndApplyOpenAIResponseLine(line, streamState);
          if (!evt) continue;
          eventCount++;
          if (eventCount <= 5) console.log(TAG, 'SSE event:', evt.type);
        }
        _renderStreamOutput(outputEl, streamState.fullText, streamState.thinkingText, streamState.annotations, false, ctx);
      }

      // Flush decoder + trailing buffered line to avoid dropping final SSE chunk.
      buffer += decoder.decode();
      for (const line of buffer.split('\n')) {
        if (!line.trim()) continue;
        const evt = _parseAndApplyOpenAIResponseLine(line, streamState);
        if (!evt) continue;
        eventCount++;
        if (eventCount <= 5) console.log(TAG, 'SSE event:', evt.type);
      }

      console.log(TAG, `Stream complete: ${eventCount} events, text=${streamState.fullText.length}ch, thinking=${streamState.thinkingText.length}ch, citations=${streamState.annotations.length}`);
      if (streamState.fullText || streamState.thinkingText) _renderStreamOutput(outputEl, streamState.fullText, streamState.thinkingText, streamState.annotations, true, ctx);
    }
  
    async function _runOpenAIStream(prompt, outputEl, ctx = null) {
      if (!outputEl) outputEl = _resolveAIPanelOutputEl(ctx, _root.querySelector('.sod-ai-output'));
      const payload = _buildOpenAIPayload(prompt);
      const apiUrl = 'https://api.openai.com/v1/responses';
      const hdrs = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_aiState.apiKey}` };
  
      let usedFetch = false;
      try {
        console.log(TAG, 'Trying fetch for streaming...');
        const resp = await fetch(apiUrl, { method: 'POST', headers: hdrs, body: JSON.stringify(payload) });
        usedFetch = true;
        if (!resp.ok) {
          let errMsg = `API Error ${resp.status}`;
          try { errMsg = (await resp.json())?.error?.message || errMsg; } catch {}
          throw new Error(errMsg);
        }
        await _processSSEStream(resp.body.getReader(), outputEl, ctx);
      } catch (fetchErr) {
        if (usedFetch) throw fetchErr;
        if (typeof GM_xmlhttpRequest === 'undefined') throw fetchErr;
        console.log(TAG, 'fetch failed, falling back to GM_xmlhttpRequest:', fetchErr.message);
        await new Promise((resolve, reject) => {
          let lastLen = 0, lineBuf = '';
          const streamState = { fullText: '', thinkingText: '', annotations: [] };
          function _processChunk(raw) {
            if (raw.length <= lastLen) return;
            lineBuf += raw.substring(lastLen);
            lastLen = raw.length;
            const lines = lineBuf.split('\n');
            lineBuf = lines.pop() || '';
            for (const line of lines) {
              _parseAndApplyOpenAIResponseLine(line, streamState);
            }
            if (streamState.fullText || streamState.thinkingText) _renderStreamOutput(outputEl, streamState.fullText, streamState.thinkingText, streamState.annotations, false, ctx);
          }
          GM_xmlhttpRequest({
            method: 'POST', url: apiUrl, headers: hdrs, data: JSON.stringify(payload),
            onprogress: (r) => _processChunk(r.responseText || ''),
            onload: (r) => {
              if (r.status >= 400) {
                let msg = `API Error ${r.status}`;
                try { msg = JSON.parse(r.responseText)?.error?.message || msg; } catch {}
                return reject(new Error(msg));
              }
              _processChunk(r.responseText || '');
              if (lineBuf.trim()) _parseAndApplyOpenAIResponseLine(lineBuf, streamState);
              if (streamState.fullText || streamState.thinkingText) _renderStreamOutput(outputEl, streamState.fullText, streamState.thinkingText, streamState.annotations, true, ctx);
              resolve();
            },
            onerror: () => reject(new Error('Network error connecting to OpenAI')),
          });
        });
      }
    }
  
    function _utf8ByteOffsetToCharOffset(text, byteOffset) {
      const encoder = new TextEncoder();
      let bytes = 0;
      for (let i = 0; i < text.length; i++) {
        if (bytes >= byteOffset) return i;
        bytes += encoder.encode(text[i]).length;
      }
      return text.length;
    }
  
    function _convertGeminiGrounding(meta, fullText) {
      const annotations = [];
      const chunks = meta.groundingChunks || [];
      const supports = meta.groundingSupports || [];
      const needsByteConversion = fullText && new TextEncoder().encode(fullText).length !== fullText.length;
      for (const sup of supports) {
        const seg = sup.segment;
        if (!seg || seg.startIndex == null || seg.endIndex == null) continue;
        for (const ci of (sup.groundingChunkIndices || [])) {
          const chunk = chunks[ci];
          if (!chunk?.web?.uri) continue;
          const startIdx = needsByteConversion ? _utf8ByteOffsetToCharOffset(fullText, seg.startIndex) : seg.startIndex;
          const endIdx = needsByteConversion ? _utf8ByteOffsetToCharOffset(fullText, seg.endIndex) : seg.endIndex;
          annotations.push({ url: chunk.web.uri, title: chunk.web.title || '', start_index: startIdx, end_index: endIdx });
          break;
        }
      }
      return annotations;
    }
  
    function _parseAndApplyGeminiSSELine(line, streamState) {
      if (!line.startsWith('data: ')) return false;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr) return false;
      let data;
      try { data = JSON.parse(jsonStr); } catch { return false; }
      const candidate = data.candidates?.[0];
      if (!candidate) return false;
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (!part.text) continue;
        if (part.thought) streamState.thinkingText += part.text;
        else streamState.fullText += part.text;
      }
      if (candidate.groundingMetadata) streamState.groundingMeta = candidate.groundingMetadata;
      return candidate;
    }

    async function _processGeminiSSEStream(reader, outputEl, ctx = null) {
      const decoder = new TextDecoder();
      const streamState = { fullText: '', thinkingText: '', annotations: [], groundingMeta: null };
      let buffer = '';
      let eventCount = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const candidate = _parseAndApplyGeminiSSELine(line, streamState);
          if (!candidate) continue;
          eventCount++;
          if (eventCount <= 5) console.log(TAG, 'Gemini SSE event:', JSON.stringify(candidate).slice(0, 200));
          _renderStreamOutput(outputEl, streamState.fullText, streamState.thinkingText, streamState.annotations, false, ctx);
        }
      }

      // Flush decoder + trailing buffered line to avoid dropping final SSE chunk.
      buffer += decoder.decode();
      for (const line of buffer.split('\n')) {
        if (!line.trim()) continue;
        const candidate = _parseAndApplyGeminiSSELine(line, streamState);
        if (!candidate) continue;
        eventCount++;
        if (eventCount <= 5) console.log(TAG, 'Gemini SSE event:', JSON.stringify(candidate).slice(0, 200));
      }

      if (streamState.groundingMeta) streamState.annotations.push(..._convertGeminiGrounding(streamState.groundingMeta, streamState.fullText));
      console.log(TAG, `Gemini stream complete: ${eventCount} events, text=${streamState.fullText.length}ch, thinking=${streamState.thinkingText.length}ch, citations=${streamState.annotations.length}`);
      if (streamState.fullText || streamState.thinkingText) _renderStreamOutput(outputEl, streamState.fullText, streamState.thinkingText, streamState.annotations, true, ctx);
    }
  
    async function _runGeminiStream(prompt, outputEl, ctx = null) {
      if (!outputEl) outputEl = _resolveAIPanelOutputEl(ctx, _root.querySelector('.sod-ai-output'));
      const payload = _buildGeminiPayload(prompt);
      const model = _aiState.apiModel || 'gemini-3-flash-preview';
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
      const hdrs = { 'Content-Type': 'application/json', 'x-goog-api-key': _aiState.geminiApiKey };
  
      let usedFetch = false;
      try {
        console.log(TAG, 'Gemini: trying fetch for streaming...');
        const resp = await fetch(apiUrl, { method: 'POST', headers: hdrs, body: JSON.stringify(payload) });
        usedFetch = true;
        if (!resp.ok) {
          let errMsg = `API Error ${resp.status}`;
          try { errMsg = (await resp.json())?.error?.message || errMsg; } catch {}
          throw new Error(errMsg);
        }
        await _processGeminiSSEStream(resp.body.getReader(), outputEl, ctx);
      } catch (fetchErr) {
        if (usedFetch) throw fetchErr;
        if (typeof GM_xmlhttpRequest === 'undefined') throw fetchErr;
        console.log(TAG, 'Gemini fetch failed, falling back to GM_xmlhttpRequest:', fetchErr.message);
        await new Promise((resolve, reject) => {
          let lastLen = 0, lineBuf = '';
          const streamState = { fullText: '', thinkingText: '', annotations: [], groundingMeta: null };
          function _processChunk(raw) {
            if (raw.length <= lastLen) return;
            lineBuf += raw.substring(lastLen);
            lastLen = raw.length;
            const lines = lineBuf.split('\n');
            lineBuf = lines.pop() || '';
            for (const line of lines) {
              _parseAndApplyGeminiSSELine(line, streamState);
            }
            if (streamState.fullText || streamState.thinkingText) _renderStreamOutput(outputEl, streamState.fullText, streamState.thinkingText, streamState.annotations, false, ctx);
          }
          GM_xmlhttpRequest({
            method: 'POST', url: apiUrl, headers: hdrs, data: JSON.stringify(payload),
            onprogress: (r) => _processChunk(r.responseText || ''),
            onload: (r) => {
              if (r.status >= 400) {
                let msg = `API Error ${r.status}`;
                try { msg = JSON.parse(r.responseText)?.error?.message || msg; } catch {}
                return reject(new Error(msg));
              }
              _processChunk(r.responseText || '');
              if (lineBuf.trim()) _parseAndApplyGeminiSSELine(lineBuf, streamState);
              if (streamState.groundingMeta) streamState.annotations.push(..._convertGeminiGrounding(streamState.groundingMeta, streamState.fullText));
              if (streamState.fullText || streamState.thinkingText) _renderStreamOutput(outputEl, streamState.fullText, streamState.thinkingText, streamState.annotations, true, ctx);
              resolve();
            },
            onerror: () => reject(new Error('Network error connecting to Gemini API')),
          });
        });
      }
    }
  
    async function runAIAnalysis() { return _runAIPanelAnalysis(_marketAICtx); }
  
    /* ══════════════════════════════════════════════
       STOCK MODULE
    ══════════════════════════════════════════════ */
  
    const STOCK_SYM_KEY = 'schwab_stock_symbol';
    const STOCK_PERIOD_API_MAP = { 'day': 'Day', '5d': 'Week', '1m': 'OneMonth', '3m': 'ThreeMonth', '6m': 'SixMonth', '1y': 'OneYear', '5y': 'FiveYear' };
  
    let _stockState = {
      symbol: _xGet(STOCK_SYM_KEY, ''),
      quoteData: null,
      period: 'day',
      liveMode: false,
      liveSource: null,
      livePollTimer: null,
      livePollInFlight: false,
      wsTickHandler: null,
      chartTimeSeries: [],
      initialized: false,
    };
  
    let _stockSearchDebounce = null;
  
    function initStockModule() {
      renderStockHeader();
      renderStockQuoteBar();
      renderStockSubModules();
      if (_stockState.symbol && !_stockState.initialized) {
        _stockState.initialized = true;
        loadStockData(_stockState.symbol);
      }
    }
  
    function renderStockHeader() {
      const el = _root.querySelector('#sod-stock-header');
      if (!el) return;
  
      el.innerHTML = `
        <div class="sod-stock-search-wrap">
          <input class="sod-stock-input" id="sod-stock-sym-input" placeholder="${t('stock.symbolPlaceholder')}"
                 value="${_stockState.symbol}" autocomplete="off"/>
          <div class="sod-stock-dd" id="sod-stock-dd" style="display:none"></div>
        </div>
        <button class="sod-stock-go-btn" id="sod-stock-go-btn">
          <span class="material-icons" style="font-size:16px">search</span> ${t('stock.load')}
        </button>
      `;
  
      const input = el.querySelector('#sod-stock-sym-input');
      const dd = el.querySelector('#sod-stock-dd');
      const goBtn = el.querySelector('#sod-stock-go-btn');
  
      input.addEventListener('input', () => {
        clearTimeout(_stockSearchDebounce);
        const q = input.value.trim();
        if (q.length < 1) { dd.style.display = 'none'; return; }
        _stockSearchDebounce = setTimeout(async () => {
          try {
            const results = await searchSymbol(q);
            if (!results.length) { dd.style.display = 'none'; return; }
            dd.innerHTML = results.map(r =>
              `<div class="sod-stock-dd-item" data-sym="${r.symbol}">
                <span class="sod-stock-dd-sym">${r.symbol}</span>
                <span class="sod-stock-dd-name">${r.name || r.description || ''}</span>
              </div>`
            ).join('');
            dd.style.display = 'block';
            dd.querySelectorAll('.sod-stock-dd-item').forEach(item => {
              item.addEventListener('click', () => {
                input.value = item.dataset.sym;
                dd.style.display = 'none';
                _triggerStockLoad(item.dataset.sym);
              });
            });
          } catch (e) { dd.style.display = 'none'; }
        }, 250);
      });
  
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          dd.style.display = 'none';
          const sym = input.value.trim().toUpperCase();
          if (sym) _triggerStockLoad(sym);
        }
      });
  
      goBtn.addEventListener('click', () => {
        dd.style.display = 'none';
        const sym = input.value.trim().toUpperCase();
        if (sym) _triggerStockLoad(sym);
      });
  
      document.addEventListener('click', (e) => {
        if (!el.contains(e.target)) dd.style.display = 'none';
      });
    }
  
    async function _triggerStockLoad(symbol) {
      _stockState.symbol = symbol.toUpperCase();
      _xSet(STOCK_SYM_KEY, _stockState.symbol);
      const input = _root.querySelector('#sod-stock-sym-input');
      if (input) input.value = _stockState.symbol;
      stopStockLiveMode();
      await loadStockData(_stockState.symbol);
    }
  
    async function loadStockData(symbol) {
      _stockNewsState.articles = [];
      _stockNewsState.tab = 'newswire';
  
      _stockFundState.cacheBySymbolTab = {};
      _stockFundState.loadingByTab = {};
      _stockFundState.inflightByTab = {};
      _stockFundState.sentimentSeriesCache = {};
  
      try {
        await getToken();
        const quoteData = await getQuote(symbol);
        _stockState.quoteData = quoteData;
        renderStockQuoteBar();
        await loadStockChart();
      } catch (e) {
        console.error(TAG, 'Stock data load error:', e);
        showToast('Failed to load stock data: ' + e.message, 'error');
      }
  
      loadStockNews();
      renderFundamentalsTabs();
    }
  
    function renderStockQuoteBar() {
      const el = _root.querySelector('#sod-stock-quote-bar');
      if (!el) return;
  
      const q = _stockState.quoteData;
      if (!q) {
        el.innerHTML = `<div class="sod-stock-qb-empty">${t('stock.noSymbol')}</div>`;
        return;
      }
  
      const ref = q.reference || {};
      const quote = q.quote || {};
      const reg = q.regularQuote || {};
      const fund = q.fundamental || {};
  
      const lastPrice = quote.lastPrice ?? reg.lastPrice;
      const netChange = quote.netChange ?? 0;
      const netChangePct = quote.netChangePercent ?? 0;
      const regPrice = reg.lastPrice;
      const regChange = reg.netChange ?? 0;
      const regChangePct = reg.percentChange ?? 0;
      const postChange = quote.postMarketChange ?? 0;
      const postChangePct = quote.postMarketPercentChange ?? 0;
  
      const isUp = netChange >= 0;
      const isRegUp = regChange >= 0;
      const chgColor = isUp ? 'green' : 'red';
      const regChgColor = isRegUp ? 'green' : 'red';
  
      const marketType = q.marketType || '';
      const isAfterHours = marketType === 'Closed' || marketType === 'Post';
      const isPreMarket = marketType === 'Pre';
  
      let sessionLabel = t('stock.marketClosed');
      if (marketType === 'Regular') sessionLabel = t('stock.marketOpen');
      else if (marketType === 'Pre') sessionLabel = t('stock.marketPre');
      else if (marketType === 'Post') sessionLabel = t('stock.marketPost');
  
      const badgeColor = marketType === 'Regular' ? COLORS.green : marketType === 'Pre' ? COLORS.orange : COLORS.red;
  
      const quoteTime = quote.quoteDateTime ? new Date(quote.quoteDateTime) : null;
      const regTime = reg.tradeTime ? new Date(reg.tradeTime) : null;
      const fmtTime = (d) => d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }) + ' ET, ' + d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '';
  
      const mainPrice = (isAfterHours || isPreMarket) ? lastPrice : regPrice;
      const mainChg = (isAfterHours || isPreMarket) ? netChange : regChange;
      const mainPct = (isAfterHours || isPreMarket) ? netChangePct : regChangePct;
      const mainColor = (isAfterHours || isPreMarket) ? chgColor : regChgColor;
      const mainUp = (isAfterHours || isPreMarket) ? isUp : isRegUp;
  
      const mainSessionLabel = (isAfterHours || isPreMarket)
        ? (isPreMarket ? t('stock.preMarket') : t('stock.afterHours')) + ': ' + fmtTime(quoteTime)
        : t('stock.atClose') + ': ' + fmtTime(regTime);
  
      const showSecondary = (isAfterHours || isPreMarket);
      const secPrice = regPrice;
      const secChg = regChange;
      const secPct = regChangePct;
      const secColor = regChgColor;
      const secUp = isRegUp;
      const secLabel = t('stock.atClose') + ': ' + fmtTime(regTime);
  
      const bid = quote.bidPrice;
      const ask = quote.askPrice;
      const bidSize = quote.bidSize;
      const askSize = quote.askSize;
      const prevClose = quote.previousClosePrice;
      const openPrice = quote.openPrice;
      const volume = quote.volume;
      const avgVolLabel = quote.averageVolumeDaily || '';
      const lowDay = quote.lowPrice;
      const highDay = quote.highPrice;
      const low52 = quote.priceLow52W;
      const high52 = quote.priceHigh52W;
  
      const todayPct = (highDay > lowDay) ? ((mainPrice - lowDay) / (highDay - lowDay)) * 100 : 50;
      const w52Pct = (high52 > low52) ? ((mainPrice - low52) / (high52 - low52)) * 100 : 50;
  
      const volDisplay = volume != null ? fmtNum(volume, true) : '—';
      const volNote = avgVolLabel ? `<span style="font-size:9px;color:${COLORS.red}">▼${avgVolLabel}</span>` : '';
  
      el.innerHTML = `
        <div class="sod-stock-qb-name-block">
          <div style="display:flex;align-items:baseline;gap:6px">
            <span class="sod-stock-qb-company">${ref.companyName || _stockState.symbol}</span>
            <span class="sod-stock-qb-symex"><b>${ref.symbol || _stockState.symbol}</b>: ${ref.exchangeName || ''}</span>
            <span class="sod-stock-qb-badge" style="background:${badgeColor}18;color:${badgeColor}">${sessionLabel}</span>
          </div>
          ${ref.category ? `<div class="sod-stock-qb-sector">${ref.category}</div>` : ''}
        </div>
        <div class="sod-stock-qb-divider"></div>
        <div class="sod-stock-qb-field">
          <span class="sod-stock-qb-field-value" style="color:${mainUp ? COLORS.green : COLORS.red}"><span class="sod-stock-qb-price">$${Number(mainPrice).toFixed(2)}</span> ${mainUp ? '+' : ''}${Math.abs(mainChg).toFixed(2)} (${mainUp ? '+' : ''}${mainPct.toFixed(2)}%)</span>
          <span class="sod-stock-qb-field-label">${mainSessionLabel}</span>
        </div>
        ${showSecondary ? `<div class="sod-stock-qb-field">
          <span class="sod-stock-qb-field-value" style="color:${secUp ? COLORS.green : COLORS.red}"><span class="sod-stock-qb-price">$${Number(secPrice).toFixed(2)}</span> ${secUp ? '+' : ''}${Math.abs(secChg).toFixed(2)} (${secUp ? '+' : ''}${secPct.toFixed(2)}%)</span>
          <span class="sod-stock-qb-field-label">${secLabel}</span>
        </div>` : ''}
        <div class="sod-stock-qb-divider"></div>
        <div class="sod-stock-qb-field"><span class="sod-stock-qb-field-label" style="color:${COLORS.blue}">${t('stock.bid')}</span><span class="sod-stock-qb-field-value" style="color:${COLORS.blue}">$${bid != null ? Number(bid).toFixed(2) : '—'}</span></div>
        <div class="sod-stock-qb-field"><span class="sod-stock-qb-field-label" style="color:${COLORS.orange}">${t('stock.ask')}</span><span class="sod-stock-qb-field-value" style="color:${COLORS.orange}">$${ask != null ? Number(ask).toFixed(2) : '—'}</span></div>
        <div class="sod-stock-qb-field"><span class="sod-stock-qb-field-label" style="color:${COLORS.purple}">${t('stock.bidAskSize')}</span><span class="sod-stock-qb-field-value" style="color:${COLORS.purple}">${bidSize != null ? fmtNum(bidSize, true) : '—'}/${askSize != null ? fmtNum(askSize, true) : '—'}</span></div>
        <div class="sod-stock-qb-field"><span class="sod-stock-qb-field-label" style="color:${COLORS.indigo}">${t('stock.prevClose')}</span><span class="sod-stock-qb-field-value" style="color:${COLORS.indigo}">$${prevClose != null ? Number(prevClose).toFixed(2) : '—'}</span></div>
        <div class="sod-stock-qb-field"><span class="sod-stock-qb-field-label" style="color:${COLORS.teal}">${t('stock.open')}</span><span class="sod-stock-qb-field-value" style="color:${COLORS.teal}">$${openPrice != null ? Number(openPrice).toFixed(2) : '—'}</span></div>
        <div class="sod-stock-qb-field"><span class="sod-stock-qb-field-label" style="color:${COLORS.pink}">${t('stock.volume')}</span><span class="sod-stock-qb-field-value" style="color:${COLORS.pink}">${volDisplay} ${volNote}</span></div>
        <div class="sod-stock-qb-divider"></div>
        <div class="sod-stock-qb-field">
          <span class="sod-stock-qb-field-label" style="color:${COLORS.gray}">DAY RANGE</span>
          <div style="display:flex;align-items:center;gap:3px">
            <span class="sod-stock-qb-field-value" style="color:var(--text2)">$${lowDay != null ? Number(lowDay).toFixed(2) : '—'}</span>
            <div class="sod-stock-range-bar"><div class="sod-stock-range-fill" style="width:100%"></div><div class="sod-stock-range-dot" style="left:${Math.max(2, Math.min(98, todayPct))}%"></div></div>
            <span class="sod-stock-qb-field-value" style="color:var(--text2)">$${highDay != null ? Number(highDay).toFixed(2) : '—'}</span>
          </div>
        </div>
        <div class="sod-stock-qb-field">
          <span class="sod-stock-qb-field-label" style="color:${COLORS.gray}">52W RANGE</span>
          <div style="display:flex;align-items:center;gap:3px">
            <span class="sod-stock-qb-field-value" style="color:var(--text2)">$${low52 != null ? Number(low52).toFixed(2) : '—'}</span>
            <div class="sod-stock-range-bar"><div class="sod-stock-range-fill" style="width:100%"></div><div class="sod-stock-range-dot" style="left:${Math.max(2, Math.min(98, w52Pct))}%"></div></div>
            <span class="sod-stock-qb-field-value" style="color:var(--text2)">$${high52 != null ? Number(high52).toFixed(2) : '—'}</span>
          </div>
        </div>
      `;
    }
  
    function renderStockSubModules() {
      const el = _root.querySelector('#sod-stock-modules');
      if (!el) return;
  
      if (!el.querySelector('#sod-stock-chart-card')) {
        el.innerHTML = `
          <div class="sod-stock-col" style="flex:35" data-stock-col="0">
            <div class="sod-stock-chart-fund-split">
              <div class="sod-stock-chart-pane" style="flex:40" data-cfpane="chart">
                <div class="sod-stock-card" id="sod-stock-chart-card">
                  <div class="sod-stock-card-title sod-stock-card-title-chart">
                    <span class="material-icons sod-card-icon">candlestick_chart</span>${t('stock.priceChart')}
                  </div>
                  <div class="sod-stock-chart-controls" id="sod-stock-chart-controls"></div>
                  <div class="sod-stock-chart-wrap"><canvas id="sod-chart-stock"></canvas></div>
                </div>
              </div>
              <div class="sod-resize-v-fund" id="sod-resize-chart-fund"></div>
              <div class="sod-stock-fund-pane" style="flex:60" data-cfpane="fund">
                <div class="sod-fund-card" id="sod-stock-fund-card" style="flex:1">
                  <div class="sod-fund-card-title">
                    <span class="material-icons" style="font-size:16px">assessment</span>${t('fund.title')}
                  </div>
                  <div class="sod-fund-tabs-wrap" id="sod-fund-tabs-wrap"></div>
                  <div class="sod-fund-content" id="sod-fund-content">
                    <div class="sod-fund-empty">${t('fund.noData')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="sod-resize-h" data-stock-rh="0"></div>
          <div class="sod-stock-col" style="flex:35" data-stock-col="1">
            <div class="sod-stock-card" id="sod-stock-news-card">
              <div class="sod-stock-card-title sod-stock-card-title-news">
                <span class="material-icons sod-card-icon">article</span>${t('stock.news')}
              </div>
              <div id="sod-stock-news-tabs-wrap"></div>
              <div class="sod-stock-news-list" id="sod-stock-news-list"></div>
            </div>
          </div>
          <div class="sod-resize-h" data-stock-rh="1"></div>
          <div class="sod-stock-col" style="flex:30" data-stock-col="2">
            <div class="sod-stock-card" id="sod-stock-ai-card"></div>
          </div>
        `;
      }
  
      const _updTitle = (sel, key) => { const e = el.querySelector(sel); if (e) e.innerHTML = e.querySelector('.material-icons')?.outerHTML + t(key); };
      _updTitle('#sod-stock-chart-card .sod-stock-card-title-chart', 'stock.priceChart');
      _updTitle('#sod-stock-news-card .sod-stock-card-title-news', 'stock.news');
      const fundTitle = el.querySelector('#sod-stock-fund-card .sod-fund-card-title');
      if (fundTitle) fundTitle.innerHTML = `<span class="material-icons" style="font-size:16px">assessment</span>${t('fund.title')}`;
  
      initStockResizeHandles();
      initChartFundResizeHandle();
      renderStockChartControls();
      renderFundamentalsTabs();
      renderStockNewsModule();
      renderStockAIModule();
    }
  
    function initStockResizeHandles() {
      const layout = _root.querySelector('#sod-stock-modules');
      if (!layout || layout.dataset.resizeInit === '1') return;
      layout.dataset.resizeInit = '1';
  
      layout.querySelectorAll('.sod-resize-h[data-stock-rh]').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
          e.preventDefault();
          handle.classList.add('active');
          const prevCol = handle.previousElementSibling;
          const nextCol = handle.nextElementSibling;
          if (!prevCol || !nextCol) return;
          const startX = e.clientX;
          const prevFlex = parseFloat(prevCol.style.flex) || 1;
          const nextFlex = parseFloat(nextCol.style.flex) || 1;
          const layoutWidth = layout.getBoundingClientRect().width || 1;
  
          function onMove(ev) {
            const dx = ev.clientX - startX;
            const dFlex = (dx / layoutWidth) * 100;
            const newPrev = Math.max(12, prevFlex + dFlex);
            const newNext = Math.max(12, nextFlex - dFlex);
            prevCol.style.flex = newPrev;
            nextCol.style.flex = newNext;
          }
          function onUp() {
            handle.classList.remove('active');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            window.dispatchEvent(new Event('resize'));
          }
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
      });
    }
  
    function renderStockChartControls() {
      const ctrl = _root.querySelector('#sod-stock-chart-controls');
      if (!ctrl) return;
  
      const periods = [
        { key: 'day', label: '1D' }, { key: '5d', label: '5D' },
        { key: '1m', label: '1M' }, { key: '3m', label: '3M' },
        { key: '6m', label: '6M' }, { key: '1y', label: '1Y' },
        { key: '5y', label: '5Y' },
      ];
  
      ctrl.innerHTML = `
        <button class="sod-stock-live-btn ${_stockState.liveMode ? 'active' : ''}" id="sod-stock-live-toggle">
          <span class="sod-stock-live-dot"></span> ${t('stock.live')}
        </button>
        <div class="sod-stock-period-tabs" style="margin-left:6px">
          ${periods.map(p => `<button class="sod-stock-period-tab ${_stockState.period === p.key ? 'active' : ''}" data-period="${p.key}">${p.label}</button>`).join('')}
        </div>
      `;
  
      ctrl.querySelectorAll('.sod-stock-period-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          if (_stockState.liveMode) stopStockLiveMode();
          _stockState.period = btn.dataset.period;
          ctrl.querySelectorAll('.sod-stock-period-tab').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          if (_stockState.symbol) loadStockChart();
        });
      });
  
      ctrl.querySelector('#sod-stock-live-toggle')?.addEventListener('click', () => {
        if (_stockState.liveMode) {
          stopStockLiveMode();
        } else {
          startStockLiveMode();
        }
      });
    }
  
    async function loadStockChart() {
      if (!_stockState.symbol) return;
      try {
        const period = STOCK_PERIOD_API_MAP[_stockState.period] || 'Day';
        const needExtended = _stockState.period === 'day';
        await getToken();
        const r = await _schwabFetch(`${API.SYMBOL_HISTORY}?symbols=${encodeURIComponent(_stockState.symbol)}&period=${period}&needExtendedHoursData=${needExtended}`, {
          headers: marketHeaders('2'),
        });
        if (!r.ok) throw new Error(`Chart data failed: ${r.status}`);
        const data = await r.json();
        const chartData = data.stockChart?.[0];
        if (!chartData) throw new Error('No chart data');
        _stockState.chartTimeSeries = chartData.timeSeries || [];
        drawStockChart(chartData);
      } catch (e) {
        console.error(TAG, 'Stock chart load error:', e);
        showToast('Failed to load chart: ' + e.message, 'error');
      }
    }
  
    function drawStockChart(chartData) {
      destroyChart('stock');
      const ctx = _root.querySelector('#sod-chart-stock')?.getContext('2d');
      if (!ctx) return;
  
      const ts = chartData.timeSeries || [];
      if (!ts.length) return;
  
      const prevClose = chartData.previousClose;
      const isIntraday = _stockState.period === 'day';
  
      const labels = ts.map(t => {
        const d = new Date(t.lastPriceDate);
        return isIntraday
          ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
          : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });
  
      const prices = ts.map(t => t.lastPrice);
      const last = prices[prices.length - 1];
      const isUp = prevClose ? last >= prevClose : prices[prices.length - 1] >= prices[0];
      const lineColor = isUp ? COLORS.green : COLORS.red;
      const fillColor = isUp ? 'rgba(52,199,89,0.08)' : 'rgba(255,59,48,0.08)';
  
      const datasets = [{
        label: _stockState.symbol,
        data: prices,
        borderColor: lineColor,
        backgroundColor: fillColor,
        fill: true,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.2,
      }];
  
      const annotations = [];
      if (prevClose && isIntraday) {
        annotations.push({
          type: 'line',
          yMin: prevClose,
          yMax: prevClose,
          borderColor: 'rgba(128,128,128,0.5)',
          borderWidth: 1,
          borderDash: [4, 4],
          label: {
            display: true,
            content: `Prev Close $${prevClose.toFixed(2)}`,
            position: 'start',
            font: { size: 9 },
            backgroundColor: 'rgba(128,128,128,0.7)',
            color: '#fff',
            padding: 2,
          },
        });
      }
  
      _charts.stock = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: true, mode: 'index', intersect: false,
              backgroundColor: 'rgba(0,0,0,0.85)', titleFont: { size: 10 }, bodyFont: { size: 11 },
              cornerRadius: 8, padding: 10,
              callbacks: {
                title: items => items.length ? labels[items[0].dataIndex] : '',
                label: ctx2 => ` $${ctx2.parsed.y?.toFixed(2)}`,
                afterLabel: ctx2 => {
                  if (!prevClose) return '';
                  const chg = ctx2.parsed.y - prevClose;
                  const pct = (chg / prevClose) * 100;
                  return ` ${chg >= 0 ? '+' : ''}${chg.toFixed(2)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
                },
              },
            },
            zoom: { pan: { enabled: true, mode: 'x', threshold: 5 }, limits: { x: { minRange: 10 } } },
          },
          scales: {
            x: {
              ticks: { font: { size: 8 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12, color: '#888' },
              grid: { display: false },
            },
            y: {
              ticks: {
                font: { size: 9 }, color: '#888',
                callback: v => '$' + v.toFixed(2),
              },
              grid: { color: 'rgba(128,128,128,0.1)' },
            },
          },
        },
        plugins: [crosshairPlugin],
      });
    }
  
    function _getStreamerInstance() {
      const pageWin = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
      return pageWin?.streamerInstance?.getInstance?.() || window.streamerInstance?.getInstance?.() || null;
    }
  
    function _isStreamerReady(streamer) {
      return !!(streamer
        && streamer.isConnected?.()
        && (typeof streamer.isStreamingToggleOn !== 'function' || streamer.isStreamingToggleOn()));
    }
  
    function startStockLiveMode() {
      if (!_stockState.symbol) return;
      _stockState.liveMode = true;
      _stockState.liveSource = null;
      _stockState.period = 'day';
  
      const liveBtn = _root.querySelector('#sod-stock-live-toggle');
      if (liveBtn) liveBtn.classList.add('active');
      _root.querySelectorAll('.sod-stock-period-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.period === 'day');
      });
  
      let streamer = _getStreamerInstance();
  
      const applyLiveTick = (sym, tick) => {
        const price = tick.lastPrice;
        if (price == null) return;
  
        if (_stockState.quoteData) {
          const q = _stockState.quoteData.quote || {};
          if (tick.bidPrice != null) q.bidPrice = tick.bidPrice;
          if (tick.askPrice != null) q.askPrice = tick.askPrice;
          if (tick.lastPrice != null) q.lastPrice = tick.lastPrice;
          if (tick.bidSize != null) q.bidSize = tick.bidSize;
          if (tick.askSize != null) q.askSize = tick.askSize;
          if (tick.totalVolume != null) q.volume = tick.totalVolume;
          if (tick.highPrice != null) q.highPrice = tick.highPrice;
          if (tick.lowPrice != null) q.lowPrice = tick.lowPrice;
          if (tick.netChange != null) q.netChange = tick.netChange;
          if (tick.netPercentChange != null) q.netChangePercent = tick.netPercentChange;
          if (tick.quoteTimeMs != null) q.quoteDateTime = new Date(tick.quoteTimeMs).toISOString();
          _stockState.quoteData.quote = q;
          renderStockQuoteBar();
        }
  
        if (_charts.stock && _charts.stock.data.datasets[0]) {
          const ds = _charts.stock.data.datasets[0];
          const tickTs = tick.quoteTimeMs != null ? new Date(tick.quoteTimeMs) : new Date();
          const timeLabel = tickTs.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
          const lastLabel = _charts.stock.data.labels[_charts.stock.data.labels.length - 1];
  
          if (timeLabel === lastLabel) {
            ds.data[ds.data.length - 1] = price;
          } else {
            _charts.stock.data.labels.push(timeLabel);
            ds.data.push(price);
          }
  
          const isUp = ds.data[ds.data.length - 1] >= ds.data[0];
          ds.borderColor = isUp ? COLORS.green : COLORS.red;
          ds.backgroundColor = isUp ? 'rgba(52,199,89,0.08)' : 'rgba(255,59,48,0.08)';
          _charts.stock.update('none');
        }
      };
  
      const startPollingLive = (sym) => {
        if (_stockState.livePollTimer) {
          clearInterval(_stockState.livePollTimer);
          _stockState.livePollTimer = null;
        }
        _stockState.liveSource = 'poll';
        _stockState.livePollInFlight = false;
  
        const pollOnce = async () => {
          if (!_stockState.liveMode || _stockState.symbol !== sym) return;
          if (_stockState.livePollInFlight) return;
          _stockState.livePollInFlight = true;
          try {
            const qd = await getQuote(sym, { silent: true });
            if (!_stockState.liveMode || _stockState.symbol !== sym) return;
            _stockState.quoteData = qd;
            const q = qd?.quote || {};
            const reg = qd?.regularQuote || {};
            applyLiveTick(sym, {
              symbol: sym,
              bidPrice: q.bidPrice,
              askPrice: q.askPrice,
              lastPrice: q.lastPrice ?? reg.lastPrice,
              bidSize: q.bidSize,
              askSize: q.askSize,
              totalVolume: q.volume,
              highPrice: q.highPrice,
              lowPrice: q.lowPrice,
              netChange: q.netChange,
              netPercentChange: q.netChangePercent,
              quoteTimeMs: q.quoteDateTime ? new Date(q.quoteDateTime).getTime() : Date.now(),
            });
          } catch (e) {
            console.warn(TAG, 'Polling live tick failed:', e.message);
          } finally {
            _stockState.livePollInFlight = false;
          }
        };
  
        pollOnce();
        _stockState.livePollTimer = setInterval(pollOnce, 3000);
        showToast('WebSocket unavailable; LIVE switched to 3s polling.', 'info');
        console.warn(TAG, 'Stock live mode fallback to polling for', sym);
      };
  
      loadStockChart().then(async () => {
        const sym = _stockState.symbol;
        if (!_stockState.liveMode || !sym) return;
  
        if (!_isStreamerReady(streamer)) {
          // Tampermonkey/page runtime may initialize streamer slightly later.
          await new Promise(r => setTimeout(r, 1200));
          streamer = _getStreamerInstance();
        }
  
        if (!_isStreamerReady(streamer)) {
          const reason = !streamer
            ? 'streamerInstance missing (page context unavailable or not initialized)'
            : !streamer.isConnected?.()
              ? 'streamer not connected'
              : 'streaming toggle off';
          console.info(TAG, 'WebSocket streamer not available:', reason);
          startPollingLive(sym);
          return;
        }
  
        const allFields = ['0','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15'];
  
        try {
          streamer.subscribeQuotes('stock-module', [sym], allFields);
          _stockState.liveSource = 'ws';
        } catch (e) {
          console.warn(TAG, 'WebSocket subscribe failed:', e);
          startPollingLive(sym);
          return;
        }
  
        if (_stockState.wsTickHandler) {
          try { streamer.eventListener.off('QUOTE-TICK', _stockState.wsTickHandler); } catch (e) {}
        }
  
        _stockState.wsTickHandler = (data) => {
          const ticks = Array.isArray(data) ? data : [data];
          for (const tick of ticks) {
            const tickSym = tick.symbol || tick.key;
            if (tickSym !== sym) continue;
            applyLiveTick(sym, tick);
          }
        };
  
        streamer.eventListener.on('QUOTE-TICK', _stockState.wsTickHandler);
        console.log(TAG, 'Stock live mode started for', sym);
      });
    }
  
    function stopStockLiveMode() {
      if (!_stockState.liveMode) return;
      _stockState.liveMode = false;
      _stockState.livePollInFlight = false;
  
      const liveBtn = _root.querySelector('#sod-stock-live-toggle');
      if (liveBtn) liveBtn.classList.remove('active');
  
      if (_stockState.livePollTimer) {
        clearInterval(_stockState.livePollTimer);
        _stockState.livePollTimer = null;
      }
  
      const streamer = _getStreamerInstance();
      if (streamer && _stockState.symbol) {
        try {
          streamer.unsubscribeQuotes('stock-module', [_stockState.symbol]);
        } catch (e) {
          console.warn(TAG, 'WebSocket unsubscribe failed:', e);
        }
      }
  
      if (_stockState.wsTickHandler && streamer) {
        try { streamer.eventListener.off('QUOTE-TICK', _stockState.wsTickHandler); } catch (e) {}
        _stockState.wsTickHandler = null;
      }
  
      _stockState.liveSource = null;
  
      console.log(TAG, 'Stock live mode stopped');
    }
  
    /* ── IBKR Fundamentals API ── */
  
    const IBKR_FUND_TABS = [
      { key: 'overview', label: 'fund.overview', icon: 'dashboard', color: COLORS.blue },
      { key: 'profile', label: 'fund.profile', icon: 'business', color: COLORS.teal },
      { key: 'social_sentiment', label: 'fund.socialSentiment', icon: 'forum', color: '#007AFF' },
      { key: 'short_selling', label: 'fund.shortSelling', icon: 'trending_down', color: '#FF3B30' },
      { key: 'financials', label: 'fund.financials', icon: 'account_balance', color: COLORS.green },
      { key: 'key_ratios', label: 'fund.keyRatios', icon: 'pie_chart', color: COLORS.orange },
      { key: 'ratings', label: 'fund.ratings', icon: 'star_rate', color: COLORS.yellow },
      { key: 'forecast', label: 'fund.forecast', icon: 'trending_up', color: COLORS.purple },
      { key: 'ownership', label: 'fund.ownership', icon: 'people', color: COLORS.pink },
      { key: 'dividends', label: 'fund.dividends', icon: 'payments', color: '#34C759' },
      { key: 'competitors', label: 'fund.competitors', icon: 'compare_arrows', color: COLORS.indigo },
      { key: 'esg', label: 'fund.esg', icon: 'eco', color: '#5AC8FA' },
      { key: 'investment_themes', label: 'fund.investmentThemes', icon: 'lightbulb', color: '#FFCC00' },
      { key: 'tipranks', label: 'fund.tipranks', icon: 'auto_graph', color: '#FF9500' },
      { key: 'trading_central', label: 'fund.tradingCentral', icon: 'insights', color: '#5856D6' },
      { key: 'estimize', label: 'fund.estimize', icon: 'analytics', color: '#FF2D55' },
    ];
  
    let _stockFundState = {
      activeTab: 'overview',
      cacheBySymbolTab: {},
      loadingByTab: {},
      inflightByTab: {},
      periodToggles: { financials: { annual: false, type: 'income' }, forecast: { annual: false } },
      sentimentPeriod: '1W',
      sentimentSeriesCache: {},
      themesGroupType: 'company_theme',
    };
  
    function _fundCacheKey(symbol, tabKey) { return `${symbol}::${tabKey}`; }
  
    function initChartFundResizeHandle() {
      const handle = _root.querySelector('#sod-resize-chart-fund');
      if (!handle || handle.dataset.resizeInit === '1') return;
      handle.dataset.resizeInit = '1';
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        handle.classList.add('active');
        const split = handle.closest('.sod-stock-chart-fund-split');
        if (!split) return;
        const chartPane = split.querySelector('[data-cfpane="chart"]');
        const fundPane = split.querySelector('[data-cfpane="fund"]');
        if (!chartPane || !fundPane) return;
        const startY = e.clientY;
        const splitH = split.getBoundingClientRect().height || 1;
        const chartFlex = parseFloat(chartPane.style.flex) || 40;
        const fundFlex = parseFloat(fundPane.style.flex) || 60;
        let rafId = 0;
        function onMove(ev) {
          const dy = ev.clientY - startY;
          const dFlex = (dy / splitH) * 100;
          const newChart = Math.max(10, Math.min(90, chartFlex + dFlex));
          const newFund = Math.max(10, Math.min(90, fundFlex - dFlex));
          chartPane.style.flex = `${newChart} 1 0%`;
          fundPane.style.flex = `${newFund} 1 0%`;
          cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
        }
        function onUp() {
          handle.classList.remove('active');
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          cancelAnimationFrame(rafId);
          window.dispatchEvent(new Event('resize'));
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    }
  
    function bindHorizontalWheelScroll(el) {
      if (!el || el.dataset.hWheelBound === '1') return;
      el.dataset.hWheelBound = '1';
      el.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
        if (el.scrollWidth <= el.clientWidth) return;
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }, { passive: false });
    }
  
    function renderFundamentalsTabs() {
      const wrap = _root.querySelector('#sod-fund-tabs-wrap');
      if (!wrap) return;
      wrap.innerHTML = `<div class="sod-fund-tabs">${IBKR_FUND_TABS.map(tab => {
        const active = _stockFundState.activeTab === tab.key;
        return `<button class="sod-fund-tab${active ? ' active' : ''}" data-fund-tab="${tab.key}"
          style="${active ? `background:${tab.color};color:#fff` : `background:${tab.color}18;color:${tab.color}`}">
          <span class="material-icons">${tab.icon}</span>${t(tab.label)}</button>`;
      }).join('')}</div>`;
  
      bindHorizontalWheelScroll(wrap);
  
      wrap.querySelectorAll('.sod-fund-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          _stockFundState.activeTab = btn.dataset.fundTab;
          wrap.querySelectorAll('.sod-fund-tab').forEach(b => {
            const tc = IBKR_FUND_TABS.find(t => t.key === b.dataset.fundTab);
            const isActive = b.dataset.fundTab === _stockFundState.activeTab;
            b.classList.toggle('active', isActive);
            if (tc) b.style.cssText = isActive ? `background:${tc.color};color:#fff` : `background:${tc.color}18;color:${tc.color}`;
          });
          loadStockFundTab(_stockFundState.activeTab);
        });
      });
  
      if (_stockState.symbol) {
        loadStockFundTab(_stockFundState.activeTab);
      }
    }
  
    async function loadStockFundTab(tabKey, opts = {}) {
      const symbol = _stockState.symbol;
      if (!symbol) return;
      const cacheKey = _fundCacheKey(symbol, tabKey);
  
      if (!opts.force && _stockFundState.cacheBySymbolTab[cacheKey]) {
        renderStockFundBody(tabKey, _stockFundState.cacheBySymbolTab[cacheKey]);
        return;
      }
  
      if (_stockFundState.inflightByTab[cacheKey]) {
        return _stockFundState.inflightByTab[cacheKey];
      }
  
      _stockFundState.loadingByTab[tabKey] = true;
      const content = _root.querySelector('#sod-fund-content');
      if (content && _stockFundState.activeTab === tabKey) {
        content.innerHTML = `<div class="sod-fund-loading"><span class="material-icons">hourglass_empty</span>${t('fund.loading')}</div>`;
      }
  
      const promise = (async () => {
        try {
          startIBKRKeepAlive();
          const data = await fetchIBKRFundamentalsTab(tabKey, symbol);
          _stockFundState.cacheBySymbolTab[cacheKey] = data;
          if (_stockFundState.activeTab === tabKey && _stockState.symbol === symbol) {
            renderStockFundBody(tabKey, data);
            if (tabKey === 'overview') _loadOverviewExtras(symbol);
          }
        } catch (e) {
          console.warn(TAG, `Fund tab ${tabKey} load failed:`, e.message);
          if (_stockFundState.activeTab === tabKey && _stockState.symbol === symbol) {
            const c = _root.querySelector('#sod-fund-content');
            if (c) c.innerHTML = `<div class="sod-fund-empty" style="color:${COLORS.red}"><span class="material-icons" style="font-size:20px">error_outline</span>${t('fund.error')}: ${e.message}</div>`;
          }
        } finally {
          _stockFundState.loadingByTab[tabKey] = false;
          delete _stockFundState.inflightByTab[cacheKey];
        }
      })();
  
      _stockFundState.inflightByTab[cacheKey] = promise;
      return promise;
    }
  
    async function fetchIBKRFundamentalsTab(tabKey, symbol) {
      const conid = await resolveIBKRConid(symbol);
      if (!conid) throw new Error(t('fund.needIbkr'));
      const base = _ibkrFundBase();
      const landingWidgets = 'financials,profile,key_ratios,ratings,fund_mstar,analyst_forecast,competitors,ownership,dividends,connections';
  
      switch (tabKey) {
        case 'overview': {
          return _ibkrFetch(`${base}fundamentals/landing/${conid}?widgets=${landingWidgets}&lang=en&theme=light`);
        }
        case 'profile':
          return _ibkrFetch(`${base}fundamentals/profile/${conid}`);
        case 'financials': {
          const p = _stockFundState.periodToggles.financials;
          return _ibkrFetch(`${base}fundamentals/financials/${conid}?annual=${p.annual}&type=${p.type}`);
        }
        case 'key_ratios':
          return _ibkrFetch(`${base}fundamentals/key_ratios/${conid}`);
        case 'ratings':
          return _ibkrFetch(`${base}fundamentals/ratings/${conid}?price=true`);
        case 'forecast': {
          const p = _stockFundState.periodToggles.forecast;
          return _ibkrFetch(`${base}fundamentals/analyst_forecasts/${conid}?annual=${p.annual}&all=true`);
        }
        case 'ownership':
          return _ibkrFetch(`${base}fundamentals/ownership/${conid}?max_log=100&filter=all`);
        case 'dividends':
          return _ibkrFetch(`${base}fundamentals/dividends/${conid}`);
        case 'competitors':
          return _ibkrFetch(`${base}fundamentals/landing/${conid}?widgets=competitors&lang=en&theme=light`);
        case 'esg':
          return _ibkrFetch(`${base}impact/esg/${conid}?accounts=`);
        case 'social_sentiment': {
          const now = new Date();
          const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
          const tz = Math.abs(new Date().getTimezoneOffset());
          const [latest, highLow, series] = await Promise.all([
            _ibkrFetch(`${base}sma/request?type=tick&conid=${conid}`).catch(() => _ibkrFetch(`${base}sma/request?type=latest&conid=${conid}`)),
            _ibkrFetch(`${base}sma/request?type=high_low&conid=${conid}`),
            _ibkrFetch(`${base}sma/request?type=search&conid=${conid}&from=${encodeURIComponent(fmt(from))}&to=${encodeURIComponent(fmt(now))}&bar_size=1H&tz=${tz}`),
          ]);
          return { _social: true, latest, highLow, series };
        }
        case 'short_selling':
          return _fetchIBKRShortSellingBundle(conid);
        case 'investment_themes':
          return _fetchIBKRConnectionsBundle(conid);
        case 'tipranks':
        case 'trading_central':
        case 'estimize':
          return { _thirdParty: true, tabKey };
        default:
          throw new Error(`Unknown tab: ${tabKey}`);
      }
    }
  
    async function _fetchIBKRShortSellingBundle(conid) {
      const exchange = 'SMART';
      const secType = 'STK';
      const base = _ibkrFundBase();
      const slbUrl = _ibkrUrl('/cstoolsws/ibgroup.custops.cust.slb/slb/search/');
      const slbBody = JSON.stringify({ source: 'reuters2', conid: String(conid), exchange });
  
      const optionalOrbisaCalls = await Promise.allSettled([
        _ibkrFetch(`${base}orbisa/lending/${conid}`),
        _ibkrFetch(`${base}orbisa/lending/${conid}/widget?codes=UTILIZATION,LENDERDEPTH,AVGDURATION,BORROWERDEPTH&period=MONTH`),
      ]);
      const calls = await Promise.allSettled([
        _ibkrFetch(slbUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json; charset=utf-8' },
          body: slbBody,
        }),
        _ibkrFetch(`${base}hmds/studyLine?conid=${conid}&exchange=${exchange}&secType=${secType}&period=1week&step=30mins&outsideRth=false&source=FeeRate`),
        _ibkrFetch(`${base}hmds/studyLine?conid=${conid}&exchange=${exchange}&secType=${secType}&period=1week&step=30mins&outsideRth=false&source=Inventory`),
        _ibkrFetch(`${base}hmds/lastLine?conid=${conid}&exchange=${exchange}&secType=${secType}&period=1week&step=30mins&outsideRth=false`),
      ]);
  
      const pick = (arr, idx) => arr[idx]?.status === 'fulfilled' ? arr[idx].value : null;
      const bundle = {
        _shortSelling: true,
        conid,
        exchange,
        secType,
        orbisa: pick(optionalOrbisaCalls, 0),
        orbisaWidget: pick(optionalOrbisaCalls, 1),
        slb: pick(calls, 0),
        feeRateTrend: pick(calls, 1),
        inventoryTrend: pick(calls, 2),
        marketTrend: pick(calls, 3),
        _errors: calls
          .map((it, idx) => ({ it, idx }))
          .filter(x => x.it.status === 'rejected')
          .map(x => x.it.reason?.message || `request_${x.idx}_failed`),
        _orbisaErrors: optionalOrbisaCalls
          .map((it, idx) => ({ it, idx }))
          .filter(x => x.it.status === 'rejected')
          .map(x => x.it.reason?.message || `orbisa_${x.idx}_failed`),
      };
  
      const hasData = !!(bundle.slb || bundle.feeRateTrend || bundle.inventoryTrend || bundle.marketTrend || bundle.orbisa || bundle.orbisaWidget);
      if (!hasData) {
        const firstErr = bundle._errors[0] || 'IBKR 400';
        throw new Error(firstErr);
      }
      return bundle;
    }
  
    async function _fetchIBKRConnectionsBundle(conid) {
      const base = _ibkrFundBase();
      const mainUrl = `${base}knowledge-graph/ui/company?conid=${conid}&include=link_info,company_info&lang=en`;
      const fallbackUrl = `${base}knowledge-graph/ui/themes/companies?conid=${conid}&max_themes=200&lang=en`;
      try {
        const data = await _ibkrFetch(mainUrl);
        if (Array.isArray(data?.groups) && data.groups.length) return { _connections: true, ...data };
        const fallback = await _ibkrFetch(fallbackUrl);
        return { _connections: false, ...fallback };
      } catch (_) {
        const fallback = await _ibkrFetch(fallbackUrl);
        return { _connections: false, ...fallback };
      }
    }
  
    function _fmtFundVal(val) {
      if (val == null || val === '' || val === 'N/A') return '—';
      if (typeof val === 'number') {
        if (Math.abs(val) >= 1e12) return (val / 1e12).toFixed(2) + 'T';
        if (Math.abs(val) >= 1e9) return (val / 1e9).toFixed(2) + 'B';
        if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(2) + 'M';
        if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(1) + 'K';
        return Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2);
      }
      return String(val);
    }
  
    function _colorForChange(val) {
      if (val == null) return 'var(--text)';
      const n = parseFloat(val);
      if (isNaN(n)) return 'var(--text)';
      return n > 0 ? COLORS.green : n < 0 ? COLORS.red : 'var(--text2)';
    }
  
    function renderStockFundBody(tabKey, data) {
      const content = _root.querySelector('#sod-fund-content');
      if (!content) return;
      try {
        switch (tabKey) {
          case 'overview':
            content.innerHTML = _renderFundOverview(data);
            content.querySelectorAll('[data-comp-symbol]').forEach(el => {
              el.addEventListener('click', async () => {
                const sym = el.dataset.compSymbol;
                if (sym) await _jumpToStockDetail(sym);
              });
            });
            break;
          case 'profile': content.innerHTML = _renderFundProfile(data); break;
          case 'financials': content.innerHTML = _renderFundFinancials(data); break;
          case 'key_ratios': content.innerHTML = _renderFundKeyRatios(data); break;
          case 'ratings': content.innerHTML = _renderFundRatings(data); break;
          case 'forecast': content.innerHTML = _renderFundForecast(data); break;
          case 'ownership': content.innerHTML = _renderFundOwnership(data); break;
          case 'dividends': content.innerHTML = _renderFundDividends(data); break;
          case 'competitors':
            content.innerHTML = _renderFundCompetitors(data);
            content.querySelectorAll('.sod-fund-comp-card[data-comp-symbol]').forEach(card => {
              card.addEventListener('click', async () => {
                const sym = card.dataset.compSymbol;
                if (sym) await _jumpToStockDetail(sym);
              });
            });
            break;
          case 'esg': content.innerHTML = _renderFundESG(data); break;
          case 'social_sentiment': content.innerHTML = _renderFundSentiment(data); break;
          case 'short_selling': content.innerHTML = _renderFundShortSelling(data); break;
          case 'investment_themes': content.innerHTML = _renderFundThemes(data); break;
          case 'tipranks': case 'trading_central': case 'estimize':
            content.innerHTML = _renderFundThirdParty(tabKey); break;
          default: content.innerHTML = `<div class="sod-fund-empty">${t('fund.noData')}</div>`;
        }
        if (tabKey !== 'social_sentiment') {
          destroyChart('fundSentimentMain');
          destroyChart('fundSentimentVol');
        }
        if (tabKey !== 'short_selling') {
          destroyChart('fundShortSellingTrend');
        }
        _bindFundSubTabEvents(tabKey);
        if (tabKey === 'social_sentiment') {
          _bindFundSentimentEvents(data);
        }
        if (tabKey === 'short_selling') {
          _bindFundShortSellingEvents(data);
        }
        if (tabKey === 'investment_themes') {
          _bindFundThemesEvents(data);
        }
      } catch (e) {
        console.warn(TAG, 'Fund render error:', e);
        content.innerHTML = `<div class="sod-fund-empty" style="color:${COLORS.red}">${t('fund.error')}</div>`;
      }
    }
  
    function _bindFundSubTabEvents(tabKey) {
      const content = _root.querySelector('#sod-fund-content');
      if (!content) return;
      content.querySelectorAll('.sod-fund-subtab').forEach(btn => {
        btn.addEventListener('click', () => {
          const group = btn.dataset.subtabGroup;
          const val = btn.dataset.subtabVal;
          content.querySelectorAll(`.sod-fund-subtab[data-subtab-group="${group}"]`).forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          if (tabKey === 'financials') {
            if (group === 'period') _stockFundState.periodToggles.financials.annual = val === 'annual';
            if (group === 'type') _stockFundState.periodToggles.financials.type = val;
            const ck = _fundCacheKey(_stockState.symbol, 'financials');
            delete _stockFundState.cacheBySymbolTab[ck];
            loadStockFundTab('financials', { force: true });
          }
          if (tabKey === 'forecast') {
            if (group === 'period') _stockFundState.periodToggles.forecast.annual = val === 'annual';
            const ck = _fundCacheKey(_stockState.symbol, 'forecast');
            delete _stockFundState.cacheBySymbolTab[ck];
            loadStockFundTab('forecast', { force: true });
          }
        });
      });
    }
  
    /* ── Fundamentals Tab Renderers ── */
  
    function _unwrapLanding(obj) {
      return obj?.content ?? obj;
    }
  
    function _fundLocale() {
      return getSavedLang() === 'zh' ? 'zh-CN' : 'en-US';
    }
  
    function _localizeRatingText(v) {
      const text = String(v || '');
      if (getSavedLang() !== 'zh' || !text) return text;
      return text
        .replace(/outperform/ig, t('fund.outperform'))
        .replace(/underperform/ig, t('fund.underperform'))
        .replace(/\bbuy\b/ig, t('fund.buy'))
        .replace(/\bhold\b/ig, t('fund.hold'))
        .replace(/\bsell\b/ig, t('fund.sell'));
    }
  
    function _localizeFundFieldLabel(label) {
      const text = String(label || '');
      if (!text) return text;
      if (getSavedLang() !== 'zh') return text;
      const lower = text.toLowerCase();
      if (lower.startsWith('website')) return t('fund.website');
      if (lower.startsWith('incorporated')) return '注册成立';
      if (lower.startsWith('public since')) return '上市时间';
      if (lower.startsWith('common shareholders')) return '普通股股东';
      return text;
    }
  
    function _renderFundOverview(d) {
      const about = _unwrapLanding(d?.about) || _unwrapLanding(d?.profile) || {};
      const fin = _unwrapLanding(d?.financial) || {};
      const kr = _unwrapLanding(d?.key_ratios) || {};
      const divData = _unwrapLanding(d?.dividends) || {};
      const af = _unwrapLanding(d?.analyst_forecast) || {};
      const rt = _unwrapLanding(d?.ratings) || {};
      const own = _unwrapLanding(d?.ownership) || {};
      const comp = _unwrapLanding(d?.competitors) || {};
      const esg = d?._esg || {};
      const newsData = d?._news || {};
      const sma = d?._sma || {};
  
      let html = '';
      const ovPalette = [COLORS.blue, COLORS.purple, COLORS.teal, COLORS.orange, COLORS.pink, COLORS.indigo];
      const mkOvCard = ({ label = '', value = '—', sub = '', color = COLORS.blue, cardStyle = '', valueStyle = '', labelStyle = '', subStyle = '' }) =>
        `<div class="sod-fund-metric sod-fund-ov-kpi" style="--ov-color:${color};--ov-tint:${color}1a;${cardStyle}">
          <div class="sod-fund-metric-label" style="${labelStyle}">${label}</div>
          <div class="sod-fund-metric-value" style="${valueStyle}">${value}</div>
          ${sub ? `<div class="sod-fund-metric-sub" style="${subStyle}">${sub}</div>` : ''}
        </div>`;
  
      // ── 1. About ──
      const aboutText = about.about || about.businessSummary || (typeof about === 'string' ? about : '');
      if (aboutText) {
        html += `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${COLORS.blue}"><span class="material-icons">info</span> ${t('fund.about')}</div>
          <div class="sod-fund-profile-desc">${aboutText.substring(0, 500)}${aboutText.length > 500 ? '...' : ''}</div>
        </div>`;
      }
  
      // ── 2. Key Ratios ──
      const krContent = kr?.data || [];
      if (krContent.length) {
        html += `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${COLORS.orange}"><span class="material-icons">bar_chart</span> ${t('fund.keyMetrics')}</div>
          <div class="sod-fund-metrics">${krContent.map((item, idx) =>
            mkOvCard({
              label: item.name || '',
              value: item.value ?? '—',
              sub: item.indAvg != null ? `${t('fund.vsIndustry')}: ${item.indAvg}` : '',
              color: ovPalette[idx % ovPalette.length],
            })
          ).join('')}</div>
        </div>`;
      }
  
      // ── 3. Dividends ──
      const dd = divData?.dividend_data;
      if (dd || divData?.formatted_yield_ttm) {
        const exDate = divData.last_dividend_date || dd?.ex_divident_date;
        const exDateStr = exDate ? `${exDate.m || ''} ${exDate.d || ''}, ${exDate.y || ''}` : '—';
        const divCards = [
          { label: t('fund.dividendDate'), value: exDateStr, color: COLORS.purple, valueStyle: 'font-size:13px' },
          { label: t('fund.nextDividend'), value: dd?.formatted_next_payment || '—', color: COLORS.green },
          { label: t('fund.dividendYieldTtm'), value: divData.formatted_yield_ttm || '—', color: COLORS.blue },
          { label: t('fund.dividendTtm'), value: dd?.formatted_annual_dividend_ttm || '—', color: COLORS.teal },
          { label: t('fund.payoutRatio'), value: divData.formatted_payout_ratio || '—', color: COLORS.orange },
        ];
        html += `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${COLORS.purple}"><span class="material-icons">payments</span> ${t('fund.dividends')}</div>
          <div class="sod-fund-metrics">
            ${divCards.map(card => mkOvCard(card)).join('')}
          </div>
        </div>`;
      }
  
      // ── 4. ESG Ratings (lazy-loaded) ──
      html += `<div id="sod-fund-ov-esg">${esg?.content?.length ? _renderOverviewEsg(esg) : _overviewPlaceholder('eco', t('fund.esgRatings'), COLORS.teal)}</div>`;
  
      // ── 5. Financials ──
      const finRows = fin?.data || [];
      if (finRows.length) {
        html += `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${COLORS.blue}"><span class="material-icons">account_balance</span> ${t('fund.financials')}</div>
          <div class="sod-fund-table-wrap"><table class="sod-fund-table"><thead><tr><th></th><th>${t('fund.current')}</th>${finRows[0]?.trend?.length ? finRows[0].trend.slice(-3, -1).map(t => `<th>${t.year}</th>`).join('') : ''}</tr></thead><tbody>
          ${finRows.map(row => {
            const trendCells = row.trend?.length ? row.trend.slice(-3, -1).map(t => `<td>${t.formatted_value || '—'}</td>`).join('') : '';
            return `<tr><td>${row.name || ''}</td><td style="font-weight:700">${row.current || '—'}</td>${trendCells}</tr>`;
          }).join('')}
          </tbody></table></div>
        </div>`;
      }
  
      // ── 6. Analyst Ratings ──
      const summary = rt?.summary;
      const logEntries = rt?.log?.logEntries || [];
      if (summary || logEntries.length) {
        html += `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${COLORS.yellow}"><span class="material-icons">star_rate</span> ${t('fund.analystRatings')}</div>`;
        if (summary) {
          const targets = summary.targets || [];
          const avgTarget = targets.find(t => t.kind === 'AVG');
          const highTarget = targets.find(t => t.kind === 'HIGH');
          const lowTarget = targets.find(t => t.kind === 'LOW');
          const rawConsensus = String(summary.consensus || '');
          const consensus = _localizeRatingText(rawConsensus);
          const total = summary.recsum || (summary.buy + summary.sell + summary.hold) || 0;
          const consColor = rawConsensus.toLowerCase().includes('buy') ? COLORS.green : rawConsensus.toLowerCase().includes('sell') ? COLORS.red : COLORS.yellow;
          html += `<div class="sod-fund-metrics" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-bottom:8px">`;
          if (avgTarget) {
            html += mkOvCard({
              label: t('fund.avgTarget'),
              value: `${summary.currency || '$'}${avgTarget.formatted_abs}`,
              sub: avgTarget.formatted_rel,
              color: COLORS.green,
            });
          }
          html += mkOvCard({
            label: t('fund.consensus'),
            value: consensus,
            sub: t('fund.ratingsBasedOn', total),
            color: consColor,
          });
          if (highTarget && lowTarget) {
            html += mkOvCard({
              label: t('fund.range'),
              value: `${summary.currency || '$'}${lowTarget.formatted_abs} — ${summary.currency || '$'}${highTarget.formatted_abs}`,
              color: COLORS.orange,
              valueStyle: 'font-size:12px',
            });
          }
          html += `</div>`;
          if (summary.buy || summary.hold || summary.sell) {
            const bPct = total ? (summary.buy / total * 100) : 0;
            const hPct = total ? (summary.hold / total * 100) : 0;
            const sPct = total ? (summary.sell / total * 100) : 0;
            html += `<div class="sod-fund-rating-bar">
              ${bPct ? `<div class="sod-fund-rating-seg" style="flex:${bPct};background:${COLORS.green}">${summary.buy}</div>` : ''}
              ${hPct ? `<div class="sod-fund-rating-seg" style="flex:${hPct};background:${COLORS.yellow}">${summary.hold}</div>` : ''}
              ${sPct ? `<div class="sod-fund-rating-seg" style="flex:${sPct};background:${COLORS.red}">${summary.sell}</div>` : ''}
            </div>
            <div class="sod-fund-rating-legend">
              <div class="sod-fund-rating-legend-item"><div class="sod-fund-rating-dot" style="background:${COLORS.green}"></div>${t('fund.buy')} ${summary.buy}</div>
              <div class="sod-fund-rating-legend-item"><div class="sod-fund-rating-dot" style="background:${COLORS.yellow}"></div>${t('fund.hold')} ${summary.hold}</div>
              <div class="sod-fund-rating-legend-item"><div class="sod-fund-rating-dot" style="background:${COLORS.red}"></div>${t('fund.sell')} ${summary.sell}</div>
            </div>`;
          }
        }
        if (logEntries.length) {
          html += `<div class="sod-fund-table-wrap" style="margin-top:8px"><table class="sod-fund-table"><thead><tr><th>${t('fund.firm')}</th><th>${t('fund.rating')}</th><th>${t('fund.target')}</th><th>${t('fund.date')}</th></tr></thead><tbody>
          ${logEntries.slice(0, 6).map(e => {
            const color = (e.rating || '').toLowerCase().includes('outperform') || (e.rating || '').toLowerCase().includes('buy') ? COLORS.green : (e.rating || '').toLowerCase().includes('underperform') || (e.rating || '').toLowerCase().includes('sell') ? COLORS.red : COLORS.yellow;
            return `<tr><td>${e.firm || ''}</td><td style="color:${color};font-weight:700">${_localizeRatingText(e.rating || '')}</td><td>${e.formatted_abs ? '$' + e.formatted_abs : (e.abs ? '$' + e.abs : '')}</td><td>${e.date || ''}</td></tr>`;
          }).join('')}
          </tbody></table></div>`;
        }
        html += `</div>`;
      }
  
      // ── 7. Forecast: EPS ──
      const periods = af?.periods || [];
      if (periods.length) {
        html += `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${COLORS.teal}"><span class="material-icons">trending_up</span> ${t('fund.forecastEps')}</div>
          <div class="sod-fund-table-wrap"><table class="sod-fund-table"><thead><tr><th>${t('fund.period')}</th><th>${t('fund.estimate')}</th><th>${t('fund.actual')}</th><th>${t('fund.surprise')}</th></tr></thead><tbody>
          ${periods.map(p => {
            const surprise = p.formatted_suprise || (p.suprise != null ? String(p.suprise) : '');
            const surpriseColor = p.suprise > 0 ? COLORS.green : p.suprise < 0 ? COLORS.red : 'var(--text2)';
            return `<tr><td>${p.title || ''}</td><td>${p.formatted_estimate || '—'}</td><td>${p.formatted_actual || '—'}</td><td style="color:${surpriseColor};font-weight:600">${surprise || '—'}</td></tr>`;
          }).join('')}
          </tbody></table></div>
        </div>`;
      }
  
      // ── 8. News (lazy-loaded) ──
      html += `<div id="sod-fund-ov-news">${newsData?.news?.content?.length ? _renderOverviewNews(newsData) : _overviewPlaceholder('article', t('fund.news'), COLORS.blue)}</div>`;
  
      // ── 9. Ownership ──
      const ownSummary = own?.summary || [];
      if (ownSummary.length) {
        html += `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${COLORS.indigo}"><span class="material-icons">pie_chart</span> ${t('fund.ownership')}</div>
          <div class="sod-fund-metrics">
          ${ownSummary.map(s => {
            const colors = { 'Strat. Entit.': COLORS.purple, 'Institutions': COLORS.blue, 'Others': COLORS.orange };
            const color = colors[s.name] || COLORS.teal;
            return `<div class="sod-fund-metric sod-fund-ov-kpi" style="text-align:center;--ov-color:${color};--ov-tint:${color}1a"><div class="sod-fund-metric-value">${s.formatted_value || _fmtFundVal(s.value) + '%'}</div><div class="sod-fund-metric-label" style="margin-top:4px">${s.name}</div></div>`;
          }).join('')}
          </div>`;
        const topHolders = own?.top?.data || [];
        if (topHolders.length) {
          html += `<div class="sod-fund-table-wrap" style="margin-top:6px"><table class="sod-fund-table"><thead><tr><th>${_localizeFundFieldLabel(own.top?.title) || t('fund.topHolders')}</th><th>%</th></tr></thead><tbody>
          ${topHolders.map(h => `<tr><td>${h.name}</td><td style="font-weight:700">${h.formatted_value || ''}</td></tr>`).join('')}
          </tbody></table></div>`;
        }
        html += `</div>`;
      }
  
      // ── 10. Competitors ──
      const compList = comp?.competitors || [];
      if (compList.length) {
        html += `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${COLORS.indigo}"><span class="material-icons">compare_arrows</span> ${t('fund.competitors')}</div>
          <div class="sod-fund-table-wrap"><table class="sod-fund-table"><thead><tr><th>${t('fund.ticker')}</th><th>${t('fund.company')}</th><th>${t('fund.industry')}</th><th>${t('fund.marketCap')}</th></tr></thead><tbody>
          ${compList.slice(0, 6).map(c => `<tr><td><span class="sod-fund-ov-comp-sym sod-clickable-sym" data-comp-symbol="${c.ticker || ''}" style="color:${COLORS.blue};font-weight:700;cursor:pointer">${c.ticker || ''}</span></td><td style="font-weight:400;font-size:10px">${c.name || ''}</td><td style="font-size:10px">${c.industry || ''}</td><td style="font-weight:700">${c.formattedCap || ''}</td></tr>`).join('')}
          </tbody></table></div>
        </div>`;
      }
  
      // ── 11. Social Sentiment (lazy-loaded) ──
      html += `<div id="sod-fund-ov-sma">${sma?.sscore != null ? _renderOverviewSma(sma) : _overviewPlaceholder('forum', t('fund.socialSentiment'), COLORS.purple)}</div>`;
  
      if (!html) html = `<div class="sod-fund-empty">${t('fund.noData')}</div>`;
      return html;
    }
  
    function _overviewPlaceholder(icon, title, color) {
      return `<div class="sod-fund-section"><div class="sod-fund-section-title" style="color:${color}"><span class="material-icons">${icon}</span> ${title}</div><div style="display:flex;align-items:center;gap:6px;padding:8px 0;color:var(--text3);font-size:11px"><span class="material-icons" style="font-size:14px;animation:spin 1s linear infinite">hourglass_empty</span>${t('market.loading')}</div></div>`;
    }
  
    function _renderOverviewEsg(esg) {
      const esgContent = esg?.content || [];
      if (!esgContent.length) return '';
      const esgMap = {};
      for (const item of esgContent) esgMap[item.name] = item;
      const scores = [
        { l: t('fund.environmental'), v: esgMap['TRESGENS']?.value },
        { l: t('fund.social'), v: esgMap['TRESGSOS']?.value },
        { l: t('fund.governance'), v: esgMap['TRESGCGS']?.value },
        { l: t('fund.esg'), v: esgMap['TRESGS']?.value },
        { l: t('fund.controversy'), v: esgMap['TRESGCS']?.value },
      ].filter(s => s.v != null);
      if (!scores.length) return '';
      const _c = v => v >= 7 ? COLORS.green : v >= 4 ? COLORS.yellow : COLORS.red;
      return `<div class="sod-fund-section"><div class="sod-fund-section-title" style="color:${COLORS.teal}"><span class="material-icons">eco</span> ${t('fund.esgRatings')}</div><div class="sod-fund-metrics">${scores.map(s =>
        `<div class="sod-fund-metric sod-fund-ov-kpi" style="text-align:center;--ov-color:${_c(s.v)};--ov-tint:${_c(s.v)}1a"><div class="sod-fund-metric-value" style="font-size:22px">${s.v}</div><div class="sod-fund-metric-label" style="margin-top:4px">${s.l}</div></div>`
      ).join('')}</div></div>`;
    }
  
    function _renderOverviewNews(newsData) {
      const newsItems = newsData?.news?.content || [];
      if (!newsItems.length) return '';
      return `<div class="sod-fund-section"><div class="sod-fund-section-title" style="color:${COLORS.blue}"><span class="material-icons">article</span> ${t('fund.news')}</div><div style="display:flex;flex-direction:column;gap:2px">${newsItems.slice(0, 5).map(n => {
        const dt = n.time ? new Date(n.time) : null;
        const timeStr = dt ? dt.toLocaleString(_fundLocale(), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
        return `<div style="padding:5px 0;border-bottom:1px solid var(--border)"><div style="font-size:11px;font-weight:600;line-height:1.4">${n.headlineContent || ''}</div><div style="font-size:9px;color:var(--text3);margin-top:2px">${timeStr}${n.source ? ' | ' + n.source : ''}</div></div>`;
      }).join('')}</div></div>`;
    }
  
    function _renderOverviewSma(sma) {
      if (!sma || sma.sscore == null) return '';
      const _smaColor = (v) => v > 0 ? COLORS.green : v < 0 ? COLORS.red : 'var(--text2)';
      const _smaPct = (v) => v != null ? (v > 0 ? '+' : '') + (v * 100).toFixed(2) + '%' : '—';
      return `<div class="sod-fund-section"><div class="sod-fund-section-title" style="color:${COLORS.purple}"><span class="material-icons">forum</span> ${t('fund.socialSentiment')}</div><div class="sod-fund-table-wrap"><table class="sod-fund-table"><thead><tr><th></th><th>${t('fund.sScore')}</th><th>${t('market.change')}</th><th>${t('fund.industry')}</th><th>${t('fund.indChange')}</th></tr></thead><tbody>
        <tr><td>${t('fund.sentiment')}</td><td style="color:${_smaColor(sma.sscore)};font-weight:700">${sma.sscore?.toFixed(3) ?? '—'}</td><td style="color:${_smaColor(sma.schange)}">${_smaPct(sma.schange / 100)}</td><td style="color:${_smaColor(sma.ind_sscore)};font-weight:700">${sma.ind_sscore?.toFixed(3) ?? '—'}</td><td style="color:${_smaColor(sma.ind_schange)}">${_smaPct(sma.ind_schange / 100)}</td></tr>
        <tr><td>${t('fund.volumeMetric')}</td><td style="color:${_smaColor(sma.svscore)};font-weight:700">${sma.svscore?.toFixed(3) ?? '—'}</td><td style="color:${_smaColor(sma.svchange)}">${_smaPct(sma.svchange / 100)}</td><td style="color:${_smaColor(sma.ind_svscore)};font-weight:700">${sma.ind_svscore?.toFixed(3) ?? '—'}</td><td style="color:${_smaColor(sma.ind_svchange)}">${_smaPct(sma.ind_svchange / 100)}</td></tr>
        <tr><td>${t('fund.delta15m')}</td><td style="color:${_smaColor(sma.sdelta)};font-weight:700">${sma.sdelta?.toFixed(4) ?? '—'}</td><td></td><td style="color:${_smaColor(sma.ind_sdelta)};font-weight:700">${sma.ind_sdelta?.toFixed(4) ?? '—'}</td><td></td></tr>
      </tbody></table></div></div>`;
    }
  
    async function _loadOverviewExtras(symbol) {
      const conid = await resolveIBKRConid(symbol);
      if (!conid) return;
      const base = _ibkrFundBase();
      const cacheKey = _fundCacheKey(symbol, 'overview');
      const _inject = (id, html) => {
        if (_stockFundState.activeTab !== 'overview' || _stockState.symbol !== symbol) return;
        const el = _root.querySelector(`#${id}`);
        if (el) el.innerHTML = html;
      };
      const extras = [
        { key: '_esg', id: 'sod-fund-ov-esg', url: `${base}impact/esg/${conid}?accounts=`, render: _renderOverviewEsg },
        { key: '_news', id: 'sod-fund-ov-news', url: `${base}news2/landing/${conid}?widgets=news,tear_sheet&lang=en`, render: _renderOverviewNews },
        { key: '_sma', id: 'sod-fund-ov-sma', url: `${base}sma/request?type=latest&conid=${conid}`, render: _renderOverviewSma },
      ];
      for (const ex of extras) {
        _ibkrFetch(ex.url).then(data => {
          const cached = _stockFundState.cacheBySymbolTab[cacheKey];
          if (cached) cached[ex.key] = data;
          _inject(ex.id, ex.render(data));
        }).catch(() => _inject(ex.id, ''));
      }
    }
  
    function _renderFundProfile(d) {
      let html = '';
      const sym = _stockState.symbol || '';
      // API 返回结构: header.value 存公司名，非 generalInformation.companyName
      const name = d?.header?.value || d?.generalInformation?.companyName || d?.companyName || sym;
      // industryClassification.values 是数组 [{name, value}, ...]，TRBC 为主分类
      const icValues = d?.industryClassification?.values || [];
      const sector = icValues.find(v => v.name === 'TRBC')?.value || '';
      const industry = icValues.find(v => v.name === 'NAICS1997')?.value || '';
      // generalInformation.values 是数组，员工数从中查找
      const giValues = d?.generalInformation?.values || [];
      const employees = giValues.find(v => v.name?.startsWith('Employees'))?.value || '';
      // contactInfo.value 嵌套对象，地址是数组，website 是 {name, value}
      const ci = d?.contactInfo?.value || {};
      const addrArr = ci.address || [];
      const hq = addrArr.filter(Boolean).join(', ');
      const website = ci.website?.value || '';
  
      html += `<div class="sod-fund-profile-header">
        <div class="sod-fund-profile-logo">${sym.charAt(0)}</div>
        <div class="sod-fund-profile-info">
          <div class="sod-fund-profile-name">${name}</div>
          <div class="sod-fund-profile-meta">
            ${sector ? `<span class="sod-fund-profile-tag" style="background:${COLORS.blue}18;color:${COLORS.blue}">${sector}</span>` : ''}
            ${industry ? `<span class="sod-fund-profile-tag" style="background:${COLORS.purple}18;color:${COLORS.purple}">${industry}</span>` : ''}
          </div>
        </div>
      </div>`;
  
      // businessSummary 是 {name, value} 对象，需取 .value
      const bizSummary = typeof d?.businessSummary === 'string' ? d.businessSummary : d?.businessSummary?.value || '';
      if (bizSummary) {
        html += `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${COLORS.teal}"><span class="material-icons">description</span> ${t('fund.description')}</div>
          <div class="sod-fund-profile-desc">${bizSummary}</div>
        </div>`;
      }
  
      // financialSummary 同样是 {name, value} 对象
      const finSummary = typeof d?.financialSummary === 'string' ? d.financialSummary : d?.financialSummary?.value || '';
      if (finSummary) {
        html += `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${COLORS.indigo}"><span class="material-icons">summarize</span> ${t('fund.financialSummary')}</div>
          <div class="sod-fund-profile-desc">${finSummary}</div>
        </div>`;
      }
  
      const infoItems = [];
      if (employees) infoItems.push({ icon: 'groups', label: t('fund.employees'), value: _fmtFundVal(Number(employees)) });
      if (hq) infoItems.push({ icon: 'location_on', label: t('fund.headquarters'), value: hq });
      if (website) infoItems.push({ icon: 'language', label: t('fund.website'), value: `<a href="${website}" target="_blank" style="color:${COLORS.blue}">${website}</a>` });
      // 渲染 generalInformation 的其他字段（Incorporated, Public since 等）
      for (const gi of giValues) {
        if (!gi.name?.startsWith('Employees') && gi.value) {
          infoItems.push({ icon: 'info', label: _localizeFundFieldLabel(gi.name), value: gi.value });
        }
      }
  
      if (infoItems.length) {
        html += `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${COLORS.indigo}"><span class="material-icons">info</span> ${t('fund.general')}</div>
          <div class="sod-fund-metrics">${infoItems.map(i =>
            `<div class="sod-fund-metric">
              <div class="sod-fund-metric-label"><span class="material-icons" style="font-size:12px;vertical-align:-2px;color:var(--kpi-color,${COLORS.blue})">${i.icon}</span> ${i.label}</div>
              <div class="sod-fund-metric-value" style="font-size:12px">${i.value}</div>
            </div>`
          ).join('')}</div>
        </div>`;
      }
  
      const dirObj = d?.directors || {};
      const directors = dirObj?.values || (Array.isArray(dirObj) ? dirObj : []);
      if (directors.length) {
        html += `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${COLORS.pink}"><span class="material-icons">people</span> ${_localizeFundFieldLabel(dirObj.name) || t('fund.directorsOfficers')}</div>
          <div class="sod-fund-table-wrap"><table class="sod-fund-table"><thead><tr><th>${t('fund.name')}</th><th>${t('fund.titleCol')}</th><th>${t('fund.since')}</th></tr></thead><tbody>
          ${directors.slice(0, 15).map(dir => `<tr><td>${dir.name || ''}</td><td>${dir.currentTitle || dir.title || ''}</td><td>${dir.since || ''}</td></tr>`).join('')}
          </tbody></table></div>
        </div>`;
      }
  
      return html || `<div class="sod-fund-empty">${t('fund.noData')}</div>`;
    }
  
    function _renderFundFinancials(d) {
      const p = _stockFundState.periodToggles.financials;
      const types = [
        { key: 'income', label: t('fund.incomeStatement') },
        { key: 'balance', label: t('fund.balanceSheet') },
        { key: 'cash', label: t('fund.cashFlow') },
      ];
  
      const kpiPalette = [COLORS.blue, COLORS.purple, COLORS.teal, COLORS.orange, COLORS.pink, COLORS.indigo];
  
      let html = `<div class="sod-fund-fin-toolbar">
        <div class="sod-fund-subtabs sod-fund-fin-subtabs-left">
          <button class="sod-fund-subtab${!p.annual ? ' active' : ''}" data-subtab-group="period" data-subtab-val="quarterly">${t('fund.quarterly')}</button>
          <button class="sod-fund-subtab${p.annual ? ' active' : ''}" data-subtab-group="period" data-subtab-val="annual">${t('fund.annual')}</button>
        </div>
        <div class="sod-fund-subtabs sod-fund-fin-subtabs-right">
          ${types.map(ty => `<button class="sod-fund-subtab${p.type === ty.key ? ' active' : ''}" data-subtab-group="type" data-subtab-val="${ty.key}">${ty.label}</button>`).join('')}
        </div>
      </div>`;
  
      const fmtDate = (v) => {
        const s = String(v || '');
        if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
        return s;
      };
  
      const summary = Array.isArray(d?.generalInfo) ? d.generalInfo : [];
      if (summary.length) {
        html += `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${COLORS.green}"><span class="material-icons">account_balance</span> ${t('fund.financials')}</div>
          <div class="sod-fund-metrics sod-fund-fin-summary">${summary.map((item, idx) => {
          const kpiColor = kpiPalette[idx % kpiPalette.length];
          const ch = typeof item?.valueChange === 'number' ? item.valueChange : parseFloat(item?.valueChange);
          const chColor = !isNaN(ch) ? _colorForChange(ch) : 'var(--text3)';
          const chText = !isNaN(ch) ? `${ch > 0 ? '+' : ''}${ch.toFixed(2)}%` : '—';
          const dateText = item?.date ? ` · ${fmtDate(item.date)}` : '';
          return `<div class="sod-fund-metric sod-fund-fin-kpi" style="--kpi-color:${kpiColor};--kpi-tint:${kpiColor}1a">
            <div class="sod-fund-metric-label">${item?.name || ''}</div>
            <div class="sod-fund-metric-value" style="font-size:18px">${item?.value || '—'}</div>
            <div class="sod-fund-metric-sub" style="color:${chColor}">${chText}${dateText}</div>
          </div>`;
        }).join('')}</div></div>`;
      }
  
      const table = d?.table || {};
      const rows = Array.isArray(table.rows) ? table.rows : [];
      if (!rows.length) {
        return html + `<div class="sod-fund-empty">${t('fund.noData')}</div>`;
      }
  
      const columns = (Array.isArray(table.columns) ? table.columns : []).map((c, idx) => {
        if (typeof c === 'string') return { key: c, label: c, raw: c, idx };
        const key = c?.key || c?.name || c?.field || String(idx);
        const label = c?.value || c?.label || c?.title || c?.name || key;
        return { key, label, raw: c, idx };
      });
      if (!columns.length) {
        return html + `<div class="sod-fund-empty">${t('fund.noData')}</div>`;
      }
  
      const getRowValue = (row, col, idx) => {
        if (Array.isArray(row?.values)) return row.values[idx];
        if (Array.isArray(row)) return row[idx];
        if (!row || typeof row !== 'object') return idx === 0 ? row : '';
        if (Object.prototype.hasOwnProperty.call(row, col.key)) return row[col.key];
        if (col.raw?.name && Object.prototype.hasOwnProperty.call(row, col.raw.name)) return row[col.raw.name];
        return row[idx] ?? '';
      };
  
      const fmtTrend = (trend) => {
        const nums = trend.map(pnt => (typeof pnt?.value === 'number' ? pnt.value : NaN)).filter(n => !isNaN(n));
        if (nums.length < 2) return '—';
        const bars = '▁▂▃▄▅▆▇█';
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        return nums.map(n => {
          const ratio = max === min ? 0.5 : (n - min) / (max - min);
          const i = Math.max(0, Math.min(bars.length - 1, Math.round(ratio * (bars.length - 1))));
          return bars[i];
        }).join('');
      };
  
      const fmtCell = (val, colKey) => {
        if (val == null || val === '') return { text: '—', cls: '' };
        const key = String(colKey || '').toLowerCase();
  
        if (Array.isArray(val)) {
          if (key === 'trend') {
            return { text: `<span class="sod-fund-fin-trend">${fmtTrend(val)}</span>`, cls: '' };
          }
          const text = val.map(v => v?.formatted_value || v?.value || '').filter(Boolean).join(' / ');
          return { text: text || '—', cls: '' };
        }
  
        if (typeof val === 'object') val = val.formatted_value ?? val.value ?? '';
  
        if (key === 'change') {
          const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, '').replace('%', ''));
          if (isNaN(num)) return { text: String(val), cls: '' };
          return {
            text: `${num > 0 ? '+' : ''}${num.toFixed(2)}%`,
            cls: num > 0 ? 'positive' : num < 0 ? 'negative' : '',
          };
        }
  
        const text = String(val);
        const num = parseFloat(text.replace(/[,%]/g, ''));
        const cls = !isNaN(num) ? (num > 0 ? 'positive' : num < 0 ? 'negative' : '') : '';
        return { text, cls };
      };
  
      html += `<div class="sod-fund-section">
        <div class="sod-fund-section-title" style="color:${COLORS.indigo}"><span class="material-icons">table_chart</span> ${types.find(ty => ty.key === p.type)?.label || t('fund.financials')} ${p.annual ? `(${t('fund.annual')})` : `(${t('fund.quarterly')})`}</div>
        <div class="sod-fund-table-wrap"><table class="sod-fund-table sod-fund-fin-table"><thead><tr>
        ${columns.map(c => `<th>${c.label || c.key}</th>`).join('')}
      </tr></thead><tbody>`;
      for (const row of rows) {
        const isSummary = !!row?.isSummary;
        html += `<tr${isSummary ? ' class="sod-fund-fin-row-summary"' : ''}>${columns.map((col, i) => {
          const cell = fmtCell(getRowValue(row, col, i), col.key);
          if (i === 0) {
            return `<td class="sod-fund-fin-cell-metric" style="font-weight:${isSummary ? '700' : '600'}">${cell.text}</td>`;
          }
          return `<td class="${cell.cls}" style="${isSummary ? 'font-weight:700' : ''}">${cell.text}</td>`;
        }).join('')}</tr>`;
      }
      html += '</tbody></table></div></div>';
      return html;
    }
  
    function _renderFundKeyRatios(d) {
      const tables = d?.tables || [];
      if (!tables.length) return `<div class="sod-fund-empty">${t('fund.noData')}</div>`;
      const metaBits = [d?.interim_date, d?.annual_date, d?.currency].filter(Boolean);
      const fmtRatioCell = (val) => {
        if (val == null || val === '') return '—';
        if (typeof val === 'number') return _fmtFundVal(val);
        if (typeof val === 'string') return val;
        if (Array.isArray(val)) {
          if (val.length && val.every(x => x && typeof x === 'object' && (x.value != null || x.year != null))) {
            const first = val[0];
            const last = val[val.length - 1];
            const firstNum = Number(first?.value);
            const lastNum = Number(last?.value);
            if (Number.isFinite(lastNum)) {
              if (Number.isFinite(firstNum) && firstNum !== 0) {
                const pct = ((lastNum - firstNum) / Math.abs(firstNum)) * 100;
                return `${lastNum.toFixed(2)} (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`;
              }
              return lastNum.toFixed(2);
            }
          }
          return val.map(x => {
            if (x == null) return '';
            if (typeof x === 'object') return x.display_text ?? x.value ?? x.label ?? x.name ?? '';
            return String(x);
          }).filter(Boolean).join(', ') || '—';
        }
        if (typeof val === 'object') {
          if (val.display_text != null) return String(val.display_text);
          if (val.value != null && typeof val.value !== 'object') return _fmtFundVal(val.value);
          return '—';
        }
        return String(val);
      };
      let html = metaBits.length
        ? `<div style="font-size:10px;color:var(--text3);margin-bottom:8px">${metaBits.join(' · ')}</div>`
        : '';
  
      for (const tbl of tables) {
        const cols = (tbl.columns || []).map(c => {
          if (typeof c === 'string') return { key: c, label: c };
          return {
            key: c?.name || c?.key || c?.value || '',
            label: c?.value || c?.label || c?.name || '',
          };
        });
        if (!cols.length) continue;
  
        html += `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${COLORS.orange}"><span class="material-icons">pie_chart</span> ${tbl.title || ''}</div>
          <div class="sod-fund-table-wrap"><table class="sod-fund-table"><thead><tr>`;
        html += cols.map(c => `<th>${c.label || c.key}</th>`).join('');
        html += '</tr></thead><tbody>';
        for (const row of (tbl.rows || [])) {
          const vals = row?.values || row;
          const mapped = Array.isArray(vals)
            ? vals
            : cols.map((c, i) => {
                if (vals?.[c.key] != null) return vals[c.key];
                if (c.key === 'relativeToInd' && vals?.vs != null) return `${Number(vals.vs).toFixed(2)}%`;
                return vals?.[i] ?? '';
              });
  
          html += `<tr>${mapped.map((v, i) => {
            const txt = fmtRatioCell(v);
            if (i === 0) return `<td>${txt}</td>`;
            if (cols[i]?.key === 'fiveYearTrend') return `<td class="sod-fund-fin-trend">${txt}</td>`;
            const num = typeof txt === 'number'
              ? txt
              : parseFloat(String(txt).replace(/[,$%]/g, '').replace(/,/g, ''));
            const cls = Number.isFinite(num) ? (num > 0 ? 'positive' : num < 0 ? 'negative' : '') : '';
            return `<td class="${cls}">${txt}</td>`;
          }).join('')}</tr>`;
        }
        html += '</tbody></table></div></div>';
      }
      return html || `<div class="sod-fund-empty">${t('fund.noData')}</div>`;
    }
  
    function _renderFundRatings(d) {
      const summary = d?.summary || {};
      const detailsRows = Array.isArray(d?.details?.rows) ? d.details.rows : [];
      const byName = {};
      for (const row of detailsRows) {
        const name = row?.header?.display_text || row?.header?.label;
        if (name) byName[String(name).toUpperCase()] = row;
      }
      const pickCurrent = (k) => {
        const v = byName[k]?.c?.display_text;
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : 0;
      };
  
      const ratingLabels = [t('fund.buy'), t('fund.outperform'), t('fund.hold'), t('fund.underperform'), t('fund.sell')];
      const ratingColors = [COLORS.green, '#6BD68B', COLORS.yellow, COLORS.orange, COLORS.red];
      const dist = [
        pickCurrent('BUY'),
        pickCurrent('OUTPERFORM'),
        pickCurrent('HOLD'),
        pickCurrent('UNDERPERFORM'),
        pickCurrent('SELL'),
      ];
      const total = summary?.recsum || dist.reduce((a, b) => a + b, 0);
      const tgt = Array.isArray(summary?.targets) ? summary.targets : [];
      const tAvg = tgt.find(x => x.kind === 'AVG');
      const tHigh = tgt.find(x => x.kind === 'HIGH');
      const tLow = tgt.find(x => x.kind === 'LOW');
  
      let html = `<div class="sod-fund-section">
        <div class="sod-fund-section-title" style="color:${COLORS.yellow}"><span class="material-icons">star_rate</span> ${t('fund.consensus')}</div>
        <div class="sod-fund-metrics">
          <div class="sod-fund-metric"><div class="sod-fund-metric-label">${t('fund.consensus')}</div><div class="sod-fund-metric-value" style="color:${COLORS.orange}">${_localizeRatingText(summary?.consensus || '') || '—'}</div></div>
          <div class="sod-fund-metric"><div class="sod-fund-metric-label">${t('fund.analysts')}</div><div class="sod-fund-metric-value" style="color:${COLORS.purple}">${total || '—'}</div></div>
          <div class="sod-fund-metric"><div class="sod-fund-metric-label">${t('fund.avgTarget')}</div><div class="sod-fund-metric-value" style="color:${COLORS.blue}">${tAvg?.formatted_abs ? '$' + tAvg.formatted_abs : '—'}</div></div>
          <div class="sod-fund-metric"><div class="sod-fund-metric-label">${t('fund.targetRange')}</div><div class="sod-fund-metric-value" style="color:${COLORS.teal};font-size:13px">${tLow?.formatted_abs && tHigh?.formatted_abs ? `$${tLow.formatted_abs} - $${tHigh.formatted_abs}` : '—'}</div></div>
        </div>
        <div class="sod-fund-rating-bar">${dist.map((v, i) =>
          `<div class="sod-fund-rating-seg" style="flex:${v || 0.5};background:${ratingColors[i]}">${v > 0 ? v : ''}</div>`
        ).join('')}</div>
        <div class="sod-fund-rating-legend">${dist.map((v, i) =>
          `<div class="sod-fund-rating-legend-item"><div class="sod-fund-rating-dot" style="background:${ratingColors[i]}"></div>${ratingLabels[i]}: ${v}</div>`
        ).join('')}</div>
      </div>`;
  
      if (detailsRows.length > 1) {
        const hdr = detailsRows[0] || {};
        const timeCols = Object.keys(hdr).filter(k => k !== 'header');
        html += `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${COLORS.indigo}"><span class="material-icons">table_chart</span> ${t('fund.ratingBreakdown')}</div>
          <div class="sod-fund-table-wrap"><table class="sod-fund-table"><thead><tr>
            <th>${t('fund.metric')}</th>${timeCols.map(k => `<th>${hdr?.[k]?.display_text || k}</th>`).join('')}
          </tr></thead><tbody>
            ${detailsRows.slice(1).map(r => `<tr>
              <td>${r?.header?.display_text || '—'}</td>
              ${timeCols.map(k => `<td>${r?.[k]?.display_text ?? '—'}</td>`).join('')}
            </tr>`).join('')}
          </tbody></table></div>
        </div>`;
      }
  
      const log = d?.log?.logEntries || [];
      if (log.length) {
        html += `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${COLORS.indigo}"><span class="material-icons">history</span> ${t('fund.ratingLog')}</div>
          <div class="sod-fund-table-wrap"><table class="sod-fund-table"><thead><tr><th>${t('fund.firm')}</th><th>${t('fund.action')}</th><th>${t('fund.rating')}</th><th>${t('fund.target')}</th><th>${t('fund.date')}</th></tr></thead><tbody>
          ${log.slice(0, 30).map(e => {
            const action = e.action || '';
            const color = action.toLowerCase().includes('upgrade') ? COLORS.green : action.toLowerCase().includes('downgrade') ? COLORS.red : 'var(--text)';
            const target = e.formatted_abs ? '$' + e.formatted_abs : (e.abs != null ? '$' + _fmtFundVal(e.abs) : '');
            return `<tr><td>${e.firm || ''}</td><td style="color:${color};font-weight:700">${action}</td><td>${_localizeRatingText(e.toRating || e.rating || '')}</td><td>${target}</td><td>${e.date || ''}</td></tr>`;
          }).join('')}
          </tbody></table></div>
        </div>`;
      }
      return html;
    }
  
    function _renderFundForecast(d) {
      const p = _stockFundState.periodToggles.forecast;
      const trends = d?.trends || [];
  
      let html = `<div class="sod-fund-subtabs" style="margin-bottom:8px">
        <button class="sod-fund-subtab${!p.annual ? ' active' : ''}" data-subtab-group="period" data-subtab-val="quarterly">${t('fund.quarterly')}</button>
        <button class="sod-fund-subtab${p.annual ? ' active' : ''}" data-subtab-group="period" data-subtab-val="annual">${t('fund.annual')}</button>
      </div>`;
  
      if (!trends.length) return html + `<div class="sod-fund-empty">${t('fund.noData')}</div>`;
  
      for (const trend of trends.slice(0, 6)) {
        const name = trend.name || trend.metric || '';
        const periods = trend.periods || trend.estimates || [];
        if (!periods.length) continue;
  
        html += `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${COLORS.purple}"><span class="material-icons">trending_up</span> ${name}</div>
          <div class="sod-fund-forecast-grid">`;
        for (const p of periods.slice(0, 8)) {
          const period = p.title || p.period || p.label || '';
          const estRaw = p.formatted_estimate ?? (p.estimate ?? p.mean ?? '');
          const actRaw = p.formatted_actual ?? (p.actual ?? '');
          const surpriseRaw = p.formatted_suprise ?? p.formatted_surprise ?? (p.suprise ?? p.surprise ?? '');
          const surpriseNum = p.suprise ?? p.surprise ?? parseFloat(String(surpriseRaw).replace(/[,$%]/g, '').replace(/,/g, ''));
          html += `<div class="sod-fund-forecast-card">
            <div class="sod-fund-forecast-period">${period}</div>
            <div class="sod-fund-forecast-value" style="color:${COLORS.purple}">${typeof estRaw === 'string' ? estRaw : _fmtFundVal(estRaw)}</div>
            <div class="sod-fund-forecast-label">${t('fund.estimate')}</div>
            ${actRaw !== '' ? `<div class="sod-fund-forecast-value" style="color:${COLORS.blue};font-size:14px;margin-top:4px">${typeof actRaw === 'string' ? actRaw : _fmtFundVal(actRaw)}</div><div class="sod-fund-forecast-label">${t('fund.actual')}</div>` : ''}
            ${surpriseRaw !== '' ? `<div style="font-size:10px;margin-top:2px;color:${_colorForChange(surpriseNum)}">${t('fund.surprise')}: ${typeof surpriseRaw === 'string' ? surpriseRaw : _fmtFundVal(surpriseRaw)}</div>` : ''}
          </div>`;
        }
        html += '</div></div>';
      }
      return html;
    }
  
    function _renderFundOwnership(d) {
      let html = '';
      const inst = d?.institutional_summary;
      const insider = d?.insider_summary;
      const others = d?.others_summary;
  
      if (inst || insider || others) {
        html += `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${COLORS.pink}"><span class="material-icons">donut_large</span> ${t('fund.ownership')}</div>
          <div class="sod-fund-metrics">
            ${inst ? `<div class="sod-fund-metric"><div class="sod-fund-metric-label">${t('fund.institutions')}</div><div class="sod-fund-metric-value" style="color:${COLORS.blue}">${inst.display_pct || _fmtFundVal(inst.pct) + '%'}</div><div class="sod-fund-metric-sub">${inst.display_shares || ''} · ${inst.display_value || ''}</div></div>` : ''}
            ${insider ? `<div class="sod-fund-metric"><div class="sod-fund-metric-label">${t('fund.insiders')}</div><div class="sod-fund-metric-value" style="color:${COLORS.pink}">${insider.display_pct || _fmtFundVal(insider.pct) + '%'}</div><div class="sod-fund-metric-sub">${insider.display_shares || ''} · ${insider.display_value || ''}</div></div>` : ''}
            ${others ? `<div class="sod-fund-metric"><div class="sod-fund-metric-label">${t('fund.others')}</div><div class="sod-fund-metric-value" style="color:${COLORS.gray}">${others.display_pct || _fmtFundVal(others.pct) + '%'}</div></div>` : ''}
          </div>
        </div>`;
      }
  
      const topHolders = d?.institutional_owners || [];
      if (topHolders.length) {
        const palette = [COLORS.blue, COLORS.purple, COLORS.teal, COLORS.orange, COLORS.green, COLORS.pink, COLORS.indigo, COLORS.red];
        html += `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${COLORS.blue}"><span class="material-icons">leaderboard</span> ${t('fund.topInstitutionalHolders')}</div>
          ${topHolders.slice(0, 15).map((h, i) => `<div class="sod-fund-holder">
            <div class="sod-fund-holder-rank" style="background:${palette[i % palette.length]}">${i + 1}</div>
            <div class="sod-fund-holder-name">${h.name || ''}</div>
            <div class="sod-fund-holder-pct" style="color:${palette[i % palette.length]}">${h.display_pct || ''}</div>
            <div class="sod-fund-holder-shares">${h.display_shares || ''}</div>
          </div>`).join('')}
        </div>`;
      }
  
      const tradeLog = d?.trade_log || [];
      if (tradeLog.length) {
        html += `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${COLORS.orange}"><span class="material-icons">swap_horiz</span> ${t('fund.tradeLog')}</div>
          <div class="sod-fund-table-wrap"><table class="sod-fund-table"><thead><tr><th>${t('fund.name')}</th><th>${t('fund.action')}</th><th>${t('fund.shares')}</th><th>${t('fund.value')}</th><th>${t('fund.date')}</th></tr></thead><tbody>
          ${tradeLog.slice(0, 30).map(e => {
            const isBuy = (e.action || '').toUpperCase() === 'BUY';
            const dt = e.displayDate ? `${e.displayDate.m} ${e.displayDate.d}, ${e.displayDate.y}` : '';
            return `<tr><td>${e.party || ''}</td><td style="color:${isBuy ? COLORS.green : COLORS.red};font-weight:700">${e.action || ''}</td><td>${e.display_shares || _fmtFundVal(e.shares)}</td><td>${e.display_value || ''}</td><td>${dt}</td></tr>`;
          }).join('')}
          </tbody></table></div>
        </div>`;
      }
      return html || `<div class="sod-fund-empty">${t('fund.noData')}</div>`;
    }
  
    function _renderFundDividends(d) {
      let html = '';
      const next = d?.next_dividend?.content;
      const fmtDateObj = (obj) => {
        if (!obj) return '';
        if (typeof obj === 'string') return obj;
        if (obj?.m && obj?.d && obj?.y) return `${obj.m} ${obj.d}, ${obj.y}`;
        if (obj?.t) {
          const dt = new Date(obj.t);
          if (!Number.isNaN(dt.getTime())) {
            return dt.toLocaleDateString(_fundLocale(), { month: 'short', day: 'numeric', year: 'numeric' });
          }
        }
        return '';
      };
      const rawLastAmt = d?.formatted_last_payed_dividend_amount ?? d?.last_payed_dividend_amount;
      const lastAmt = rawLastAmt != null && rawLastAmt !== ''
        ? (typeof rawLastAmt === 'number' ? `$${rawLastAmt.toFixed(2)}` : String(rawLastAmt))
        : '';
      const lastDate = fmtDateObj(d?.last_payed_dividend_date);
      const payout = d?.payout_ratio?.content;
      const indCmp = Array.isArray(d?.industry_comparison?.content) ? d.industry_comparison.content : [];
  
      html += `<div class="sod-fund-metrics" style="margin-bottom:10px">`;
      if (next) {
        const exDate = next.ex_dividend_date ? `${next.ex_dividend_date.m} ${next.ex_dividend_date.d}, ${next.ex_dividend_date.y}` : '';
        const payDate = next.payment_date ? `${next.payment_date.m} ${next.payment_date.d}, ${next.payment_date.y}` : '';
        html += `<div class="sod-fund-metric"><div class="sod-fund-metric-label">${t('fund.nextDividend')}</div><div class="sod-fund-metric-value" style="color:${COLORS.green}">${next.formatted_dividend_amount || '$' + next.dividend_amount}</div></div>`;
        if (exDate) html += `<div class="sod-fund-metric"><div class="sod-fund-metric-label">${t('fund.exDate')}</div><div class="sod-fund-metric-value" style="color:${COLORS.blue};font-size:12px">${exDate}</div></div>`;
        if (payDate) html += `<div class="sod-fund-metric"><div class="sod-fund-metric-label">${t('fund.payment')}</div><div class="sod-fund-metric-value" style="color:${COLORS.teal};font-size:12px">${payDate}</div></div>`;
      }
      if (lastAmt) html += `<div class="sod-fund-metric"><div class="sod-fund-metric-label">${t('fund.lastPaid')}</div><div class="sod-fund-metric-value" style="color:${COLORS.green}">${lastAmt}</div><div class="sod-fund-metric-sub">${lastDate || '—'}</div></div>`;
      if (payout) {
        html += `<div class="sod-fund-metric"><div class="sod-fund-metric-label">${_localizeFundFieldLabel(payout.title) || t('fund.payoutRatio')}</div><div class="sod-fund-metric-value" style="color:${COLORS.orange}">${payout.formatted_value || _fmtFundVal(payout.value)}</div><div class="sod-fund-metric-sub">${payout.text || ''}</div></div>`;
      }
      for (const m of indCmp.slice(0, 2)) {
        html += `<div class="sod-fund-metric"><div class="sod-fund-metric-label">${_localizeFundFieldLabel(m.title) || ''}</div><div class="sod-fund-metric-value" style="color:${COLORS.blue}">${m.formatted_value || _fmtFundVal(m.value)}</div><div class="sod-fund-metric-sub">${_localizeFundFieldLabel(m.vs?.title) || t('fund.vsIndustry')}: ${m.vs?.value != null ? Number(m.vs.value).toFixed(2) + '%' : '—'}</div></div>`;
      }
      html += `</div>`;
  
      const histObj = d?.history || {};
      const seriesArr = histObj?.series || (Array.isArray(histObj) ? histObj : []);
      const divSeries = Array.isArray(seriesArr) ? seriesArr.find(s => s.name === 'dividends') : null;
      const plotData = divSeries?.plotData || [];
      if (plotData.length) {
        html += `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${COLORS.green}"><span class="material-icons">payments</span> ${t('fund.dividendHistory')}</div>
          ${plotData.slice(-30).reverse().map(h => {
            const exDate = h.ex_dividend_date ? `${h.ex_dividend_date.m} ${h.ex_dividend_date.d}, ${h.ex_dividend_date.y}` : '';
            return `<div class="sod-fund-div-item">
              <span class="sod-fund-div-date">${exDate}</span>
              <span class="sod-fund-div-amount">${h.formatted_amount || '$' + h.amount}</span>
              <span class="sod-fund-div-type" style="background:${COLORS.green}18;color:${COLORS.green}">${_localizeFundFieldLabel(h.description) || t('fund.dividendLabel')}</span>
            </div>`;
          }).join('')}
        </div>`;
      }
      return html || `<div class="sod-fund-empty">${t('fund.noData')}</div>`;
    }
  
    function _renderFundCompetitors(d) {
      const raw = _unwrapLanding(d?.competitors) || d;
      const competitors = raw?.competitors || raw?.items || (Array.isArray(raw) ? raw : []);
      if (!competitors.length) return `<div class="sod-fund-empty">${t('fund.noData')}</div>`;
      return `<div class="sod-fund-section">
        <div class="sod-fund-section-title" style="color:${COLORS.indigo}"><span class="material-icons">compare_arrows</span> ${t('fund.competitors')}</div>
        <div class="sod-fund-comp-row">${competitors.slice(0, 10).map(c => {
          const sym = c.ticker || c.symbol || '';
          return `<div class="sod-fund-comp-card" ${sym ? `data-comp-symbol="${sym}"` : ''}>
            <div class="sod-fund-comp-sym">${sym}</div>
            <div class="sod-fund-comp-name">${c.name || c.companyName || ''}</div>
            ${c.formattedCap || c.marketCap ? `<div class="sod-fund-comp-stat"><span class="sod-fund-comp-stat-label">${t('fund.marketCap')}</span><span class="sod-fund-comp-stat-value">${c.formattedCap || _fmtFundVal(c.marketCap)}</span></div>` : ''}
            ${c.industry ? `<div class="sod-fund-comp-stat"><span class="sod-fund-comp-stat-label">${t('fund.industry')}</span><span class="sod-fund-comp-stat-value" style="font-size:9px">${c.industry}</span></div>` : ''}
          </div>`;
        }).join('')}</div>
      </div>`;
    }
  
    function _renderFundESG(d) {
      const contentArr = Array.isArray(d?.content) ? d.content : [];
      if (!contentArr.length) return `<div class="sod-fund-empty">${t('fund.noData')}</div>`;
      const fmtAsOfDate = (v) => {
        if (!v) return '';
        const s = String(v);
        if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
        const dt = new Date(s);
        if (!Number.isNaN(dt.getTime())) {
          return dt.toLocaleDateString(_fundLocale(), { year: 'numeric', month: 'short', day: 'numeric' });
        }
        return s;
      };
      const esgChildLabelMap = {
        RRS: t('fund.resourceUseScore'),
        ERS: t('fund.emissionsScore'),
        PIS: t('fund.environmentalInnovationScore'),
        WOS: t('fund.workforceScore'),
        HRS: t('fund.humanRightsScore'),
        COS: t('fund.communityScore'),
        PRS: t('fund.productResponsibilityScore'),
        BDS: t('fund.managementScore'),
        SRS: t('fund.shareholdersScore'),
        VSS: t('fund.csrStrategyScore'),
      };
      const fmtEsgChildLabel = (name) => {
        const suffix = String(name || '').replace(/^TRESGEN|^TRESGSO|^TRESGCG/, '').toUpperCase();
        return esgChildLabelMap[suffix] || suffix || '';
      };
  
      const nameMap = {
        TRESGS: { label: t('fund.totalScore'), color: COLORS.blue },
        TRESGCS: { label: t('fund.controversy'), color: COLORS.red },
        TRESGCCS: { label: t('fund.controversyCategory'), color: COLORS.orange },
        TRESGENS: { label: t('fund.environmental'), color: COLORS.green },
        TRESGSOS: { label: t('fund.social'), color: COLORS.orange },
        TRESGCGS: { label: t('fund.governance'), color: COLORS.purple },
      };
  
      const mainGauges = contentArr.filter(c => nameMap[c.name]).map(c => ({
        ...nameMap[c.name],
        value: c.value,
      }));
  
      let html = '';
      if (mainGauges.length) {
        html += `<div class="sod-fund-esg-gauges">${mainGauges.map(g => {
          const pct = Math.min(100, Math.max(0, (Number(g.value) || 0) * 10));
          return `<div class="sod-fund-esg-gauge">
            <div class="sod-fund-esg-circle" style="background:conic-gradient(${g.color} ${pct * 3.6}deg, var(--border) 0deg)">${g.value}</div>
            <div class="sod-fund-esg-label">${g.label}</div>
          </div>`;
        }).join('')}</div>`;
      }
  
      const pillars = contentArr.filter(c => ['TRESGENS', 'TRESGSOS', 'TRESGCGS'].includes(c.name) && c.children?.length);
      for (const p of pillars) {
        const info = nameMap[p.name] || {};
        html += `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${info.color || 'var(--text)'}"><span class="material-icons">donut_small</span> ${info.label || p.name} (${p.value}/10)</div>
          <div class="sod-fund-metrics">${(p.children || []).map(ch => {
            const subLabel = fmtEsgChildLabel(ch.name);
            return `<div class="sod-fund-metric"><div class="sod-fund-metric-label">${subLabel}</div><div class="sod-fund-metric-value" style="color:${info.color || 'var(--text)'}">${ch.value}/10</div></div>`;
          }).join('')}</div>
        </div>`;
      }
  
      if (d?.asOfDate) html += `<div style="font-size:9px;color:var(--text3);text-align:right;margin-top:4px">${t('fund.asOf', fmtAsOfDate(d.asOfDate))}</div>`;
      return html;
    }
  
    function _toNum(v) {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    }
  
    function _toSentPct(v) {
      const n = _toNum(v);
      if (n == null) return null;
      return Math.abs(n) <= 1.5 ? n * 100 : n;
    }
  
    function _fmtSentNum(v, digits = 3) {
      return Number.isFinite(v) ? Number(v).toFixed(digits) : '—';
    }
  
    function _fmtSentPct(v) {
      return Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—';
    }
  
    function _sentTs(v) {
      if (v == null) return NaN;
      if (v instanceof Date) return v.getTime();
      if (typeof v === 'number') return v > 1e12 ? v : v * 1000;
      if (typeof v === 'string') {
        const t = Date.parse(v.replace(' ', 'T'));
        return Number.isFinite(t) ? t : NaN;
      }
      return NaN;
    }
  
    function _normalizeSentimentPoints(d) {
      const sentimentSeries = d?._social && Array.isArray(d?.series?.sentiment) ? d.series.sentiment : [];
      const points = sentimentSeries.map((it) => {
        const ts = _sentTs(it?.datetime ?? it?.time ?? it?.t ?? it?.date);
        return {
          ts,
          sscore: _toNum(it?.sscore),
          indScore: _toNum(it?.ind_sscore ?? it?.industry_score),
          svscore: _toNum(it?.svscore ?? it?.svolume),
          schangePct: _toSentPct(it?.schange),
          cumPerf: _toNum(it?.cum_performance),
        };
      }).filter(p => Number.isFinite(p.ts)).sort((a, b) => a.ts - b.ts);
      return points;
    }
  
    function _filterSentimentPoints(points, period) {
      if (!points.length) return [];
      const daysByPeriod = { '1D': 1, '1W': 7, '1M': 30, '6M': 180, '1Y': 365 };
      const days = daysByPeriod[period] || 7;
      const endTs = points[points.length - 1].ts;
      const fromTs = endTs - days * 24 * 60 * 60 * 1000;
      const filtered = points.filter(p => p.ts >= fromTs);
      return filtered.length >= 8 ? filtered : points;
    }
  
    function _renderSentGauge({
      title, subtitle, value, low, high, changePct, industryValue, industryChangePct, tone = COLORS.blue,
    }) {
      const hasRange = Number.isFinite(low) && Number.isFinite(high) && high > low && Number.isFinite(value);
      const pos = hasRange ? Math.max(0, Math.min(100, ((value - low) / (high - low)) * 100)) : 50;
      const bubblePos = Math.max(30, Math.min(70, pos));
      const chColor = _colorForChange(changePct || 0);
      return `<div class="sod-ss-gauge-block">
        <div class="sod-ss-gauge-title">${title}</div>
        <div class="sod-ss-gauge-sub">${subtitle}</div>
        <div class="sod-ss-gauge-track">
          <div class="sod-ss-gauge-bubble" style="left:${bubblePos}%;color:${tone}">${t('fund.currentTag')}: ${_fmtSentNum(value, 3)}</div>
          <div class="sod-ss-gauge-dot" style="left:${pos}%;border-color:${tone}"></div>
        </div>
        <div class="sod-ss-gauge-range">
          <span>${t('fund.low')} ${_fmtSentNum(low, 2)}</span>
          <span>${t('fund.pastMonth')}</span>
          <span>${t('fund.high')} ${_fmtSentNum(high, 2)}</span>
        </div>
        <div class="sod-ss-gauge-main">
          <span class="sod-ss-val">${_fmtSentNum(value, 3)}</span>
          <span class="sod-ss-chg" style="color:${chColor}">${_fmtSentPct(changePct)}</span>
        </div>
        <div class="sod-ss-gauge-ind">● ${t('fund.industryAvg')}: ${_fmtSentNum(industryValue, 3)} (${_fmtSentPct(industryChangePct)})</div>
      </div>`;
    }
  
    function _renderFundSentiment(d) {
      const latest = d?._social ? (d.latest || {}) : (d || {});
      const highLow = d?._social ? (d.highLow || {}) : {};
      const points = _normalizeSentimentPoints(d);
  
      const latestTs = _sentTs(latest?.datetime ?? latest?.time ?? latest?.t);
      const asOf = Number.isFinite(latestTs)
        ? new Date(latestTs).toLocaleString(_fundLocale(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';
  
      const sScore = _toNum(latest?.sscore);
      const sChangePct = _toSentPct(latest?.schange);
      const sLow = _toNum(highLow?.sscore_low ?? Math.min(...points.map(p => p.sscore).filter(v => v != null)));
      const sHigh = _toNum(highLow?.sscore_high ?? Math.max(...points.map(p => p.sscore).filter(v => v != null)));
      const sIndustry = _toNum(latest?.ind_sscore);
      const sIndustryChange = _toSentPct(latest?.ind_schange);
  
      const svScore = _toNum(latest?.svscore ?? latest?.svolume);
      const svChangePct = _toSentPct(latest?.svchange);
      const svLow = _toNum(highLow?.svscore_low ?? Math.min(...points.map(p => p.svscore).filter(v => v != null)));
      const svHigh = _toNum(highLow?.svscore_high ?? Math.max(...points.map(p => p.svscore).filter(v => v != null)));
      const svIndustry = _toNum(latest?.ind_svscore);
      const svIndustryChange = _toSentPct(latest?.ind_svchange);
  
      const sDelta = _toNum(latest?.sdelta);
      const sDispersion = _toNum(latest?.sdispersion);
      const buzz = _toNum(latest?.sbuzz);
      const buzzPct = Number.isFinite(buzz) ? Math.max(0, Math.min(100, (buzz / 2) * 100)) : 0;
  
      const hasAny = [sScore, svScore, sDelta, sDispersion, buzz].some(v => v != null);
      if (!hasAny) return `<div class="sod-fund-empty">${t('fund.noData')}</div>`;
  
      const periodTabs = [
        ['1D', t('fund.period1d')],
        ['1W', t('fund.period1w')],
        ['1M', t('fund.period1m')],
        ['6M', t('fund.period6m')],
        ['1Y', t('fund.period1y')],
      ];
  
      return `<div class="sod-ss-module">
        <div class="sod-ss-head">
          <div class="sod-ss-title">${t('fund.socialSentiment')}<span class="sod-ss-tm">TM</span></div>
          <div class="sod-ss-asof">${asOf ? t('fund.asOf', asOf) : ''}</div>
        </div>
  
        <div class="sod-ss-grid">
          <div class="sod-ss-card sod-ss-card-left">
            ${_renderSentGauge({
              title: t('fund.tweetSentimentScore'),
              subtitle: t('fund.caMetric', t('fund.sScore')),
              value: sScore,
              low: sLow,
              high: sHigh,
              changePct: sChangePct,
              industryValue: sIndustry,
              industryChangePct: sIndustryChange,
              tone: COLORS.blue,
            })}
            <div class="sod-ss-divider"></div>
            ${_renderSentGauge({
              title: t('fund.tweetVolumeScore'),
              subtitle: t('fund.caMetric', t('fund.sVolume')),
              value: svScore,
              low: svLow,
              high: svHigh,
              changePct: svChangePct,
              industryValue: svIndustry,
              industryChangePct: svIndustryChange,
              tone: COLORS.purple,
            })}
          </div>
  
          <div class="sod-ss-card sod-ss-card-mid">
            <div class="sod-ss-split">
              <div class="sod-ss-gauge-title">${t('fund.min15SentimentChange')}</div>
              <div class="sod-ss-gauge-sub">${t('fund.caMetric', t('fund.sDelta'))}</div>
              <div class="sod-ss-mid-val">${_fmtSentNum(sDelta, 4)} <span style="color:${_colorForChange(sChangePct || 0)}">${_fmtSentPct(sChangePct)}</span></div>
            </div>
            <div class="sod-ss-divider"></div>
            <div class="sod-ss-split">
              <div class="sod-ss-gauge-title">${t('fund.sourceDiversity')}</div>
              <div class="sod-ss-gauge-sub">${t('fund.caMetric', t('fund.sDispersion'))}</div>
              <div class="sod-ss-mid-val">${_fmtSentNum(sDispersion, 3)}</div>
            </div>
          </div>
  
          <div class="sod-ss-card sod-ss-card-right">
            <div class="sod-ss-gauge-title">${t('fund.buzzScore')}</div>
            <div class="sod-ss-gauge-sub">${t('fund.caMetric', t('fund.sBuzz'))}</div>
            <div class="sod-ss-buzz-top">${_fmtSentNum(buzz, 4)}</div>
            <div class="sod-ss-buzz-row">
              <div class="sod-ss-buzz-meter-wrap">
                <div class="sod-ss-buzz-meter">
                  <div class="sod-ss-buzz-fill" style="height:${buzzPct}%"></div>
                  <div class="sod-ss-buzz-avg"></div>
                </div>
                <div class="sod-ss-buzz-axis">
                  <span>2.0</span>
                  <span>1.5</span>
                  <span>1.0 (${t('fund.industryAvg')})</span>
                  <span>0.5</span>
                  <span>0.0</span>
                </div>
              </div>
            </div>
            <details class="sod-ss-buzz-details">
              <summary class="sod-ss-buzz-summary">${t('fund.buzzDescToggle')}</summary>
              <div class="sod-ss-buzz-text">
                <p>${t('fund.buzzDesc1')}</p>
                <p>${t('fund.buzzDesc2')}</p>
              </div>
            </details>
          </div>
        </div>
  
        <div class="sod-ss-trend-card">
          <div class="sod-ss-trend-top">
            <div class="sod-ss-trend-title">${t('fund.socialSentimentTrend')}</div>
            <div class="sod-ss-period-tabs">
              ${periodTabs.map(([k, lbl]) => `<button class="sod-ss-period-tab ${_stockFundState.sentimentPeriod === k ? 'active' : ''}" data-period="${k}">${lbl}</button>`).join('')}
            </div>
          </div>
          <div id="sod-ss-trend-body">
            <div class="sod-ss-chart-main">
              <canvas id="sod-chart-fund-ss-main"></canvas>
              <div class="sod-ss-polarity">
                <span>${t('fund.positive')}</span>
                <span>${t('fund.negative')}</span>
              </div>
            </div>
            <div class="sod-ss-chart-vol"><canvas id="sod-chart-fund-ss-vol"></canvas></div>
          </div>
        </div>
      </div>`;
    }
  
    function _sentimentPeriodParams(period) {
      const now = new Date();
      const daysByPeriod = { '1D': 1, '1W': 7, '1M': 30, '6M': 180, '1Y': 365 };
      const barByPeriod  = { '1D': '1M', '1W': '1H', '1M': '1D', '6M': '1D', '1Y': '1D' };
      const days    = daysByPeriod[period] ?? 7;
      const bar_size = barByPeriod[period] ?? '1H';
      const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const fmt  = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
      const tz   = Math.abs(new Date().getTimezoneOffset());
      return { fromStr: fmt(from), toStr: fmt(now), bar_size, tz };
    }
  
    function _bindFundSentimentEvents(d) {
      const content = _root.querySelector('#sod-fund-content');
      if (!content) return;
      // Seed 1W series cache with the initially fetched data
      if (d.series && !_stockFundState.sentimentSeriesCache['1W']) {
        _stockFundState.sentimentSeriesCache['1W'] = d.series;
      }
      content.querySelectorAll('.sod-ss-period-tab').forEach(btn => {
        btn.addEventListener('click', async () => {
          const period = btn.dataset.period || '1W';
          _stockFundState.sentimentPeriod = period;
          content.querySelectorAll('.sod-ss-period-tab').forEach(b => b.classList.toggle('active', b === btn));
          if (_stockFundState.sentimentSeriesCache[period]) {
            d.series = _stockFundState.sentimentSeriesCache[period];
            _drawFundSentimentTrendCharts(d);
            return;
          }
          // Restore canvas structure so _drawFundSentimentTrendCharts can find elements after fetch
          const body = _root.querySelector('#sod-ss-trend-body');
          if (body) body.innerHTML = `
            <div class="sod-ss-chart-main">
              <canvas id="sod-chart-fund-ss-main"></canvas>
              <div class="sod-ss-polarity"><span>${t('fund.positive')}</span><span>${t('fund.negative')}</span></div>
            </div>
            <div class="sod-ss-chart-vol"><canvas id="sod-chart-fund-ss-vol"></canvas></div>`;
          btn.disabled = true;
          try {
            const conid = await resolveIBKRConid(_stockState.symbol);
            const { fromStr, toStr, bar_size, tz } = _sentimentPeriodParams(period);
            const series = await _ibkrFetch(`${_ibkrFundBase()}sma/request?type=search&conid=${conid}&from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&bar_size=${bar_size}&tz=${tz}`);
            _stockFundState.sentimentSeriesCache[period] = series;
            d.series = series;
            _drawFundSentimentTrendCharts(d);
          } catch (e) {
            if (body) body.innerHTML = `<div class="sod-fund-empty" style="color:${COLORS.red}">${t('fund.error')}</div>`;
          } finally {
            btn.disabled = false;
          }
        });
      });
      _drawFundSentimentTrendCharts(d);
    }
  
    function _drawFundSentimentTrendCharts(d) {
      const body = _root.querySelector('#sod-ss-trend-body');
      if (!body) return;
      const pointsAll = _normalizeSentimentPoints(d);
      const points = _filterSentimentPoints(pointsAll, _stockFundState.sentimentPeriod);
      const valid = points.filter(p => p.sscore != null || p.indScore != null || p.svscore != null);
      if (valid.length < 2) {
        destroyChart('fundSentimentMain');
        destroyChart('fundSentimentVol');
        body.innerHTML = `<div class="sod-fund-empty">${t('fund.noTrendData')}</div>`;
        return;
      }
  
      const labels = valid.map((p) => {
        const dt = new Date(p.ts);
        if (_stockFundState.sentimentPeriod === '1D') {
          return dt.toLocaleTimeString(_fundLocale(), { hour: '2-digit', minute: '2-digit', hour12: false });
        }
        if (_stockFundState.sentimentPeriod === '1W') {
          return dt.toLocaleString(_fundLocale(), { month: 'short', day: 'numeric', hour: '2-digit' });
        }
        return dt.toLocaleDateString(_fundLocale(), { month: 'short', day: 'numeric' });
      });
  
      let cum = 0;
      let prevScore = null;
      const sentiment = [];
      const industry = [];
      const cumulative = [];
      const volume = [];
      for (const p of valid) {
        sentiment.push(p.sscore);
        industry.push(p.indScore);
        volume.push(p.svscore);
        if (Number.isFinite(p.cumPerf)) {
          cum = p.cumPerf;
        } else if (Number.isFinite(p.schangePct)) {
          cum += p.schangePct;
        } else if (Number.isFinite(prevScore) && Number.isFinite(p.sscore) && prevScore !== 0) {
          cum += ((p.sscore - prevScore) / Math.abs(prevScore)) * 100;
        }
        if (Number.isFinite(p.sscore)) prevScore = p.sscore;
        cumulative.push(cum);
      }
  
      const mainCanvas = _root.querySelector('#sod-chart-fund-ss-main');
      const volCanvas = _root.querySelector('#sod-chart-fund-ss-vol');
      if (!mainCanvas || !volCanvas) return;
      const mainCtx = mainCanvas.getContext('2d');
      const volCtx = volCanvas.getContext('2d');
      if (!mainCtx || !volCtx) return;
  
      destroyChart('fundSentimentMain');
      destroyChart('fundSentimentVol');
  
      const bgPlugin = {
        id: 'fundSentimentBg',
        beforeDraw(chart) {
          const { ctx, chartArea, scales } = chart;
          if (!chartArea || !scales?.y) return;
          const top = chartArea.top;
          const bottom = chartArea.bottom;
          const zeroPxRaw = scales.y.getPixelForValue(0);
          const zeroPx = Math.max(top, Math.min(bottom, zeroPxRaw));
          ctx.save();
          ctx.fillStyle = 'rgba(52,199,89,0.08)';
          ctx.fillRect(chartArea.left, top, chartArea.right - chartArea.left, zeroPx - top);
          ctx.fillStyle = 'rgba(255,59,48,0.08)';
          ctx.fillRect(chartArea.left, zeroPx, chartArea.right - chartArea.left, bottom - zeroPx);
          ctx.restore();
        },
      };
  
      _charts.fundSentimentMain = new Chart(mainCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: t('fund.tweetSentimentScore'),
              data: sentiment,
              borderColor: '#0A9D89',
              tension: 0.25,
              borderWidth: 3,
              pointRadius: 0,
              spanGaps: true,
              segment: {
                borderColor: (ctx) => {
                  const y0 = ctx.p0?.parsed?.y;
                  const y1 = ctx.p1?.parsed?.y;
                  if (!Number.isFinite(y0) || !Number.isFinite(y1)) return '#9E9E9E';
                  return (y0 >= 0 && y1 >= 0) ? '#0A9D89' : '#D91E37';
                },
              },
            },
            {
              label: t('fund.industryScore'),
              data: industry,
              borderColor: '#9E9E9E',
              borderDash: [3, 5],
              pointRadius: 0,
              spanGaps: true,
              tension: 0.22,
              borderWidth: 2,
            },
            {
              label: t('fund.cumulativePerformance'),
              data: cumulative,
              borderColor: '#6AB6E8',
              pointRadius: 0,
              spanGaps: true,
              tension: 0.2,
              borderWidth: 2.5,
              yAxisID: 'y1',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              align: 'end',
              labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7, font: { size: 11 } },
            },
            tooltip: {
              enabled: true,
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(0,0,0,0.85)',
              titleFont: { size: 10 },
              bodyFont: { size: 10 },
              callbacks: {
                title: (items) => items?.[0]?.label || '',
                label: (ctx) => ctx.dataset.yAxisID === 'y1'
                  ? ` ${ctx.dataset.label}: ${Number(ctx.parsed.y || 0).toFixed(2)}%`
                  : ` ${ctx.dataset.label}: ${Number(ctx.parsed.y || 0).toFixed(3)}`,
              },
            },
          },
          scales: {
            x: { ticks: { font: { size: 9 }, color: '#8B8B90', maxTicksLimit: 10 }, grid: { color: 'rgba(128,128,128,0.08)' } },
            y: {
              ticks: {
                font: { size: 10 }, color: '#8B8B90',
                callback: (v) => `${Number(v).toFixed(2)}`,
              },
              grid: { color: 'rgba(128,128,128,0.12)' },
            },
            y1: {
              position: 'right',
              ticks: {
                font: { size: 10 }, color: '#8B8B90',
                callback: (v) => `${Number(v).toFixed(1)}%`,
              },
              grid: { drawOnChartArea: false },
            },
          },
        },
        plugins: [bgPlugin, crosshairPlugin],
      });
  
      _charts.fundSentimentVol = new Chart(volCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: t('fund.tweetVolumeScore'),
              data: volume,
              borderColor: '#7D7D82',
              backgroundColor: 'rgba(125,125,130,0.14)',
              fill: true,
              pointRadius: 0,
              spanGaps: true,
              tension: 0.24,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: true,
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(0,0,0,0.85)',
              titleFont: { size: 10 },
              bodyFont: { size: 10 },
              callbacks: {
                title: (items) => items?.[0]?.label || '',
                label: (ctx) => ` ${t('fund.tweetVolumeScore')}: ${Number(ctx.parsed.y || 0).toFixed(3)}`,
              },
            },
          },
          scales: {
            x: { ticks: { font: { size: 9 }, color: '#8B8B90', maxTicksLimit: 10 }, grid: { color: 'rgba(128,128,128,0.07)' } },
            y: { ticks: { font: { size: 9 }, color: '#8B8B90' }, grid: { color: 'rgba(128,128,128,0.1)' } },
          },
        },
        plugins: [crosshairPlugin],
      });
    }
  
    function _renderFundShortSelling(d) {
      const pack = d?._shortSelling ? d : { orbisa: d };
      const orbisaRaw = pack?.orbisa || pack?.orbisaWidget || d || {};
      const latest = Array.isArray(orbisaRaw?.widgets?.latest) ? orbisaRaw.widgets.latest : [];
      const series = Array.isArray(orbisaRaw?.widgets?.data) ? orbisaRaw.widgets.data : [];
      const lm = Object.fromEntries(latest.map(x => [x.code, x]));
      const sm = Object.fromEntries(series.map(x => [x.code, x]));
      const slbRow = Array.isArray(pack?.slb?.result) ? pack.slb.result[0] : null;
      const lastPrice = Number(_stockState?.quoteData?.quote?.lastPrice ?? _stockState?.quoteData?.regularQuote?.lastPrice);
  
      const fmtDate = (v) => (v && String(v).length === 8)
        ? `${String(v).slice(0, 4)}-${String(v).slice(4, 6)}-${String(v).slice(6, 8)}`
        : '—';
      const fmtPct = (v, digits = 2) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return '—';
        const display = Math.abs(n) <= 1 ? n * 100 : n;
        return `${display.toFixed(digits)}%`;
      };
      const fmtNum = (v, digits = 2) => {
        const n = Number(v);
        return Number.isFinite(n) ? n.toFixed(digits) : '—';
      };
      const trend = (code) => {
        const vals = sm?.[code]?.values || [];
        if (!vals.length) return '';
        const delta = Number(vals[vals.length - 1]) - Number(vals[0]);
        if (!Number.isFinite(delta)) return '';
        return `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`;
      };
      const card = (label, value, sub, color) => `<div class="sod-fund-metric sod-fund-ov-kpi" style="--ov-color:${color};--ov-tint:${color}1a">
        <div class="sod-fund-metric-label">${label}</div>
        <div class="sod-fund-metric-value">${value}</div>
        <div class="sod-fund-metric-sub">${sub || '—'}</div>
      </div>`;
      const pushCodeMetric = (metrics, code, label, color, valueFmt = _fmtFundVal, suffix = '') => {
        const item = lm?.[code];
        const v = item?.latest_value;
        if (v == null) return;
        const sub = `${t('fund.asOf', fmtDate(item?.latest_date))} · ${t('fund.trend')} ${trend(code) || '—'}${suffix ? ` · ${suffix}` : ''}`;
        metrics.push(card(label, valueFmt(v), sub, color));
      };
  
      const marketVolSeries = Array.isArray(pack?.marketTrend?.volume) ? pack.marketTrend.volume : [];
      const marketVolLatest = marketVolSeries.length ? marketVolSeries[marketVolSeries.length - 1] : null;
      const availableQty = Number(slbRow?.quantity);
      const loanVal = Number.isFinite(availableQty) && Number.isFinite(lastPrice) ? availableQty * lastPrice : null;
      const metrics = [];
  
      if (slbRow) {
        metrics.push(
          card(t('fund.loanFeeRate'), fmtPct(slbRow.feeRate / 100, 2), t('fund.asOf', fmtDate(slbRow?.historical?.date)), COLORS.red),
          card(t('fund.rebateRate'), fmtPct(slbRow.rebateRate / 100, 2), t('fund.asOf', fmtDate(slbRow?.historical?.date)), COLORS.orange),
          card(t('fund.availableToBorrow'), _fmtFundVal(availableQty), `${t('fund.exchange')}: ${slbRow.exchange || '—'}`, COLORS.blue),
          card(t('fund.loanVal'), loanVal != null ? `$${_fmtFundVal(loanVal)}` : '—', Number.isFinite(lastPrice) ? `${t('market.price')}: $${lastPrice.toFixed(2)}` : '—', COLORS.teal),
          card(t('fund.borrowQuality'), _fmtFundVal(Number(slbRow.quality)), t('fund.dataSource', 'SLB Reuters2', slbRow.country || '—'), COLORS.purple),
          card(t('fund.buyInRisk'), Number(slbRow.buyin) > 0 ? (getSavedLang() === 'zh' ? '高' : 'High') : (getSavedLang() === 'zh' ? '低' : 'Low'), Number(slbRow.buyin) > 0 ? '⚠' : '—', COLORS.pink),
        );
      }
  
      if (marketVolLatest != null) {
        metrics.push(card(t('fund.marketVolume'), _fmtFundVal(marketVolLatest), t('fund.asOf', new Date().toLocaleDateString(_fundLocale())), COLORS.indigo));
      }
  
      const hasTrend = (Array.isArray(pack?.feeRateTrend?.time) && pack.feeRateTrend.time.length > 0)
        || (Array.isArray(pack?.inventoryTrend?.time) && pack.inventoryTrend.time.length > 0);
      pushCodeMetric(metrics, 'SHORTINTERESTINDICATOR', t('fund.shortInterest'), COLORS.red, x => fmtPct(x, 2), 'Premium');
      pushCodeMetric(metrics, 'DAYSTOCOVER', t('fund.daysTocover'), COLORS.orange, x => fmtNum(x, 2), 'Premium');
      pushCodeMetric(metrics, 'UTILIZATION', t('fund.utilization'), COLORS.purple, x => fmtPct(x, 2));
      pushCodeMetric(metrics, 'LENDERDEPTH', t('fund.lenderDepth'), COLORS.green, x => fmtNum(x, 2));
      pushCodeMetric(metrics, 'BORROWERDEPTH', t('fund.borrowerDepth'), COLORS.blue, x => fmtNum(x, 2));
      pushCodeMetric(metrics, 'AVGDURATION', t('fund.avgDuration'), COLORS.teal, x => `${fmtNum(x, 2)} d`);
  
      const hasAnyMetric = metrics.length > 0;
      if (!hasAnyMetric && !hasTrend) return `<div class="sod-fund-empty">${t('fund.noData')}</div>`;
  
      const noteText = pack?._errors?.length ? t('fund.shortDataPartial') : '';
      const sourceParts = ['SLB', 'HMDS'];
      if (Object.keys(lm).length) sourceParts.unshift('Orbisa');
  
      return `<div class="sod-fund-section">
        <div class="sod-fund-section-title" style="color:${COLORS.red}"><span class="material-icons">trending_down</span> ${t('fund.shortSelling')}</div>
        ${hasAnyMetric ? `<div class="sod-fund-metrics">${metrics.join('')}</div>` : ''}
        ${noteText ? `<div style="font-size:10px;color:${COLORS.orange};margin-top:6px">${noteText}</div>` : ''}
        <div style="font-size:10px;color:var(--text3);margin-top:6px">${t('fund.dataSource', sourceParts.join(' + '), orbisaRaw?.subscription || '—')}</div>
      </div>
      ${hasTrend ? `<div class="sod-fund-section">
        <div class="sod-fund-section-title" style="color:${COLORS.blue}"><span class="material-icons">show_chart</span> ${t('fund.shortSellingTrend')}</div>
        <div class="sod-chart-wrap" style="height:220px"><canvas id="sod-chart-fund-short-selling"></canvas></div>
      </div>` : ''}`;
    }
  
    function _bindFundShortSellingEvents(d) {
      _drawFundShortSellingTrendChart(d);
    }
  
    function _drawFundShortSellingTrendChart(d) {
      const canvas = _root.querySelector('#sod-chart-fund-short-selling');
      if (!canvas) return;
      const fee = d?.feeRateTrend || {};
      const inv = d?.inventoryTrend || {};
      const feeTimes = Array.isArray(fee.time) ? fee.time : [];
      const feeVals = Array.isArray(fee.avg) ? fee.avg : [];
      const invTimes = Array.isArray(inv.time) ? inv.time : [];
      const invVals = Array.isArray(inv.avg) ? inv.avg : [];
  
      if ((!feeTimes.length || !feeVals.length) && (!invTimes.length || !invVals.length)) {
        destroyChart('fundShortSellingTrend');
        return;
      }
  
      const allTimes = Array.from(new Set([...feeTimes, ...invTimes])).sort((a, b) => a - b);
      const feeMap = new Map(feeTimes.map((t0, i) => [t0, Number(feeVals[i])]));
      const invMap = new Map(invTimes.map((t0, i) => [t0, Number(invVals[i])]));
  
      const labels = allTimes.map((t0) => {
        const dt = new Date(t0 * 1000);
        return dt.toLocaleString(_fundLocale(), { month: 'short', day: 'numeric', hour: '2-digit' });
      });
      const feeSeries = allTimes.map(t0 => feeMap.has(t0) ? feeMap.get(t0) : null);
      const invSeries = allTimes.map(t0 => invMap.has(t0) ? invMap.get(t0) / 1e6 : null);
  
      destroyChart('fundShortSellingTrend');
      _charts.fundShortSellingTrend = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: t('fund.feeRateTrend'),
              data: feeSeries,
              borderColor: COLORS.red,
              backgroundColor: 'rgba(255,59,48,0.12)',
              fill: false,
              pointRadius: 0,
              spanGaps: true,
              tension: 0.22,
              yAxisID: 'y',
              borderWidth: 2.4,
            },
            {
              label: `${t('fund.inventoryTrend')} (M)`,
              data: invSeries,
              borderColor: COLORS.blue,
              backgroundColor: 'rgba(0,122,255,0.12)',
              fill: false,
              pointRadius: 0,
              spanGaps: true,
              tension: 0.2,
              yAxisID: 'y1',
              borderWidth: 2.2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              align: 'end',
              labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7, font: { size: 11 } },
            },
            tooltip: {
              enabled: true,
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(0,0,0,0.85)',
              titleFont: { size: 10 },
              bodyFont: { size: 10 },
              callbacks: {
                label: (ctx) => ctx.dataset.yAxisID === 'y'
                  ? ` ${ctx.dataset.label}: ${Number(ctx.parsed.y || 0).toFixed(4)}%`
                  : ` ${ctx.dataset.label}: ${Number(ctx.parsed.y || 0).toFixed(2)}M`,
              },
            },
          },
          scales: {
            x: { ticks: { font: { size: 9 }, color: '#8B8B90', maxTicksLimit: 10 }, grid: { color: 'rgba(128,128,128,0.08)' } },
            y: {
              ticks: { font: { size: 10 }, color: '#8B8B90', callback: (v) => `${Number(v).toFixed(3)}%` },
              grid: { color: 'rgba(128,128,128,0.12)' },
            },
            y1: {
              position: 'right',
              ticks: { font: { size: 10 }, color: '#8B8B90', callback: (v) => `${Number(v).toFixed(1)}M` },
              grid: { drawOnChartArea: false },
            },
          },
        },
        plugins: [crosshairPlugin],
      });
    }
  
    function _renderFundThemes(d) {
      const groupMeta = {
        company_theme: { label: t('fund.investmentThemeExposure'), color: COLORS.blue, icon: 'bubble_chart' },
        company_product: { label: t('fund.brandProduct'), color: COLORS.teal, icon: 'widgets' },
        company_competitor: { label: t('fund.competitors'), color: COLORS.indigo, icon: 'compare_arrows' },
        company_country: { label: t('fund.countryExposure'), color: COLORS.green, icon: 'flag' },
        company_region: { label: t('fund.regionExposure'), color: COLORS.orange, icon: 'public' },
      };
      const order = ['company_theme', 'company_product', 'company_competitor', 'company_country', 'company_region'];
      const groupsRaw = Array.isArray(d?.groups) ? d.groups : [];
  
      if (groupsRaw.length) {
        const groups = groupsRaw
          .map(g => ({
            title: g?.title || '',
            type: g?.type || '',
            links: Array.isArray(g?.links) ? g.links : [],
          }))
          .filter(g => order.includes(g.type) && g.links.length);
  
        if (!groups.length) return `<div class="sod-fund-empty">${t('fund.noData')}</div>`;
        const map = Object.fromEntries(groups.map(g => [g.type, g]));
        const available = order.filter(k => map[k]);
        const activeType = map[_stockFundState.themesGroupType] ? _stockFundState.themesGroupType : available[0];
        _stockFundState.themesGroupType = activeType;
        const activeGroup = map[activeType];
        const items = [...(activeGroup?.links || [])].sort((a, b) => (a?.rank || 999) - (b?.rank || 999));
        const meta = groupMeta[activeType] || { label: activeGroup?.title || t('fund.investmentThemes'), color: COLORS.yellow, icon: 'lightbulb' };
  
        return `<div class="sod-fund-section">
          <div class="sod-fund-section-title" style="color:${COLORS.yellow}">
            <span class="material-icons">lightbulb</span> ${t('fund.investmentThemes')}
          </div>
          <div class="sod-fund-theme-tabs-wrap">
            <div class="sod-fund-theme-tabs">
              ${available.map(type => {
                const gm = groupMeta[type] || { label: map[type]?.title || type, color: COLORS.gray, icon: 'category' };
                const active = type === activeType;
                return `<button class="sod-fund-theme-tab ${active ? 'active' : ''}" data-theme-group="${type}" style="${active ? `background:${gm.color};color:#fff` : `background:${gm.color}18;color:${gm.color}`}">
                  <span class="material-icons">${gm.icon}</span>${gm.label}
                </button>`;
              }).join('')}
            </div>
          </div>
          <div class="sod-fund-theme-header">
            <div class="sod-fund-theme-title"><span class="material-icons" style="font-size:15px">${meta.icon}</span> ${meta.label}</div>
            <div class="sod-fund-theme-count">${t('fund.connectionsTotal', items.length)}</div>
          </div>
          <div class="sod-fund-theme-list">
            ${items.map((it, idx) => {
              const rank = Number.isFinite(Number(it?.rank)) ? Number(it.rank) : (idx + 1);
              const rawName = it?.name || it?.title || it?.key || '—';
              const name = String(rawName).replace(/_/g, ' ');
              const symbol = it?.symbol || '';
              const exchange = it?.exchange || '';
              const desc = it?.description || t('fund.noDescription');
              const idTag = symbol ? `${symbol}${exchange ? ` · ${exchange}` : ''}` : '';
              const idHtml = idTag
                ? (activeType === 'company_competitor'
                  ? `<button class="sod-fund-theme-id sod-fund-theme-id-btn sod-clickable-sym" type="button" data-theme-symbol="${symbol}">${idTag}</button>`
                  : `<div class="sod-fund-theme-id">${idTag}</div>`)
                : '';
              return `<div class="sod-fund-theme-item" style="--theme-color:${meta.color};--theme-tint:${meta.color}14">
                <div class="sod-fund-theme-item-head">
                  <div class="sod-fund-theme-rank">#${rank}</div>
                  <div class="sod-fund-theme-name">${name}</div>
                  ${idHtml}
                </div>
                <div class="sod-fund-theme-desc">${desc}</div>
              </div>`;
            }).join('')}
          </div>
        </div>`;
      }
  
      const themes = d?.linked_themes || d?.themes || (Array.isArray(d) ? d : []);
      if (!themes.length) return `<div class="sod-fund-empty">${t('fund.noData')}</div>`;
      return `<div class="sod-fund-section">
        <div class="sod-fund-section-title" style="color:${COLORS.yellow}"><span class="material-icons">lightbulb</span> ${t('fund.investmentThemes')}</div>
        ${themes.map((th, idx) => `
          <div class="sod-fund-theme-item" style="--theme-color:${[COLORS.blue, COLORS.purple, COLORS.teal, COLORS.orange, COLORS.pink, COLORS.indigo][idx % 6]};--theme-tint:${[COLORS.blue, COLORS.purple, COLORS.teal, COLORS.orange, COLORS.pink, COLORS.indigo][idx % 6]}14">
            <div class="sod-fund-theme-item-head">
              <div class="sod-fund-theme-rank">#${idx + 1}</div>
              <div class="sod-fund-theme-name">${th.name || '—'}</div>
            </div>
            <div class="sod-fund-theme-desc">${th.description || t('fund.noDescription')}</div>
          </div>
        `).join('')}
      </div>`;
    }
  
    function _bindFundThemesEvents(data) {
      const content = _root.querySelector('#sod-fund-content');
      if (!content) return;
      content.querySelectorAll('.sod-fund-theme-tabs-wrap').forEach(bindHorizontalWheelScroll);
      content.querySelectorAll('.sod-fund-theme-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          _stockFundState.themesGroupType = btn.dataset.themeGroup || 'company_theme';
          content.innerHTML = _renderFundThemes(data);
          _bindFundThemesEvents(data);
        });
      });
      content.querySelectorAll('[data-theme-symbol]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const symbol = (btn.dataset.themeSymbol || '').trim().toUpperCase();
          if (symbol) await _jumpToStockDetail(symbol);
        });
      });
    }
  
    async function _jumpToStockDetail(symbol) {
      const sym = String(symbol || '').trim().toUpperCase();
      if (!sym || !_root) return;
      const isStockActive = !!_root.querySelector('#sod-page-stock.active');
      if (!isStockActive) {
        _root.querySelector('.sod-tab[data-tab="stock"]')?.click();
      }
      await _triggerStockLoad(sym);
      const quoteBar = _root.querySelector('#sod-stock-quote-bar');
      if (quoteBar) quoteBar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  
    function _renderFundThirdParty(tabKey) {
      const portalRouteBase = `${_ibkrUrl('/portal/#/fundamentals/iframe_route/')}`;
      const tabConfig = {
        tipranks: { label: 'TipRanks', url: `${portalRouteBase}tipranks`, color: COLORS.orange },
        trading_central: { label: 'Trading Central', url: `${portalRouteBase}trading_central`, color: COLORS.indigo },
        estimize: { label: 'Estimize', url: `${portalRouteBase}estimize`, color: COLORS.pink },
      };
      const cfg = tabConfig[tabKey] || {};
      return `<div class="sod-fund-empty" style="flex-direction:column;gap:12px">
        <span class="material-icons" style="font-size:32px;color:${cfg.color || 'var(--text3)'}">open_in_new</span>
        <div style="font-size:13px;font-weight:600">${cfg.label || tabKey}</div>
        <div style="font-size:11px;color:var(--text3)">${t('fund.thirdPartySessionRequired')}</div>
        <a href="${cfg.url}" target="_blank" style="padding:6px 16px;background:${cfg.color || COLORS.blue};color:#fff;border-radius:8px;font-size:11px;font-weight:600;text-decoration:none">${t('fund.openInIbkrPortal')}</a>
      </div>`;
    }
  
    /* ── IBKR News Module ── */
  
    function _ibkrNewsBase() { return _ibkrUrl('/tws.proxy/news2/articles/feed'); }
    function _ibkrNewsContentBase() { return _ibkrUrl('/tws.proxy/news2/content'); }
    function _ibkrTickleUrl() { return _ibkrUrl('/portal.proxy/v1/portal/tickle'); }
    function _ibkrStockLookupUrl() { return _ibkrUrl('/portal.proxy/v1/portal/trsrv/stocks'); }
  
    const IBKR_NEWS_CATEGORIES = [
      { key: 'newswire', label: 'stock.newsTab.news', color: COLORS.blue },
      { key: 'research_reports', label: 'stock.newsTab.research', color: COLORS.purple },
      { key: 'market_commentary', label: 'stock.newsTab.commentary', color: COLORS.teal },
      { key: 'press_releases', label: 'stock.newsTab.press', color: COLORS.green },
      { key: 'fillings', label: 'stock.newsTab.filings', color: COLORS.orange },
      { key: 'takeaways', label: 'stock.newsTab.takeaways', color: COLORS.pink },
      { key: 'transcripts', label: 'stock.newsTab.transcripts', color: COLORS.indigo },
      { key: 'rss', label: 'stock.newsTab.rss', color: COLORS.red },
    ];
  
    let _ibkrConidCache = {};
    let _stockNewsState = { tab: 'newswire', articles: [], loading: false };
    let _ibkrKeepAliveTimer = null;
    let _ibkrReqSeq = 0;
    let _ibkrCcpSessionIdCache = null;
  
    function _extractIBKRCCPSessionId() {
      if (_ibkrCcpSessionIdCache) return _ibkrCcpSessionIdCache;
      try {
        const m = document.documentElement?.innerHTML?.match(/[a-f0-9]{8}\.\d{8}/i);
        if (m?.[0]) {
          _ibkrCcpSessionIdCache = m[0];
          return _ibkrCcpSessionIdCache;
        }
      } catch (_) {}
      return '';
    }
  
    function _ibkrOrbisaHeaders() {
      const ccp = _extractIBKRCCPSessionId();
      if (!ccp) return null;
      _ibkrReqSeq += 1;
      return {
        'x-request-id': String(_ibkrReqSeq),
        'x-embedded-in': 'web',
        'x-client-label': 'IB',
        'x-service': 'AM.LOGIN',
        'x-ccp-session-id': ccp,
      };
    }
  
    async function _ibkrFetch(url, options = {}) {
      const requestUrl = /^https?:\/\//i.test(String(url || '')) ? String(url) : _ibkrUrl(String(url || ''));
      const requestHost = _normalizeIBKRHost((() => { try { return new URL(requestUrl).hostname; } catch (_) { return ''; } })());
      if (requestHost) _rememberIBKRHost(requestHost);
  
      if (_isOnIBKR()) {
        _rememberIBKRHost(window.location.hostname || '');
        let runtimeUrl = requestUrl;
        try {
          const u = new URL(requestUrl);
          if (u.hostname.endsWith('interactivebrokers.com') && u.hostname !== window.location.hostname) {
            runtimeUrl = `${window.location.origin}${u.pathname}${u.search}${u.hash}`;
          }
        } catch (_) {}
        const isOrbisa = /\/orbisa\/lending\//.test(requestUrl);
        const baseHeaders = options.headers instanceof Headers
          ? Object.fromEntries(options.headers.entries())
          : { ...(options.headers || {}) };
  
        const tryFetch = async (refreshCcp = false) => {
          const headers = { ...baseHeaders };
          if (isOrbisa) {
            if (refreshCcp) _ibkrCcpSessionIdCache = null;
            const extra = _ibkrOrbisaHeaders();
            if (extra) Object.assign(headers, extra);
          }
          return fetch(runtimeUrl, { credentials: 'include', ...options, headers });
        };
  
        let r = await tryFetch(false);
        if (!r.ok && isOrbisa) {
          r = await tryFetch(true);
        }
        if (!r.ok) throw new Error(`IBKR fetch failed: ${r.status}`);
        return r.json();
      }
      if (typeof GM_xmlhttpRequest !== 'undefined') {
        return new Promise((resolve, reject) => {
          const ibkrOrigin = _ibkrOrigin();
          GM_xmlhttpRequest({
            method: options.method || 'GET',
            url: requestUrl,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              origin: ibkrOrigin,
              referer: `${ibkrOrigin}/`,
              ...(options.headers || {}),
            },
            data: options.body || undefined,
            anonymous: false,
            onload: (res) => {
              if (res.status >= 200 && res.status < 300) {
                try { resolve(JSON.parse(res.responseText)); } catch (e) { reject(e); }
              } else { reject(new Error(`IBKR ${res.status}`)); }
            },
            onerror: () => reject(new Error('IBKR request failed')),
          });
        });
      }
      throw new Error('GM_xmlhttpRequest not available — please use Tampermonkey');
    }
  
    async function ibkrTickle() {
      try {
        await _ibkrFetch(_ibkrTickleUrl(), { method: 'POST' });
        console.log(TAG, 'IBKR tickle OK');
      } catch (e) { console.warn(TAG, 'IBKR tickle failed:', e.message); }
    }
  
    /** Reset the IBKR portal's front-end inactivity auto-logout timer (default 15 min).
     *  Must run in page context because Tampermonkey sandbox can't access window.onebar. */
    function _resetIBKRAutoLogoutTimer() {
      if (!_isOnIBKR()) return;
      try {
        const s = document.createElement('script');
        s.textContent = 'try{window.onebar&&window.onebar.resetAutoLogoutTimer()}catch(e){}';
        document.documentElement.appendChild(s);
        s.remove();
      } catch (_) {}
    }
  
    function startIBKRKeepAlive() {
      if (_ibkrKeepAliveTimer) return;
      ibkrTickle().catch(() => {});
      _resetIBKRAutoLogoutTimer();
      _ibkrKeepAliveTimer = setInterval(() => { ibkrTickle().catch(() => {}); _resetIBKRAutoLogoutTimer(); }, 5 * 60 * 1000);
      console.log(TAG, 'IBKR keep-alive started (5min interval)');
    }
  
    function stopIBKRKeepAlive() {
      if (_ibkrKeepAliveTimer) { clearInterval(_ibkrKeepAliveTimer); _ibkrKeepAliveTimer = null; }
    }
  
    async function resolveIBKRConid(symbol) {
      if (_ibkrConidCache[symbol]) return _ibkrConidCache[symbol];
      try {
        const data = await _ibkrFetch(`${_ibkrStockLookupUrl()}?symbols=${encodeURIComponent(symbol)}`);
        const entries = data[symbol] || data[symbol.toUpperCase()] || Object.values(data)[0];
        if (Array.isArray(entries)) {
          for (const entry of entries) {
            const contracts = entry.contracts || [];
            const usContract = contracts.find(c => c.isUS) || contracts[0];
            if (usContract?.conid) {
              _ibkrConidCache[symbol] = Number(usContract.conid);
              return Number(usContract.conid);
            }
          }
        }
        throw new Error('No conid found');
      } catch (e) {
        console.warn(TAG, 'IBKR conid resolve failed for', symbol, e.message);
        return null;
      }
    }
  
    async function fetchIBKRNews(symbol, category = 'newswire') {
      const conid = await resolveIBKRConid(symbol);
      if (!conid) throw new Error('Cannot resolve IBKR contract ID. Ensure IBKR portal is open.');
      const lang = getSavedLang() === 'zh' ? 'zh' : 'en';
      const url = `${_ibkrNewsBase()}?key=contract:${conid}&include=image,teaser,contractDetails,summary&max=50&filters.content=${category}&lang=${lang}&tz=America/New_York`;
      const data = await _ibkrFetch(url);
      return data.results || [];
    }
  
    async function fetchIBKRArticleContent(newsId) {
      const lang = getSavedLang() === 'zh' ? 'zh' : 'en';
      const url = `${_ibkrNewsContentBase()}/${newsId}?lang=${lang}&tz=America/New_York&hide_image=true`;
      const data = await _ibkrFetch(url);
      return data.better_content || data.raw_content || '';
    }
  
    function renderStockNewsModule() {
      const tabsWrap = _root.querySelector('#sod-stock-news-tabs-wrap');
      if (!tabsWrap) return;
  
      tabsWrap.innerHTML = `<div class="sod-stock-news-tabs">${IBKR_NEWS_CATEGORIES.map(cat => {
        const active = _stockNewsState.tab === cat.key;
        return `<button class="sod-stock-news-tab" data-news-cat="${cat.key}" style="${active ? `background:${cat.color};color:#fff` : `background:${cat.color}18;color:${cat.color}`}">${t(cat.label)}</button>`;
      }).join('')}</div>`;
  
      tabsWrap.querySelectorAll('.sod-stock-news-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          _stockNewsState.tab = btn.dataset.newsCat;
          renderStockNewsModule();
          if (_stockState.symbol) loadStockNews();
        });
      });
  
      if (!_stockNewsState.loading && _stockNewsState.articles.length === 0 && _stockState.symbol) {
        loadStockNews();
      } else {
        renderStockNewsList();
      }
    }
  
    function renderStockNewsList() {
      const list = _root.querySelector('#sod-stock-news-list');
      if (!list) return;
  
      if (_stockNewsState.loading) {
        list.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text3);font-size:11px">${t('stock.newsLoading')}</div>`;
        return;
      }
  
      if (!_stockNewsState.articles.length) {
        list.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text3);font-size:11px">${t('stock.newsNone')}</div>`;
        return;
      }
  
      const srcColors = {};
      const palette = [COLORS.blue, COLORS.purple, COLORS.teal, COLORS.orange, COLORS.green, COLORS.pink, COLORS.indigo, COLORS.red];
      let colorIdx = 0;
  
      function _timeAgo(ts) {
        if (!ts) return '';
        const diff = Date.now() - ts;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 7) return `${days}d ago`;
        return `${Math.floor(days / 7)}w ago`;
      }
  
      list.innerHTML = _stockNewsState.articles.map(a => {
        const src = a.provider_name || a.source || '';
        if (!srcColors[src]) { srcColors[src] = palette[colorIdx++ % palette.length]; }
        const sc = srcColors[src];
        const hot = a.hot ? `<span class="sod-stock-news-hot">HOT</span> ` : '';
        const time = a.displayTime || '';
        const ago = a.time ? _timeAgo(a.time) : '';
        const readMin = a.minutes_to_read ? Math.ceil(a.minutes_to_read) + ' min read' : '';
        const teaser = a.teaser || '';
        const headline = a.headLineContent || '';
        const nid = a.newsId || '';
        return `<div class="sod-stock-news-item" data-news-id="${nid}">
          <div class="sod-stock-news-head">${hot}${headline}</div>
          <div class="sod-stock-news-meta">
            <span class="sod-stock-news-src" style="background:${sc}18;color:${sc}">${src}</span>
            <span class="sod-stock-news-time">${time}</span>
            ${ago ? `<span class="sod-stock-news-ago">${ago}</span>` : ''}
            <span class="sod-stock-news-read">${readMin}</span>
          </div>
          <div class="sod-stock-news-teaser">${teaser}</div>
          ${nid ? `<button class="sod-stock-news-full-btn" data-nid="${nid}"><span class="material-icons" style="font-size:11px;vertical-align:-2px">article</span> ${t('stock.newsReadFull')}</button>` : ''}
          <div class="sod-stock-news-full-content"></div>
        </div>`;
      }).join('');
  
      list.querySelectorAll('.sod-stock-news-item').forEach(item => {
        item.addEventListener('click', (e) => {
          if (e.target.closest('.sod-stock-news-full-btn') || e.target.closest('a')) return;
          if (e.target.closest('.sod-stock-news-full-content') && window.getSelection()?.toString()) return;
          item.classList.toggle('expanded');
        });
  
        const fullBtn = item.querySelector('.sod-stock-news-full-btn');
        const fullContent = item.querySelector('.sod-stock-news-full-content');
        if (fullBtn && fullContent) {
          fullBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (fullContent.dataset.loaded === 'true') {
              fullContent.classList.toggle('loaded');
              fullBtn.style.display = fullContent.classList.contains('loaded') ? 'none' : '';
              return;
            }
            fullBtn.disabled = true;
            fullBtn.textContent = t('stock.newsLoadingFull');
            fullContent.classList.add('loaded');
            fullContent.innerHTML = `<div style="color:var(--text3);font-size:10px;padding:4px 0">${t('stock.newsLoadingFull')}</div>`;
            try {
              const html = await fetchIBKRArticleContent(fullBtn.dataset.nid);
              fullContent.innerHTML = html || `<em style="color:var(--text3)">${t('stock.newsFullFailed')}</em>`;
              fullContent.dataset.loaded = 'true';
              fullBtn.style.display = 'none';
            } catch (err) {
              console.warn(TAG, 'Failed to load IBKR article:', err.message);
              fullContent.innerHTML = `<em style="color:${COLORS.red};font-size:10px">${t('stock.newsFullFailed')}</em>`;
              fullContent.classList.remove('loaded');
              fullBtn.disabled = false;
              fullBtn.innerHTML = `<span class="material-icons" style="font-size:11px;vertical-align:-2px">article</span> ${t('stock.newsReadFull')}`;
            }
          });
        }
      });
    }
  
    function _isTraditionalChinese(text) {
      if (!text) return false;
      const tcChars = /[這們從與國會過進開對學電後長時點發說問關還現場動當報網據體結構環實際區業書買價間數變類給難購質證標節議試選壓導險織調幣續額領態職責團願營獎輸邊論隨處達較隊種農齊馬車門飛認義藝運費廣億歲歷圖務軍顯單戰機規產總衛觀預經濟聯歡應無線視頻響覽設計話絡辦將見東車頭號決讓條歸雲陽陰雙鑰鍵鋼錢銀鉛針釋裝製複視訊評許記訂詢詞該課請論講識護財貿賺賴賦賣質鬥龍龜齡點]/;
      let count = 0;
      for (const ch of text) {
        if (tcChars.test(ch)) count++;
        if (count >= 2) return true;
      }
      return false;
    }
  
    function _filterAndDedupeArticles(articles) {
      const filtered = articles.filter(a => !_isTraditionalChinese(a.headLineContent || ''));
      const seen = new Set();
      return filtered.filter(a => {
        const title = (a.headLineContent || '').trim();
        if (!title) return true;
        if (seen.has(title)) return false;
        seen.add(title);
        return true;
      });
    }
  
    async function loadStockNews() {
      if (!_stockState.symbol) return;
      _stockNewsState.loading = true;
      _stockNewsState.articles = [];
      renderStockNewsList();
      try {
        startIBKRKeepAlive();
        const articles = await fetchIBKRNews(_stockState.symbol, _stockNewsState.tab);
        _stockNewsState.articles = _filterAndDedupeArticles(articles);
      } catch (e) {
        console.warn(TAG, 'IBKR news load failed:', e.message);
        _stockNewsState.articles = [];
      } finally {
        _stockNewsState.loading = false;
        renderStockNewsList();
      }
    }
  
    /* ── Stock AI Analysis ── */
  
    let _stockAIState = { generating: false, output: '', lastPrompt: '', dataSources: { quote: true, news: true } };
  
    const _stockAICtx = {
      uid: 'stock',
      titleClass: 'sod-stock-card-title sod-stock-card-title-ai',
      state: _stockAIState,
      panelEl: null,
      dataSources: [
        { key: 'quote', icon: 'candlestick_chart', color: '#FF6384' },
        { key: 'news', icon: 'article', color: COLORS.orange },
      ],
      buildPrompt: () => buildStockPrompt(),
      onRender: () => renderStockAIModule(),
      onSaveDataSources: null,
    };
    _stockAICtx.onAnalyze = () => {
      if (!_stockState.symbol) { showToast('Load a stock first', 'warn'); return; }
      _runAIPanelAnalysis(_stockAICtx);
    };
  
    function renderStockAIModule() {
      const panel = _root.querySelector('#sod-stock-ai-card');
      if (!panel) return;
      _stockAICtx.panelEl = panel;
      _stockAICtx.title = t('stock.ai.title');
      _stockAICtx.analyzeLabel = t('stock.ai.analyze');
      _stockAICtx.emptyText = t('stock.ai.click');
      _stockAICtx.dataSources[0].label = t('stock.priceChart');
      _stockAICtx.dataSources[1].label = t('stock.news');
      _renderAIPanel(panel, _stockAICtx);
    }
  
    function buildStockPrompt() {
      const isZh = getSavedLang() === 'zh';
      const sym = _stockState.symbol;
      const parts = [];
  
      if (isZh) {
        parts.push(`你是一位资深股票分析师。请根据以下来自用户仪表盘的 ${sym} 实时数据，生成一份全面而简洁的个股分析报告。请使用中文撰写。使用 Markdown 格式，包含 ## 标题和项目符号。使用水平分割线 (---) 分隔各主要部分。\n`);
      } else {
        parts.push(`You are a senior equity analyst. Analyze the following live data for ${sym} from the user's dashboard. Produce a comprehensive but concise stock analysis report. Use markdown with ## headers and bullet points. Separate sections with horizontal rules (---).\n`);
      }
  
      const ds = _stockAIState.dataSources;
      const q = _stockState.quoteData;
      if (ds.quote && q) {
        const ref = q.reference || {};
        const quote = q.quote || {};
        const reg = q.regularQuote || {};
        parts.push(`## Quote Data for ${sym}`);
        parts.push(`- **Company**: ${ref.companyName || sym} (${ref.exchangeName || ''})`);
        parts.push(`- **Sector**: ${ref.category || 'N/A'}`);
        parts.push(`- **Last Price**: $${(quote.lastPrice ?? reg.lastPrice)?.toFixed(2)} | Change: ${(quote.netChange ?? 0) >= 0 ? '+' : ''}${(quote.netChange ?? 0)?.toFixed(2)} (${(quote.netChangePercent ?? 0)?.toFixed(2)}%)`);
        parts.push(`- **Regular Close**: $${reg.lastPrice?.toFixed(2)} | Change: ${(reg.netChange ?? 0) >= 0 ? '+' : ''}${(reg.netChange ?? 0)?.toFixed(2)} (${(reg.percentChange ?? 0)?.toFixed(2)}%)`);
        parts.push(`- **Bid/Ask**: $${quote.bidPrice?.toFixed(2)} / $${quote.askPrice?.toFixed(2)} (${quote.bidSize}×${quote.askSize})`);
        parts.push(`- **Previous Close**: $${quote.previousClosePrice?.toFixed(2)} | Open: $${quote.openPrice?.toFixed(2)}`);
        parts.push(`- **Day Range**: $${quote.lowPrice?.toFixed(2)} — $${quote.highPrice?.toFixed(2)}`);
        parts.push(`- **52W Range**: $${quote.priceLow52W?.toFixed(2)} — $${quote.priceHigh52W?.toFixed(2)}`);
        parts.push(`- **Volume**: ${fmtNum(quote.volume, true)} (${quote.averageVolumeDaily || 'N/A'})`);
        parts.push(`- **Market Status**: ${q.marketType || 'Unknown'}`);
        if (q.fundamental?.schwabEquityRating) parts.push(`- **Schwab Equity Rating (SER)**: ${q.fundamental.schwabEquityRating}`);
      }
  
      if (ds.news && _stockNewsState.articles?.length) {
        parts.push(`\n## Recent News (${_stockNewsState.tab}, ${_stockNewsState.articles.length} articles)`);
        _stockNewsState.articles.slice(0, 8).forEach(a => {
          const sentiment = a.sentiment ? ` [Sentiment: ${a.sentiment}]` : '';
          const hot = a.hot ? ' 🔥HOT' : '';
          parts.push(`- **${a.headLineContent}**${hot}${sentiment}`);
          parts.push(`  Source: ${a.provider_name || a.source || ''} | ${a.displayTime || ''}`);
          if (a.teaser) parts.push(`  > ${a.teaser.substring(0, 200)}${a.teaser.length > 200 ? '...' : ''}`);
        });
      }
  
      parts.push('\n---');
      if (_aiState.webSearch) {
        if (isZh) {
          parts.push(`重要：你已启用网络搜索。请使用它查找 ${sym} 的最新消息、分析师评论、财报与指引动态，以及与上述新闻标题相关的实时背景。请在行文中使用标准引用格式标注网络来源，以便读者验证。`);
        } else {
          parts.push(`IMPORTANT: You have web search enabled. Use it to look up the latest updates for ${sym} (news, analyst commentary, earnings/guidance) and real-time context related to the headlines above. Cite your web sources inline using the standard citation format so the reader can verify.`);
        }
      }
      if (isZh) {
        parts.push('请提供：\n1. **技术面摘要** — 根据价格、成交量、日内/52周范围分析\n2. **新闻情绪分析** — 总结近期新闻的整体情绪和关键主题\n3. **关键支撑/阻力位** — 基于当前数据推断\n4. **风险因素** — 需要关注的风险\n5. **短期展望** — 未来1-5个交易日的预期\n6. **综合评级** — 看涨/看跌/中性，并附理由');
      } else {
        parts.push('Please provide:\n1. **Technical Summary** — based on price, volume, day/52W ranges\n2. **News Sentiment** — overall sentiment and key themes from recent news\n3. **Key Support/Resistance** — inferred from current data\n4. **Risk Factors** — risks to watch\n5. **Short-term Outlook** — expectation for next 1-5 trading days\n6. **Overall Rating** — Bullish/Bearish/Neutral with reasoning');
      }
  
      return parts.join('\n');
    }
  
  
  
    /* ── Market modules orchestrator ── */
    let _tickerIntervalId = null;
  
    function initResizeHandles() {
      const layout = _root.querySelector('#sod-market-layout');
      if (!layout) return;
  
      layout.querySelectorAll('.sod-resize-h').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
          e.preventDefault();
          handle.classList.add('active');
          const prevCol = handle.previousElementSibling;
          const nextCol = handle.nextElementSibling;
          if (!prevCol || !nextCol) return;
          const startX = e.clientX;
          const prevFlex = parseFloat(prevCol.style.flex) || 1;
          const nextFlex = parseFloat(nextCol.style.flex) || 1;
          const layoutWidth = layout.getBoundingClientRect().width;
  
          function onMove(ev) {
            const dx = ev.clientX - startX;
            const dFlex = (dx / layoutWidth) * 100;
            const newPrev = Math.max(10, prevFlex + dFlex);
            const newNext = Math.max(10, nextFlex - dFlex);
            prevCol.style.flex = newPrev;
            nextCol.style.flex = newNext;
          }
          function onUp() {
            handle.classList.remove('active');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            window.dispatchEvent(new Event('resize'));
          }
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
      });
  
      layout.querySelectorAll('.sod-resize-v').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
          e.preventDefault();
          handle.classList.add('active');
          const col = handle.closest('.sod-market-col');
          if (!col) return;
          const topCard = handle.previousElementSibling;
          const botCard = handle.nextElementSibling;
          if (!topCard || !botCard) return;
          const startY = e.clientY;
          const topH = topCard.getBoundingClientRect().height;
          const botH = botCard.getBoundingClientRect().height;
  
          topCard.style.flex = 'none';
          botCard.style.flex = 'none';
          topCard.style.height = topH + 'px';
          botCard.style.height = botH + 'px';
  
          function onMove(ev) {
            const dy = ev.clientY - startY;
            const newTop = Math.max(60, topH + dy);
            const newBot = Math.max(60, botH - dy);
            topCard.style.height = newTop + 'px';
            botCard.style.height = newBot + 'px';
          }
          function onUp() {
            handle.classList.remove('active');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            window.dispatchEvent(new Event('resize'));
          }
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
      });
    }
  
    async function loadTickerQuotes() {
      if (_sessionExpired) return;
      const dateEl = _root.querySelector('#sod-ticker-date');
      if (dateEl) {
        const now = new Date();
        dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      }
      try {
        await getToken();
        const r = await _schwabFetch('https://ausgateway.schwab.com/api/is.QuickQuoteExperience/V1/quotes?symbols=$DJI,$COMPX,$SPX,$RUT&serveFromCache=true', {
          headers: { ...marketHeaders('1'), 'schwab-clientapp-name': 'QuickQuote' },
        });
        if (!r.ok) return;
        const data = await r.json();
        const quotes = data.quotes || data;
        const map = { '$DJI': 'dji', '$COMPX': 'compx', '$SPX': 'spx', '$RUT': 'rut' };
        (Array.isArray(quotes) ? quotes : [quotes]).forEach(q => {
          const sym = q.reference?.symbol || q.symbol || q.Symbol;
          const key = map[sym];
          if (!key) return;
          const qd = q.quote || q;
          const price = qd.lastPrice ?? qd.Last ?? q.regularQuote?.lastPrice;
          const change = qd.netChange ?? qd.Change ?? q.regularQuote?.netChange ?? 0;
          const pct = qd.netChangePercent ?? qd.ChangePercent ?? q.regularQuote?.percentChange ?? 0;
          const pEl = _root.querySelector(`#sod-tk-${key}-p`);
          const cEl = _root.querySelector(`#sod-tk-${key}-c`);
          if (pEl) {
            pEl.textContent = price != null ? '$' + Number(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
            pEl.className = 'sod-stat-value blue';
          }
          if (cEl) {
            const up = change >= 0;
            cEl.textContent = `${up ? '+' : ''}${Number(change).toFixed(2)} (${up ? '+' : ''}${Number(pct).toFixed(2)}%)`;
            cEl.className = `sod-stat-value ${up ? 'green' : 'red'}`;
          }
        });
      } catch (e) { console.warn(TAG, 'Ticker load failed:', e); }
    }
  
    async function initMarketModules() {
      console.log(TAG, 'Initializing US Market modules...');
  
      if (_isOnIBKR()) {
        warmupSchwabMarketContext();
      }
      prefetchCalendarDefault();
  
      loadTickerQuotes();
      renderIndicesModule();
      renderCalendarModule();
      renderNewsModule();
      renderMoversModule();
      renderAIModule();
      initResizeHandles();
  
      loadIndicesRegion().catch(e => console.warn(TAG, 'Indices init failed:', e));
      loadCalendarData().catch(e => console.warn(TAG, 'Calendar init failed:', e));
      loadNewsData().catch(e => console.warn(TAG, 'News init failed:', e));
      loadMoversData().catch(e => console.warn(TAG, 'Movers init failed:', e));
  
      if (_tickerIntervalId) clearInterval(_tickerIntervalId);
      _tickerIntervalId = setInterval(loadTickerQuotes, 30000);
    }
  
    /* ───────────────────────────────────────────
       §9  INTEGRATION / FLOW
    ─────────────────────────────────────────── */
  
    async function doLoad(forceRefresh = false) {
      const sym = _root.querySelector('#sod-sym-input')?.value?.trim().toUpperCase() || _state.symbol;
      if (!sym) return;
      _state.symbol = sym;
      _xSet(LAST_SYMBOL_KEY, sym);
  
      const loadBtn = _root.querySelector('#sod-load-btn');
      const origText = loadBtn.innerHTML;
      loadBtn.innerHTML = '<span class="sod-loading"></span> Loading...';
      loadBtn.disabled = true;
  
      try {
        console.log(TAG, '=== LOADING', sym, forceRefresh ? '(force refresh)' : '===');
  
        const [miniChains, quote] = await Promise.all([getMiniChains(sym), getQuote(sym)]);
        _state.quoteData = quote;
  
        const exps = miniChains.expirationList || [];
        _state.expirations = exps;
  
        const expSelect = _root.querySelector('#sod-exp-select');
        expSelect.innerHTML = exps.map((e, i) => {
          const dt = new Date(e.expirationDate);
          const label = `${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (${e.daysToExpiration}d)`;
          return `<option value="${i}">${label}</option>`;
        }).join('');
  
        const nextExpIdx = exps.findIndex(e => e.daysToExpiration > 0);
        _state.selectedExpIdx = nextExpIdx >= 0 ? nextExpIdx : 0;
        expSelect.value = _state.selectedExpIdx;
  
        await loadChainForExpiration(forceRefresh);
  
        backgroundPreload(sym, exps);
  
      } catch (e) {
        console.error(TAG, 'Load error:', e);
        alert(`Load failed: ${e.message}`);
      } finally {
        loadBtn.innerHTML = origText;
        loadBtn.disabled = false;
      }
    }
  
    async function loadChainForExpiration(forceRefresh = false) {
      const exp = _state.expirations[_state.selectedExpIdx];
      if (!exp) return;
  
      const dateStr = exp.expirationDate.split('T')[0];
      const sym = _state.symbol;
  
      let chainData = null;
      if (!forceRefresh) {
        const cached = await cacheGet(sym, dateStr);
        if (cached?.data) {
          chainData = cached.data;
          console.log(TAG, 'Using cached data for', sym, dateStr);
        }
      }
  
      if (!chainData) {
        chainData = await getOptionChains(sym, exp.expirationDate);
        await cacheSet(sym, dateStr, chainData);
      }
  
      _state.chainData = chainData;
      _state.computed = computeAll(chainData, _state.quoteData);
      renderDashboardContent();
    }
  
    async function backgroundPreload(sym, exps) {
      console.log(TAG, 'Starting background preload for', sym);
      for (let i = 0; i < exps.length; i++) {
        if (i === _state.selectedExpIdx) continue;
        const dateStr = exps[i].expirationDate.split('T')[0];
        if (await cacheGet(sym, dateStr)) continue;
        try {
          await new Promise(r => setTimeout(r, 500));
          const data = await getOptionChains(sym, exps[i].expirationDate);
          await cacheSet(sym, dateStr, data);
        } catch (e) {
          console.warn(TAG, 'Preload failed:', dateStr, e.message);
        }
      }
      console.log(TAG, 'Background preload complete');
    }
  
    /* ───────────────────────────────────────────
       §10  UTILITIES
    ─────────────────────────────────────────── */
  
    function fmtNum(n, compact = false) {
      const num = typeof n === 'string' ? parseFloat(n) : n;
      if (isNaN(num)) return '—';
      if (compact) {
        const abs = Math.abs(num);
        if (abs >= 1e9) return (num / 1e9).toFixed(1) + 'B';
        if (abs >= 1e6) return (num / 1e6).toFixed(1) + 'M';
        if (abs >= 1e3) return (num / 1e3).toFixed(1) + 'K';
        return num.toFixed(0);
      }
      return num.toLocaleString();
    }
  
    /* ───────────────────────────────────────────
       §11  ENTRY POINT
    ─────────────────────────────────────────── */
  
    function loadScript(url) {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${url}"]`)) { resolve(); return; }
        const s = document.createElement('script');
        s.src = url;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
  
    async function ensureChartJs() {
      if (typeof Chart !== 'undefined') return;
      await loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js');
      await loadScript('https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js');
      await loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js');
    }
  
    async function init() {
      if (_isOnIBKR()) {
        // Start cross-site auth/token warmup as early as possible.
        warmupSchwabMarketContext();
      }
  
      await ensureChartJs();
      injectStyles();
      watchSystemTheme();
      await openDB();
  
      const trigger = document.createElement('button');
      trigger.id = 'schwab-opt-trigger';
      trigger.innerHTML = '<span class="material-icons">analytics</span>';
      trigger.title = 'Options Dashboard';
      document.body.appendChild(trigger);
  
      trigger.addEventListener('click', () => {
        createRoot();
        _root.style.display = 'flex';
        applyTheme();
  
        const saved = _xGet(LAST_SYMBOL_KEY, '');
        if (saved && !_state.symbol) {
          _state.symbol = saved;
          const inp = _root.querySelector('#sod-sym-input');
          if (inp) inp.value = saved;
        }
  
        if (!_state.computed) {
          _root.querySelector('#sod-grid').innerHTML = `<div class="sod-empty">${t('dash.empty')}</div>`;
        }
      });
  
      startKeepAlive();
      startIBKRKeepAlive();
      document.addEventListener('visibilitychange', handleVisibilityChange);
  
      console.log(TAG, 'Initialized. Keep-alive active. Click the floating button to open.');
    }
  
    if (document.readyState === 'complete') {
      init();
    } else {
      window.addEventListener('load', init);
    }
  
  })();
  
