import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { setupTestDirs } from '../tests/setupTestDirs';
import { REPORTS_CONFIG } from './reports.config';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('ReportsService', () => {
  let controller: ReportsController;
  let module: TestingModule;
  let tmpDir: string;
  let outDir: string;

  beforeEach(async () => {
    const dirs = await setupTestDirs();

    module = await Test.createTestingModule({
      controllers: [ReportsController],
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

    controller = module.get<ReportsController>(ReportsController);

    tmpDir = dirs.tmpDir;
    outDir = dirs.outDir;
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('report', () => {
    it('show idle for the start', async () => {
      const result = await controller.report();
      expect(result).toMatchObject(
        expect.objectContaining({
          'yearly.csv': 'idle',
          'accounts.csv': 'idle',
          'fs.csv': 'idle',
        }),
      );
    });
  });

  describe('generate', () => {
    describe('yearly.csv', () => {
      it('generates the report correctly', async () => {
        // Arrange: create fake input CSV
        const sampleCsv = `2023-01-01,Cash,,100,0
            2023-01-01,Sales Revenue,,0,50
            2023-01-01,Cash,,100,50`;
        await fs.writeFile(path.join(tmpDir, '2023-01.csv'), sampleCsv);

        const result = await controller.generate();

        // Check that the method returns the expected response
        expect(result).toEqual({ message: 'finished' });

        // Check that the yearly.csv file was created
        const yearlyFile = path.join(outDir, 'yearly.csv');
        const yearlyExists = await fs
          .access(yearlyFile)
          .then(() => true)
          .catch(() => false);
        expect(yearlyExists).toBe(true);

        // Check the content of the yearly.csv file
        const yearlyContent = await fs.readFile(yearlyFile, 'utf-8');
        expect(yearlyContent).toContain('Financial Year,Cash Balance');
        expect(yearlyContent).toContain('2023,150.00');
      });
    });

    describe('accounts.csv', () => {
      it('generates the report correctly', async () => {
        // Arrange: create fake input CSV
        const sampleCsv = `2023-01-01,Cash,,100,0
            2023-01-01,Sales Revenue,,0,50
            2023-01-01,Inventory,,0,50
            2023-01-01,Accounts Receivable,,100,50`;
        await fs.writeFile(path.join(tmpDir, '2023-01.csv'), sampleCsv);

        const result = await controller.generate();

        // Check that the method returns the expected response
        expect(result).toEqual({ message: 'finished' });

        // Check that the accounts.csv file was created
        const accountsFile = path.join(outDir, 'accounts.csv');
        const accountsExists = await fs
          .access(accountsFile)
          .then(() => true)
          .catch(() => false);
        expect(accountsExists).toBe(true);

        // Check the content of the accounts.csv file
        const accountsContent = await fs.readFile(accountsFile, 'utf-8');
        expect(accountsContent).toContain('Account,Balance');
        expect(accountsContent).toContain('Cash,100.00');
        expect(accountsContent).toContain('Sales Revenue,-50.00');
        expect(accountsContent).toContain('Inventory,-50.00');
        expect(accountsContent).toContain('Accounts Receivable,50.00');
      });
    });

    describe('fs.csv', () => {
      it('generates the report correctly', async () => {
        // Arrange: create fake input CSV
        const sampleCsv = `2023-01-01,Cash,,100,0
            2023-01-01,Sales Revenue,,100,
            2023-01-01,Salaries Expense,,50,
            2023-01-01,Accounts Receivable,,100,
            2023-01-01,Accounts Payable,,100,
            2023-01-01,Accounts Payable,,100,
            2023-01-01,Common Stock,,100,
            2023-01-01,Retained Earnings,,100,
            `;
        await fs.writeFile(path.join(tmpDir, '2023-01.csv'), sampleCsv);

        const result = await controller.generate();

        // Check that the fs.csv file was created
        const fsFile = path.join(outDir, 'fs.csv');
        const fsExists = await fs
          .access(fsFile)
          .then(() => true)
          .catch(() => false);
        expect(fsExists).toBe(true);

        // Check the content of the fs.csv file
        const fsContent = await fs.readFile(fsFile, 'utf-8');
        expect(fsContent).toContain('Basic Financial Statement');

        // Income statement
        expect(fsContent).toContain('Income Statement');
        expect(fsContent).toContain('Sales Revenue,100.00');
        expect(fsContent).toContain('Cost of Goods Sold,0.00');
        expect(fsContent).toContain('Salaries Expense,50.00');
        expect(fsContent).toContain('Rent Expense,0.00');
        expect(fsContent).toContain('Utilities Expense,0.00');
        expect(fsContent).toContain('Interest Expense,0.00');
        expect(fsContent).toContain('Tax Expense,0.00');
        expect(fsContent).toContain('Net Income,50.00');

        // Balance sheet
        expect(fsContent).toContain('Balance Sheet');
        //--Assets
        expect(fsContent).toContain('Assets');
        expect(fsContent).toContain('Cash,100.00');
        expect(fsContent).toContain('Accounts Receivable,100.00');
        expect(fsContent).toContain('Inventory,0.00');
        expect(fsContent).toContain('Fixed Assets,0.00');
        expect(fsContent).toContain('Prepaid Expenses,0.00');
        expect(fsContent).toContain('Total Assets,200.00');

        //--Liability
        expect(fsContent).toContain('Liabilities');
        expect(fsContent).toContain('Accounts Payable,200.00');
        expect(fsContent).toContain('Loan Payable,0.00');
        expect(fsContent).toContain('Sales Tax Payable,0.00');
        expect(fsContent).toContain('Accrued Liabilities,0.00');
        expect(fsContent).toContain('Unearned Revenue,0.00');
        expect(fsContent).toContain('Dividends Payable,0.00');
        expect(fsContent).toContain('Total Liabilities,200.00');

        // Equity
        expect(fsContent).toContain('Equity');
        expect(fsContent).toContain('Common Stock,100.00');
        expect(fsContent).toContain('Retained Earnings,100.00');
        expect(fsContent).toContain('Retained Earnings (Net Income),50.00');
        expect(fsContent).toContain('Total Equity,250.00');
        expect(fsContent).toContain(
          'Assets = Liabilities + Equity, 200.00 = 450.00',
        );
      });
    });
  });
});
