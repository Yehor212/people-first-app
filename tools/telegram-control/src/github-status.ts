import type { ActivationCheck, ActivationStatus } from "./activation-doctor";

const GITHUB_STATUS_URL = "https://www.githubstatus.com/api/v2/summary.json";
const REQUIRED_COMPONENTS = ["Actions", "Pages"] as const;

interface GitHubStatusComponent {
  name?: unknown;
  status?: unknown;
}

interface GitHubStatusIncident {
  name?: unknown;
  status?: unknown;
  started_at?: unknown;
  components?: unknown;
  incident_updates?: unknown;
}

interface GitHubIncidentComponent {
  name?: unknown;
}

interface GitHubIncidentUpdate {
  affected_components?: unknown;
}

interface GitHubStatusSummary {
  components?: unknown;
  incidents?: unknown;
}

export async function fetchGitHubStatusChecks(fetchImpl: typeof fetch = fetch): Promise<ActivationCheck[]> {
  try {
    const response = await fetchImpl(GITHUB_STATUS_URL, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return [
        {
          name: "GitHub Status",
          status: "UNVERIFIED",
          evidence: `GitHub Status API returned HTTP ${response.status}`,
        },
      ];
    }
    return buildGitHubStatusChecks((await response.json()) as GitHubStatusSummary);
  } catch (error) {
    return [
      {
        name: "GitHub Status",
        status: "UNVERIFIED",
        evidence: error instanceof Error ? error.message : String(error),
      },
    ];
  }
}

export function buildGitHubStatusChecks(summary: GitHubStatusSummary): ActivationCheck[] {
  const components = Array.isArray(summary.components) ? (summary.components as GitHubStatusComponent[]) : [];
  const incidents = Array.isArray(summary.incidents) ? (summary.incidents as GitHubStatusIncident[]) : [];

  return REQUIRED_COMPONENTS.map((componentName) => {
    const component = components.find((candidate) => stringValue(candidate.name) === componentName);
    const componentStatus = stringValue(component?.status);
    const activeIncident = findActiveIncidentForComponent(incidents, componentName);
    if (!componentStatus) {
      return {
        name: `GitHub ${componentName} status`,
        status: "UNVERIFIED",
        evidence: "component missing from GitHub Status summary",
      };
    }

    return {
      name: `GitHub ${componentName} status`,
      status: statusForGitHubComponent(componentStatus),
      evidence: gitHubStatusEvidence(componentName, componentStatus, activeIncident),
    };
  });
}

function findActiveIncidentForComponent(
  incidents: readonly GitHubStatusIncident[],
  componentName: string,
): GitHubStatusIncident | undefined {
  return incidents.find((incident) => {
    if (stringValue(incident.status) === "resolved") {
      return false;
    }
    return incidentTouchesComponent(incident, componentName);
  });
}

function incidentTouchesComponent(incident: GitHubStatusIncident, componentName: string): boolean {
  const components = Array.isArray(incident.components) ? (incident.components as GitHubIncidentComponent[]) : [];
  if (components.some((component) => stringValue(component.name) === componentName)) {
    return true;
  }

  const updates = Array.isArray(incident.incident_updates) ? (incident.incident_updates as GitHubIncidentUpdate[]) : [];
  return updates.some((update) => {
    const affectedComponents = Array.isArray(update.affected_components)
      ? (update.affected_components as GitHubIncidentComponent[])
      : [];
    return affectedComponents.some((component) => stringValue(component.name) === componentName);
  });
}

function statusForGitHubComponent(status: string): ActivationStatus {
  return status === "operational" ? "PASS" : "FAIL";
}

function gitHubStatusEvidence(
  componentName: string,
  status: string,
  incident: GitHubStatusIncident | undefined,
): string {
  const incidentName = stringValue(incident?.name);
  const startedAt = stringValue(incident?.started_at);
  const incidentSuffix = incidentName
    ? `; active incident: ${incidentName}${startedAt ? ` since ${startedAt}` : ""}`
    : "";
  return `${componentName} is ${status} on GitHub Status${incidentSuffix}`;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
