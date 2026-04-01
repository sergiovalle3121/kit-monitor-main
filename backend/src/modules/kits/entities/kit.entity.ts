import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Model } from '../../models/entities/model.entity';

@Entity()
export class Kit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column()
  serialNumber: string;

 @ManyToOne(() => Model, (model) => model.kits)
model: Model;
}