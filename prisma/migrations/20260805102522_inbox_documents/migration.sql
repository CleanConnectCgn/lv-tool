-- CreateTable
CREATE TABLE "inbox_documents" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "extracted_customer_name" TEXT,
    "extracted_address" TEXT,
    "extracted_doc_type" TEXT,
    "extracted_date" TEXT,
    "match_candidates" JSONB,
    "matched_customer_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inbox_documents_status_idx" ON "inbox_documents"("status");

-- AddForeignKey
ALTER TABLE "inbox_documents" ADD CONSTRAINT "inbox_documents_matched_customer_id_fkey" FOREIGN KEY ("matched_customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
