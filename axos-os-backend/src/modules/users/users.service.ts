import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

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
    return this.userRepo.find({ order: { id: 'ASC' } });
  }

  async findOne(id: number): Promise<User> {
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
      select: ['id', 'email', 'password', 'role', 'scopes', 'permissions', 'isActive', 'username'] 
    });
  }

  async update(id: number, dto: Partial<User>): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  async remove(id: number): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepo.remove(user);
  }

  async getRoleStats() {
    const users = await this.userRepo.find();
    const stats: Record<string, number> = {};
    users.forEach(u => {
      stats[u.role] = (stats[u.role] || 0) + 1;
    });
    return stats;
  }
}
