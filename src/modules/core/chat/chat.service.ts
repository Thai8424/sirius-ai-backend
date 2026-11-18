import { Injectable } from '@nestjs/common';
import { AIService } from '../../integrations/ai/ai.service';
import { TrainingService } from '../training/training.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from './entities/chat-message.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ChatService {
  private readonly uploadPath = path.join(process.cwd(), 'uploads', 'chat');

  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatRepository: Repository<ChatMessage>,
    private readonly aiService: AIService,
    private readonly trainingService: TrainingService,
  ) {
    // Đảm bảo thư mục tồn tại
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
    }
  }

  private saveBase64Image(base64Data: string): string {
    const matches = base64Data.match(/^data:image\/([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return base64Data;

    const extension = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const fileName = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}.${extension}`;
    const filePath = path.join(this.uploadPath, fileName);

    fs.writeFileSync(filePath, buffer);
    return `/uploads/chat/${fileName}`; // Trả về đường dẫn tương đối để lưu vào DB
  }

  async processMessage(content: string, sessionId: string, images?: { data: string, mimeType: string }[]) {
    // 1. Lưu tin nhắn của user
    const userMessage = this.chatRepository.create({
      sessionId,
      role: 'user',
      content,
      images: images ? images.map(img => this.saveBase64Image(`data:${img.mimeType};base64,${img.data}`)) : null
    });
    await this.chatRepository.save(userMessage);

    // 2. Lấy lịch sử để AI có bối cảnh
    const history = await this.getHistory(sessionId);

    // 3. Gọi AI để lấy phản hồi
    const aiResponse = await this.aiService.generateResponse(content, [], history, images);

    // 4. Lưu phản hồi của AI
    const assistantMessage = this.chatRepository.create({
      sessionId,
      role: 'assistant',
      content: aiResponse,
    });
    await this.chatRepository.save(assistantMessage);

    return {
      role: 'assistant',
      content: aiResponse,
      timestamp: assistantMessage.createdAt,
      images: assistantMessage.images
    };
  }

  async getHistory(sessionId: string) {
    return this.chatRepository.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });
  }

  async deleteSession(sessionId: string) {
    return this.chatRepository.delete({ sessionId });
  }
}
