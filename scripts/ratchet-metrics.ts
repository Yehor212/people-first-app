export function isDebtMarkerComment(line: string): boolean {
  return /(?:\/\/|\/\*+|\*)\s*(?:TODO|FIXME|HACK|XXX)\b/.test(line);
}
