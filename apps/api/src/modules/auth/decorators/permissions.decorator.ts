import { SetMetadata, ExecutionContext, createParamDecorator } from '@nestjs/common';

/**
 * Decorator to require specific permissions for an endpoint.
 * Usage: @RequirePermission('finance', 'write')
 * 
 * @param resource - The resource name (e.g., 'finance', 'inventory')
 * @param action - The action name (e.g., 'read', 'write', 'delete')
 */
export const RequirePermission = (resource: string, action: string) =>
  SetMetadata('permission', { resource, action });

/**
 * Helper decorator to extract permission metadata from handler/class
 */
export const getPermissionMetadata = (
  context: ExecutionContext,
): { resource: string; action: string } | null => {
  const reflector = context.getClass ? undefined : undefined; // Will be provided by guard
  return null;
};
