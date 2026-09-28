import "server-only";
import type { ProviderDescriptor } from "../../features/credentials/types";
import { object, PublicError } from "../security/errors";

export interface CredentialProvider extends ProviderDescriptor {
  validate(payload: unknown): Record<string, string>;
  verify(payload: Record<string, string>): Promise<boolean>;
}
function testProvider(
  id: string,
  label: string,
  fields: ProviderDescriptor["fields"],
): CredentialProvider {
  return {
    id,
    name: label,
    fields,
    description:
      "Local test only. Verification succeeds when every field begins with test-valid-. No external account is checked.",
    validate(value) {
      const input = object(value);
      if (Object.keys(input).length !== fields.length)
        throw new PublicError("Complete the required secret fields.");
      const result: Record<string, string> = {};
      for (const { key } of fields) {
        if (
          typeof input[key] !== "string" ||
          !input[key] ||
          (input[key] as string).length > 4096
        )
          throw new PublicError(
            "Complete the required secret fields (maximum 4096 characters each).",
          );
        result[key] = input[key] as string;
      }
      return result;
    },
    async verify(payload) {
      return fields.every(({ key }) => payload[key].startsWith("test-valid-"));
    },
  };
}
const providers = [
  testProvider("test-token", "Test provider · token", [
    { key: "token", label: "Test token" },
  ]),
  testProvider("test-pair", "Test provider · key pair", [
    { key: "accessKey", label: "Test access key" },
    { key: "secretKey", label: "Test secret key" },
  ]),
];
export function providerFor(id: unknown) {
  const provider = providers.find((p) => p.id === id);
  if (!provider) throw new PublicError("Choose a supported test provider.");
  return provider;
}
export function providerDescriptors(): ProviderDescriptor[] {
  return providers.map(({ id, name, description, fields }) => ({
    id,
    name,
    description,
    fields,
  }));
}
