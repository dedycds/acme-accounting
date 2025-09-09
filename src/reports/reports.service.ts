import { Injectable, Logger, Inject } from '@nestjs/common';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';
import { REPORTS_CONFIG, ReportsConfig } from './reports.config';
import async from 'async';

/**
 * ReportsService generates accounting reports from CSV journals found in the tmp directory.
 *
 * It produces three outputs in the out directory:
 * - accounts.csv: per-account running balances
 * - yearly.csv: yearly cash movement summary
 * - fs.csv: a basic financial statement (Income Statement and Balance Sheet)
 */
@Injectable()
export class ReportsService {
  /**
   * Create a ReportsService.
   * @param config runtime configuration with input/output directories
   */
  constructor(@Inject(REPORTS_CONFIG) private config: ReportsConfig) {}

  /**
   * Tracks progress for each report type. Values are one of: 'idle' | 'starting' | 'error' | `finished in X.XX`.
   */
  private states = {
    accounts: 'idle',
    yearly: 'idle',
    fs: 'idle',
  };

  private readonly logger = new Logger(ReportsService.name);

  /**
   * Return the current state string for a specific report scope.
   */
  state(scope: string) {
    return this.states[scope];
  }

  /**
   * Generate all reports by scanning CSV files in the tmp directory and aggregating data.
   *
   * This method:
   * 1) Parses all CSV files to build account balances and yearly cash activity
   * 2) Writes three output files (accounts, yearly, fs) to the out directory
   */
  async generate() {
    this.states.accounts = 'starting';
    this.states.fs = 'starting';
    this.states.yearly = 'starting';
    const tmpDir = this.config.tmpDir;
    const start = performance.now();

    // Aggregation containers used by multiple reports
    const balances: Record<string, number> = {};
    const cashByYear: Record<string, number> = {};

    // Iterate through all CSV files in the tmp directory and aggregate metrics
    try {
      const files = await fs.readdir(tmpDir, { withFileTypes: true });

      await async.mapLimit(files, 10, async (file) => {
        if (file.isFile() && file.name.endsWith('.csv')) {
          const filePath = path.join(tmpDir, file.name);
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.trim().split('\n');

          for (const line of lines) {
            const [date, account, , debit, credit] = line.split(',');
            // Update per-account running balance
            if (!balances[account]) {
              balances[account] = 0;
            }
            const debitAmount = parseFloat(debit || '0');
            const creditAmount = parseFloat(credit || '0');
            balances[account] += debitAmount - creditAmount;

            if (account === 'Cash') {
              const year = new Date(date).getFullYear();
              if (!cashByYear[year]) {
                cashByYear[year] = 0;
              }
              cashByYear[year] += debitAmount - creditAmount;
            }
          }
        }
      });
    } catch (error) {
      this.states.accounts = 'error';
      this.states.fs = 'error';
      this.states.yearly = 'error';
      this.logger.error('Error in reports processing:', error);
      throw error;
    }

    // Write each report concurrently once the data is aggregated
    await Promise.all([
      this.writeAccounts(balances, start),
      this.writeYearly(cashByYear, start),
      this.writeFs(balances, start),
    ]);
  }

  /**
   * Write per-account balances to accounts.csv.
   */
  private async writeAccounts(
    accountBalances: Record<string, number>,
    start: number,
  ) {
    const outputFile = path.join(this.config.outDir, 'accounts.csv');

    try {
      const output = ['Account,Balance'];
      for (const [account, balance] of Object.entries(accountBalances)) {
        output.push(`${account},${balance.toFixed(2)}`);
      }

      await fs.writeFile(outputFile, output.join('\n'));
      this.states.accounts = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
    } catch (error) {
      this.states.accounts = 'error';
      this.logger.error('Error in accounts processing:', error);
      throw error;
    }
  }

  /**
   * Write yearly cash movement summary to yearly.csv.
   */
  private async writeYearly(cashByYear: Record<string, number>, start: number) {
    const outputFile = path.join(this.config.outDir, 'yearly.csv');

    try {
      const output = ['Financial Year,Cash Balance'];
      Object.keys(cashByYear)
        .sort()
        .forEach((year) => {
          output.push(`${year},${cashByYear[year].toFixed(2)}`);
        });

      await fs.writeFile(outputFile, output.join('\n'));
      this.states.yearly = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
    } catch (error) {
      this.states.yearly = 'error';
      this.logger.error('Error in yearly processing:', error);
      throw error;
    }
  }

  /**
   * Compose and write a basic financial statement to fs.csv.
   * Includes an Income Statement and Balance Sheet derived from account balances.
   */
  private async writeFs(balances: Record<string, number>, start: number) {
    const outputFile = path.join(this.config.outDir, 'fs.csv');
    // Mapping of report sections to underlying account names
    const categories = {
      'Income Statement': {
        Revenues: ['Sales Revenue'],
        Expenses: [
          'Cost of Goods Sold',
          'Salaries Expense',
          'Rent Expense',
          'Utilities Expense',
          'Interest Expense',
          'Tax Expense',
        ],
      },
      'Balance Sheet': {
        Assets: [
          'Cash',
          'Accounts Receivable',
          'Inventory',
          'Fixed Assets',
          'Prepaid Expenses',
        ],
        Liabilities: [
          'Accounts Payable',
          'Loan Payable',
          'Sales Tax Payable',
          'Accrued Liabilities',
          'Unearned Revenue',
          'Dividends Payable',
        ],
        Equity: ['Common Stock', 'Retained Earnings'],
      },
    };

    const output: string[] = [];
    output.push('Basic Financial Statement');
    output.push('');
    output.push('Income Statement');
    let totalRevenue = 0;
    let totalExpenses = 0;
    for (const account of categories['Income Statement']['Revenues']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalRevenue += value;
    }
    for (const account of categories['Income Statement']['Expenses']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalExpenses += value;
    }
    output.push(`Net Income,${(totalRevenue - totalExpenses).toFixed(2)}`);
    output.push('');
    output.push('Balance Sheet');
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    output.push('Assets');
    for (const account of categories['Balance Sheet']['Assets']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalAssets += value;
    }
    output.push(`Total Assets,${totalAssets.toFixed(2)}`);
    output.push('');
    output.push('Liabilities');
    for (const account of categories['Balance Sheet']['Liabilities']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalLiabilities += value;
    }
    output.push(`Total Liabilities,${totalLiabilities.toFixed(2)}`);
    output.push('');
    output.push('Equity');
    for (const account of categories['Balance Sheet']['Equity']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalEquity += value;
    }
    output.push(
      `Retained Earnings (Net Income),${(totalRevenue - totalExpenses).toFixed(2)}`,
    );
    totalEquity += totalRevenue - totalExpenses;
    output.push(`Total Equity,${totalEquity.toFixed(2)}`);
    output.push('');
    output.push(
      `Assets = Liabilities + Equity, ${totalAssets.toFixed(2)} = ${(totalLiabilities + totalEquity).toFixed(2)}`,
    );

    try {
      await fs.writeFile(outputFile, output.join('\n'));
      this.states.fs = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
    } catch (error) {
      this.states.fs = 'error';
      this.logger.error('Error writing fs output:', error);
      throw error;
    }
  }
}
