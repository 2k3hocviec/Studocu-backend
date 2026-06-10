DELETE FROM "credit_transactions" WHERE "type" = 'USE_DOWNLOAD';

ALTER TABLE "downloads" DROP COLUMN IF EXISTS "credit_used";
ALTER TABLE "documents" DROP COLUMN IF EXISTS "is_premium";

ALTER TYPE "CreditTransactionType" RENAME TO "CreditTransactionType_old";
CREATE TYPE "CreditTransactionType" AS ENUM ('EARN_UPLOAD', 'ADMIN_ADJUST');
ALTER TABLE "credit_transactions"
  ALTER COLUMN "type" TYPE "CreditTransactionType"
  USING ("type"::text::"CreditTransactionType");
DROP TYPE "CreditTransactionType_old";
