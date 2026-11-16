import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { UserRole } from '../user-role.enum.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  // Solo el hash de bcrypt; select: false evita incluirlo en consultas normales.
  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  // Menor privilegio por defecto: una cuenta nueva nunca nace administradora.
  @Column({ type: 'enum', enum: UserRole, default: UserRole.STUDENT })
  role: UserRole;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
