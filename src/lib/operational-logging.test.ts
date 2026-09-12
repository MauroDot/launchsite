import assert from "node:assert/strict";
import { test } from "node:test";
import { configStatus } from "./operational-logging";
test("configuration status exposes only configured or missing", () => { assert.equal(configStatus("value"), "CONFIGURED"); assert.equal(configStatus(""), "MISSING"); assert.equal(configStatus(undefined), "MISSING"); });
