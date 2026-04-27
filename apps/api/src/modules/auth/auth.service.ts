import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(identifier: string, pass: string): Promise<User> {
    const normalizedIdentifier = (identifier ?? "").trim();
    const normalizedPass = String(pass ?? "");
    const user = await this.usersService.findOneByIdentifier(normalizedIdentifier);

    if (user && user.isActive !== false && (await bcrypt.compare(normalizedPass, user.password))) {
      return user;
    }
    throw new UnauthorizedException('Credenciales incorrectas');
  }

  async login(user: User) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
