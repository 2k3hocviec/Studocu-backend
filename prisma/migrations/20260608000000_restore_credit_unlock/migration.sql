ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'USE_DOWNLOAD';

CREATE UNIQUE INDEX IF NOT EXISTS "credit_transactions_user_id_document_id_type_key"
ON "credit_transactions"("user_id", "document_id", "type");
