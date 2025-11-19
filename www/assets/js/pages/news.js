(() => {
  console.log('[News] Script starting');
  const featuredContainer = document.getElementById('newsFeatured');
  const feedContainer = document.getElementById('newsFeed');
  const searchForm = document.getElementById('newsSearch');
  const searchInput = document.getElementById('newsSearchInput');
  const releaseContainer = document.getElementById('releaseFeed');

  console.log('[News] Containers found:', {
    featuredContainer: !!featuredContainer,
    feedContainer: !!feedContainer,
    releaseContainer: !!releaseContainer
  });

  if (!featuredContainer || !feedContainer) {
    console.error('[News] CRITICAL: Required containers not found!');
    return;
  }

  const defaultBase = (() => {
    if (window.CONTENT_API_BASE) return window.CONTENT_API_BASE;
    const { origin, hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://${hostname}:8083`;
    }
    return `${origin}/content-api`;
  })();

  const API_BASE = (defaultBase || '').replace(/\/$/, '');
  const formatter = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const validFilters = new Set(['all', 'favorites', 'tech', 'gaming', 'patch']);

  const FALLBACK_THUMBNAILS = [
    { pattern: /no man['’]?s sky/i, cover: 'https://cdn.cloudflare.steamstatic.com/steam/apps/275850/library_600x900.jpg' },
    { pattern: /battlefield\s*(?:6|redsec)/i, cover: 'https://cdn.cloudflare.steamstatic.com/steam/apps/2807960/library_600x900.jpg' },
    { pattern: /escape from tarkov/i, cover: 'https://cdn.cloudflare.steamstatic.com/steam/apps/3932890/library_600x900.jpg' },
    { pattern: /helldivers\s*2/i, cover: 'https://cdn.cloudflare.steamstatic.com/steam/apps/553850/library_600x900.jpg' },
    { pattern: /shell?diver/i, cover: 'https://cdn.cloudflare.steamstatic.com/steam/apps/3862670/library_600x900.jpg' }
  ];

  const cache = new Map();
  let lastRenderedArticles = [];
  let lastRenderedReleases = [];
  let articlesObserver;
  let releasesObserver;

  const PLACEHOLDER_PATTERNS = [/dummy_/i, /placeholder/i];

  const isImageUrl = (value) => {
    if (typeof value !== 'string') return false;
    try {
      const url = new URL(value, window.location.origin);
      return (
        /^https?:$/i.test(url.protocol) &&
        /\.(png|jpe?g|webp|gif|avif)$/i.test(url.pathname)
      );
    } catch {
      return false;
    }
  };

  const isPlaceholderImage = (url) =>
    typeof url === 'string' && PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(url));

  const normaliseImageValue = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
      if (!isImageUrl(value) || isPlaceholderImage(value)) return null;
      return value;
    }
    if (typeof value === 'object') {
      if (typeof value.url === 'string' && isImageUrl(value.url) && !isPlaceholderImage(value.url)) return value.url;
      if (typeof value.href === 'string' && isImageUrl(value.href) && !isPlaceholderImage(value.href)) return value.href;
    }
    return null;
  };

  const findImageInObject = (input, depth = 0) => {
    if (!input || depth > 4) return null;
    if (Array.isArray(input)) {
      for (const item of input) {
        const result = findImageInObject(item, depth + 1);
        if (result) return result;
      }
      return null;
    }
    if (typeof input === 'object') {
      for (const [key, value] of Object.entries(input)) {
        if (!value) continue;
        const normalized = normaliseImageValue(value);
        if (normalized) return normalized;
        if (
          typeof value === 'string' &&
          /^https?:\/\//i.test(value) &&
          /(image|cover|thumb|art|poster|hero|media|screenshot|box)/i.test(key)
        ) {
          return value;
        }
        if (typeof value === 'object') {
          const nested = findImageInObject(value, depth + 1);
          if (nested) return nested;
        }
      }
    }
    return null;
  };
  const state = {
    activeFilter: 'all',
    activeSearch: '',
    gameFavorites: new Set(),
    sourceFavorites: new Set(),
  };

  const truncate = (text, maxLength = 200) => {
    if (!text) return '';
    return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
  };

  const hasRealImage = (article) => Boolean(article.thumbnail_url && !article.thumbnail_url.includes('google.com/s2/favicons'));

  const getSourceIcon = (article) => {
    if (!article.url) return null;
    try {
      const domain = new URL(article.url).hostname;
      if (!domain) return null;
      return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
    } catch (error) {
      console.warn('[News] unable to parse source icon URL', error);
      return null;
    }
  };

  const createIcon = (url, alt = 'Source icon') => {
    const wrapper = document.createElement('span');
    wrapper.className = 'meta-header__icon';
    const img = document.createElement('img');
    img.src = url;
    img.alt = alt;
    img.loading = 'lazy';
    wrapper.appendChild(img);
    return wrapper;
  };

  const buildSummaryList = (summary) => {
    if (!summary) return null;
    const sentences = summary
      .replace(/\n+/g, ' ')
      .split(/(?<=\.)\s+/)
      .map((item) => item.trim())
      .filter((item) => item)
      .slice(0, 3);

    if (!sentences.length) return null;

    const ul = document.createElement('ul');
    sentences.forEach((sentence) => {
      const li = document.createElement('li');
      li.textContent = sentence;
      ul.appendChild(li);
    });
    return ul;
  };

  const formatCategory = (value) => {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const formatInfoText = (article) => [
    article.source_name,
    formatCategory(article.category),
    article.game_slug,
    article.published_at ? formatter.format(new Date(article.published_at)) : null,
  ].filter(Boolean).join(' • ');

  const createFavoriteButton = (article) => {
    const type = article.game_slug ? 'game' : 'source';
    const slug = type === 'game' ? article.game_slug : article.source_slug;
    if (!slug) return null;

    const isActive = type === 'game' ? state.gameFavorites.has(slug) : state.sourceFavorites.has(slug);
    const button = document.createElement('button');
    button.className = 'favorite-toggle';
    if (isActive) button.classList.add('is-active');
    button.setAttribute('type', 'button');
    button.setAttribute('aria-pressed', String(isActive));
    button.setAttribute('aria-label', `Toggle favorite for ${slug}`);
    button.textContent = isActive ? '★' : '☆';

    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextState = !button.classList.contains('is-active');
      try {
        await toggleFavorite(type, slug, nextState);
        button.classList.toggle('is-active', nextState);
        button.setAttribute('aria-pressed', String(nextState));
        button.textContent = nextState ? '★' : '☆';
      } catch (error) {
        console.error('[News] Failed to toggle favorite', error);
      }
    });

    return button;
  };

  const attachMeta = (meta, titleElement, article) => {
    const header = document.createElement('div');
    header.className = 'meta-header';

    const content = document.createElement('div');
    content.className = 'meta-header__content';

    const iconUrl = getSourceIcon(article);
    if (iconUrl) {
      content.appendChild(createIcon(iconUrl, `${article.source_name || 'Source'} icon`));
    }
    content.appendChild(titleElement);
    header.appendChild(content);

    const actions = document.createElement('div');
    actions.className = 'meta-header__actions';
    const favoriteButton = createFavoriteButton(article);
    if (favoriteButton) {
      actions.appendChild(favoriteButton);
    }
    header.appendChild(actions);
    meta.appendChild(header);

    const body = document.createElement('div');
    body.className = 'meta-body';
    meta.appendChild(body);

    return { body };
  };

  const ensureVisibility = (node, display) => {
    if (!node) return;
    node.hidden = false;
    if (display) {
      node.style.setProperty('display', display, 'important');
    }
    node.style.removeProperty('visibility');
    node.style.removeProperty('opacity');
  };

  const renderHero = (article) => {
    const card = document.createElement('article');
    card.className = 'card featured-story';

    const meta = document.createElement('div');
    meta.className = 'featured-story__meta';

    const title = document.createElement('h2');
    title.textContent = article.title;

    const { body } = attachMeta(meta, title, article);

    const info = document.createElement('div');
    info.className = 'muted';
    info.textContent = formatInfoText(article);
    body.appendChild(info);

    const summaryList = buildSummaryList(article.summary);
    if (summaryList) {
      body.appendChild(summaryList);
    } else if (article.summary) {
      const para = document.createElement('p');
      para.className = 'muted';
      para.textContent = truncate(article.summary, 280);
      body.appendChild(para);
    }

    const cta = document.createElement('a');
    cta.className = 'action-button action-button--outline';
    cta.href = article.url;
    cta.target = '_blank';
    cta.rel = 'noopener';
    cta.textContent = 'Read full update';
    body.appendChild(cta);

    card.appendChild(meta);

    if (hasRealImage(article)) {
      const media = document.createElement('div');
      media.className = 'featured-story__media';
      const img = document.createElement('img');
      img.src = article.thumbnail_url;
      img.alt = `${article.title} cover art`;
      img.loading = 'lazy';
      media.appendChild(img);
      card.appendChild(media);
    }

    featuredContainer.appendChild(card);
  };

  const renderCard = (article) => {
    const card = document.createElement('article');
    card.className = 'card story-card';

    if (hasRealImage(article)) {
      const thumb = document.createElement('div');
      thumb.className = 'story-card__thumb';
      const img = document.createElement('img');
      img.src = article.thumbnail_url;
      img.alt = `${article.title} thumbnail`;
      img.loading = 'lazy';
      thumb.appendChild(img);
      card.appendChild(thumb);
    }

    const meta = document.createElement('div');
    meta.className = 'story-card__meta';

    const title = document.createElement('h3');
    title.textContent = article.title;

    const { body } = attachMeta(meta, title, article);

    if (article.summary) {
      const desc = document.createElement('p');
      desc.textContent = truncate(article.summary, 180);
      body.appendChild(desc);
    }

    const info = document.createElement('span');
    info.className = 'muted';
    info.textContent = formatInfoText(article);
    body.appendChild(info);

    const link = document.createElement('a');
    link.className = 'action-button action-button--outline';
    link.href = article.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Read more';
    body.appendChild(link);

    card.appendChild(meta);
    return card;
  };

  const renderLoading = () => {
    featuredContainer.innerHTML = '';
    feedContainer.innerHTML = '';
    const loading = document.createElement('p');
    loading.className = 'muted';
    loading.textContent = 'Loading articles…';
    feedContainer.appendChild(loading);
  };

  const selectTopArticle = (articles) => {
    if (!articles.length) return articles;

    const findPreferredIndex = () => {
      const n4gWithImage = articles.findIndex((article) => article.source_slug?.startsWith('n4g') && hasRealImage(article));
      if (n4gWithImage !== -1) return n4gWithImage;
      const anyWithImage = articles.findIndex((article) => hasRealImage(article));
      if (anyWithImage !== -1) return anyWithImage;
      const anyN4g = articles.findIndex((article) => article.source_slug?.startsWith('n4g'));
      if (anyN4g !== -1) return anyN4g;
      return 0;
    };

    const index = findPreferredIndex();
    if (index <= 0) return articles;
    const [preferred] = articles.splice(index, 1);
    articles.unshift(preferred);
    return articles;
  };

  const orderForGrid = (articles) =>
    articles.sort((a, b) => {
      const imgDiff = Number(hasRealImage(b)) - Number(hasRealImage(a));
      if (imgDiff !== 0) return imgDiff;
      const aTime = a.published_at ? new Date(a.published_at).getTime() : 0;
      const bTime = b.published_at ? new Date(b.published_at).getTime() : 0;
      return bTime - aTime;
    });

  const renderArticles = (articles) => {
    console.debug('[News] renderArticles state', {
      previousCount: lastRenderedArticles.length,
      incomingCount: articles.length,
      previousRenderTime: lastRenderedArticles.timestamp,
    });
    console.debug('[News] renderArticles', { count: articles.length });
    ensureVisibility(featuredContainer, 'grid');
    ensureVisibility(feedContainer, 'grid');
    featuredContainer.innerHTML = '';
    feedContainer.innerHTML = '';

    if (!articles.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'No articles available yet. Favorites will appear here once sources are activated.';
      feedContainer.appendChild(empty);
      return;
    }

    const ordered = selectTopArticle([...articles]);
    const [first, ...rest] = ordered;
    if (first) {
      console.debug('[News] renderArticles rendering hero', first.title);
      renderHero(first);
    }

    orderForGrid(rest).forEach((article) => {
      console.debug('[News] renderArticles rendering card', article.title);
      feedContainer.appendChild(renderCard(article));
    });

    lastRenderedArticles = Object.assign([...articles], { timestamp: Date.now() });
    console.debug('[News] feed now has', feedContainer.children.length, 'children');
    if (!articlesObserver) {
      articlesObserver = new MutationObserver(() => {
        const childCount = feedContainer.children.length;
        console.debug('[News] observer fired', { childCount });
        if (!childCount && lastRenderedArticles.length) {
          console.warn('[News] feed emptied unexpectedly; re-rendering cached articles');
          renderArticles([...lastRenderedArticles]);
        }
      });
      articlesObserver.observe(feedContainer, { childList: true });
    }
  };

  const renderError = (message) => {
    featuredContainer.innerHTML = '';
    feedContainer.innerHTML = '';

    const error = document.createElement('p');
    error.className = 'muted';
    error.textContent = message;
    feedContainer.appendChild(error);
  };

  const normalizeArticles = (articles) =>
    articles
      .map((item) => ({
        ...item,
        summary: item.summary || '',
        published_at: item.published_at || item.created_at || null,
      }))
      .sort((a, b) => {
        const aTime = a.published_at ? new Date(a.published_at).getTime() : 0;
        const bTime = b.published_at ? new Date(b.published_at).getTime() : 0;
        return bTime - aTime;
      });

  const loadGameFavorites = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/games`, { 
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error(`Games fetch failed (${response.status})`);
      const games = await response.json();
      state.gameFavorites = new Set(games.filter((game) => game.is_active).map((game) => game.slug));
    } catch (error) {
      console.error('[News] failed to load game favorites', error);
      state.gameFavorites = new Set();
    }
  };

  const loadSourceFavorites = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/sources`, { 
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error(`Sources fetch failed (${response.status})`);
      const sources = await response.json();
      state.sourceFavorites = new Set(sources.filter((source) => source.is_active).map((source) => source.slug));
    } catch (error) {
      console.error('[News] failed to load source favorites', error);
      state.sourceFavorites = new Set();
    }
  };

  const toggleFavorite = async (type, slug, nextState) => {
    const endpoint = type === 'game' ? `/api/games/${slug}` : `/api/sources/${slug}`;
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ is_active: nextState }),
    });

    if (!response.ok) {
      throw new Error(`Failed to toggle favorite (${response.status})`);
    }

    if (type === 'game') {
      if (nextState) {
        state.gameFavorites.add(slug);
      } else {
        state.gameFavorites.delete(slug);
      }
    } else {
      if (nextState) {
        state.sourceFavorites.add(slug);
      } else {
        state.sourceFavorites.delete(slug);
      }
    }

    if (state.activeFilter === 'favorites') {
      loadFavoriteArticles(state.activeSearch);
    }
  };

  const buildCacheKey = ({ category, search, mode }) => {
    const parts = [`mode:${mode || 'default'}`];
    if (category) parts.push(`category:${category}`);
    if (search) parts.push(`search:${search.toLowerCase()}`);
    return parts.join('|');
  };

  const loadArticles = async ({ category, search } = {}) => {
    const cacheKey = buildCacheKey({ category: category || 'all', search, mode: 'standard' });
    state.activeFilter = category ? category : 'all';
    state.activeSearch = search || '';

    if (cache.has(cacheKey)) {
      renderArticles(cache.get(cacheKey));
      return;
    }

    renderLoading();
    const params = new URLSearchParams({ limit: '24' });
    if (category && category !== 'all') params.set('category', category);
    if (search) params.set('search', search);

    try {
      const response = await fetch(`${API_BASE}/api/articles?${params.toString()}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) {
        throw new Error(`Failed to load articles (${response.status})`);
      }
      const data = await response.json();
      const normalized = normalizeArticles(data);
      console.debug('[News] loadArticles fetched', {
        category: category || 'all',
        search: search || '',
        count: normalized.length,
      });
      cache.set(cacheKey, normalized);
      renderArticles(normalized);
    } catch (error) {
      console.error('[News] fetch failed', error);
      renderError('Unable to load news right now. Please try again later.');
    }
  };

  const loadFavoriteArticles = async () => {
    const favorites = Array.from(state.gameFavorites);
    if (!favorites.length) {
      renderError('No favorites selected yet. Pick apps to follow and they will appear here.');
      return;
    }

    const cacheKey = buildCacheKey({ category: 'favorites', search: '', mode: `favorites:${favorites.sort().join(',')}` });
    if (cache.has(cacheKey)) {
      renderArticles(cache.get(cacheKey));
      return;
    }

    renderLoading();

    try {
      const requests = favorites.map((slug) =>
        fetch(`${API_BASE}/api/articles?limit=10&game=${encodeURIComponent(slug)}`, {
          headers: { Accept: 'application/json' },
        })
          .then((response) => (response.ok ? response.json() : []))
          .catch(() => [])
      );

      const results = await Promise.all(requests);
      const combined = normalizeArticles(results.flat());
      console.debug('[News] loadFavoriteArticles combined', { total: combined.length });
      const unique = Array.from(
        combined.reduce((acc, article) => {
          const key = `${article.source_slug}:${article.id}`;
          if (!acc.has(key)) acc.set(key, article);
          return acc;
        }, new Map()).values()
      ).slice(0, 12);

      cache.set(cacheKey, unique);
      console.debug('[News] loadFavoriteArticles unique', { total: unique.length });
      renderArticles(unique);
    } catch (error) {
      console.error('[News] favorites fetch failed', error);
      renderError('Unable to load favorites right now. Please try again later.');
    }
  };

  const getFilterFromQuery = () => {
    const params = new URLSearchParams(window.location.search);
    const filter = params.get('filter');
    if (filter && validFilters.has(filter)) {
      return filter;
    }
    return 'all';
  };

  const getSearchFromQuery = () => {
    const params = new URLSearchParams(window.location.search);
    const term = params.get('search');
    return term ? term.trim() : '';
  };

  const updateURL = (filter, search) => {
    const params = new URLSearchParams();
    if (filter && filter !== 'all') params.set('filter', filter);
    if (search) params.set('search', search);
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState(null, '', newUrl);
  };

  const applyFilter = (filter, search) => {
    state.activeFilter = filter;
    state.activeSearch = search;
    updateURL(filter, search);

    if (filter === 'favorites') {
      loadFavoriteArticles();
    } else {
      const category = filter === 'all' ? undefined : filter;
      loadArticles({ category, search });
    }
  };

  const initialiseSearchForm = () => {
    if (!searchForm || !searchInput) return;
    searchInput.value = state.activeSearch;

    searchForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const term = searchInput.value.trim();
      applyFilter(state.activeFilter, term);
    });
  };

  const extractPlatforms = (release) => {
    const { raw = {} } = release || {};
    if (Array.isArray(raw.platforms)) {
      return raw.platforms
        .map((item) => {
          if (!item) return null;
          if (typeof item === 'string') return item;
          return item.name || item.title || item.platform || null;
        })
        .filter(Boolean);
    }
    if (typeof raw.platform === 'string') {
      return raw.platform
        .split(/[|/,]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
    if (typeof release.platform === 'string') {
      return release.platform
        .split(/[|/,]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  };

  const extractLink = (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    return (
      raw.url ||
      raw.link ||
      raw.storeUrl ||
      raw.store_url ||
      (raw.cta && (raw.cta.url || raw.cta.href)) ||
      (raw.button && (raw.button.url || raw.button.href)) ||
      null
    );
  };

  const extractSummary = (raw) => {
    if (!raw || typeof raw !== 'object') return '';
    return (
      raw.description ||
      raw.summary ||
      raw.subtitle ||
      raw.shortDescription ||
      raw.note ||
      ''
    );
  };

  const resolveThumbnail = (release, raw, link) => {
    if (release.thumbnail && !isPlaceholderImage(release.thumbnail)) return release.thumbnail;
    if (raw && typeof raw === 'object') {
      const directKeys = [
        'thumbnail',
        'image',
        'poster',
        'cover',
        'boxArt',
        'box_art',
        'artwork',
        'heroImage',
        'hero_image',
        'squareImage',
        'square_image',
      ];
      for (const key of directKeys) {
        if (raw[key]) {
          const resolved = normaliseImageValue(raw[key]);
          if (resolved) return resolved;
        }
      }

      const game = raw.game || {};
      const gameKeys = [
        'imageCoverVertical',
        'imageCoverHorizontal',
        'imageCoverSquare',
        'image',
        'cover',
        'boxArt',
        'artwork',
        'poster',
        'heroImage',
      ];
      for (const key of gameKeys) {
        if (game[key]) {
          const resolved = normaliseImageValue(game[key]);
          if (resolved) return resolved;
        }
      }

      if (Array.isArray(game.screenshots)) {
        const screenshot = game.screenshots.find((shot) => normaliseImageValue(shot));
        if (screenshot) {
          const normalized = normaliseImageValue(screenshot);
          if (normalized) return normalized;
        }
      }

      const discovered = findImageInObject(game) || findImageInObject(raw);
      if (discovered) return discovered;
    }
    if (typeof link === 'string') {
      const steamMatch = link.match(/store\.steampowered\.com\/app\/(\d+)/i);
      if (steamMatch && steamMatch[1]) {
        return `https://cdn.cloudflare.steamstatic.com/steam/apps/${steamMatch[1]}/header.jpg`;
      }
    }
    const title = release.title || '';
    const fallback = FALLBACK_THUMBNAILS.find(({ pattern }) => pattern.test(title));
    if (!fallback && raw && typeof raw === 'object' && typeof raw.url === 'string') {
      const viaUrl = FALLBACK_THUMBNAILS.find(({ pattern }) => pattern.test(raw.url));
      if (viaUrl) return viaUrl.cover;
    }
    if (fallback) return fallback.cover;
    return null;
  };

  const normaliseRelease = (release) => {
    if (!release) return null;
    const raw = release.raw || {};
    const title = release.title || raw.title || 'Untitled release';
    const date = release.release_date ? new Date(release.release_date) : null;
    if (!date || Number.isNaN(date.getTime())) return null;
    const platforms = extractPlatforms(release);
    const summary = extractSummary(raw);
    const sourceLabel =
      release.source_label ||
      raw.sourceName ||
      raw.source ||
      (raw.store && raw.store.name) ||
      null;
    const link = release.detail_url || extractLink(raw);
    const thumbnail = resolveThumbnail(release, raw, link);
    const tag = release.tag || (raw.tag && raw.tag.name) || null;

    return {
      title,
      date,
      dateLabel: formatter.format(date),
      platforms,
      summary,
      sourceLabel: sourceLabel || 'GX Corner',
      link: typeof link === 'string' ? link : null,
      thumbnail,
      tag,
    };
  };

  const renderReleaseCard = (release) => {
    const card = document.createElement('article');
    card.className = 'card release-card';

    const body = document.createElement('div');
    body.className = 'release-card__body';

    const title = document.createElement('h3');
    title.className = 'release-card__title';
    title.textContent = release.title;
    body.appendChild(title);

    if (release.thumbnail) {
      card.classList.add('has-thumb');
      const media = document.createElement('div');
      media.className = 'release-card__media';
      const img = document.createElement('img');
      img.src = release.thumbnail;
      img.alt = `${release.title} cover art`;
      img.loading = 'lazy';
      media.appendChild(img);
      body.appendChild(media);
    }

    const meta = document.createElement('div');
    meta.className = 'release-card__meta';

    const dateTag = document.createElement('span');
    dateTag.className = 'release-card__date';
    dateTag.textContent = release.dateLabel;
    meta.appendChild(dateTag);

    if (release.tag) {
      const tag = document.createElement('span');
      tag.className = 'release-card__tag';
      tag.textContent = release.tag;
      meta.appendChild(tag);
    }

    if (release.platforms.length) {
      const platforms = document.createElement('div');
      platforms.className = 'release-card__platforms';
      release.platforms.slice(0, 4).forEach((platform) => {
        const pill = document.createElement('span');
        pill.textContent = platform;
        platforms.appendChild(pill);
      });
      meta.appendChild(platforms);
    }

    body.appendChild(meta);

    if (release.link) {
      const link = document.createElement('a');
      link.className = 'action-button action-button--outline release-card__cta';
      link.href = release.link;
      link.target = '_blank';
      link.rel = 'noopener';
      link.setAttribute('aria-label', `View details for ${release.title}`);
      link.textContent = '→';
      body.appendChild(link);
    }

    card.appendChild(body);
    return card;
  };

  const loadReleaseCalendar = async () => {
    if (!releaseContainer) return;
    ensureVisibility(releaseContainer, 'flex');
    releaseContainer.innerHTML = '<p class="muted">Loading release calendar…</p>';
    try {
      const response = await fetch('/release-api/api/releases', {
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) {
        throw new Error(`Release fetch failed (${response.status})`);
      }
      const data = await response.json();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const horizon = new Date(today);
      horizon.setDate(horizon.getDate() + 30);
      const releases = data
        .map(normaliseRelease)
        .filter((item) => item && item.date && item.date >= today && item.date <= horizon)
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .reduce((acc, item) => {
          const key = item.link || `${item.title}-${item.date.toISOString()}`;
          if (!acc.map.has(key)) {
            acc.map.set(key, true);
            acc.list.push(item);
          }
          return acc;
        }, { list: [], map: new Map() }).list;

      console.debug('[News] loadReleaseCalendar releases', { total: releases.length });
      if (!releases.length) {
        releaseContainer.innerHTML = '<p class="muted">No upcoming releases available yet. Check back soon.</p>';
        return;
      }

      releaseContainer.innerHTML = '';
      releases.forEach((release) => {
        releaseContainer.appendChild(renderReleaseCard(release));
      });
      lastRenderedReleases = Object.assign([...releases], { timestamp: Date.now() });
      console.debug('[News] release feed rendered', releaseContainer.children.length, 'items');
      if (!releasesObserver) {
        releasesObserver = new MutationObserver(() => {
          const childCount = releaseContainer.children.length;
          console.debug('[News] release observer fired', { childCount });
          if (!childCount && lastRenderedReleases.length) {
            console.warn('[News] release feed emptied unexpectedly; re-rendering cached releases');
            releaseContainer.innerHTML = '';
            lastRenderedReleases.forEach((item) => {
              releaseContainer.appendChild(renderReleaseCard(item));
            });
          }
        });
        releasesObserver.observe(releaseContainer, { childList: true });
      }
    } catch (error) {
      console.error('[News] release calendar load failed', error);
      releaseContainer.innerHTML = '<p class="muted">Release calendar is currently unavailable.</p>';
    }
  };

  const init = async () => {
    console.debug('[News] init start');
    
    // Load favorites but don't let errors block page load
    try {
      await Promise.all([loadGameFavorites(), loadSourceFavorites()]);
    } catch (error) {
      console.error('[News] Failed to load favorites', error);
    }
    
    const filter = getFilterFromQuery();
    const search = filter === 'favorites' ? '' : getSearchFromQuery();
    state.activeFilter = filter;
    state.activeSearch = search;
    initialiseSearchForm();
    if (searchInput) searchInput.value = search;
    
    // Load main content
    applyFilter(filter, search);
    
    // Load release calendar independently (don't await)
    loadReleaseCalendar().catch(err => {
      console.error('[News] Release calendar init failed', err);
    });
  };

  init().catch(error => {
    console.error('[News] Init failed', error);
    renderError('Unable to initialize news page. Please refresh the page.');
  });
})();
