import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getRemainingVehicleSlots,
  hasReachedVehicleLimit,
  MAX_VEHICLES_PER_USER,
} from "../src/app/garagem/_lib/vehicle-registration-limit.js";

test("calcula quantas vagas ainda estão disponíveis na garagem", () => {
  assert.equal(MAX_VEHICLES_PER_USER, 5);
  assert.equal(getRemainingVehicleSlots(0), 5);
  assert.equal(getRemainingVehicleSlots(3), 2);
  assert.equal(getRemainingVehicleSlots(5), 0);
  assert.equal(getRemainingVehicleSlots(7), 0);
});

test("considera o limite total de veículos ativos atingido", () => {
  assert.equal(hasReachedVehicleLimit(4), false);
  assert.equal(hasReachedVehicleLimit(5), true);
  assert.equal(hasReachedVehicleLimit(6), true);
});
