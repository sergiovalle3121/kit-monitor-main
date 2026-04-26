import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Este middleware protege todas las rutas dentro de /dashboard
export function middleware(request: NextRequest) {
  // Por ahora, simulamos la verificación de una cookie de sesión o token
  const isAuthenticated = request.cookies.get('axos_session');

  // Si el usuario intenta entrar al dashboard y NO está autenticado
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!isAuthenticated) {
      // Redirigir a la página de login
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

// Configuración para que el middleware solo actúe en las rutas del dashboard
export const config = {
  matcher: ['/dashboard/:path*'],
};
