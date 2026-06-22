import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MessagingService } from './messaging.service';

@Controller('messaging')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  private me(req: any): string {
    return req.user.userId;
  }

  @Get('users')
  listUsers(@Req() req: any) {
    return this.messaging.listUsers(this.me(req));
  }

  @Get('conversations')
  listConversations(@Req() req: any) {
    return this.messaging.listConversations(this.me(req));
  }

  @Get('conversations/:id/messages')
  listMessages(
    @Req() req: any,
    @Param('id') id: string,
    @Query('before') before?: string,
  ) {
    return this.messaging.listMessages(this.me(req), id, before);
  }

  @Post('conversations/dm/:userId')
  openDm(@Req() req: any, @Param('userId') userId: string) {
    return this.messaging.getOrCreateDm(this.me(req), userId);
  }

  @Post('conversations/channel')
  createChannel(
    @Req() req: any,
    @Body() body: { name: string; memberIds?: string[] },
  ) {
    return this.messaging.createChannel(
      this.me(req),
      body?.name,
      body?.memberIds ?? [],
    );
  }

  @Post('conversations/:id/read')
  markRead(@Req() req: any, @Param('id') id: string) {
    return this.messaging.markRead(this.me(req), id);
  }

  @Get('conversations/:id/reads')
  listReads(@Req() req: any, @Param('id') id: string) {
    return this.messaging.listReads(this.me(req), id);
  }

  @Get('conversations/:id/pinned')
  listPinned(@Req() req: any, @Param('id') id: string) {
    return this.messaging.listPinned(this.me(req), id);
  }

  @Post('messages')
  sendText(
    @Req() req: any,
    @Body() body: { conversationId: string; body: string; replyToId?: string },
  ) {
    return this.messaging.sendText(
      this.me(req),
      body?.conversationId,
      body?.body,
      body?.replyToId,
    );
  }

  @Patch('messages/:id')
  editMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { body: string },
  ) {
    return this.messaging.editMessage(this.me(req), id, body?.body);
  }

  @Delete('messages/:id')
  deleteMessage(@Req() req: any, @Param('id') id: string) {
    return this.messaging.deleteMessage(this.me(req), id);
  }

  @Post('messages/:id/pin')
  pinMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { pinned?: boolean },
  ) {
    return this.messaging.pinMessage(this.me(req), id, body?.pinned !== false);
  }

  @Post('messages/:id/forward')
  forwardMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { conversationId: string },
  ) {
    return this.messaging.forwardMessage(this.me(req), id, body?.conversationId);
  }

  @Post('messages/call')
  sendCallLog(
    @Req() req: any,
    @Body()
    body: {
      conversationId: string;
      media?: string;
      status?: string;
      durationSec?: number;
    },
  ) {
    return this.messaging.sendCallLog(this.me(req), body?.conversationId, {
      media: body?.media,
      status: body?.status,
      durationSec: body?.durationSec,
    });
  }

  @Post('messages/:id/reactions')
  toggleReaction(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { emoji: string },
  ) {
    return this.messaging.toggleReaction(this.me(req), id, body?.emoji);
  }

  @Post('messages/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  sendImage(
    @Req() req: any,
    @Body() body: { conversationId: string; replyToId?: string },
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number },
  ) {
    return this.messaging.sendImage(
      this.me(req),
      body?.conversationId,
      file,
      body?.replyToId,
    );
  }

  @Get('messages/:id/image')
  async getImage(
    @Req() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { data, mime } = await this.messaging.getImage(this.me(req), id);
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(data);
  }

  @Post('messages/file')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  sendFile(
    @Req() req: any,
    @Body() body: { conversationId: string; replyToId?: string },
    @UploadedFile()
    file: {
      buffer: Buffer;
      mimetype: string;
      size: number;
      originalname?: string;
    },
  ) {
    return this.messaging.sendFile(
      this.me(req),
      body?.conversationId,
      file,
      body?.replyToId,
    );
  }

  @Get('messages/:id/file')
  async getFile(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const { data, mime, name } = await this.messaging.getFile(this.me(req), id);
    res.setHeader('Content-Type', mime);
    // RFC 5987: filename* admite UTF-8; el fallback ASCII evita romper clientes.
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    );
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(data);
  }
}
