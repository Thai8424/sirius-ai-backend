import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../../.env') });

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Không tìm thấy GEMINI_API_KEY trong .env');
    return;
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data: any = await response.json();

    console.log('--- DANH SÁCH MODEL KHẢ DỤNG (GEMINI 3 & LATEST) ---');
    if (data.models) {
      data.models.forEach((m: any) => {
        console.log(`- ID: ${m.name.replace('models/', '')} | Hỗ trợ: ${m.supportedGenerationMethods.join(', ')}`);
      });
    } else {
      console.log('Không lấy được danh sách model:', data);
    }
  } catch (error) {
    console.error('Lỗi khi gọi API:', error);
  }
}

listModels();
