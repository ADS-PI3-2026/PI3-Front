export const MAX_DIRECT_VEHICLE_REGISTRATIONS = 5;

export function getRemainingVehicleRegistrations(total) {
  const count = Number(total);
  if (!Number.isInteger(count) || count < 0) return MAX_DIRECT_VEHICLE_REGISTRATIONS;
  return Math.max(0, MAX_DIRECT_VEHICLE_REGISTRATIONS - count);
}

export function hasReachedVehicleRegistrationLimit(total) {
  return getRemainingVehicleRegistrations(total) === 0;
}
