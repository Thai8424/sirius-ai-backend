import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { TrainingService } from '../../core/training/training.service';
import { OpenClawService } from '../open-claw/open-claw.service';
import { GoogleService } from '../google/google.service';
import { createSiriusTools, siriusToolHandlers } from './ai.tools';

@Injectable()
export class AIService implements OnModuleInit {
  private client: any;
  private readonly modelName = 'gemini-3-flash-preview';

  constructor(
    private readonly trainingService: TrainingService,
    private readonly openClawService: OpenClawService,
    private readonly googleService: GoogleService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) return;

    this.client = new GoogleGenAI({ apiKey: apiKey.trim() });
    console.log(`Sirius AI (Super Brain 3.1) active with: ${this.modelName}`);
  }

  /**
   * Tạo vector embedding cho một đoạn văn bản (Dùng cho kho tri thức)
   */
  async getEmbedding(text: string): Promise<number[]> {
    if (!this.client) return [];
    try {
      const response = await this.client.models.embedContent({
        model: 'text-embedding-004',
        contents: [{ parts: [{ text }] }],
      });
      return response.embeddings[0].values;
    } catch (error) {
      console.error('Embedding Error:', error);
      return [];
    }
  }

  async generateResponse(prompt: string, context: string[] = [], history: any[] = [], imageDatas: { data: string, mimeType: string }[] = []) {
    if (!this.client) return 'AI Service is not configured.';

    try {
      // 1. Cấu hình Hệ thống (System Instruction)
      const systemInstruction = `
    Bạn là Sirius AI - Trợ lý đa năng cao cấp được vận hành trên nền tảng Gemini 3.
    
    KỸ NĂNG LÕI:
    - Quản lý văn phòng: Đặt lịch họp chuyên nghiệp (luôn kèm Meet), gửi email HTML xác nhận.
    - Tra cứu tin tức: Sử dụng công cụ 'Google Search' tích hợp để có thông tin thời gian thực chính xác nhất.
    - Thị giác máy tính: Phân tích hình ảnh người dùng gửi lên.
    - Duyệt web: Sử dụng trình duyệt khi cần thao tác sâu trên website.
    
    NGUYÊN TẮC:
    - Luôn dùng múi giờ Asia/Ho_Chi_Minh.
    - Phản hồi bằng tiếng Việt chuyên nghiệp, chu đáo.
    - Nếu tạo lịch thành công, LUÔN gửi email xác nhận cho ${process.env.DEFAULT_NOTIFICATION_EMAIL || 'email do người dùng cung cấp'}.
    `;

      // 2. Cấu hình Thế hệ (Generation Config) bao gồm cả Thinking và Native Tools
      const config = {
        systemInstruction: systemInstruction,
        thinkingConfig: {
          includeThoughts: true,
          thinkingLevel: ThinkingLevel.LOW,
        },
        tools: [
          { googleSearch: {} }, // Kích hoạt Google Search Native
          { functionDeclarations: createSiriusTools(this.trainingService, this.openClawService) }
        ],
      };

      // 3. Chuẩn bị nội dung hội thoại
      const contents: any[] = history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
      }));

      const currentParts: any[] = [{ text: prompt }];
      if (imageDatas && imageDatas.length > 0) {
        imageDatas.forEach(img => {
          currentParts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
        });
      }
      contents.push({ role: 'user', parts: currentParts });

      // 4. Vòng lặp Agentic Workflow
      let step = 0;
      const MAX_STEPS = 5;
      let wasBrowserUsed = false;

      try {
        while (step < MAX_STEPS) {
          const response = await this.client.models.generateContent({
            model: this.modelName,
            contents: contents,
            config: config,
          });

          const candidates = response.candidates;
          if (!candidates || candidates.length === 0) break;

          const modelContent = candidates[0].content;
          const functionCalls = response.functionCalls;

          // Lưu lượt phản hồi của model vào history để duy trì ngữ cảnh
          contents.push(modelContent);

          if (functionCalls && functionCalls.length > 0) {
            const functionResponsesParts: any[] = [];

            for (const call of functionCalls) {
              const handler = siriusToolHandlers[call.name];
              if (handler) {
                console.log(`[Thinking Mode] Gemini 3 executing: ${call.name}`);
                let toolData;

                try {
                  if (call.name.includes('calendar') || call.name === 'send_email') {
                    toolData = await (handler as any)(this.googleService, call.args);
                  } else if (['browse_web', 'web_action'].includes(call.name)) {
                    wasBrowserUsed = true;
                    toolData = await (handler as any)(this.openClawService, call.args);
                  } else if (['searchKnowledge', 'getKnowledgeStats'].includes(call.name)) {
                    toolData = await (handler as any)(this.trainingService, call.args);
                  } else {
                    toolData = await (handler as any)(call.args);
                  }
                } catch (err) {
                  toolData = { error: err.message };
                  console.error(`Tool Execution Error (${call.name}):`, err);
                }

                functionResponsesParts.push({
                  functionResponse: {
                    name: call.name,
                    response: { result: toolData },
                    id: call.id,
                  },
                });
              }
            }

            if (functionResponsesParts.length > 0) {
              contents.push({ role: 'user', parts: functionResponsesParts });
            }
            step++;
          } else {
            // Trả về văn bản cuối cùng (có thể chứa trích dẫn từ Google Search)
            return response.text();
          }
        }
      } finally {
        if (wasBrowserUsed) {
          await this.openClawService.closeBrowser();
        }
      }

      return 'Yêu cầu quá phức tạp, tôi cần thêm thời gian để xử lý.';
    } catch (error) {
      console.error('Gemini 3 Native Search Logic Error:', error);
      return `Hệ thống Sirius AI đang bảo trì: ${error.message}`;
    }
  }
}
