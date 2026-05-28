CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'DISLIKE');

CREATE TABLE "document_reactions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "document_id" INTEGER NOT NULL,
    "type" "ReactionType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_reactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_reactions_user_id_document_id_key" ON "document_reactions"("user_id", "document_id");

ALTER TABLE "document_reactions" ADD CONSTRAINT "document_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_reactions" ADD CONSTRAINT "document_reactions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
