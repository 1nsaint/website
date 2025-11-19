(() => {
  const profileName = document.getElementById('profileName');
  const profileBio = document.getElementById('profileBio');
  const profileAvatar = document.getElementById('profileAvatar');
  const statModels = document.getElementById('statModels');
  const statDownloads = document.getElementById('statDownloads');
  const statLikes = document.getElementById('statLikes');
  const statFollowers = document.getElementById('statFollowers');
  const modelsGrid = document.getElementById('modelsGrid');

  // Placeholder data - MakerWorld doesn't have a public API
  // You can manually update these stats by editing this file
  // Or set up a backend scraper using tools like Apify
  const profileData = {
    name: 'Insaint',
    bio: 'Maker & 3D Printing Enthusiast',
    avatar: '/assets/pictures/icons/android-pc-remote-icon.png',
    stats: {
      models: 12,  // Update these values manually
      downloads: 245,
      likes: 89,
      followers: 34
    },
    models: [
      // Add your models here manually, example:
      // {
      //   title: 'Your Model Name',
      //   description: 'Model description',
      //   image: 'https://example.com/image.jpg',
      //   downloads: 50,
      //   likes: 15,
      //   url: 'https://makerworld.com/en/models/xxxxx'
      // }
    ]
  };

  // Try to fetch profile data from the webscraper API
  const loadProfileData = async () => {
    try {
      // Use the same proxy path as the release calendar
      const response = await fetch('/release-api/api/makerworld/profile', {
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[3D Printing] Loaded live profile data:', data);
        return data;
      }
    } catch (error) {
      console.log('[3D Printing] API unavailable, using placeholder data:', error.message);
    }
    
    return profileData;
  };

  // Render profile information
  const renderProfile = (data) => {
    profileName.textContent = data.name || 'Insaint';
    profileBio.textContent = data.bio || 'MakerWorld Creator';
    
    if (data.avatar && data.avatar !== profileData.avatar) {
      profileAvatar.src = data.avatar;
    }

    // Render stats
    statModels.textContent = data.stats.models > 0 ? data.stats.models.toLocaleString() : '—';
    statDownloads.textContent = data.stats.downloads > 0 ? data.stats.downloads.toLocaleString() : '—';
    statLikes.textContent = data.stats.likes > 0 ? data.stats.likes.toLocaleString() : '—';
    statFollowers.textContent = data.stats.followers > 0 ? data.stats.followers.toLocaleString() : '—';
  };

  // Render models grid
  const renderModels = (models) => {
    if (!models || models.length === 0) {
      modelsGrid.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
          <h3 style="margin: 0 0 1rem 0; color: var(--color-text);">No Models Yet</h3>
          <p class="muted">Models from your MakerWorld profile will appear here.</p>
          <p class="muted" style="margin-top: 1rem; font-size: 0.9rem;">
            Note: MakerWorld doesn't provide a public API. To display your models here, 
            you'll need to set up a backend scraper or manually update the data.
          </p>
          <a class="action-button" href="https://makerworld.com/en/@insaint" target="_blank" rel="noopener" style="margin-top: 1.5rem; display: inline-flex;">
            Visit MakerWorld Profile
          </a>
        </div>
      `;
      return;
    }

    modelsGrid.innerHTML = '';
    models.forEach(model => {
      const card = document.createElement('article');
      card.className = 'card model-card';

      if (model.image) {
        const imageDiv = document.createElement('div');
        imageDiv.className = 'model-card__image';
        const img = document.createElement('img');
        img.src = model.image;
        img.alt = model.title;
        img.loading = 'lazy';
        imageDiv.appendChild(img);
        card.appendChild(imageDiv);
      }

      const info = document.createElement('div');
      info.className = 'model-card__info';

      const title = document.createElement('h3');
      title.className = 'model-card__title';
      title.textContent = model.title;
      info.appendChild(title);

      if (model.description) {
        const desc = document.createElement('p');
        desc.className = 'muted';
        desc.textContent = model.description.length > 100 
          ? model.description.substring(0, 100) + '...' 
          : model.description;
        info.appendChild(desc);
      }

      const meta = document.createElement('div');
      meta.className = 'model-card__meta';
      
      if (model.downloads) {
        const downloads = document.createElement('span');
        downloads.className = 'model-card__meta-item';
        downloads.innerHTML = `⬇️ ${model.downloads.toLocaleString()}`;
        meta.appendChild(downloads);
      }
      
      if (model.likes) {
        const likes = document.createElement('span');
        likes.className = 'model-card__meta-item';
        likes.innerHTML = `❤️ ${model.likes.toLocaleString()}`;
        meta.appendChild(likes);
      }
      
      info.appendChild(meta);

      if (model.url) {
        const link = document.createElement('a');
        link.className = 'action-button action-button--outline';
        link.href = model.url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'View Model';
        link.style.marginTop = '0.5rem';
        link.style.alignSelf = 'flex-start';
        info.appendChild(link);
      }

      card.appendChild(info);
      modelsGrid.appendChild(card);
    });
  };

  // Initialize page
  const init = async () => {
    const data = await loadProfileData();
    renderProfile(data);
    renderModels(data.models);
  };

  init();
})();

