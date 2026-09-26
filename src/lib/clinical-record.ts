export function readableRecord(value: unknown, indent = ""): string {
  if (value === null || value === undefined || value === "") return "Not documented";
  if (Array.isArray(value)) return value.length ? value.map((item, index) => `${indent}Entry ${index + 1}\n${readableRecord(item, indent + "  ")}`).join("\n\n") : "No entries";
  if (typeof value === "object") return Object.entries(value).filter(([key]) => !["signature", "patient_signature", "clinician_signature", "witness_signature"].includes(key)).map(([key, item]) => `${indent}${key.replaceAll("_", " ")}: ${typeof item === "object" && item !== null ? "\n" : ""}${readableRecord(item, indent + "  ")}`).join("\n");
  return String(value);
}
