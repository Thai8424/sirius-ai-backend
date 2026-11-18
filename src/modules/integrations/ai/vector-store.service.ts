import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChromaClient, Collection } from 'chromadb';

@Injectable()
export class VectorStoreService implements OnModuleInit {
  private client: ChromaClient;
  private collection: Collection;

  async onModuleInit() {
    try {
      this.client = new ChromaClient({
        // Thay path bằng host và port
        host: 'localhost',
        port: 8000
      });

      // Tạo hoặc lấy Collection
      this.collection = await this.client.getOrCreateCollection({
        name: 'sirius_knowledge_base',
        metadata: { "hnsw:space": "cosine" },
        // Truyền một hàm rỗng để tránh báo lỗi "DefaultEmbeddingFunction"
        embeddingFunction: null as any
      });

      console.log('--- VECTOR STORE CONNECTED (ChromaDB) ---');
    } catch (error) {
      console.error('Không thể kết nối tới ChromaDB. Hãy đảm bảo server đang chạy ở http://localhost:8000');
    }
  }

  async addDocuments(ids: string[], vectors: number[][], metadatas: any[], documents: string[]) {
    if (!this.collection) return;
    
    await this.collection.add({
      ids,
      embeddings: vectors,
      metadatas,
      documents
    });
  }

  async query(vector: number[], limit: number = 3) {
    if (!this.collection) return [];

    const result = await this.collection.query({
      queryEmbeddings: [vector],
      nResults: limit
    });

    return result.documents[0]; // Trả về danh sách các đoạn văn bản liên quan
  }

  async getAllDocuments() {
    if (!this.collection) return null;
    return await this.collection.get({
      include: ['embeddings' as any, 'documents' as any, 'metadatas' as any]
    });
  }

  async clearAll() {
    if (!this.collection) return;
    // Xóa toàn bộ dữ liệu trong collection này
    const all = await this.collection.get();
    if (all.ids.length > 0) {
      await this.collection.delete({ ids: all.ids });
    }
  }
}
