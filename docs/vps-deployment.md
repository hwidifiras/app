# VPS Deployment

This is the fastest safe deployment path for tonight.

## 1. Server prerequisites

On Ubuntu/Debian VPS:

```bash
sudo apt update
sudo apt install -y git nginx certbot python3-certbot-nginx
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Log out and back in after adding Docker permissions.

## 2. Upload or clone the app

```bash
git clone <your-repo-url> dojo-saas
cd dojo-saas/app
```

If you upload files manually, make sure `Dockerfile`, `docker-compose.yml`, `.env.production.example`, `prisma/`, `src/`, `package.json`, and `package-lock.json` are present.

## 3. Create production env

```bash
cp .env.production.example .env.production
nano .env.production
```

Set:

```env
AUTH_SECRET="long-random-secret-at-least-32-chars"
APP_URL="https://your-domain.com"
APP_TIMEZONE="Africa/Tunis"
ALLOW_PUBLIC_REGISTER="false"
RESEND_API_KEY=""
PASSWORD_RESET_FROM="GymDay <no-reply@your-domain.com>"
```

Generate a secret:

```bash
openssl rand -base64 48
```

## 4. Start the app

```bash
docker compose up -d --build
docker compose logs -f dojo-app
```

The app listens on `http://127.0.0.1:3000`.

SQLite production data is stored at `/app/data/prod.db` inside the Docker volume `dojo_data`.

## 5. Create the first admin

```bash
docker compose exec dojo-app sh -lc 'ADMIN_EMAIL=admin@example.com ADMIN_NAME="Admin" ADMIN_PASSWORD="change-this-password" npm run admin:create'
```

Then open `/login`.

## 6. Configure Nginx

Create `/etc/nginx/sites-available/dojo-saas`:

```nginx
server {
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/dojo-saas /etc/nginx/sites-enabled/dojo-saas
sudo nginx -t
sudo systemctl reload nginx
```

## 7. SSL

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## 8. Update deployment

```bash
git pull
docker compose up -d --build
docker compose logs -f dojo-app
```

Migrations run automatically when the container starts.

## 9. Backups

Back up the SQLite DB every night:

```bash
mkdir -p ~/dojo-backups
docker run --rm -v app_dojo_data:/data -v ~/dojo-backups:/backup busybox \
  sh -c 'cp /data/prod.db /backup/prod-$(date +%F-%H%M).db'
```

Adjust the volume name if `docker volume ls` shows a different prefix.

## Notes for v1

This deployment is mono-dojo and intentionally simple. For v1 SaaS/multi-dojo, migrate to PostgreSQL and add tenant scoping before onboarding many clubs.
