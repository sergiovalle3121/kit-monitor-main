import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OfficeDocument, OfficeDocType, OfficeShare } from './entities/office-document.entity';
import { AuthenticatedUser } from '../../common/types/jwt.types';

const TYPES: OfficeDocType[] = ['doc', 'sheet', 'slides'];
// Columns returned by list endpoints — heavy `content` is intentionally omitted.
const LIST_COLUMNS = ['id', 'type', 'title', 'model', 'createdBy', 'tenantId', 'createdAt', 'updatedAt'];

interface CreateDto { type: OfficeDocType; title?: string; content?: any; model?: string }
interface UpdateDto { title?: string; content?: any; model?: string | null; sharedWith?: OfficeShare[] }

/**
 * Documents are scoped to their owner. A user only ever sees the documents
 * they created (admins see everything). Writes are blocked for read-only roles
 * (e.g. the `executive` demo account, whose RBAC permissions are all `*:read`).
 */
@Injectable()
export class OfficeService {
  constructor(
    @InjectRepository(OfficeDocument) private readonly repo: Repository<OfficeDocument>,
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
    // Owner scoping: non-admins only see what they created.
    if (!this.isAdmin(user)) {
      qb.andWhere('d.createdBy = :email', { email: this.email(user) ?? '__none__' });
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
    await this.repo.delete(id);
    return { destroyed: true, id };
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
