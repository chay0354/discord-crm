# Meme Stock CRM

React admin dashboard for the Discord stock game bot.

## Local

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to `127.0.0.1:8000` when `VITE_API_URL` is empty.

Set `VITE_ADMIN_API_KEY` to match the bot server `CRM_ADMIN_API_KEY`.

## Vercel

Root directory: repo root. Set `VITE_API_URL` to your Railway bot URL.
