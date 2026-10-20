import assert from "node:assert/strict";
import { test } from "node:test";

test("reabrir recuperação após validar código retoma a nova senha enquanto a confirmação vale", async () => {
  const { getRecoveryStep } = await import("../src/app/lib/recovery-flow.js");
  assert.equal(getRecoveryStep({ email: "conta@example.test", sentAt: 1000, verifiedAt: 120000 }, 180000), "password");
  assert.equal(getRecoveryStep({ email: "conta@example.test", sentAt: 1000, verifiedAt: 120000 }, 720000), "email");
  assert.equal(getRecoveryStep({ email: "conta@example.test", sentAt: 1000 }, 120000), "code");
  assert.equal(getRecoveryStep({ email: "", sentAt: 0 }, 120000), "email");
});
