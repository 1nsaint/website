(() => {
  const metricsBase = (window.METRICS_API_BASE || (() => {
    const { protocol, hostname } = window.location;
    if (protocol === 'https:') {
      return `${protocol}//${hostname}/metrics-api`;
    }
    return `${protocol}//${hostname}:8001`;
  })()).replace(/\/$/, '');

  const SYSTEM_URL = `${metricsBase}/api/system/overview`;
  const CONTAINERS_URL = `${metricsBase}/api/containers`;
  const CACHE_KEY = 'rr_performance_cache_v1';
  const CACHE_MAX_AGE_MS = 60 * 1000;

  const cpuChartCtx = document.getElementById('cpuChart');
  const memoryChartCtx = document.getElementById('memoryChart');

  if (!cpuChartCtx || !memoryChartCtx) {
    return;
  }

  const MAX_POINTS = 60;
  const cpuData = [];
  const memoryData = [];
  const labels = [];

  let latestSystem = null;
  let latestContainers = null;
  let systemInterval = null;
  let containersInterval = null;

  const loadCache = () => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      if (!payload || !payload.timestamp) return null;
      if (Date.now() - payload.timestamp > CACHE_MAX_AGE_MS) return null;
      return payload;
    } catch (error) {
      console.warn('[Performance] Failed to parse cache', error);
      return null;
    }
  };

  const saveCache = () => {
    try {
      const payload = {
        timestamp: Date.now(),
        labels: labels.slice(-MAX_POINTS),
        cpuData: cpuData.slice(-MAX_POINTS),
        memoryData: memoryData.slice(-MAX_POINTS),
        system: latestSystem,
        containers: latestContainers,
      };
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('[Performance] Failed to save cache', error);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = Number(bytes);
    let i = 0;
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024;
      i += 1;
    }
    return `${value.toFixed(1)} ${units[i]}`;
  };

  const formatPercent = (value) => `${value.toFixed(1)}%`;

  const formatUptime = (seconds) => {
    if (seconds == null) return 'Uptime: --';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `Uptime: ${d}d ${h}h`;
    if (h > 0) return `Uptime: ${h}h ${m}m`;
    return `Uptime: ${m}m`;
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: 'rgba(255,255,255,0.55)',
          maxTicksLimit: 6,
        },
      },
      y: {
        beginAtZero: true,
        suggestedMax: 100,
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: {
          color: 'rgba(255,255,255,0.55)',
          callback: (value) => `${value}%`,
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `${context.formattedValue}%`,
        },
      },
    },
  };

  const cpuChart = new Chart(cpuChartCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'CPU %',
          data: cpuData,
          borderColor: '#ff7a3d',
          backgroundColor: 'rgba(255, 122, 61, 0.15)',
          tension: 0.35,
          fill: true,
          borderWidth: 2,
        },
      ],
    },
    options: chartOptions,
  });

  const memoryChart = new Chart(memoryChartCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Memory %',
          data: memoryData,
          borderColor: '#2575fc',
          backgroundColor: 'rgba(37, 117, 252, 0.15)',
          tension: 0.35,
          fill: true,
          borderWidth: 2,
        },
      ],
    },
    options: chartOptions,
  });

  const el = (id) => document.getElementById(id);
  const cpuSummary = el('cpuSummary');
  const cpuLoadAvg = el('cpuLoadAvg');
  const cpuTemp = el('cpuTemp');
  const cpuFreq = el('cpuFreq');
  const memorySummary = el('memorySummary');
  const memoryUsed = el('memoryUsed');
  const memoryTotal = el('memoryTotal');
  const uptimeEl = el('uptime');
  const lastUpdated = el('lastUpdated');
  const dockerGrid = el('dockerGrid');
  const runningSummary = el('runningSummary');
  const refreshButton = el('refreshMetrics');

  const setDockerLoading = (isLoading) => {
    if (!dockerGrid) return;
    dockerGrid.dataset.loading = isLoading ? '1' : '0';
    if (isLoading && !(latestContainers && latestContainers.length)) {
      dockerGrid.innerHTML = '';
      const placeholder = document.createElement('div');
      placeholder.className = 'card docker-card';
      placeholder.innerHTML = '<p class="muted">Loading container stats…</p>';
      dockerGrid.appendChild(placeholder);
      if (runningSummary) runningSummary.textContent = 'Loading…';
    }
  };

  const applySystemUI = (data, labelText = null) => {
    if (!data) return;
    if (cpuSummary) cpuSummary.textContent = formatPercent(data.cpu_percent);
    if (cpuLoadAvg) cpuLoadAvg.textContent = `Load avg: ${data.load_average['1m'].toFixed(2)} / ${data.load_average['5m'].toFixed(2)} / ${data.load_average['15m'].toFixed(2)}`;
    if (cpuTemp) cpuTemp.textContent = `Temp: ${data.temperatures.cpu_c ? data.temperatures.cpu_c.toFixed(1) + ' °C' : 'n/a'}`;
    if (cpuFreq) cpuFreq.textContent = data.cpu_freq_mhz ? `Clock: ${data.cpu_freq_mhz.toFixed(0)} MHz` : 'Clock: n/a';
    if (memorySummary) memorySummary.textContent = formatPercent(data.memory.percent);
    if (memoryUsed) memoryUsed.textContent = `Used: ${formatBytes(data.memory.used_bytes)}`;
    if (memoryTotal) memoryTotal.textContent = `Total: ${formatBytes(data.memory.total_bytes)}`;
    if (uptimeEl) uptimeEl.textContent = formatUptime(data.uptime.seconds);
    if (lastUpdated && labelText) lastUpdated.textContent = labelText;
  };

  const applyCache = (cache) => {
    if (!cache) return;
    if (Array.isArray(cache.labels)) {
      labels.push(...cache.labels.slice(-MAX_POINTS));
      cpuData.push(...cache.cpuData?.slice(-MAX_POINTS) ?? []);
      memoryData.push(...cache.memoryData?.slice(-MAX_POINTS) ?? []);
      cpuChart.update('none');
      memoryChart.update('none');
    }

    if (cache.system) {
      latestSystem = cache.system;
      applySystemUI(cache.system, 'Last updated: cached');
    }

    if (Array.isArray(cache.containers)) {
      latestContainers = cache.containers;
      updateContainers(cache.containers, true);
    }
  };

  const pushPoint = (cpuValue, memoryValue, label) => {
    labels.push(label);
    cpuData.push(cpuValue);
    memoryData.push(memoryValue);

    if (labels.length > MAX_POINTS) {
      labels.shift();
      cpuData.shift();
      memoryData.shift();
    }

    cpuChart.update('none');
    memoryChart.update('none');
  };

  const updateSystemMetrics = (data) => {
    const timestamp = new Date();
    const label = timestamp.toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    pushPoint(data.cpu_percent, data.memory.percent, label);
    latestSystem = data;
    applySystemUI(data, `Last updated: ${label}`);
  };

  const createRing = (label, percent, color, text) => {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'grid';
    wrapper.style.placeItems = 'center';
    wrapper.style.gap = '0.4rem';

    const ring = document.createElement('div');
    ring.className = 'ring';
    ring.style.setProperty('--percent', Math.min(Math.max(percent, 0), 100));
    ring.style.setProperty('--ring-color', color);

    const value = document.createElement('span');
    value.textContent = text;
    ring.appendChild(value);

    const ringLabel = document.createElement('div');
    ringLabel.className = 'ring-label';
    ringLabel.textContent = label;

    wrapper.append(ring, ringLabel);
    return wrapper;
  };

  const buildDockerCard = (container) => {
    const card = document.createElement('div');
    card.className = 'docker-card';

    const header = document.createElement('div');
    header.className = 'docker-card__header';

    const title = document.createElement('h3');
    title.textContent = container.display_name || container.name;
    header.appendChild(title);

    const status = (container.status || '').toLowerCase();
    const running = ['running', 'online'].includes(status);

    const statusPill = document.createElement('span');
    statusPill.className = `status-pill ${running ? 'status-pill--up' : 'status-pill--down'}`;
    statusPill.textContent = running ? 'Running' : (status || 'Stopped');
    header.appendChild(statusPill);

    const body = document.createElement('div');
    body.className = 'docker-card__body';

    const cpuValue = running ? container.cpu_percent : 0;
    const memPercent = running ? (container.memory.percent || 0) : 0;
    const memText = running ? `${container.memory.usage_human} / ${container.memory.limit_human}` : '--';

    const cpuRing = createRing('CPU', cpuValue, '#ff7a3d', running ? `${cpuValue.toFixed(1)}%` : '--');
    const memRing = createRing('Memory', memPercent, '#2575fc', running ? `${memPercent.toFixed(1)}%` : '--');

    body.append(cpuRing, memRing);

    const meta = document.createElement('div');
    meta.className = 'docker-card__meta';

    const image = document.createElement('div');
    image.innerHTML = `<strong>Image:</strong> ${container.image}`;

    const usage = document.createElement('div');
    usage.innerHTML = `<strong>Usage:</strong> ${memText}`;

    const uptime = document.createElement('div');
    uptime.textContent = running ? formatUptime(container.uptime_seconds) : 'Uptime: --';

    meta.append(image, usage, uptime);

    card.append(header, body, meta);
    return card;
  };

  const updateContainers = (containers = [], fromCache = false) => {
    if (!dockerGrid) return;
    dockerGrid.innerHTML = '';

    const list = containers || [];

    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'card docker-card';
      empty.innerHTML = fromCache
        ? '<p class="muted">Cached data unavailable.</p>'
        : '<p class="muted">No containers detected.</p>';
      dockerGrid.appendChild(empty);
      if (runningSummary) runningSummary.textContent = fromCache ? 'Cached data unavailable' : 'No containers';
      return;
    }

    const running = list.filter((c) => ['running', 'online'].includes((c.status || '').toLowerCase())).length;
    if (runningSummary) {
      runningSummary.textContent = `${running} / ${list.length} containers running`;
    }

    list.forEach((container) => {
      dockerGrid.appendChild(buildDockerCard(container));
    });
  };

  const handleError = (error) => {
    console.error('[Performance] Metrics fetch failed', error);
    if (lastUpdated) lastUpdated.textContent = 'Last updated: error';
  };

  const fetchSystemMetrics = async () => {
    try {
      const response = await fetch(SYSTEM_URL, { cache: 'no-store' });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`System metrics error ${response.status}: ${text}`);
      }
      const data = await response.json();
      latestSystem = data;
      updateSystemMetrics(data);
      saveCache();
    } catch (error) {
      handleError(error);
    }
  };

  const fetchContainerMetrics = async () => {
    try {
      setDockerLoading(!latestContainers);
      const response = await fetch(`${CONTAINERS_URL}?include_stopped=true`, { cache: 'no-store' });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Container metrics error ${response.status}: ${text}`);
      }
      const data = await response.json();
      latestContainers = data.containers || [];
      updateContainers(latestContainers);
      saveCache();
    } catch (error) {
      handleError(error);
    } finally {
      setDockerLoading(false);
    }
  };

  const startIntervals = () => {
    if (systemInterval) clearInterval(systemInterval);
    if (containersInterval) clearInterval(containersInterval);
    systemInterval = setInterval(fetchSystemMetrics, 4000);
    containersInterval = setInterval(fetchContainerMetrics, 6000);
  };

  const triggerRefresh = () => {
    fetchSystemMetrics();
    fetchContainerMetrics();
    startIntervals();
  };

  const cached = loadCache();
  if (cached) {
    applyCache(cached);
  }

  triggerRefresh();

  if (refreshButton) {
    refreshButton.addEventListener('click', triggerRefresh);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      triggerRefresh();
    }
  });

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      triggerRefresh();
    }
  });
})();
