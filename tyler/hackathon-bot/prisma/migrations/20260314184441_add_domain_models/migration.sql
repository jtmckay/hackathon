-- CreateTable
CREATE TABLE "Tech" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "skills" TEXT NOT NULL,
    "certifications" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "currentJobId" TEXT,
    "performanceRating" REAL NOT NULL DEFAULT 4.5,
    "avgJobTime" REAL NOT NULL DEFAULT 1.0,
    "hourlyRate" REAL NOT NULL DEFAULT 85.0
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "valueTier" TEXT NOT NULL DEFAULT 'standard',
    "lifetimeValue" REAL NOT NULL DEFAULT 0,
    "jobHistory" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'current',
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "ScheduledJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "techId" TEXT NOT NULL,
    "customerId" TEXT,
    "time" TEXT NOT NULL,
    "durationHrs" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "bumpable" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 5,
    CONSTRAINT "ScheduledJob_techId_fkey" FOREIGN KEY ("techId") REFERENCES "Tech" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScheduledJob_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobCatalog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "basePriceMin" REAL NOT NULL,
    "basePriceMax" REAL NOT NULL,
    "estimatedHours" REAL NOT NULL,
    "requiredSkills" TEXT NOT NULL,
    "requiredCerts" TEXT NOT NULL,
    "partsCommon" TEXT NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "JobLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobId" TEXT NOT NULL,
    "techId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
