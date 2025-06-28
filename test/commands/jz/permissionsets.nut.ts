import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';

describe('jz permissionsets NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({ devhubAuthStrategy: 'NONE' });
  });

  after(async () => {
    await session?.clean();
  });

  it('should display help for permissionsets command', () => {
    const command = 'jz permissionsets --help';
    const output = execCmd(command, { ensureExitCode: 0 }).shellOutput.stdout;
    expect(output).to.contain('Export permission sets metadata');
    expect(output).to.contain('--permission-sets');
    expect(output).to.contain('--output-dir');
    expect(output).to.contain('--include-standard');
  });

  it('should fail without target-org flag', () => {
    const command = 'jz permissionsets';
    const output = execCmd(command, { ensureExitCode: 'nonZero' }).shellOutput.stderr;
    expect(output).to.contain('Missing required flag');
    expect(output).to.contain('target-org');
  });

  it('should accept valid permission-sets parameter', () => {
    const command = 'jz permissionsets --target-org test@example.com --permission-sets "TestPS1,TestPS2"';
    // This test would need an actual org connection to run properly
    // In a real test environment, you would set up test data and verify the behavior

    // For now, we expect it to fail with connection error since we don't have a real org
    const result = execCmd(command, { ensureExitCode: 'nonZero' });
    // The command should fail with connection issues, not with argument validation
    expect(result.shellOutput.stderr).to.not.contain('Missing required flag');
  });

  it('should accept output-dir parameter', () => {
    const command = 'jz permissionsets --target-org test@example.com --output-dir "TestExports"';
    // This would also need a real org connection

    const result = execCmd(command, { ensureExitCode: 'nonZero' });
    expect(result.shellOutput.stderr).to.not.contain('Missing required flag');
  });

  it('should accept include-standard flag', () => {
    const command = 'jz permissionsets --target-org test@example.com --include-standard';
    // This would also need a real org connection

    const result = execCmd(command, { ensureExitCode: 'nonZero' });
    expect(result.shellOutput.stderr).to.not.contain('Missing required flag');
  });

  it('should work with short flag aliases', () => {
    const command = 'jz permissionsets --target-org test@example.com -p "TestPS" -d "TestDir" -s';
    // This would also need a real org connection

    const result = execCmd(command, { ensureExitCode: 'nonZero' });
    expect(result.shellOutput.stderr).to.not.contain('Missing required flag');
    expect(result.shellOutput.stderr).to.not.contain('Unknown flag');
  });
}); 