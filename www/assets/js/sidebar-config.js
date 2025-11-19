window.NavigationConfig = {
  topNav: [
    { key: 'home', label: 'Home', href: '/index.html' },
    { key: 'performance', label: 'Performance', href: '/performance/index.html' },
    { key: 'apps', label: 'Apps', href: '/apps/index.html' },
    { key: 'crypto', label: 'Crypto', href: '/crypto/index.html' },
    { key: 'news', label: 'News', href: '/news/index.html' },
    { key: '3d-printing', label: '3D Printing', href: '/3d-printing/index.html' }
  ],
  sideNav: {
    home: [
      { label: 'Overview', href: '/index.html' },
      { label: 'Widget Preset', href: '/home/presets/card-empty.html' }
    ],
    performance: [
      { label: 'System Overview', href: '/performance/index.html' },
      { label: 'Docker Containers', href: '/performance/containers.html' }
    ],
    apps: [
      { label: 'Apps Overview', href: '/apps/index.html' },
      { label: 'WiFi PC Remote', href: '/apps/remote/index.html' },
      { label: 'App Card Preset', href: '/apps/presets/app-card.html' }
    ],
    crypto: [
      { label: 'Market Overview', href: '/crypto/index.html' },
      { label: 'Preset Card', href: '/crypto/presets/card.html' }
    ],
    news: [
      { label: 'Headlines', href: '/news/index.html?filter=all' },
      { label: 'Favorites', href: '/news/index.html?filter=favorites' },
      { label: 'Tech', href: '/news/index.html?filter=tech' },
      { label: 'Gaming', href: '/news/index.html?filter=gaming' },
      { label: 'Patch Notes', href: '/news/patch-notes/index.html' },
      { label: 'Sample Category', href: '/news/categories/sample.html' },
      { label: 'Story Card Preset', href: '/news/presets/story-card.html' }
    ],
    '3d-printing': [
      { label: 'Profile Overview', href: '/3d-printing/index.html' },
      { label: 'Cost Calculator', href: '/3d-printing/calculator.html' }
    ]
  }
};
