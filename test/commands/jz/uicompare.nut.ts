import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';

describe('jz uicompare NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({ devhubAuthStrategy: 'NONE' });
  });

  after(async () => {
    await session?.clean();
  });

  it('should display help for uicompare command', () => {
    const command = 'jz uicompare --help';
    const output = execCmd(command, { ensureExitCode: 0 }).shellOutput.stdout;
    expect(output).to.contain('Automate Salesforce UI to extract Lead record data');
    expect(output).to.contain('--output-dir');
    expect(output).to.contain('--wait-time');
    expect(output).to.contain('--dry-run');
    expect(output).to.contain('--headless');
  });

  it('should fail without target-org flag', () => {
    const command = 'jz uicompare';
    const output = execCmd(command, { ensureExitCode: 'nonZero' }).shellOutput.stderr;
    expect(output).to.contain('Missing required flag');
    expect(output).to.contain('target-org');
  });

  it('should accept valid wait-time values', () => {
    const validWaitTimes = [5, 10, 30, 60];

    for (const waitTime of validWaitTimes) {
      const command = `jz uicompare --target-org test@example.com --wait-time ${waitTime}`;
      // This test would need an actual org connection to run properly

      const result = execCmd(command, { ensureExitCode: 'nonZero' });
      // The command should fail with connection error, not with argument validation
      expect(result.shellOutput.stderr).to.not.contain('Missing required flag');
      expect(result.shellOutput.stderr).to.not.contain('Expected --wait-time');
    }
  });

  it('should reject invalid wait-time values', () => {
    const invalidWaitTimes = [4, 61, -1, 0];

    for (const waitTime of invalidWaitTimes) {
      const command = `jz uicompare --target-org test@example.com --wait-time ${waitTime}`;
      const result = execCmd(command, { ensureExitCode: 'nonZero' });
      expect(result.shellOutput.stderr).to.contain('--wait-time');
    }
  });

  it('should accept output-dir parameter', () => {
    const command = 'jz uicompare --target-org test@example.com --output-dir "UICompareExports"';
    // This would also need a real org connection

    const result = execCmd(command, { ensureExitCode: 'nonZero' });
    expect(result.shellOutput.stderr).to.not.contain('Missing required flag');
  });

  it('should accept dry-run flag', () => {
    const command = 'jz uicompare --target-org test@example.com --dry-run';
    // This would also need a real org connection

    const result = execCmd(command, { ensureExitCode: 'nonZero' });
    expect(result.shellOutput.stderr).to.not.contain('Missing required flag');
  });

  it('should accept headless flag', () => {
    const command = 'jz uicompare --target-org test@example.com --headless';
    // This would also need a real org connection

    const result = execCmd(command, { ensureExitCode: 'nonZero' });
    expect(result.shellOutput.stderr).to.not.contain('Missing required flag');
  });

  it('should work with short flag aliases', () => {
    const command = 'jz uicompare --target-org test@example.com -w 15 -d "TestDir" -r -e';
    // This would also need a real org connection

    const result = execCmd(command, { ensureExitCode: 'nonZero' });
    expect(result.shellOutput.stderr).to.not.contain('Missing required flag');
    expect(result.shellOutput.stderr).to.not.contain('Unknown flag');
  });

  it('should use default values when flags are not provided', () => {
    const command = 'jz uicompare --target-org test@example.com';
    // This would also need a real org connection

    const result = execCmd(command, { ensureExitCode: 'nonZero' });
    expect(result.shellOutput.stderr).to.not.contain('Missing required flag');
    // Default values should be used (10 seconds wait, Exports directory, no dry-run, no headless)
  });

  it('should accept combination of all flags', () => {
    const command = 'jz uicompare --target-org test@example.com --wait-time 20 --output-dir "CustomDir" --dry-run --headless';
    // This would also need a real org connection

    const result = execCmd(command, { ensureExitCode: 'nonZero' });
    expect(result.shellOutput.stderr).to.not.contain('Missing required flag');
    expect(result.shellOutput.stderr).to.not.contain('Unknown flag');
  });

  it('should validate wait-time boundary values', () => {
    // Test minimum boundary
    const minCommand = 'jz uicompare --target-org test@example.com --wait-time 5';
    const minResult = execCmd(minCommand, { ensureExitCode: 'nonZero' });
    expect(minResult.shellOutput.stderr).to.not.contain('Expected --wait-time');

    // Test maximum boundary
    const maxCommand = 'jz uicompare --target-org test@example.com --wait-time 60';
    const maxResult = execCmd(maxCommand, { ensureExitCode: 'nonZero' });
    expect(maxResult.shellOutput.stderr).to.not.contain('Expected --wait-time');
  });
}); 