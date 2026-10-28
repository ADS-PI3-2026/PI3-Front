import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getAuthenticatedHomePath,
  hasUserRole,
  isAdminUser,
} from "../src/app/lib/user-access.js";

test("direciona administradores para o painel administrativo", () => {
  const user = { id: 1, roles: ["admin"] };

  assert.equal(hasUserRole(user, "admin"), true);
  assert.equal(isAdminUser(user), true);
  assert.equal(getAuthenticatedHomePath(user), "/admin");
});

test("mantém usuários comuns na garagem", () => {
  for (const user of [
    { id: 2, roles: ["client"] },
    { id: 3, roles: [] },
    { id: 4 },
  ]) {
    assert.equal(isAdminUser(user), false);
    assert.equal(getAuthenticatedHomePath(user), "/garagem");
  }
});
