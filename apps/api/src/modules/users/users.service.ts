import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { isOwnerEmail } from '../auth/rbac';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(dto: Partial<User>): Promise<User> {
    if (dto.password) {
      // Trim surrounding whitespace so accidental spaces (env vars, autofill,
      // copy-paste) never silently break login. Must mirror validateUser().
      dto.password = await bcrypt.hash(dto.password.trim(), 10);
    }
    const user = this.userRepo.create(dto);
    return this.userRepo.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.userRepo.find({ order: { id: 'ASC' } });
  }

  async findByStatus(status: string): Promise<User[]> {
    return this.userRepo.find({
      where: { status: status as User['status'] },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findOneByIdentifier(identifier: string): Promise<User | null> {
    const normalized = (identifier ?? '').trim().toLowerCase();
    if (!normalized) return null;

    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('LOWER(user.email) = :normalized', { normalized })
      .orWhere('LOWER(user.username) = :normalized', { normalized })
      .getOne();
  }

  async findOneByEmail(email: string): Promise<User | null> {
    const normalized = (email ?? '').trim().toLowerCase();
    return this.userRepo.findOne({
      where: { email: normalized },
      select: [
        'id',
        'email',
        'password',
        'role',
        'scopes',
        'permissions',
        'isActive',
        'username',
      ],
    });
  }

  /**
   * Active users that hold a given permission — mirrors PermissionsGuard:
   * Admin (case-insensitive) and the app owner(s) always match; otherwise the
   * user's stored `permissions` array must include it. Used by producers (p.ej.
   * las alertas de tráfico) para dirigir avisos al equipo correcto, no solo al owner.
   */
  async listByPermission(permission: string): Promise<User[]> {
    const users = await this.userRepo.find();
    return users.filter(
      (u) =>
        u.isActive !== false &&
        ((u.role || '').toLowerCase() === 'admin' ||
          isOwnerEmail(u.email) ||
          (Array.isArray(u.permissions) && u.permissions.includes(permission))),
    );
  }

  async update(id: string, dto: Partial<User>): Promise<User> {
    const user = await this.findOne(id);
    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password.trim(), 10);
    }
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepo.remove(user);
  }

  async getRoleStats() {
    const users = await this.userRepo.find();
    const stats: Record<string, number> = {};
    users.forEach((u) => {
      stats[u.role] = (stats[u.role] || 0) + 1;
    });
    return stats;
  }
}
