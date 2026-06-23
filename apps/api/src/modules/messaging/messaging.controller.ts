import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
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

  @Get('search')
  search(@Req() req: any, @Query('q') q: string) {
    return this.messaging.searchMessages(this.me(req), q ?? '');
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
    @Body()
    body: { name: string; memberIds?: string[]; announcement?: boolean },
  ) {
    return this.messaging.createChannel(
      this.me(req),
      body?.name,
      body?.memberIds ?? [],
      !!body?.announcement,
    );
  }

  @Post('conversations/:id/announcement')
  setAnnouncement(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { announcement?: boolean },
  ) {
    return this.messaging.setAnnouncement(
      this.me(req),
      id,
      body?.announcement !== false,
    );
  }

  // ── reuniones programadas ──────────────────────────────────────────────────
  @Get('conversations/:id/meetings')
  listMeetings(@Req() req: any, @Param('id') id: string) {
    return this.messaging.listMeetings(this.me(req), id);
  }

  @Post('conversations/:id/meetings')
  createMeeting(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      title: string;
      startAt: string;
      durationMin?: number;
      recurrence?: string;
    },
  ) {
    return this.messaging.createMeeting(
      this.me(req),
      id,
      body?.title,
      body?.startAt,
      body?.durationMin ?? 30,
      body?.recurrence ?? 'none',
    );
  }

  @Delete('meetings/:id')
  cancelMeeting(@Req() req: any, @Param('id') id: string) {
    return this.messaging.cancelMeeting(this.me(req), id);
  }

  // ── administración de canales ──────────────────────────────────────────────
  @Post('conversations/:id/members')
  addMembers(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { userIds?: string[] },
  ) {
    return this.messaging.addMembers(this.me(req), id, body?.userIds ?? []);
  }

  @Delete('conversations/:id/members/:userId')
  removeMember(
    @Req() req: any,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.messaging.removeMember(this.me(req), id, userId);
  }

  @Patch('conversations/:id')
  renameChannel(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { name: string },
  ) {
    return this.messaging.renameChannel(this.me(req), id, body?.name);
  }

  @Post('conversations/:id/leave')
  leaveChannel(@Req() req: any, @Param('id') id: string) {
    return this.messaging.removeMember(this.me(req), id, this.me(req));
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

  @Put('conversations/:id/labels')
  setLabels(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { labels?: string[] },
  ) {
    return this.messaging.setConversationLabels(
      this.me(req),
      id,
      body?.labels ?? [],
    );
  }

  // ── estado personal de la conversación (fijar/archivar/silenciar/no leído) ──
  @Post('conversations/:id/pin')
  setPinned(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { pinned?: boolean },
  ) {
    return this.messaging.setPinned(this.me(req), id, body?.pinned !== false);
  }

  @Post('conversations/:id/archive')
  setArchived(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { archived?: boolean },
  ) {
    return this.messaging.setArchived(this.me(req), id, body?.archived !== false);
  }

  @Post('conversations/:id/mute')
  setMuted(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { until?: string | null },
  ) {
    return this.messaging.setMuted(this.me(req), id, body?.until ?? null);
  }

  @Post('conversations/:id/unread')
  setUnread(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { unread?: boolean },
  ) {
    return this.messaging.setMarkedUnread(
      this.me(req),
      id,
      body?.unread !== false,
    );
  }

  @Get('conversations/:id/media')
  listMedia(
    @Req() req: any,
    @Param('id') id: string,
    @Query('kind') kind?: string,
  ) {
    return this.messaging.listMedia(this.me(req), id, kind ?? 'image');
  }

  @Get('unfurl')
  unfurl(@Query('url') url: string) {
    return this.messaging.unfurl(url ?? '');
  }

  @Get('saved')
  listSaved(@Req() req: any) {
    return this.messaging.listSaved(this.me(req));
  }

  @Get('messages/:id/thread')
  getThread(@Req() req: any, @Param('id') id: string) {
    return this.messaging.getThread(this.me(req), id);
  }

  @Post('messages/:id/save')
  setSaved(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { saved?: boolean },
  ) {
    return this.messaging.setSaved(this.me(req), id, body?.saved !== false);
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

  @Post('conversations/:id/disappearing')
  setDisappearing(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { seconds?: number },
  ) {
    return this.messaging.setDisappearing(this.me(req), id, body?.seconds ?? 0);
  }

  @Get('conversations/:id/scheduled')
  listScheduled(@Req() req: any, @Param('id') id: string) {
    return this.messaging.listScheduled(this.me(req), id);
  }

  @Post('messages/poll')
  createPoll(
    @Req() req: any,
    @Body()
    body: {
      conversationId: string;
      question: string;
      options: string[];
      multi?: boolean;
    },
  ) {
    return this.messaging.createPoll(
      this.me(req),
      body?.conversationId,
      body?.question,
      body?.options ?? [],
      !!body?.multi,
    );
  }

  @Post('messages/:id/vote')
  votePoll(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { optionId: string },
  ) {
    return this.messaging.votePoll(this.me(req), id, body?.optionId);
  }

  @Post('messages/schedule')
  scheduleMessage(
    @Req() req: any,
    @Body() body: { conversationId: string; body: string; sendAt: string },
  ) {
    return this.messaging.scheduleMessage(
      this.me(req),
      body?.conversationId,
      body?.body,
      body?.sendAt,
    );
  }

  @Delete('scheduled/:id')
  cancelScheduled(@Req() req: any, @Param('id') id: string) {
    return this.messaging.cancelScheduled(this.me(req), id);
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
