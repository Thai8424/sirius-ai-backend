import { Module, forwardRef } from '@nestjs/common';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';
import { AIModule } from '../../integrations/ai/ai.module';

@Module({
  imports: [forwardRef(() => AIModule)],
  controllers: [TrainingController],
  providers: [TrainingService],
  exports: [TrainingService],
})
export class TrainingModule {}
