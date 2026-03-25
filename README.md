# TruthStay

Honest active holiday reviews from people you trust — cycling routes, hiking trails, places to stay, and where to eat.

## Monorepo Structure

```
TruthStay/
├── apps/
│   ├── web/          # Next.js 15 web app
│   └── mobile/       # Expo (React Native) mobile app
├── packages/
│   ├── types/        # Shared TypeScript types
│   ├── ui/           # Shared React component library
│   ├── api-client/   # Supabase client
│   ├── eslint-config/
│   └── typescript-config/
```

## Getting Started

Install dependencies:

```sh
pnpm install
```

Run all apps in development mode:

```sh
pnpm dev
```

Run only the web app:

```sh
pnpm dev --filter=web
```

Run only the mobile app:

```sh
pnpm dev --filter=@truthstay/mobile
```

## Tech Stack

- **Web**: Next.js 15 (App Router, TypeScript)
- **Mobile**: Expo SDK 55 (React Native, TypeScript)
- **Database**: Supabase (PostgreSQL + PostGIS)
- **Maps**: Mapbox
- **Monorepo**: Turborepo + pnpm
