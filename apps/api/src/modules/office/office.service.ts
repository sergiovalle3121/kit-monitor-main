import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository } from 'typeorm';
import { OfficeDocument, OfficeDocumentLifecycleState, OfficeDocType, OfficeShare } from './entities/office-document.entity';
import { OfficeDocumentVersion } from './entities/office-document-version.entity';
import { OfficeComment, OfficeCommentAnchorType } from './entities/office-comment.entity';
import { OfficeDocumentComment } from './entities/office-document-comment.entity';
import { CreateOfficeCommentDto, ListOfficeCommentsQueryDto, ReplyOfficeCommentDto, UpdateOfficeCommentDto } from './dto/office-comment.dto';
import { AuthenticatedUser } from '../../common/types/jwt.types';
import { AuditService } from '../governance/audit.service';

const TYPES: OfficeDocType[] = ['doc', 'sheet', 'slides'];
// Columns returned by list endpoints — heavy `content` is intentionally omitted.
const LIST_COLUMNS = ['id', 'type', 'title', 'model', 'createdBy', 'tenantId', 'lifecycleState', 'locked', 'createdAt', 'updatedAt'];
// Auto-snapshots are throttled so autosave doesn't create a version every keystroke.
const SNAPSHOT_THROTTLE_MS = 2 * 60 * 1000;
const MAX_VERSIONS = 50;

interface CreateDto { type: OfficeDocType; title?: string; content?: any; model?: string }
interface UpdateDto { title?: string; content?: any; model?: string | null; sharedWith?: OfficeShare[] }
interface LifecycleDto { note?: string }
interface ListFilters {
  q?: string;
  lifecycle?: OfficeDocumentLifecycleState;
  locked?: string;
  owner?: string;
}
interface CommentDto { parentId?: string | null; anchorType?: OfficeCommentAnchorType; slideIndex?: number | null; objectId?: string | null; rangeRef?: string | null; anchorLabel?: string | null; text: string; assignedTo?: string | null }

/**
 * Documents are scoped to their owner. A user only ever sees the documents
 * they created (admins see everything). Writes are blocked for read-only roles
 * (e.g. the `executive` demo account, whose RBAC permissions are all `*:read`).
 */
@Injectable()
export class OfficeService {
  constructor(
    @InjectRepository(OfficeDocument) private readonly repo: Repository<OfficeDocument>,
    @InjectRepository(OfficeDocumentVersion) private readonly versionRepo: Repository<OfficeDocumentVersion>,
    @InjectRepository(OfficeDocumentComment) private readonly commentRepo: Repository<OfficeDocumentComment>,
    private readonly audit: AuditService,
    @InjectRepository(OfficeComment) private readonly slideCommentRepo: Repository<OfficeComment>,
  ) {}

  // ── Authorization helpers ─────────────────────────────────────────────────
  private isAdmin(u?: AuthenticatedUser) {
    return u?.role === 'Admin';
  }
  /** A user can author content if they're admin or hold any `*:write` permission. */
  private canWrite(u?: AuthenticatedUser) {
    return this.isAdmin(u) || (u?.permissions ?? []).some((p) => p.endsWith(':write'));
  }
  private email(u?: AuthenticatedUser) {
    return u?.email ?? null;
  }
  private shareFor(doc: OfficeDocument, u?: AuthenticatedUser): OfficeShare | undefined {
    const e = this.email(u);
    if (!e || !Array.isArray(doc.sharedWith)) return undefined;
    return doc.sharedWith.find((s) => s.email?.toLowerCase() === e.toLowerCase());
  }
  private isOwner(doc: OfficeDocument, u?: AuthenticatedUser) {
    return this.isAdmin(u) || (!!doc.createdBy && doc.createdBy === this.email(u));
  }
  private canRead(doc: OfficeDocument, u?: AuthenticatedUser) {
    return this.isOwner(doc, u) || !!this.shareFor(doc, u);
  }
  private canEdit(doc: OfficeDocument, u?: AuthenticatedUser) {
    if (!this.canWrite(u)) return false; // read-only role
    return this.isOwner(doc, u) || this.shareFor(doc, u)?.access === 'edit';
  }
  private assertWriter(u?: AuthenticatedUser) {
    if (!this.canWrite(u)) throw new ForbiddenException('Tu cuenta es de solo lectura.');
  }

  // ── Queries ───────────────────────────────────────────────────────────────
  list(type: OfficeDocType | undefined, user: AuthenticatedUser, trash = false, filters: ListFilters = {}) {
    const qb = this.repo.createQueryBuilder('d').select(LIST_COLUMNS.map((c) => `d.${c}`));
    if (type) qb.andWhere('d.type = :type', { type });
    if (trash) qb.withDeleted().andWhere('d.deletedAt IS NOT NULL');
    const q = String(filters.q ?? '').trim().toLowerCase();
    if (q) {
      qb.andWhere(new Brackets((b) => {
        b.where('LOWER(d.title) LIKE :q', { q: `%${q}%` })
          .orWhere("LOWER(COALESCE(d.model, '')) LIKE :q", { q: `%${q}%` })
          .orWhere("LOWER(COALESCE(d.createdBy, '')) LIKE :q", { q: `%${q}%` });
      }));
    }
    if (filters.lifecycle && ['draft', 'in_review', 'approved', 'effective', 'obsolete'].includes(filters.lifecycle)) {
      qb.andWhere('d.lifecycleState = :lifecycle', { lifecycle: filters.lifecycle });
    }
    if (filters.locked === '1' || filters.locked === 'true') qb.andWhere('d.locked = true');
    if (filters.locked === '0' || filters.locked === 'false') qb.andWhere('d.locked = false');
    const owner = String(filters.owner ?? '').trim().toLowerCase();
    if (owner) qb.andWhere('LOWER(COALESCE(d.createdBy, \'\')) = :owner', { owner });
    if (!this.isAdmin(user)) {
      const email = this.email(user) ?? '__none__';
      if (trash) {
        // Trash only shows your own deleted documents.
        qb.andWhere('d.createdBy = :email', { email });
      } else {
        // Owners see their docs; everyone else sees docs shared with them.
        // Match the quoted email substring — robust across jsonb (Postgres adds
        // spaces, e.g. `"email": "x"`) and simple-json (sqlite, compact) storage.
        qb.andWhere('(d.createdBy = :email OR LOWER(CAST(d.sharedWith AS TEXT)) LIKE :share)', {
          email,
          share: `%"${email.toLowerCase()}"%`,
        });
      }
    }
    qb.orderBy('d.updatedAt', 'DESC');
    return qb.getMany();
  }

  async get(id: string, user: AuthenticatedUser) {
    const doc = await this.repo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Documento no encontrado.');
    if (!this.canRead(doc, user)) throw new ForbiddenException('No tienes acceso a este documento.');
    return doc;
  }

  create(dto: CreateDto, user: AuthenticatedUser) {
    this.assertWriter(user);
    if (!TYPES.includes(dto.type)) throw new BadRequestException('Tipo inválido.');
    return this.repo.save(
      this.repo.create({
        type: dto.type,
        title: dto.title?.trim() || 'Sin título',
        content: dto.content ?? null,
        model: dto.model?.trim().toUpperCase() || null,
        createdBy: this.email(user),
        tenantId: user?.tenant_id ?? null,
        lifecycleState: 'draft',
        locked: false,
      }),
    );
  }

  async update(id: string, dto: UpdateDto, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.canEdit(doc, user)) throw new ForbiddenException('No puedes editar este documento.');
    if (doc.locked && (dto.title !== undefined || dto.content !== undefined || dto.model !== undefined)) {
      throw new ForbiddenException('El documento está bloqueado por su estado de ciclo de vida.');
    }
    // Snapshot the pre-edit state (throttled) so history captures prior versions.
    if (dto.content !== undefined) await this.maybeSnapshot(doc, user);
    if (dto.title !== undefined) doc.title = dto.title.trim() || 'Sin título';
    if (dto.content !== undefined) doc.content = dto.content;
    if (dto.model !== undefined) doc.model = dto.model?.trim().toUpperCase() || null;
    if (dto.sharedWith !== undefined) {
      // Only the owner (or an admin) can change who a document is shared with.
      if (!this.isOwner(doc, user)) throw new ForbiddenException('Solo el dueño puede compartir.');
      doc.sharedWith = this.normalizeShares(dto.sharedWith);
    }
    return this.repo.save(doc);
  }

  /** Duplicate a document the user can read into a fresh copy they own. */
  async duplicate(id: string, user: AuthenticatedUser) {
    this.assertWriter(user);
    const src = await this.get(id, user);
    return this.repo.save(
      this.repo.create({
        type: src.type,
        title: `${src.title} (copia)`,
        content: src.content,
        model: src.model,
        createdBy: this.email(user),
        tenantId: user?.tenant_id ?? null,
        lifecycleState: 'draft',
        locked: false,
      }),
    );
  }

  async submitForReview(id: string, user: AuthenticatedUser, dto: LifecycleDto = {}) {
    const doc = await this.get(id, user);
    if (!this.canEdit(doc, user)) throw new ForbiddenException('No puedes enviar este documento a revisión.');
    if (doc.lifecycleState === 'obsolete') throw new BadRequestException('No se puede reabrir un documento obsoleto desde revisión.');
    return this.transitionLifecycle(doc, user, 'in_review', 'SUBMIT_DOC_REVIEW', dto.note, { locked: false });
  }

  async approve(id: string, user: AuthenticatedUser, dto: LifecycleDto = {}) {
    const doc = await this.get(id, user);
    if (!this.canEdit(doc, user)) throw new ForbiddenException('No puedes aprobar este documento.');
    if (!['draft', 'in_review'].includes(doc.lifecycleState)) throw new BadRequestException('Solo documentos draft/in_review pueden aprobarse.');
    return this.transitionLifecycle(doc, user, 'approved', 'APPROVE_DOC', dto.note, {
      locked: true,
      approvedBy: this.email(user),
      approvedAt: new Date(),
    });
  }

  async release(id: string, user: AuthenticatedUser, dto: LifecycleDto = {}) {
    const doc = await this.get(id, user);
    if (!this.canEdit(doc, user)) throw new ForbiddenException('No puedes liberar este documento.');
    if (doc.lifecycleState !== 'approved') throw new BadRequestException('Solo documentos aprobados pueden liberarse.');
    return this.transitionLifecycle(doc, user, 'effective', 'RELEASE_DOC', dto.note, {
      locked: true,
      releasedBy: this.email(user),
      releasedAt: new Date(),
    });
  }

  async obsolete(id: string, user: AuthenticatedUser, dto: LifecycleDto = {}) {
    const doc = await this.get(id, user);
    if (!this.isOwner(doc, user)) throw new ForbiddenException('Solo el dueño puede obsoletar este documento.');
    if (doc.lifecycleState === 'obsolete') return doc;
    return this.transitionLifecycle(doc, user, 'obsolete', 'OBSOLETE_DOC', dto.note, {
      locked: true,
      obsoletedBy: this.email(user),
      obsoletedAt: new Date(),
    });
  }

  async reopenDraft(id: string, user: AuthenticatedUser, dto: LifecycleDto = {}) {
    const doc = await this.get(id, user);
    if (!this.isOwner(doc, user)) throw new ForbiddenException('Solo el dueño puede reabrir este documento.');
    if (doc.lifecycleState === 'obsolete') throw new BadRequestException('Un documento obsoleto no se reabre; duplica para crear una nueva revisión.');
    return this.transitionLifecycle(doc, user, 'draft', 'REOPEN_DOC_DRAFT', dto.note, { locked: false });
  }

  /** Move to trash (soft delete). Only the owner/admin may delete. */
  async remove(id: string, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    this.assertWriter(user);
    if (!this.isOwner(doc, user)) throw new ForbiddenException('Solo el dueño puede eliminar.');
    await this.repo.softDelete(id);
    return { deleted: true, id };
  }

  async restore(id: string, user: AuthenticatedUser) {
    const doc = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!doc) throw new NotFoundException('Documento no encontrado.');
    this.assertWriter(user);
    if (!this.isOwner(doc, user)) throw new ForbiddenException('Solo el dueño puede restaurar.');
    await this.repo.restore(id);
    return this.repo.findOne({ where: { id } });
  }

  /** Permanently erase a trashed document. */
  async destroy(id: string, user: AuthenticatedUser) {
    const doc = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!doc) throw new NotFoundException('Documento no encontrado.');
    this.assertWriter(user);
    if (!this.isOwner(doc, user)) throw new ForbiddenException('Solo el dueño puede eliminar.');
    await this.slideCommentRepo.delete({ documentId: id });
    await this.commentRepo.delete({ documentId: id });
    await this.versionRepo.delete({ documentId: id });
    await this.repo.delete(id);
    return { destroyed: true, id };
  }

  private async transitionLifecycle(
    doc: OfficeDocument,
    user: AuthenticatedUser,
    next: OfficeDocumentLifecycleState,
    action: string,
    note?: string,
    patch: Partial<OfficeDocument> = {},
  ) {
    const before = {
      lifecycleState: doc.lifecycleState,
      locked: doc.locked,
      approvedBy: doc.approvedBy,
      releasedBy: doc.releasedBy,
      obsoletedBy: doc.obsoletedBy,
    };
    await this.snapshot(doc, user, `Lifecycle: ${doc.lifecycleState} → ${next}`);
    Object.assign(doc, patch, { lifecycleState: next });
    const saved = await this.repo.save(doc);
    await this.audit.log({
      actor: this.email(user) || 'unknown',
      action,
      entity: 'OfficeDocument',
      entityId: doc.id,
      before,
      after: {
        lifecycleState: saved.lifecycleState,
        locked: saved.locked,
        approvedBy: saved.approvedBy,
        releasedBy: saved.releasedBy,
        obsoletedBy: saved.obsoletedBy,
        note: String(note ?? '').slice(0, 1000) || undefined,
      },
      scope: { tenant_id: doc.tenantId ?? user?.tenant_id ?? null },
    });
    return saved;
  }


  private toDocumentCommentDto(comment: OfficeComment, replies: OfficeComment[] = []) {
    return {
      id: comment.id,
      documentId: comment.documentId,
      anchorId: comment.rangeRef || comment.objectId || comment.id,
      text: comment.text,
      author: comment.authorEmail,
      mentions: [],
      quotedText: comment.anchorLabel,
      anchor: null,
      replies: replies.map((reply) => ({
        id: reply.id,
        author: reply.authorEmail,
        text: reply.text,
        mentions: [],
        createdAt: reply.createdAt?.toISOString?.() ?? reply.createdAt,
      })),
      assignedTo: comment.assignedTo,
      resolved: comment.resolved,
      resolvedBy: comment.resolvedBy,
      resolvedAt: comment.resolvedAt,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }

  // ── Persistent document comments (Docs: shared office_comments threads) ─────
  async listComments(id: string, user: AuthenticatedUser, query: ListOfficeCommentsQueryDto = {}) {
    const doc = await this.get(id, user);
    const qb = this.slideCommentRepo.createQueryBuilder('c')
      .where('c.documentId = :id', { id: doc.id })
      .andWhere('c.parentId IS NULL')
      .andWhere('c.anchorType = :anchorType', { anchorType: 'text' });
    if (doc.tenantId) qb.andWhere('c.tenantId = :tenantId', { tenantId: doc.tenantId });
    else qb.andWhere('c.tenantId IS NULL');
    const status = query.status ?? (query.includeResolved === '0' || query.includeResolved === 'false' ? 'open' : 'all');
    if (status === 'open') qb.andWhere('c.resolved = false');
    if (status === 'resolved') qb.andWhere('c.resolved = true');
    const assignedTo = String(query.assignedTo ?? '').trim().toLowerCase();
    if (assignedTo) qb.andWhere('LOWER(c.assignedTo) = :assignedTo', { assignedTo });
    const author = String(query.author ?? '').trim().toLowerCase();
    if (author) qb.andWhere('LOWER(c.authorEmail) = :author', { author });
    const mention = String(query.mention ?? '').trim().toLowerCase();
    const q = String(query.q ?? '').trim().toLowerCase();
    if (q) qb.andWhere("(LOWER(c.text) LIKE :q OR LOWER(COALESCE(c.anchorLabel, '')) LIKE :q)", { q: `%${q}%` });
    qb.orderBy('c.resolved', 'ASC').addOrderBy('c.updatedAt', 'DESC').take(query.limit ?? 100);
    let roots = await qb.getMany();
    const rootIds = roots.map((c) => c.id);
    const replies = rootIds.length ? await this.slideCommentRepo.createQueryBuilder('r')
      .where('r.documentId = :id', { id: doc.id })
      .andWhere('r.parentId IN (:...rootIds)', { rootIds })
      .orderBy('r.createdAt', 'ASC')
      .getMany() : [];
    const repliesByParent = new Map<string, OfficeComment[]>();
    for (const reply of replies) repliesByParent.set(reply.parentId!, [...(repliesByParent.get(reply.parentId!) ?? []), reply]);
    if (mention) roots = roots.filter((root) => [root, ...(repliesByParent.get(root.id) ?? [])].some((c) => c.text.toLowerCase().includes(`@${mention}`) || c.assignedTo === mention));
    return roots.map((root) => this.toDocumentCommentDto(root, repliesByParent.get(root.id) ?? []));
  }

  async createComment(id: string, dto: CreateOfficeCommentDto, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.canEdit(doc, user)) throw new ForbiddenException('No puedes comentar este documento.');
    const text = String(dto.text ?? '').trim();
    if (!text) throw new BadRequestException('El comentario no puede estar vacío.');
    const anchorId = String(dto.anchorId ?? '').trim() || `cm_${Date.now().toString(36)}`;
    const saved = await this.slideCommentRepo.save(this.slideCommentRepo.create({
      tenantId: doc.tenantId ?? user?.tenant_id ?? null,
      documentId: id,
      parentId: null,
      anchorType: 'text',
      rangeRef: anchorId,
      objectId: anchorId,
      text,
      authorEmail: this.email(user),
      assignedTo: this.normalizePrincipal(dto.assignedTo),
      anchorLabel: String(dto.quotedText ?? '').slice(0, 1000) || null,
      resolved: false,
    }));
    return this.toDocumentCommentDto(saved);
  }

  async updateComment(id: string, commentId: string, dto: UpdateOfficeCommentDto, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.canEdit(doc, user)) throw new ForbiddenException('No puedes editar comentarios en este documento.');
    const c = await this.slideCommentRepo.findOne({ where: { id: commentId, documentId: id, anchorType: 'text' } });
    if (!c) throw new NotFoundException('Comentario no encontrado.');
    if (dto.text !== undefined) {
      const text = String(dto.text).trim();
      if (!text) throw new BadRequestException('El comentario no puede estar vacío.');
      c.text = text;
    }
    if (dto.assignedTo !== undefined) c.assignedTo = this.normalizePrincipal(dto.assignedTo);
    if (dto.quotedText !== undefined) c.anchorLabel = String(dto.quotedText ?? '').slice(0, 1000) || null;
    if (dto.resolved !== undefined && c.resolved !== !!dto.resolved) {
      c.resolved = !!dto.resolved;
      c.resolvedBy = c.resolved ? this.email(user) : null;
      c.resolvedAt = c.resolved ? new Date() : null;
    }
    const saved = await this.slideCommentRepo.save(c);
    const replies = await this.slideCommentRepo.find({ where: { documentId: id, parentId: saved.id }, order: { createdAt: 'ASC' } });
    return this.toDocumentCommentDto(saved, replies);
  }

  async replyToComment(id: string, commentId: string, dto: ReplyOfficeCommentDto, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.canEdit(doc, user)) throw new ForbiddenException('No puedes responder en este documento.');
    const c = await this.slideCommentRepo.findOne({ where: { id: commentId, documentId: id, anchorType: 'text' } });
    if (!c) throw new NotFoundException('Comentario no encontrado.');
    const text = String(dto.text ?? '').trim();
    if (!text) throw new BadRequestException('La respuesta no puede estar vacía.');
    await this.slideCommentRepo.save(this.slideCommentRepo.create({
      documentId: doc.id,
      parentId: c.id,
      tenantId: doc.tenantId ?? user?.tenant_id ?? null,
      authorEmail: this.email(user),
      assignedTo: this.normalizeMentions(dto.mentions)[0] ?? null,
      anchorType: 'text',
      rangeRef: c.rangeRef,
      objectId: c.objectId,
      anchorLabel: c.anchorLabel,
      text,
      resolved: false,
    }));
    const saved = await this.slideCommentRepo.findOneOrFail({ where: { id: c.id, documentId: id } });
    const replies = await this.slideCommentRepo.find({ where: { documentId: id, parentId: c.id }, order: { createdAt: 'ASC' } });
    return this.toDocumentCommentDto(saved, replies);
  }

  async deleteComment(id: string, commentId: string, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.canEdit(doc, user)) throw new ForbiddenException('No puedes eliminar comentarios en este documento.');
    const c = await this.slideCommentRepo.findOne({ where: { id: commentId, documentId: id, anchorType: 'text' } });
    if (!c) throw new NotFoundException('Comentario no encontrado.');
    await this.slideCommentRepo.delete({ parentId: c.id, documentId: id });
    await this.slideCommentRepo.delete(c.id);
    return { deleted: true, id: commentId };
  }

  async timeline(id: string, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    const [versions, comments, audit] = await Promise.all([
      this.versionRepo.find({
        where: { documentId: id },
        order: { createdAt: 'DESC' },
        select: ['id', 'label', 'createdBy', 'createdAt'],
        take: 25,
      }),
      this.slideCommentRepo.find({
        where: { documentId: id, parentId: IsNull() },
        order: { updatedAt: 'DESC' },
        select: ['id', 'rangeRef', 'authorEmail', 'resolved', 'resolvedBy', 'resolvedAt', 'updatedAt', 'createdAt'],
        take: 50,
      }),
      this.audit.getEntityLogs('OfficeDocument', id, 50),
    ]);
    const events = [
      {
        id: `doc:${doc.id}:created`,
        kind: 'document',
        action: 'CREATED',
        actor: doc.createdBy,
        at: doc.createdAt,
        details: { title: doc.title, lifecycleState: doc.lifecycleState, locked: doc.locked },
      },
      ...versions.map((v) => ({
        id: `version:${v.id}`,
        kind: 'version',
        action: v.label || 'VERSION_SNAPSHOT',
        actor: v.createdBy,
        at: v.createdAt,
        details: { versionId: v.id },
      })),
      ...comments.map((c) => ({
        id: `comment:${c.id}`,
        kind: 'comment',
        action: c.resolved ? 'COMMENT_RESOLVED' : 'COMMENT_UPDATED',
        actor: c.resolved ? c.resolvedBy : c.authorEmail,
        at: c.resolvedAt || c.updatedAt || c.createdAt,
        details: { commentId: c.id, anchorId: c.rangeRef, resolved: c.resolved },
      })),
      ...audit.map((a) => ({
        id: `audit:${a.id}`,
        kind: 'audit',
        action: a.action,
        actor: a.actor,
        at: a.timestamp,
        details: { before: a.before, after: a.after, result: a.result, reason: a.reason },
      })),
    ].sort((a, b) => new Date(b.at as any).getTime() - new Date(a.at as any).getTime());
    return { documentId: id, events };
  }

  // ── Slide/object comments (Slides: office_comments, generic anchors) ─────────
  async listSlideComments(id: string, user: AuthenticatedUser, includeResolved = true) {
    const doc = await this.get(id, user);
    const qb = this.slideCommentRepo.createQueryBuilder('c')
      .where('c.documentId = :id', { id: doc.id })
      .orderBy('c.createdAt', 'ASC');
    if (doc.tenantId) qb.andWhere('c.tenantId = :tenantId', { tenantId: doc.tenantId });
    else qb.andWhere('c.tenantId IS NULL');
    if (!includeResolved) qb.andWhere('c.resolved = false');
    return qb.getMany();
  }

  async addSlideComment(id: string, dto: CommentDto, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.canEdit(doc, user)) throw new ForbiddenException('No puedes comentar este documento.');
    const text = String(dto.text ?? '').trim();
    if (!text) throw new BadRequestException('El comentario no puede estar vacío.');
    if (dto.parentId) {
      const parent = await this.slideCommentRepo.findOne({ where: { id: dto.parentId, documentId: doc.id } });
      if (!parent) throw new BadRequestException('Thread de comentario inválido.');
    }
    return this.slideCommentRepo.save(this.slideCommentRepo.create({
      documentId: doc.id,
      parentId: dto.parentId || null,
      tenantId: doc.tenantId ?? user?.tenant_id ?? null,
      authorEmail: this.email(user),
      assignedTo: dto.assignedTo?.trim().toLowerCase() || null,
      anchorType: dto.anchorType || 'document',
      slideIndex: typeof dto.slideIndex === 'number' ? dto.slideIndex : null,
      objectId: dto.objectId?.trim() || null,
      rangeRef: dto.rangeRef?.trim() || null,
      anchorLabel: dto.anchorLabel?.trim() || null,
      text,
      resolved: false,
      resolvedBy: null,
      resolvedAt: null,
    }));
  }

  async resolveSlideComment(id: string, commentId: string, resolved: boolean, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.canEdit(doc, user)) throw new ForbiddenException('No puedes resolver comentarios en este documento.');
    const c = await this.slideCommentRepo.findOne({ where: { id: commentId, documentId: doc.id } });
    if (!c) throw new NotFoundException('Comentario no encontrado.');
    c.resolved = !!resolved;
    c.resolvedBy = c.resolved ? this.email(user) : null;
    c.resolvedAt = c.resolved ? new Date() : null;
    return this.slideCommentRepo.save(c);
  }

  async removeSlideComment(id: string, commentId: string, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.canEdit(doc, user)) throw new ForbiddenException('No puedes eliminar comentarios en este documento.');
    const c = await this.slideCommentRepo.findOne({ where: { id: commentId, documentId: doc.id } });
    if (!c) throw new NotFoundException('Comentario no encontrado.');
    await this.slideCommentRepo.delete({ id: commentId, documentId: doc.id });
    return { deleted: true, id: commentId };
  }

  // ── Version history ─────────────────────────────────────────────────────────
  async listVersions(id: string, user: AuthenticatedUser) {
    await this.get(id, user); // read-access check
    return this.versionRepo.find({
      where: { documentId: id },
      order: { createdAt: 'DESC' },
      select: ['id', 'title', 'label', 'createdBy', 'createdAt'],
    });
  }

  async getVersion(id: string, versionId: string, user: AuthenticatedUser) {
    await this.get(id, user);
    const v = await this.versionRepo.findOne({ where: { id: versionId, documentId: id } });
    if (!v) throw new NotFoundException('Versión no encontrada.');
    return v;
  }

  /** Explicit, user-requested snapshot of the current state. */
  async snapshotNow(id: string, user: AuthenticatedUser, label?: string) {
    const doc = await this.get(id, user);
    if (!this.canEdit(doc, user)) throw new ForbiddenException('No puedes editar este documento.');
    await this.snapshot(doc, user, label?.trim() || 'Versión guardada');
    return { ok: true };
  }

  async restoreVersion(id: string, versionId: string, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.canEdit(doc, user)) throw new ForbiddenException('No puedes editar este documento.');
    const v = await this.versionRepo.findOne({ where: { id: versionId, documentId: id } });
    if (!v) throw new NotFoundException('Versión no encontrada.');
    // Capture the current state first so a restore is itself undoable.
    await this.snapshot(doc, user, 'Antes de restaurar');
    doc.title = v.title;
    doc.content = v.content;
    return this.repo.save(doc);
  }

  private async maybeSnapshot(doc: OfficeDocument, user: AuthenticatedUser) {
    const last = await this.versionRepo.findOne({ where: { documentId: doc.id }, order: { createdAt: 'DESC' } });
    if (last && Date.now() - new Date(last.createdAt).getTime() < SNAPSHOT_THROTTLE_MS) return;
    await this.snapshot(doc, user);
  }

  private async snapshot(doc: OfficeDocument, user: AuthenticatedUser, label?: string) {
    await this.versionRepo.save(this.versionRepo.create({
      documentId: doc.id,
      title: doc.title,
      content: doc.content,
      label: label ?? null,
      createdBy: this.email(user),
    }));
    await this.prune(doc.id);
  }

  private async prune(documentId: string) {
    const ids = await this.versionRepo.find({ where: { documentId }, order: { createdAt: 'DESC' }, select: ['id'] });
    const excess = ids.slice(MAX_VERSIONS);
    if (excess.length) await this.versionRepo.delete(excess.map((v) => v.id));
  }

  private normalizeMentions(mentions?: string[]): string[] {
    if (!Array.isArray(mentions)) return [];
    return [...new Set(mentions.map((m) => String(m ?? '').trim().toLowerCase()).filter(Boolean))].slice(0, 25);
  }

  private normalizePrincipal(value?: string | null): string | null {
    const v = String(value ?? '').trim().toLowerCase();
    return v || null;
  }

  private normalizeShares(shares: OfficeShare[]): OfficeShare[] {
    if (!Array.isArray(shares)) return [];
    const seen = new Set<string>();
    const out: OfficeShare[] = [];
    for (const s of shares) {
      const email = String(s?.email ?? '').trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      out.push({ email, access: s.access === 'edit' ? 'edit' : 'view' });
    }
    return out;
  }
}
