import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Model } from '../../models/entities/model.entity';

@Entity()
export class Report {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column('text')
  details: string;

  @Column({ nullable: true })
  content: string;

  @ManyToOne(() => User, { nullable: true })
  user: User;

  @ManyToOne(() => Model, { nullable: true })
  model: Model;
}
