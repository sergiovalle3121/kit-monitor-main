import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationMember } from './entities/conversation-member.entity';
import { Message } from './entities/message.entity';
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

    // Devolver en orden cronológico ascendente.
    return rows.reverse().map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      type: m.type,
      body: m.body,
      imageMime: m.imageMime,
      fileName: m.fileName,
      fileMime: m.fileMime,
      fileSize: m.fileSize,
      createdAt: m.createdAt,
      reactions: aggregateReactions(byMessage.get(m.id) ?? [], meId),
      mentionedUserIds: m.mentionedUserIds ?? [],
    }));
  }

  // ── enviar texto ─────────────────────────────────────────────────────────
  async sendText(meId: string, conversationId: string, body: string) {
    await this.assertMember(conversationId, meId);
    const text = body?.trim();
    if (!text) throw new BadRequestException('Mensaje vacío');
    if (text.length > MAX_TEXT_LENGTH) {
      throw new BadRequestException(
        `Mensaje demasiado largo (máx ${MAX_TEXT_LENGTH} caracteres)`,
      );
    }
    const mentionedUserIds = await this.resolveMentions(conversationId, text);
    const msg = await this.messages.save(
      this.messages.create({
        conversationId,
        senderId: meId,
        type: 'text',
        body: text,
        mentionedUserIds: mentionedUserIds.length ? mentionedUserIds : null,
      }),
    );
    await this.touchAndBroadcast(conversationId, msg);

    // Notificar a cada mencionado (excepto a mí) para badge/toast.
    const toNotify = mentionedUserIds.filter((id) => id !== meId);
    if (toNotify.length) {
      this.gateway.emitMentionToUsers(toNotify, {
        conversationId,
        messageId: msg.id,
        byUserId: meId,
      });
    }
    return this.toDto(msg);
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
  ) {
    await this.assertMember(conversationId, meId);
    if (!file) throw new BadRequestException('No se recibió archivo');
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('El archivo no es una imagen');
    }
    if (file.size > MAX_INPUT_BYTES) {
      throw new BadRequestException('La imagen supera el límite de 5 MB');
    }

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
      }),
    );
    await this.touchAndBroadcast(conversationId, msg);
    return this.toDto(msg);
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
  ) {
    await this.assertMember(conversationId, meId);
    if (!file) throw new BadRequestException('No se recibió archivo');
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('El archivo supera el límite de 25 MB');
    }
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
      }),
    );
    await this.touchAndBroadcast(conversationId, msg);
    return this.toDto(msg);
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

  // ── internos ─────────────────────────────────────────────────────────────
  private async touchAndBroadcast(conversationId: string, msg: Message) {
    await this.conversations.update(conversationId, {
      lastMessageAt: msg.createdAt,
    });
    const memberIds = await this.memberIdsOf(conversationId);
    this.gateway.emitMessageToMembers(memberIds, this.toDto(msg));
  }

  private toDto(m: Message) {
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      type: m.type,
      body: m.body,
      imageMime: m.imageMime,
      fileName: m.fileName ?? null,
      fileMime: m.fileMime ?? null,
      fileSize: m.fileSize ?? null,
      createdAt: m.createdAt,
      // Un mensaje recién creado aún no tiene reacciones; forma consistente.
      reactions: [] as AggregatedReaction[],
      mentionedUserIds: m.mentionedUserIds ?? [],
    };
  }
}
