import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { UploadsService } from "./uploads/uploads.service";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const uploadsService = app.get(UploadsService, { strict: false });
  const configuredOrigins = configService
    .get<string>("CORS_ORIGIN", "*")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.setGlobalPrefix("api");
  app.enableCors({
    origin: configuredOrigins.includes("*") ? true : configuredOrigins,
    credentials: true,
  });
  app.useStaticAssets(uploadsService.getUploadsDirectory(), {
    prefix: "/uploads/",
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = configService.get<number>("PORT", 4000);
  await app.listen(port, "0.0.0.0");

  console.log(`Backend is running on http://localhost:${port}/api`);
}

void bootstrap();
