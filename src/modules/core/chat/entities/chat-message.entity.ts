import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  sessionId: string; // Để phân biệt các cuộc hội thoại khác nhau

  @Column({ type: 'varchar', length: 50 })
  role: 'user' | 'assistant';

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'json', nullable: true })
  images: any; // Store multimodal image data

  @CreateDateColumn()
  createdAt: Date;
}
