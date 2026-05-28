/*
  Warnings:

  - A unique constraint covering the columns `[user_id,document_id]` on the table `downloads` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "downloads_user_id_document_id_key" ON "downloads"("user_id", "document_id");
