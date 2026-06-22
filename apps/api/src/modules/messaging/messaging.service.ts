import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, IsNull, LessThanOrEqual } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationMember } from './entities/conversation-member.entity';
import { Message, MessageType } from './entities/message.entity';
import { ChatMessageReaction } from './entities/chat-message-reaction.entity';
import { PollVote } from './entities/poll-vote.entity';
import { ScheduledMessage } from './entities/scheduled-message.entity';
import { ConversationLabel } from './entities/conversation-label.entity';
import { User } from '../users/entities/user.entity';
import { ChatGateway } from './chat.gateway';

const MAX_INPUT_BYTES = 5 * 1024 * 1024; // 5 MB de entrada (imágenes)
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB de entrada (archivos genéricos)
const TARGET_MAX_DIMENSION = 1280; // px
const TARGET_QUALITY = 70; // jpeg quality
const MAX_TEXT_LENGTH = 4000; // tope de caracteres por mensaje (anti-spam/DoS)
const MAX_EMOJI_LENGTH = 32;

export interface AggregatedReaction {
  emoji: string;
  count: number;
  userIds: string[];
  mine: boolean;
}

export interface ReplyPreview {
  id: string;
  senderId: string;
  type: MessageType;
  snippet: string;
}

export interface PollDto {
  question: string;
  multi: boolean;
  totalVoters: number;
  options: { id: string; text: string; count: number; userIds: string[] }[];
}

/**
 * Agrega filas de reacción de un mensaje en `[{ emoji, count, userIds, mine }]`,
 * preservando el orden de primera aparición. Pura → fácil de testear.
 */
export function aggregateReactions(
  rows: { emoji: string; userId: string }[],
  meId: string,
): AggregatedReaction[] {
  const order: string[] = [];
  const byEmoji = new Map<string, string[]>();
  for (const r of rows) {
    let users = byEmoji.get(r.emoji);
    if (!users) {
      users = [];
      byEmoji.set(r.emoji, users);
      order.push(r.emoji);
    }
    if (!users.includes(r.userId)) users.push(r.userId);
  }
  return order.map((emoji) => {
    const userIds = byEmoji.get(emoji) ?? [];
    return {
      emoji,
      count: userIds.length,
      userIds,
      mine: userIds.includes(meId),
    };
  });
}

/**
 * Extrae los handles mencionados (`@usuario`) del cuerpo, en minúsculas y sin
 * duplicados. No matchea correos (el `@` no debe ir pegado a un caracter de
 * palabra). Pura → fácil de testear.
 */
export function parseMentionTokens(body: string): string[] {
  const out = new Set<string>();
  const re = /(?<![\w@])@([a-zA-Z0-9._-]{1,50})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    out.add(m[1].toLowerCase());
  }
  return Array.from(out);
}

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversations: Repository<Conversation>,
    @InjectRepository(ConversationMember)
    private readonly members: Repository<ConversationMember>,
    @InjectRepository(Message)
    private readonly messages: Repository<Message>,
    @InjectRepository(ChatMessageReaction)
    private readonly reactions: Repository<ChatMessageReaction>,
    @InjectRepository(PollVote)
    private readonly pollVotes: Repository<PollVote>,
    @InjectRepository(ScheduledMessage)
    private readonly scheduled: Repository<ScheduledMessage>,
    @InjectRepository(ConversationLabel)
    private readonly labels: Repository<ConversationLabel>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly gateway: ChatGateway,
  ) {}

  // ── helpers ────────────────────────────────────────────────────────────
  private async getUserOrThrow(userId: string): Promise<User> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  private async memberIdsOf(conversationId: string): Promise<string[]> {
    const rows = await this.members.find({ where: { conversationId } });
    return rows.map((r) => r.userId);
  }

  private async assertMember(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const m = await this.members.findOne({ where: { conversationId, userId } });
    if (!m)
      throw new ForbiddenException('No eres miembro de esta conversación');
  }

  // ── usuarios del mismo tenant (para iniciar DM / armar canal) ───────────
  async listUsers(meId: string) {
    const me = await this.getUserOrThrow(meId);
    const all = await this.users.find({
      where: { tenantId: me.tenantId ?? undefined },
      order: { username: 'ASC' },
    });
    return all
      .filter((u) => u.id !== meId && u.isActive)
      .map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        lastSeenAt: u.lastSeenAt ?? null,
      }));
  }

  // ── crear / obtener DM ──────────────────────────────────────────────────
  async getOrCreateDm(meId: string, otherId: string): Promise<Conversation> {
    if (meId === otherId)
      throw new BadRequestException('No puedes abrir un DM contigo mismo');
    const me = await this.getUserOrThrow(meId);
    const other = await this.getUserOrThrow(otherId);

    // Buscar un DM existente que tenga exactamente a ambos.
    const myDms = await this.members.find({ where: { userId: meId } });
    for (const m of myDms) {
      const convo = await this.conversations.findOne({
        where: { id: m.conversationId },
      });
      if (!convo || convo.type !== 'dm') continue;
      const ids = await this.memberIdsOf(convo.id);
      if (ids.length === 2 && ids.includes(meId) && ids.includes(otherId)) {
        return convo;
      }
    }

    const convo = await this.conversations.save(
      this.conversations.create({
        tenantId: me.tenantId ?? null,
        type: 'dm',
        name: null,
        createdById: meId,
      }),
    );
    await this.members.save([
      this.members.create({ conversationId: convo.id, userId: meId }),
      this.members.create({ conversationId: convo.id, userId: other.id }),
    ]);
    return convo;
  }

  // ── crear canal ─────────────────────────────────────────────────────────
  async createChannel(
    meId: string,
    name: string,
    memberIds: string[],
  ): Promise<Conversation> {
    if (!name?.trim())
      throw new BadRequestException('El canal necesita un nombre');
    const me = await this.getUserOrThrow(meId);
    const unique = Array.from(new Set([meId, ...(memberIds || [])]));

    const convo = await this.conversations.save(
      this.conversations.create({
        tenantId: me.tenantId ?? null,
        type: 'channel',
        name: name.trim(),
        createdById: meId,
      }),
    );
    await this.members.save(
      unique.map((userId) =>
        this.members.create({ conversationId: convo.id, userId }),
      ),
    );
    return convo;
  }

  // ── administración de canales (miembros / nombre / salir) ─────────────────
  private async getChannelOrThrow(
    conversationId: string,
  ): Promise<Conversation> {
    const convo = await this.conversations.findOne({
      where: { id: conversationId },
    });
    if (!convo || convo.type !== 'channel') {
      throw new BadRequestException('Solo aplica a canales');
    }
    return convo;
  }

  async addMembers(meId: string, conversationId: string, userIds: string[]) {
    await this.assertMember(conversationId, meId);
    await this.getChannelOrThrow(conversationId);
    const existing = new Set(await this.memberIdsOf(conversationId));
    const toAdd = (userIds || []).filter((id) => id && !existing.has(id));
    if (toAdd.length) {
      await this.members.save(
        toAdd.map((userId) => this.members.create({ conversationId, userId })),
      );
    }
    this.gateway.emitConversationUpdate(
      Array.from(new Set([...existing, ...toAdd])),
      conversationId,
    );
    return { ok: true };
  }

  async removeMember(meId: string, conversationId: string, userId: string) {
    await this.assertMember(conversationId, meId);
    const convo = await this.getChannelOrThrow(conversationId);
    if (userId !== meId && convo.createdById !== meId) {
      throw new ForbiddenException('Solo el creador puede quitar a otros');
    }
    const before = await this.memberIdsOf(conversationId);
    await this.members.delete({ conversationId, userId });
    // Avisa también al que sale para que actualice su lista.
    this.gateway.emitConversationUpdate(before, conversationId);
    return { ok: true };
  }

  async renameChannel(meId: string, conversationId: string, name: string) {
    await this.assertMember(conversationId, meId);
    await this.getChannelOrThrow(conversationId);
    const trimmed = (name ?? '').trim();
    if (!trimmed) throw new BadRequestException('El canal necesita un nombre');
    await this.conversations.update(conversationId, {
      name: trimmed.slice(0, 120),
    });
    this.gateway.emitConversationUpdate(
      await this.memberIdsOf(conversationId),
      conversationId,
    );
    return { ok: true };
  }

  // ── listar mis conversaciones con último mensaje y no leídos ─────────────
  async listConversations(meId: string) {
    const myMemberships = await this.members.find({ where: { userId: meId } });
    const result: any[] = [];

    for (const membership of myMemberships) {
      const convo = await this.conversations.findOne({
        where: { id: membership.conversationId },
      });
      if (!convo) continue;

      const memberRows = await this.members.find({
        where: { conversationId: convo.id },
      });
      const memberIds = memberRows.map((m) => m.userId);

      // Nombre a mostrar: canal → su nombre; DM → el otro usuario.
      let title = convo.name;
      let counterpartId: string | null = null;
      if (convo.type === 'dm') {
        counterpartId = memberIds.find((id) => id !== meId) ?? null;
        if (counterpartId) {
          const other = await this.users.findOne({
            where: { id: counterpartId },
          });
          title = other?.username ?? other?.email ?? 'Usuario';
        }
      }

      const last = await this.messages.findOne({
        where: { conversationId: convo.id },
        order: { createdAt: 'DESC' },
      });

      // No leídos: mensajes después de lastReadAt y no míos.
      const unread = await this.messages
        .createQueryBuilder('m')
        .where('m.conversation_id = :cid', { cid: convo.id })
        .andWhere('m.sender_id != :me', { me: meId })
        .andWhere(
          membership.lastReadAt ? 'm.created_at > :lastRead' : '1=1',
          membership.lastReadAt ? { lastRead: membership.lastReadAt } : {},
        )
        .getCount();

      result.push({
        id: convo.id,
        type: convo.type,
        title,
        counterpartId,
        createdById: convo.createdById,
        disappearingSeconds: convo.disappearingSeconds ?? 0,
        memberIds,
        lastMessage: last
          ? {
              type: last.type,
              body: last.body,
              createdAt: last.createdAt,
              senderId: last.senderId,
            }
          : null,
        lastMessageAt: convo.lastMessageAt,
        unread,
      });
    }

    // Etiquetas personales de cada conversación (en lote).
    const labelMap = await this.labelsByConversation(
      meId,
      result.map((r) => r.id),
    );
    for (const r of result) r.labels = labelMap.get(r.id) ?? [];

    result.sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return tb - ta;
    });
    return result;
  }

  // ── mensajes de una conversación (paginado) ──────────────────────────────
  async listMessages(meId: string, conversationId: string, before?: string) {
    await this.assertMember(conversationId, meId);
    const qb = this.messages
      .createQueryBuilder('m')
      .where('m.conversation_id = :cid', { cid: conversationId })
      .andWhere('(m.expires_at IS NULL OR m.expires_at > :now)', {
        now: new Date(),
      })
      .orderBy('m.created_at', 'DESC')
      .take(50);
    if (before) qb.andWhere('m.created_at < :before', { before });
    const rows = await qb.getMany();

    // Reacciones en lote por los ids de la página (evita N+1).
    const ids = rows.map((m) => m.id);
    const reactionRows = ids.length
      ? await this.reactions.find({
          where: { messageId: In(ids) },
          order: { createdAt: 'ASC' },
        })
      : [];
    const byMessage = new Map<string, { emoji: string; userId: string }[]>();
    for (const r of reactionRows) {
      const list = byMessage.get(r.messageId);
      if (list) list.push(r);
      else byMessage.set(r.messageId, [r]);
    }

    // Previews de los mensajes citados (en lote, evita N+1).
    const replyIds = Array.from(
      new Set(rows.map((m) => m.replyToId).filter((x): x is string => !!x)),
    );
    const replyMap = new Map<string, ReplyPreview>();
    if (replyIds.length) {
      const replied = await this.messages.find({ where: { id: In(replyIds) } });
      for (const r of replied) replyMap.set(r.id, this.replyPreviewOf(r));
    }

    // Votos de encuestas en lote.
    const pollIds = rows.filter((m) => m.type === 'poll').map((m) => m.id);
    const votesByMsg = new Map<string, { optionId: string; userId: string }[]>();
    if (pollIds.length) {
      const voteRows = await this.pollVotes.find({
        where: { messageId: In(pollIds) },
      });
      for (const v of voteRows) {
        const list = votesByMsg.get(v.messageId);
        if (list) list.push(v);
        else votesByMsg.set(v.messageId, [v]);
      }
    }

    // Nº de respuestas (hilo) por mensaje, en una sola consulta.
    const threadCounts = await this.threadCountsFor(ids);

    // Devolver en orden cronológico ascendente.
    return rows.reverse().map((m) =>
      this.toDto(m, {
        reactions: aggregateReactions(byMessage.get(m.id) ?? [], meId),
        replyTo: m.replyToId ? (replyMap.get(m.replyToId) ?? null) : null,
        poll:
          m.type === 'poll'
            ? this.aggregatePollDto(m, votesByMsg.get(m.id) ?? [])
            : null,
        threadCount: threadCounts.get(m.id) ?? 0,
      }),
    );
  }

  /** Cuenta respuestas directas (no eliminadas) por cada id de mensaje raíz. */
  private async threadCountsFor(ids: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (!ids.length) return counts;
    const rows = await this.messages
      .createQueryBuilder('m')
      .select('m.reply_to_id', 'rid')
      .addSelect('COUNT(*)', 'cnt')
      .where('m.reply_to_id IN (:...ids)', { ids })
      .andWhere('m.deleted_at IS NULL')
      .groupBy('m.reply_to_id')
      .getRawMany<{ rid: string; cnt: string }>();
    for (const r of rows) counts.set(r.rid, Number(r.cnt));
    return counts;
  }

  /** Devuelve el mensaje raíz + sus respuestas (hilo completo). */
  async getThread(meId: string, rootId: string) {
    const root = await this.messages.findOne({ where: { id: rootId } });
    if (!root) throw new NotFoundException('Mensaje no encontrado');
    await this.assertMember(root.conversationId, meId);
    const replies = await this.messages.find({
      where: { replyToId: rootId },
      order: { createdAt: 'ASC' },
    });

    const all = [root, ...replies];
    const ids = all.map((m) => m.id);
    const reactionRows = await this.reactions.find({
      where: { messageId: In(ids) },
      order: { createdAt: 'ASC' },
    });
    const byMessage = new Map<string, { emoji: string; userId: string }[]>();
    for (const r of reactionRows) {
      const list = byMessage.get(r.messageId);
      if (list) list.push(r);
      else byMessage.set(r.messageId, [r]);
    }
    const reactionsOf = (id: string) =>
      aggregateReactions(byMessage.get(id) ?? [], meId);
    const rootPreview = this.replyPreviewOf(root);

    return {
      root: this.toDto(root, {
        reactions: reactionsOf(root.id),
        threadCount: replies.length,
      }),
      replies: replies.map((m) =>
        this.toDto(m, { reactions: reactionsOf(m.id), replyTo: rootPreview }),
      ),
    };
  }

  // ── enviar texto ─────────────────────────────────────────────────────────
  async sendText(
    meId: string,
    conversationId: string,
    body: string,
    replyToId?: string,
  ) {
    await this.assertMember(conversationId, meId);
    const text = body?.trim();
    if (!text) throw new BadRequestException('Mensaje vacío');
    if (text.length > MAX_TEXT_LENGTH) {
      throw new BadRequestException(
        `Mensaje demasiado largo (máx ${MAX_TEXT_LENGTH} caracteres)`,
      );
    }
    const replied = await this.resolveReplyTo(conversationId, replyToId);
    const mentionedUserIds = await this.resolveMentions(conversationId, text);
    const msg = await this.messages.save(
      this.messages.create({
        conversationId,
        senderId: meId,
        type: 'text',
        body: text,
        replyToId: replied?.id ?? null,
        mentionedUserIds: mentionedUserIds.length ? mentionedUserIds : null,
        expiresAt: await this.expiryFor(conversationId),
      }),
    );
    const dto = this.toDto(msg, {
      replyTo: replied ? this.replyPreviewOf(replied) : null,
    });
    await this.touchAndBroadcast(conversationId, msg, dto);

    // Notificar a cada mencionado (excepto a mí) para badge/toast.
    const toNotify = mentionedUserIds.filter((id) => id !== meId);
    if (toNotify.length) {
      this.gateway.emitMentionToUsers(toNotify, {
        conversationId,
        messageId: msg.id,
        byUserId: meId,
      });
    }
    return dto;
  }

  /** Valida que el mensaje citado exista y sea de la misma conversación. */
  private async resolveReplyTo(
    conversationId: string,
    replyToId?: string,
  ): Promise<Message | null> {
    if (!replyToId) return null;
    const r = await this.messages.findOne({ where: { id: replyToId } });
    if (!r || r.conversationId !== conversationId) {
      throw new BadRequestException('El mensaje citado no es válido');
    }
    return r;
  }

  /** Preview compacto de un mensaje citado (para mostrar sobre la respuesta). */
  private replyPreviewOf(r: Message): ReplyPreview {
    const snippet = r.deletedAt
      ? 'Mensaje eliminado'
      : r.type === 'image'
        ? '📷 Imagen'
        : r.type === 'file'
          ? r.fileName || '📎 Archivo'
          : r.type === 'call'
            ? '📞 Llamada'
            : r.type === 'poll'
              ? '📊 Encuesta'
              : (r.body ?? '').slice(0, 140);
    return { id: r.id, senderId: r.senderId, type: r.type, snippet };
  }

  /** Resuelve @handles del cuerpo contra los MIEMBROS de la conversación. */
  private async resolveMentions(
    conversationId: string,
    body: string,
  ): Promise<string[]> {
    const tokens = parseMentionTokens(body);
    if (!tokens.length) return [];
    const memberIds = await this.memberIdsOf(conversationId);
    if (!memberIds.length) return [];
    const members = await this.users.find({ where: { id: In(memberIds) } });
    const resolved = new Set<string>();
    for (const u of members) {
      const uname = (u.username ?? '').toLowerCase();
      if (uname && tokens.includes(uname)) resolved.add(u.id);
    }
    return Array.from(resolved);
  }

  // ── enviar imagen (comprimida) ───────────────────────────────────────────
  async sendImage(
    meId: string,
    conversationId: string,
    file: { buffer: Buffer; mimetype: string; size: number } | undefined,
    replyToId?: string,
  ) {
    await this.assertMember(conversationId, meId);
    if (!file) throw new BadRequestException('No se recibió archivo');
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('El archivo no es una imagen');
    }
    if (file.size > MAX_INPUT_BYTES) {
      throw new BadRequestException('La imagen supera el límite de 5 MB');
    }
    const replied = await this.resolveReplyTo(conversationId, replyToId);

    const { buffer, mime } = await this.compressImage(file.buffer);

    const msg = await this.messages.save(
      this.messages.create({
        conversationId,
        senderId: meId,
        type: 'image',
        body: null,
        imageData: buffer,
        imageMime: mime,
        imageSize: buffer.length,
        replyToId: replied?.id ?? null,
        expiresAt: await this.expiryFor(conversationId),
      }),
    );
    const dto = this.toDto(msg, {
      replyTo: replied ? this.replyPreviewOf(replied) : null,
    });
    await this.touchAndBroadcast(conversationId, msg, dto);
    return dto;
  }

  /**
   * Comprime/redimensiona con sharp. Si sharp falla por cualquier motivo en
   * runtime, guarda el original (el límite de 5 MB ya acota el tamaño).
   */
  private async compressImage(
    input: Buffer,
  ): Promise<{ buffer: Buffer; mime: string }> {
    try {
      // Import dinámico: si sharp no estuviera disponible, no tumba el arranque.
      const sharp = (await import('sharp')).default;
      const out = await sharp(input)
        .rotate()
        .resize({
          width: TARGET_MAX_DIMENSION,
          height: TARGET_MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: TARGET_QUALITY })
        .toBuffer();
      return { buffer: out, mime: 'image/jpeg' };
    } catch (e) {
      return { buffer: input, mime: 'image/jpeg' };
    }
  }

  // ── imagen para <img src> ────────────────────────────────────────────────
  async getImage(meId: string, messageId: string) {
    const msg = await this.messages
      .createQueryBuilder('m')
      .addSelect('m.image_data')
      .where('m.id = :id', { id: messageId })
      .getOne();
    if (!msg || !msg.imageData)
      throw new NotFoundException('Imagen no encontrada');
    await this.assertMember(msg.conversationId, meId);
    return { data: msg.imageData, mime: msg.imageMime ?? 'image/jpeg' };
  }

  // ── enviar archivo genérico (PDF, Word, Excel, zip…) ──────────────────────
  async sendFile(
    meId: string,
    conversationId: string,
    file:
      | { buffer: Buffer; mimetype: string; size: number; originalname?: string }
      | undefined,
    replyToId?: string,
  ) {
    await this.assertMember(conversationId, meId);
    if (!file) throw new BadRequestException('No se recibió archivo');
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('El archivo supera el límite de 25 MB');
    }
    const replied = await this.resolveReplyTo(conversationId, replyToId);
    // Nombre seguro: recorta a 255 y elimina rutas (defensa de path traversal).
    const safeName = (file.originalname || 'archivo')
      .replace(/[\\/]/g, '_')
      .slice(0, 255);

    const msg = await this.messages.save(
      this.messages.create({
        conversationId,
        senderId: meId,
        type: 'file',
        body: null,
        fileData: file.buffer,
        fileMime: file.mimetype || 'application/octet-stream',
        fileName: safeName,
        fileSize: file.size,
        replyToId: replied?.id ?? null,
        expiresAt: await this.expiryFor(conversationId),
      }),
    );
    const dto = this.toDto(msg, {
      replyTo: replied ? this.replyPreviewOf(replied) : null,
    });
    await this.touchAndBroadcast(conversationId, msg, dto);
    return dto;
  }

  // ── descarga de archivo ───────────────────────────────────────────────────
  async getFile(meId: string, messageId: string) {
    const msg = await this.messages
      .createQueryBuilder('m')
      .addSelect('m.file_data')
      .where('m.id = :id', { id: messageId })
      .getOne();
    if (!msg || !msg.fileData)
      throw new NotFoundException('Archivo no encontrado');
    await this.assertMember(msg.conversationId, meId);
    return {
      data: msg.fileData,
      mime: msg.fileMime ?? 'application/octet-stream',
      name: msg.fileName ?? 'archivo',
    };
  }

  // ── registro de llamada (historial / perdidas) ───────────────────────────
  /**
   * Crea un mensaje de tipo `call` con el resultado de una llamada. El cuerpo es
   * JSON `{ media, status, durationSec }`. Lo publica el INICIADOR de la llamada
   * (una sola fuente), y aparece en el hilo para todos los miembros.
   */
  async sendCallLog(
    meId: string,
    conversationId: string,
    payload: { media?: string; status?: string; durationSec?: number },
  ) {
    await this.assertMember(conversationId, meId);
    const media = payload?.media === 'video' ? 'video' : 'audio';
    const allowed = ['completed', 'missed', 'declined', 'canceled'];
    const status = allowed.includes(payload?.status ?? '')
      ? (payload!.status as string)
      : 'completed';
    const durationSec = Math.max(
      0,
      Math.min(86400, Math.floor(Number(payload?.durationSec) || 0)),
    );
    const body = JSON.stringify({ media, status, durationSec });
    const msg = await this.messages.save(
      this.messages.create({
        conversationId,
        senderId: meId,
        type: 'call',
        body,
      }),
    );
    await this.touchAndBroadcast(conversationId, msg);
    return this.toDto(msg);
  }

  // ── reacciones (toggle) ──────────────────────────────────────────────────
  async toggleReaction(meId: string, messageId: string, emojiRaw: string) {
    const emoji = (emojiRaw ?? '').trim();
    if (!emoji || emoji.length > MAX_EMOJI_LENGTH || /\s/.test(emoji)) {
      throw new BadRequestException('Emoji inválido');
    }
    const msg = await this.messages.findOne({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Mensaje no encontrado');
    await this.assertMember(msg.conversationId, meId);

    const existing = await this.reactions.findOne({
      where: { messageId, userId: meId, emoji },
    });
    if (existing) {
      await this.reactions.delete({ id: existing.id });
    } else {
      const me = await this.getUserOrThrow(meId);
      await this.reactions.save(
        this.reactions.create({
          messageId,
          userId: meId,
          emoji,
          tenantId: me.tenantId ?? null,
        }),
      );
    }

    const reactions = await this.reactionsForMessage(messageId, meId);
    const memberIds = await this.memberIdsOf(msg.conversationId);
    this.gateway.emitReactionUpdate(memberIds, { messageId, reactions });
    return reactions;
  }

  private async reactionsForMessage(
    messageId: string,
    meId: string,
  ): Promise<AggregatedReaction[]> {
    const rows = await this.reactions.find({
      where: { messageId },
      order: { createdAt: 'ASC' },
    });
    return aggregateReactions(rows, meId);
  }

  // ── marcar leído ─────────────────────────────────────────────────────────
  async markRead(meId: string, conversationId: string) {
    await this.assertMember(conversationId, meId);
    const lastReadAt = new Date();
    await this.members.update({ conversationId, userId: meId }, { lastReadAt });
    const memberIds = await this.memberIdsOf(conversationId);
    this.gateway.emitReadUpdate(memberIds, {
      conversationId,
      userId: meId,
      lastReadAt,
    });
    return { ok: true };
  }

  // ── recibos de lectura ("visto") por miembro ─────────────────────────────
  async listReads(meId: string, conversationId: string) {
    await this.assertMember(conversationId, meId);
    const rows = await this.members.find({ where: { conversationId } });
    return rows.map((r) => ({ userId: r.userId, lastReadAt: r.lastReadAt }));
  }

  // ── editar / eliminar / fijar / reenviar ─────────────────────────────────
  async editMessage(meId: string, messageId: string, body: string) {
    const msg = await this.messages.findOne({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Mensaje no encontrado');
    await this.assertMember(msg.conversationId, meId);
    if (msg.senderId !== meId) {
      throw new ForbiddenException('Solo puedes editar tus mensajes');
    }
    if (msg.type !== 'text') {
      throw new BadRequestException('Solo se puede editar texto');
    }
    if (msg.deletedAt) throw new BadRequestException('Mensaje eliminado');
    const text = body?.trim();
    if (!text) throw new BadRequestException('Mensaje vacío');
    if (text.length > MAX_TEXT_LENGTH) {
      throw new BadRequestException(
        `Mensaje demasiado largo (máx ${MAX_TEXT_LENGTH} caracteres)`,
      );
    }
    const mentioned = await this.resolveMentions(msg.conversationId, text);
    msg.body = text;
    msg.editedAt = new Date();
    msg.mentionedUserIds = mentioned.length ? mentioned : null;
    await this.messages.save(msg);
    const dto = await this.dtoWithReply(msg);
    await this.broadcastUpdate(msg.conversationId, dto);
    return dto;
  }

  async deleteMessage(meId: string, messageId: string) {
    const msg = await this.messages.findOne({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Mensaje no encontrado');
    await this.assertMember(msg.conversationId, meId);
    if (msg.senderId !== meId) {
      throw new ForbiddenException('Solo puedes eliminar tus mensajes');
    }
    // Borrado lógico + purga de contenido (texto y binarios).
    await this.messages.update(messageId, {
      deletedAt: new Date(),
      body: null,
      imageData: null,
      imageMime: null,
      imageSize: null,
      fileData: null,
      fileName: null,
      fileMime: null,
      fileSize: null,
      pinnedAt: null,
      mentionedUserIds: null,
    });
    await this.reactions.delete({ messageId });
    const fresh = await this.messages.findOne({ where: { id: messageId } });
    const dto = this.toDto(fresh as Message);
    await this.broadcastUpdate(msg.conversationId, dto);
    return dto;
  }

  async pinMessage(meId: string, messageId: string, pinned: boolean) {
    const msg = await this.messages.findOne({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Mensaje no encontrado');
    await this.assertMember(msg.conversationId, meId);
    if (msg.deletedAt) throw new BadRequestException('Mensaje eliminado');
    await this.messages.update(messageId, {
      pinnedAt: pinned ? new Date() : null,
    });
    const fresh = await this.messages.findOne({ where: { id: messageId } });
    const dto = await this.dtoWithReply(fresh as Message);
    await this.broadcastUpdate(msg.conversationId, dto);
    return dto;
  }

  async listPinned(meId: string, conversationId: string) {
    await this.assertMember(conversationId, meId);
    const rows = await this.messages.find({
      where: { conversationId, pinnedAt: Not(IsNull()) },
      order: { pinnedAt: 'DESC' },
      take: 50,
    });
    return Promise.all(rows.map((m) => this.dtoWithReply(m)));
  }

  async forwardMessage(
    meId: string,
    messageId: string,
    targetConversationId: string,
  ) {
    const src = await this.messages
      .createQueryBuilder('m')
      .addSelect('m.image_data')
      .addSelect('m.file_data')
      .where('m.id = :id', { id: messageId })
      .getOne();
    if (!src) throw new NotFoundException('Mensaje no encontrado');
    await this.assertMember(src.conversationId, meId); // miembro del origen
    if (src.deletedAt) throw new BadRequestException('Mensaje eliminado');
    if (src.type === 'call') {
      throw new BadRequestException('No se puede reenviar este mensaje');
    }
    await this.assertMember(targetConversationId, meId); // miembro del destino

    const msg = await this.messages.save(
      this.messages.create({
        conversationId: targetConversationId,
        senderId: meId,
        type: src.type,
        forwarded: true,
        body: src.type === 'text' ? src.body : null,
        imageData: src.type === 'image' ? src.imageData : null,
        imageMime: src.type === 'image' ? src.imageMime : null,
        imageSize: src.type === 'image' ? src.imageSize : null,
        fileData: src.type === 'file' ? src.fileData : null,
        fileName: src.type === 'file' ? src.fileName : null,
        fileMime: src.type === 'file' ? src.fileMime : null,
        fileSize: src.type === 'file' ? src.fileSize : null,
      }),
    );
    const dto = this.toDto(msg);
    await this.touchAndBroadcast(targetConversationId, msg, dto);
    return dto;
  }

  // ── búsqueda global de mensajes (en mis conversaciones) ───────────────────
  async searchMessages(meId: string, query: string) {
    const q = (query ?? '').trim().toLowerCase();
    if (q.length < 2) return [];
    const myMemberships = await this.members.find({ where: { userId: meId } });
    const convoIds = myMemberships.map((m) => m.conversationId);
    if (!convoIds.length) return [];

    const rows = await this.messages
      .createQueryBuilder('m')
      .where('m.conversation_id IN (:...cids)', { cids: convoIds })
      .andWhere("m.type = 'text'")
      .andWhere('m.deleted_at IS NULL')
      .andWhere('LOWER(m.body) LIKE :q', { q: `%${q}%` })
      .orderBy('m.created_at', 'DESC')
      .take(30)
      .getMany();
    if (!rows.length) return [];

    // Títulos: canal → nombre; DM → el otro miembro.
    const matchedIds = Array.from(new Set(rows.map((r) => r.conversationId)));
    const convos = await this.conversations.find({
      where: { id: In(matchedIds) },
    });
    const convoById = new Map(convos.map((c) => [c.id, c]));
    const memberRows = await this.members.find({
      where: { conversationId: In(matchedIds) },
    });
    const otherByConvo = new Map<string, string>();
    for (const mr of memberRows) {
      const c = convoById.get(mr.conversationId);
      if (c?.type === 'dm' && mr.userId !== meId) {
        otherByConvo.set(mr.conversationId, mr.userId);
      }
    }
    const otherIds = Array.from(new Set(otherByConvo.values()));
    const others = otherIds.length
      ? await this.users.find({ where: { id: In(otherIds) } })
      : [];
    const userById = new Map(others.map((u) => [u.id, u]));

    return rows.map((r) => {
      const c = convoById.get(r.conversationId);
      let title = c?.name ?? 'Conversación';
      if (c?.type === 'dm') {
        const other = userById.get(otherByConvo.get(r.conversationId) ?? '');
        title = other?.username ?? other?.email ?? 'Usuario';
      }
      return {
        id: r.id,
        conversationId: r.conversationId,
        conversationTitle: title,
        conversationType: c?.type ?? 'dm',
        senderId: r.senderId,
        snippet: (r.body ?? '').slice(0, 160),
        createdAt: r.createdAt,
      };
    });
  }

  // ── mensajes temporales (disappearing) ───────────────────────────────────
  private async expiryFor(conversationId: string): Promise<Date | null> {
    const convo = await this.conversations.findOne({
      where: { id: conversationId },
    });
    const secs = convo?.disappearingSeconds ?? 0;
    return secs > 0 ? new Date(Date.now() + secs * 1000) : null;
  }

  async setDisappearing(meId: string, conversationId: string, seconds: number) {
    await this.assertMember(conversationId, meId);
    const s = Math.max(0, Math.min(604800, Math.floor(Number(seconds) || 0)));
    await this.conversations.update(conversationId, { disappearingSeconds: s });
    this.gateway.emitConversationUpdate(
      await this.memberIdsOf(conversationId),
      conversationId,
    );
    return { ok: true, disappearingSeconds: s };
  }

  /** Borra mensajes vencidos cada minuto y avisa a los clientes. */
  @Interval(60000)
  async sweepExpiredMessages(): Promise<void> {
    const rows = await this.messages.find({
      where: { expiresAt: LessThanOrEqual(new Date()) },
      take: 200,
    });
    for (const m of rows) {
      const memberIds = await this.memberIdsOf(m.conversationId);
      await this.reactions.delete({ messageId: m.id });
      await this.pollVotes.delete({ messageId: m.id });
      await this.messages.delete({ id: m.id });
      this.gateway.emitMessageRemoved(memberIds, {
        id: m.id,
        conversationId: m.conversationId,
      });
    }
  }

  // ── encuestas ─────────────────────────────────────────────────────────────
  private aggregatePollDto(
    message: Message,
    voteRows: { optionId: string; userId: string }[],
  ): PollDto {
    let parsed: {
      q?: string;
      multi?: boolean;
      options?: { id: string; text: string }[];
    } = {};
    try {
      parsed = JSON.parse(message.body ?? '{}');
    } catch {
      /* cuerpo inválido */
    }
    const byOpt = new Map<string, string[]>();
    const voters = new Set<string>();
    for (const v of voteRows) {
      voters.add(v.userId);
      const list = byOpt.get(v.optionId);
      if (list) list.push(v.userId);
      else byOpt.set(v.optionId, [v.userId]);
    }
    return {
      question: parsed.q ?? '',
      multi: !!parsed.multi,
      totalVoters: voters.size,
      options: (parsed.options ?? []).map((o) => {
        const ids = byOpt.get(o.id) ?? [];
        return { id: o.id, text: o.text, count: ids.length, userIds: ids };
      }),
    };
  }

  async createPoll(
    meId: string,
    conversationId: string,
    question: string,
    options: string[],
    multi: boolean,
  ) {
    await this.assertMember(conversationId, meId);
    const q = (question ?? '').trim();
    const opts = (options ?? [])
      .map((o) => (o ?? '').trim())
      .filter(Boolean)
      .slice(0, 10);
    if (!q) throw new BadRequestException('La encuesta necesita una pregunta');
    if (opts.length < 2) {
      throw new BadRequestException('Agrega al menos 2 opciones');
    }
    const body = JSON.stringify({
      q,
      multi: !!multi,
      options: opts.map((text, i) => ({ id: `o${i + 1}`, text })),
    });
    const expiresAt = await this.expiryFor(conversationId);
    const msg = await this.messages.save(
      this.messages.create({
        conversationId,
        senderId: meId,
        type: 'poll',
        body,
        expiresAt,
      }),
    );
    const dto = this.toDto(msg, { poll: this.aggregatePollDto(msg, []) });
    await this.touchAndBroadcast(conversationId, msg, dto);
    return dto;
  }

  async votePoll(meId: string, messageId: string, optionId: string) {
    const msg = await this.messages.findOne({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Encuesta no encontrada');
    if (msg.type !== 'poll') throw new BadRequestException('No es una encuesta');
    await this.assertMember(msg.conversationId, meId);
    let parsed: { multi?: boolean; options?: { id: string }[] } = {};
    try {
      parsed = JSON.parse(msg.body ?? '{}');
    } catch {
      /* noop */
    }
    if (!(parsed.options ?? []).some((o) => o.id === optionId)) {
      throw new BadRequestException('Opción inválida');
    }
    const existing = await this.pollVotes.findOne({
      where: { messageId, userId: meId, optionId },
    });
    if (existing) {
      await this.pollVotes.delete({ id: existing.id });
    } else {
      if (!parsed.multi) {
        await this.pollVotes.delete({ messageId, userId: meId });
      }
      await this.pollVotes.save(
        this.pollVotes.create({ messageId, userId: meId, optionId }),
      );
    }
    const rows = await this.pollVotes.find({ where: { messageId } });
    const dto = this.toDto(msg, { poll: this.aggregatePollDto(msg, rows) });
    await this.broadcastUpdate(msg.conversationId, dto);
    return dto;
  }

  // ── mensajes programados ──────────────────────────────────────────────────
  async scheduleMessage(
    meId: string,
    conversationId: string,
    body: string,
    sendAt: string,
  ) {
    await this.assertMember(conversationId, meId);
    const text = (body ?? '').trim();
    if (!text) throw new BadRequestException('Mensaje vacío');
    const when = new Date(sendAt);
    if (isNaN(when.getTime()) || when.getTime() < Date.now() + 10000) {
      throw new BadRequestException('Elige una hora futura');
    }
    const row = await this.scheduled.save(
      this.scheduled.create({
        conversationId,
        senderId: meId,
        body: text,
        sendAt: when,
      }),
    );
    return {
      id: row.id,
      conversationId,
      body: text,
      sendAt: when.toISOString(),
    };
  }

  async listScheduled(meId: string, conversationId: string) {
    await this.assertMember(conversationId, meId);
    const rows = await this.scheduled.find({
      where: { conversationId, senderId: meId },
      order: { sendAt: 'ASC' },
    });
    return rows.map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      body: r.body,
      sendAt: r.sendAt,
    }));
  }

  async cancelScheduled(meId: string, id: string) {
    const row = await this.scheduled.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Programado no encontrado');
    if (row.senderId !== meId) {
      throw new ForbiddenException('No es tuyo');
    }
    await this.scheduled.delete({ id });
    return { ok: true };
  }

  /** Envía los mensajes programados vencidos cada 30 s. */
  @Interval(30000)
  async sweepScheduledMessages(): Promise<void> {
    const due = await this.scheduled.find({
      where: { sendAt: LessThanOrEqual(new Date()) },
      order: { sendAt: 'ASC' },
      take: 100,
    });
    for (const s of due) {
      await this.scheduled.delete({ id: s.id });
      try {
        await this.sendText(s.senderId, s.conversationId, s.body);
      } catch {
        /* el remitente pudo salir de la conversación: descartar */
      }
    }
  }

  // ── internos ─────────────────────────────────────────────────────────────
  private async touchAndBroadcast(
    conversationId: string,
    msg: Message,
    dto?: unknown,
  ) {
    await this.conversations.update(conversationId, {
      lastMessageAt: msg.createdAt,
    });
    const memberIds = await this.memberIdsOf(conversationId);
    this.gateway.emitMessageToMembers(memberIds, dto ?? this.toDto(msg));
  }

  /** Difunde un mensaje ACTUALIZADO (editado/eliminado/fijado) a los miembros. */
  private async broadcastUpdate(conversationId: string, dto: unknown) {
    const memberIds = await this.memberIdsOf(conversationId);
    this.gateway.emitMessageUpdate(memberIds, dto);
  }

  /** DTO de un mensaje resolviendo su cita (si la tiene). */
  private async dtoWithReply(m: Message) {
    const replied = m.replyToId
      ? await this.messages.findOne({ where: { id: m.replyToId } })
      : null;
    return this.toDto(m, {
      replyTo: replied ? this.replyPreviewOf(replied) : null,
    });
  }

  private toDto(
    m: Message,
    extras?: {
      reactions?: AggregatedReaction[];
      replyTo?: ReplyPreview | null;
      poll?: PollDto | null;
      threadCount?: number;
    },
  ) {
    const deleted = !!m.deletedAt;
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      type: m.type,
      body: deleted ? null : m.body,
      imageMime: deleted ? null : (m.imageMime ?? null),
      fileName: deleted ? null : (m.fileName ?? null),
      fileMime: deleted ? null : (m.fileMime ?? null),
      fileSize: deleted ? null : (m.fileSize ?? null),
      createdAt: m.createdAt,
      reactions: extras?.reactions ?? ([] as AggregatedReaction[]),
      mentionedUserIds: deleted ? [] : (m.mentionedUserIds ?? []),
      replyToId: m.replyToId ?? null,
      replyTo: extras?.replyTo ?? null,
      poll: extras?.poll ?? null,
      editedAt: m.editedAt ?? null,
      deletedAt: m.deletedAt ?? null,
      pinnedAt: m.pinnedAt ?? null,
      expiresAt: m.expiresAt ?? null,
      forwarded: !!m.forwarded,
      threadCount: extras?.threadCount ?? 0,
    };
  }

  // ── etiquetas / carpetas (organización personal de conversaciones) ────────
  /** Reemplaza el conjunto de etiquetas del usuario para una conversación. */
  async setConversationLabels(
    meId: string,
    conversationId: string,
    rawLabels: string[],
  ) {
    await this.assertMember(conversationId, meId);
    const clean = Array.from(
      new Set(
        (rawLabels ?? [])
          .map((l) => (l ?? '').trim().slice(0, 40))
          .filter(Boolean),
      ),
    ).slice(0, 12);
    await this.labels.delete({ userId: meId, conversationId });
    if (clean.length) {
      await this.labels.save(
        clean.map((label) =>
          this.labels.create({ userId: meId, conversationId, label }),
        ),
      );
    }
    return { conversationId, labels: clean };
  }

  /** Mapa conversación → etiquetas del usuario (para adjuntar a la lista). */
  private async labelsByConversation(
    meId: string,
    conversationIds: string[],
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (!conversationIds.length) return map;
    const rows = await this.labels.find({
      where: { userId: meId, conversationId: In(conversationIds) },
      order: { label: 'ASC' },
    });
    for (const r of rows) {
      const list = map.get(r.conversationId);
      if (list) list.push(r.label);
      else map.set(r.conversationId, [r.label]);
    }
    return map;
  }
}
