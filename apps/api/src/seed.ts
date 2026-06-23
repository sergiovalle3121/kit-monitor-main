import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './modules/users/users.service';
import { UserRole } from './modules/users/entities/user.entity';
import { permissionsFor } from './modules/auth/rbac';

/**
 * Seed base: asegura un usuario administrador para arrancar una instancia vacía.
 *
 * Idempotente: si el admin ya existe, no hace nada. Crea el usuario con TODOS los
 * campos que el esquema actual exige —`username` es NOT NULL y el rol debe ser
 * exactamente `UserRole.ADMIN` ('Admin') para que el guard de permisos lo deje
 * pasar—. El password se hashea dentro de `UsersService.create`.
 *
 * Nota: el arranque normal de la app (`main.ts → ensurePlatformAdmins`) ya asegura
 * este admin; este script es el equivalente para flujos que sólo levantan el
 * contexto de Nest sin servidor HTTP (`npm run seed`).
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const usersService = app.get(UsersService);

    const email = 'admin@example.com';
    const password = process.env.BACKEND_SERVICE_PASSWORD || '31218223';

    const exists = await usersService.findOneByEmail(email);
    if (exists) {
      console.log(`⚠️  El usuario admin ya existe: ${email}`);
    } else {
      await usersService.create({
        email,
        username: email, // requerido (NOT NULL); paridad con ensurePlatformAdmins
        name: 'Admin',
        password, // se hashea en UsersService.create
        role: UserRole.ADMIN, // debe ser exactamente 'Admin' para el bypass del guard
        permissions: permissionsFor('admin'), // set completo: el frontend no lo limita
      });
      console.log(`✅ Usuario admin creado: ${email} / ${password}`);
    }
  } catch (error) {
    console.error('❌ Error en el seed:', error);
    process.exitCode = 1; // que el fallo se note en CI/scripts en vez de pasar silencioso
  } finally {
    await app.close();
  }
}

void bootstrap();
