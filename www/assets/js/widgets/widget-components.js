/**
 * Widget Component Definitions - Organized by Category
 * Each widget fetches real data and renders with Chart.js support
 */

const WidgetComponents = {
  categories: {
    system: {
      name: 'System Monitoring',
      icon: '🖥️',
      widgets: ['cpu-usage', 'memory-usage', 'cpu-temp', 'system-uptime']
    },
    containers: {
      name: 'Docker Containers',
      icon: '🐳',
      widgets: [] // Will be populated dynamically from API
    },
    crypto: {
      name: 'Cryptocurrency',
      icon: '₿',
      widgets: ['crypto-btc', 'crypto-eth', 'crypto-top5']
    },
    games: {
      name: 'Games Library',
      icon: '🎮',
      widgets: ['games-recent', 'games-count']
    }
  },

  // Helper to get metrics API base URL (same as performance page)
  getMetricsBase() {
    const metricsBase = (window.METRICS_API_BASE || (() => {
      const { protocol, hostname } = window.location;
      if (protocol === 'https:') {
        return `${protocol}//${hostname}/metrics-api`;
      }
      return `${protocol}//${hostname}:8001`;
    })()).replace(/\/$/, '');
    return metricsBase;
  },

  /**
   * CPU Usage Widget with live graph (auto-refreshes like performance page)
   */
  'cpu-usage': {
    name: 'CPU Usage',
    description: 'Live CPU percentage with chart',
    icon: '📊',
    category: 'system',
    defaultSize: { w: 4, h: 3 },
    
    async render(widgetId) {
      const chartId = `chart-${widgetId}`;
      const data = await this.fetchData();
      
      if (!data) {
        return this.renderError();
      }
      
      // Schedule chart rendering after DOM update
      setTimeout(() => {
        this.initChart(chartId, widgetId, data.cpuPercent);
      }, 100);
      
      return `
        <div class="widget" data-widget-type="cpu-usage" data-widget-id="${widgetId}">
          <div class="widget__header">
            <h3 class="widget__title">
              <span class="widget__icon">📊</span>
              CPU Usage
            </h3>
            <div class="widget__actions">
              <button class="widget__action-btn" onclick="removeWidget(this)">✕</button>
            </div>
          </div>
          <div class="widget__body">
            <div class="widget-stat">
              <div class="widget-stat__value" id="cpu-value-${widgetId}">${data.cpuPercent.toFixed(1)}%</div>
            </div>
              <div style="flex: 1; min-height: 0; position: relative; max-height: 120px;">
                <canvas id="${chartId}"></canvas>
              </div>
          </div>
        </div>
      `;
    },
    
    async fetchData() {
      try {
        const metricsBase = WidgetComponents.getMetricsBase();
        const url = `${metricsBase}/api/system/overview`;
        // Use cache: 'no-store' like performance page to wake up API
        const response = await fetch(url, { cache: 'no-store' });
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        const cpuPercent = parseFloat(data.cpu?.percent || data.cpu_percent);
        
        if (isNaN(cpuPercent)) {
          throw new Error('Invalid CPU data');
        }
        
        return { cpuPercent };
      } catch (error) {
        console.error('[CPU Widget] Fetch error:', error);
        return null;
      }
    },
    
    initChart(chartId, widgetId, initialValue) {
      const canvas = document.getElementById(chartId);
      if (!canvas || !window.Chart) {
        console.warn(`[CPU Widget] Canvas or Chart.js not available for ${chartId}`);
        return;
      }
      
      const ctx = canvas.getContext('2d');
      
      // Initialize data history per widget (stored globally)
      const dataHistory = [initialValue * 0.8, initialValue * 0.9, initialValue, initialValue * 0.95, initialValue];
      if (typeof window.widgetDataHistory !== 'undefined') {
        window.widgetDataHistory.set(widgetId, dataHistory);
      }
      
      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['', '', '', '', ''],
          datasets: [{
            data: [...dataHistory],
            borderColor: 'rgba(255, 122, 61, 0.8)',
            backgroundColor: 'rgba(255, 122, 61, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { display: false },
            y: { display: false, beginAtZero: true, max: 100 }
          }
        }
      });
      
      // Store chart instance globally for updates
      if (typeof window.widgetCharts !== 'undefined') {
        window.widgetCharts.set(widgetId, chart);
        console.log(`[CPU Widget] Chart initialized and stored for ${widgetId}`);
      } else {
        console.error(`[CPU Widget] window.widgetCharts not available`);
      }
    },
    
    async update(widgetElement, widgetId) {
      console.log(`[CPU Widget] Updating widget ${widgetId}`);
      const data = await this.fetchData();
      if (!data) {
        console.warn(`[CPU Widget] No data received for ${widgetId}`);
        return;
      }
      
      console.log(`[CPU Widget] New CPU value: ${data.cpuPercent.toFixed(1)}%`);
      
      // Update value display
      const valueElement = document.getElementById(`cpu-value-${widgetId}`);
      if (valueElement) {
        valueElement.textContent = `${data.cpuPercent.toFixed(1)}%`;
        console.log(`[CPU Widget] Updated value display`);
      } else {
        console.warn(`[CPU Widget] Value element not found: cpu-value-${widgetId}`);
      }
      
      // Update chart
      const chart = window.widgetCharts?.get(widgetId);
      if (chart) {
        // Get or create data history for this widget
        let dataHistory = window.widgetDataHistory?.get(widgetId);
        if (!dataHistory) {
          dataHistory = [data.cpuPercent];
          window.widgetDataHistory?.set(widgetId, dataHistory);
        }
        
        // Add new data point, remove oldest
        dataHistory.push(data.cpuPercent);
        if (dataHistory.length > 5) {
          dataHistory.shift();
        }
        
        chart.data.datasets[0].data = [...dataHistory];
        chart.update('none'); // Same as performance page
        console.log(`[CPU Widget] Chart updated with data:`, dataHistory);
      } else {
        console.warn(`[CPU Widget] Chart not found for ${widgetId}`);
      }
    },
    
    renderError() {
      return `
        <div class="widget" data-widget-type="cpu-usage">
          <div class="widget__header">
            <h3 class="widget__title">
              <span class="widget__icon">📊</span>
              CPU Usage
            </h3>
            <div class="widget__actions">
              <button class="widget__action-btn" onclick="removeWidget(this)">✕</button>
            </div>
          </div>
          <div class="widget__body">
            <p style="color: var(--color-text-muted);text-align:center;">Metrics unavailable</p>
            <p style="color: var(--color-text-muted);text-align:center;font-size:0.8rem;">Visit Performance page first</p>
          </div>
        </div>
      `;
    }
  },

  /**
   * Memory Usage Widget with live graph (auto-refreshes like performance page)
   */
  'memory-usage': {
    name: 'Memory Usage',
    description: 'Live RAM usage with chart',
    icon: '💾',
    category: 'system',
    defaultSize: { w: 4, h: 3 },
    
    async render(widgetId) {
      const chartId = `chart-${widgetId}`;
      const data = await this.fetchData();
      
      if (!data) {
        return this.renderError();
      }
      
      setTimeout(() => {
        this.initChart(chartId, widgetId, data.memPercent);
      }, 100);
      
      return `
        <div class="widget" data-widget-type="memory-usage" data-widget-id="${widgetId}">
          <div class="widget__header">
            <h3 class="widget__title">
              <span class="widget__icon">💾</span>
              Memory
            </h3>
            <div class="widget__actions">
              <button class="widget__action-btn" onclick="removeWidget(this)">✕</button>
            </div>
          </div>
          <div class="widget__body">
            <div class="widget-stat">
              <div class="widget-stat__value" id="mem-value-${widgetId}">${data.memPercent.toFixed(1)}%</div>
              <div class="widget-stat__label" id="mem-label-${widgetId}">${data.memUsed} / ${data.memTotal} GB</div>
            </div>
            <div style="flex: 1; min-height: 0; position: relative; max-height: 100px;">
              <canvas id="${chartId}"></canvas>
            </div>
          </div>
        </div>
      `;
    },
    
    async fetchData() {
      try {
        const metricsBase = WidgetComponents.getMetricsBase();
        const url = `${metricsBase}/api/system/overview`;
        // Use cache: 'no-store' like performance page to wake up API
        const response = await fetch(url, { cache: 'no-store' });
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        const memPercent = parseFloat(data.memory?.percent || data.memory_percent);
        const memUsed = parseFloat((data.memory?.used / (1024**3)).toFixed(1));
        const memTotal = parseFloat((data.memory?.total / (1024**3)).toFixed(1));
        
        if (isNaN(memPercent) || isNaN(memUsed) || isNaN(memTotal)) {
          throw new Error('Invalid memory data');
        }
        
        return { memPercent, memUsed, memTotal };
      } catch (error) {
        console.error('[Memory Widget] Fetch error:', error);
        return null;
      }
    },
    
    initChart(chartId, widgetId, initialValue) {
      const canvas = document.getElementById(chartId);
      if (!canvas || !window.Chart) return;
      
      const ctx = canvas.getContext('2d');
      const dataHistory = [initialValue * 0.85, initialValue * 0.92, initialValue, initialValue * 0.97, initialValue];
      if (typeof window.widgetDataHistory !== 'undefined') {
        window.widgetDataHistory.set(widgetId, dataHistory);
      }
      
      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['', '', '', '', ''],
          datasets: [{
            data: [...dataHistory],
            borderColor: 'rgba(37, 117, 252, 0.8)',
            backgroundColor: 'rgba(37, 117, 252, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { display: false },
            y: { display: false, beginAtZero: true, max: 100 }
          }
        }
      });
      
      if (typeof window.widgetCharts !== 'undefined') {
        window.widgetCharts.set(widgetId, chart);
      }
    },
    
    async update(widgetElement, widgetId) {
      const data = await this.fetchData();
      if (!data) return;
      
      const valueElement = document.getElementById(`mem-value-${widgetId}`);
      const labelElement = document.getElementById(`mem-label-${widgetId}`);
      
      if (valueElement) {
        valueElement.textContent = `${data.memPercent.toFixed(1)}%`;
      }
      if (labelElement) {
        labelElement.textContent = `${data.memUsed} / ${data.memTotal} GB`;
      }
      
      const chart = window.widgetCharts?.get(widgetId);
      if (chart) {
        let dataHistory = window.widgetDataHistory?.get(widgetId);
        if (!dataHistory) {
          dataHistory = [data.memPercent];
          window.widgetDataHistory?.set(widgetId, dataHistory);
        }
        
        dataHistory.push(data.memPercent);
        if (dataHistory.length > 5) {
          dataHistory.shift();
        }
        chart.data.datasets[0].data = [...dataHistory];
        chart.update('none');
      }
    },
    
    renderError() {
      return `
        <div class="widget" data-widget-type="memory-usage">
          <div class="widget__header">
            <h3 class="widget__title">
              <span class="widget__icon">💾</span>
              Memory
            </h3>
            <div class="widget__actions">
              <button class="widget__action-btn" onclick="removeWidget(this)">✕</button>
            </div>
          </div>
          <div class="widget__body">
            <p style="color: var(--color-text-muted);text-align:center;">Metrics unavailable</p>
            <p style="color: var(--color-text-muted);text-align:center;font-size:0.8rem;">Visit Performance page first</p>
          </div>
        </div>
      `;
    }
  },

  /**
   * CPU Temperature Widget (auto-refreshes like performance page)
   */
  'cpu-temp': {
    name: 'CPU Temperature',
    description: 'Current CPU temperature',
    icon: '🌡️',
    category: 'system',
    defaultSize: { w: 2, h: 2 },
    
    async render(widgetId) {
      const data = await this.fetchData();
      
      if (!data) {
        return this.renderError();
      }
      
      const tempColor = data.temp > 80 ? '#e74c3c' : data.temp > 70 ? '#f39c12' : '#2ecc71';
      
      return `
        <div class="widget" data-widget-type="cpu-temp" data-widget-id="${widgetId}">
          <div class="widget__header">
            <h3 class="widget__title">
              <span class="widget__icon">🌡️</span>
              CPU Temp
            </h3>
            <div class="widget__actions">
              <button class="widget__action-btn" onclick="removeWidget(this)">✕</button>
            </div>
          </div>
          <div class="widget__body">
            <div class="widget-stat">
              <div class="widget-stat__value" id="temp-value-${widgetId}" style="color: ${tempColor};">${data.temp.toFixed(1)}°C</div>
            </div>
          </div>
        </div>
      `;
    },
    
      async fetchData() {
        try {
          const metricsBase = WidgetComponents.getMetricsBase();
          const url = `${metricsBase}/api/system/overview`;
          // Use cache: 'no-store' like performance page to wake up API
          const response = await fetch(url, { cache: 'no-store' });
          
          if (!response.ok) throw new Error(`API error: ${response.status}`);
          
          const data = await response.json();
          const temp = parseFloat(data.cpu?.temperature || data.cpu_temp);
          
          if (isNaN(temp)) {
            throw new Error('Invalid temperature data');
          }
          
          return { temp };
        } catch (error) {
          console.error('[CPU Temp Widget] Fetch error:', error);
          return null;
        }
      },
    
    async update(widgetElement, widgetId) {
      const data = await this.fetchData();
      if (!data) return;
      
      const valueElement = document.getElementById(`temp-value-${widgetId}`);
      if (valueElement) {
        const tempColor = data.temp > 80 ? '#e74c3c' : data.temp > 70 ? '#f39c12' : '#2ecc71';
        valueElement.textContent = `${data.temp.toFixed(1)}°C`;
        valueElement.style.color = tempColor;
      }
    },
    
    renderError() {
      return `
        <div class="widget" data-widget-type="cpu-temp">
          <div class="widget__header">
            <h3 class="widget__title">
              <span class="widget__icon">🌡️</span>
              CPU Temp
            </h3>
            <div class="widget__actions">
              <button class="widget__action-btn" onclick="removeWidget(this)">✕</button>
            </div>
          </div>
          <div class="widget__body">
            <p style="color: var(--color-text-muted);text-align:center;">Metrics unavailable</p>
          </div>
        </div>
      `;
    }
  },

  /**
   * System Uptime Widget (auto-refreshes like performance page)
   */
  'system-uptime': {
    name: 'System Uptime',
    description: 'Server uptime',
    icon: '⏱️',
    category: 'system',
    defaultSize: { w: 2, h: 2 },
    
    async render(widgetId) {
      const data = await this.fetchData();
      
      if (!data) {
        return this.renderError();
      }
      
      return `
        <div class="widget" data-widget-type="system-uptime" data-widget-id="${widgetId}">
          <div class="widget__header">
            <h3 class="widget__title">
              <span class="widget__icon">⏱️</span>
              Uptime
            </h3>
            <div class="widget__actions">
              <button class="widget__action-btn" onclick="removeWidget(this)">✕</button>
            </div>
          </div>
          <div class="widget__body">
            <div class="widget-stat">
              <div class="widget-stat__value" id="uptime-value-${widgetId}">${data.uptimeText}</div>
            </div>
          </div>
        </div>
      `;
    },
    
      async fetchData() {
        try {
          const metricsBase = WidgetComponents.getMetricsBase();
          const url = `${metricsBase}/api/system/overview`;
          // Use cache: 'no-store' like performance page to wake up API
          const response = await fetch(url, { cache: 'no-store' });
          
          if (!response.ok) throw new Error(`API error: ${response.status}`);
          
          const data = await response.json();
          const uptimeSeconds = parseFloat(data.uptime || data.uptime_seconds) || 0;
          
          if (!uptimeSeconds || isNaN(uptimeSeconds)) {
            throw new Error('Invalid uptime data');
          }
          
          const days = Math.floor(uptimeSeconds / 86400);
          const hours = Math.floor((uptimeSeconds % 86400) / 3600);
          const minutes = Math.floor((uptimeSeconds % 3600) / 60);
          
          let uptimeText;
          if (days > 0) {
            uptimeText = `${days}d ${hours}h`;
          } else if (hours > 0) {
            uptimeText = `${hours}h ${minutes}m`;
          } else {
            uptimeText = `${minutes}m`;
          }
          
          return { uptimeText };
        } catch (error) {
          console.error('[Uptime Widget] Fetch error:', error);
          return null;
        }
      },
    
    async update(widgetElement, widgetId) {
      const data = await this.fetchData();
      if (!data) return;
      
      const valueElement = document.getElementById(`uptime-value-${widgetId}`);
      if (valueElement) {
        valueElement.textContent = data.uptimeText;
      }
    },
    
    renderError() {
      return `
        <div class="widget" data-widget-type="system-uptime">
          <div class="widget__header">
            <h3 class="widget__title">
              <span class="widget__icon">⏱️</span>
              Uptime
            </h3>
            <div class="widget__actions">
              <button class="widget__action-btn" onclick="removeWidget(this)">✕</button>
            </div>
          </div>
          <div class="widget__body">
            <p style="color: var(--color-text-muted);">Metrics unavailable</p>
          </div>
        </div>
      `;
    }
  },

  /**
   * Create dynamic container widget (auto-refreshes like performance page)
   */
  createContainerWidget(containerId, containerName) {
    return {
      name: containerName,
      description: `Monitor ${containerName} container`,
      icon: '🐳',
      category: 'containers',
      defaultSize: { w: 3, h: 2 },
      containerId,
      containerName,
      
      async fetchData() {
        try {
          const metricsBase = WidgetComponents.getMetricsBase();
          const url = `${metricsBase}/api/containers?include_stopped=true`;
          // Use cache: 'no-store' like performance page to wake up API
          const response = await fetch(url, { cache: 'no-store' });
          
          if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
          }
          
          let containers = await response.json();
          
          // Handle both array and object responses
          if (!Array.isArray(containers)) {
            if (containers && Array.isArray(containers.containers)) {
              containers = containers.containers;
            } else {
              throw new Error('Invalid containers response format');
            }
          }
          
          const container = containers.find(c => c.id === this.containerId || c.name === this.containerName);
          return container;
        } catch (error) {
          console.error('[Container Widget] Fetch error:', error);
          return null;
        }
      },
      
      async render(widgetId) {
        const container = await this.fetchData();
        
        if (!container) {
          return this.renderError();
        }
        
        // Use status (lowercase) like performance page does
        const status = (container.status || container.state || 'unknown').toString().toLowerCase();
        const statusColor = (status === 'running' || status === 'online') ? '#2ecc71' : '#e74c3c';
        const statusDot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor};margin-right:6px;"></span>`;
        
        // Clean container name (remove emoji if present)
        const cleanName = this.containerName.replace(/^🐳\s*/, '').trim();
        
        return `
          <div class="widget" data-widget-type="container-${this.containerId}" data-container-id="${this.containerId}" data-widget-id="${widgetId}">
            <div class="widget__header">
              <h3 class="widget__title">
                <span class="widget__icon">🐳</span>
                ${cleanName}
              </h3>
              <div class="widget__actions">
                <button class="widget__action-btn" onclick="removeWidget(this)">✕</button>
              </div>
            </div>
            <div class="widget__body">
              <div class="widget-card">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                  <span style="color: var(--color-text);font-weight:500;">Status</span>
                  <span id="container-status-${widgetId}" style="color: var(--color-text-muted);font-size:0.85rem;">
                    ${statusDot}${status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        `;
      },
      
      async update(widgetElement, widgetId) {
        const container = await this.fetchData();
        if (!container) return;
        
        const statusElement = document.getElementById(`container-status-${widgetId}`);
        if (statusElement) {
          const status = container.state || container.status || 'unknown';
          const statusColor = (status === 'running' || status === 'online') ? '#2ecc71' : '#e74c3c';
          const statusDot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor};margin-right:6px;"></span>`;
          statusElement.innerHTML = `${statusDot}${status}`;
        }
      },
      
      renderError() {
        return `
          <div class="widget" data-widget-type="container-${this.containerId}" data-container-id="${this.containerId}">
            <div class="widget__header">
              <h3 class="widget__title">
                <span class="widget__icon">🐳</span>
                ${this.containerName}
              </h3>
              <div class="widget__actions">
                <button class="widget__action-btn" onclick="removeWidget(this)">✕</button>
              </div>
            </div>
            <div class="widget__body">
              <p style="color: var(--color-text-muted);">Unable to fetch container data</p>
            </div>
          </div>
        `;
      }
    };
  },

  /**
   * BTC Price Widget
   */
  'crypto-btc': {
    name: 'Bitcoin Price',
    description: 'Live BTC price and 24h change',
    icon: '₿',
    category: 'crypto',
    defaultSize: { w: 2, h: 2 },
    async render() {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true');
        const data = await response.json();
        const price = data.bitcoin.usd;
        const change = data.bitcoin.usd_24h_change;
        const isPositive = change >= 0;
        
        return `
          <div class="widget" data-widget-type="crypto-btc">
            <div class="widget__header">
              <h3 class="widget__title">
                <span class="widget__icon">₿</span>
                Bitcoin
              </h3>
              <div class="widget__actions">
                <button class="widget__action-btn" onclick="removeWidget(this)">✕</button>
              </div>
            </div>
            <div class="widget__body">
              <div class="widget-stat">
                <div class="widget-stat__label">Current Price</div>
                <div class="widget-stat__value">
                  $${price.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                </div>
                <span class="widget-stat__change widget-stat__change--${isPositive ? 'positive' : 'negative'}">
                  ${isPositive ? '+' : ''}${change.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        `;
      } catch (error) {
        return `
          <div class="widget" data-widget-type="crypto-btc">
            <div class="widget__header">
              <h3 class="widget__title">
                <span class="widget__icon">₿</span>
                Bitcoin
              </h3>
              <div class="widget__actions">
                <button class="widget__action-btn" onclick="removeWidget(this)">✕</button>
              </div>
            </div>
            <div class="widget__body">
              <p style="color: var(--color-text-muted);">Failed to load BTC price</p>
            </div>
          </div>
        `;
      }
    }
  },

  /**
   * ETH Price Widget
   */
  'crypto-eth': {
    name: 'Ethereum Price',
    description: 'Live ETH price and 24h change',
    icon: 'Ξ',
    category: 'crypto',
    defaultSize: { w: 2, h: 2 },
    async render() {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true');
        const data = await response.json();
        const price = data.ethereum.usd;
        const change = data.ethereum.usd_24h_change;
        const isPositive = change >= 0;
        
        return `
          <div class="widget" data-widget-type="crypto-eth">
            <div class="widget__header">
              <h3 class="widget__title">
                <span class="widget__icon">Ξ</span>
                Ethereum
              </h3>
              <div class="widget__actions">
                <button class="widget__action-btn" onclick="removeWidget(this)">✕</button>
              </div>
            </div>
            <div class="widget__body">
              <div class="widget-stat">
                <div class="widget-stat__label">Current Price</div>
                <div class="widget-stat__value">
                  $${price.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                </div>
                <span class="widget-stat__change widget-stat__change--${isPositive ? 'positive' : 'negative'}">
                  ${isPositive ? '+' : ''}${change.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        `;
      } catch (error) {
        return `
          <div class="widget" data-widget-type="crypto-eth">
            <div class="widget__header">
              <h3 class="widget__title">
                <span class="widget__icon">Ξ</span>
                Ethereum
              </h3>
              <div class="widget__actions">
                <button class="widget__action-btn" onclick="removeWidget(this)">✕</button>
              </div>
            </div>
            <div class="widget__body">
              <p style="color: var(--color-text-muted);">Failed to load ETH price</p>
            </div>
          </div>
        `;
      }
    }
  },

  /**
   * Recent Games Widget
   */
  'games-recent': {
    name: 'Recent Games',
    description: 'Latest games in library',
    icon: '🎮',
    category: 'games',
    defaultSize: { w: 3, h: 3 },
    async render() {
      try {
        const response = await fetch('/api/games?limit=5');
        const games = await response.json();
        
        const gamesHtml = games.slice(0, 3).map(game => `
          <div class="widget-card">
            <h4 class="widget-card__title">${game.title}</h4>
            <div class="widget-card__content">${game.platforms?.join(', ') || 'Unknown'}</div>
          </div>
        `).join('');
        
        return `
          <div class="widget" data-widget-type="games-recent">
            <div class="widget__header">
              <h3 class="widget__title">
                <span class="widget__icon">🎮</span>
                Recent Games
              </h3>
              <div class="widget__actions">
                <button class="widget__action-btn" onclick="window.location='/games'">View All</button>
                <button class="widget__action-btn" onclick="removeWidget(this)">✕</button>
              </div>
            </div>
            <div class="widget__body">
              ${gamesHtml || '<p style="color: var(--color-text-muted);">No games found</p>'}
            </div>
          </div>
        `;
      } catch (error) {
        return `
          <div class="widget" data-widget-type="games-recent">
            <div class="widget__header">
              <h3 class="widget__title">
                <span class="widget__icon">🎮</span>
                Recent Games
              </h3>
              <div class="widget__actions">
                <button class="widget__action-btn" onclick="removeWidget(this)">✕</button>
              </div>
            </div>
            <div class="widget__body">
              <p style="color: var(--color-text-muted);">Failed to load games</p>
            </div>
          </div>
        `;
      }
    }
  },

  /**
   * Games Count Widget
   */
  'games-count': {
    name: 'Games Count',
    description: 'Total games in library',
    icon: '🎯',
    category: 'games',
    defaultSize: { w: 2, h: 2 },
    async render() {
      try {
        const response = await fetch('/api/games');
        const games = await response.json();
        const count = games.length;
        
        return `
          <div class="widget" data-widget-type="games-count">
            <div class="widget__header">
              <h3 class="widget__title">
                <span class="widget__icon">🎯</span>
                Game Library
              </h3>
              <div class="widget__actions">
                <button class="widget__action-btn" onclick="removeWidget(this)">✕</button>
              </div>
            </div>
            <div class="widget__body">
              <div class="widget-stat">
                <div class="widget-stat__label">Total Games</div>
                <div class="widget-stat__value">${count}</div>
              </div>
            </div>
          </div>
        `;
      } catch (error) {
        return `
          <div class="widget" data-widget-type="games-count">
            <div class="widget__header">
              <h3 class="widget__title">
                <span class="widget__icon">🎯</span>
                Game Library
              </h3>
              <div class="widget__actions">
                <button class="widget__action-btn" onclick="removeWidget(this)">✕</button>
              </div>
            </div>
            <div class="widget__body">
              <p style="color: var(--color-text-muted);">Failed to load games</p>
            </div>
          </div>
        `;
      }
    }
  }
};

// Export for use in dashboard.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WidgetComponents;
}
