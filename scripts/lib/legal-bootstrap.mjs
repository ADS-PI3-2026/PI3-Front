export function buildLegalBootstrapUpdates(settings, originals) {
  return settings.flatMap(setting => {
    const original = Object.hasOwn(originals, setting.key) ? originals[setting.key] : null;
    return original && setting.value === original.placeholder
      ? [{ key: setting.key, value: original.value }]
      : [];
  });
}
