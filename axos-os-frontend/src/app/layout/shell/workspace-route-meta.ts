export const WORKSPACE_ROUTE_META = {
  domain: 'workspaceDomain',
  immersive: 'immersiveWorkspace',
} as const;

export type WorkspaceDomainId = 'materials' | 'production';

export function workspaceRouteData(domain: WorkspaceDomainId, immersive = true) {
  return {
    [WORKSPACE_ROUTE_META.domain]: domain,
    [WORKSPACE_ROUTE_META.immersive]: immersive,
  };
}
