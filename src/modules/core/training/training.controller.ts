import { Controller, Post, UseInterceptors, UploadedFile, Get, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TrainingService } from './training.service';

@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    return this.trainingService.processFile(file);
  }

  @Get('test-search')
  async testSearch(@Query('q') query: string) {
    return this.trainingService.findRelevantContext(query);
  }

  @Get('list-knowledge')
  async listKnowledge() {
    return this.trainingService.listAllKnowledge();
  }

  @Post('reset-knowledge')
  async resetKnowledge() {
    return this.trainingService.resetKnowledge();
  }
}
