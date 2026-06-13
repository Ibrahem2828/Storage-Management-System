import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { UsersService } from "../users/users.service";
import { SafeUser } from "../users/user.types";
import { JwtPayload } from "./auth.types";

export interface LoginResult {
  accessToken: string;
  user: Pick<SafeUser, "id" | "name" | "username">;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(username: string, password: string): Promise<LoginResult> {
    const user = await this.usersService.findByUsername(username);

    if (!user) {
      throw new UnauthorizedException("Invalid username or password");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid username or password");
    }

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload, {
        expiresIn: this.configService.get<string>("JWT_EXPIRES_IN", "1d"),
      }),
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
      },
    };
  }

  async getCurrentUser(id: number): Promise<SafeUser> {
    const user = await this.usersService.findById(id);

    if (!user) {
      throw new UnauthorizedException("User no longer exists");
    }

    return this.usersService.toSafeUser(user);
  }
}
