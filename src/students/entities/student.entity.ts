import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'int' })
  age: number;

  @Column()
  career: string;

  @Column({ type: 'int' })
  semester: number;

  @Column({ default: true })
  isActive: boolean;
}
