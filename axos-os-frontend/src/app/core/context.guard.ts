import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { EnterpriseContextService } from './enterprise-context.service';

/**
 * ContextGuard ensures that the user has selected a valid industrial context
 * (Site/Building/Program) before accessing the operational modules.
 */
export const contextGuard: CanActivateFn = (route, state) => {
  const contextService = inject(EnterpriseContextService);
  const router = inject(Router);

  // If the context is configured, allow navigation
  if (contextService.context().isConfigured) {
    return true;
  }

  // Otherwise, redirect to the context selection gate
  // We pass the intended URL to return after selection if needed
  return router.createUrlTree(['/context-gate'], {
    queryParams: { returnUrl: state.url }
  });
};
