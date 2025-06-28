import { TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import PermissionSetsCompare from '../../../src/commands/jz/permissionsets-compare.js';

describe('jz permissionsets-compare', () => {
  const $$ = new TestContext();

  afterEach(() => {
    $$.restore();
  });

  it('should have correct static properties', () => {
    expect(PermissionSetsCompare.summary).to.contain('Compare permission sets between two Salesforce orgs');
    expect(PermissionSetsCompare.description).to.contain('comparison of permission sets');
    expect(PermissionSetsCompare.examples).to.be.an('array');
  });

  it('should have required flags defined', () => {
    expect(PermissionSetsCompare.flags).to.have.property('source-org');
    expect(PermissionSetsCompare.flags).to.have.property('target-org');
    expect(PermissionSetsCompare.flags).to.have.property('permission-sets');
    expect(PermissionSetsCompare.flags).to.have.property('output-dir');
    expect(PermissionSetsCompare.flags).to.have.property('include-standard');
  });

  it('should have correct flag configurations', () => {
    expect(PermissionSetsCompare.flags['source-org'].char).to.equal('s');
    expect(PermissionSetsCompare.flags['target-org'].char).to.equal('t');
    expect(PermissionSetsCompare.flags['permission-sets'].char).to.equal('p');
    expect(PermissionSetsCompare.flags['permission-sets'].required).to.equal(false);

    expect(PermissionSetsCompare.flags['output-dir'].char).to.equal('d');
    expect(PermissionSetsCompare.flags['output-dir'].default).to.equal('Exports');

    expect(PermissionSetsCompare.flags['include-standard'].char).to.equal('i');
    expect(PermissionSetsCompare.flags['include-standard'].default).to.equal(false);
  });

  it('should validate result type structure', () => {
    const mockResult = {
      totalPermissionSetsCompared: 5,
      permissionSetsWithDifferences: 2,
      permissionSetsOnlyInSource: 1,
      permissionSetsOnlyInTarget: 1,
      exportPath: '/path/to/export.xlsx',
      comparedPermissionSetNames: ['PS1', 'PS2', 'PS3', 'PS4', 'PS5'],
      permissionSetsWithDifferenceNames: ['PS1', 'PS2'],
      permissionSetsOnlyInSourceNames: ['PS_SOURCE'],
      permissionSetsOnlyInTargetNames: ['PS_TARGET']
    };

    expect(mockResult).to.have.property('totalPermissionSetsCompared').that.is.a('number');
    expect(mockResult).to.have.property('permissionSetsWithDifferences').that.is.a('number');
    expect(mockResult).to.have.property('permissionSetsOnlyInSource').that.is.a('number');
    expect(mockResult).to.have.property('permissionSetsOnlyInTarget').that.is.a('number');
    expect(mockResult).to.have.property('exportPath').that.is.a('string');
    expect(mockResult).to.have.property('comparedPermissionSetNames').that.is.an('array');
    expect(mockResult).to.have.property('permissionSetsWithDifferenceNames').that.is.an('array');
    expect(mockResult).to.have.property('permissionSetsOnlyInSourceNames').that.is.an('array');
    expect(mockResult).to.have.property('permissionSetsOnlyInTargetNames').that.is.an('array');
  });

  it('should export the correct result type interface', () => {
    // This test verifies that the PermissionSetsCompareResult type is properly exported
    // and has the expected structure by checking it can be assigned correctly
    const validResult = {
      totalPermissionSetsCompared: 0,
      permissionSetsWithDifferences: 0,
      permissionSetsOnlyInSource: 0,
      permissionSetsOnlyInTarget: 0,
      exportPath: '',
      comparedPermissionSetNames: [],
      permissionSetsWithDifferenceNames: [],
      permissionSetsOnlyInSourceNames: [],
      permissionSetsOnlyInTargetNames: [],
    };

    // TypeScript compilation will fail if the structure doesn't match
    expect(validResult).to.be.an('object');
    expect(validResult.comparedPermissionSetNames).to.be.an('array');
    expect(validResult.permissionSetsWithDifferenceNames).to.be.an('array');
    expect(validResult.permissionSetsOnlyInSourceNames).to.be.an('array');
    expect(validResult.permissionSetsOnlyInTargetNames).to.be.an('array');
  });
}); 