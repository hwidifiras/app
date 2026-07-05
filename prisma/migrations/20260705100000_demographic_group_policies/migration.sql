-- Add demographic policies without changing existing records' behavior.
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'NOT_SPECIFIED');
CREATE TYPE "GroupGenderPolicy" AS ENUM ('MALE_ONLY', 'FEMALE_ONLY', 'MIXED');

ALTER TYPE "GroupType" ADD VALUE IF NOT EXISTS 'MIXED';

ALTER TABLE "Member"
  ADD COLUMN "gender" "Gender" NOT NULL DEFAULT 'NOT_SPECIFIED';

ALTER TABLE "Group"
  ADD COLUMN "genderPolicy" "GroupGenderPolicy" NOT NULL DEFAULT 'MIXED';
