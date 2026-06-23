import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, IsNull, LessThanOrEqual, Like } from 'typeorm';
import { lookup } from 'dns/promises';
import { Conversation } from './entities/conversation.entity';
import { ConversationMember } from './entities/conversation-member.entity';
import { Message, MessageType } from './entities/message.entity';
import { ChatMessageReaction } from './entities/chat-message-reaction.entity';
import { PollVote } from './entities/poll-vote.entity';
import { ScheduledMessage } from './entities/scheduled-message.entity';
import { ConversationLabel } from './entities/conversation-label.entity';
import { SavedMessage } from './entities/saved-message.entity';
import { Meeting, MeetingRecurrence } from './entities/meeting.entity';
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

/** Primera URL http(s) del cuerpo (sin puntuación final), o null. Pura. */
export function firstUrl(body: string | null | undefined): string | null {
  if (!body) return null;
  const m = /(https?:\/\/[^\s<>"']+)/i.exec(body);
  return m ? m[1].replace(/[.,;:!?)\]]+$/, '') : null;
}

/** ¿IP en rango privado/reservado? (defensa SSRF para el unfurl de enlaces). */
export function isPrivateIp(ip: string): boolean {
  const v4 = ip.includes('.') ? ip.split('.').map(Number) : null;
  if (v4 && v4.length === 4 && v4.every((n) => n >= 0 && n <= 255)) {
    const [a, b] = v4;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast/reservado
    return false;
  }
  const v6 = ip.toLowerCase();
  return (
    v6 === '::1' ||
    v6 === '::' ||
    v6.startsWith('fe80') || // link-local
    v6.startsWith('fc') ||
    v6.startsWith('fd') || // ULA
    v6.startsWith('::ffff:127.') ||
    v6.startsWith('::ffff:10.') ||
    v6.startsWith('::ffff:192.168.')
  );
}

/** Decodifica las entidades HTML más comunes en texto de metadatos. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

/** Extrae metadatos OpenGraph/HTML de un documento (regex acotada, sin deps). */
export function parseOpenGraph(html: string, baseUrl: string): LinkPreview {
  const meta = (prop: string): string | null => {
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`,
        'i',
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`,
        'i',
      ),
    ];
    for (const re of patterns) {
      const m = re.exec(html);
      if (m && m[1]) return decodeEntities(m[1]);
    }
    return null;
  };
  const titleTag = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  const title = meta('og:title') || (titleTag ? decodeEntities(titleTag[1]) : null);
  const description = meta('og:description') || meta('description');
  let image = meta('og:image') || meta('og:image:url') || meta('twitter:image');
  if (image) {
    try {
      image = new URL(image, baseUrl).toString();
    } catch {
      image = null;
    }
  }
  return {
    url: baseUrl,
    title: title ? title.slice(0, 200) : null,
    description: description ? description.slice(0, 300) : null,
    image,
    siteName: meta('og:site_name'),
  };
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
    @InjectRepository(SavedMessage)
    private readonly saved: Repository<SavedMessage>,
    @InjectRepository(Meeting)
    private readonly meetings: Repository<Meeting>,
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

  /**
   * Verifica membresía y, en canales de anuncios, que el usuario sea el creador
   * (solo él publica). Llamada por todos los caminos de envío de mensajes.
   */
  private async assertCanPost(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    await this.assertMember(conversationId, userId);
    const convo = await this.conversations.findOne({
      where: { id: conversationId },
    });
    if (convo?.announcement && convo.createdById !== userId) {
      throw new ForbiddenException(
        'Solo el administrador puede publicar en este canal de anuncios',
      );
    }
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
    announcement = false,
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
        announcement: !!announcement,
      }),
    );
    await this.members.save(
      unique.map((userId) =>
        this.members.create({ conversationId: convo.id, userId }),
      ),
    );
    return convo;
  }

  /** Activa/desactiva el modo "canal de anuncios" (solo el creador). */
  async setAnnouncement(
    meId: string,
    conversationId: string,
    announcement: boolean,
  ) {
    const convo = await this.getChannelOrThrow(conversationId);
    if (convo.createdById !== meId) {
      throw new ForbiddenException('Solo el creador puede cambiar este ajuste');
    }
    await this.conversations.update(conversationId, {
      announcement: !!announcement,
    });
    this.gateway.emitConversationUpdate(
      await this.memberIdsOf(conversationId),
      conversationId,
    );
    return { ok: true, announcement: !!announcement };
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
        announcement: !!convo.announcement,
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
        // Estado personal (fijar / archivar / silenciar / no leído).
        pinned: !!membership.pinnedAt,
        pinnedAt: membership.pinnedAt,
        archived: !!membership.archivedAt,
        muted:
          !!membership.mutedUntil &&
          new Date(membership.mutedUntil).getTime() > Date.now(),
        mutedUntil: membership.mutedUntil,
        markedUnread: !!membership.markedUnread,
      });
    }

    // Etiquetas personales de cada conversación (en lote).
    const labelMap = await this.labelsByConversation(
      meId,
      result.map((r) => r.id),
    );
    for (const r of result) r.labels = labelMap.get(r.id) ?? [];

    // Orden: fijadas primero (por fecha de fijado), luego por último mensaje.
    result.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.pinned && b.pinned) {
        const pa = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
        const pb = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
        if (pa !== pb) return pb - pa;
      }
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return tb - ta;
    });
    return result;
  }

  // ── estado personal de una conversación (fijar/archivar/silenciar/no leído) ─
  async setPinned(meId: string, conversationId: string, pinned: boolean) {
    await this.assertMember(conversationId, meId);
    await this.members.update(
      { conversationId, userId: meId },
      { pinnedAt: pinned ? new Date() : null },
    );
    return { ok: true, pinned };
  }

  async setArchived(meId: string, conversationId: string, archived: boolean) {
    await this.assertMember(conversationId, meId);
    await this.members.update(
      { conversationId, userId: meId },
      { archivedAt: archived ? new Date() : null },
    );
    return { ok: true, archived };
  }

  async setMuted(meId: string, conversationId: string, untilIso: string | null) {
    await this.assertMember(conversationId, meId);
    let until: Date | null = null;
    if (untilIso) {
      const d = new Date(untilIso);
      if (!isNaN(d.getTime())) until = d;
    }
    await this.members.update(
      { conversationId, userId: meId },
      { mutedUntil: until },
    );
    return { ok: true, mutedUntil: until };
  }

  async setMarkedUnread(meId: string, conversationId: string, unread: boolean) {
    await this.assertMember(conversationId, meId);
    await this.members.update(
      { conversationId, userId: meId },
      { markedUnread: unread },
    );
    return { ok: true, markedUnread: unread };
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

    // Cuáles de estos mensajes tengo guardados (en lote).
    const savedSet = await this.savedIdsFor(meId, ids);

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
        saved: savedSet.has(m.id),
      }),
    );
  }

  /** Conjunto de ids de mensaje guardados por el usuario, de entre `ids`. */
  private async savedIdsFor(
    meId: string,
    ids: string[],
  ): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const rows = await this.saved.find({
      where: { userId: meId, messageId: In(ids) },
    });
    return new Set(rows.map((r) => r.messageId));
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
    await this.assertCanPost(conversationId, meId);
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
    await this.assertCanPost(conversationId, meId);
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
    await this.assertCanPost(conversationId, meId);
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
    // Leer también limpia el "no leído" manual.
    await this.members.update(
      { conversationId, userId: meId },
      { lastReadAt, markedUnread: false },
    );
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
    await this.assertCanPost(targetConversationId, meId); // permiso en el destino

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
    await this.assertCanPost(conversationId, meId);
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
    await this.assertCanPost(conversationId, meId);
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
      saved?: boolean;
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
      saved: extras?.saved ?? false,
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

  // ── mensajes guardados (destacados, personales) ───────────────────────────
  async setSaved(meId: string, messageId: string, saved: boolean) {
    const msg = await this.messages.findOne({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Mensaje no encontrado');
    await this.assertMember(msg.conversationId, meId);
    const existing = await this.saved.findOne({
      where: { userId: meId, messageId },
    });
    if (saved && !existing) {
      await this.saved.save(
        this.saved.create({
          userId: meId,
          messageId,
          conversationId: msg.conversationId,
        }),
      );
    } else if (!saved && existing) {
      await this.saved.delete({ id: existing.id });
    }
    return { ok: true, saved };
  }

  /** Lista mis mensajes guardados con contexto de conversación. */
  async listSaved(meId: string) {
    const rows = await this.saved.find({
      where: { userId: meId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    if (!rows.length) return [];
    const msgs = await this.messages.find({
      where: { id: In(rows.map((r) => r.messageId)) },
    });
    const msgById = new Map(msgs.map((m) => [m.id, m]));
    const convoIds = Array.from(new Set(rows.map((r) => r.conversationId)));
    const convos = await this.conversations.find({
      where: { id: In(convoIds) },
    });
    const convoById = new Map(convos.map((c) => [c.id, c]));
    const memberRows = await this.members.find({
      where: { conversationId: In(convoIds) },
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

    return rows
      .map((r) => {
        const m = msgById.get(r.messageId);
        if (!m || m.deletedAt) return null;
        const c = convoById.get(r.conversationId);
        let title = c?.name ?? 'Conversación';
        if (c?.type === 'dm') {
          const o = userById.get(otherByConvo.get(r.conversationId) ?? '');
          title = o?.username ?? o?.email ?? 'Usuario';
        }
        return {
          id: m.id,
          conversationId: r.conversationId,
          conversationTitle: title,
          conversationType: c?.type ?? 'dm',
          senderId: m.senderId,
          type: m.type,
          snippet: this.replyPreviewOf(m).snippet,
          createdAt: m.createdAt,
          savedAt: r.createdAt,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
  }

  // ── galería: multimedia / archivos / enlaces de una conversación ───────────
  async listMedia(meId: string, conversationId: string, kind: string) {
    await this.assertMember(conversationId, meId);
    if (kind === 'image' || kind === 'file') {
      const rows = await this.messages.find({
        where: { conversationId, type: kind, deletedAt: IsNull() },
        order: { createdAt: 'DESC' },
        take: 120,
      });
      return rows.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        type: m.type,
        fileName: m.fileName ?? null,
        fileMime: m.fileMime ?? null,
        fileSize: m.fileSize ?? null,
        imageMime: m.imageMime ?? null,
        createdAt: m.createdAt,
      }));
    }
    // Enlaces: mensajes de texto con http(s) (excluye tokens especiales [[..]]).
    const rows = await this.messages.find({
      where: [
        {
          conversationId,
          type: 'text',
          deletedAt: IsNull(),
          body: Like('%http://%'),
        },
        {
          conversationId,
          type: 'text',
          deletedAt: IsNull(),
          body: Like('%https://%'),
        },
      ],
      order: { createdAt: 'DESC' },
      take: 120,
    });
    return rows
      .map((m) => {
        if ((m.body ?? '').trim().startsWith('[[')) return null;
        const url = firstUrl(m.body);
        if (!url) return null;
        return {
          id: m.id,
          senderId: m.senderId,
          url,
          body: (m.body ?? '').slice(0, 200),
          createdAt: m.createdAt,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
  }

  // ── previsualización de enlaces (unfurl) con defensa SSRF + caché ──────────
  private readonly unfurlCache = new Map<
    string,
    { at: number; data: LinkPreview }
  >();

  async unfurl(rawUrl: string): Promise<LinkPreview> {
    const url = (rawUrl ?? '').trim();
    if (!url) throw new BadRequestException('URL vacía');
    const fallback: LinkPreview = {
      url,
      title: null,
      description: null,
      image: null,
      siteName: null,
    };
    const cached = this.unfurlCache.get(url);
    if (cached && Date.now() - cached.at < 60 * 60 * 1000) return cached.data;

    let start: URL;
    try {
      start = new URL(url);
    } catch {
      return fallback;
    }
    if (start.protocol !== 'http:' && start.protocol !== 'https:') {
      return fallback;
    }
    const fetched = await this.safeFetchHtml(start);
    const data = fetched
      ? parseOpenGraph(fetched.html, fetched.finalUrl)
      : fallback;
    // Conserva la URL original como clave/identidad del preview.
    data.url = url;
    this.unfurlCache.set(url, { at: Date.now(), data });
    return data;
  }

  /**
   * Descarga HTML validando CADA salto de redirección contra hosts privados
   * (evita SSRF por redirección). Acota tamaño, tipo y tiempo.
   */
  private async safeFetchHtml(
    start: URL,
  ): Promise<{ html: string; finalUrl: string } | null> {
    let current = start;
    for (let hop = 0; hop < 4; hop++) {
      try {
        const { address } = await lookup(current.hostname);
        if (isPrivateIp(address)) return null;
      } catch {
        return null;
      }
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      let res: Awaited<ReturnType<typeof fetch>>;
      try {
        res = await fetch(current.toString(), {
          signal: ctrl.signal,
          redirect: 'manual',
          headers: {
            'User-Agent': 'AxosBot/1.0 (+link-preview)',
            Accept: 'text/html,application/xhtml+xml',
          },
        });
      } catch {
        clearTimeout(timer);
        return null;
      }
      clearTimeout(timer);

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) return null;
        try {
          current = new URL(loc, current);
        } catch {
          return null;
        }
        if (current.protocol !== 'http:' && current.protocol !== 'https:') {
          return null;
        }
        continue;
      }
      const ct = res.headers.get('content-type') ?? '';
      const len = Number(res.headers.get('content-length') ?? '0');
      if (!res.ok || !ct.includes('text/html') || len > 3 * 1024 * 1024) {
        return null;
      }
      const buf = await res.arrayBuffer();
      const html = Buffer.from(buf).subarray(0, 512 * 1024).toString('utf8');
      return { html, finalUrl: current.toString() };
    }
    return null;
  }

  // ── reuniones programadas ──────────────────────────────────────────────────
  async createMeeting(
    meId: string,
    conversationId: string,
    title: string,
    startAtIso: string,
    durationMin: number,
    recurrence: string,
  ) {
    await this.assertMember(conversationId, meId);
    const t = (title ?? '').trim().slice(0, 160);
    if (!t) throw new BadRequestException('La reunión necesita un título');
    const when = new Date(startAtIso);
    if (isNaN(when.getTime())) throw new BadRequestException('Fecha inválida');
    const rec: MeetingRecurrence =
      recurrence === 'daily' || recurrence === 'weekly' ? recurrence : 'none';
    const dur = Math.max(5, Math.min(1440, Math.floor(Number(durationMin) || 30)));
    const row = await this.meetings.save(
      this.meetings.create({
        conversationId,
        createdById: meId,
        title: t,
        startAt: when,
        durationMin: dur,
        recurrence: rec,
      }),
    );
    this.gateway.emitConversationUpdate(
      await this.memberIdsOf(conversationId),
      conversationId,
    );
    return this.meetingDto(row);
  }

  async listMeetings(meId: string, conversationId: string) {
    await this.assertMember(conversationId, meId);
    const rows = await this.meetings.find({
      where: { conversationId, canceledAt: IsNull() },
      order: { startAt: 'ASC' },
      take: 50,
    });
    const now = Date.now();
    return rows
      .filter((m) => new Date(m.startAt).getTime() + m.durationMin * 60000 > now)
      .map((m) => this.meetingDto(m));
  }

  async cancelMeeting(meId: string, id: string) {
    const m = await this.meetings.findOne({ where: { id } });
    if (!m) throw new NotFoundException('Reunión no encontrada');
    await this.assertMember(m.conversationId, meId);
    if (m.createdById !== meId) {
      throw new ForbiddenException('Solo quien la creó puede cancelarla');
    }
    await this.meetings.update(id, { canceledAt: new Date() });
    this.gateway.emitConversationUpdate(
      await this.memberIdsOf(m.conversationId),
      m.conversationId,
    );
    return { ok: true };
  }

  private meetingDto(m: Meeting) {
    return {
      id: m.id,
      conversationId: m.conversationId,
      createdById: m.createdById,
      title: m.title,
      startAt: m.startAt,
      durationMin: m.durationMin,
      recurrence: m.recurrence,
    };
  }

  /** Recordatorios: avisa ~5 min antes y adelanta las recurrentes ya pasadas. */
  @Interval(60000)
  async sweepMeetingReminders(): Promise<void> {
    const now = Date.now();
    const soon = new Date(now + 5 * 60000);
    const due = await this.meetings.find({
      where: {
        canceledAt: IsNull(),
        remindedAt: IsNull(),
        startAt: LessThanOrEqual(soon),
      },
      take: 100,
    });
    for (const m of due) {
      const memberIds = await this.memberIdsOf(m.conversationId);
      this.gateway.emitMeetingReminder(memberIds, {
        id: m.id,
        conversationId: m.conversationId,
        title: m.title,
        startAt: m.startAt,
      });
      await this.meetings.update(m.id, { remindedAt: new Date() });
    }
    // Recurrentes cuya ocurrencia ya terminó → adelantar a la siguiente.
    const passed = await this.meetings.find({
      where: {
        canceledAt: IsNull(),
        recurrence: Not('none'),
        startAt: LessThanOrEqual(new Date(now)),
      },
      take: 100,
    });
    for (const m of passed) {
      const endsAt = new Date(m.startAt).getTime() + m.durationMin * 60000;
      if (endsAt > now) continue; // aún en curso
      const next = this.nextOccurrence(new Date(m.startAt), m.recurrence, now);
      await this.meetings.update(m.id, { startAt: next, remindedAt: null });
    }
  }

  private nextOccurrence(
    from: Date,
    rec: MeetingRecurrence,
    now: number,
  ): Date {
    const step = rec === 'daily' ? 86400000 : 7 * 86400000;
    let t = from.getTime();
    while (t <= now) t += step;
    return new Date(t);
  }
}
