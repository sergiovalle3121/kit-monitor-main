import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Kit } from '../../kits/entities/kit.entity';

@Entity()
export class Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @ManyToOne(() => User, { nullable: true })
  user: User;

  @OneToMany(() => Kit, kit => kit.model)
  kits: Kit[];
}
