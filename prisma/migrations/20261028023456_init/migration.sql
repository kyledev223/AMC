-- CreateTable
CREATE TABLE "Mint" (
    "assetId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "minter" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "serial" INTEGER NOT NULL,
    "milkRate" INTEGER NOT NULL,
    "burnTx" TEXT NOT NULL,
    "burnAmount" BIGINT NOT NULL,
    "seedCommit" TEXT NOT NULL,
    "seedReveal" TEXT NOT NULL,
    "blockhash" TEXT NOT NULL,
    "roll" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mint_pkey" PRIMARY KEY ("assetId")
);

-- CreateTable
CREATE TABLE "SeedCommit" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "commit" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeedCommit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingMint" (
    "assetId" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "commitId" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "serial" INTEGER NOT NULL,
    "milkRate" INTEGER NOT NULL,
    "blockhash" TEXT NOT NULL,
    "lastValidBlockHeight" BIGINT NOT NULL,
    "roll" TEXT NOT NULL,
    "messageHash" TEXT NOT NULL,
    "signature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "PendingMint_pkey" PRIMARY KEY ("assetId")
);

-- CreateTable
CREATE TABLE "Epoch" (
    "id" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "poolAmount" BIGINT NOT NULL DEFAULT 0,
    "carryIn" BIGINT NOT NULL DEFAULT 0,
    "totalMilk" BIGINT NOT NULL DEFAULT 0,
    "girls" INTEGER NOT NULL DEFAULT 0,
    "holders" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "Epoch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "epochId" INTEGER NOT NULL,
    "wallet" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "asset" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 9,
    "milk" BIGINT NOT NULL,
    "txSig" TEXT,
    "lastValidBlockHeight" BIGINT,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Share" (
    "epochId" INTEGER NOT NULL,
    "assetId" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "milkRate" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,

    CONSTRAINT "Share_pkey" PRIMARY KEY ("epochId","assetId")
);

-- CreateTable
CREATE TABLE "Carry" (
    "wallet" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "asset" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Carry_pkey" PRIMARY KEY ("wallet")
);

-- CreateTable
CREATE TABLE "StatPoint" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalMilk" BIGINT NOT NULL,
    "girls" INTEGER NOT NULL,
    "burned" BIGINT NOT NULL,
    "paidOut" BIGINT NOT NULL,
    "pool" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "StatPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mint_burnTx_key" ON "Mint"("burnTx");

-- CreateIndex
CREATE INDEX "Mint_owner_idx" ON "Mint"("owner");

-- CreateIndex
CREATE INDEX "Mint_createdAt_idx" ON "Mint"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Mint_series_serial_key" ON "Mint"("series", "serial");

-- CreateIndex
CREATE UNIQUE INDEX "SeedCommit_commit_key" ON "SeedCommit"("commit");

-- CreateIndex
CREATE INDEX "SeedCommit_wallet_idx" ON "SeedCommit"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "PendingMint_commitId_key" ON "PendingMint"("commitId");

-- CreateIndex
CREATE INDEX "PendingMint_wallet_idx" ON "PendingMint"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "PendingMint_series_serial_key" ON "PendingMint"("series", "serial");

-- CreateIndex
CREATE INDEX "Epoch_status_idx" ON "Epoch"("status");

-- CreateIndex
CREATE INDEX "Payout_wallet_createdAt_idx" ON "Payout"("wallet", "createdAt");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE INDEX "Payout_createdAt_idx" ON "Payout"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_epochId_wallet_key" ON "Payout"("epochId", "wallet");

-- CreateIndex
CREATE INDEX "Share_assetId_idx" ON "Share"("assetId");

-- CreateIndex
CREATE INDEX "Share_wallet_idx" ON "Share"("wallet");

-- CreateIndex
CREATE INDEX "StatPoint_timestamp_idx" ON "StatPoint"("timestamp");

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_epochId_fkey" FOREIGN KEY ("epochId") REFERENCES "Epoch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_epochId_fkey" FOREIGN KEY ("epochId") REFERENCES "Epoch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Mint"("assetId") ON DELETE RESTRICT ON UPDATE CASCADE;
