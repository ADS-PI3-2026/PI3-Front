import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { clearAuthSession, getAuthSession, saveAuthSession } from "../src/app/auth-session.js";

const originalWindow = globalThis.window;
const key = "legado-car-session";
let stored;
const user = { id: 1, name: "Pessoa Teste", email: "pessoa@example.test" };

function jwt(exp) {
  return `header.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.signature`;
}

beforeEach(() => {
  stored = new Map();
  globalThis.window = { sessionStorage: {
    getItem: (name) => stored.get(name) ?? null,
    setItem: (name, value) => stored.set(name, value),
    removeItem: (name) => stored.delete(name),
  } };
});

afterEach(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

test("salva sessão real de login com validade e sem as credenciais do formulário", () => {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const session = saveAuthSession({
    authResult: { mode: "api", data: { access_token: jwt(expires), token_type: "bearer", expires_in: 3600, user } },
    password: "senha-que-nao-deve-ser-salva",
  });
  assert.equal(session.expiresAt, expires * 1000);
  assert.deepEqual(getAuthSession().user, user);
  assert.equal(session.email, user.email);
  assert.equal(stored.get(key).includes("senha-que-nao-deve-ser-salva"), false);
  clearAuthSession();
  assert.equal(getAuthSession(), null);
});

test("cadastro automático usa exp do JWT mesmo sem expires_in", () => {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  saveAuthSession({ authResult: { mode: "api", status: 201, data: { access_token: jwt(expires), user } } });
  assert.equal(getAuthSession().expiresAt, expires * 1000);
});

test("sessões anteriores só continuam se forem reais e ainda válidas", () => {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  stored.set(key, JSON.stringify({ mode: "api", accessToken: jwt(expires), user }));
  assert.equal(getAuthSession().expiresAt, expires * 1000);
});

test("descarta sessão demonstrativa, inválida, corrompida ou expirada", () => {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const valid = { mode: "api", accessToken: jwt(expires), user };
  for (const session of [
    { ...valid, mode: "preview" }, { ...valid, accessToken: "" }, { ...valid, user: null },
    { ...valid, expiresAt: Date.now() - 1 }, { ...valid, accessToken: jwt(expires - 7200) },
    { ...valid, accessToken: "sem-validade" }, null,
  ]) {
    stored.set(key, JSON.stringify(session));
    assert.equal(getAuthSession(), null);
    assert.equal(stored.has(key), false);
  }
  stored.set(key, "{");
  assert.equal(getAuthSession(), null);
  assert.equal(stored.has(key), false);
});

test("não cria sessão sem dados válidos ou com token vencido", () => {
  for (const authResult of [
    { mode: "preview", data: { user } },
    { mode: "api", data: { access_token: "token", user } },
    { mode: "api", data: { access_token: jwt(1), expires_in: 3600, user } },
  ]) {
    assert.throws(() => saveAuthSession({ authResult }));
    assert.equal(stored.has(key), false);
  }
});

test("armazenamento bloqueado não libera acesso e exibe erro compreensível ao salvar", () => {
  Object.defineProperty(globalThis.window, "sessionStorage", { get() { throw new Error("SecurityError"); } });
  assert.equal(getAuthSession(), null);
  assert.doesNotThrow(clearAuthSession);
  assert.throws(() => saveAuthSession({ authResult: { mode: "api", data: { access_token: jwt(Math.floor(Date.now() / 1000) + 3600), user } } }), /Permita o armazenamento/);
});
