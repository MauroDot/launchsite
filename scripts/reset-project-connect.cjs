/* eslint-disable @typescript-eslint/no-require-imports -- standalone maintenance CLI. */
const RESET_STATE = Object.freeze({
  stripeConnectAccountId: null,
  stripeConnectStatus: "NOT_CONNECTED",
  stripeChargesEnabled: false,
  stripePayoutsEnabled: false,
  stripeDetailsSubmitted: false,
  accountAttemptAt: null,
});
const stateSelect = Object.fromEntries(Object.keys(RESET_STATE).map((key) => [key, true]));
const USAGE = "Usage: node scripts/reset-project-connect.cjs <project-id> [--confirm]";
class ResetError extends Error {}

function parseArgs(args) {
  const [projectId, flag] = args;
  if (args.length < 1 || args.length > 2 || typeof projectId !== "string" ||
      !projectId || /[\s<>]/.test(projectId) || projectId.startsWith("-") ||
      (args.length === 2 && flag !== "--confirm")) {
    throw new ResetError(USAGE);
  }
  return { projectId, confirm: flag === "--confirm" };
}

async function resetProjectConnect(db, args, print = console.log) {
  const { projectId, confirm } = parseArgs(args);
  const project = await db.websiteProject.findUnique({
    where: { id: projectId },
    select: { id: true, businessName: true, paymentSettings: {
      select: { id: true, updatedAt: true, ...stateSelect },
    } },
  });
  if (!project) throw new ResetError("Project not found. Supply the exact WebsiteProject ID, not a name or slug.");
  const settings = project.paymentSettings;
  if (!settings) throw new ResetError("Project has no ProjectPaymentSettings row. Nothing was changed.");
  const current = Object.fromEntries(Object.keys(RESET_STATE).map((key) => [key, settings[key]]));
  print(JSON.stringify({ mode: confirm ? "CONFIRMED RESET" : "DRY RUN", projectId: project.id,
    businessName: project.businessName, connectAccountIdPresent: settings.stripeConnectAccountId !== null,
    current, fieldsToReset: RESET_STATE }, null, 2));
  if (!confirm) {
    print("Dry run complete. No changes made. Pass --confirm to reset these six fields.");
    return;
  }
  const result = await db.$transaction(async (tx) => {
    // Match src/lib/payments/core.ts so merchant operations serialize with this reset.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`merchant:${projectId}`}, 0))::text`;
    return tx.projectPaymentSettings.update({
      // Abort if the reviewed row changed or disappeared before acquiring the lock.
      where: { projectId, id: settings.id, updatedAt: settings.updatedAt, ...current },
      // Explicitly preserve @updatedAt: only the six Connect fields may change.
      data: { ...RESET_STATE, updatedAt: settings.updatedAt },
      select: stateSelect,
    });
  }, { maxWait: 5000, timeout: 10000 });
  print(JSON.stringify({ message: "Connect reset committed", projectId, resultingState: result }, null, 2));
}

async function main() {
  let db;
  try {
    parseArgs(process.argv.slice(2));
    const path = require("node:path");
    // Same production-mode env loading as Next; existing shell variables take priority.
    require("@next/env").loadEnvConfig(path.resolve(__dirname, ".."), false);
    if (!process.env.DATABASE_URL?.trim()) throw new ResetError("DATABASE_URL is required in the shell or repository-root .env.local / .env.");
    const { PrismaClient } = require("@prisma/client");
    db = new PrismaClient({ log: [] });
    await resetProjectConnect(db, process.argv.slice(2));
  } catch (error) {
    // Prisma errors can contain connection details. Never print raw errors or stacks.
    console.error(error instanceof ResetError ? error.message :
      error?.code === "P2025" ? "Reset aborted: settings changed or disappeared. Run a new dry run before retrying." :
      "Reset failed. Check database connectivity and generated Prisma client, then run a new dry run before retrying.");
    process.exitCode = 1;
  } finally {
    if (db) await db.$disconnect();
  }
}

module.exports = { parseArgs, resetProjectConnect };
if (require.main === module) void main();
