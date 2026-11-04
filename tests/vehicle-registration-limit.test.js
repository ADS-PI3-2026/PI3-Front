import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getRemainingVehicleRegistrations,
  hasReachedVehicleRegistrationLimit,
  MAX_DIRECT_VEHICLE_REGISTRATIONS,
} from "../src/app/garagem/_lib/vehicle-registration-limit.js";

test("calcula apenas quantos cadastros diretos ainda estão disponíveis", () => {
  assert.equal(MAX_DIRECT_VEHICLE_REGISTRATIONS, 5);
  assert.equal(getRemainingVehicleRegistrations(0), 5);
  assert.equal(getRemainingVehicleRegistrations(3), 2);
  assert.equal(getRemainingVehicleRegistrations(5), 0);
  assert.equal(getRemainingVehicleRegistrations(7), 0);
});

test("considera o limite atingido mesmo após receber veículos por transferência", () => {
  assert.equal(hasReachedVehicleRegistrationLimit(4), false);
  assert.equal(hasReachedVehicleRegistrationLimit(5), true);
  assert.equal(hasReachedVehicleRegistrationLimit(6), true);
});
