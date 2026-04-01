import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './modules/users/users.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const usersService = app.get(UsersService);

    const admin = {
      email: 'admin@example.com',
      password: '123456', // se hasheará si tu servicio lo hace
      name: 'Admin',
      role: 'admin',
    };

    const exists = await (usersService as any).findByEmail?.(admin.email);
    if (exists) {
      console.log('⚠️ El usuario admin ya existe');
    } else {
      await (usersService as any).create(admin);
      console.log('✅ Usuario admin creado: admin@example.com / 123456');
    }
  } catch (error) {
    console.error('❌ Error en el seed:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
