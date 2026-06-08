ALTER TABLE "documents" ADD COLUMN "requested_school_name" TEXT;
ALTER TABLE "documents" ADD COLUMN "requested_subject_name" TEXT;
ALTER TABLE "documents" ALTER COLUMN "school_id" DROP NOT NULL;
ALTER TABLE "documents" ALTER COLUMN "subject_id" DROP NOT NULL;
