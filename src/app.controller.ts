import { Controller, Get } from "@nestjs/common";
import { successResponse } from "./common/api-response";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot() {
    return successResponse(
      "Storage Management System API is running",
      this.appService.getRootStatus(),
    );
  }

  @Get("health")
  async getHealth() {
    const health = await this.appService.getHealthStatus();

    return successResponse("Backend health check passed", health);
  }
}
