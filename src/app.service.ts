import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "./common/database/database.service";

export interface ApiRootStatus {
  name: string;
  status: "ok";
  version: "1.0.0";
}

export interface HealthStatus {
  status: "ok";
  database: "connected";
  timestamp: string;
}

@Injectable()
export class AppService {
  constructor(
    private readonly configService: ConfigService,
    private readonly database: DatabaseService,
  ) {}

  getRootStatus(): ApiRootStatus {
    return {
      name: this.configService.get<string>(
        "APP_NAME",
        "Storage Management System",
      ),
      status: "ok",
      version: "1.0.0",
    };
  }

  async getHealthStatus(): Promise<HealthStatus> {
    try {
      this.database.ping();
    } catch {
      throw new InternalServerErrorException(
        "Backend health check failed: database is not connected",
      );
    }

    return {
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    };
  }
}
