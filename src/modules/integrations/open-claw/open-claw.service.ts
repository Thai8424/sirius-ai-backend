import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class OpenClawService {
  private readonly logger = new Logger(OpenClawService.name);

  private async runClawCommand(command: string): Promise<string> {
    try {
      this.logger.log(`Executing CLI: openclaw ${command}`);
      const { stdout, stderr } = await execAsync(`openclaw ${command}`);
      if (stderr && !stdout) {
        this.logger.warn(`CLI Warning: ${stderr}`);
      }
      return stdout;
    } catch (error) {
      this.logger.error(`CLI Error: ${error.message}`);
      return `Error: ${error.message}`;
    }
  }

  async navigate(url: string) {
    this.logger.log(`Navigating to: ${url}`);
    return await this.runClawCommand(`browser navigate "${url}"`);
  }

  async act(action: string, selector: string, value?: string) {
    this.logger.log(`Action: ${action} on ${selector}`);
    
    // Ánh xạ các lệnh từ AI sang lệnh OpenClaw CLI chuẩn
    switch (action) {
      case 'type':
        return await this.runClawCommand(`browser type "${selector}" "${value || ''}"`);
      case 'scroll':
        // Nếu selector là document hoặc window, dùng phím PageDown để cuộn
        if (!selector || selector === 'document' || selector === 'window') {
          return await this.runClawCommand(`browser press PageDown`);
        }
        return await this.runClawCommand(`browser scrollintoview "${selector}"`);
      case 'submit':
        // Đổi submit thành nhấn phím Enter
        return await this.runClawCommand(`browser press Enter`);
      case 'click':
        return await this.runClawCommand(`browser click "${selector}"`);
      default:
        return await this.runClawCommand(`browser ${action} "${selector}"`);
    }
  }

  async getSnapshot() {
    this.logger.log('Taking page snapshot...');
    const text = await this.runClawCommand(`browser snapshot`);
    return { text };
  }

  async getScreenshot() {
    this.logger.log('Taking screenshot...');
    return await this.runClawCommand(`browser screenshot`);
  }

  async closeBrowser() {
    this.logger.log('Closing browser session...');
    return await this.runClawCommand(`browser stop`);
  }
}
