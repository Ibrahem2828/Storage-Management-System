import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MulterModule } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { UploadsModule } from "../uploads/uploads.module";
import {
  createSafeImageFilename,
  imageFileFilter,
} from "../uploads/image-upload.utils";
import { UploadsService } from "../uploads/uploads.service";
import { DevicesController } from "./devices.controller";
import { DevicesService } from "./devices.service";

@Module({
  imports: [
    UploadsModule,
    MulterModule.registerAsync({
      imports: [UploadsModule],
      inject: [ConfigService, UploadsService],
      useFactory: (
        _configService: ConfigService,
        uploadsService: UploadsService,
      ) => ({
        storage: diskStorage({
          destination: (_request, _file, callback) => {
            try {
              callback(null, uploadsService.ensureDeviceUploadsDirectory());
            } catch (error) {
              callback(error as Error, "");
            }
          },
          filename: (_request, file, callback) => {
            callback(null, createSafeImageFilename(file));
          },
        }),
        fileFilter: imageFileFilter,
        limits: {
          fileSize: 5 * 1024 * 1024,
        },
      }),
    }),
  ],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
