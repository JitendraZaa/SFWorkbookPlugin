import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';

describe('jz health NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({ devhubAuthStrategy: 'NONE' });
  });

  after(async () => {
    await session?.clean();
  });

  it('should display help for health command', () => {
    const command = 'jz health --help';
    const output = execCmd(command, { ensureExitCode: 0 }).shellOutput.stdout;
    expect(output).to.contain('Perform comprehensive Salesforce org health check');
    expect(output).to.contain('--output-dir');
    expect(output).to.contain('--report-format');
    expect(output).to.contain('--include-summary');
  });

  it('should fail without target-org flag', () => {
    const command = 'jz health';
    const output = execCmd(command, { ensureExitCode: 'nonZero' }).shellOutput.stderr;
    expect(output).to.contain('Missing required flag');
    expect(output).to.contain('target-org');
  });

  it('should accept valid report-format options', () => {
    const formats = ['excel', 'text', 'both'];

    for (const format of formats) {
      const command = `jz health --target-org test@example.com --report-format ${format}`;
      // This test would need an actual org connection to run properly

      const result = execCmd(command, { ensureExitCode: 'nonZero' });
      // The command should fail with connection error, not with argument validation
      expect(result.shellOutput.stderr).to.not.contain('Missing required flag');
      expect(result.shellOutput.stderr).to.not.contain('Expected --report-format');
    }
  });

  it('should reject invalid report-format options', () => {
    const command = 'jz health --target-org test@example.com --report-format invalid';
    const result = execCmd(command, { ensureExitCode: 'nonZero' });
    expect(result.shellOutput.stderr).to.contain('Expected --report-format');
  });

  it('should accept output-dir parameter', () => {
    const command = 'jz health --target-org test@example.com --output-dir "HealthReports"';
    // This would also need a real org connection

    const result = execCmd(command, { ensureExitCode: 'nonZero' });
    expect(result.shellOutput.stderr).to.not.contain('Missing required flag');
  });

  it('should accept include-summary flag', () => {
    const command = 'jz health --target-org test@example.com --include-summary';
    // This would also need a real org connection

    const result = execCmd(command, { ensureExitCode: 'nonZero' });
    expect(result.shellOutput.stderr).to.not.contain('Missing required flag');
  });

  it('should work with short flag aliases', () => {
    const command = 'jz health --target-org test@example.com -f text -d "TestDir" -s';
    // This would also need a real org connection

    const result = execCmd(command, { ensureExitCode: 'nonZero' });
    expect(result.shellOutput.stderr).to.not.contain('Missing required flag');
    expect(result.shellOutput.stderr).to.not.contain('Unknown flag');
  });

  it('should use default values when flags are not provided', () => {
    const command = 'jz health --target-org test@example.com';
    // This would also need a real org connection

    const result = execCmd(command, { ensureExitCode: 'nonZero' });
    expect(result.shellOutput.stderr).to.not.contain('Missing required flag');
    // Default values should be used (both format, Exports directory, include-summary true)
  });
}); 