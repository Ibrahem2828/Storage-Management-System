import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { successResponse } from "../common/api-response";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  async getSummary() {
    const summary = await this.dashboardService.getSummary();

    return successResponse("Dashboard summary loaded successfully", summary);
  }

  @Get("recent-assignments")
  async getRecentAssignments() {
    const assignments = await this.dashboardService.getRecentAssignments();

    return successResponse(
      "Recent assignments loaded successfully",
      assignments,
    );
  }
}
