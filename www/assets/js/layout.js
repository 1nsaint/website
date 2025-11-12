(function () {
  const config = window.NavigationConfig || {};
  const body = document.body;
  const sidebar = document.getElementById('sidebar');
  const sidebarNav = document.getElementById('sidebar-nav');
  const sidebarHeading = document.getElementById('sidebar-section-title');
  const topbarNav = document.getElementById('topbar-nav');
  const collapseButton = document.getElementById('sidebar-toggle');

  if (!body || !sidebar || !sidebarNav || !topbarNav || !collapseButton) {
    return;
  }

  body.classList.add('layout-shell');

  function resolveSection(pathname) {
    if (pathname === '/' || pathname === '/index.html') {
      return 'home';
    }
    if (pathname.startsWith('/performance')) {
      return 'performance';
    }
    if (pathname.startsWith('/apps')) {
      return 'apps';
    }
    if (pathname.startsWith('/news')) {
      return 'news';
    }
    if (pathname.startsWith('/home')) {
      return 'home';
    }
    return 'home';
  }

  const normalizedPath = window.location.pathname.replace(/index\.html$/, '') || '/';
  const activeSection = resolveSection(window.location.pathname);

  function renderTopNav() {
    if (!Array.isArray(config.topNav)) {
      return;
    }
    topbarNav.innerHTML = '';
    config.topNav.forEach((item) => {
      const link = document.createElement('a');
      link.href = item.href;
      link.className = 'topbar__nav-link';
      link.textContent = item.label;
      const itemPath = item.href.replace(/index\.html$/, '');
      if (normalizedPath === itemPath || activeSection === item.key) {
        link.classList.add('is-active');
      }
      topbarNav.appendChild(link);
    });
  }

  function renderSidebar() {
    const entries = (config.sideNav && config.sideNav[activeSection]) || [];
    sidebarNav.innerHTML = '';
    entries.forEach((item) => {
      const link = document.createElement('a');
      link.href = item.href;
      link.className = 'sidebar__link';
      link.textContent = item.label;
      const normalizedHref = item.href.replace(/index\.html$/, '');
      if (normalizedPath === normalizedHref || window.location.pathname === item.href) {
        link.classList.add('is-active');
      }
      sidebarNav.appendChild(link);
    });
    if (sidebarHeading) {
      const activeTopNav = (config.topNav || []).find((item) => item.key === activeSection);
      sidebarHeading.textContent = activeTopNav ? activeTopNav.label : '';
    }
  }

  renderTopNav();
  renderSidebar();

  const mobileQuery = window.matchMedia('(max-width: 1024px)');

  function handleToggle() {
    if (mobileQuery.matches) {
      const isOpen = sidebar.classList.toggle('is-open');
      if (isOpen) {
        body.classList.remove('sidebar-collapsed');
      }
    } else {
      const collapsed = body.classList.toggle('sidebar-collapsed');
      if (collapsed) {
        sidebar.classList.remove('is-open');
      }
    }
  }

  collapseButton.addEventListener('click', handleToggle);

  document.addEventListener('click', (event) => {
    if (!sidebar.classList.contains('is-open')) {
      return;
    }
    if (!sidebar.contains(event.target) && event.target !== collapseButton) {
      sidebar.classList.remove('is-open');
    }
  });

  mobileQuery.addEventListener('change', () => {
    if (!mobileQuery.matches) {
      sidebar.classList.remove('is-open');
    }
  });
})();
