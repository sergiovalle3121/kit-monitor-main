import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  const token = localStorage.getItem('access_token');
  if (token) return true;
  // redirige a /login si no hay token
  const router = new Router();
  router.navigateByUrl('/login');
  return false;
};
