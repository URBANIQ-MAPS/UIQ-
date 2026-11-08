# UrbanIQ Anmoldeep – Plot Viewer, Backend & Admin

Two ways to publish. Pick one.

## A) Quick: single file, no admin  (`standalone/index.html`)
Upload `standalone/index.html` to any hosting (cPanel, Netlify, GitHub Pages, S3…) and point your domain at it.
Everything (plan, logos, 14 renders) is inside that one file. Plot status is edited by asking us to rebuild, or by the
`D.status` object in the file. WhatsApp number: search for `919996661797` and replace.

## B) Full: website + admin panel (`server/`)
Needs Node.js 18+ (no `npm install` needed – zero dependencies).

```
cd server
ADMIN_PASSWORD="choose-a-strong-password" PORT=3000 node server.js
```
* Website:  http://localhost:3000/
* Admin:    http://localhost:3000/admin.html   (sign in with ADMIN_PASSWORD)

In the admin you can: mark plots **available / booked / sold**, set prices, upload / re-order / delete gallery photos,
add / edit / delete nearby places (name, category, latitude, longitude, km), and change the WhatsApp number.
Changes are stored in `server/data/*.json` and `server/public/uploads/`. **Back those two up regularly.**

### Put it on your domain (example: Ubuntu VPS, any provider)
1. Install Node 18+ and copy the `server/` folder to e.g. `/var/www/anmoldeep/`.
2. Keep it running with PM2:
   `npm i -g pm2 && ADMIN_PASSWORD="…" PORT=3000 pm2 start server.js --name anmoldeep && pm2 save && pm2 startup`
3. Point your domain's A record at the server and put Nginx or Caddy in front for HTTPS. Nginx example:
   ```
   server { server_name plots.yourdomain.com; location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; client_max_body_size 30m; } }
   ```
   then `certbot --nginx -d plots.yourdomain.com` for a free HTTPS certificate.
4. Managed hosts (Render, Railway, Fly.io…): create a Node web service, start command `node server.js`, set the
   `ADMIN_PASSWORD` environment variable, and attach a persistent disk mounted at `server/data` and `server/public/uploads`
   (otherwise uploads and status changes are lost on redeploy). Then add your custom domain in their dashboard.

Always use HTTPS in production (the admin password travels in each login request).
Behind Nginx/Caddy also set `TRUST_PROXY=1` so the login rate-limit counts each visitor's real IP instead of treating everyone as `127.0.0.1`.

## Map notes
* Map is locked to the Bengaluru region (`BOUNDS` near the top of the script in `index.html`).
* Basemap: Esri World Imagery + OpenFreeMap vector labels (free, no key). For heavy commercial traffic or the exact
  Google look, switch to a keyed provider (Google Maps Platform / Mapbox / MapTiler) – ask us to port it.
* **3D master plan:** tapping **3D** plays an X-ray scan that sweeps the rendered plan in from the left (about 1.7 s) while the map tilts to 44 degrees facing north. Tapping **2D** again crossfades back to the original flat master plan (with its own plot shapes); tapping **3D** again replays the scan. The render is `assets/plan3d.webp` (3400 px wide, nothing cropped). It is shown exactly as drawn so it keeps its 3D look; while tilted, the plan is stretched north-south by 1/cos(tilt) so the render keeps its proportions instead of looking flat. Plot taps, highlights and measurements use the render's own plot shapes, so they line up with what you see. The render sits about 3.7 m (average) from the old flat plan's plot positions. If you replace the render, send it to us so we can re-place it.
* **Touch:** tap a plot to select it (red boundary, side measurements, sq ft). Panning, pinching and two-finger rotate/tilt never select by accident. Double-tap on empty map zooms in. To go back to the old double-tap-to-select behaviour set `TAP_SELECT=false` in `index.html`. On phones the bottom dock hides while a plot card is open so the plot has room; close the card (×) to bring it back.
* Plan placement fine-tune: open `index.html?adjust`, nudge with the on-screen arrows, press **Copy values**, send them to us.
* Map and imagery credits (OpenStreetMap, OpenFreeMap, Esri/Maxar) are listed in the Info panel. Keep them there – they are part of the data licences.
* The UrbanIQ Ventures office pin is approximate (flagged); set its exact coordinates in Admin → Amenities.

## Folder map
```
standalone/index.html        single-file viewer
server/server.js             backend (API + static hosting)
server/package.json
server/data/config.json      plots (status, price), WhatsApp, gallery list
server/data/amenities.json   nearby places
server/public/index.html     viewer (talks to /api/config)
server/public/admin.html     admin panel
server/public/assets/        logo, wordmark, master plan
server/public/uploads/gallery/  gallery photos
source-assets/               your original files (plan, logos, renders, KML, fact sheet)
```
