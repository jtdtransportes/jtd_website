const MOJIBAKE_MARKERS = /[\u00c2\u00c3]/;

export function fixMojibake(value) {
  if (typeof value !== "string" || !MOJIBAKE_MARKERS.test(value)) {
    return value;
  }

  try {
    const decoded = Buffer.from(value, "latin1").toString("utf8");
    return decoded.includes("\ufffd") ? value : decoded;
  } catch {
    return value;
  }
}

export function fixObjectTextFields(item, fields) {
  if (!item || typeof item !== "object") {
    return item;
  }

  return fields.reduce(
    (normalized, field) => ({
      ...normalized,
      [field]: fixMojibake(normalized[field]),
    }),
    { ...item }
  );
}
