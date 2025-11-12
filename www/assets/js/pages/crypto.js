(() => {
  const metricsBase = (window.METRICS_API_BASE || (() => {
    const { protocol, hostname } = window.location;
    if (protocol === 'https:') {
      return `${protocol}//${hostname}/metrics-api`;
    }
    return `${protocol}//${hostname}:8001`;
  })()).replace(/\/$/, '');

  const MARKETS_REFRESH_MS = 120 * 1000;
  const API_URL = `${metricsBase}/api/crypto/markets`;
  const HISTORY_URL = (id, range) => `${metricsBase}/api/crypto/history/${id}?range=${range}`;
  const CACHE_KEY = 'rr_crypto_cache_v1';
  const CACHE_MAX_AGE_MS = 2 * 60 * 1000;

  const grid = document.getElementById('cryptoGrid');
  const refreshEl = document.getElementById('cryptoRefresh');
  const refreshBtn = document.getElementById('cryptoManualRefresh');

  const modal = document.getElementById('cryptoModal');
  const modalTitle = document.getElementById('cryptoModalTitle');
  const modalMeta = document.getElementById('cryptoModalMeta');
  const modalClose = document.getElementById('cryptoModalClose');
  const actionsContainer = modal?.querySelector('.crypto-modal__actions');
  const modalChartCanvas = document.getElementById('cryptoChart');

  if (!grid || !modal || !actionsContainer || !modalChartCanvas) return;

  let chartInstance = null;
  const chartCache = new Map();
  const historyInFlight = new Map();
  const rangeButtons = [];
  let marketsInFlight = false;

  const formatCurrency = (value) => `$${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  const formatPercent = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

  const loadCache = () => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      if (!payload || !payload.timestamp) return null;
      if (Date.now() - payload.timestamp > CACHE_MAX_AGE_MS) return null;
      return payload;
    } catch {
      return null;
    }
  };

  const saveCache = (coins) => {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), coins }));
    } catch {}
  };

  const setStatus = (text) => {
    if (refreshEl) refreshEl.textContent = text;
  };

  const buildCard = (coin) => {
    const card = document.createElement('div');
    card.className = 'crypto-card';
    card.dataset.coinId = coin.id;

    const img = document.createElement('img');
    img.className = 'crypto-card__icon';
    img.src = coin.image;
    img.alt = `${coin.name} logo`;
    img.loading = 'lazy';

    const meta = document.createElement('div');
    meta.className = 'crypto-card__meta';

    const title = document.createElement('h3');
    title.textContent = `${coin.name} (${coin.symbol.toUpperCase()})`;

    const price = document.createElement('div');
    price.className = 'crypto-price';
    price.textContent = formatCurrency(coin.current_price);

    const change = document.createElement('div');
    change.className = 'crypto-change';
    const pct = coin.price_change_percentage_24h || 0;
    change.textContent = `24h: ${formatPercent(pct)}`;
    change.classList.add(pct >= 0 ? 'crypto-change--up' : 'crypto-change--down');

    const metaRow = document.createElement('div');
    metaRow.className = 'crypto-meta-row';
    metaRow.innerHTML = `
      <span>Market cap: ${formatCurrency(coin.market_cap)}</span>
      <span>Volume: ${formatCurrency(coin.total_volume)}</span>
    `;

    meta.append(title, price, change, metaRow);
    card.append(img, meta);
    card.addEventListener('click', () => openModal(coin));
    return card;
  };

  const renderCoins = (coins) => {
    grid.innerHTML = '';
    if (!coins || !coins.length) {
      const empty = document.createElement('div');
      empty.className = 'crypto-error';
      empty.textContent = 'No market data available right now.';
      grid.appendChild(empty);
      return;
    }
    coins.forEach((coin) => grid.appendChild(buildCard(coin)));
  };

  const fetchCoins = async () => {
    if (marketsInFlight) return;
    marketsInFlight = true;
    try {
      setStatus('Updating…');
      const response = await fetch(API_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      renderCoins(data.coins || []);
      saveCache(data.coins || []);
      setStatus(`Last updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    } catch (error) {
      console.error('[Crypto] fetch failed', error);
      setStatus('Failed to load data');
      const cached = loadCache();
      if (cached?.coins) renderCoins(cached.coins);
      else renderCoins([]);
    } finally {
      marketsInFlight = false;
    }
  };

  const cached = loadCache();
  if (cached?.coins) {
    renderCoins(cached.coins);
    setStatus(`Cached at ${new Date(cached.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
  } else {
    renderCoins([]);
    setStatus('Loading…');
  }

  fetchCoins();
  let intervalHandle = setInterval(fetchCoins, MARKETS_REFRESH_MS);

  refreshBtn?.addEventListener('click', () => {
    fetchCoins();
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = setInterval(fetchCoins, MARKETS_REFRESH_MS);
    }
  });

  const rangeLabels = {
    '1': '24h',
    '7': '7d',
    '30': '30d',
    '365': '1y',
  };

  const ranges = [
    { key: '1', label: rangeLabels['1'] },
    { key: '7', label: rangeLabels['7'] },
    { key: '30', label: rangeLabels['30'] },
    { key: '365', label: rangeLabels['365'] },
  ];

  actionsContainer.innerHTML = '';
  ranges.forEach(({ key, label }, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.range = key;
    button.textContent = label;
    if (index === 0) button.classList.add('is-active');
    button.addEventListener('click', () => selectRange(key));
    actionsContainer.appendChild(button);
    rangeButtons.push(button);
  });

  const openModal = (coin) => {
    modal.setAttribute('aria-hidden', 'false');
    modalTitle.textContent = `${coin.name} (${coin.symbol.toUpperCase()})`;
    modalMeta.innerHTML = `
      <span>Price: ${formatCurrency(coin.current_price)}</span>
      <span>Market cap: ${formatCurrency(coin.market_cap)}</span>
      <span>Volume: ${formatCurrency(coin.total_volume)}</span>
    `;
    modal.dataset.coinId = coin.id;
    selectRange('1', false);
    loadChart(coin.id, '1');
  };

  const closeModal = () => {
    modal.setAttribute('aria-hidden', 'true');
  };

  modalClose?.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  const selectRange = (rangeKey, load = true) => {
    rangeButtons.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.range === rangeKey));
    if (load && modal.dataset.coinId) {
      loadChart(modal.dataset.coinId, rangeKey);
    }
  };

  const loadChart = async (coinId, rangeKey) => {
    const cacheKey = `${coinId}-${rangeKey}`;
    if (chartCache.has(cacheKey)) {
      renderChart(chartCache.get(cacheKey), rangeKey);
      return;
    }

    if (historyInFlight.has(cacheKey)) {
      try {
        const cachedPromise = historyInFlight.get(cacheKey);
        const cachedData = await cachedPromise;
        renderChart(cachedData, rangeKey);
      } catch (error) {
        console.error('[Crypto] chart fetch failed (in-flight)', error);
        const fallback = chartCache.get(cacheKey);
        renderChart(fallback || [], rangeKey, true);
      }
      return;
    }

    const fetchPromise = (async () => {
      const response = await fetch(HISTORY_URL(coinId, rangeKey), { cache: 'no-store' });
      if (!response.ok) throw new Error(`history error ${response.status}`);
      const data = await response.json();
      const processed = (data.prices || []).map(([ts, price]) => ({ x: ts, y: price }));
      if (!processed.length) throw new Error('No datapoints');
      chartCache.set(cacheKey, processed);
      return processed;
    })();

    historyInFlight.set(cacheKey, fetchPromise);

    try {
      const processed = await fetchPromise;
      renderChart(processed, rangeKey);
    } catch (error) {
      console.error('[Crypto] chart fetch failed', error);
      const fallback = chartCache.get(cacheKey);
      renderChart(fallback || [], rangeKey, true);
    } finally {
      historyInFlight.delete(cacheKey);
    }
  };

  const renderChart = (dataPoints, rangeKey, error = false) => {
    const ctx = modalChartCanvas.getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const unitMap = {
      '1': 'hour',
      '7': 'day',
      '30': 'day',
      '365': 'month',
    };
    const labelText = `${rangeLabels[rangeKey] || rangeKey} price`;

    if (!dataPoints.length) {
      chartInstance = new Chart(ctx, {
        type: 'line',
        data: { datasets: [] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { display: false },
            y: { display: false },
          },
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
          },
        },
      });
      return;
    }

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: labelText,
            data: dataPoints,
            parsing: false,
            borderColor: '#ff7a3d',
            backgroundColor: 'rgba(255, 122, 61, 0.15)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.2,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: {
            type: 'time',
            time: { unit: unitMap[rangeKey] || 'day' },
            ticks: {
              color: 'rgba(255,255,255,0.6)',
              maxTicksLimit: rangeKey === '1' ? 8 : 10,
            },
            grid: { color: 'rgba(255,255,255,0.06)' },
          },
          y: {
            ticks: {
              color: 'rgba(255,255,255,0.6)',
              callback: (value) => `$${Number(value).toLocaleString()}`,
            },
            grid: { color: 'rgba(255,255,255,0.06)' },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => formatCurrency(context.parsed.y),
            },
          },
        },
      },
    });
  };
})();
