const MOJIBAKE_MARKERS = /[\u00c2\u00c3]/;

export function fixMojibake(value) {
  if (typeof value !== "string" || !MOJIBAKE_MARKERS.test(value)) {
    return value;
  }

  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff)
    );

    return decoded;
  } catch {
    return value;
  }
}

export function normalizePopText(pop) {
  if (!pop || typeof pop !== "object") {
    return pop;
  }

  return {
    ...pop,
    title: fixMojibake(pop.title),
    file_name: fixMojibake(pop.file_name),
    original_name: fixMojibake(pop.original_name),
    sector_name: fixMojibake(pop.sector_name),
  };
}
