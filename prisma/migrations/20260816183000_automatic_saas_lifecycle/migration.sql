-- Date-driven lifecycle is opt-in so existing manually managed subscriptions
-- keep their current behavior. Self-serve trials enable it when provisioned.
ALTER TABLE "TenantSaasSubscription"
  ADD COLUMN "automaticLifecycle" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "TenantSaasSubscription"
  ADD CONSTRAINT "TenantSaasSubscription_automatic_trial_end_check" CHECK (
    NOT "automaticLifecycle"
    OR "status" <> 'TRIAL'::"SaasSubscriptionStatus"
    OR "trialEndsAt" IS NOT NULL
  ),
  ADD CONSTRAINT "TenantSaasSubscription_automatic_grace_order_check" CHECK (
    NOT "automaticLifecycle"
    OR "graceEndsAt" IS NULL
    OR "graceEndsAt" >= COALESCE("trialEndsAt", "currentPeriodEnd", "startsAt")
  );
