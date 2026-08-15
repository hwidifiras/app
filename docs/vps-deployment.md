# VPS deployment

This runbook deploys the PostgreSQL multi-tenant stack on one Ubuntu or Debian VPS. Nginx terminates TLS and proxies to the app bound on `127.0.0.1`.

## 1. Install prerequisites

```bash
sudo apt update
sudo apt install -y git nginx certbot python3-certbot-nginx
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
```

Log out and back in after adding Docker permissions.

## 2. Clone the repository

```bash
sudo mkdir -p /opt/gymday
sudo chown "$USER":"$USER" /opt/gymday
git clone <your-repository-url> /opt/gymday
cd /opt/gymday
```

The deployment must include `Dockerfile`, `docker-compose.yml`, `prisma/`, `scripts/`, `src/`, `package.json`, and `package-lock.json`.

## 3. Configure production

```bash
cp .env.production.example .env.production
chmod 600 .env.production
POSTGRES_PASSWORD="$(openssl rand -hex 32)"
AUTH_SECRET="$(openssl rand -base64 48)"
```

Edit `.env.production` and set the generated values plus the real public domain:

```env
POSTGRES_USER="gymday"
POSTGRES_PASSWORD="paste-the-hex-value"
POSTGRES_DB="gymday_prod"
AUTH_SECRET="paste-the-base64-value"
APP_URL="https://first-club.example.com"
SAAS_ROOT_DOMAIN="example.com"
DEFAULT_TENANT_SLUG="first-club"
ALLOW_PUBLIC_REGISTER="false"
RATE_LIMIT_REDIS_REST_URL="https://your-rest-redis-endpoint"
RATE_LIMIT_REDIS_REST_TOKEN="paste-the-rest-redis-token"
TRUSTED_PROXY_HOPS="1"
```

Use a hexadecimal PostgreSQL password so it is safe both as the database password and inside the generated connection URL. Leave `RESEND_API_KEY` and `PASSWORD_RESET_FROM` both empty to disable email, or configure both with real values.

Validate Compose interpolation and the application configuration before starting anything:

```bash
docker compose --env-file .env.production config --quiet
set -a
. ./.env.production
set +a
npm ci
npm run config:validate:production
```

The Redis REST endpoint must be shared by every app replica; production authentication rate limits fail closed if it is missing or unavailable. `TRUSTED_PROXY_HOPS=1` is correct only for the direct Nginx-to-app topology shown below. Increase it only when another trusted proxy is deliberately added to the chain.

The validator rejects missing values, development defaults, placeholder secrets, non-PostgreSQL URLs, missing shared rate-limit storage, invalid proxy trust, and an insecure public `APP_URL`.

## 4. Start the stack

```bash
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps --all
docker compose --env-file .env.production logs --tail=150 dojo-migrate dojo-app
```

Expected state:

- `postgres` is healthy.
- `dojo-migrate` exits with code `0` after the tenant-consistency preflight, `prisma migrate deploy`, and the permission backfill. If the preflight reports missing tenant IDs or cross-tenant references, repair those rows before retrying the release.
- `dojo-app` is healthy and bound to `127.0.0.1:3000` by default.

The migration service is separate from the web process, so restarting or scaling the app does not run schema changes in every web container.

Verify both probes:

```bash
curl --fail http://127.0.0.1:3000/api/health
curl --fail http://127.0.0.1:3000/api/ready
```

## 5. Create the first tenant admin

The default tenant is created or selected with `DEFAULT_TENANT_SLUG`.

```bash
docker compose --env-file .env.production exec \
  -e ADMIN_EMAIL=admin@example.com \
  -e ADMIN_NAME="Admin" \
  -e ADMIN_PASSWORD="replace-with-a-strong-password" \
  dojo-app npm run admin:create
```

Sign in at `/login`, then create staff accounts from Settings.

## 6. Configure Nginx and TLS

Create `/etc/nginx/sites-available/gymday`:

```nginx
server {
    listen 80;
    server_name first-club.example.com;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }
}
```

The first hostname must match `DEFAULT_TENANT_SLUG` (`first-club.example.com` resolves to `first-club`). Before onboarding more tenants, configure wildcard DNS and a matching TLS certificate for `*.example.com`, then add that wildcard to `server_name`. A custom hostname must be stored as that tenant's `rootDomainAlias`. Always overwrite both `Host` and `X-Forwarded-Host` at the proxy boundary as shown above.

Enable it and obtain a certificate:

```bash
sudo ln -s /etc/nginx/sites-available/gymday /etc/nginx/sites-enabled/gymday
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d first-club.example.com
```

## 7. Back up PostgreSQL

Create a compressed logical backup before every deployment and on a schedule:

```bash
mkdir -p /opt/gymday-backups
docker compose --env-file .env.production exec -T postgres \
  sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "/opt/gymday-backups/gymday-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Verify that the file is non-empty and periodically test restoration into a disposable PostgreSQL database. Do not treat a Docker volume as a backup.

## 8. Deploy an update

```bash
cd /opt/gymday
git status --short
git fetch origin
git log --oneline HEAD..origin/main
# Create and verify a PostgreSQL backup here.
git pull --ff-only origin main
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps --all
curl --fail http://127.0.0.1:3000/api/ready
```

Review the one-shot migration logs before accepting traffic. A code rollback does not automatically reverse a database migration; use a tested forward-fix or a verified pre-deployment backup according to the migration plan.
