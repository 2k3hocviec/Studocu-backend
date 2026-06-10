CREATE TABLE "document_views" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "document_id" INTEGER NOT NULL,
  "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_views_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_views_user_id_document_id_key" ON "document_views"("user_id", "document_id");
CREATE INDEX "document_views_user_id_viewed_at_idx" ON "document_views"("user_id", "viewed_at");

ALTER TABLE "document_views"
  ADD CONSTRAINT "document_views_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_views"
  ADD CONSTRAINT "document_views_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
