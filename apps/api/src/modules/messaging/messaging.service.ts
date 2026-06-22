import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, IsNull } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationMember } from './entities/conversation-member.entity';
import { Message, MessageType } from './entities/message.entity';
import { ChatMessageReaction } from './entities/chat-message-reaction.entity';
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

    // Devolver en orden cronológico ascendente.
    return rows.reverse().map((m) =>
      this.toDto(m, {
        reactions: aggregateReactions(byMessage.get(m.id) ?? [], meId),
        replyTo: m.replyToId ? (replyMap.get(m.replyToId) ?? null) : null,
      }),
    );
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
    extras?: { reactions?: AggregatedReaction[]; replyTo?: ReplyPreview | null },
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
      editedAt: m.editedAt ?? null,
      deletedAt: m.deletedAt ?? null,
      pinnedAt: m.pinnedAt ?? null,
      forwarded: !!m.forwarded,
    };
  }
}
