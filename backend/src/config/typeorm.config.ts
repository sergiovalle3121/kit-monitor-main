import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const typeormFactory = (config: ConfigService): TypeOrmModuleOptions => {
  const isProd = config.get<string>('NODE_ENV') === 'production';
  const dbUrl = config.get<string>('DATABASE_URL');

  // Permite usar DATABASE_URL en prod y variables separadas en dev
  const base: Partial<TypeOrmModuleOptions> = dbUrl
    ? {
        type: 'postgres',
        url: dbUrl,
      }
    : {
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: parseInt(config.get('DB_PORT', '5432'), 10),
        username: config.get('DB_USER', 'postgres'),
        password: config.get('DB_PASS', ''),
        database: config.get('DB_NAME', 'kit_monitor'),
      };

  // Activa logs si TYPEORM_LOGGING=true (útil para depurar) — apágalo luego
  const logging =
    (config.get('TYPEORM_LOGGING') ?? (isProd ? 'false' : 'true')) === 'true';

  // Para LEVANTAR YA en prod, pon TYPEORM_SYNC=true en Railway una sola vez.
  const synchronize =
    (config.get('TYPEORM_SYNC') ?? (isProd ? 'false' : 'true')) === 'true';

  return {
    ...base,
    autoLoadEntities: true,
    // Railway requiere SSL; en dev local lo apagamos
    ssl: dbUrl && isProd ? { rejectUnauthorized: false } : false,
    synchronize,
    logging,
  } as TypeOrmModuleOptions;
};

export default typeormFactory;


