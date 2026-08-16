-- The owner password hash is copied to User during atomic provisioning. Keeping
-- a second copy afterwards adds risk without serving authentication.
ALTER TABLE "WorkspaceSignup"
  ALTER COLUMN "passwordHash" DROP NOT NULL;

UPDATE "WorkspaceSignup"
SET "passwordHash" = NULL,
    "requestFingerprint" = NULL
WHERE "status" = 'COMPLETED'::"WorkspaceSignupStatus";

ALTER TABLE "WorkspaceSignup"
  ADD CONSTRAINT "WorkspaceSignup_password_lifecycle_check" CHECK (
    ("status" = 'COMPLETED'::"WorkspaceSignupStatus" AND "passwordHash" IS NULL)
    OR
    ("status" <> 'COMPLETED'::"WorkspaceSignupStatus" AND "passwordHash" IS NOT NULL)
  );
