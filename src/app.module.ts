import { Module } from '@nestjs/common';
import { DbModule } from './db.module';
import { TicketsController } from './tickets/tickets.controller';
import { ReportsController } from './reports/reports.controller';
import { HealthcheckController } from './healthcheck/healthcheck.controller';
import { ReportsService } from './reports/reports.service';
import { TicketsService } from './tickets/tickets.service';
import { REPORTS_CONFIG } from './reports/reports.config';

@Module({
  imports: [DbModule],
  controllers: [TicketsController, ReportsController, HealthcheckController],
  providers: [
    ReportsService,
    TicketsService,
    {
      provide: REPORTS_CONFIG,
      useValue: {
        tmpDir: 'tmp',
        outDir: 'out',
      },
    },
  ],
})
export class AppModule {}
