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
 * Alias for RequirePermission - for backward compatibility with existing code
 * Usage: @RequirePermissions('materials:read')
 * 
 * @param permission - Permission string in format 'resource:action' or legacy format like 'ADMIN_ACCESS'
 */
export const RequirePermissions = (permission: string) => {
  // For legacy permissions like 'ADMIN_ACCESS', 'SHIPPING_WRITE', etc.
  // we'll map them to resource:action format
  if (permission.includes(':')) {
    const [resource, action] = permission.split(':');
    return SetMetadata('permission', { resource, action });
  }
  // Legacy format - treat as a single resource with 'write' action
  return SetMetadata('permission', { resource: permission, action: 'write' });
};

/**
 * Helper decorator to extract permission metadata from handler/class
 */
export const getPermissionMetadata = (
  context: ExecutionContext,
): { resource: string; action: string } | null => {
  const handler = context.getHandler();
  const classRef = context.getClass();
  
  // Try to get metadata from handler first, then from class
  const metadata = Reflect.getMetadata('permission', handler) || 
                   Reflect.getMetadata('permission', classRef);
  
  return metadata || null;
};
