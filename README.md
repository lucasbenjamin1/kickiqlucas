# KickIQ

College football kicking analytics — mobile-first web app for specialist coaches.

## Tech Stack

- **Frontend:** React 18 + TypeScript, Vite
- **Runtime:** Bun
- **Database:** SQLite (better-sqlite3)
- **Styling:** Tailwind CSS
- **PWA:** vite-plugin-pwa

## Setup

```bash
# Install dependencies
bun install

# Run database migrations
bun run db:migrate

# (Optional) Seed demo data
bun run db:seed

# Start dev server
bun run dev
```

The dev server runs on **http://localhost:3000**.

## Build

```bash
bun run build
```

Output goes to `dist/`.

## Project Structure

```
src/
  components/       # shared UI components
  pages/            # route-level page components
  hooks/            # custom React hooks
  lib/              # utilities, db client
  styles/           # global styles, Tailwind
  db/               # schema, migrations, seed data
  App.tsx           # root component with router
  main.tsx          # entry point
public/             # static assets, PWA icons
data/               # SQLite database (gitignored)
```

## Pages

- `/` — Home dashboard
- `/record` — Record practice/game kicks
- `/sessions` — Session history
- `/analytics` — Performance charts
- `/reports` — Export reports
- `/athletes` — Athlete management
- `/settings` — App settings

## License

Private — all rights reserved.
