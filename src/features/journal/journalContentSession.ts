let journalContentVaultKey: string | null = null;

export function setJournalContentVaultKey(vaultKey: string | null): void {
  journalContentVaultKey = vaultKey;
}

export function getJournalContentVaultKey(): string | null {
  return journalContentVaultKey;
}
