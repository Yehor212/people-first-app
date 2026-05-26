import {
  GENERATED_SECRET_NAMES,
  type GeneratedSecretName,
  type GeneratedSecrets,
} from "./secret-bootstrap";

export function parseGeneratedSecretsEnv(content: string): Partial<GeneratedSecrets> {
  const values: Partial<GeneratedSecrets> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const name = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1);
    if (isGeneratedSecretName(name)) {
      values[name] = value;
    }
  }

  return values;
}

export function requireGeneratedSecret(
  secrets: Partial<GeneratedSecrets>,
  name: GeneratedSecretName
): string {
  const value = secrets[name];
  if (!value) {
    throw new Error(`${name} is missing from generated secrets file`);
  }
  if (value.length < 32) {
    throw new Error(`${name} is shorter than 32 characters`);
  }
  return value;
}

function isGeneratedSecretName(value: string): value is GeneratedSecretName {
  return GENERATED_SECRET_NAMES.includes(value as GeneratedSecretName);
}
