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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiService, ReqUser } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { ConfigDto } from './dto/config.dto';

interface AuthReq {
  user: ReqUser;
}

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** Chat with the copilot. Available to every authenticated user. */
  @Post('chat')
  chat(@Request() req: AuthReq, @Body() dto: ChatDto) {
    return this.ai.chat(req.user, dto);
  }

  @Get('conversations')
  conversations(@Request() req: AuthReq) {
    return this.ai.listConversations(req.user);
  }

  @Get('conversations/:id')
  conversation(@Request() req: AuthReq, @Param('id') id: string) {
    return this.ai.getConversation(req.user, id);
  }

  // ── Admin: per-tenant configuration + usage ─────────────────────────────────
  @Get('config')
  getConfig(@Request() req: AuthReq) {
    this.assertAdmin(req);
    return this.ai.getConfigPublic(req.user);
  }

  @Post('config')
  setConfig(@Request() req: AuthReq, @Body() dto: ConfigDto) {
    this.assertAdmin(req);
    return this.ai.setConfig(req.user, dto);
  }

  @Get('usage')
  usage(@Request() req: AuthReq) {
    this.assertAdmin(req);
    return this.ai.usageSummary(req.user);
  }

  private assertAdmin(req: AuthReq) {
    if (req.user?.role !== 'Admin') {
      throw new ForbiddenException(
        'Solo un administrador puede gestionar la IA.',
      );
    }
  }
}
