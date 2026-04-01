import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const token = (typeof localStorage !== "undefined") ? localStorage.getItem("token") : null;

  const url = req.url.startsWith("http")
    ? req.url
    : `${environment.apiUrl}${req.url.startsWith("/") ? "" : "/"}${req.url}`;

  let clone = req.clone({ url });

  if (token) {
    clone = clone.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(clone);
};
