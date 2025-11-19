# Setting Up API Proxy for MakerWorld Data

## Current Status
✅ **LIVE DATA ENABLED** - The 3D printing profile page now displays live data from MakerWorld via the `/release-api/api/makerworld/profile` endpoint.

## Configuration

### Nginx Proxy Manager Custom Config
The proxy configuration is in `/home/insaint/Containers/NginxProxyManager/data/nginx/custom/server_proxy.conf`

**⚠️ Important Note on Editing:**
Due to volume mount sync issues, when editing Nginx Proxy Manager config files:
1. **Preferred method**: Edit directly in the container:
   ```bash
   docker exec -it nginx-proxy-manager nano /data/nginx/custom/server_proxy.conf
   ```
2. **After editing**: Always reload Nginx:
   ```bash
   docker exec nginx-proxy-manager nginx -t && docker exec nginx-proxy-manager nginx -s reload
   ```
3. **If editing on host**: The file is at `/home/insaint/Containers/NginxProxyManager/data/nginx/custom/server_proxy.conf`, but you may need to restart the container for changes to take effect:
   ```bash
   docker restart nginx-proxy-manager
   ```

### Current Configuration
The `/release-api/` location block proxies requests to `webscraper-api:8000`:
- Endpoint: `https://rubberrobo.nl/release-api/api/makerworld/profile`
- Returns: JSON with profile stats (models, downloads, likes, followers)

### Testing
Test the API endpoint:
```bash
curl https://rubberrobo.nl/release-api/api/makerworld/profile
```

## Alternative: Manual Updates
If you want to use hardcoded data instead:
1. Edit `/home/insaint/Containers/webserver/www/assets/js/pages/3d-printing.js`
2. Update the `profileData` object with your real stats
3. The numbers will show immediately without any API calls

