import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { OfficeDocument, OfficeDocumentLifecycleState, OfficeDocType, OfficeShare } from './entities/office-document.entity';
import { OfficeDocumentVersion } from './entities/office-document-version.entity';
import { OfficeDocumentComment, OfficeCommentReply } from './entities/office-document-comment.entity';
import { OfficeDocumentSearchIndex, OfficeDocumentSearchRef } from './entities/office-document-search-index.entity';
import { OfficeDocumentDistribution, OfficeDistributionAction, OfficeDistributionFormat } from './entities/office-document-distribution.entity';
import { OfficeDocumentSignature, OfficeSignatureMeaning } from './entities/office-document-signature.entity';
import { OfficeDocumentTrainingAssignment } from './entities/office-document-training.entity';
import { OfficeDocumentReviewTask, OfficeReviewTaskStatus } from './entities/office-document-review-task.entity';
import { CreateOfficeCommentDto, ListOfficeCommentsQueryDto, ReplyOfficeCommentDto, UpdateOfficeCommentDto } from './dto/office-comment.dto';
import { AuthenticatedUser } from '../../common/types/jwt.types';
import { AuditService } from '../governance/audit.service';

const TYPES: OfficeDocType[] = ['doc', 'sheet', 'slides'];
// Columns returned by list endpoints — heavy `content` is intentionally omitted.
const LIST_COLUMNS = ['id', 'type', 'title', 'model', 'createdBy', 'tenantId', 'sharedWith', 'space', 'folderPath', 'collection', 'tags', 'favorite', 'pinned', 'lifecycleState', 'locked', 'nextReviewAt', 'reviewIntervalDays', 'reviewOwner', 'createdAt', 'updatedAt'];
// Auto-snapshots are throttled so autosave doesn't create a version every keystroke.
const SNAPSHOT_THROTTLE_MS = 2 * 60 * 1000;
const MAX_VERSIONS = 50;

interface CreateDto { type: OfficeDocType; title?: string; content?: any; model?: string; space?: string | null; folderPath?: string | null; collection?: string | null; tags?: string[] }
interface UpdateDto { title?: string; content?: any; model?: string | null; sharedWith?: OfficeShare[]; space?: string | null; folderPath?: string | null; collection?: string | null; tags?: string[]; favorite?: boolean; pinned?: boolean }
interface LifecycleDto { note?: string }
interface PeriodicReviewDto { nextReviewAt?: string | null; reviewIntervalDays?: number | null; reviewOwner?: string | null; note?: string | null }
interface DistributionDto { action?: OfficeDistributionAction; format?: OfficeDistributionFormat; recipient?: string | null; purpose?: string | null; metadata?: Record<string, unknown> | null }
interface SignatureDto { meaning?: OfficeSignatureMeaning; statement?: string; signerName?: string | null; signerRole?: string | null; metadata?: Record<string, unknown> | null }
interface TrainingAssignDto { assignees?: string[]; dueAt?: string | null; note?: string | null }
interface TrainingAcknowledgeDto { statement?: string; signerName?: string | null; signerRole?: string | null }
interface ReviewAssignDto { reviewers?: string[]; dueAt?: string | null; note?: string | null }
interface ReviewDecisionDto { decision?: 'approved' | 'rejected'; note?: string | null }
interface ListFilters {
  q?: string;
  lifecycle?: OfficeDocumentLifecycleState;
  locked?: string;
  owner?: string;
  entity?: string;
  refId?: string;
  tag?: string;
  space?: string;
  folderPath?: string;
  collection?: string;
  favorite?: string;
  pinned?: string;
}

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
    @InjectRepository(OfficeDocumentSearchIndex) private readonly searchRepo: Repository<OfficeDocumentSearchIndex>,
    @InjectRepository(OfficeDocumentDistribution) private readonly distributionRepo: Repository<OfficeDocumentDistribution>,
    @InjectRepository(OfficeDocumentSignature) private readonly signatureRepo: Repository<OfficeDocumentSignature>,
    @InjectRepository(OfficeDocumentTrainingAssignment) private readonly trainingRepo: Repository<OfficeDocumentTrainingAssignment>,
    @InjectRepository(OfficeDocumentReviewTask) private readonly reviewTaskRepo: Repository<OfficeDocumentReviewTask>,
    private readonly audit: AuditService,
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
    if (filters.q || filters.entity || filters.refId) {
      qb.leftJoin(OfficeDocumentSearchIndex, 'si', 'si.documentId = d.id');
    }
    if (type) qb.andWhere('d.type = :type', { type });
    if (trash) qb.withDeleted().andWhere('d.deletedAt IS NOT NULL');
    const q = String(filters.q ?? '').trim().toLowerCase();
    if (q) {
      qb.andWhere(new Brackets((b) => {
        b.where('LOWER(d.title) LIKE :q', { q: `%${q}%` })
          .orWhere("LOWER(COALESCE(d.model, '')) LIKE :q", { q: `%${q}%` })
          .orWhere("LOWER(COALESCE(d.createdBy, '')) LIKE :q", { q: `%${q}%` })
          .orWhere("LOWER(COALESCE(d.space, '')) LIKE :q", { q: `%${q}%` })
          .orWhere("LOWER(COALESCE(d.folderPath, '')) LIKE :q", { q: `%${q}%` })
          .orWhere("LOWER(COALESCE(d.collection, '')) LIKE :q", { q: `%${q}%` })
          .orWhere("LOWER(CAST(d.tags AS TEXT)) LIKE :q", { q: `%${q}%` })
          .orWhere("LOWER(COALESCE(si.text, '')) LIKE :q", { q: `%${q}%` })
          .orWhere("LOWER(COALESCE(si.refsText, '')) LIKE :q", { q: `%${q}%` })
          .orWhere("LOWER(COALESCE(si.fieldsText, '')) LIKE :q", { q: `%${q}%` });
      }));
    }
    const entity = String(filters.entity ?? '').trim().toLowerCase();
    if (entity) qb.andWhere("LOWER(COALESCE(si.refsText, '')) LIKE :entity", { entity: `%entity:${entity}%` });
    const refId = String(filters.refId ?? '').trim().toLowerCase();
    if (refId) qb.andWhere("LOWER(COALESCE(si.refsText, '')) LIKE :refId", { refId: `%ref:${refId}%` });
    const tag = String(filters.tag ?? '').trim().toLowerCase();
    if (tag) qb.andWhere('LOWER(CAST(d.tags AS TEXT)) LIKE :tag', { tag: `%${tag}%` });
    const space = String(filters.space ?? '').trim().toLowerCase();
    if (space) qb.andWhere("LOWER(COALESCE(d.space, '')) = :space", { space });
    const folderPath = String(filters.folderPath ?? '').trim().toLowerCase();
    if (folderPath) qb.andWhere("LOWER(COALESCE(d.folderPath, '')) = :folderPath", { folderPath });
    const collection = String(filters.collection ?? '').trim().toLowerCase();
    if (collection) qb.andWhere("LOWER(COALESCE(d.collection, '')) = :collection", { collection });
    if (filters.favorite === '1' || filters.favorite === 'true') qb.andWhere('d.favorite = true');
    if (filters.pinned === '1' || filters.pinned === 'true') qb.andWhere('d.pinned = true');
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


  async impactAnalysis(user: AuthenticatedUser, entity?: string, refId?: string) {
    const cleanEntity = String(entity ?? '').trim().toLowerCase();
    const cleanRef = String(refId ?? '').trim().toLowerCase();
    if (!cleanEntity && !cleanRef) throw new BadRequestException('Indica entity o refId para analizar impacto.');
    const qb = this.repo.createQueryBuilder('d')
      .select(LIST_COLUMNS.map((c) => `d.${c}`))
      .leftJoin(OfficeDocumentSearchIndex, 'si', 'si.documentId = d.id')
      .where('d.deletedAt IS NULL');
    if (cleanEntity) qb.andWhere("LOWER(COALESCE(si.refsText, '')) LIKE :entity", { entity: `%entity:${cleanEntity}%` });
    if (cleanRef) qb.andWhere("LOWER(COALESCE(si.refsText, '')) LIKE :refId", { refId: `%ref:${cleanRef}%` });
    if (!this.isAdmin(user)) {
      const email = this.email(user) ?? '__none__';
      qb.andWhere('(d.createdBy = :email OR LOWER(CAST(d.sharedWith AS TEXT)) LIKE :share)', {
        email,
        share: `%"${email.toLowerCase()}"%`,
      });
    }
    const docs = await qb.orderBy('d.updatedAt', 'DESC').take(100).getMany();
    return { entity: cleanEntity || null, refId: cleanRef || null, count: docs.length, documents: docs };
  }

  async get(id: string, user: AuthenticatedUser) {
    const doc = await this.repo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Documento no encontrado.');
    if (!this.canRead(doc, user)) throw new ForbiddenException('No tienes acceso a este documento.');
    return doc;
  }

  async create(dto: CreateDto, user: AuthenticatedUser) {
    this.assertWriter(user);
    if (!TYPES.includes(dto.type)) throw new BadRequestException('Tipo inválido.');
    const doc = await this.repo.save(
      this.repo.create({
        type: dto.type,
        title: dto.title?.trim() || 'Sin título',
        content: dto.content ?? null,
        model: dto.model?.trim().toUpperCase() || null,
        createdBy: this.email(user),
        tenantId: user?.tenant_id ?? null,
        space: this.normalizeLibraryText(dto.space, 80),
        folderPath: this.normalizeFolderPath(dto.folderPath),
        collection: this.normalizeLibraryText(dto.collection, 120),
        tags: this.normalizeTags(dto.tags),
        favorite: false,
        pinned: false,
        lifecycleState: 'draft',
        locked: false,
      }),
    );
    await this.refreshSearchIndex(doc);
    return doc;
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
    if (dto.space !== undefined) doc.space = this.normalizeLibraryText(dto.space, 80);
    if (dto.folderPath !== undefined) doc.folderPath = this.normalizeFolderPath(dto.folderPath);
    if (dto.collection !== undefined) doc.collection = this.normalizeLibraryText(dto.collection, 120);
    if (dto.tags !== undefined) doc.tags = this.normalizeTags(dto.tags);
    if (dto.favorite !== undefined) doc.favorite = !!dto.favorite;
    if (dto.pinned !== undefined) doc.pinned = !!dto.pinned;
    if (dto.sharedWith !== undefined) {
      // Only the owner (or an admin) can change who a document is shared with.
      if (!this.isOwner(doc, user)) throw new ForbiddenException('Solo el dueño puede compartir.');
      doc.sharedWith = this.normalizeShares(dto.sharedWith);
    }
    const saved = await this.repo.save(doc);
    await this.refreshSearchIndex(saved);
    return saved;
  }

  /** Duplicate a document the user can read into a fresh copy they own. */
  async duplicate(id: string, user: AuthenticatedUser) {
    this.assertWriter(user);
    const src = await this.get(id, user);
    const doc = await this.repo.save(
      this.repo.create({
        type: src.type,
        title: `${src.title} (copia)`,
        content: src.content,
        model: src.model,
        createdBy: this.email(user),
        tenantId: user?.tenant_id ?? null,
        space: src.space,
        folderPath: src.folderPath,
        collection: src.collection,
        tags: src.tags,
        favorite: false,
        pinned: false,
        lifecycleState: 'draft',
        locked: false,
      }),
    );
    await this.refreshSearchIndex(doc);
    return doc;
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
    const readiness = await this.releaseReadiness(id, user);
    if (readiness.blockers.length) throw new BadRequestException(`No se puede liberar: ${readiness.blockers.map((b: any) => b.label).join(', ')}`);
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

  async setPeriodicReview(id: string, dto: PeriodicReviewDto, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.isOwner(doc, user)) throw new ForbiddenException('Solo el dueño puede configurar revisión periódica.');
    const before = { nextReviewAt: doc.nextReviewAt, reviewIntervalDays: doc.reviewIntervalDays, reviewOwner: doc.reviewOwner };
    const nextReviewAt = dto.nextReviewAt ? new Date(dto.nextReviewAt) : null;
    if (dto.nextReviewAt && Number.isNaN(nextReviewAt?.getTime())) throw new BadRequestException('Fecha de próxima revisión inválida.');
    const interval = dto.reviewIntervalDays == null ? null : Math.max(1, Math.min(3650, Number(dto.reviewIntervalDays)));
    doc.nextReviewAt = nextReviewAt;
    doc.reviewIntervalDays = Number.isFinite(interval as number) ? interval : null;
    doc.reviewOwner = this.normalizeLibraryText(dto.reviewOwner, 120) ?? this.email(user);
    const saved = await this.repo.save(doc);
    await this.audit.log({
      actor: this.email(user) || 'unknown',
      action: 'SET_DOC_PERIODIC_REVIEW',
      entity: 'OfficeDocument',
      entityId: id,
      before,
      after: { nextReviewAt: saved.nextReviewAt, reviewIntervalDays: saved.reviewIntervalDays, reviewOwner: saved.reviewOwner, note: this.normalizeLibraryText(dto.note, 240) },
      scope: { tenant_id: doc.tenantId ?? user?.tenant_id ?? null },
    });
    return saved;
  }

  async completePeriodicReview(id: string, dto: { note?: string | null }, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    const actor = this.email(user);
    const isReviewOwner = !!doc.reviewOwner && doc.reviewOwner.toLowerCase() === String(actor ?? '').toLowerCase();
    if (!this.isOwner(doc, user) && !isReviewOwner) throw new ForbiddenException('Solo el dueño o responsable de revisión puede completar esta revisión.');
    const before = { nextReviewAt: doc.nextReviewAt, reviewIntervalDays: doc.reviewIntervalDays, reviewOwner: doc.reviewOwner };
    const contentHash = this.documentHash(doc);
    const signature = await this.signatureRepo.save(this.signatureRepo.create({
      tenantId: doc.tenantId ?? user?.tenant_id ?? null,
      documentId: id,
      meaning: 'reviewed',
      signatureType: 'electronic',
      signerEmail: actor,
      signerName: actor,
      signerRole: this.normalizeLibraryText(user?.role, 120),
      statement: this.normalizeLibraryText(dto.note, 2000) ?? 'Completo revisión periódica del documento controlado.',
      contentHash,
      metadata: { periodicReview: true, previousNextReviewAt: doc.nextReviewAt, reviewIntervalDays: doc.reviewIntervalDays },
      revoked: false,
      revokedBy: null,
      revokedAt: null,
    }));
    if (doc.reviewIntervalDays && doc.reviewIntervalDays > 0) {
      doc.nextReviewAt = new Date(Date.now() + doc.reviewIntervalDays * 24 * 60 * 60 * 1000);
    } else {
      doc.nextReviewAt = null;
    }
    const saved = await this.repo.save(doc);
    await this.audit.log({
      actor: actor || 'unknown',
      action: 'COMPLETE_DOC_PERIODIC_REVIEW',
      entity: 'OfficeDocument',
      entityId: id,
      before,
      after: { nextReviewAt: saved.nextReviewAt, reviewIntervalDays: saved.reviewIntervalDays, reviewOwner: saved.reviewOwner, signatureId: signature.id, contentHash },
      scope: { tenant_id: doc.tenantId ?? user?.tenant_id ?? null },
    });
    return { document: saved, signature };
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
    await this.commentRepo.delete({ documentId: id });
    await this.distributionRepo.delete({ documentId: id });
    await this.signatureRepo.delete({ documentId: id });
    await this.trainingRepo.delete({ documentId: id });
    await this.reviewTaskRepo.delete({ documentId: id });
    await this.searchRepo.delete({ documentId: id });
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


  async workQueue(user: AuthenticatedUser) {
    const email = (this.email(user) ?? '').toLowerCase();
    if (!email) return { reviewerTasks: [], trainingAssignments: [], ownedInReview: [], duePeriodicReviews: [], counts: { reviewerTasks: 0, trainingAssignments: 0, ownedInReview: 0, duePeriodicReviews: 0, total: 0 } };
    const tenantId = user?.tenant_id ?? null;
    const taskScope = tenantId ? { tenantId } : {};
    const reviewWindow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const [reviewerTasks, trainingAssignments, ownedInReview, duePeriodicReviews] = await Promise.all([
      this.reviewTaskRepo.find({
        where: { ...taskScope, reviewerEmail: email, status: 'pending' },
        order: { dueAt: 'ASC', createdAt: 'DESC' },
        take: 25,
      }),
      this.trainingRepo.find({
        where: { ...taskScope, assigneeEmail: email, status: 'pending' },
        order: { dueAt: 'ASC', createdAt: 'DESC' },
        take: 25,
      }),
      this.repo.find({
        where: { ...(tenantId ? { tenantId } : {}), createdBy: email, lifecycleState: 'in_review' },
        order: { updatedAt: 'DESC' },
        select: LIST_COLUMNS as any,
        take: 25,
      }),
      this.repo.createQueryBuilder('d')
        .select(LIST_COLUMNS.map((column) => `d.${column}`))
        .where(tenantId ? 'd.tenantId = :tenantId' : '1=1', { tenantId })
        .andWhere('(LOWER(d.reviewOwner) = :email OR LOWER(d.createdBy) = :email)', { email })
        .andWhere('d.nextReviewAt IS NOT NULL')
        .andWhere('d.nextReviewAt <= :reviewWindow', { reviewWindow })
        .andWhere('d.lifecycleState != :obsolete', { obsolete: 'obsolete' })
        .orderBy('d.nextReviewAt', 'ASC')
        .take(25)
        .getMany(),
    ]);
    const documentIds = Array.from(new Set([
      ...reviewerTasks.map((task) => task.documentId),
      ...trainingAssignments.map((task) => task.documentId),
    ]));
    const documents = documentIds.length
      ? await this.repo.createQueryBuilder('d')
        .select(['d.id', 'd.title', 'd.type', 'd.lifecycleState', 'd.locked', 'd.createdBy', 'd.updatedAt'])
        .where('d.id IN (:...ids)', { ids: documentIds })
        .andWhere(tenantId ? 'd.tenantId = :tenantId' : '1=1', { tenantId })
        .getMany()
      : [];
    const docMap = new Map(documents.map((doc) => [doc.id, doc]));
    const serializeDoc = (doc?: OfficeDocument) => doc ? ({
      id: doc.id,
      title: doc.title,
      type: doc.type,
      lifecycleState: doc.lifecycleState,
      locked: doc.locked,
      createdBy: doc.createdBy,
      nextReviewAt: doc.nextReviewAt,
      reviewIntervalDays: doc.reviewIntervalDays,
      reviewOwner: doc.reviewOwner,
      updatedAt: doc.updatedAt,
    }) : null;
    return {
      reviewerTasks: reviewerTasks.map((task) => ({ ...task, document: serializeDoc(docMap.get(task.documentId)) })),
      trainingAssignments: trainingAssignments.map((task) => ({ ...task, document: serializeDoc(docMap.get(task.documentId)) })),
      ownedInReview: ownedInReview.map((doc) => serializeDoc(doc)),
      duePeriodicReviews: duePeriodicReviews.map((doc) => serializeDoc(doc)),
      counts: {
        reviewerTasks: reviewerTasks.length,
        trainingAssignments: trainingAssignments.length,
        ownedInReview: ownedInReview.length,
        duePeriodicReviews: duePeriodicReviews.length,
        total: reviewerTasks.length + trainingAssignments.length + ownedInReview.length + duePeriodicReviews.length,
      },
    };
  }


  async releaseReadiness(id: string, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    const [openComments, reviewTasks, training, signatures] = await Promise.all([
      this.commentRepo.count({ where: { documentId: id, resolved: false } }),
      this.reviewTaskRepo.find({ where: { documentId: id } }),
      this.trainingRepo.find({ where: { documentId: id } }),
      this.signatureRepo.find({ where: { documentId: id, revoked: false } }),
    ]);
    const blockers: Array<{ id: string; label: string; detail: string }> = [];
    const warnings: Array<{ id: string; label: string; detail: string }> = [];
    const pendingReview = reviewTasks.filter((task) => task.status === 'pending');
    const rejectedReview = reviewTasks.filter((task) => task.status === 'rejected');
    const pendingTraining = training.filter((task) => task.status === 'pending');
    if (openComments > 0) blockers.push({ id: 'open_comments', label: 'Comentarios abiertos', detail: `${openComments} comentario(s) sin resolver.` });
    if (pendingReview.length > 0) blockers.push({ id: 'pending_review', label: 'Revisiones pendientes', detail: `${pendingReview.length} reviewer(s) pendientes.` });
    if (rejectedReview.length > 0) blockers.push({ id: 'rejected_review', label: 'Revisiones rechazadas', detail: `${rejectedReview.length} rechazo(s) deben resolverse.` });
    if (pendingTraining.length > 0) blockers.push({ id: 'pending_training', label: 'Entrenamiento pendiente', detail: `${pendingTraining.length} asignación(es) sin acuse.` });
    if (!signatures.some((s) => ['approved', 'released'].includes(s.meaning))) warnings.push({ id: 'no_approval_signature', label: 'Sin firma de aprobación/liberación', detail: 'Se recomienda una firma approved o released antes de Effective.' });
    if (!doc.model) warnings.push({ id: 'missing_model', label: 'Sin modelo/parte', detail: 'El documento no tiene modelo/parte asociada.' });
    const score = Math.max(0, 100 - blockers.length * 25 - warnings.length * 8);
    return {
      documentId: id,
      lifecycleState: doc.lifecycleState,
      locked: doc.locked,
      ready: blockers.length === 0,
      score,
      blockers,
      warnings,
      evidence: { openComments, reviewTasks: reviewTasks.length, pendingReview: pendingReview.length, rejectedReview: rejectedReview.length, trainingAssignments: training.length, pendingTraining: pendingTraining.length, activeSignatures: signatures.length },
    };
  }

  async evidencePackage(id: string, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    const [
      readiness,
      searchIndex,
      timeline,
      comments,
      reviewTasks,
      training,
      signatures,
      distributions,
      versions,
    ] = await Promise.all([
      this.releaseReadiness(id, user),
      this.searchMetadata(id, user),
      this.timeline(id, user),
      this.listComments(id, user, { status: 'all' }),
      this.listReviewTasks(id, user),
      this.listTrainingAssignments(id, user),
      this.listSignatures(id, user),
      this.listDistributions(id, user),
      this.versionRepo.find({
        where: { documentId: id },
        order: { createdAt: 'DESC' },
        select: ['id', 'label', 'createdBy', 'createdAt'],
        take: 25,
      }),
    ]);
    const currentHash = this.documentHash(doc);
    const packageId = `office-evidence:${doc.id}:${Date.now()}`;
    return {
      packageId,
      generatedAt: new Date().toISOString(),
      generatedBy: this.email(user),
      document: {
        id: doc.id,
        title: doc.title,
        type: doc.type,
        model: doc.model,
        tenantId: doc.tenantId,
        lifecycleState: doc.lifecycleState,
        locked: doc.locked,
        createdBy: doc.createdBy,
        approvedBy: doc.approvedBy,
        approvedAt: doc.approvedAt,
        releasedBy: doc.releasedBy,
        releasedAt: doc.releasedAt,
        obsoletedBy: doc.obsoletedBy,
        obsoletedAt: doc.obsoletedAt,
        space: doc.space,
        folderPath: doc.folderPath,
        collection: doc.collection,
        tags: doc.tags ?? [],
        contentHash: currentHash,
      },
      readiness,
      searchIndex,
      counts: {
        comments: Array.isArray(comments) ? comments.length : 0,
        openComments: Array.isArray(comments) ? comments.filter((c) => !c.resolved).length : 0,
        reviewTasks: Array.isArray(reviewTasks) ? reviewTasks.length : 0,
        pendingReviewTasks: Array.isArray(reviewTasks) ? reviewTasks.filter((t) => t.status === 'pending').length : 0,
        trainingAssignments: Array.isArray(training) ? training.length : 0,
        pendingTrainingAssignments: Array.isArray(training) ? training.filter((t) => t.status === 'pending').length : 0,
        signatures: Array.isArray(signatures) ? signatures.length : 0,
        activeSignatures: Array.isArray(signatures) ? signatures.filter((s) => !s.revoked).length : 0,
        distributions: Array.isArray(distributions) ? distributions.length : 0,
        versions: versions.length,
        timelineEvents: Array.isArray(timeline?.events) ? timeline.events.length : 0,
      },
      comments,
      reviewTasks,
      training,
      signatures,
      distributions,
      versions,
      timeline: timeline?.events ?? [],
    };
  }

  // ── Persistent document comments ───────────────────────────────────────────
  async listComments(id: string, user: AuthenticatedUser, query: ListOfficeCommentsQueryDto = {}) {
    await this.get(id, user);
    const qb = this.commentRepo.createQueryBuilder('c').where('c.documentId = :id', { id });
    const status = query.status ?? (query.includeResolved === '0' || query.includeResolved === 'false' ? 'open' : 'all');
    if (status === 'open') qb.andWhere('c.resolved = false');
    if (status === 'resolved') qb.andWhere('c.resolved = true');
    const assignedTo = String(query.assignedTo ?? '').trim().toLowerCase();
    if (assignedTo) qb.andWhere('LOWER(c.assignedTo) = :assignedTo', { assignedTo });
    const author = String(query.author ?? '').trim().toLowerCase();
    if (author) qb.andWhere('LOWER(c.author) = :author', { author });
    const mention = String(query.mention ?? '').trim().toLowerCase();
    if (mention) qb.andWhere('LOWER(CAST(c.mentions AS TEXT)) LIKE :mention', { mention: `%${mention}%` });
    const q = String(query.q ?? '').trim().toLowerCase();
    if (q) {
      qb.andWhere(new Brackets((b) => {
        b.where('LOWER(c.text) LIKE :q', { q: `%${q}%` })
          .orWhere("LOWER(COALESCE(c.quotedText, '')) LIKE :q", { q: `%${q}%` })
          .orWhere('LOWER(CAST(c.replies AS TEXT)) LIKE :q', { q: `%${q}%` });
      }));
    }
    qb.orderBy('c.resolved', 'ASC').addOrderBy('c.updatedAt', 'DESC').take(query.limit ?? 100);
    return qb.getMany();
  }

  async createComment(id: string, dto: CreateOfficeCommentDto, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.canEdit(doc, user)) throw new ForbiddenException('No puedes comentar este documento.');
    const text = String(dto.text ?? '').trim();
    if (!text) throw new BadRequestException('El comentario no puede estar vacío.');
    const anchorId = String(dto.anchorId ?? '').trim() || `cm_${Date.now().toString(36)}`;
    return this.commentRepo.save(this.commentRepo.create({
      tenantId: doc.tenantId ?? user?.tenant_id ?? null,
      documentId: id,
      anchorId,
      text,
      author: this.email(user),
      mentions: this.normalizeMentions(dto.mentions),
      assignedTo: this.normalizePrincipal(dto.assignedTo),
      quotedText: String(dto.quotedText ?? '').slice(0, 1000) || null,
      anchor: dto.anchor ?? null,
      replies: [],
      resolved: false,
    }));
  }

  async updateComment(id: string, commentId: string, dto: UpdateOfficeCommentDto, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.canEdit(doc, user)) throw new ForbiddenException('No puedes editar comentarios en este documento.');
    const c = await this.commentRepo.findOne({ where: { id: commentId, documentId: id } });
    if (!c) throw new NotFoundException('Comentario no encontrado.');
    if (dto.text !== undefined) {
      const text = String(dto.text).trim();
      if (!text) throw new BadRequestException('El comentario no puede estar vacío.');
      c.text = text;
    }
    if (dto.mentions !== undefined) c.mentions = this.normalizeMentions(dto.mentions);
    if (dto.assignedTo !== undefined) c.assignedTo = this.normalizePrincipal(dto.assignedTo);
    if (dto.anchor !== undefined) c.anchor = dto.anchor ?? null;
    if (dto.quotedText !== undefined) c.quotedText = String(dto.quotedText ?? '').slice(0, 1000) || null;
    if (dto.resolved !== undefined && c.resolved !== !!dto.resolved) {
      c.resolved = !!dto.resolved;
      c.resolvedBy = c.resolved ? this.email(user) : null;
      c.resolvedAt = c.resolved ? new Date() : null;
    }
    return this.commentRepo.save(c);
  }

  async replyToComment(id: string, commentId: string, dto: ReplyOfficeCommentDto, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.canEdit(doc, user)) throw new ForbiddenException('No puedes responder en este documento.');
    const c = await this.commentRepo.findOne({ where: { id: commentId, documentId: id } });
    if (!c) throw new NotFoundException('Comentario no encontrado.');
    const text = String(dto.text ?? '').trim();
    if (!text) throw new BadRequestException('La respuesta no puede estar vacía.');
    const reply: OfficeCommentReply = { id: `rp_${Date.now().toString(36)}`, author: this.email(user), text, mentions: this.normalizeMentions(dto.mentions), createdAt: new Date().toISOString() };
    c.replies = [...(Array.isArray(c.replies) ? c.replies : []), reply];
    return this.commentRepo.save(c);
  }

  async deleteComment(id: string, commentId: string, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.canEdit(doc, user)) throw new ForbiddenException('No puedes eliminar comentarios en este documento.');
    const c = await this.commentRepo.findOne({ where: { id: commentId, documentId: id } });
    if (!c) throw new NotFoundException('Comentario no encontrado.');
    await this.commentRepo.delete(c.id);
    return { deleted: true, id: commentId };
  }

  async timeline(id: string, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    const [versions, comments, audit, distributions, signatures, training, reviewTasks] = await Promise.all([
      this.versionRepo.find({
        where: { documentId: id },
        order: { createdAt: 'DESC' },
        select: ['id', 'label', 'createdBy', 'createdAt'],
        take: 25,
      }),
      this.commentRepo.find({
        where: { documentId: id },
        order: { updatedAt: 'DESC' },
        select: ['id', 'anchorId', 'author', 'resolved', 'resolvedBy', 'resolvedAt', 'updatedAt', 'createdAt'],
        take: 50,
      }),
      this.audit.getEntityLogs('OfficeDocument', id, 50),
      this.distributionRepo.find({
        where: { documentId: id },
        order: { createdAt: 'DESC' },
        select: ['id', 'action', 'format', 'copyNo', 'recipient', 'purpose', 'actor', 'createdAt'],
        take: 25,
      }),
      this.signatureRepo.find({
        where: { documentId: id },
        order: { signedAt: 'DESC' },
        select: ['id', 'meaning', 'signerEmail', 'signerName', 'signerRole', 'contentHash', 'revoked', 'revokedBy', 'revokedAt', 'signedAt'],
        take: 25,
      }),
      this.trainingRepo.find({
        where: { documentId: id },
        order: { updatedAt: 'DESC' },
        select: ['id', 'assigneeEmail', 'assignedBy', 'status', 'dueAt', 'acknowledgedAt', 'signatureId', 'updatedAt', 'createdAt'],
        take: 25,
      }),
      this.reviewTaskRepo.find({
        where: { documentId: id },
        order: { updatedAt: 'DESC' },
        select: ['id', 'reviewerEmail', 'assignedBy', 'status', 'dueAt', 'decidedAt', 'signatureId', 'updatedAt', 'createdAt'],
        take: 25,
      }),
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
        actor: c.resolved ? c.resolvedBy : c.author,
        at: c.resolvedAt || c.updatedAt || c.createdAt,
        details: { commentId: c.id, anchorId: c.anchorId, resolved: c.resolved },
      })),
      ...reviewTasks.map((t) => ({
        id: `review-task:${t.id}`,
        kind: 'review_task',
        action: t.status === 'pending' ? 'REVIEW_ASSIGNED' : `REVIEW_${String(t.status).toUpperCase()}`,
        actor: t.status === 'pending' ? t.assignedBy : t.reviewerEmail,
        at: t.decidedAt || t.updatedAt || t.createdAt,
        details: { reviewTaskId: t.id, reviewerEmail: t.reviewerEmail, dueAt: t.dueAt, status: t.status, signatureId: t.signatureId },
      })),
      ...training.map((t) => ({
        id: `training:${t.id}`,
        kind: 'training',
        action: t.status === 'acknowledged' ? 'TRAINING_ACKNOWLEDGED' : 'TRAINING_ASSIGNED',
        actor: t.status === 'acknowledged' ? t.assigneeEmail : t.assignedBy,
        at: t.acknowledgedAt || t.updatedAt || t.createdAt,
        details: { trainingId: t.id, assigneeEmail: t.assigneeEmail, dueAt: t.dueAt, status: t.status, signatureId: t.signatureId },
      })),
      ...signatures.map((s) => ({
        id: `signature:${s.id}`,
        kind: 'signature',
        action: s.revoked ? 'SIGNATURE_REVOKED' : `SIGNATURE_${String(s.meaning).toUpperCase()}`,
        actor: s.revoked ? s.revokedBy : s.signerEmail,
        at: s.revokedAt || s.signedAt,
        details: { signatureId: s.id, meaning: s.meaning, signerName: s.signerName, signerRole: s.signerRole, contentHash: s.contentHash, revoked: s.revoked },
      })),
      ...distributions.map((d) => ({
        id: `distribution:${d.id}`,
        kind: 'distribution',
        action: `DISTRIBUTION_${String(d.format).toUpperCase()}`,
        actor: d.actor,
        at: d.createdAt,
        details: { distributionId: d.id, action: d.action, format: d.format, copyNo: d.copyNo, recipient: d.recipient, purpose: d.purpose },
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


  async listDistributions(id: string, user: AuthenticatedUser) {
    await this.get(id, user);
    return this.distributionRepo.find({
      where: { documentId: id },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async verifyDistribution(id: string, copyNoParam: string, code: string | undefined, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    const copyNo = Number(copyNoParam);
    if (!Number.isInteger(copyNo) || copyNo <= 0) throw new BadRequestException('Número de copia inválido.');
    const expected = String(code ?? '').trim().toUpperCase();
    if (!expected) throw new BadRequestException('Código de verificación requerido.');
    const distribution = await this.distributionRepo.findOne({ where: { documentId: id, copyNo } });
    if (!distribution) throw new NotFoundException('Copia no encontrada.');
    const metadata = distribution.metadata ?? {};
    const actual = String(metadata.verificationCode ?? '').trim().toUpperCase();
    const currentHash = this.documentHash(doc);
    const valid = !!actual && actual === expected;
    return {
      valid,
      reason: valid ? 'MATCH' : 'CODE_MISMATCH',
      checkedAt: new Date().toISOString(),
      document: {
        id: doc.id,
        title: doc.title,
        lifecycleState: doc.lifecycleState,
        locked: doc.locked,
        currentHash,
      },
      copy: {
        id: distribution.id,
        copyNo: distribution.copyNo,
        action: distribution.action,
        format: distribution.format,
        recipient: distribution.recipient,
        purpose: distribution.purpose,
        actor: distribution.actor,
        createdAt: distribution.createdAt,
        verificationCode: actual || null,
        issuedHash: metadata.contentHash ?? null,
        lifecycleState: metadata.lifecycleState ?? null,
        controlled: Boolean(metadata.controlled),
      },
      hashMatchesCurrent: metadata.contentHash ? metadata.contentHash === currentHash : null,
    };
  }

  async recordDistribution(id: string, dto: DistributionDto, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    const format = this.normalizeDistributionFormat(dto.format);
    const action = this.normalizeDistributionAction(dto.action);
    const last = await this.distributionRepo.findOne({ where: { documentId: id }, order: { copyNo: 'DESC' } });
    const copyNo = (last?.copyNo ?? 0) + 1;
    const contentHash = this.documentHash(doc);
    const verificationCode = createHash('sha256')
      .update([doc.id, copyNo, format, action, contentHash, doc.lifecycleState].join('|'))
      .digest('hex')
      .slice(0, 16)
      .toUpperCase();
    const requestedMetadata = dto.metadata && typeof dto.metadata === 'object' ? dto.metadata : {};
    const metadata = {
      ...requestedMetadata,
      verificationCode,
      contentHash,
      lifecycleState: doc.lifecycleState,
      locked: doc.locked,
      title: doc.title,
      model: doc.model,
      controlled: ['effective', 'approved', 'obsolete'].includes(doc.lifecycleState) || action === 'controlled_copy',
      issuedAt: new Date().toISOString(),
    };
    const saved = await this.distributionRepo.save(this.distributionRepo.create({
      tenantId: doc.tenantId ?? user?.tenant_id ?? null,
      documentId: id,
      action,
      format,
      copyNo,
      recipient: this.normalizeLibraryText(dto.recipient, 160),
      purpose: this.normalizeLibraryText(dto.purpose, 240),
      actor: this.email(user),
      metadata,
    }));
    await this.audit.log({
      actor: this.email(user) || 'unknown',
      action: 'DISTRIBUTE_DOC',
      entity: 'OfficeDocument',
      entityId: id,
      before: null,
      after: { action, format, copyNo, recipient: saved.recipient, purpose: saved.purpose, verificationCode, contentHash },
      scope: { tenant_id: doc.tenantId ?? user?.tenant_id ?? null },
    });
    return saved;
  }


  async listSignatures(id: string, user: AuthenticatedUser) {
    await this.get(id, user);
    return this.signatureRepo.find({ where: { documentId: id }, order: { signedAt: 'DESC' }, take: 100 });
  }

  async signDocument(id: string, dto: SignatureDto, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.canWrite(user)) throw new ForbiddenException('Tu cuenta no puede firmar documentos.');
    const meaning = this.normalizeSignatureMeaning(dto.meaning);
    const statement = String(dto.statement ?? this.defaultSignatureStatement(meaning)).trim().slice(0, 2000);
    if (!statement) throw new BadRequestException('La declaración de firma es obligatoria.');
    const contentHash = this.documentHash(doc);
    const saved = await this.signatureRepo.save(this.signatureRepo.create({
      tenantId: doc.tenantId ?? user?.tenant_id ?? null,
      documentId: id,
      meaning,
      signatureType: 'electronic',
      signerEmail: this.email(user),
      signerName: this.normalizeLibraryText(dto.signerName, 160) ?? this.email(user),
      signerRole: this.normalizeLibraryText(dto.signerRole ?? user?.role, 120),
      statement,
      contentHash,
      metadata: dto.metadata && typeof dto.metadata === 'object' ? dto.metadata : null,
      revoked: false,
      revokedBy: null,
      revokedAt: null,
    }));
    await this.audit.log({
      actor: this.email(user) || 'unknown',
      action: 'SIGN_DOC',
      entity: 'OfficeDocument',
      entityId: id,
      before: null,
      after: { meaning, signerEmail: saved.signerEmail, signerRole: saved.signerRole, contentHash },
      scope: { tenant_id: doc.tenantId ?? user?.tenant_id ?? null },
    });
    return saved;
  }

  async verifySignature(id: string, signatureId: string, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    const signature = await this.signatureRepo.findOne({ where: { id: signatureId, documentId: id } });
    if (!signature) throw new NotFoundException('Firma no encontrada.');
    const currentHash = this.documentHash(doc);
    const hashMatchesCurrent = signature.contentHash === currentHash;
    return {
      valid: !signature.revoked && hashMatchesCurrent,
      reason: signature.revoked ? 'SIGNATURE_REVOKED' : hashMatchesCurrent ? 'MATCH' : 'CONTENT_CHANGED',
      checkedAt: new Date().toISOString(),
      document: {
        id: doc.id,
        title: doc.title,
        lifecycleState: doc.lifecycleState,
        locked: doc.locked,
        currentHash,
      },
      signature: {
        id: signature.id,
        meaning: signature.meaning,
        signerEmail: signature.signerEmail,
        signerName: signature.signerName,
        signerRole: signature.signerRole,
        signedAt: signature.signedAt,
        contentHash: signature.contentHash,
        revoked: signature.revoked,
        revokedBy: signature.revokedBy,
        revokedAt: signature.revokedAt,
      },
      hashMatchesCurrent,
    };
  }

  async revokeSignature(id: string, signatureId: string, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.isOwner(doc, user)) throw new ForbiddenException('Solo el dueño puede revocar firmas.');
    const signature = await this.signatureRepo.findOne({ where: { id: signatureId, documentId: id } });
    if (!signature) throw new NotFoundException('Firma no encontrada.');
    if (signature.revoked) return signature;
    signature.revoked = true;
    signature.revokedBy = this.email(user);
    signature.revokedAt = new Date();
    const saved = await this.signatureRepo.save(signature);
    await this.audit.log({
      actor: this.email(user) || 'unknown',
      action: 'REVOKE_DOC_SIGNATURE',
      entity: 'OfficeDocument',
      entityId: id,
      before: { signatureId, revoked: false },
      after: { signatureId, revoked: true, revokedBy: saved.revokedBy },
      scope: { tenant_id: doc.tenantId ?? user?.tenant_id ?? null },
    });
    return saved;
  }



  async listReviewTasks(id: string, user: AuthenticatedUser) {
    await this.get(id, user);
    return this.reviewTaskRepo.find({ where: { documentId: id }, order: { status: 'ASC', dueAt: 'ASC', updatedAt: 'DESC' }, take: 250 });
  }

  async assignReviewTasks(id: string, dto: ReviewAssignDto, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.isOwner(doc, user)) throw new ForbiddenException('Solo el dueño puede asignar revisores.');
    const reviewers = this.normalizeMentions(dto.reviewers).slice(0, 100);
    if (!reviewers.length) throw new BadRequestException('Agrega al menos un revisor.');
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    const created: OfficeDocumentReviewTask[] = [];
    for (const reviewerEmail of reviewers) {
      let row = await this.reviewTaskRepo.findOne({ where: { documentId: id, reviewerEmail } });
      if (!row) row = this.reviewTaskRepo.create({ tenantId: doc.tenantId ?? user?.tenant_id ?? null, documentId: id, reviewerEmail });
      row.assignedBy = this.email(user);
      row.status = 'pending';
      row.dueAt = dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null;
      row.decidedAt = null;
      row.decisionNote = null;
      row.signatureId = null;
      row.note = this.normalizeLibraryText(dto.note, 1000);
      created.push(await this.reviewTaskRepo.save(row));
    }
    await this.audit.log({ actor: this.email(user) || 'unknown', action: 'ASSIGN_DOC_REVIEWERS', entity: 'OfficeDocument', entityId: id, before: null, after: { reviewers, dueAt: dueAt?.toISOString?.() ?? null }, scope: { tenant_id: doc.tenantId ?? user?.tenant_id ?? null } });
    if (doc.lifecycleState === 'draft') await this.submitForReview(id, user, { note: 'Review route assigned' });
    return created;
  }

  async decideReviewTask(id: string, taskId: string, dto: ReviewDecisionDto, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    const task = await this.reviewTaskRepo.findOne({ where: { id: taskId, documentId: id } });
    if (!task) throw new NotFoundException('Tarea de revisión no encontrada.');
    const email = this.email(user)?.toLowerCase();
    if (!this.isAdmin(user) && task.reviewerEmail !== email) throw new ForbiddenException('Solo el revisor asignado puede cerrar esta revisión.');
    const decision: OfficeReviewTaskStatus = dto.decision === 'rejected' ? 'rejected' : 'approved';
    let signature: OfficeDocumentSignature | null = null;
    if (decision === 'approved') {
      signature = await this.signDocument(id, { meaning: 'reviewed', statement: dto.note || this.defaultSignatureStatement('reviewed'), metadata: { reviewTaskId: task.id } }, user);
      task.signatureId = signature.id;
    }
    task.status = decision;
    task.decidedAt = new Date();
    task.decisionNote = this.normalizeLibraryText(dto.note, 2000);
    const saved = await this.reviewTaskRepo.save(task);
    await this.audit.log({ actor: this.email(user) || 'unknown', action: decision === 'approved' ? 'APPROVE_DOC_REVIEW_TASK' : 'REJECT_DOC_REVIEW_TASK', entity: 'OfficeDocument', entityId: id, before: { taskId, status: 'pending' }, after: { taskId, status: decision, signatureId: signature?.id ?? null }, scope: { tenant_id: doc.tenantId ?? user?.tenant_id ?? null } });
    return saved;
  }

  async cancelReviewTask(id: string, taskId: string, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.isOwner(doc, user)) throw new ForbiddenException('Solo el dueño puede cancelar revisiones.');
    const task = await this.reviewTaskRepo.findOne({ where: { id: taskId, documentId: id } });
    if (!task) throw new NotFoundException('Tarea de revisión no encontrada.');
    task.status = 'cancelled';
    const saved = await this.reviewTaskRepo.save(task);
    await this.audit.log({ actor: this.email(user) || 'unknown', action: 'CANCEL_DOC_REVIEW_TASK', entity: 'OfficeDocument', entityId: id, before: { taskId }, after: { taskId, status: 'cancelled' }, scope: { tenant_id: doc.tenantId ?? user?.tenant_id ?? null } });
    return saved;
  }

  async listTrainingAssignments(id: string, user: AuthenticatedUser) {
    await this.get(id, user);
    return this.trainingRepo.find({ where: { documentId: id }, order: { status: 'ASC', dueAt: 'ASC', updatedAt: 'DESC' }, take: 250 });
  }

  async assignTraining(id: string, dto: TrainingAssignDto, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.isOwner(doc, user)) throw new ForbiddenException('Solo el dueño puede asignar entrenamiento.');
    const assignees = this.normalizeMentions(dto.assignees).slice(0, 100);
    if (!assignees.length) throw new BadRequestException('Agrega al menos un asignado.');
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    const created: OfficeDocumentTrainingAssignment[] = [];
    for (const assigneeEmail of assignees) {
      let row = await this.trainingRepo.findOne({ where: { documentId: id, assigneeEmail } });
      if (!row) row = this.trainingRepo.create({ tenantId: doc.tenantId ?? user?.tenant_id ?? null, documentId: id, assigneeEmail });
      row.assignedBy = this.email(user);
      row.status = 'pending';
      row.dueAt = dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null;
      row.acknowledgedAt = null;
      row.signatureId = null;
      row.note = this.normalizeLibraryText(dto.note, 1000);
      created.push(await this.trainingRepo.save(row));
    }
    await this.audit.log({
      actor: this.email(user) || 'unknown',
      action: 'ASSIGN_DOC_TRAINING',
      entity: 'OfficeDocument',
      entityId: id,
      before: null,
      after: { assignees, dueAt: dueAt?.toISOString?.() ?? null },
      scope: { tenant_id: doc.tenantId ?? user?.tenant_id ?? null },
    });
    return created;
  }

  async acknowledgeTraining(id: string, assignmentId: string, dto: TrainingAcknowledgeDto, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    const assignment = await this.trainingRepo.findOne({ where: { id: assignmentId, documentId: id } });
    if (!assignment) throw new NotFoundException('Asignación de entrenamiento no encontrada.');
    const email = this.email(user)?.toLowerCase();
    if (!this.isAdmin(user) && assignment.assigneeEmail !== email) throw new ForbiddenException('Solo el asignado puede confirmar este entrenamiento.');
    const signature = await this.signDocument(id, {
      meaning: 'training_ack',
      statement: dto.statement ?? this.defaultSignatureStatement('training_ack'),
      signerName: dto.signerName,
      signerRole: dto.signerRole,
      metadata: { trainingAssignmentId: assignment.id },
    }, user);
    assignment.status = 'acknowledged';
    assignment.acknowledgedAt = new Date();
    assignment.signatureId = signature.id;
    const saved = await this.trainingRepo.save(assignment);
    await this.audit.log({
      actor: this.email(user) || 'unknown',
      action: 'ACK_DOC_TRAINING',
      entity: 'OfficeDocument',
      entityId: id,
      before: { assignmentId, status: 'pending' },
      after: { assignmentId, status: saved.status, signatureId: signature.id },
      scope: { tenant_id: doc.tenantId ?? user?.tenant_id ?? null },
    });
    return saved;
  }

  async cancelTrainingAssignment(id: string, assignmentId: string, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.isOwner(doc, user)) throw new ForbiddenException('Solo el dueño puede cancelar entrenamiento.');
    const assignment = await this.trainingRepo.findOne({ where: { id: assignmentId, documentId: id } });
    if (!assignment) throw new NotFoundException('Asignación de entrenamiento no encontrada.');
    assignment.status = 'cancelled';
    const saved = await this.trainingRepo.save(assignment);
    await this.audit.log({
      actor: this.email(user) || 'unknown',
      action: 'CANCEL_DOC_TRAINING',
      entity: 'OfficeDocument',
      entityId: id,
      before: { assignmentId },
      after: { assignmentId, status: 'cancelled' },
      scope: { tenant_id: doc.tenantId ?? user?.tenant_id ?? null },
    });
    return saved;
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
    const saved = await this.repo.save(doc);
    await this.refreshSearchIndex(saved);
    return saved;
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



  async rebuildSearchIndex(user: AuthenticatedUser) {
    this.assertWriter(user);
    const qb = this.repo.createQueryBuilder('d');
    if (!this.isAdmin(user)) {
      const email = this.email(user) ?? '__none__';
      qb.where('(d.createdBy = :email OR LOWER(CAST(d.sharedWith AS TEXT)) LIKE :share)', {
        email,
        share: `%"${email.toLowerCase()}"%`,
      });
    }
    const docs = await qb.getMany();
    let indexed = 0;
    for (const doc of docs) {
      await this.refreshSearchIndex(doc);
      indexed += 1;
    }
    return { indexed, scope: this.isAdmin(user) ? 'all' : 'visible' };
  }

  async searchMetadata(id: string, user: AuthenticatedUser) {
    await this.get(id, user);
    let index = await this.searchRepo.findOne({ where: { documentId: id } });
    if (!index) {
      const doc = await this.repo.findOne({ where: { id } });
      if (doc) index = await this.refreshSearchIndex(doc);
    }
    return index ?? { documentId: id, text: '', refs: [], fields: {}, wordCount: 0, refCount: 0 };
  }

  private async refreshSearchIndex(doc: OfficeDocument) {
    const extracted = this.extractSearchSurface(doc.content);
    const text = [doc.title, doc.model, doc.createdBy, doc.space, doc.folderPath, doc.collection, ...(doc.tags ?? []), extracted.text].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 200000);
    const index = this.searchRepo.create({
      documentId: doc.id,
      tenantId: doc.tenantId ?? null,
      text,
      refs: extracted.refs,
      refsText: extracted.refs.map((r) => `entity:${r.entity} ref:${r.refId.toLowerCase()} label:${(r.label ?? '').toLowerCase()}`).join(' | '),
      fields: extracted.fields,
      fieldsText: Object.entries(extracted.fields).map(([k, v]) => `${k}:${String(v).toLowerCase()}`).join(' | '),
      wordCount: text ? text.split(/\s+/).length : 0,
      refCount: extracted.refs.length,
    });
    return this.searchRepo.save(index);
  }

  private extractSearchSurface(content: any): { text: string; refs: OfficeDocumentSearchRef[]; fields: Record<string, string> } {
    const words: string[] = [];
    const refs = new Map<string, OfficeDocumentSearchRef>();
    const fields: Record<string, string> = {};
    const visit = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (typeof node.text === 'string') words.push(node.text);
      const attrs = node.attrs ?? {};
      if (node.type === 'axosRef') {
        const entity = String(attrs.entity ?? '').trim().toLowerCase();
        const refId = String(attrs.refId ?? '').trim();
        if (entity && refId) refs.set(`${entity}:${refId.toLowerCase()}`, { entity, refId, label: String(attrs.label ?? '').trim() || undefined });
        if (attrs.label || refId) words.push(String(attrs.label || refId));
      }
      if (node.type === 'docField') {
        const key = String(attrs.key ?? attrs.field ?? '').trim();
        const value = String(attrs.value ?? attrs.fallback ?? '').trim();
        if (key) fields[key] = value;
        if (value) words.push(value);
      }
      if (typeof attrs.alt === 'string') words.push(attrs.alt);
      if (typeof attrs.title === 'string') words.push(attrs.title);
      if (Array.isArray(node.content)) node.content.forEach(visit);
    };
    visit(content);
    return { text: words.join(' '), refs: [...refs.values()].slice(0, 250), fields };
  }




  private normalizeSignatureMeaning(meaning?: string): OfficeSignatureMeaning {
    const allowed: OfficeSignatureMeaning[] = ['reviewed', 'approved', 'released', 'acknowledged', 'training_ack'];
    return allowed.includes(meaning as OfficeSignatureMeaning) ? meaning as OfficeSignatureMeaning : 'reviewed';
  }

  private defaultSignatureStatement(meaning: OfficeSignatureMeaning): string {
    const labels: Record<OfficeSignatureMeaning, string> = {
      reviewed: 'He revisado este documento y confirmo que la evidencia es correcta.',
      approved: 'Apruebo este documento controlado para el flujo definido.',
      released: 'Confirmo la liberación de este documento para uso controlado.',
      acknowledged: 'Confirmo que he leído y entendido este documento.',
      training_ack: 'Confirmo entrenamiento/acuse sobre este documento controlado.',
    };
    return labels[meaning];
  }

  private documentHash(doc: OfficeDocument): string {
    return createHash('sha256').update(JSON.stringify({
      id: doc.id,
      title: doc.title,
      type: doc.type,
      content: doc.content,
      lifecycleState: doc.lifecycleState,
      updatedAt: doc.updatedAt,
    })).digest('hex');
  }

  private normalizeDistributionFormat(format?: string): OfficeDistributionFormat {
    const allowed: OfficeDistributionFormat[] = ['pdf', 'docx', 'html', 'markdown', 'txt', 'print', 'other'];
    return allowed.includes(format as OfficeDistributionFormat) ? format as OfficeDistributionFormat : 'other';
  }

  private normalizeDistributionAction(action?: string): OfficeDistributionAction {
    const allowed: OfficeDistributionAction[] = ['export', 'print', 'download', 'controlled_copy'];
    return allowed.includes(action as OfficeDistributionAction) ? action as OfficeDistributionAction : 'export';
  }

  private normalizeTags(tags?: string[] | null): string[] {
    if (!Array.isArray(tags)) return [];
    return [...new Set(tags.map((tag) => String(tag ?? '').trim()).filter(Boolean))].slice(0, 16);
  }

  private normalizeLibraryText(value: string | null | undefined, max: number): string | null {
    const v = String(value ?? '').trim();
    return v ? v.slice(0, max) : null;
  }

  private normalizeFolderPath(value: string | null | undefined): string | null {
    const cleaned = String(value ?? '')
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean)
      .join('/');
    return cleaned ? cleaned.slice(0, 240) : null;
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
