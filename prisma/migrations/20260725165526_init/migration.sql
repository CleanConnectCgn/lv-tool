-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MITARBEITER');

-- CreateEnum
CREATE TYPE "ServiceVerb" AS ENUM ('ENTSTAUBEN', 'ABSAUGEN', 'FEUCHT_WISCHEN', 'NASS_WISCHEN', 'FEUCHT_REINIGEN', 'DESINFIZIEREND_REINIGEN', 'FLECKENFREI_REINIGEN', 'GRIFFSPUREN_ENTFERNEN', 'ENTLEEREN_UND_ENTSORGEN', 'ENTKALKEN');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('ANGEBOT', 'LV', 'VERTRAG');

-- CreateEnum
CREATE TYPE "RecurringJobStatus" AS ENUM ('AKTIV', 'PAUSIERT', 'BEENDET');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('BESICHTIGUNG', 'ERSTREINIGUNG', 'ABNAHME');

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "google_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "picture_url" TEXT,
    "access_token_enc" TEXT,
    "refresh_token_enc" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MITARBEITER',
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "street" TEXT,
    "zip" TEXT,
    "city" TEXT,
    "email" TEXT,
    "contact_person" TEXT,
    "payment_term_days" INTEGER,
    "instantly_lead_id" TEXT,
    "sevdesk_contact_id" TEXT,
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objects" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "contact_person_on_site" TEXT,
    "access_note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_areas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "element_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "element_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_catalog" (
    "id" TEXT NOT NULL,
    "element_group_id" TEXT NOT NULL,
    "gegenstand" TEXT NOT NULL,
    "verb" "ServiceVerb" NOT NULL,
    "zusatz" TEXT,
    "synonyme" TEXT[],
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_specs" (
    "id" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "stand_datum" TIMESTAMP(3) NOT NULL,
    "leistungsart" TEXT NOT NULL,
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_spec_items" (
    "id" TEXT NOT NULL,
    "service_spec_id" TEXT NOT NULL,
    "catalog_item_id" TEXT NOT NULL,
    "room_area_id" TEXT NOT NULL,
    "nach_bedarf" BOOLEAN NOT NULL DEFAULT false,
    "woechentlich" INTEGER,
    "monatlich" INTEGER,
    "jaehrlich" INTEGER,
    "bemerkung" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_spec_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "customer_id" TEXT NOT NULL,
    "rendered_data" JSONB NOT NULL,
    "sevdesk_order_id" TEXT,
    "sevdesk_order_number" TEXT,
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_objects" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "price" DECIMAL(10,2),
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_jobs" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "rrule" TEXT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "start_time" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "google_event_id" TEXT,
    "status" "RecurringJobStatus" NOT NULL DEFAULT 'AKTIV',
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "type" "CalendarEventType" NOT NULL,
    "google_event_id" TEXT,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "instantly_lead_id" TEXT NOT NULL,
    "interest_status" TEXT,
    "campaign_id" TEXT,
    "last_reply_at" TIMESTAMP(3),
    "synced_at" TIMESTAMP(3),
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "external_event_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),
    "error" TEXT,
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "due_date" TIMESTAMP(3),
    "customer_id" TEXT,
    "object_id" TEXT,
    "assignee_id" TEXT,
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploads" (
    "id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT,
    "customer_id" TEXT,
    "object_id" TEXT,
    "extraction_result" JSONB,
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_instantly_lead_id_key" ON "customers"("instantly_lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_sevdesk_contact_id_key" ON "customers"("sevdesk_contact_id");

-- CreateIndex
CREATE INDEX "objects_customer_id_idx" ON "objects"("customer_id");

-- CreateIndex
CREATE INDEX "service_catalog_element_group_id_idx" ON "service_catalog"("element_group_id");

-- CreateIndex
CREATE INDEX "service_specs_object_id_idx" ON "service_specs"("object_id");

-- CreateIndex
CREATE INDEX "service_spec_items_service_spec_id_idx" ON "service_spec_items"("service_spec_id");

-- CreateIndex
CREATE INDEX "service_spec_items_catalog_item_id_idx" ON "service_spec_items"("catalog_item_id");

-- CreateIndex
CREATE INDEX "service_spec_items_room_area_id_idx" ON "service_spec_items"("room_area_id");

-- CreateIndex
CREATE INDEX "documents_customer_id_idx" ON "documents"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_objects_document_id_object_id_key" ON "document_objects"("document_id", "object_id");

-- CreateIndex
CREATE INDEX "contracts_customer_id_idx" ON "contracts"("customer_id");

-- CreateIndex
CREATE INDEX "contracts_document_id_idx" ON "contracts"("document_id");

-- CreateIndex
CREATE INDEX "recurring_jobs_contract_id_idx" ON "recurring_jobs"("contract_id");

-- CreateIndex
CREATE INDEX "recurring_jobs_object_id_idx" ON "recurring_jobs"("object_id");

-- CreateIndex
CREATE INDEX "calendar_events_object_id_idx" ON "calendar_events"("object_id");

-- CreateIndex
CREATE UNIQUE INDEX "leads_instantly_lead_id_key" ON "leads"("instantly_lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_external_event_id_key" ON "webhook_events"("external_event_id");

-- CreateIndex
CREATE INDEX "tasks_customer_id_idx" ON "tasks"("customer_id");

-- CreateIndex
CREATE INDEX "tasks_object_id_idx" ON "tasks"("object_id");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_idx" ON "tasks"("assignee_id");

-- CreateIndex
CREATE INDEX "uploads_customer_id_idx" ON "uploads"("customer_id");

-- CreateIndex
CREATE INDEX "uploads_object_id_idx" ON "uploads"("object_id");

-- AddForeignKey
ALTER TABLE "objects" ADD CONSTRAINT "objects_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_catalog" ADD CONSTRAINT "service_catalog_element_group_id_fkey" FOREIGN KEY ("element_group_id") REFERENCES "element_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_specs" ADD CONSTRAINT "service_specs_object_id_fkey" FOREIGN KEY ("object_id") REFERENCES "objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_spec_items" ADD CONSTRAINT "service_spec_items_service_spec_id_fkey" FOREIGN KEY ("service_spec_id") REFERENCES "service_specs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_spec_items" ADD CONSTRAINT "service_spec_items_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "service_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_spec_items" ADD CONSTRAINT "service_spec_items_room_area_id_fkey" FOREIGN KEY ("room_area_id") REFERENCES "room_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_objects" ADD CONSTRAINT "document_objects_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_objects" ADD CONSTRAINT "document_objects_object_id_fkey" FOREIGN KEY ("object_id") REFERENCES "objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_jobs" ADD CONSTRAINT "recurring_jobs_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_jobs" ADD CONSTRAINT "recurring_jobs_object_id_fkey" FOREIGN KEY ("object_id") REFERENCES "objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_object_id_fkey" FOREIGN KEY ("object_id") REFERENCES "objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_object_id_fkey" FOREIGN KEY ("object_id") REFERENCES "objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_object_id_fkey" FOREIGN KEY ("object_id") REFERENCES "objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraint
-- "Bezug zu customer oder object" (Auftragstext, Block 2) - mindestens eines
-- der beiden muss gesetzt sein. Prisma kennt keine @@check-Direktive, daher
-- hier von Hand ergänzt statt nur als Anwendungsregel zu hoffen.
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_customer_or_object_chk" CHECK ("customer_id" IS NOT NULL OR "object_id" IS NOT NULL);

-- CheckConstraint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_customer_or_object_chk" CHECK ("customer_id" IS NOT NULL OR "object_id" IS NOT NULL);
