# Storage Management System Backend

NestJS REST API for the Storage Management System mobile app. It manages device types, physical serialized items, assignments, returns, image uploads, and mobile Home summary data.

## Tech Stack

- NestJS and TypeScript
- SQLite through `better-sqlite3`
- JWT authentication
- Multer image uploads
- Docker for Coolify deployment

Prisma was removed to eliminate generated clients, engine downloads, migration tooling, and deployment lockfile complexity. The backend now owns one direct SQLite connection through `DatabaseService` and initializes an idempotent SQL schema at startup.

## Local Setup

```sh
npm install
```

Create an untracked `.env` based on `.env.example`:

```env
APP_NAME="Storage Management System"
NODE_ENV="development"
PORT=4000
DATABASE_PATH="./data/storage.sqlite"
JWT_SECRET="local-dev-secret"
JWT_EXPIRES_IN="1d"
UPLOADS_DIR="./uploads"
CORS_ORIGIN="*"
```

Initialize or seed manually when needed:

```sh
npm run db:init
npm run seed
```

Start development mode:

```sh
npm run start:dev
```

The application also runs the schema and safely creates the default admin during startup.

## Storage

- Local database: `./data/storage.sqlite`
- Local uploads: `./uploads`
- Container database: `/app/data/storage.sqlite`
- Container uploads: `/app/uploads`

The database schema is defined in `database/schema.sql`. Local database files and uploads are ignored by Git and Docker.

Default test account:

```txt
username: admin
password: admin123
```

Change the default password and use a long random JWT secret before real production use.

## API

Public endpoints:

```txt
GET  /api
GET  /api/health
POST /api/auth/login
```

JWT-protected endpoints:

```txt
GET   /api/auth/me
POST  /api/devices
GET   /api/devices
GET   /api/devices/:id
PATCH /api/devices/:id
POST  /api/devices/:id/image
POST  /api/devices/:deviceId/serials
GET   /api/devices/:deviceId/serials
GET   /api/devices/:id/assignments
POST  /api/assignments
GET   /api/assignments
GET   /api/assignments/:id
POST  /api/assignments/:id/return
GET   /api/dashboard/summary
GET   /api/dashboard/recent-assignments
```

Use `Authorization: Bearer <accessToken>` for protected endpoints. Uploaded images are publicly available under `/uploads/*`, outside the `/api` prefix.

## Validation

```sh
npm run build
npm run seed
npm run smoke
```

The smoke test uses an isolated temporary SQLite file, performs real HTTP requests for the complete assignment and return flow, and removes its database, uploaded image, and server process afterward.

## Coolify Test Deployment

```txt
Build Pack: Dockerfile
Base Directory: /
Dockerfile Location: /Dockerfile
Port: 4000
Protocol: HTTP
Replicas: 1
```

Environment variables:

```env
APP_NAME="Storage Management System"
NODE_ENV="production"
PORT=4000
DATABASE_PATH="/app/data/storage.sqlite"
JWT_SECRET="CHANGE_ME_TO_LONG_RANDOM_SECRET"
JWT_EXPIRES_IN="1d"
UPLOADS_DIR="/app/uploads"
CORS_ORIGIN="*"
```

Required persistent mounts:

```txt
/app/data
/app/uploads
```

Optional mounts retained for future report and backup files:

```txt
/app/reports
/app/backups
```

Keep one replica because SQLite supports one writing application instance for this deployment model.

Test URLs:

```txt
http://YOUR_DOMAIN/api
http://YOUR_DOMAIN/api/health
http://YOUR_DOMAIN/uploads/devices/IMAGE_FILE.jpg
```

Set the mobile app server URL to `http://YOUR_DOMAIN/api`. HTTP is allowed only for this test deployment. Add HTTPS for real production; Android builds may require cleartext traffic to be explicitly enabled while testing HTTP.
