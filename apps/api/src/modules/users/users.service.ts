import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';

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
