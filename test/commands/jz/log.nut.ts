import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';

describe('jz log NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({ devhubAuthStrategy: 'NONE' });
  });

  after(async () => {
    await session?.clean();
  });

  it('should export debug logs when target org is provided', () => {
    const command = 'jz log --target-org test-org';
    const output = execCmd(command, { ensureExitCode: 0 }).shellOutput.stdout;
    expect(output).to.contain('Fetching debug logs');
  });

  it('should handle missing target org parameter', () => {
    const command = 'jz log';
    const result = execCmd(command, { ensureExitCode: 1 });
    expect(result.shellOutput.stderr).to.contain('Missing required flag');
  });
}); 