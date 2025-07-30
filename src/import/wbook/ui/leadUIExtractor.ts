/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable arrow-body-style */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable @typescript-eslint/return-await */
/* eslint-disable class-methods-use-this */

import { execSync } from 'node:child_process';
import puppeteer, { Browser, Page } from 'puppeteer';

export type FieldData = {
  fieldName: string;
  fieldValue: string;
};

export type SectionData = {
  sectionName: string;
  fields: FieldData[];
};

export type LeadRecordData = {
  recordId: string;
  recordUrl: string;
  capturedAt: string;
  sections: SectionData[];
};

export type ExtractorOptions = {
  waitTime?: number;
  headless?: boolean;
  timeout?: number;
};

type LeadRecord = {
  Id: string;
  Name: string;
};

export class LeadUIExtractor {
  private orgAlias: string;
  private connection: unknown;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private options: Required<ExtractorOptions>;

  public constructor(orgAlias: string, connection: unknown, options: ExtractorOptions = {}) {
    this.orgAlias = orgAlias;
    this.connection = connection;
    this.options = {
      waitTime: options.waitTime ?? 10,
      headless: options.headless ?? false,
      timeout: options.timeout ?? 300_000, // 5 minutes
    };
  }

  public async extractFirstLeadRecord(): Promise<LeadRecordData> {
    try {
      console.log(`🚀 Starting Lead UI extraction for org: ${this.orgAlias}`);

      // Query for first lead record using SOQL
      const leadRecord = await this.queryFirstLeadRecord();
      console.log(`🔍 Found lead record: ${leadRecord.Name} (${leadRecord.Id})`);

      // Get login URL
      const loginUrl = await this.getLoginUrl();
      console.log(`🔗 Got login URL: ${loginUrl}`);

      // Initialize browser
      await this.initializeBrowser();
      console.log('🌐 Browser initialized successfully');

      // Navigate to Salesforce and login
      await this.navigateToSalesforce(loginUrl);
      console.log('🔐 Logged into Salesforce');

      // Navigate directly to the lead record
      const leadRecordUrl = await this.navigateToLeadRecord(leadRecord.Id);
      console.log(`📄 Navigated to lead record: ${leadRecordUrl}`);

      // Wait for page to load (as specified)
      console.log(`⏱️  Waiting ${this.options.waitTime} seconds for page to load...`);
      await this.sleep(this.options.waitTime * 1000);

      // Extract record data
      const recordData = await this.extractRecordData(leadRecordUrl);
      console.log(`✅ Extracted data: ${recordData.sections.length} sections`);

      return recordData;
    } catch (error) {
      console.error('❌ Error during Lead UI extraction:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async queryFirstLeadRecord(): Promise<LeadRecord> {
    try {
      console.log('🔍 Querying for first Lead record...');
      const query = 'SELECT Id, Name FROM Lead ORDER BY CreatedDate DESC LIMIT 1';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (this.connection as any).query(query);

      if (!result.records || result.records.length === 0) {
        throw new Error('No Lead records found in the org. Please create at least one Lead record.');
      }

      return result.records[0] as LeadRecord;
    } catch (error) {
      throw new Error(`Failed to query Lead records: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getLoginUrl(): Promise<string> {
    try {
      const command = `sf org open --target-org ${this.orgAlias} --url-only --json`;
      const result = execSync(command, { encoding: 'utf-8', timeout: 30000 });
      const jsonResult = JSON.parse(result);

      if (jsonResult?.status === 0 && jsonResult?.result?.url) {
        return jsonResult.result.url;
      } else {
        throw new Error(`Failed to get login URL: ${result}`);
      }
    } catch (error) {
      throw new Error(`Failed to get login URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async initializeBrowser(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: this.options.headless,
      defaultViewport: { width: 1920, height: 1080 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-notifications',
        '--disable-popup-blocking',
        '--disable-geolocation',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-web-security',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-features=VizDisplayCompositor',
        '--disable-site-isolation-trials',
        '--disable-features=BlockInsecurePrivateNetworkRequests',
        '--disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure',
        '--allow-running-insecure-content',
        '--disable-same-site-by-default-cookies',
        '--disable-cookies-without-same-site-must-be-secure',
      ],
    });

    this.page = await this.browser.newPage();

    // Set user agent
    await this.page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set longer timeout for page operations
    this.page.setDefaultTimeout(this.options.timeout);
  }

  private async navigateToSalesforce(loginUrl: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser page not initialized');
    }

    await this.page.goto(loginUrl, { waitUntil: 'networkidle2' });

    // Wait for Salesforce to load completely
    await this.waitForSalesforceLoad();
  }

  private async waitForSalesforceLoad(): Promise<void> {
    if (!this.page) {
      throw new Error('Browser page not initialized');
    }

    // Wait for either Lightning or Classic UI to load
    await this.page.waitForFunction(
      () => {
        return (
          // Lightning UI indicators
          document.querySelector('.slds-scope') ||
          document.querySelector('[data-aura-rendered-by]') ||
          document.querySelector('.oneHeader') ||
          // Classic UI indicators
          document.querySelector('#AppBodyHeader') ||
          document.querySelector('.bPageTitle') ||
          document.querySelector('.individualPalette')
        );
      },
      { timeout: 60_000 }
    );

    console.log('🏠 Salesforce UI loaded successfully');
  }

  private async navigateToLeadRecord(leadId: string): Promise<string> {
    if (!this.page) {
      throw new Error('Browser page not initialized');
    }

    // Extract the base Salesforce instance URL properly
    const currentUrl = this.page.url();
    console.log(`🔍 Current URL: ${currentUrl}`);

    // Extract base URL from various Salesforce URL formats
    let baseUrl: string;
    if (currentUrl.includes('.lightning.force.com')) {
      baseUrl = currentUrl.split('.lightning.force.com')[0] + '.lightning.force.com';
    } else if (currentUrl.includes('.my.salesforce.com')) {
      baseUrl = currentUrl.split('.my.salesforce.com')[0] + '.my.salesforce.com';
    } else {
      // Fallback: try to extract domain
      const urlObj = new URL(currentUrl);
      baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
    }

    console.log(`🔗 Base URL extracted: ${baseUrl}`);

    // Try Lightning URL first, then fallback to Classic if needed
    const lightningUrl = `${baseUrl}/lightning/r/Lead/${leadId}/view`;
    console.log(`🎯 Attempting Lightning URL: ${lightningUrl}`);

    try {
      await this.page.goto(lightningUrl, { waitUntil: 'networkidle2' });
      console.log('📄 Successfully navigated to Lead record in Lightning');

      // Wait for the record page to fully load with multiple strategies
      console.log('⏳ Waiting for Lightning record content to load...');

      try {
        // Wait for any of these indicators that the record is loaded
        await Promise.race([
          this.page.waitForSelector('lightning-output-field', { timeout: 30_000 }),
          this.page.waitForSelector('.record-header', { timeout: 30_000 }),
          this.page.waitForSelector('.slds-page-header', { timeout: 30_000 }),
          this.page.waitForSelector('.forceRecordLayout', { timeout: 30_000 }),
          this.page.waitForSelector('[data-target-selection-name="sfdc:RecordField"]', { timeout: 30_000 })
        ]);
        console.log('✅ Lightning record content loaded successfully');

        // Additional wait for any dynamic content to settle
        await this.sleep(5000);

      } catch (error) {
        console.log('⚠️ Timeout waiting for record content, proceeding anyway...');
      }

      return this.page.url();
    } catch (error) {
      // Fallback to Classic URL
      console.log('⚠️ Lightning navigation failed, trying Classic URL...');
      const classicUrl = `${baseUrl}/${leadId}`;
      console.log(`🎯 Attempting Classic URL: ${classicUrl}`);

      await this.page.goto(classicUrl, { waitUntil: 'networkidle2' });
      console.log('📄 Successfully navigated to Lead record in Classic');

      // Wait for the record page to fully load
      await this.page.waitForSelector('.bPageTitle, .pbHeader', { timeout: 30_000 });

      return this.page.url();
    }
  }



  private async extractRecordData(recordUrl: string): Promise<LeadRecordData> {
    if (!this.page) {
      throw new Error('Browser page not initialized');
    }

    // Extract record ID from URL
    const recordIdMatch = recordUrl.match(/\/([0-9a-zA-Z]{15,18})/);
    const recordId = recordIdMatch ? recordIdMatch[1] : 'UNKNOWN';

    console.log(`🔍 Extracting data for record ID: ${recordId}`);

    // Check if we're in Lightning or Classic
    const isLightning = await this.page.evaluate(() => {
      return !!(
        document.querySelector('.slds-scope') ||
        document.querySelector('[data-aura-rendered-by]') ||
        document.querySelector('.oneHeader')
      );
    });

    let sections: SectionData[];
    if (isLightning) {
      sections = await this.extractLightningData();
    } else {
      sections = await this.extractClassicData();
    }

    return {
      recordId,
      recordUrl,
      capturedAt: new Date().toISOString(),
      sections,
    };
  }

  private async extractLightningData(): Promise<SectionData[]> {
    if (!this.page) {
      throw new Error('Browser page not initialized');
    }

    console.log('⚡ Extracting data from Lightning UI');

    // Enhanced debugging to understand the page structure
    const debugInfo = await this.page.evaluate(() => {
      // Get sample of all unique class names to understand the structure
      const allElements = document.querySelectorAll('*');
      const classNames = new Set();
      const tagNames = new Set();

      allElements.forEach(el => {
        if (el.className && typeof el.className === 'string') {
          el.className.split(' ').forEach(cls => {
            if (cls && (cls.includes('form') || cls.includes('field') || cls.includes('slds') || cls.includes('force'))) {
              classNames.add(cls);
            }
          });
        }
        if (el.tagName.toLowerCase().includes('lightning')) {
          tagNames.add(el.tagName);
        }
      });

      return {
        detailsElements: document.querySelectorAll('[id*="Details"]').length,
        recordElements: document.querySelectorAll('[class*="records-record"]').length,
        forceRecordElements: document.querySelectorAll('[class*="forceRecord"]').length,
        formElements: document.querySelectorAll('.slds-form-element').length,
        lightningElements: document.querySelectorAll('lightning-input, lightning-output-field, lightning-formatted-text').length,
        allDivs: document.querySelectorAll('div').length,
        pageTitle: document.title,
        url: window.location.href,
        relevantClasses: Array.from(classNames).slice(0, 20), // First 20 relevant classes
        lightningTags: Array.from(tagNames),
        // Sample some actual text content to see if fields are there
        bodyText: document.body.textContent?.substring(0, 500) || 'No body text'
      };
    });

    console.log('🔍 Enhanced Debug Info:', debugInfo);

    return await this.page.evaluate(() => {
      const sections: SectionData[] = [];

      // Debug: Log what we can actually find
      console.log('=== FIELD EXTRACTION DEBUG ===');
      console.log('Lightning output fields:', document.querySelectorAll('lightning-output-field').length);
      console.log('Lightning formatted elements:', document.querySelectorAll('lightning-formatted-text, lightning-formatted-email, lightning-formatted-phone').length);
      console.log('SLDS form elements:', document.querySelectorAll('.slds-form-element').length);

      // Try a direct approach first - look for Lightning output fields which are most common
      const lightningFields = document.querySelectorAll('lightning-output-field');
      console.log(`Found ${lightningFields.length} lightning-output-field elements`);

      const directFields: FieldData[] = [];
      lightningFields.forEach((field, index) => {
        const fieldLabel = field.getAttribute('field-label') ||
          field.querySelector('label')?.textContent?.trim() ||
          field.getAttribute('data-label') ||
          'Unknown Field';

        const fieldValue = field.querySelector('lightning-formatted-text')?.textContent?.trim() ||
          field.querySelector('lightning-formatted-email')?.textContent?.trim() ||
          field.querySelector('lightning-formatted-phone')?.textContent?.trim() ||
          field.querySelector('span')?.textContent?.trim() ||
          field.textContent?.trim() ||
          '(empty)';

        console.log(`Lightning field ${index + 1}: ${fieldLabel} = ${fieldValue}`);

        if (fieldLabel && fieldLabel !== 'Unknown Field' && fieldLabel.length > 1) {
          directFields.push({
            fieldName: fieldLabel,
            fieldValue
          });
        }
      });

      if (directFields.length > 0) {
        console.log(`✅ Found ${directFields.length} fields using lightning-output-field approach`);
        sections.push({
          sectionName: 'Lead Information',
          fields: directFields
        });
        return sections;
      }

      // Fallback: Try multiple extraction strategies
      console.log('🔄 Falling back to comprehensive search...');
      const extractionStrategies = [
        {
          name: 'Modern Lightning Details Tab',
          containers: [
            '[id*="Details"]',
            '.records-record-layout',
            '.forceRecordLayout',
            '.record-body',
            'div[class*="forceRecord"]'
          ],
          fieldSelectors: [
            '.slds-form-element',
            '[data-target-selection-name="sfdc:RecordField"]',
            'div[class*="forceOutputField"]',
            'div[class*="forceField"]',
            '.field-container'
          ]
        },
        {
          name: 'Broad Page Scan',
          containers: ['body'],
          fieldSelectors: [
            '.slds-form-element',
            'div[class*="field"]',
            'div[data-field-label]',
            'lightning-formatted-text',
            'lightning-formatted-email',
            'lightning-formatted-phone'
          ]
        }
      ];

      for (const strategy of extractionStrategies) {
        for (const containerSelector of strategy.containers) {
          const container = document.querySelector(containerSelector);
          if (!container) continue;

          for (const fieldSelector of strategy.fieldSelectors) {
            const fieldElements = container.querySelectorAll(fieldSelector);

            fieldElements.forEach((fieldElement) => {
              // Try multiple ways to find label and value
              const labelCandidates = [
                fieldElement.querySelector('label'),
                fieldElement.querySelector('.slds-form-element__label'),
                fieldElement.querySelector('[class*="field-label"]'),
                fieldElement.querySelector('dt'),
                fieldElement.querySelector('span[title]'),
                fieldElement.previousElementSibling?.querySelector('label'),
                fieldElement.closest('.slds-form-element')?.querySelector('label')
              ];

              const valueCandidates = [
                fieldElement.querySelector('.slds-form-element__static'),
                fieldElement.querySelector('output'),
                fieldElement.querySelector('span[class*="uiOutputText"]'),
                fieldElement.querySelector('lightning-formatted-text'),
                fieldElement.querySelector('lightning-formatted-email'),
                fieldElement.querySelector('lightning-formatted-phone'),
                fieldElement.querySelector('a[data-refid="recordId"]'),
                fieldElement.querySelector('dd'),
                fieldElement.querySelector('input'),
                fieldElement.querySelector('textarea'),
                fieldElement.querySelector('select'),
                fieldElement.tagName === 'LIGHTNING-FORMATTED-TEXT' ? fieldElement : null,
                fieldElement.tagName === 'LIGHTNING-FORMATTED-EMAIL' ? fieldElement : null,
                fieldElement.tagName === 'LIGHTNING-FORMATTED-PHONE' ? fieldElement : null
              ];

              const labelElement = labelCandidates.find(el => el?.textContent?.trim());
              const valueElement = valueCandidates.find(el => el?.textContent?.trim() || (el as HTMLInputElement)?.value);

              if (labelElement && valueElement) {
                const fieldName = labelElement.textContent?.trim() || '';
                let fieldValue = '';

                // Extract value based on element type
                if (valueElement.tagName === 'INPUT' || valueElement.tagName === 'TEXTAREA') {
                  fieldValue = (valueElement as HTMLInputElement).value || '';
                } else if (valueElement.tagName === 'SELECT') {
                  const selectedOption = (valueElement as HTMLSelectElement).selectedOptions[0];
                  fieldValue = selectedOption?.textContent?.trim() || '';
                } else {
                  fieldValue = valueElement.textContent?.trim() || '';
                }

                // Clean and validate field
                const cleanFieldName = fieldName.replace(/\s*\*?\s*$/, '').replace(/\s*required\s*/i, '');

                if (cleanFieldName &&
                  cleanFieldName.length > 1 &&
                  !cleanFieldName.includes('*') &&
                  !cleanFieldName.toLowerCase().includes('required') &&
                  cleanFieldName !== 'Show more' &&
                  cleanFieldName !== 'Show less') {

                  // Check if we already have this field to avoid duplicates
                  const isDuplicate = sections.some(section =>
                    section.fields.some(field => field.fieldName === cleanFieldName)
                  );

                  if (!isDuplicate) {
                    // Add to the main Lead Information section
                    let leadSection = sections.find(s => s.sectionName === 'Lead Information');
                    if (!leadSection) {
                      leadSection = { sectionName: 'Lead Information', fields: [] };
                      sections.push(leadSection);
                    }

                    leadSection.fields.push({
                      fieldName: cleanFieldName,
                      fieldValue: fieldValue || '(empty)',
                    });
                  }
                }
              }
            });
          }
        }
      }

      return sections;
    });
  }

  private async extractClassicData(): Promise<SectionData[]> {
    if (!this.page) {
      throw new Error('Browser page not initialized');
    }

    console.log('⚙️ Extracting data from Classic UI');

    return await this.page.evaluate(() => {
      const sections: SectionData[] = [];

      // Find all Classic sections
      const sectionElements = document.querySelectorAll(
        '.pbSubsection, .detailList, .bPageBlock, .pbBody'
      );

      sectionElements.forEach((section) => {
        // Get section title
        let sectionName = 'Unknown Section';
        const titleElement = section.querySelector(
          '.pbSubheader, .detailBlock .labelCol, .pbHeader h2, .pbSubsectionTitle, h3'
        );

        if (titleElement) {
          sectionName = titleElement.textContent?.trim() || 'Unknown Section';
        }

        // Skip if section name is empty or too generic
        if (!sectionName || sectionName === 'Unknown Section' || sectionName.length < 2) {
          return;
        }

        const fields: FieldData[] = [];

        // Find all field rows within this section
        const fieldRows = section.querySelectorAll(
          '.detailRow, .pbSubsection tr, .dataRow'
        );

        fieldRows.forEach((row) => {
          const labelCell = row.querySelector('.labelCol, .dataCol:first-child');
          const valueCell = row.querySelector('.dataCol:last-child, .data2Col');

          if (labelCell && valueCell && labelCell !== valueCell) {
            const fieldName = labelCell.textContent?.trim() || '';
            const fieldValue = valueCell.textContent?.trim() || '';

            // Only add if both name and value exist and are meaningful
            if (fieldName && fieldName.length > 1 && !fieldName.includes('*')) {
              fields.push({
                fieldName: fieldName.replace(':', ''), // Remove trailing colon
                fieldValue: fieldValue || '(empty)',
              });
            }
          }
        });

        // Only add section if it has fields
        if (fields.length > 0) {
          sections.push({
            sectionName,
            fields,
          });
        }
      });

      return sections;
    });
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        console.log('🧹 Browser cleanup completed');
      }
    } catch (error) {
      console.error('⚠️ Error during cleanup:', error);
    }
  }
} 