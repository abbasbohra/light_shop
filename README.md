# LightShop Web

Web version of LightShopApp (React + Vite + TypeScript). It uses the **same Supabase project**, database and edge functions as the mobile app, so both can run side by side.

## Run it
```bash
npm install
cp .env.example .env     # then fill in your Supabase URL and anon key (same values as the mobile app's .env)
npm run dev              # http://localhost:5173
npm run build            # production build in dist/
```
Camera, barcode scanning and GPS need **HTTPS** (localhost is fine while developing). Netlify, Vercel, Cloudflare Pages and Supabase hosting all give you HTTPS. `public/_redirects` makes page refreshes work on Netlify; on Vercel add a rewrite of `/(.*)` to `/`.

## One required change in Supabase: CORS on edge functions
A browser, unlike the phone app, sends a preflight request to edge functions. `admin-users` and `embed-image` must answer it, or photo search, adding product photos, and the Users screen will fail with a CORS error. At the top of each function:

```ts
const cors = {
  'Access-Control-Allow-Origin': '*',   // or your site URL
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  // ...existing code...
  // and add ...cors to the headers of every Response you return
});
```
Then run `supabase functions deploy admin-users embed-image`.

## What changed from the mobile app
| Mobile | Web |
|---|---|
| React Navigation stacks/tabs | react-router-dom, tabs in `components/Layout.tsx` (bottom bar on phones, side bar on desktop) |
| StyleSheet | `src/styles.css` (same colours as CSS variables) |
| vision-camera barcode | `components/BarcodeScanner.tsx`: native `BarcodeDetector`, ZXing fallback |
| image-picker | `lib/image.ts`: camera/gallery via file input, resized to JPEG |
| Geolocation | `navigator.geolocation` |
| Alert | `window.alert` / `confirm` (`lib/dialog.ts`) |
| AsyncStorage | localStorage (supabase-js default) |

`lib/api.ts` and `lib/config.ts` are unchanged.

## Known differences
- **Tabs per role were inferred** (BottomStack was not provided): admin = Admin, Scan, Search, Add; store = Scan, Search, Add, Stock; sales = Scan, Search, Deliveries; delivery = Deliveries. Edit `tabsFor()` in `components/Layout.tsx` if yours differ.
- Short Google Maps links (`maps.app.goo.gl`) cannot be resolved in a browser. Paste the full link or `lat,lng`.
- The "must be within 200 m" delivery check works best on a phone; desktop browsers give rough locations.
- iPhone/Safari has no `BarcodeDetector`, so ZXing is used (slightly slower).
