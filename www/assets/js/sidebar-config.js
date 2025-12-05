window.NavigationConfig = {
  topNav: [
    { key: 'home', label: 'Dashboard', href: '/home/index.html' },
    { key: 'performance', label: 'Performance', href: '/performance/index.html' },
    { key: 'apps', label: 'Apps', href: '/apps/index.html' },
    { key: 'crypto', label: 'Crypto', href: '/crypto/index.html' },
    { key: 'games', label: 'Games', href: '/games/index.html' },
    { key: '3d-printing', label: '3D Printing', href: '/3d-printing/index.html' }
  ],
  sideNav: {
    home: [
      { label: 'Dashboard', href: '/home/index.html' }
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
    games: [
      { label: 'Browse Games', href: '/games/index.html' },
      { label: 'News', href: '/games/news/index.html' },
      { label: 'Favorites', href: '/games/news/index.html?filter=favorites' },
      { label: 'Tech', href: '/games/news/index.html?filter=tech' },
      { label: 'Gaming', href: '/games/news/index.html?filter=gaming' },
      { label: 'Patch Notes', href: '/games/patch-notes/index.html' },
      { label: 'Sample Category', href: '/games/categories/sample.html' },
      { label: 'Story Card Preset', href: '/games/presets/story-card.html' }
    ],
    '3d-printing': [
      { label: 'Profile Overview', href: '/3d-printing/index.html' },
      { label: 'Cost Calculator', href: '/3d-printing/calculator.html' }
    ]
  }
};
