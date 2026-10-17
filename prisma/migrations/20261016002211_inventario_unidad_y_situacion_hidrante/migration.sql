-- CreateTable
CREATE TABLE "UnitItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unitId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'equipo',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" TEXT NOT NULL DEFAULT 'bueno',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UnitItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Hydrant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "pressure" TEXT,
    "diameter" INTEGER,
    "situation" TEXT NOT NULL DEFAULT 'operativo',
    "notes" TEXT
);
INSERT INTO "new_Hydrant" ("code", "diameter", "id", "lat", "lng", "pressure") SELECT "code", "diameter", "id", "lat", "lng", "pressure" FROM "Hydrant";
DROP TABLE "Hydrant";
ALTER TABLE "new_Hydrant" RENAME TO "Hydrant";
CREATE UNIQUE INDEX "Hydrant_code_key" ON "Hydrant"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "UnitItem_unitId_idx" ON "UnitItem"("unitId");
