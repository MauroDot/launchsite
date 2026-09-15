/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner. */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { parseArgs, resetProjectConnect } = require("../scripts/reset-project-connect.cjs");
const safe = { stripeConnectAccountId: null, stripeConnectStatus: "NOT_CONNECTED", stripeChargesEnabled: false,
  stripePayoutsEnabled: false, stripeDetailsSubmitted: false, accountAttemptAt: null };

function fixture() {
  const original = { id: "settings-one", projectId: "project-one", stripeConnectAccountId: "acct_sandbox",
    stripeConnectStatus: "ACTIVE", stripeChargesEnabled: true, stripePayoutsEnabled: true,
    stripeDetailsSubmitted: true, accountAttemptAt: new Date(0), receiptSequence: 42,
    createdAt: new Date(0), updatedAt: new Date(1000) };
  const row = structuredClone(original);
  const other = { ...original, id: "settings-two", projectId: "project-two" };
  const logs = [], writes = [], locks = [];
  let transactions = 0;
  const db = {
    websiteProject: { findUnique: async ({ where }) => where.id === row.projectId ?
      { id: row.projectId, businessName: "Hearth & Harvest", paymentSettings: structuredClone(row) } : null },
    $transaction: async (work) => { transactions++; return work({
      $queryRaw: async (strings, ...values) => { locks.push({ sql: strings.join("?"), values }); },
      projectPaymentSettings: { update: async ({ where, data, select }) => {
        for (const [key, value] of Object.entries(where)) assert.deepEqual(row[key], value);
        writes.push({ where, data }); Object.assign(row, data);
        return Object.fromEntries(Object.keys(select).map((key) => [key, row[key]]));
      } },
    }); },
  };
  return { db, row, original, other, logs, writes, locks, transactions: () => transactions,
    run: (args) => resetProjectConnect(db, args, (line) => logs.push(line)) };
}

test("requires one exact ID and only the explicit confirmation flag", () => {
  for (const args of [[], [""], [" project-one"], ["<project-id>"], ["--confirm"], ["project-one", "--force"], ["project-one", ""], ["project-one", "--confirm", "project-two"]]) {
    assert.throws(() => parseArgs(args), /Usage/);
  }
  assert.deepEqual(parseArgs(["project-one"]), { projectId: "project-one", confirm: false });
});

test("default dry run prints exact state and targets without any transaction or write", async () => {
  const f = fixture(); await f.run(["project-one"]);
  assert.equal(f.transactions(), 0); assert.equal(f.writes.length, 0); assert.deepEqual(f.row, f.original);
  const output = JSON.parse(f.logs[0]);
  assert.equal(output.projectId, "project-one"); assert.equal(output.businessName, "Hearth & Harvest");
  assert.equal(output.connectAccountIdPresent, true); assert.equal(output.current.stripeConnectAccountId, "acct_sandbox");
  assert.equal(output.current.accountAttemptAt, new Date(0).toISOString());
  assert.deepEqual(output.fieldsToReset, safe);
});

test("confirmation resets only six fields on the selected row and preserves receipt counter and timestamps", async () => {
  const f = fixture(); const otherBefore = structuredClone(f.other);
  await f.run(["project-one", "--confirm"]);
  assert.deepEqual(f.row, { ...f.original, ...safe }); assert.deepEqual(f.other, otherBefore);
  assert.equal(f.writes.length, 1); assert.equal(f.writes[0].where.projectId, "project-one");
  assert.deepEqual(f.writes[0].data, { ...safe, updatedAt: f.original.updatedAt });
  assert.match(f.locks[0].sql, /pg_advisory_xact_lock/);
  assert.deepEqual(f.locks[0].values, ["merchant:project-one"]);
  assert.deepEqual(JSON.parse(f.logs[1]).resultingState, safe);
  await f.run(["project-one", "--confirm"]); assert.deepEqual(f.row, { ...f.original, ...safe });
});

test("missing project or settings fails without mutation", async () => {
  const f = fixture(); await assert.rejects(f.run(["missing", "--confirm"]), /Project not found/);
  f.db.websiteProject.findUnique = async () => ({ id: "project-one", paymentSettings: null });
  await assert.rejects(f.run(["project-one", "--confirm"]), /no ProjectPaymentSettings/);
  assert.equal(f.transactions(), 0);
});

test("concurrent changes abort before writing or reporting success", async () => {
  const f = fixture(); const transaction = f.db.$transaction;
  f.db.$transaction = async (work) => { f.row.stripeConnectAccountId = "acct_new"; return transaction(work); };
  await assert.rejects(f.run(["project-one", "--confirm"]));
  assert.equal(f.writes.length, 0); assert.equal(f.logs.length, 1);
});

test("transaction failure does not report a successful reset", async () => {
  const f = fixture(); f.db.$transaction = async () => { throw new Error("Database unavailable"); };
  await assert.rejects(f.run(["project-one", "--confirm"]), /Database unavailable/);
  assert.deepEqual(f.row, f.original); assert.equal(f.logs.length, 1);
});
