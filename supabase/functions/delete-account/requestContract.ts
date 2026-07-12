export function deletionRequestMatchesAuthenticatedOwner(
  expectedOwnerUserId: unknown,
  authenticatedUserId: string,
): boolean {
  return (
    typeof expectedOwnerUserId === "string" &&
    expectedOwnerUserId.length > 0 &&
    expectedOwnerUserId === authenticatedUserId
  );
}
