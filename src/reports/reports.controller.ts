import { Controller, Get, Post, HttpCode } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('api/v1/reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get()
  report() {
    return {
      'accounts.csv': this.reportsService.state('accounts'),
      'yearly.csv': this.reportsService.state('yearly'),
      'fs.csv': this.reportsService.state('fs'),
    };
  }

  @Post()
  @HttpCode(201)
  async generate() {
    // Start all report generation processes in parallel
    await Promise.all([
      this.reportsService.accounts(),
      this.reportsService.yearly(),
      this.reportsService.fs(),
    ]).catch((error) => {
      // Log error but don't throw to avoid breaking the response
      console.error('Error in report generation:', error);
    });

    return { message: 'starting' };
  }
}
