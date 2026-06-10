UPDATE "users"
SET "role" = 'ADMIN'
WHERE "role" = 'MODERATOR';

ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "users"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "UserRole" USING "role"::text::"UserRole",
  ALTER COLUMN "role" SET DEFAULT 'USER';

DROP TYPE "UserRole_old";
