import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { successResponse } from "../common/api-response";
import { AuthService, LoginResult } from "./auth.service";
import { RequestWithUser } from "./auth.types";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() loginDto: LoginDto) {
    const result: LoginResult = await this.authService.login(
      loginDto.username,
      loginDto.password,
    );

    return successResponse("Login successful", result);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@Req() request: RequestWithUser) {
    const user = await this.authService.getCurrentUser(request.user.id);

    return successResponse("Current user retrieved successfully", user);
  }
}
