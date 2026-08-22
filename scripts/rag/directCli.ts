import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export interface DirectCliInvocationOptions {
  canonicalize?: (candidate: string) => string;
  cwd?: string;
  platform?: NodeJS.Platform;
}

export function isDirectCliInvocation(
  moduleUrl: string,
  argvPath: string | undefined,
  options: DirectCliInvocationOptions = {}
): boolean {
  if (!argvPath) return false;

  const platform = options.platform ?? process.platform;
  const windows = platform === "win32";
  const pathApi = windows ? path.win32 : path.posix;
  const cwd = options.cwd ?? process.cwd();
  const canonicalize = options.canonicalize ?? realpathSync.native;

  try {
    const modulePath = fileURLToPath(moduleUrl, { windows });
    const resolvedArgvPath = pathApi.isAbsolute(argvPath)
      ? pathApi.normalize(argvPath)
      : pathApi.resolve(cwd, argvPath);
    const canonicalModuleUrl = pathToFileURL(canonicalize(modulePath), { windows }).href;
    const canonicalArgvUrl = pathToFileURL(canonicalize(resolvedArgvPath), { windows }).href;
    return canonicalModuleUrl === canonicalArgvUrl;
  } catch {
    return false;
  }
}
