export const MAX_VEHICLES_PER_USER = 5;

export function getRemainingVehicleSlots(total) {
  const count = Number(total);
  if (!Number.isInteger(count) || count < 0) return MAX_VEHICLES_PER_USER;
  return Math.max(0, MAX_VEHICLES_PER_USER - count);
}

export function hasReachedVehicleLimit(total) {
  return getRemainingVehicleSlots(total) === 0;
}
