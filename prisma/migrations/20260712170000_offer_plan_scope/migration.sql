CREATE TYPE "OfferPlanScope" AS ENUM ('ALL', 'CLASS', 'GYM', 'MIXED');
ALTER TABLE "Offer" ADD COLUMN "planScope" "OfferPlanScope" NOT NULL DEFAULT 'ALL';
