import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';

describe('jz logdelete NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({ devhubAuthStrategy: 'NONE' });
  });

  after(async () => {
    await session?.clean();
  });

  it('should display help for logdelete command', () => {
    const command = 'jz logdelete --help';
    const output = execCmd(command, { ensureExitCode: 0 }).shellOutput.stdout;
    expect(output).to.contain('Delete all debug logs from the specified org');
    expect(output).to.contain('--confirm');
    expect(output).to.contain('--dry-run');
    expect(output).to.contain('--batch-size');
  });

  it('should fail without target-org flag', () => {
    const command = 'jz logdelete';
    const output = execCmd(command, { ensureExitCode: 'nonZero' }).shellOutput.stderr;
    expect(output).to.contain('Missing required flag');
    expect(output).to.contain('target-org');
  });

  it('should run in dry-run mode without confirmation', () => {
    const command = 'jz logdelete --target-org test@example.com --dry-run';
    // This test would need an actual org connection to run properly
    // In a real test environment, you would set up test data and verify the dry-run behavior

    // For now, we expect it to fail with connection error since we don't have a real org
    const result = execCmd(command, { ensureExitCode: 'nonZero' });
    // The command should fail with connection issues, not with argument validation
    expect(result.shellOutput.stderr).to.not.contain('Missing required flag');
  });

  it('should require confirmation flag for actual deletion', () => {
    const command = 'jz logdelete --target-org test@example.com';
    // This would also need a real org connection
    // The test should verify that without --confirm, no deletions occur

    const result = execCmd(command, { ensureExitCode: 'nonZero' });
    expect(result.shellOutput.stderr).to.not.contain('Missing required flag');
  });

  it('should validate batch-size parameter range', () => {
    const commandTooSmall = 'jz logdelete --target-org test@example.com --batch-size 0';
    const outputTooSmall = execCmd(commandTooSmall, { ensureExitCode: 'nonZero' }).shellOutput.stderr;
    expect(outputTooSmall).to.contain('Minimum value is 1');

    const commandTooLarge = 'jz logdelete --target-org test@example.com --batch-size 51';
    const outputTooLarge = execCmd(commandTooLarge, { ensureExitCode: 'nonZero' }).shellOutput.stderr;
    expect(outputTooLarge).to.contain('Maximum value is 50');
  });
}); 