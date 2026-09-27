export type CredentialStatus = "unverified" | "valid" | "invalid" | "error";
export interface CredentialMetadata {
  id: string;
  provider: string;
  name: string;
  status: CredentialStatus;
  isDefault: number;
  createdAt: number;
  updatedAt: number;
  lastVerifiedAt: number | null;
}
export interface ProviderDescriptor {
  id: string;
  name: string;
  description: string;
  fields: { key: string; label: string }[];
}
