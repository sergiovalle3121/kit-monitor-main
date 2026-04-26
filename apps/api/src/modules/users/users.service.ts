import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(dto: Partial<User>): Promise<User> {
    const user = this.userRepo.create(dto);
    return this.userRepo.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.userRepo.find({ order: { createdAt: 'DESC' } });
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
      .addSelect('user.password_hash')
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
        'username',
        'passwordHash',
        'tenantId',
        'isActive',
      ],
    });
  }

  async update(id: string, dto: Partial<User>): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepo.remove(user);
  }

  async getRoleStats() {
    // This will be updated to use the new UserRoleAssignment system
    // For now, returning empty to avoid crash
    return {};
  }
}
