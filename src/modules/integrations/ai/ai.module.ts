import { Module, forwardRef } from '@nestjs/common';
import { AIService } from './ai.service';
import { VectorStoreService } from './vector-store.service';
import { TrainingModule } from '../../core/training/training.module';
import { OpenClawModule } from '../open-claw/open-claw.module';
import { GoogleModule } from '../google/google.module';

@Module({
  imports: [forwardRef(() => TrainingModule), OpenClawModule, GoogleModule],
  providers: [AIService, VectorStoreService],
  exports: [AIService, VectorStoreService, GoogleModule],
})
export class AIModule {}
