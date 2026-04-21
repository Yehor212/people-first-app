// @vitest-environment node

import { describe, expect, it } from "vitest";
import viteConfig from "../vite.config";

describe("vite manualChunks TDZ guards", () => {
  const config = viteConfig({
    command: "build",
    mode: "production",
    isSsrBuild: false,
    isPreview: false,
  });
  const output = config.build?.rollupOptions?.output;
  const manualChunks =
    output && !Array.isArray(output) ? output.manualChunks : undefined;

  if (typeof manualChunks !== "function") {
    throw new Error("Expected manualChunks to be a function");
  }

  const meta = {
    getModuleIds: function* () {},
    getModuleInfo: () => null,
  };

  it("keeps core i18n modules in the main chunk", () => {
    expect(
      manualChunks("C:/project/people-first-app/src/i18n/translations.ts", meta),
    ).toBeUndefined();
    expect(
      manualChunks("C:/project/people-first-app/src/i18n/index.ts", meta),
    ).toBeUndefined();
  });

  it("does not manually split React-dependent UI libraries", () => {
    expect(
      manualChunks(
        "C:/project/people-first-app/node_modules/@radix-ui/react-dialog/dist/index.mjs",
        meta,
      ),
    ).toBeUndefined();
    expect(
      manualChunks(
        "C:/project/people-first-app/node_modules/framer-motion/dist/es/index.mjs",
        meta,
      ),
    ).toBeUndefined();
  });

  it("still splits approved non-React vendors into stable chunks", () => {
    expect(
      manualChunks(
        "C:/project/people-first-app/node_modules/@supabase/supabase-js/dist/module/index.js",
        meta,
      ),
    ).toBe("supabase");
    expect(
      manualChunks(
        "C:/project/people-first-app/node_modules/lucide-react/dist/esm/lucide-react.js",
        meta,
      ),
    ).toBe("lucide-icons");
  });
});
