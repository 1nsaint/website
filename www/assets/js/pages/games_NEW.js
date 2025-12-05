(() => {
  console.log('[Games] Script starting with genre filtering and pagination');
  const gamesGrid = document.getElementById('gamesGrid');
  const gamesTitle = document.getElementById('gamesTitle');
  const gamesSubtitle = document.getElementById('gamesSubtitle');
  const searchForm = document.getElementById('gamesSearch');
  const searchInput = document.getElementById('gamesSearchInput');

  if (!gamesGrid) {
    console.error('[Games] CRITICAL: gamesGrid not found!');
    return;
  }

  // Get API base URL
  const defaultBase = (() => {
    if (window.CONTENT_API_BASE) return window.CONTENT_API_BASE;
    const { origin, hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://${hostname}:8083`;
    }
    return `${origin}/content-api`;
  })();

  const API_BASE = (defaultBase || '').replace(/\/$/, '');

  // Check URL params
  const urlParams = new URLSearchParams(window.location.search);
  const initialSearch = urlParams.get('search') || '';
  const gameSlug = urlParams.get('game') || '';
  const platform = urlParams.get('platform') || '';
  const genre = urlParams.get('genre') || '';

  // Pagination state
  let currentOffset = 0;
  const GAMES_PER_PAGE = 100;
  let currentPlatform = null;
  let currentGenre = null;
  let hasMoreGames = false;

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return null;
    }
  };

  // Platform categories
  const PLATFORM_FAMILIES = {
    nintendo: {
      name: 'Nintendo',
      logo: '/assets/images/platforms/nintendo.png',
      homeConsoles: [
        { id: 'nes', name: 'NES', logo: '/assets/images/platforms/nes.png' },
        { id: 'snes', name: 'SNES', logo: '/assets/images/platforms/snes.png' },
        { id: 'nintendo-64', name: 'Nintendo 64', logo: '/assets/images/platforms/n64.png' },
        { id: 'gamecube', name: 'GameCube', logo: '/assets/images/platforms/gamecube.png' },
        { id: 'nintendo-wii', name: 'Wii', logo: '/assets/images/platforms/wii.png' },
        { id: 'nintendo-wii-u', name: 'Wii U', logo: '/assets/images/platforms/wiiu.png' },
        { id: 'nintendo-switch', name: 'Switch', logo: '/assets/images/platforms/switch.png' },
      ],
      handhelds: [
        { id: 'game-boy', name: 'Game Boy', logo: '/assets/images/platforms/gameboy.png' },
        { id: 'game-boy-color', name: 'Game Boy Color', logo: '/assets/images/platforms/gbc.png' },
        { id: 'game-boy-advance', name: 'Game Boy Advance', logo: '/assets/images/platforms/gba.png' },
        { id: 'nintendo-ds', name: 'Nintendo DS', logo: '/assets/images/platforms/nds.png' },
        { id: 'nintendo-3ds', name: '3DS', logo: '/assets/images/platforms/3ds.png' },
      ]
    },
    pc: {
      name: 'PC',
      logo: '/assets/images/platforms/pc.png',
      platforms: [
        { id: 'pc-windows', name: 'PC (Windows)', logo: '/assets/images/platforms/windows.png' },
        { id: 'steam', name: 'Steam', logo: '/assets/images/platforms/steam.png' },
      ]
    },
    playstation: {
      name: 'PlayStation',
      logo: '/assets/images/platforms/playstation.png',
      platforms: [
        { id: 'ps1', name: 'PlayStation', logo: '/assets/images/platforms/ps1.png' },
        { id: 'ps2', name: 'PlayStation 2', logo: '/assets/images/platforms/ps2.png' },
        { id: 'psp', name: 'PSP', logo: '/assets/images/platforms/psp.png' },
        { id: 'ps3', name: 'PlayStation 3', logo: '/assets/images/platforms/ps3.png' },
        { id: 'ps-vita', name: 'PS Vita', logo: '/assets/images/platforms/psvita.png' },
        { id: 'ps4', name: 'PlayStation 4', logo: '/assets/images/platforms/ps4.png' },
        { id: 'ps5', name: 'PlayStation 5', logo: '/assets/images/platforms/ps5.png' },
      ]
    },
    xbox: {
      name: 'Xbox',
      logo: '/assets/images/platforms/xbox.png',
      platforms: [
        { id: 'xbox', name: 'Xbox', logo: '/assets/images/platforms/xbox-original.png' },
        { id: 'xbox-360', name: 'Xbox 360', logo: '/assets/images/platforms/xbox360.png' },
        { id: 'xbox-one', name: 'Xbox One', logo: '/assets/images/platforms/xboxone.png' },
        { id: 'xbox-series', name: 'Xbox Series X|S', logo: '/assets/images/platforms/xboxseries.png' },
      ]
    }
  };

  // Fetch genres for platform
  const fetchGenres = async (platformId) => {
    try {
      const url = `${API_BASE}/api/games/genres?platform=${platformId}`;
      console.log('[Games] Fetching genres from:', url);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const genres = await response.json();
      console.log(`[Games] Fetched ${genres.length} genres`);
      return genres;
    } catch (error) {
      console.error('[Games] Error fetching genres:', error);
      return [];
    }
  };

  // Render genres as accordion
  const renderGenres = async (platformId, platformName) => {
    gamesTitle.textContent = platformName;
    gamesSubtitle.textContent = 'Select a genre to browse games';
    
    gamesGrid.innerHTML = '<div class="games-loading">Loading genres...</div>';
    
    const genres = await fetchGenres(platformId);
    
    if (!genres || genres.length === 0) {
      gamesGrid.innerHTML = `
        <div class="games-empty">
          <h3>No genres available</h3>
          <p>Try loading games for this platform first</p>
        </div>
      `;
      return;
    }

    gamesGrid.innerHTML = `
      <div class="genre-list">
        ${genres.map(genre => `
          <div class="genre-item">
            <button class="genre-button" data-genre="${genre}" data-platform="${platformId}">
              <span class="genre-name">${genre}</span>
              <span class="genre-icon">▼</span>
            </button>
            <div class="genre-games" id="genre-${slugify(genre)}" style="display: none;"></div>
          </div>
        `).join('')}
      </div>
    `;

    // Add click handlers for genres
    document.querySelectorAll('.genre-button').forEach(button => {
      button.addEventListener('click', async () => {
        const genreName = button.dataset.genre;
        const platformId = button.dataset.platform;
        const gamesContainer = document.getElementById(`genre-${slugify(genreName)}`);
        
        // Toggle visibility
        if (gamesContainer.style.display === 'none') {
          // Close other genres
          document.querySelectorAll('.genre-games').forEach(g => g.style.display = 'none');
          document.querySelectorAll('.genre-button').forEach(b => b.classList.remove('is-active'));
          
          // Open this genre
          gamesContainer.style.display = 'block';
          button.classList.add('is-active');
          
          // Reset pagination
          currentOffset = 0;
          currentPlatform = platformId;
          currentGenre = genreName;
          
          // Load games
          await loadGenreGames(platformId, genreName, gamesContainer);
        } else {
          // Close this genre
          gamesContainer.style.display = 'none';
          button.classList.remove('is-active');
        }
      });
    });
  };

  // Load games for a genre
  const loadGenreGames = async (platformId, genreName, container, append = false) => {
    try {
      if (!append) {
        container.innerHTML = '<div class="games-loading">Loading games...</div>';
      }
      
      const url = `${API_BASE}/api/games?platform=${platformId}&genre=${encodeURIComponent(genreName)}&limit=${GAMES_PER_PAGE}&offset=${currentOffset}`;
      console.log('[Games] Fetching:', url);
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const games = await response.json();
      console.log(`[Games] Fetched ${games.length} games`);
      
      hasMoreGames = games.length === GAMES_PER_PAGE;
      
      // Render games
      const gamesHTML = games.map(game => {
        const coverUrl = game.cover_url || '/assets/images/placeholder-game.png';
        const releaseDate = formatDate(game.release_date);
        
        return `
          <a href="?game=${encodeURIComponent(game.slug)}" class="game-card" data-slug="${game.slug}">
            <div class="game-card__cover">
              <img src="${coverUrl}" alt="${game.title}" loading="lazy" onerror="this.src='/assets/images/placeholder-game.png'">
            </div>
            <div>
              <h3 class="game-card__title">${game.title}</h3>
              ${releaseDate ? `<div class="game-card__meta"><span class="game-card__release-date">${releaseDate}</span></div>` : ''}
            </div>
          </a>
        `;
      }).join('');
      
      if (append) {
        // Remove loading indicator and append new games
        const loadMoreBtn = container.querySelector('.load-more-button');
        if (loadMoreBtn) loadMoreBtn.remove();
        
        const gamesGridDiv = container.querySelector('.games-grid');
        if (gamesGridDiv) {
          gamesGridDiv.innerHTML += gamesHTML;
        }
      } else {
        container.innerHTML = `
          <div class="games-grid">
            ${gamesHTML}
          </div>
        `;
      }
      
      // Add load more button if there are more games
      if (hasMoreGames) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.className = 'load-more-button';
        loadMoreBtn.textContent = 'Load More Games';
        loadMoreBtn.addEventListener('click', async () => {
          currentOffset += GAMES_PER_PAGE;
          loadMoreBtn.textContent = 'Loading...';
          loadMoreBtn.disabled = true;
          await loadGenreGames(platformId, genreName, container, true);
        });
        container.appendChild(loadMoreBtn);
      }
      
    } catch (error) {
      console.error('[Games] Error loading games:', error);
      container.innerHTML = `<div class="games-empty"><p>Error loading games: ${error.message}</p></div>`;
    }
  };

  // Helper: slugify
  const slugify = (text) => {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  // Render platform categories
  const renderPlatforms = () => {
    gamesTitle.textContent = 'Browse by Platform';
    gamesSubtitle.textContent = 'Select a platform family and console';
    gamesGrid.innerHTML = `
      <div class="platform-families">
        ${Object.entries(PLATFORM_FAMILIES).map(([familyId, family]) => {
          if (familyId === 'nintendo' && family.homeConsoles && family.handhelds) {
            return `
              <div class="platform-family-card">
                <div class="platform-family-card__header">
                  <img src="${family.logo}" alt="${family.name}" class="platform-family-card__logo" onerror="this.style.display='none'">
                  <h3 class="platform-family-card__title">${family.name}</h3>
                </div>
                <div class="platform-family-card__platforms platform-family-card__platforms--two-columns">
                  <div class="platform-column">
                    ${family.homeConsoles.map(platform => `
                      <button class="platform-button platform-button--logo-only" data-platform="${platform.id}" data-family="${familyId}" title="${platform.name}">
                        <img src="${platform.logo}" alt="${platform.name}" class="platform-button__logo" onerror="this.style.display='none'">
                      </button>
                    `).join('')}
                  </div>
                  <div class="platform-column">
                    ${family.handhelds.map(platform => `
                      <button class="platform-button platform-button--logo-only" data-platform="${platform.id}" data-family="${familyId}" title="${platform.name}">
                        <img src="${platform.logo}" alt="${platform.name}" class="platform-button__logo" onerror="this.style.display='none'">
                      </button>
                    `).join('')}
                  </div>
                </div>
              </div>
            `;
          }
          
          const platforms = family.platforms || [];
          const midPoint = Math.ceil(platforms.length / 2);
          const leftColumn = platforms.slice(0, midPoint);
          const rightColumn = platforms.slice(midPoint);
          
          return `
            <div class="platform-family-card">
              <div class="platform-family-card__header">
                <img src="${family.logo}" alt="${family.name}" class="platform-family-card__logo" onerror="this.style.display='none'">
                <h3 class="platform-family-card__title">${family.name}</h3>
              </div>
              <div class="platform-family-card__platforms platform-family-card__platforms--two-columns">
                <div class="platform-column">
                  ${leftColumn.map(platform => `
                    <button class="platform-button platform-button--logo-only" data-platform="${platform.id}" data-family="${familyId}" title="${platform.name}">
                      <img src="${platform.logo}" alt="${platform.name}" class="platform-button__logo" onerror="this.style.display='none'">
                    </button>
                  `).join('')}
                </div>
                <div class="platform-column">
                  ${rightColumn.map(platform => `
                    <button class="platform-button platform-button--logo-only" data-platform="${platform.id}" data-family="${familyId}" title="${platform.name}">
                      <img src="${platform.logo}" alt="${platform.name}" class="platform-button__logo" onerror="this.style.display='none'">
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Add click handlers
    document.querySelectorAll('.platform-button').forEach(button => {
      button.addEventListener('click', () => {
        const platformId = button.dataset.platform;
        const platformName = button.title;
        const url = new URL(window.location);
        url.searchParams.set('platform', platformId);
        url.searchParams.delete('game');
        url.searchParams.delete('search');
        url.searchParams.delete('genre');
        window.history.pushState({}, '', url);
        
        renderGenres(platformId, platformName);
      });
    });
  };

  // Render game detail (unchanged from original)
  const renderGameDetail = async (game) => {
    gamesTitle.textContent = '';
    gamesSubtitle.textContent = '';
    const titleSection = gamesTitle.closest('section');
    if (titleSection) titleSection.style.display = 'none';

    let articlesHtml = '<div class="articles-empty">No news articles found for this game.</div>';
    try {
      const articlesUrl = `${API_BASE}/api/articles?game=${encodeURIComponent(game.slug)}&limit=3`;
      const articlesResponse = await fetch(articlesUrl);
      if (articlesResponse.ok) {
        const articles = await articlesResponse.json();
        if (articles && articles.length > 0) {
          articlesHtml = `
            <div class="game-articles">
              ${articles.map(article => `
                <article class="article-card">
                  <div class="article-card__thumb">
                    ${article.thumbnail_url ? `<img src="${article.thumbnail_url}" alt="${article.title}" loading="lazy">` : ''}
                  </div>
                  <div class="article-card__content">
                    <h3 class="article-card__title">${article.title}</h3>
                    ${article.summary ? `<p class="article-card__summary">${article.summary.substring(0, 150)}...</p>` : ''}
                    <a href="${article.url}" target="_blank" class="article-card__link">Read more →</a>
                  </div>
                </article>
              `).join('')}
            </div>
          `;
        }
      }
    } catch (error) {
      console.error('[Games] Error fetching articles:', error);
    }

    const coverUrl = game.cover_url || '/assets/images/placeholder-game.png';
    const releaseDate = formatDate(game.release_date);
    const platforms = game.platforms && game.platforms.length > 0 
      ? game.platforms 
      : (game.platform ? [game.platform] : ['Multiple Platforms']);

    gamesGrid.innerHTML = `
      <div class="game-detail">
        <div class="game-detail__card">
          <h1 class="game-detail__title">${game.title}</h1>
          <div class="game-detail__cover">
            <img src="${coverUrl}" alt="${game.title}" onerror="this.src='/assets/images/placeholder-game.png'">
          </div>
          ${releaseDate ? `<div class="game-detail__release">Release Date: ${releaseDate}</div>` : ''}
          ${game.description ? `
            <div class="game-detail__description-card">
              <div class="game-detail__description">${game.description}</div>
            </div>
          ` : ''}
          <div class="game-detail__platforms">
            ${platforms.map(p => `<span class="platform-badge">${p}</span>`).join('')}
          </div>
          ${game.genres && game.genres.length > 0 ? `
            <div class="game-detail__genres">
              <strong>Genres:</strong> ${game.genres.join(', ')}
            </div>
          ` : ''}
        </div>
        <div class="game-detail__articles">
          <h2 class="section-title">Latest News</h2>
          ${articlesHtml}
        </div>
      </div>
    `;
  };

  // Fetch single game
  const fetchGame = async (slug) => {
    try {
      gamesGrid.innerHTML = '<div class="games-loading">Loading game...</div>';
      
      const url = `${API_BASE}/api/games/${encodeURIComponent(slug)}`;
      console.log('[Games] Fetching game from:', url);

      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const game = await response.json();
      console.log('[Games] Fetched game:', game.title);
      
      await renderGameDetail(game);
    } catch (error) {
      console.error('[Games] Error fetching game:', error);
      gamesGrid.innerHTML = `
        <div class="games-empty">
          <h3>Error loading game</h3>
          <p>${error.message}</p>
        </div>
      `;
    }
  };

  // Handle search form
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const searchTerm = searchInput.value.trim();
      
      if (!searchTerm) {
        const url = new URL(window.location);
        url.searchParams.delete('search');
        url.searchParams.delete('game');
        url.searchParams.delete('platform');
        url.searchParams.delete('genre');
        window.history.pushState({}, '', url);
        renderPlatforms();
        return;
      }
      
      const url = new URL(window.location);
      url.searchParams.set('search', searchTerm);
      url.searchParams.delete('game');
      url.searchParams.delete('platform');
      url.searchParams.delete('genre');
      window.history.pushState({}, '', url);
      
      // Search still loads all results (for now)
      fetchGamesSearch(searchTerm);
    });
  }

  // Search games (simple, no pagination)
  const fetchGamesSearch = async (searchTerm) => {
    try {
      gamesGrid.innerHTML = '<div class="games-loading">Searching...</div>';
      const url = `${API_BASE}/api/games?search=${encodeURIComponent(searchTerm)}&limit=500`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const games = await response.json();
      
      gamesTitle.textContent = `Search Results: "${searchTerm}"`;
      gamesSubtitle.textContent = `Found ${games.length} game${games.length !== 1 ? 's' : ''}`;
      
      if (games.length === 0) {
        gamesGrid.innerHTML = '<div class="games-empty"><h3>No games found</h3></div>';
        return;
      }
      
      gamesGrid.className = 'games-list';
      gamesGrid.innerHTML = games.map(game => {
        const coverUrl = game.cover_url || '/assets/images/placeholder-game.png';
        const releaseDate = formatDate(game.release_date);
        
        return `
          <a href="?game=${encodeURIComponent(game.slug)}" class="game-search-result">
            <div class="game-search-result__cover">
              <img src="${coverUrl}" alt="${game.title}" loading="lazy" onerror="this.src='/assets/images/placeholder-game.png'">
            </div>
            <div class="game-search-result__info">
              <h3 class="game-search-result__title">${game.title}</h3>
              ${game.description ? `<p class="game-search-result__description">${game.description.substring(0, 200)}${game.description.length > 200 ? '...' : ''}</p>` : ''}
              ${releaseDate ? `<div class="game-search-result__meta"><span>Released: ${releaseDate}</span></div>` : ''}
            </div>
          </a>
        `;
      }).join('');
    } catch (error) {
      console.error('[Games] Error searching:', error);
      gamesGrid.innerHTML = `<div class="games-empty"><p>Error: ${error.message}</p></div>`;
    }
  };

  // Initial load
  if (gameSlug) {
    if (searchInput) searchInput.value = '';
    fetchGame(gameSlug);
  } else if (initialSearch) {
    searchInput.value = initialSearch;
    fetchGamesSearch(initialSearch);
  } else if (platform) {
    // Find platform name
    let platformName = platform;
    Object.values(PLATFORM_FAMILIES).forEach(family => {
      const allPlatforms = [...(family.homeConsoles || []), ...(family.handhelds || []), ...(family.platforms || [])];
      const found = allPlatforms.find(p => p.id === platform);
      if (found) platformName = found.name;
    });
    renderGenres(platform, platformName);
  } else {
    renderPlatforms();
  }

  // Handle browser back/forward
  window.addEventListener('popstate', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const searchTerm = urlParams.get('search') || '';
    const gameSlug = urlParams.get('game') || '';
    const platform = urlParams.get('platform') || '';
    
    if (searchInput) searchInput.value = searchTerm;
    
    if (gameSlug) {
      fetchGame(gameSlug);
    } else if (searchTerm) {
      fetchGamesSearch(searchTerm);
    } else if (platform) {
      let platformName = platform;
      Object.values(PLATFORM_FAMILIES).forEach(family => {
        const allPlatforms = [...(family.homeConsoles || []), ...(family.handhelds || []), ...(family.platforms || [])];
        const found = allPlatforms.find(p => p.id === platform);
        if (found) platformName = found.name;
      });
      renderGenres(platform, platformName);
    } else {
      renderPlatforms();
    }
  });
})();

