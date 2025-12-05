/**
 * Dashboard with GridStack.js
 * Drag-and-drop widget system with categories
 */

let grid;
let isEditMode = false;
let isResizeMode = false;
const STORAGE_KEY = 'rubberrobo_dashboard_layout';
const WIDGET_CACHE_KEY = 'rubberrobo_widget_templates_cache';
const CONTAINERS_SNAPSHOT_KEY = 'rubberrobo_containers_snapshot';
const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
const SNAPSHOT_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours (containers don't change often)

// Widget refresh intervals (same as performance page)
const widgetIntervals = new Map(); // widgetId -> intervalId
const widgetCharts = new Map(); // widgetId -> chart instance
const widgetDataHistory = new Map(); // widgetId -> data history array

// Make widgetCharts globally accessible for widget components
window.widgetCharts = widgetCharts;
window.widgetDataHistory = widgetDataHistory;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Dashboard initializing...');
  
  await initGridStack();
  console.log('GridStack initialized');
  
  renderTopNavigation();
  setupEventListeners();
  
  // Load saved dashboard (await it!)
  await loadDashboard();
  
  // Populate widget templates in background (don't await - render immediately)
  populateWidgetCategories();
  
  updateEmptyState();
  
  console.log('Dashboard ready');
});

/**
 * Render top navigation manually (dashboard doesn't use standard sidebar)
 */
function renderTopNavigation() {
  const config = window.NavigationConfig || {};
  const topbarNav = document.getElementById('topbar-nav');
  
  if (!topbarNav || !Array.isArray(config.topNav)) return;
  
  topbarNav.innerHTML = '';
  config.topNav.forEach((item) => {
    const link = document.createElement('a');
    link.href = item.href;
    link.className = 'topbar__nav-link';
    link.textContent = item.label;
    
    if (item.key === 'home' || window.location.pathname.includes('/home/')) {
      link.classList.add('is-active');
    }
    
    topbarNav.appendChild(link);
  });
}

/**
 * Initialize GridStack
 */
async function initGridStack() {
  const gridElement = document.getElementById('dashboard-grid');
  
  grid = GridStack.init({
    column: 12,
    cellHeight: 80,
    margin: 12,
    float: false,
    disableOneColumnMode: true,
    animate: true,
    removeTimeout: 100,
    acceptWidgets: true,
    disableDrag: true,
    disableResize: true
  }, gridElement);

  // Listen to grid changes
  grid.on('change', (event, items) => {
    saveDashboard();
  });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Add Widget button
  document.getElementById('addWidgetBtn').addEventListener('click', openWidgetModal);
  
  // Add Link button (sidebar)
  document.getElementById('addLinkBtnSidebar').addEventListener('click', openLinkModal);
  
  // Edit Mode button
  document.getElementById('editModeBtn').addEventListener('click', toggleEditMode);
  
  // Resize Mode button
  document.getElementById('resizeModeBtn').addEventListener('click', toggleResizeMode);
  
  // Widget modal close
  document.getElementById('widgetModalClose').addEventListener('click', closeWidgetModal);
  document.getElementById('widgetModalBackdrop').addEventListener('click', closeWidgetModal);
  
  // Link modal close
  document.getElementById('linkModalClose').addEventListener('click', closeLinkModal);
  document.getElementById('linkModalBackdrop').addEventListener('click', closeLinkModal);
  document.getElementById('linkModalCancel').addEventListener('click', closeLinkModal);
  
  // Add Link button (inside modal)
  document.getElementById('addLinkBtn').addEventListener('click', addLinkWidget);
}

/**
 * Load cached widget templates
 */
function loadCachedTemplates() {
  try {
    const cached = localStorage.getItem(WIDGET_CACHE_KEY);
    if (!cached) return null;
    
    const data = JSON.parse(cached);
    const age = Date.now() - data.timestamp;
    
    // Return cache if less than 5 minutes old
    if (age < CACHE_MAX_AGE) {
      console.log('Using cached widget templates');
      return data.templates;
    }
    
    // Cache is stale, but return it anyway as fallback
    console.log('Cache is stale, will refresh in background');
    return data.templates;
  } catch (error) {
    console.warn('Failed to load widget cache', error);
    return null;
  }
}

/**
 * Load container snapshot (always available, even if API is down)
 */
function loadContainerSnapshot() {
  try {
    const snapshot = localStorage.getItem(CONTAINERS_SNAPSHOT_KEY);
    if (!snapshot) return null;
    
    const data = JSON.parse(snapshot);
    const age = Date.now() - data.timestamp;
    
    // Return snapshot even if old (containers don't change often)
    if (age < SNAPSHOT_MAX_AGE) {
      console.log('Using container snapshot (age:', Math.round(age / 1000), 'seconds)');
      return data.containers;
    }
    
    console.log('Container snapshot is old but using as fallback');
    return data.containers;
  } catch (error) {
    console.warn('Failed to load container snapshot', error);
    return null;
  }
}

/**
 * Save container snapshot (called when API successfully returns data)
 */
function saveContainerSnapshot(containers) {
  try {
    const data = {
      timestamp: Date.now(),
      containers: containers
    };
    localStorage.setItem(CONTAINERS_SNAPSHOT_KEY, JSON.stringify(data));
    console.log('Saved container snapshot:', containers.length, 'containers');
  } catch (error) {
    console.warn('Failed to save container snapshot', error);
  }
}

/**
 * Save widget templates to cache
 */
function saveCachedTemplates(containersList) {
  try {
    const data = {
      timestamp: Date.now(),
      templates: {
        containers: containersList
      }
    };
    localStorage.setItem(WIDGET_CACHE_KEY, JSON.stringify(data));
    console.log('Saved widget templates to cache');
  } catch (error) {
    console.warn('Failed to save widget cache', error);
  }
}

/**
 * Fetch containers from API (with timeout)
 */
async function fetchContainers() {
  const metricsBase = WidgetComponents.getMetricsBase();
  
  return new Promise(async (resolve) => {
    const timeoutId = setTimeout(() => {
      console.warn('Containers API timeout (3s)');
      resolve(null); // Timeout - return null
    }, 3000);
    
    try {
      const response = await fetch(`${metricsBase}/api/containers`);
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.warn(`Containers API HTTP ${response.status}`);
        resolve(null);
        return;
      }
      
      const data = await response.json();
      console.log('Raw containers response:', data);
      
      // Handle both array and object responses
      let containers;
      if (Array.isArray(data)) {
        containers = data;
      } else if (data && Array.isArray(data.containers)) {
        // API returns {containers: [...]}
        containers = data.containers;
      } else {
        console.warn('Containers response format unknown:', typeof data);
        resolve(null);
        return;
      }
      
      console.log('Fetched containers:', containers.length);
      const containerList = containers.map(c => ({
        id: c.id || c.name,
        name: c.name || c.id
      }));
      
      // Save snapshot for future use
      saveContainerSnapshot(containerList);
      
      resolve(containerList);
    } catch (error) {
      clearTimeout(timeoutId);
      console.warn('Failed to fetch containers:', error.message);
      resolve(null); // Always resolve, never reject
    }
  });
}

/**
 * Populate widget categories with accordion (with caching)
 * Renders immediately with cached data, fetches fresh data in background
 */
function populateWidgetCategories() {
  const container = document.getElementById('widgetAccordion');
  if (!container) {
    console.warn('Widget accordion container not found');
    return;
  }
  
  // Wait for WidgetComponents to load (but don't block - render what we can)
  if (typeof WidgetComponents === 'undefined') {
    console.log('WidgetComponents not ready, retrying...');
    setTimeout(populateWidgetCategories, 100);
    return;
  }
  
  // Load container snapshot first (always available, even if API is down)
  const snapshot = loadContainerSnapshot();
  let containersList = snapshot || [];
  
  // Also try cached templates
  const cache = loadCachedTemplates();
  if (cache?.containers && cache.containers.length > 0) {
    containersList = cache.containers;
  }
  
  // Render with snapshot/cached data immediately (instant load)
  console.log('Rendering widget accordion with', containersList.length, 'containers from snapshot/cache');
  renderWidgetAccordion(container, containersList);
  
  // Fetch fresh data in background (don't await - non-blocking)
  fetchContainers().then(freshContainers => {
    if (freshContainers && freshContainers.length > 0) {
      console.log('Fresh containers fetched, updating UI');
      // Update cache
      saveCachedTemplates({ containers: freshContainers });
      
      // Re-render with fresh data
      renderWidgetAccordion(container, freshContainers);
    } else {
      console.log('No fresh containers, keeping snapshot');
    }
  }).catch(error => {
    console.warn('Failed to fetch fresh containers:', error);
  });
}

/**
 * Render widget accordion HTML
 * Renders immediately - doesn't wait for anything
 */
function renderWidgetAccordion(container, containersList) {
  if (!container) {
    console.warn('Cannot render accordion - container not found');
    return;
  }
  
  if (typeof WidgetComponents === 'undefined' || !WidgetComponents.categories) {
    console.warn('Cannot render accordion - WidgetComponents not ready');
    // Render empty state
    container.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--color-text-muted);">Loading widget categories...</div>';
    return;
  }
  
  const categories = WidgetComponents.categories;
  let accordionHtml = '';
  
  for (const [catKey, catData] of Object.entries(categories)) {
    let widgetsHtml = '';
    
    if (catKey === 'containers') {
      // Dynamic container widgets
      if (containersList && containersList.length > 0) {
        widgetsHtml = containersList.map(c => `
          <div class="widget-template" data-widget-id="container-${c.id}" data-container-name="${c.name}">
            <div class="widget-template__icon">🐳</div>
            <h4 class="widget-template__name">${c.name}</h4>
          </div>
        `).join('');
      } else {
        widgetsHtml = `
          <div style="text-align:center;padding:1.5rem;">
            <p style="color: var(--color-text-muted);font-size:0.9rem;margin:0 0 0.5rem;">No containers found</p>
            <p style="color: var(--color-text-muted);font-size:0.8rem;margin:0;">Visit <a href="/performance/index.html" style="color:var(--color-accent);">Performance page</a> to wake up metrics API</p>
          </div>
        `;
      }
    } else {
      // Static widgets
      widgetsHtml = catData.widgets.map(widgetId => {
        const widget = WidgetComponents[widgetId];
        if (!widget) return '';
        return `
          <div class="widget-template" data-widget-id="${widgetId}">
            <div class="widget-template__icon">${widget.icon}</div>
            <h4 class="widget-template__name">${widget.name}</h4>
            <p class="widget-template__description">${widget.description}</p>
          </div>
        `;
      }).join('');
    }
    
    accordionHtml += `
      <div class="widget-accordion-item" data-category="${catKey}">
        <div class="widget-accordion-header">
          <h3 class="widget-accordion-title">
            <span class="widget-accordion-icon">${catData.icon}</span>
            ${catData.name}
          </h3>
          <span class="widget-accordion-arrow">▶</span>
        </div>
        <div class="widget-accordion-body">
          <div class="widget-templates">
            ${widgetsHtml}
          </div>
        </div>
      </div>
    `;
  }
  
  container.innerHTML = accordionHtml;
  
  // Add accordion click handlers
  container.querySelectorAll('.widget-accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const item = header.closest('.widget-accordion-item');
      const wasOpen = item.classList.contains('is-open');
      
      // Close all accordions
      container.querySelectorAll('.widget-accordion-item').forEach(i => {
        i.classList.remove('is-open');
      });
      
      // Open clicked one if it wasn't open
      if (!wasOpen) {
        item.classList.add('is-open');
      }
    });
  });
  
  // Add widget template click handlers
  container.querySelectorAll('.widget-template').forEach(template => {
    template.addEventListener('click', () => {
      const widgetId = template.dataset.widgetId;
      const containerName = template.dataset.containerName;
      addWidget(widgetId, containerName);
      closeWidgetModal();
    });
  });
}

/**
 * Toggle edit mode (drag to reposition)
 */
function toggleEditMode() {
  isEditMode = !isEditMode;
  const btn = document.getElementById('editModeBtn');
  const gridElement = document.getElementById('dashboard-grid');
  
  if (isEditMode) {
    // Disable resize mode if active
    if (isResizeMode) {
      toggleResizeMode();
    }
    
    grid.enableMove(true);
    grid.enableResize(false);
    btn.innerHTML = '<span>✓ Done Editing</span>';
    btn.classList.add('is-active');
    gridElement.classList.add('edit-mode');
    
    // Show indicator
    const indicator = document.createElement('div');
    indicator.className = 'edit-mode-indicator';
    indicator.textContent = '✏️ Drag Mode - Reposition widgets';
    indicator.id = 'editModeIndicator';
    document.body.appendChild(indicator);
  } else {
    grid.enableMove(false);
    btn.innerHTML = '<span>✏️ Edit Layout</span>';
    btn.classList.remove('is-active');
    gridElement.classList.remove('edit-mode');
    
    // Remove indicator
    const indicator = document.getElementById('editModeIndicator');
    if (indicator) indicator.remove();
    
    saveDashboard();
  }
}

/**
 * Toggle resize mode (drag corners to resize)
 */
function toggleResizeMode() {
  isResizeMode = !isResizeMode;
  const btn = document.getElementById('resizeModeBtn');
  const gridElement = document.getElementById('dashboard-grid');
  
  if (isResizeMode) {
    // Disable edit mode if active
    if (isEditMode) {
      toggleEditMode();
    }
    
    grid.enableMove(false);
    grid.enableResize(true);
    btn.innerHTML = '<span>✓ Done Resizing</span>';
    btn.classList.add('is-active');
    gridElement.classList.add('resize-mode');
    
    // Show indicator
    const indicator = document.createElement('div');
    indicator.className = 'edit-mode-indicator';
    indicator.textContent = '⇔ Resize Mode - Drag widget corners';
    indicator.id = 'editModeIndicator';
    document.body.appendChild(indicator);
  } else {
    grid.enableResize(false);
    btn.innerHTML = '<span>⇔ Resize Widgets</span>';
    btn.classList.remove('is-active');
    gridElement.classList.remove('resize-mode');
    
    // Remove indicator
    const indicator = document.getElementById('editModeIndicator');
    if (indicator) indicator.remove();
    
    saveDashboard();
  }
}

/**
 * Update widget data (refresh without re-rendering entire widget)
 */
async function refreshWidget(widgetId, widgetType, containerName) {
  // Find widget by data-widget-id or data-widget-type (GridStack doesn't preserve IDs)
  let widgetElement = document.querySelector(`[data-widget-id="${widgetId}"]`);
  
  // If not found by data-widget-id, find by type (for container widgets, match container ID)
  if (!widgetElement) {
    if (widgetType.startsWith('container-')) {
      const containerId = widgetType.replace('container-', '');
      widgetElement = document.querySelector(`[data-widget-type^="container-"][data-container-id="${containerId}"]`);
    } else {
      // For system widgets, find by type (should only be one of each type)
      const widgets = document.querySelectorAll(`[data-widget-type="${widgetType}"]`);
      if (widgets.length === 1) {
        widgetElement = widgets[0];
      } else if (widgets.length > 1) {
        // Multiple widgets of same type - try to match by data-widget-id
        widgetElement = Array.from(widgets).find(w => w.dataset.widgetId === widgetId) || widgets[0];
      }
    }
  }
  
  if (!widgetElement) {
    console.warn(`[Widget Refresh] Widget element not found for ${widgetType} (${widgetId})`);
    return;
  }
  
  const gridItem = widgetElement.closest('.grid-stack-item');
  if (!gridItem) {
    console.warn(`[Widget Refresh] Grid item not found for widget`);
    return;
  }
  
  // Get the actual widget ID from the element (might be different from saved ID)
  const actualWidgetId = widgetElement.dataset.widgetId || widgetId;
  
  let config;
  if (widgetType.startsWith('container-')) {
    const containerId = widgetElement.dataset.containerId || widgetType.replace('container-', '');
    const name = containerName || widgetElement.querySelector('.widget__title')?.textContent?.trim() || containerId;
    config = WidgetComponents.createContainerWidget(containerId, name);
  } else {
    config = WidgetComponents[widgetType];
  }
  
  if (!config) {
    console.warn(`[Widget Refresh] Config not found for ${widgetType}`);
    return;
  }
  
  if (!config.update) {
    console.warn(`[Widget Refresh] Update method not found for ${widgetType}`);
    return;
  }
  
  try {
    await config.update(widgetElement, actualWidgetId);
    console.log(`[Widget Refresh] Successfully updated ${widgetType}`);
  } catch (error) {
    console.error(`[Widget Refresh] Failed to update ${widgetType}:`, error);
  }
}

/**
 * Start auto-refresh for a widget (like performance page)
 * Immediately wakes up the API, then starts intervals to keep it alive
 */
function startWidgetRefresh(widgetId, widgetType, containerName) {
  // Clear existing interval if any
  if (widgetIntervals.has(widgetId)) {
    clearInterval(widgetIntervals.get(widgetId));
  }
  
  // Only refresh system widgets (CPU, Memory, etc.) - same as performance page
  const refreshableWidgets = ['cpu-usage', 'memory-usage', 'cpu-temp', 'system-uptime'];
  const isRefreshable = refreshableWidgets.includes(widgetType) || widgetType.startsWith('container-');
  
  if (!isRefreshable) return;
  
  // Immediately wake up the API (like performance page does on load)
  console.log(`[Widget Refresh] Waking up API for ${widgetType}`);
  refreshWidget(widgetId, widgetType, containerName);
  
  // Refresh interval: 4 seconds for system, 6 seconds for containers (same as performance page)
  const interval = widgetType.startsWith('container-') ? 6000 : 4000;
  
  const intervalId = setInterval(() => {
    refreshWidget(widgetId, widgetType, containerName);
  }, interval);
  
  widgetIntervals.set(widgetId, intervalId);
  console.log(`[Widget Refresh] Started auto-refresh for ${widgetType} (${interval}ms)`);
}

/**
 * Stop auto-refresh for a widget
 */
function stopWidgetRefresh(widgetId) {
  if (widgetIntervals.has(widgetId)) {
    clearInterval(widgetIntervals.get(widgetId));
    widgetIntervals.delete(widgetId);
    console.log(`[Widget Refresh] Stopped auto-refresh for ${widgetId}`);
  }
}

/**
 * Add a data widget to the grid
 */
async function addWidget(widgetType, containerName) {
  console.log('Adding widget:', widgetType, containerName);
  
  let config;
  
  // Handle container widgets
  if (widgetType.startsWith('container-')) {
    const containerId = widgetType.replace('container-', '');
    config = WidgetComponents.createContainerWidget(containerId, containerName);
  } else {
    config = WidgetComponents[widgetType];
  }
  
  if (!config) {
    console.error('Widget config not found for:', widgetType);
    return;
  }
  
  const widgetId = `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const { w, h } = config.defaultSize;
  
  console.log('Creating widget with ID:', widgetId, 'size:', w, 'x', h);
  
  // Add placeholder first
  const gridItem = grid.addWidget({
    w,
    h,
    content: '<div style="padding:1.25rem;color:var(--color-text-muted);">Loading...</div>',
    id: widgetId
  });
  
  if (!gridItem) {
    console.error('Failed to add widget to grid');
    return;
  }
  
  console.log('Widget added to grid, rendering content...');
  
  // Render widget content
  const html = await config.render(widgetId);
  const contentDiv = gridItem.querySelector('.grid-stack-item-content');
  if (contentDiv) {
    contentDiv.innerHTML = html;
    console.log('Widget content rendered');
    
    // Start auto-refresh (like performance page)
    startWidgetRefresh(widgetId, widgetType, containerName);
  } else {
    console.error('Content div not found');
  }
  
  // Save after a short delay to ensure DOM is updated
  setTimeout(() => {
    saveDashboard();
    updateEmptyState();
  }, 100);
}

/**
 * Add a link widget
 */
async function addLinkWidget() {
  const urlInput = document.getElementById('linkUrl');
  const titleInput = document.getElementById('linkTitle');
  
  let url = urlInput.value.trim();
  let title = titleInput.value.trim();
  
  if (!url) {
    alert('Please enter a URL');
    return;
  }
  
  // Add https:// if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  // Extract domain for title if not provided
  if (!title) {
    try {
      const urlObj = new URL(url);
      title = urlObj.hostname.replace('www.', '');
    } catch (e) {
      title = 'Link';
    }
  }
  
  // Get favicon from Google
  let domain;
  try {
    const urlObj = new URL(url);
    domain = urlObj.hostname;
  } catch (e) {
    domain = 'example.com';
  }
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  
  const widgetId = `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const html = `
    <a href="${url}" target="_blank" class="widget widget--link" data-widget-type="link" data-url="${url}">
      <div class="widget__actions" style="position:absolute;top:0.5rem;right:0.5rem;">
        <button class="widget__action-btn" onclick="event.preventDefault();removeWidget(this)">✕</button>
      </div>
      <img src="${faviconUrl}" class="link-favicon" onerror="this.style.display='none'">
      <h3 class="widget__title">${title}</h3>
    </a>
  `;
  
  grid.addWidget({
    w: 2,
    h: 2,
    content: html,
    id: widgetId
  });
  
  // Clear inputs
  urlInput.value = '';
  titleInput.value = '';
  
  closeLinkModal();
  saveDashboard();
  updateEmptyState();
}

/**
 * Remove a widget
 */
function removeWidget(button) {
  const gridItem = button.closest('.grid-stack-item');
  if (gridItem) {
    const widgetId = gridItem.id;
    
    // Stop auto-refresh
    stopWidgetRefresh(widgetId);
    
    // Clean up chart if exists
    if (widgetCharts.has(widgetId)) {
      const chart = widgetCharts.get(widgetId);
      if (chart && chart.destroy) {
        chart.destroy();
      }
      widgetCharts.delete(widgetId);
    }
    
    // Clean up data history
    if (widgetDataHistory.has(widgetId)) {
      widgetDataHistory.delete(widgetId);
    }
    
    grid.removeWidget(gridItem);
    saveDashboard();
    updateEmptyState();
  }
}

// Make removeWidget global for onclick handlers
window.removeWidget = removeWidget;

/**
 * Extract widget data for saving
 */
function extractWidgetData(widget, item) {
  const widgetType = widget.dataset.widgetType;
  console.log('Saving widget:', widgetType, 'at', item.x, item.y);
  
  const baseData = {
    id: item.id,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    type: widgetType
  };
  
  // For link widgets, save URL and title
  if (widgetType === 'link') {
    const url = widget.dataset.url || widget.href;
    const title = widget.querySelector('.widget__title')?.textContent?.trim() || 'Link';
    const favicon = widget.querySelector('.link-favicon')?.src;
    
    return {
      ...baseData,
      url,
      title,
      favicon
    };
  }
  
  // For container widgets, save container ID
  if (widgetType.startsWith('container-')) {
    const containerId = widget.dataset.containerId;
    // Extract container name from title, removing emoji if present
    let containerName = widget.querySelector('.widget__title')?.textContent?.trim() || '';
    // Remove emoji from container name (🐳 and any leading/trailing whitespace)
    containerName = containerName.replace(/^🐳\s*/, '').trim();
    
    return {
      ...baseData,
      containerId,
      containerName
    };
  }
  
  // For data widgets, just save type
  return baseData;
}

/**
 * Save dashboard layout to localStorage
 */
function saveDashboard() {
  const items = grid.save(false);
  console.log('Saving dashboard with', items.length, 'items');
  console.log('Grid items:', items);
  
  const widgetsData = items.map(item => {
    // GridStack might store ID differently - try multiple methods
    let element = document.getElementById(item.id);
    
    // If not found, try finding by grid-stack-item with matching ID attribute
    if (!element) {
      const gridItems = document.querySelectorAll('.grid-stack-item');
      for (const gridItem of gridItems) {
        if (gridItem.id === item.id || gridItem.getAttribute('gs-id') === item.id) {
          element = gridItem;
          break;
        }
      }
    }
    
    // Last resort: find by position (x, y, w, h match)
    if (!element) {
      const gridItems = document.querySelectorAll('.grid-stack-item');
      for (const gridItem of gridItems) {
        const gsX = parseInt(gridItem.getAttribute('gs-x')) || 0;
        const gsY = parseInt(gridItem.getAttribute('gs-y')) || 0;
        const gsW = parseInt(gridItem.getAttribute('gs-w')) || 1;
        const gsH = parseInt(gridItem.getAttribute('gs-h')) || 1;
        
        if (gsX === item.x && gsY === item.y && gsW === item.w && gsH === item.h) {
          element = gridItem;
          console.log('Found widget by position match:', item.id);
          break;
        }
      }
    }
    
    if (!element) {
      console.warn('Element not found for item:', item.id, 'trying to find by content...');
      // Try one more time after a brief delay (DOM might not be ready)
      return null;
    }
    
    const widget = element.querySelector('[data-widget-type]');
    if (!widget) {
      // Widget might be the element itself (for link widgets)
      if (element.hasAttribute('data-widget-type')) {
        return extractWidgetData(element, item);
      }
      console.warn('Widget element not found in:', item.id);
      return null;
    }
    
    return extractWidgetData(widget, item);
  }).filter(widget => {
    if (widget === null) {
      console.warn('Filtered out null widget');
      return false;
    }
    return true;
  });
  
  console.log('Saving', widgetsData.length, 'widgets to localStorage');
  console.log('Widget data:', JSON.stringify(widgetsData, null, 2));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widgetsData));
  console.log('Dashboard saved successfully');
  
  // Verify it was saved
  const verify = localStorage.getItem(STORAGE_KEY);
  console.log('Verified saved data:', verify ? JSON.parse(verify).length + ' widgets' : 'FAILED TO SAVE');
}

/**
 * Load dashboard layout from localStorage
 */
async function loadDashboard() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    console.log('No saved dashboard layout');
    return;
  }
  
  try {
    const widgetsData = JSON.parse(saved);
    console.log('Loading dashboard with', widgetsData.length, 'widgets');
    
    // Wait for WidgetComponents to load
    if (typeof WidgetComponents === 'undefined') {
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (typeof WidgetComponents !== 'undefined') {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }
    
    for (const widget of widgetsData) {
      if (widget.type === 'link') {
        // Restore link widget
        const html = `
          <a href="${widget.url}" target="_blank" class="widget widget--link" data-widget-type="link" data-url="${widget.url}">
            <div class="widget__actions" style="position:absolute;top:0.5rem;right:0.5rem;">
              <button class="widget__action-btn" onclick="event.preventDefault();removeWidget(this)">✕</button>
            </div>
            <img src="${widget.favicon}" class="link-favicon" onerror="this.style.display='none'">
            <h3 class="widget__title">${widget.title}</h3>
          </a>
        `;
        
        grid.addWidget({
          x: widget.x,
          y: widget.y,
          w: widget.w,
          h: widget.h,
          content: html,
          id: widget.id
        });
      } else if (widget.type.startsWith('container-')) {
        // Restore container widget
        const containerId = widget.containerId || widget.type.replace('container-', '');
        const containerName = widget.containerName || containerId;
        
        console.log('Restoring container widget:', containerName);
        
        // Add placeholder first
        const gridItem = grid.addWidget({
          x: widget.x,
          y: widget.y,
          w: widget.w,
          h: widget.h,
          content: '<div style="padding:1.25rem;color:var(--color-text-muted);">Loading...</div>',
          id: widget.id
        });
        
        // Render widget content (use saved widget.id, not GridStack's ID)
        const config = WidgetComponents.createContainerWidget(containerId, containerName);
        const html = await config.render(widget.id);
        const contentDiv = gridItem.querySelector('.grid-stack-item-content');
        contentDiv.innerHTML = html;
        
        // Ensure data-widget-id is set on the widget element
        const widgetElement = contentDiv.querySelector('[data-widget-type]');
        if (widgetElement && !widgetElement.dataset.widgetId) {
          widgetElement.dataset.widgetId = widget.id;
        }
        
        // Start auto-refresh for container widget (use saved widget.id)
        startWidgetRefresh(widget.id, widget.type, containerName);
      } else {
        // Restore data widget
        console.log('Restoring widget:', widget.type);
        
        const config = WidgetComponents[widget.type];
        if (config) {
          // Add placeholder first
          const gridItem = grid.addWidget({
            x: widget.x,
            y: widget.y,
            w: widget.w,
            h: widget.h,
            content: '<div style="padding:1.25rem;color:var(--color-text-muted);">Loading...</div>',
            id: widget.id
          });
          
        // Render widget content (use saved widget.id, not GridStack's ID)
        const html = await config.render(widget.id);
        const contentDiv = gridItem.querySelector('.grid-stack-item-content');
        contentDiv.innerHTML = html;
        
        // Ensure data-widget-id is set on the widget element
        const widgetElement = contentDiv.querySelector('[data-widget-type]');
        if (widgetElement && !widgetElement.dataset.widgetId) {
          widgetElement.dataset.widgetId = widget.id;
        }
        
        // Start auto-refresh (use saved widget.id)
        startWidgetRefresh(widget.id, widget.type, null);
        } else {
          console.warn('Unknown widget type:', widget.type);
        }
      }
    }
    
    console.log('Dashboard loaded successfully');
    
    updateEmptyState();
  } catch (error) {
    console.error('Failed to load dashboard:', error);
    console.error('Error details:', error.stack);
  }
}

/**
 * Update empty state visibility
 */
function updateEmptyState() {
  const emptyState = document.getElementById('dashboardEmpty');
  const hasWidgets = grid.getGridItems().length > 0;
  
  if (hasWidgets) {
    emptyState.classList.add('hidden');
  } else {
    emptyState.classList.remove('hidden');
  }
}

/**
 * Open widget modal
 */
function openWidgetModal() {
  const modal = document.getElementById('widgetModal');
  if (modal) {
    // Ensure categories are populated (in case modal opened before init completed)
    if (typeof WidgetComponents !== 'undefined') {
      const container = document.getElementById('widgetAccordion');
      if (container && container.children.length === 0) {
        console.log('Widget accordion empty, populating now...');
        populateWidgetCategories();
      }
    }
    modal.setAttribute('aria-hidden', 'false');
  }
}

/**
 * Close widget modal
 */
function closeWidgetModal() {
  const modal = document.getElementById('widgetModal');
  modal.setAttribute('aria-hidden', 'true');
}

/**
 * Open link modal
 */
function openLinkModal() {
  const modal = document.getElementById('linkModal');
  modal.setAttribute('aria-hidden', 'false');
  // Focus on URL input
  setTimeout(() => {
    document.getElementById('linkUrl').focus();
  }, 100);
}

/**
 * Close link modal
 */
function closeLinkModal() {
  const modal = document.getElementById('linkModal');
  modal.setAttribute('aria-hidden', 'true');
  // Clear inputs
  document.getElementById('linkUrl').value = '';
  document.getElementById('linkTitle').value = '';
}

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeWidgetModal();
    closeLinkModal();
  }
});
