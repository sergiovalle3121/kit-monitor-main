import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OfficeDocument, OfficeDocType, OfficeShare } from './entities/office-document.entity';
import { OfficeDocumentVersion } from './entities/office-document-version.entity';
import { OfficeComment, OfficeCommentAnchorType } from './entities/office-comment.entity';
import { AuthenticatedUser } from '../../common/types/jwt.types';

const TYPES: OfficeDocType[] = ['doc', 'sheet', 'slides'];
// Columns returned by list endpoints — heavy `content` is intentionally omitted.
const LIST_COLUMNS = ['id', 'type', 'title', 'model', 'createdBy', 'tenantId', 'createdAt', 'updatedAt'];
// Auto-snapshots are throttled so autosave doesn't create a version every keystroke.
const SNAPSHOT_THROTTLE_MS = 2 * 60 * 1000;
const MAX_VERSIONS = 50;

interface CreateDto { type: OfficeDocType; title?: string; content?: any; model?: string }
interface UpdateDto { title?: string; content?: any; model?: string | null; sharedWith?: OfficeShare[] }
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
    @InjectRepository(OfficeComment) private readonly commentRepo: Repository<OfficeComment>,
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
  list(type: OfficeDocType | undefined, user: AuthenticatedUser, trash = false) {
    const qb = this.repo.createQueryBuilder('d').select(LIST_COLUMNS.map((c) => `d.${c}`));
    if (type) qb.andWhere('d.type = :type', { type });
    if (trash) qb.withDeleted().andWhere('d.deletedAt IS NOT NULL');
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
      }),
    );
  }

  async update(id: string, dto: UpdateDto, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.canEdit(doc, user)) throw new ForbiddenException('No puedes editar este documento.');
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
      }),
    );
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
    await this.versionRepo.delete({ documentId: id });
    await this.repo.delete(id);
    return { destroyed: true, id };
  }



  // ── Enterprise comments ────────────────────────────────────────────────────
  async listComments(id: string, user: AuthenticatedUser, includeResolved = true) {
    const doc = await this.get(id, user);
    const qb = this.commentRepo.createQueryBuilder('c')
      .where('c.documentId = :id', { id: doc.id })
      .orderBy('c.createdAt', 'ASC');
    if (doc.tenantId) qb.andWhere('c.tenantId = :tenantId', { tenantId: doc.tenantId });
    else qb.andWhere('c.tenantId IS NULL');
    if (!includeResolved) qb.andWhere('c.resolved = false');
    return qb.getMany();
  }

  async addComment(id: string, dto: CommentDto, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.canEdit(doc, user)) throw new ForbiddenException('No puedes comentar este documento.');
    const text = String(dto.text ?? '').trim();
    if (!text) throw new BadRequestException('El comentario no puede estar vacío.');
    if (dto.parentId) {
      const parent = await this.commentRepo.findOne({ where: { id: dto.parentId, documentId: doc.id } });
      if (!parent) throw new BadRequestException('Thread de comentario inválido.');
    }
    return this.commentRepo.save(this.commentRepo.create({
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

  async resolveComment(id: string, commentId: string, resolved: boolean, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.canEdit(doc, user)) throw new ForbiddenException('No puedes resolver comentarios en este documento.');
    const c = await this.commentRepo.findOne({ where: { id: commentId, documentId: doc.id } });
    if (!c) throw new NotFoundException('Comentario no encontrado.');
    c.resolved = !!resolved;
    c.resolvedBy = c.resolved ? this.email(user) : null;
    c.resolvedAt = c.resolved ? new Date() : null;
    return this.commentRepo.save(c);
  }

  async removeComment(id: string, commentId: string, user: AuthenticatedUser) {
    const doc = await this.get(id, user);
    if (!this.canEdit(doc, user)) throw new ForbiddenException('No puedes eliminar comentarios en este documento.');
    const c = await this.commentRepo.findOne({ where: { id: commentId, documentId: doc.id } });
    if (!c) throw new NotFoundException('Comentario no encontrado.');
    await this.commentRepo.delete({ id: commentId, documentId: doc.id });
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
