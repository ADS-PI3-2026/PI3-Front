import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  clearPendingOtpRequest,
  OTP_REQUEST_VALIDITY_MS,
  readPendingOtpRequest,
  savePendingOtpRequest,
} from "../src/app/lib/otp-request-state.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

function createSession(storage, sessionId = "session-1") {
  const expiresAt = Date.now() + 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(expiresAt / 1000) }))
    .toString("base64url");
  storage.setItem("legado-car-session", JSON.stringify({
    accessToken: `header.${payload}.signature`,
    expiresAt,
    mode: "api",
    sessionId,
    user: { email: "usuario@legadocar.com", id: 1 },
  }));
}

afterEach(() => {
  delete global.window;
});

test("mantém a etapa de OTP somente durante a validade e na mesma sessão", () => {
  const storage = createStorage();
  global.window = { sessionStorage: storage };
  createSession(storage);

  const requestedAt = Date.now();
  const saved = savePendingOtpRequest("change_plate_type", "vehicle-1", requestedAt);

  assert.equal(saved.expiresAt, requestedAt + OTP_REQUEST_VALIDITY_MS);
  assert.deepEqual(
    readPendingOtpRequest("change_plate_type", "vehicle-1"),
    saved,
  );

  createSession(storage, "session-2");
  assert.equal(readPendingOtpRequest("change_plate_type", "vehicle-1"), null);
});

test("descarta uma solicitação de OTP expirada", () => {
  const storage = createStorage();
  global.window = { sessionStorage: storage };
  createSession(storage);

  savePendingOtpRequest(
    "account_deletion",
    undefined,
    Date.now() - OTP_REQUEST_VALIDITY_MS - 1,
  );

  assert.equal(readPendingOtpRequest("account_deletion"), null);
});

test("permite cancelar a confirmação pendente e solicitar outro código", () => {
  const storage = createStorage();
  global.window = { sessionStorage: storage };
  createSession(storage);

  savePendingOtpRequest("vehicle_deletion", "vehicle-3");
  assert.ok(readPendingOtpRequest("vehicle_deletion", "vehicle-3"));

  clearPendingOtpRequest("vehicle_deletion", "vehicle-3");
  assert.equal(readPendingOtpRequest("vehicle_deletion", "vehicle-3"), null);
});
