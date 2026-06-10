import { createHmac } from "node:crypto";

export type VnpParams = Record<string, string>;

export function sortParams(params: VnpParams): VnpParams {
  return Object.keys(params)
    .sort()
    .reduce<VnpParams>((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});
}

function toQueryString(params: VnpParams): string {
  return Object.entries(sortParams(params))
    .map(([key, value]) =>
      `${encodeURIComponent(key)}=${encodeURIComponent(value).replace(/%20/g, "+")}`,
    )
    .join("&");
}

export function signVnpay(params: VnpParams, secret: string): string {
  const data = toQueryString(params);
  return createHmac("sha512", secret).update(data, "utf8").digest("hex");
}

export function buildVnpayUrl(baseUrl: string, params: VnpParams, secret: string): string {
  const data = toQueryString(params);
  const secureHash = createHmac("sha512", secret).update(data, "utf8").digest("hex");
  return `${baseUrl}?${data}&vnp_SecureHash=${secureHash}`;
}

export function verifyVnpay(params: VnpParams, secureHash: string, secret: string): boolean {
  const cloned = { ...params };
  delete cloned.vnp_SecureHash;
  delete cloned.vnp_SecureHashType;
  return signVnpay(cloned, secret).toLowerCase() === secureHash.toLowerCase();
}
