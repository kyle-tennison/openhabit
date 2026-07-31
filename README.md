<p align="center">
  <img src="client/public/logo.png" width="72" alt="">
</p>

<h1 align="center">openhabit</h1>

Habit and mood tracking. React + Vite frontend, thin Express BFF, MongoDB Atlas.
Live at [openhabit.co](https://openhabit.co).

Open source, free, and ad-free — no trackers, no upsells, nothing sold on. Hosting
is paid for by [donations](https://www.paypal.com/donate/?business=54HEQEQEAT2M8&no_recurring=0&item_name=Help+pay+for+openhabit+hosting+to+keep+it+free+and+witout+ads.&currency_code=USD).
Everything needed to self-host is in this repo.

Issues and bug reports: [support@openhabit.co](mailto:support@openhabit.co).

## Running it

```bash
npm start --prefix server
```

```bash
npm run dev --prefix client
```

Open http://localhost:5173. Vite proxies `/api` to the BFF on :4000, so the browser
never sees the Mongo connection string. Config goes in `server/.env` — see
`server/.env.example`.

## Layout

```
server/     Express BFF. Owns the Mongo connection and secrets.
  src/      env.js, db.js, auth.js (JWT), index.js (routes)
client/     React + Vite. Never talks to Mongo directly.
  src/      App.jsx, Auth.jsx, HabitGrid.jsx, MoodChart.jsx, dates.js
```

## How it works

- **Auth** — email + password, bcrypt-hashed. Client holds a 30-day JWT in
  `localStorage`; every route but register/login requires it, and every query is
  scoped to the token's user id.
- **Habits** — up to 100. A 30-day grid, one row per habit. Click a cell to toggle,
  the name to rename, `×` to delete. `‹` `›` page back through earlier windows.
- **Mood** — 1–10 over the same 30 days. Click to set, drag to adjust, shift-click to
  clear. The line breaks across unrated days instead of interpolating.

Writes are optimistic and roll back if the server rejects them. Dates are stored as
local-time `YYYY-MM-DD` strings so a day never shifts across a timezone.

## Data model

| Collection | Fields | Unique index |
|---|---|---|
| `users` | `email`, `passwordHash` | `email` |
| `habits` | `userId`, `name`, `order` | — |
| `checks` | `userId`, `habitId`, `date` | `userId + habitId + date` |
| `moods` | `userId`, `date`, `value` | `userId + date` |

## API

| Method | Path |
|---|---|
| POST | `/api/auth/register`, `/api/auth/login` |
| GET | `/api/auth/me` |
| GET POST | `/api/habits` |
| PATCH DELETE | `/api/habits/:id` |
| GET | `/api/checks?start=&end=` |
| POST | `/api/checks/toggle` |
| GET PUT | `/api/moods` |
| DELETE | `/api/moods/:date` |

## Deploying

```bash
./deploy.sh
```

Builds the SPA locally, rsyncs it and the server source to the host, installs
production deps, restarts the service. The build stays local on purpose — the box
has ~190 MB RAM free and Vite would OOM there.

On the host: nginx serves the SPA from `/webdirectory/openhabit/` with
`try_files $uri /index.html`, and proxies `/api/` to `openhabit.service` on
`127.0.0.1:8124`. TLS from `certbot --nginx`, behind Cloudflare.

Notes:

- `/usr/bin/node` there is v12 and can't run this. The unit uses nvm's v20 by absolute
  path, and `deploy.sh` puts it on `PATH` before calling npm — npm's shebang is
  `#!/usr/bin/env node`, so pointing at npm alone isn't enough.
- Atlas Network Access must include the server IP. Without it the service starts, fails
  with `tlsv1 alert internal error` (alert 80), and restart-loops. That error means the
  allowlist, not the code.
- Secrets live only in `~/openhabit/server/.env` (mode 600, never rsynced). Changing
  `JWT_SECRET` signs everyone out.
- Logs: `journalctl -u openhabit -f`, `/var/log/nginx/openhabit_{access,error}.log`.
