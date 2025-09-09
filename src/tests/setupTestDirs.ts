import { promises as fs } from 'fs';
import * as path from 'path';

export async function setupTestDirs() {
  const tmpDir = path.join(__dirname, '../../test-output/tmp');
  const outDir = path.join(__dirname, '../../test-output/out');
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(tmpDir, { recursive: true });
  await fs.mkdir(outDir, { recursive: true });
  return { tmpDir, outDir };
}
