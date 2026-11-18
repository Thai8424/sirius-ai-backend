import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { authenticate } from '@google-cloud/local-auth';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class GoogleService implements OnModuleInit {
  private readonly logger = new Logger(GoogleService.name);
  private auth: any;

  // Phạm vi quyền hạn (Scopes)
  private readonly SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
  ];

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Đợi 2 giây để đảm bảo hệ thống đã khởi động xong mới bắt đầu Auth
    setTimeout(() => this.initAuth(), 2000);
  }

  private async initAuth() {
    try {
      const credentialsPath = this.configService.get<string>('GOOGLE_CREDENTIALS_PATH') || 'credentials.json';
      const tokenPath = this.configService.get<string>('GOOGLE_TOKEN_PATH') || 'token.json';

      // 1. Kiểm tra xem có token cũ chưa
      try {
        const tokenContent = await fs.readFile(tokenPath, 'utf8');
        const credentials = JSON.parse(tokenContent);
        this.auth = google.auth.fromJSON(credentials);
        this.logger.log('Đã nạp Google Token thành công từ file.');
      } catch (err) {
        // 2. Nếu chưa có token, thực hiện đăng nhập lần đầu
        this.logger.log('Chưa có Token. Đang chuẩn bị quy trình đăng nhập OAuth2...');
        const fullCredentialsPath = path.join(process.cwd(), credentialsPath);

        this.auth = await authenticate({
          keyfilePath: fullCredentialsPath,
          scopes: this.SCOPES,
        });

        if (this.auth.credentials) {
          const payload = JSON.stringify({
            type: 'authorized_user',
            client_id: (this.auth as any)._clientId,
            client_secret: (this.auth as any)._clientSecret,
            refresh_token: this.auth.credentials.refresh_token,
          });
          await fs.writeFile(tokenPath, payload);
          this.logger.log('Đã lưu Token mới vào file token.json.');
        }
      }
    } catch (error) {
      this.logger.error(`Lỗi xác thực Google: ${error.message}`);
      this.logger.warn('Vui lòng kiểm tra file credentials.json và thử lại.');
    }
  }

  getCalendarClient() {
    if (!this.auth) throw new Error('Google Auth chưa được khởi tạo.');
    return google.calendar({ version: 'v3', auth: this.auth });
  }

  getGmailClient() {
    if (!this.auth) throw new Error('Google Auth chưa được khởi tạo.');
    return google.gmail({ version: 'v1', auth: this.auth });
  }
}
