import { Injectable, Inject, forwardRef } from '@nestjs/common';
import * as pdf from 'pdf-parse';
import * as mammoth from 'mammoth';
import { AIService } from '../../integrations/ai/ai.service';
import { VectorStoreService } from '../../integrations/ai/vector-store.service';

@Injectable()
export class TrainingService {
  constructor(
    @Inject(forwardRef(() => AIService))
    private readonly aiService: AIService,
    private readonly vectorStoreService: VectorStoreService,
  ) {}

  async processFile(file: Express.Multer.File) {
    let text = '';

    try {
      if (file.mimetype === 'application/pdf') {
        const data = await (pdf as any)(file.buffer);
        text = data.text;
      } else if (
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        const data = await mammoth.extractRawText({ buffer: file.buffer });
        text = data.value;
      } else {
        text = file.buffer.toString('utf-8');
      }

      const chunks = this.chunkText(text, 500);
      
      // Thử cách chuyển đổi binary sang utf8 (thường hiệu quả hơn trên Windows)
      const fileName = Buffer.from(file.originalname, 'binary').toString('utf8');
      
      const ids = chunks.map((_, i) => `${fileName}-${Date.now()}-${i}`);
      const vectors: number[][] = [];
      const metadatas = chunks.map(() => ({ source: fileName }));

      for (const chunk of chunks) {
        const vector = await this.aiService.getEmbedding(chunk);
        if (vector) {
          vectors.push(vector);
        }
      }

      // Lưu vào ChromaDB
      await this.vectorStoreService.addDocuments(ids, vectors, metadatas, chunks);

      return {
        message: 'Tài liệu đã được xử lý và lưu vào ChromaDB thành công.',
        chunksCount: chunks.length,
      };
    } catch (error) {
      console.error('Lỗi xử lý file:', error);
      throw new Error('Không thể đọc được nội dung file.');
    }
  }

  private chunkText(text: string, size: number, overlap: number = 100): string[] {
    if (!text) return [];
    
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = start + size;
      const chunk = text.substring(start, end);
      chunks.push(chunk.trim());
      
      // Dịch chuyển điểm bắt đầu, nhưng trừ đi phần gối đầu (overlap)
      start += (size - overlap);
      
      // Tránh lặp vô hạn nếu overlap >= size
      if (size <= overlap) break;
    }

    return chunks;
  }

  async findRelevantContext(query: string, limit: number = 3): Promise<string[]> {
    const queryVector = await this.aiService.getEmbedding(query);
    if (!queryVector) return [];

    // Tìm kiếm trực tiếp trên ChromaDB
    const relevantChunks = await this.vectorStoreService.query(queryVector, limit);
    return relevantChunks as string[];
  }

  async findContextMultiQuery(queries: string[], limit: number = 5): Promise<string[]> {
    const allResults = await Promise.all(
      queries.map(q => this.findRelevantContext(q, limit))
    );

    // Gộp kết quả và loại bỏ trùng lặp (Deduplication)
    const uniqueChunks = Array.from(new Set(allResults.flat()));
    return uniqueChunks;
  }

  async listAllKnowledge() {
    return await this.vectorStoreService.getAllDocuments();
  }

  async resetKnowledge() {
    await this.vectorStoreService.clearAll();
    return { message: 'Đã xóa toàn bộ kho tri thức.' };
  }
}
