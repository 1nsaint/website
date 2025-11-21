(() => {
  console.log('[Games] Script starting');
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

  // Platform categories organized by manufacturer
  const PLATFORM_FAMILIES = {
    nintendo: {
      name: 'Nintendo',
      logo: '/assets/images/platforms/nintendo.png',
      homeConsoles: [
        { id: 'nes', name: 'NES', logo: '/assets/images/platforms/nes.png', year: 1983 },
        { id: 'snes', name: 'SNES', logo: '/assets/images/platforms/snes.png', year: 1990 },
        { id: 'nintendo-64', name: 'Nintendo 64', logo: '/assets/images/platforms/n64.png', year: 1996 },
        { id: 'gamecube', name: 'GameCube', logo: '/assets/images/platforms/gamecube.png', year: 2001 },
        { id: 'nintendo-wii', name: 'Wii', logo: '/assets/images/platforms/wii.png', year: 2006 },
        { id: 'nintendo-wii-u', name: 'Wii U', logo: '/assets/images/platforms/wiiu.png', year: 2012 },
        { id: 'nintendo-switch', name: 'Switch', logo: '/assets/images/platforms/switch.png', year: 2017 },
      ],
      handhelds: [
        { id: 'game-boy', name: 'Game Boy', logo: '/assets/images/platforms/gameboy.png', year: 1989 },
        { id: 'game-boy-color', name: 'Game Boy Color', logo: '/assets/images/platforms/gbc.png', year: 1998 },
        { id: 'game-boy-advance', name: 'Game Boy Advance', logo: '/assets/images/platforms/gba.png', year: 2001 },
        { id: 'nintendo-ds', name: 'Nintendo DS', logo: '/assets/images/platforms/nds.png', year: 2004 },
        { id: 'nintendo-3ds', name: '3DS', logo: '/assets/images/platforms/3ds.png', year: 2011 },
      ]
    },
    pc: {
      name: 'PC',
      logo: '/assets/images/platforms/pc.png',
      platforms: [
        { id: 'pc-windows', name: 'PC (Windows)', logo: '/assets/images/platforms/windows.png', year: 1985 },
        { id: 'steam', name: 'Steam', logo: '/assets/images/platforms/steam.png', year: 2003 },
      ]
    },
    playstation: {
      name: 'PlayStation',
      logo: '/assets/images/platforms/playstation.png',
      platforms: [
        { id: 'ps1', name: 'PlayStation', logo: '/assets/images/platforms/ps1.png', year: 1994 },
        { id: 'ps2', name: 'PlayStation 2', logo: '/assets/images/platforms/ps2.png', year: 2000 },
        { id: 'psp', name: 'PSP', logo: '/assets/images/platforms/psp.png', year: 2004 },
        { id: 'ps3', name: 'PlayStation 3', logo: '/assets/images/platforms/ps3.png', year: 2006 },
        { id: 'ps-vita', name: 'PS Vita', logo: '/assets/images/platforms/psvita.png', year: 2011 },
        { id: 'ps4', name: 'PlayStation 4', logo: '/assets/images/platforms/ps4.png', year: 2013 },
        { id: 'ps5', name: 'PlayStation 5', logo: '/assets/images/platforms/ps5.png', year: 2020 },
      ]
    },
    xbox: {
      name: 'Xbox',
      logo: '/assets/images/platforms/xbox.png',
      platforms: [
        { id: 'xbox', name: 'Xbox', logo: '/assets/images/platforms/xbox-original.png', year: 2001 },
        { id: 'xbox-360', name: 'Xbox 360', logo: '/assets/images/platforms/xbox360.png', year: 2005 },
        { id: 'xbox-one', name: 'Xbox One', logo: '/assets/images/platforms/xboxone.png', year: 2013 },
        { id: 'xbox-series', name: 'Xbox Series X|S', logo: '/assets/images/platforms/xboxseries.png', year: 2020 },
      ]
    }
  };

  // Create flat list of all platforms for easy lookup
  const PLATFORMS = [];
  Object.values(PLATFORM_FAMILIES).forEach(family => {
    if (family.homeConsoles) {
      PLATFORMS.push(...family.homeConsoles);
    }
    if (family.handhelds) {
      PLATFORMS.push(...family.handhelds);
    }
    if (family.platforms) {
      PLATFORMS.push(...family.platforms);
    }
  });

  // Render platform categories
  const renderPlatforms = () => {
    gamesTitle.textContent = 'Browse by Platform';
    gamesSubtitle.textContent = 'Select a platform family and console';
    gamesGrid.innerHTML = `
      <div class="platform-families">
        ${Object.entries(PLATFORM_FAMILIES).map(([familyId, family]) => {
          // Special handling for Nintendo (two columns)
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
          
          // Regular two-column layout for other families
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
        const url = new URL(window.location);
        url.searchParams.set('platform', platformId);
        url.searchParams.delete('game');
        url.searchParams.delete('search');
        window.history.pushState({}, '', url);
        
        // Update active state
        document.querySelectorAll('.platform-button').forEach(b => b.classList.remove('is-active'));
        button.classList.add('is-active');
        
        fetchGames('', false, null, platformId);
      });
    });
  };

  // Render games - grid for browsing, list for search
  const renderGames = (games, isSearch = false) => {
    if (!games || games.length === 0) {
      gamesGrid.innerHTML = `
        <div class="games-empty">
          <h3>No games found</h3>
          <p>${isSearch ? 'Try a different search term' : 'Check back later for more games'}</p>
        </div>
      `;
      return;
    }

    // For search results, show as individual clickable items (not grid)
    if (isSearch) {
      gamesGrid.className = 'games-list';
      gamesGrid.innerHTML = games.map(game => {
        const coverUrl = game.cover_url || '/assets/images/placeholder-game.png';
        const releaseDate = formatDate(game.release_date);
        
        return `
          <a href="?game=${encodeURIComponent(game.slug)}" class="game-search-result" data-slug="${game.slug}">
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
    } else {
      // For browsing (platform selection), show as grid
      gamesGrid.className = 'games-grid';
      gamesGrid.innerHTML = games.map(game => {
        const coverUrl = game.cover_url || '/assets/images/placeholder-game.png';
        const releaseDate = formatDate(game.release_date);
        
        return `
          <a href="?game=${encodeURIComponent(game.slug)}" class="game-card" data-slug="${game.slug}">
            <div class="game-card__cover">
              <img src="${coverUrl}" alt="${game.title}" loading="lazy" onerror="this.src='/assets/images/placeholder-game.png'">
            </div>
            <div>
              <h3 class="game-card__title">${game.title}</h3>
              ${releaseDate ? `<div class="game-card__meta"><span class="game-card__release-date">Released: ${releaseDate}</span></div>` : ''}
            </div>
          </a>
        `;
      }).join('');
    }
  };

  // Render game detail
  const renderGameDetail = async (game) => {
    gamesTitle.textContent = '';
    gamesSubtitle.textContent = '';
    // Hide the title section
    const titleSection = gamesTitle.closest('section');
    if (titleSection) {
      titleSection.style.display = 'none';
    }

    // Fetch articles for this game
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
    // Use platforms array from API, fallback to legacy platform or default
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
        </div>
        <div class="game-detail__articles">
          <h2 class="section-title">Latest News</h2>
          ${articlesHtml}
        </div>
      </div>
    `;
  };

  // Fetch games
  const fetchGames = async (searchTerm = '', random = false, limit = null, platformId = null) => {
    try {
      gamesGrid.innerHTML = '<div class="games-loading">Loading games...</div>';
      
      const params = new URLSearchParams();
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      if (random) {
        params.append('random', 'true');
      }
      if (limit) {
        params.append('limit', limit.toString());
      }
      if (platformId) {
        params.append('platform', platformId);
      }

      const url = `${API_BASE}/api/games${params.toString() ? '?' + params.toString() : ''}`;
      console.log('[Games] Fetching from:', url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const games = await response.json();
      console.log(`[Games] Fetched ${games.length} games`);

      // Update title and subtitle
      if (searchTerm) {
        gamesTitle.textContent = `Search Results: "${searchTerm}"`;
        gamesSubtitle.textContent = `Found ${games.length} game${games.length !== 1 ? 's' : ''}`;
      } else if (platformId) {
        const platform = PLATFORMS.find(p => p.id === platformId);
        gamesTitle.textContent = platform ? platform.name : 'Platform Games';
        gamesSubtitle.textContent = `${games.length} game${games.length !== 1 ? 's' : ''}`;
        
        // Update active platform card
        document.querySelectorAll('.platform-card').forEach(card => {
          if (card.dataset.platform === platformId) {
            card.classList.add('is-active');
          } else {
            card.classList.remove('is-active');
          }
        });
      } else {
        gamesTitle.textContent = 'All Games';
        gamesSubtitle.textContent = `Browse ${games.length} game${games.length !== 1 ? 's' : ''} in our collection`;
      }

      renderGames(games, !!searchTerm);
    } catch (error) {
      console.error('[Games] Error fetching games:', error);
      gamesGrid.innerHTML = `
        <div class="games-empty">
          <h3>Error loading games</h3>
          <p>${error.message}</p>
        </div>
      `;
    }
  };

  // Fetch single game
  const fetchGame = async (slug) => {
    try {
      gamesGrid.innerHTML = '<div class="games-loading">Loading game...</div>';
      
      const url = `${API_BASE}/api/games/${encodeURIComponent(slug)}`;
      console.log('[Games] Fetching game from:', url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

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
        // If empty, show platforms
        const url = new URL(window.location);
        url.searchParams.delete('search');
        url.searchParams.delete('game');
        url.searchParams.delete('platform');
        window.history.pushState({}, '', url);
        renderPlatforms();
        return;
      }
      
      // Update URL without reload
      const url = new URL(window.location);
      url.searchParams.set('search', searchTerm);
      url.searchParams.delete('game');
      url.searchParams.delete('platform');
      window.history.pushState({}, '', url);
      
      fetchGames(searchTerm, false, null, null);
    });
  }

  // Initial load
  if (gameSlug) {
    // Show game detail
    if (searchInput) searchInput.value = '';
    fetchGame(gameSlug);
  } else if (initialSearch) {
    // Show search results
    searchInput.value = initialSearch;
    fetchGames(initialSearch, false, null, null);
  } else if (platform) {
    // Show platform games
    renderPlatforms(); // Show platform cards first
    setTimeout(() => fetchGames('', false, null, platform), 100); // Then fetch games
  } else {
    // Show platform categories
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
      fetchGames(searchTerm, false, null, null);
    } else if (platform) {
      renderPlatforms(); // Show platform cards first
      setTimeout(() => fetchGames('', false, null, platform), 100); // Then fetch games
    } else {
      renderPlatforms();
    }
  });
})();
