ALTER TABLE "ClubSettings"
  ADD COLUMN "allowSameRoomConcurrentGroups" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "allowCoachConcurrentSameRoomQualified" BOOLEAN NOT NULL DEFAULT false;
