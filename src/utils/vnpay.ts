import { createHmac } from "node:crypto";

export type VnpParams = Record<string, string>;

function sortParams(params: VnpParams): VnpParams {
  return Object.keys(params)
    .sort()
    .reduce<VnpParams>((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});
}

export function signVnpay(params: VnpParams, secret: string): string {
  const sorted = sortParams(params);
  const data = Object.entries(sorted)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  return createHmac("sha512", secret).update(data, "utf8").digest("hex");
}

export function verifyVnpay(params: VnpParams, secureHash: string, secret: string): boolean {
  const cloned = { ...params };
  delete cloned.vnp_SecureHash;
  delete cloned.vnp_SecureHashType;
  return signVnpay(cloned, secret).toLowerCase() === secureHash.toLowerCase();
}
