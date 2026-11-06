export type { SharedRouter, TrpcInterfaceClient } from "./shared/shared-router";
export { createTrpcProxyServiceClient } from "./shared/client";

export type { AppContext } from "./context/context.server";
export {
  getProjectOwnerId,
  getProjectPlanFeatures,
  getPlanFeaturesByOwnerId,
  ORGANIZEOS_SERVICE_PROVIDER,
} from "./context/project-plan.server";

export {
  AuthorizationError,
  PlanRequiredError,
  createErrorResponse,
} from "./context/errors.server";
export * as authorizeProject from "./authorize/project.server";
export {
  ownerPermit,
  projectPermits,
  type AuthPermit,
  type OwnerPermit,
  type ProjectPermit,
} from "./authorize/project-permits";

export {
  router,
  procedure,
  middleware,
  mergeRouters,
  createCacheMiddleware,
  createCallerFactory,
} from "./context/router.server";
