# Storage Management System Backend

NestJS API for the mobile Storage Management System. The deployment stack is NestJS, Prisma, SQLite, Docker, and persistent storage. No web dashboard is included.

## Runtime

- API prefix: `/api`
- Static uploads: `/uploads/*`
- Container port: `4000`
- Container working directory: `/app`
- SQLite database: `/app/data/SMSdata.db`

The container entrypoint creates the storage directories, applies existing Prisma migrations, runs the idempotent admin seed, and starts NestJS on `0.0.0.0:4000`.

## Coolify Test Deployment

Create a Coolify Application with these settings:

```txt
Resource type: Application
Source: Git Repository
Build Pack: Dockerfile
Port: 4000
Protocol: HTTP
```

Configure these environment variables in Coolify:

```env
APP_NAME="Storage Management System"
NODE_ENV="production"
PORT=4000
DATABASE_URL="file:/app/data/SMSdata.db"
JWT_SECRET="CHANGE_ME_TO_A_LONG_RANDOM_SECRET"
JWT_EXPIRES_IN="1d"
UPLOADS_DIR="/app/uploads"
REPORTS_DIR="/app/reports"
BACKUPS_DIR="/app/backups"
CORS_ORIGIN="*"
```

Replace `JWT_SECRET` with a long random value before deployment. Do not upload the local `.env` file to Coolify.

Add persistent storage mounts for:

```txt
/app/data
/app/uploads
/app/reports
/app/backups
```

The minimum mounts for this test are `/app/data` and `/app/uploads`. Keep one application replica while using SQLite.

## Deployment Checks

When Coolify provides an HTTP domain:

```txt
http://YOUR_DOMAIN/api
http://YOUR_DOMAIN/api/health
```

When exposing port `4000` directly:

```txt
http://YOUR_SERVER_IP:4000/api
http://YOUR_SERVER_IP:4000/api/health
```

Login request:

```http
POST http://YOUR_DOMAIN/api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

Uploaded device images are public outside the API prefix:

```txt
http://YOUR_DOMAIN/uploads/devices/IMAGE_FILE.jpg
```

## Mobile App

After deployment, change the mobile app Server Settings from the laptop IP to either:

```txt
http://YOUR_DOMAIN/api
```

or:

```txt
http://YOUR_SERVER_IP:4000/api
```

HTTP is acceptable only for this test stage. Android release builds may block cleartext HTTP unless cleartext traffic is enabled in the mobile app configuration. Add HTTPS before a real production launch.

## Local Validation

```sh
npm ci
npm run prisma:generate
npm run build
npm run smoke
```

Docker build:

```sh
docker build -t sms-backend-coolify-test .
```

The image does not include local databases, uploads, reports, backups, `.env` files, logs, or development dependencies.
