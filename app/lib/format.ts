// yoctoNEAR <-> NEAR string conversion, shared by any page displaying a
// NearToken value from the Mandate or Task Market contracts.
const YOCTO_PER_NEAR = 10n ** 24n;

export function toYocto(near: string): string {
  const [whole, frac = ""] = near.split(".");
  const fracPadded = (frac + "0".repeat(24)).slice(0, 24);
  return (BigInt(whole || "0") * YOCTO_PER_NEAR + BigInt(fracPadded || "0")).toString();
}

export function toNear(yocto: string): string {
  const v = BigInt(yocto);
  const whole = v / YOCTO_PER_NEAR;
  const frac = v % YOCTO_PER_NEAR;
  const fracStr = frac.toString().padStart(24, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}
