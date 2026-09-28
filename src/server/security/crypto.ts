import "server-only";

export function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export function decode(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(
    atob(value.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
}
export function randomToken() {
  return encode(crypto.getRandomValues(new Uint8Array(32)));
}
export async function hash(value: string) {
  return encode(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  );
}
async function key(root: string) {
  if (!/^[a-f\d]{64}$/i.test(root))
    throw new Error("Invalid root key configuration.");
  return crypto.subtle.importKey(
    "raw",
    Uint8Array.from(root.match(/../g)!, (v) => parseInt(v, 16)),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encryptSecret(
  root: string,
  id: string,
  provider: string,
  payload: Record<string, string>,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(
        JSON.stringify([1, id, provider]),
      ),
      tagLength: 128,
    },
    await key(root),
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  return JSON.stringify({
    v: 1,
    iv: encode(iv),
    data: encode(new Uint8Array(ciphertext)),
  });
}
export async function decryptSecret(
  root: string,
  id: string,
  provider: string,
  envelope: string,
): Promise<Record<string, string>> {
  try {
    const { v, iv, data } = JSON.parse(envelope);
    if (
      v !== 1 ||
      typeof iv !== "string" ||
      typeof data !== "string" ||
      decode(iv).length !== 12
    )
      throw new Error();
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decode(iv),
        additionalData: new TextEncoder().encode(
          JSON.stringify([1, id, provider]),
        ),
        tagLength: 128,
      },
      await key(root),
      decode(data),
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error(
      "Credential could not be decrypted. Check the deployment key and data integrity.",
    );
  }
}
