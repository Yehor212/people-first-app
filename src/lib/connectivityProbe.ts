export const CONNECTIVITY_PROBE_PATH = "version.json";
export const CONNECTIVITY_PROBE_QUERY_PARAM = "zenflow-connectivity-probe";
export const CONNECTIVITY_PROBE_QUERY_VALUE = "network-only";
export const CONNECTIVITY_PROBE_TIMEOUT_MS = 5000;
export const CONNECTIVITY_EVIDENCE_SOURCE = "network-only-version-endpoint" as const;

export function buildConnectivityProbeUrl(baseUrl: string | URL): string {
  const url = new URL(CONNECTIVITY_PROBE_PATH, baseUrl);
  url.searchParams.set(CONNECTIVITY_PROBE_QUERY_PARAM, CONNECTIVITY_PROBE_QUERY_VALUE);
  return url.href;
}

export function isNetworkOnlyConnectivityProbeUrl(
  url: URL,
  serviceWorkerScope: string,
): boolean {
  const expected = new URL(CONNECTIVITY_PROBE_PATH, serviceWorkerScope);
  return (
    url.origin === expected.origin &&
    url.pathname === expected.pathname &&
    url.searchParams.get(CONNECTIVITY_PROBE_QUERY_PARAM) ===
      CONNECTIVITY_PROBE_QUERY_VALUE
  );
}
