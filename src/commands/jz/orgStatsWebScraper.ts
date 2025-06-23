import { execSync } from 'node:child_process';
import puppeteer, { Browser, Page } from 'puppeteer';

/* eslint-disable no-console, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, complexity, @typescript-eslint/require-await, @typescript-eslint/prefer-optional-chain, unicorn/numeric-separators-style, radix, import/no-extraneous-dependencies, @typescript-eslint/no-redundant-type-constituents */

export type ScrapedOrgStats = {
  apexUsagePercentage: number;
  usedApexClasses: number;
  totalApexClasses: number;
  dataStoragePercentage: number;
  dataStorageUsed: number;
  dataStorageMax: number;
  fileStoragePercentage: number;
  fileStorageUsed: number;
  fileStorageMax: number;
  scrapedAt: Date;
};

export class OrgStatsWebScraper {
  private orgAlias: string;
  private browser: Browser | null = null;
  private page: Page | null = null;

  public constructor(orgAlias: string) {
    this.orgAlias = orgAlias;
  }

  public async scrapeOrgStats(): Promise<ScrapedOrgStats> {
    try {
      console.log(`Starting web scraping for org: ${this.orgAlias}`);

      const loginUrl = await this.getLoginUrl();
      console.log(`Got login URL: ${loginUrl}`);

      await this.initializeBrowser();
      await this.navigateToSalesforce(loginUrl);
      await this.waitForSalesforceLoad();

      const apexStats = await this.scrapeApexUsage();
      const storageStats = await this.scrapeStorageUsage();

      const result: ScrapedOrgStats = {
        ...apexStats,
        ...storageStats,
        scrapedAt: new Date()
      };

      console.log('Successfully scraped org statistics:', result);
      return result;

    } catch (error) {
      console.error('Error scraping org statistics:', error);
      throw error;
    } finally {
      await this.cleanup();
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
      throw new Error(`Error executing SFDX command: ${String(error)}`);
    }
  }

  private async initializeBrowser(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1920, height: 1080 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    this.page = await this.browser.newPage();
    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  }

  private async navigateToSalesforce(loginUrl: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Navigating to Salesforce...');
    await this.page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  }

  private async waitForSalesforceLoad(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Waiting for Salesforce to load...');

    try {
      await this.page.waitForSelector('div.slds-context-bar, #AppBodyHeader', { timeout: 30000 });
      // Use setTimeout instead of deprecated waitForTimeout
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('Salesforce loaded successfully');
    } catch (error) {
      console.log('Standard selectors not found, trying alternative approach...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  private async scrapeApexUsage(): Promise<{ apexUsagePercentage: number; usedApexClasses: number; totalApexClasses: number }> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Scraping Apex usage...');

    try {
      const setupUrl = await this.getSetupUrl('ApexClasses');
      await this.page.goto(setupUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      let apexUsagePercentage = 0;
      let usedApexClasses = 0;
      let totalApexClasses = 0;

      // Try to find usage information
      const usageText = await this.page.evaluate(() => {
        const selectors = ['div.messageText', '.infoMsg', '.warningMsg'];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            const text = element.textContent ?? '';
            if (text.includes('%') && (text.includes('Apex') || text.includes('class'))) {
              return text;
            }
          }
        }
        return null;
      });

      if (usageText) {
        const percentMatch = usageText.match(/(\d+)%/);
        if (percentMatch) {
          apexUsagePercentage = parseInt(percentMatch[1], 10);
        }

        const classesMatch = usageText.match(/(\d+)\s*(?:of|\/)\s*(\d+)/);
        if (classesMatch) {
          usedApexClasses = parseInt(classesMatch[1], 10);
          totalApexClasses = parseInt(classesMatch[2], 10);
        }
      }

      // Fallback: count classes if no usage info found
      if (totalApexClasses === 0) {
        totalApexClasses = await this.page.evaluate(() => {
          const rows = document.querySelectorAll('table tr, .listRow');
          return Math.max(0, rows.length - 1);
        });

        usedApexClasses = Math.round(totalApexClasses * (apexUsagePercentage / 100));
      }

      console.log(`Apex usage: ${apexUsagePercentage}% (${usedApexClasses}/${totalApexClasses})`);

      return {
        apexUsagePercentage: apexUsagePercentage || 0,
        usedApexClasses: usedApexClasses || 0,
        totalApexClasses: totalApexClasses || 0
      };

    } catch (error) {
      console.error('Error scraping Apex usage:', error);
      return {
        apexUsagePercentage: 0,
        usedApexClasses: 0,
        totalApexClasses: 0
      };
    }
  }

  private async scrapeStorageUsage(): Promise<{
    dataStoragePercentage: number;
    dataStorageUsed: number;
    dataStorageMax: number;
    fileStoragePercentage: number;
    fileStorageUsed: number;
    fileStorageMax: number;
  }> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Scraping storage usage...');

    try {
      const storageUrl = await this.getSetupUrl('StorageUsage');
      await this.page.goto(storageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 5000));

      const storageStats = await this.page.evaluate(() => {
        const result = {
          dataStoragePercentage: 0,
          dataStorageUsed: 0,
          dataStorageMax: 0,
          fileStoragePercentage: 0,
          fileStorageUsed: 0,
          fileStorageMax: 0
        };

        // Simple text search approach
        const allText = document.body.textContent ?? '';
        const lines = allText.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].toLowerCase();

          if (line.includes('data storage')) {
            const nextLines = lines.slice(i, i + 3).join(' ');

            const percentMatch = nextLines.match(/(\d+(?:\.\d+)?)%/);
            if (percentMatch) {
              result.dataStoragePercentage = parseFloat(percentMatch[1]);
            }

            const mbMatches = nextLines.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*MB.*?(\d+(?:,\d+)*(?:\.\d+)?)\s*MB/);
            if (mbMatches) {
              result.dataStorageUsed = parseFloat(mbMatches[1].replace(/,/g, ''));
              result.dataStorageMax = parseFloat(mbMatches[2].replace(/,/g, ''));
            }
          }

          if (line.includes('file storage')) {
            const nextLines = lines.slice(i, i + 3).join(' ');

            const percentMatch = nextLines.match(/(\d+(?:\.\d+)?)%/);
            if (percentMatch) {
              result.fileStoragePercentage = parseFloat(percentMatch[1]);
            }

            const mbMatches = nextLines.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*MB.*?(\d+(?:,\d+)*(?:\.\d+)?)\s*MB/);
            if (mbMatches) {
              result.fileStorageUsed = parseFloat(mbMatches[1].replace(/,/g, ''));
              result.fileStorageMax = parseFloat(mbMatches[2].replace(/,/g, ''));
            }
          }
        }

        return result;
      });

      console.log('Storage usage scraped:', storageStats);
      return storageStats;

    } catch (error) {
      console.error('Error scraping storage usage:', error);
      return {
        dataStoragePercentage: -1,
        dataStorageUsed: 0,
        dataStorageMax: 0,
        fileStoragePercentage: -1,
        fileStorageUsed: 0,
        fileStorageMax: 0
      };
    }
  }

  private async getSetupUrl(setupPage: string): Promise<string> {
    if (!this.page) throw new Error('Page not initialized');

    const currentUrl = this.page.url();
    const baseUrl = new URL(currentUrl).origin;

    const setupPages: Record<string, string> = {
      'ApexClasses': '/lightning/setup/ApexClasses/home',
      'CompanyProfileInfo': '/lightning/setup/CompanyProfileInfo/home',
      'StorageUsage': '/lightning/setup/StorageUsage/home'
    };

    return setupPages[setupPage] ? `${baseUrl}${setupPages[setupPage]}` : `${baseUrl}/lightning/setup/${setupPage}/home`;
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      console.log('Browser cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
} 