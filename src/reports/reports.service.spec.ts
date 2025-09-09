import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { REPORTS_CONFIG } from './reports.config';
import { setupTestDirs } from '../tests/setupTestDirs';

describe('ReportsService', () => {
  let service: ReportsService;
  let module: TestingModule;

  beforeEach(async () => {
    const dirs = await setupTestDirs();
    module = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: REPORTS_CONFIG,
          useValue: {
            tmpDir: dirs.tmpDir,
            outDir: dirs.outDir,
          },
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
