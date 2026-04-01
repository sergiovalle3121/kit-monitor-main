import { Injectable } from '@nestjs/common';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  private users: User[] = [
    {
      id: 1,
      email: 'test@example.com',
      password: '$2b$10$123456789012345678901uuz2W1V95WrSTf5ysOIEcC2w1eP9Tf4q',
      isActive: true,
    },
  ];

  async create(user: Partial<User>): Promise<User> {
    const newUser: User = {
      ...user,
      id: this.users.length + 1,
      isActive: true,
      password: user.password || '',
      email: user.email || '',
    } as User;
    this.users.push(newUser);
    return newUser;
  }

  async findAll(): Promise<User[]> {
    return this.users;
  }

  async findOne(id: number): Promise<User | undefined> {
    return this.users.find(user => user.id === id);
  }

  async update(id: number, user: Partial<User>): Promise<User | undefined> {
    const idx = this.users.findIndex(u => u.id === id);
    if (idx === -1) return undefined;
    this.users[idx] = { ...this.users[idx], ...user };
    return this.users[idx];
  }

  async remove(id: number): Promise<boolean> {
    const idx = this.users.findIndex(u => u.id === id);
    if (idx === -1) return false;
    this.users.splice(idx, 1);
    return true;
  }

  async findOneByEmail(email: string): Promise<User | undefined> {
    return this.users.find(user => user.email === email);
  }
}
