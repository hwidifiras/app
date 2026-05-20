# Deployment Tonight

## Recommended path for tonight

Use the VPS Docker path in `docs/vps-deployment.md`.

This project currently uses SQLite Prisma migrations. That makes the safest same-night deployment:

- Dockerized Next.js app.
- SQLite database persisted in a Docker volume.
- Nginx reverse proxy.
- Certbot SSL.

## Recommended SaaS path after launch

Use Vercel + Neon Postgres for a real SaaS path:

1. Create a Neon Postgres database.
2. Set `DATABASE_URL` to the Neon pooled connection string.
3. Set `AUTH_SECRET` to a long random value.
4. Set `APP_URL` to the deployed URL.
5. Configure password reset email:
   - `RESEND_API_KEY`
   - `PASSWORD_RESET_FROM`
6. Run `npx prisma migrate deploy` during deployment.
7. Run `npx prisma db seed` once for the first admin/demo data, or manually create the first admin in the database.

## Free and paid options

- Vercel + Neon: best free/cheap option for Next.js and future multi-dojo SaaS.
- Render + Render Postgres: simple, paid recommended because free services sleep.
- Railway: fastest setup, usually paid/trial, very convenient.
- VPS + SQLite: cheapest quick demo path, but not recommended for production SaaS.
- Azure App Service/Container Apps + Azure Database for PostgreSQL: professional, more expensive and more setup.

## Production checklist

- `DATABASE_URL` must be Postgres for production.
- `AUTH_SECRET` must not be the dev default.
- `ALLOW_PUBLIC_REGISTER` should stay disabled unless intentionally onboarding staff publicly.
- First admin should create staff accounts from `/settings/users`.
- Staff accounts should be created with either full staff access or selected limited permissions.
- Password reset requires email configuration in production.

## Multi-dojo future

The app is still deployed as one-dojo tonight. To support 100 dojos later, add:

- `Club` or `Tenant` model.
- `clubId` on users, members, sports, coaches, groups, plans, offers, payments, attendances, and audit logs.
- Tenant scoping in every Prisma query.
- Admin hierarchy: platform admin, club admin, staff.
- Per-club settings and subscription billing.

Do not add 100-dojo support by duplicating databases manually unless it is a temporary white-glove deployment.
