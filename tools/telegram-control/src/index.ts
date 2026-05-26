export { ControlWorkflow } from "./workflow";
import { routeRequest } from "./router";
import type { Env } from "./types";

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return routeRequest(request, env);
  },
};
