import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

type AuthRequest = { user?: { email?: string; role?: string } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    return this.authService.login(user);
  }

  /** Public self-registration → pending until an admin approves. */
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: AuthRequest) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Request() req: AuthRequest) {
    return req.user;
  }

  // ── Admin user management ───────────────────────────────────────────────────
  private assertAdmin(req: AuthRequest) {
    if (req.user?.role !== 'Admin') {
      throw new ForbiddenException(
        'Solo un administrador puede gestionar usuarios.',
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('users')
  users(@Request() req: AuthRequest) {
    this.assertAdmin(req);
    return this.authService.listUsers();
  }

  @UseGuards(JwtAuthGuard)
  @Get('pending')
  pending(@Request() req: AuthRequest) {
    this.assertAdmin(req);
    return this.authService.listPending();
  }

  @UseGuards(JwtAuthGuard)
  @Post('users/:id/approve')
  approve(@Param('id') id: string, @Request() req: AuthRequest) {
    this.assertAdmin(req);
    return this.authService.approve(id, req.user?.email ?? 'admin');
  }

  @UseGuards(JwtAuthGuard)
  @Post('users/:id/reject')
  reject(@Param('id') id: string, @Request() req: AuthRequest) {
    this.assertAdmin(req);
    return this.authService.reject(id, req.user?.email ?? 'admin');
  }
}
