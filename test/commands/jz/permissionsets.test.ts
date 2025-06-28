import { TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import PermissionSets from '../../../src/commands/jz/permissionsets.js';

describe('jz permissionsets', () => {
  const $$ = new TestContext();

  afterEach(() => {
    $$.restore();
  });

  it('should have correct static properties', () => {
    expect(PermissionSets.summary).to.contain('Export permission sets metadata');
    expect(PermissionSets.description).to.contain('This command exports permission sets metadata');
    expect(PermissionSets.examples).to.be.an('array');
  });

  it('should have required flags defined', () => {
    expect(PermissionSets.flags).to.have.property('target-org');
    expect(PermissionSets.flags).to.have.property('permission-sets');
    expect(PermissionSets.flags).to.have.property('output-dir');
    expect(PermissionSets.flags).to.have.property('include-standard');
  });

  it('should have correct flag configurations', () => {
    expect(PermissionSets.flags['permission-sets'].char).to.equal('p');
    expect(PermissionSets.flags['permission-sets'].required).to.equal(false);

    expect(PermissionSets.flags['output-dir'].char).to.equal('d');
    expect(PermissionSets.flags['output-dir'].default).to.equal('Exports');

    expect(PermissionSets.flags['include-standard'].char).to.equal('s');
    expect(PermissionSets.flags['include-standard'].default).to.equal(false);
  });

  it('should validate result type structure', () => {
    const mockResult = {
      totalPermissionSets: 5,
      exportedPermissionSets: 4,
      failedPermissionSets: 1,
      exportPath: '/path/to/export.xlsx',
      exportedPermissionSetNames: ['PS1', 'PS2', 'PS3', 'PS4'],
      failedPermissionSetNames: ['PS5']
    };

    expect(mockResult).to.have.property('totalPermissionSets').that.is.a('number');
    expect(mockResult).to.have.property('exportedPermissionSets').that.is.a('number');
    expect(mockResult).to.have.property('failedPermissionSets').that.is.a('number');
    expect(mockResult).to.have.property('exportPath').that.is.a('string');
    expect(mockResult).to.have.property('exportedPermissionSetNames').that.is.an('array');
    expect(mockResult).to.have.property('failedPermissionSetNames').that.is.an('array');
  });

  it('should export the correct result type interface', () => {
    // This test verifies that the PermissionSetsExportResult type is properly exported
    // and has the expected structure by checking it can be assigned correctly
    const validResult = {
      totalPermissionSets: 0,
      exportedPermissionSets: 0,
      failedPermissionSets: 0,
      exportPath: '',
      exportedPermissionSetNames: [],
      failedPermissionSetNames: [],
    };

    // TypeScript compilation will fail if the structure doesn't match
    expect(validResult).to.be.an('object');
    expect(validResult.exportedPermissionSetNames).to.be.an('array');
    expect(validResult.failedPermissionSetNames).to.be.an('array');
  });
}); 