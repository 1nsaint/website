(() => {
  const featuredContainer = document.getElementById('patchFeatured');
  const feedContainer = document.getElementById('patchFeed');

  if (!featuredContainer || !feedContainer) return;

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

  const state = {
    gameFavorites: new Set(),
    sourceFavorites: new Set(),
  };

  const hasRealImage = (article) => Boolean(article.thumbnail_url && !article.thumbnail_url.includes('google.com/s2/favicons'));

  const truncate = (text, maxLength = 200) => {
    if (!text) return '';
    return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
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

  const getSourceIcon = (article) => {
    if (!article.url) return null;
    try {
      const domain = new URL(article.url).hostname;
      if (!domain) return null;
      return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
    } catch (error) {
      console.warn('[PatchNotes] unable to parse icon URL', error);
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

  const formatInfo = (article) => [
    article.source_name,
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
        console.error('[PatchNotes] Failed to toggle favorite', error);
      }
    });

    return button;
  };

  const attachMeta = (meta, titleEl, article) => {
    const header = document.createElement('div');
    header.className = 'meta-header';

    const content = document.createElement('div');
    content.className = 'meta-header__content';
    const iconUrl = getSourceIcon(article);
    if (iconUrl) {
      content.appendChild(createIcon(iconUrl, `${article.source_name || 'Source'} icon`));
    }
    content.appendChild(titleEl);
    header.appendChild(content);

    const actions = document.createElement('div');
    actions.className = 'meta-header__actions';
    const favoriteButton = createFavoriteButton(article);
    if (favoriteButton) actions.appendChild(favoriteButton);
    header.appendChild(actions);

    meta.appendChild(header);

    const body = document.createElement('div');
    body.className = 'meta-body';
    meta.appendChild(body);
    return { body };
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
    info.textContent = formatInfo(article);
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
    cta.textContent = 'Read full patch';
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
    info.textContent = formatInfo(article);
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
    loading.textContent = 'Loading patch notes…';
    feedContainer.appendChild(loading);
  };

  const renderArticles = (articles) => {
    console.debug('[PatchNotes] renderArticles', { count: articles.length });
    featuredContainer.innerHTML = '';
    feedContainer.innerHTML = '';

    if (!articles.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'No patch notes available right now.';
      feedContainer.appendChild(empty);
      return;
    }

    const ordered = [...articles];
    if (ordered.length) {
      const [first, ...rest] = ordered;
      console.debug('[PatchNotes] renderArticles rendering hero', first.title);
      renderHero(first);
      rest.forEach((article) => {
        console.debug('[PatchNotes] renderArticles rendering card', article.title);
        feedContainer.appendChild(renderCard(article));
      });
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
      const response = await fetch(`${API_BASE}/api/games`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Games fetch failed (${response.status})`);
      const games = await response.json();
      state.gameFavorites = new Set(games.filter((game) => game.is_active).map((game) => game.slug));
    } catch (error) {
      console.error('[PatchNotes] failed to load game favorites', error);
      state.gameFavorites = new Set();
    }
  };

  const loadSourceFavorites = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/sources`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Sources fetch failed (${response.status})`);
      const sources = await response.json();
      state.sourceFavorites = new Set(sources.filter((source) => source.is_active).map((source) => source.slug));
    } catch (error) {
      console.error('[PatchNotes] failed to load source favorites', error);
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
      if (nextState) state.gameFavorites.add(slug);
      else state.gameFavorites.delete(slug);
    } else {
      if (nextState) state.sourceFavorites.add(slug);
      else state.sourceFavorites.delete(slug);
    }
  };

  const loadPatchNotes = async () => {
    renderLoading();
    try {
      const response = await fetch(`${API_BASE}/api/articles?limit=24&category=patch`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`Failed to load patch notes (${response.status})`);
      const data = await response.json();
      const normalized = normalizeArticles(data);
      console.debug('[PatchNotes] loadPatchNotes fetched', { count: normalized.length });
      renderArticles(normalized);
    } catch (error) {
      console.error('[PatchNotes] fetch failed', error);
      renderError('Unable to load patch notes right now. Please try again later.');
    }
  };

  const init = async () => {
    console.debug('[PatchNotes] init start');
    await Promise.all([loadGameFavorites(), loadSourceFavorites()]);
    loadPatchNotes();
  };

  init();
})();
