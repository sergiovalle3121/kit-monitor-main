import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiService, ReqUser } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { ConfigDto } from './dto/config.dto';

interface AuthReq {
  user: ReqUser;
}

/** Minimal slice of the HTTP response we need for Server-Sent Events. */
interface SseResponse {
  setHeader(name: string, value: string): void;
  write(chunk: string): void;
  end(): void;
  flushHeaders?(): void;
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

  /**
   * Streaming chat (Server-Sent Events). Emits `meta` (conversation + model),
   * then `tool` and `delta` events as the answer is produced, and finally
   * `done` with the persisted result — or `error` if something fails. Always
   * closes the stream. Available to every authenticated user.
   */
  @Post('chat/stream')
  async chatStream(
    @Request() req: AuthReq,
    @Body() dto: ChatDto,
    @Res() res: SseResponse,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // Disable proxy buffering (nginx/Railway) so tokens flush immediately.
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      await this.ai.chatStream(req.user, dto, {
        onMeta: (m) => send('meta', m),
        onDelta: (text) => send('delta', { text }),
        onTool: (name) => send('tool', { name }),
        onDone: (payload) => send('done', payload),
        onError: (message, status) => send('error', { message, status }),
      });
    } catch (e) {
      send('error', {
        message: e instanceof Error ? e.message : 'Error en el flujo de CIDE.',
      });
    } finally {
      res.end();
    }
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

  /** Probe the inference engine: is CIDE actually reachable and the model loaded? */
  @Get('health')
  health(@Request() req: AuthReq) {
    this.assertAdmin(req);
    return this.ai.engineHealth(req.user);
  }

  private assertAdmin(req: AuthReq) {
    if (req.user?.role !== 'Admin') {
      throw new ForbiddenException(
        'Solo un administrador puede gestionar la IA.',
      );
    }
  }
}
