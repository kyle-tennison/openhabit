# OpenHabit

A simple habit and mood tracker. React frontend, thin Node BFF, MongoDB Atlas.

## Layout

```
openhabit/
├── server/          Express BFF — holds the Mongo connection and secrets
│   ├── .env         MONGODB_URI, JWT_SECRET (gitignored)
│   └── src/
│       ├── env.js   loads .env relative to the server dir
│       ├── db.js    Atlas client + index setup
│       ├── auth.js  JWT sign/verify middleware
│       └── index.js routes
└── client/          React + Vite. Never talks to Mongo directly.
    └── src/
        ├── App.jsx        state, the 30-day window, optimistic updates
        ├── Auth.jsx       email + password sign in / register
        ├── HabitGrid.jsx  habits × 30 days, click a cell to toggle
        ├── MoodChart.jsx  interactive SVG line chart
        └── dates.js       local-time "YYYY-MM-DD" helpers
```

## Running it

Two terminals:

```bash
npm start --prefix server
```

```bash
npm run dev --prefix client
```

Then open http://localhost:5173. Vite proxies `/api` to the BFF on port 4000, so
the browser never sees the Mongo connection string.

## How it works

**Auth** — email + password. Passwords are bcrypt-hashed; the client gets a JWT
(30 day expiry) kept in `localStorage`. Every `/api` route except register/login
requires `Authorization: Bearer <token>`, and every query is scoped to the
token's user id.

**Habits** — up to 100 per user. The grid shows a 30-day window; each habit is a
row, each day a column. Clicking a cell toggles it. Click a habit's name to
rename it, `×` to delete it (which also deletes its history). Future days are
disabled. Use `‹` / `›` to page through earlier windows.

**Mood** — an SVG chart over the same 30 days, rated 1–10. Click anywhere to set
a day's rating, drag to adjust it, shift-click to clear it. Today's point is
hollow and its column is shaded. The line breaks across unrated days rather than
interpolating.

All writes are optimistic and roll back with a message if the server rejects them.

## Data model

| Collection | Shape | Indexes |
|---|---|---|
| `users` | `email`, `passwordHash`, `createdAt` | unique on `email` |
| `habits` | `userId`, `name`, `order`, `createdAt` | `userId + order` |
| `checks` | `userId`, `habitId`, `date` | unique on `userId + habitId + date` |
| `moods` | `userId`, `date`, `value`, `updatedAt` | unique on `userId + date` |

Dates are stored as local-time `YYYY-MM-DD` strings, so a day never shifts
because of a timezone conversion.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | create an account, returns a token |
| POST | `/api/auth/login` | returns a token |
| GET | `/api/auth/me` | validate the current token |
| GET | `/api/habits` | list habits in display order |
| POST | `/api/habits` | add a habit (max 100) |
| PATCH | `/api/habits/:id` | rename |
| DELETE | `/api/habits/:id` | delete habit + its checks |
| GET | `/api/checks?start=&end=` | checks in a date range |
| POST | `/api/checks/toggle` | toggle one habit/day cell |
| GET | `/api/moods?start=&end=` | moods in a date range |
| PUT | `/api/moods` | set a day's mood (1–10, upsert) |
| DELETE | `/api/moods/:date` | clear a day's mood |

## Deploying

Live at **https://openhabit.co**, on the Lightsail box (`lightsail` in `~/.ssh/config`,
52.37.243.198). To ship a change:

```bash
./deploy.sh
```

That builds the SPA locally, rsyncs it plus the server source, installs production
deps, and restarts the service. The build runs locally on purpose — the box has
~190 MB of RAM free and a Vite build there would likely OOM.

### How it's wired

| Piece | Location |
|---|---|
| SPA | `/webdirectory/openhabit/`, served by nginx |
| BFF | `openhabit.service` → Node on `127.0.0.1:8124` |
| nginx vhost | `/etc/nginx/sites-available/openhabit.conf` (copy in `~/nginx-openhabit.conf`) |
| systemd unit | `/etc/systemd/system/openhabit.service` (copy in `~/openhabit.service`) |
| Secrets | `~/openhabit/server/.env`, mode 600, never rsynced |

nginx serves the static SPA with `try_files $uri /index.html` for client-side routes
and proxies `/api/` to the BFF. TLS via `certbot --nginx`; the domain sits behind
Cloudflare, which proxies to this origin.

**Node version:** `/usr/bin/node` on the box is v12 and cannot run this. The unit
uses the nvm build at `/home/ubuntu/.nvm/versions/node/v20.13.1/bin/node`, and
`deploy.sh` puts that directory on `PATH` before calling npm — npm's shebang is
`#!/usr/bin/env node`, so an absolute path to npm alone isn't enough.

### Gotchas

- `server/.env` is gitignored; the production copy lives only on the box. `JWT_SECRET`
  there was generated with `openssl rand -hex 32` — changing it signs everyone out.
- Atlas Network Access must include the server's IP (`52.37.243.198/32`). Without it
  the service starts, fails the handshake with `tlsv1 alert internal error` (alert 80),
  and systemd restart-loops every ~34s. That error means the allowlist, not the code.
- Logs: `journalctl -u openhabit -f`, plus `/var/log/nginx/openhabit_{access,error}.log`.
