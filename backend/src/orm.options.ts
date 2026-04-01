import { TypeOrmModuleOptions } from "@nestjs/typeorm";

export function ormOptions(): TypeOrmModuleOptions {
  const isProd = process.env.NODE_ENV === "production";
  const url = process.env.DATABASE_URL;
  const syncDefault = process.env.SYNCHRONIZE === "false" ? false : true; // por defecto true en dev

  const base: Partial<TypeOrmModuleOptions> = {
    type: "postgres",
    autoLoadEntities: true,
    ssl: isProd || (url?.includes("sslmode=require")) ? { rejectUnauthorized: false } : false,
  };

  if (url) {
    return {
      ...base,
      url,
      synchronize: isProd ? false : syncDefault,
    } as TypeOrmModuleOptions;
  }

  return {
    ...base,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME,
    password: String(process.env.DB_PASSWORD ?? ""),
    database: process.env.DB_DATABASE,
    synchronize: isProd ? false : syncDefault,
  } as TypeOrmModuleOptions;
}
