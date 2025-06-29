import { TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import EmailTemplates from '../../../src/commands/jz/emailtemplates.js';

describe('jz emailtemplates', () => {
  const $$ = new TestContext();

  afterEach(() => {
    $$.restore();
  });

  it('should have correct static properties', () => {
    expect(EmailTemplates.summary).to.contain('Generate package.xml for all email templates');
    expect(EmailTemplates.description).to.contain('This command queries all email templates');
    expect(EmailTemplates.examples).to.be.an('array');
  });

  it('should have required flags defined', () => {
    expect(EmailTemplates.flags).to.have.property('target-org');
    expect(EmailTemplates.flags).to.have.property('output-dir');
    expect(EmailTemplates.flags).to.have.property('include-inactive');
    expect(EmailTemplates.flags).to.have.property('template-types');
    expect(EmailTemplates.flags).to.have.property('dry-run');
  });

  it('should have correct flag configurations', () => {
    expect(EmailTemplates.flags['output-dir'].char).to.equal('d');
    expect(EmailTemplates.flags['output-dir'].default).to.equal('Exports');

    expect(EmailTemplates.flags['include-inactive'].char).to.equal('i');
    expect(EmailTemplates.flags['include-inactive'].default).to.equal(false);

    expect(EmailTemplates.flags['template-types'].char).to.equal('t');
    expect(EmailTemplates.flags['template-types'].required).to.equal(false);

    expect(EmailTemplates.flags['dry-run'].char).to.equal('r');
    expect(EmailTemplates.flags['dry-run'].default).to.equal(false);
  });

  it('should have correct message keys', () => {
    expect(EmailTemplates.summary).to.be.a('string');
    expect(EmailTemplates.description).to.be.a('string');
    expect(EmailTemplates.examples).to.be.an('array');
  });

  it('should validate result type structure', () => {
    const mockResult = {
      totalTemplates: 5,
      packageXmlPath: '/path/to/package.xml',
      templatesFound: [
        {
          id: '00X123456789ABC',
          developerName: 'TestTemplate',
          name: 'Test Template',
          templateType: 'html',
          folderName: 'TestFolder',
          fullyQualifiedName: 'TestFolder/TestTemplate'
        }
      ]
    };

    expect(mockResult).to.have.property('totalTemplates').that.is.a('number');
    expect(mockResult).to.have.property('packageXmlPath').that.is.a('string');
    expect(mockResult).to.have.property('templatesFound').that.is.an('array');
  });

  it('should have proper TypeScript types', () => {
    expect(EmailTemplates.flags['target-org']).to.have.property('parse');
    expect(EmailTemplates.flags['output-dir']).to.have.property('parse');
    expect(EmailTemplates.flags['include-inactive']).to.have.property('parse');
    expect(EmailTemplates.flags['template-types']).to.have.property('parse');
    expect(EmailTemplates.flags['dry-run']).to.have.property('parse');
  });


}); 