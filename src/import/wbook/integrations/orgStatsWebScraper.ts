import { execSync } from 'node:child_process';
import puppeteer, { Browser, Page } from 'puppeteer';

/* eslint-disable no-console, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, complexity, @typescript-eslint/require-await, @typescript-eslint/prefer-optional-chain, unicorn/numeric-separators-style, radix, import/no-extraneous-dependencies, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/await-thenable */

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

      // 🚀 PERFORMANCE OPTIMIZATION: Go directly to Apex Classes page using Salesforce Classic
      console.log('🚀 Navigating directly to Apex Classes page using Salesforce Classic UI...');
      const baseUrl = this.page!.url().split('/lightning')[0];
      // Use Salesforce Classic URL to bypass cross-domain cookie issues
      const apexClassesUrl = `${baseUrl}/01p?appLayout=setup&noS1Redirect=true`;
      console.log(`Direct Apex URL (Classic): ${apexClassesUrl}`);
      console.log('⏰ Using 120-second timeout for Apex Classes page...');

      await this.page!.goto(apexClassesUrl, { waitUntil: 'networkidle2', timeout: 120000 });

      const apexStats = await this.scrapeApexUsageDirectly();
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
        '--disable-cookies-without-same-site-must-be-secure'
      ]
    });

    this.page = await this.browser.newPage();

    // Block notifications and other permissions for any Salesforce domain
    // This will be handled by Chrome flags instead of hardcoded URLs

    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  }

  private async navigateToSalesforce(loginUrl: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Navigating to Salesforce...');
    console.log('⏰ Using 120-second timeout for initial login...');
    await this.page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 120000 });
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

  private async scrapeApexUsageDirectly(): Promise<{ apexUsagePercentage: number; usedApexClasses: number; totalApexClasses: number }> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Scraping Apex usage from current page...');

    try {
      // Check if we're on Classic UI (no iframes needed)
      const currentUrl = this.page.url();
      const isClassicUI = currentUrl.includes('noS1Redirect=true') || currentUrl.includes('appLayout=setup');

      if (isClassicUI) {
        console.log('🏛️  Detected Salesforce Classic UI - skipping iframe detection and extracting directly from page');
      } else {
        console.log('⚡ Detected Lightning Experience - looking for iframes');
      }

      let iframeFound = false;

      // Only do iframe detection if we're NOT on Classic UI
      if (!isClassicUI) {
        console.log('🔍 Starting robust iframe detection with 5-minute timeout...');

        const maxWaitTime = 5 * 60 * 1000; // 5 minutes in milliseconds
        const pollInterval = 30 * 1000; // 30 seconds in milliseconds
        const startTime = Date.now();

        // eslint-disable-next-line no-await-in-loop
        while (Date.now() - startTime < maxWaitTime && !iframeFound) {
          const remainingTime = Math.round((maxWaitTime - (Date.now() - startTime)) / 1000);
          console.log(`⏰ Checking for Apex Classes iframe... (${remainingTime}s remaining)`);

          try {
            // Look for iframe with specific attributes from your inspection
            // eslint-disable-next-line no-await-in-loop
            const iframe = await this.page.$('iframe[title*="Apex Classes"]');

            if (iframe) {
              console.log('🎉 Found Apex Classes iframe with title attribute!');

              // Get iframe details for verification
              // eslint-disable-next-line no-await-in-loop
              const iframeDetails = await this.page.evaluate((iframeEl) => ({
                title: iframeEl.getAttribute('title'),
                name: iframeEl.getAttribute('name'),
                height: iframeEl.getAttribute('height'),
                width: iframeEl.getAttribute('width'),
                src: iframeEl.getAttribute('src')
              }), iframe);

              console.log('📋 Iframe details:', JSON.stringify(iframeDetails, null, 2));
              iframeFound = true;

              // Wait additional time for iframe content to fully load
              console.log('⏳ Iframe found! Waiting additional 10 seconds for content to load...');
              // eslint-disable-next-line no-await-in-loop
              await new Promise(resolve => setTimeout(resolve, 10000));
              break;
            }

            // Fallback: look for any iframe on the page
            // eslint-disable-next-line no-await-in-loop
            const anyIframe = await this.page.$('iframe');
            if (anyIframe) {
              console.log('📄 Found generic iframe, checking if it contains Apex content...');

              // eslint-disable-next-line no-await-in-loop
              const iframeDetails = await this.page.evaluate((iframeEl) => ({
                title: iframeEl.getAttribute('title') ?? '',
                name: iframeEl.getAttribute('name') ?? '',
                height: iframeEl.getAttribute('height') ?? '',
                width: iframeEl.getAttribute('width') ?? ''
              }), anyIframe);

              console.log('📋 Generic iframe details:', JSON.stringify(iframeDetails, null, 2));

              // Check if this iframe might be the Apex one based on attributes
              if (iframeDetails.title.toLowerCase().includes('apex') ||
                iframeDetails.title.toLowerCase().includes('classes') ||
                iframeDetails.name.includes('vfFrameId')) {
                console.log('✅ Generic iframe appears to be Apex-related, proceeding...');
                iframeFound = true;
                // eslint-disable-next-line no-await-in-loop
                await new Promise(resolve => setTimeout(resolve, 10000));
                break;
              }
            }

          } catch (selectorError) {
            const errorMessage = selectorError instanceof Error ? selectorError.message : String(selectorError);
            console.log(`🔍 Iframe selector check failed: ${errorMessage}`);
          }

          if (!iframeFound) {
            console.log(`⏱️  No iframe found yet, waiting ${pollInterval / 1000} seconds before next check...`);
            // eslint-disable-next-line no-await-in-loop
            await new Promise(resolve => setTimeout(resolve, pollInterval));
          }
        }

        if (!iframeFound) {
          console.log('⚠️  Timeout: No Apex Classes iframe found after 5 minutes, proceeding with main page content...');
        }
      } else {
        console.log('🏛️  Classic UI detected - proceeding directly to main page extraction');
      }

      // Check if page is still valid before evaluating
      if (this.page.isClosed()) {
        throw new Error('Page was closed during navigation');
      }

      let apexUsagePercentage = 0;
      let usedApexClasses = 0;
      let totalApexClasses = 0;

      // If iframe was found, switch to iframe context to read the content
      if (iframeFound) {
        console.log('🔄 Switching to iframe context to extract Apex data...');

        try {
          // Get all frames (iframes) on the page
          const frames = await this.page.frames();
          console.log(`Found ${frames.length} frames on the page`);

          let apexFrame = null;

          // Find the Apex Classes frame
          for (const frame of frames) {
            const frameUrl = frame.url();
            const frameName = frame.name();
            console.log(`Checking frame: ${frameName} - ${frameUrl}`);

            if (frameUrl.includes('ApexClasses') || frameName.includes('vfFrameId') ||
              frameUrl.includes('apex') || frameUrl.includes('classes') ||
              frameUrl.includes('01p')) {
              console.log('✅ Found Apex Classes frame!');
              apexFrame = frame;
              break;
            }
          }

          if (apexFrame) {
            console.log('🎯 Extracting data from Apex Classes iframe...');

            // Extract data from the iframe using the exact HTML structure you provided
            // eslint-disable-next-line @typescript-eslint/await-thenable
            const iframeData = await (apexFrame.evaluate(() => {
              const result = {
                apexUsagePercentage: 0,
                usedChars: 0,
                totalChars: 0,
                rawText: ''
              };

              // Get all text for debugging
              const allText = document.body.textContent ?? document.body.innerText ?? '';
              result.rawText = allText.substring(0, 2000); // First 2000 chars for debugging
              console.log('Iframe content preview:', result.rawText.substring(0, 500));

              // Look for the exact H4 pattern: <h4>Percent of Apex Used: 14.86%</h4>
              const h4Elements = document.querySelectorAll('h4');
              for (const h4 of h4Elements) {
                const h4Text = h4.textContent ?? '';
                console.log(`Found H4: ${h4Text}`);

                if (h4Text.includes('Percent of Apex Used')) {
                  const percentMatch = h4Text.match(/(\d+(?:\.\d+)?)%/);
                  if (percentMatch) {
                    result.apexUsagePercentage = parseFloat(percentMatch[1]);
                    console.log(`✅ Extracted Apex percentage from H4: ${result.apexUsagePercentage}%`);
                  }
                }
              }

              // Look for character usage in messageText div
              const messageTextElements = document.querySelectorAll('.messageText, div[class*="messageText"]');
              for (const msgElement of messageTextElements) {
                const msgText = msgElement.textContent ?? '';
                console.log(`Checking message text: ${msgText.substring(0, 200)}`);

                // Look for: "You are currently using 891,308 characters...out of an allowed limit of 6,000,000 characters"
                const charMatch = msgText.match(/using\s+([\d,]+)\s+characters.*?out of.*?limit of\s+([\d,]+)\s+characters/i);
                if (charMatch) {
                  result.usedChars = parseInt(charMatch[1].replace(/,/g, ''), 10);
                  result.totalChars = parseInt(charMatch[2].replace(/,/g, ''), 10);
                  console.log(`✅ Extracted character usage: ${result.usedChars} / ${result.totalChars}`);
                }
              }

              // Fallback: search in all text if specific selectors didn't work
              if (result.apexUsagePercentage === 0) {
                const percentRegex = /Percent of Apex Used:\s*(\d+(?:\.\d+)?)%/i;
                const percentMatch = allText.match(percentRegex);
                if (percentMatch) {
                  result.apexUsagePercentage = parseFloat(percentMatch[1]);
                  console.log(`✅ Fallback: Extracted Apex percentage: ${result.apexUsagePercentage}%`);
                }
              }

              if (result.usedChars === 0) {
                const charRegex = /using\s+([\d,]+)\s+characters.*?out of.*?limit of\s+([\d,]+)\s+characters/i;
                const charMatch = allText.match(charRegex);
                if (charMatch) {
                  result.usedChars = parseInt(charMatch[1].replace(/,/g, ''), 10);
                  result.totalChars = parseInt(charMatch[2].replace(/,/g, ''), 10);
                  console.log(`✅ Fallback: Extracted character usage: ${result.usedChars} / ${result.totalChars}`);
                }
              }

              return result;
            }) as Promise<{ apexUsagePercentage: number; usedChars: number; totalChars: number; rawText: string }>);

            console.log('🎉 Iframe data extracted:', iframeData);

            apexUsagePercentage = iframeData.apexUsagePercentage;

            // Estimate classes based on character usage
            if (iframeData.usedChars > 0 && iframeData.totalChars > 0) {
              // Estimate classes based on average characters per class (assume ~3000 chars per class)
              usedApexClasses = Math.round(iframeData.usedChars / 3000);
              totalApexClasses = Math.round(iframeData.totalChars / 3000);
            }

          } else {
            console.log('⚠️  Could not find Apex Classes iframe, trying main page...');
          }

        } catch (iframeError) {
          console.error('❌ Error extracting data from iframe:', iframeError);
        }
      } else {
        console.log('🔄 No iframe found - checking if we\'re on Salesforce Classic UI...');
      }

      // Fallback: try to extract from main page (works for both Classic UI and if iframe extraction failed)
      if (apexUsagePercentage === 0) {
        console.log('🔄 Extracting from main page (Classic UI or iframe fallback)...');

        // Try to find usage information with the exact pattern from your screenshot
        const usageText = await this.page.evaluate(() => {
          // First, get all text content to debug
          const allText = document.body.textContent ?? '';
          console.log('Full page text preview:', allText.substring(0, 1000));

          // Look for the exact pattern: "Percent of Apex Used: 14.86%"
          const apexPercentRegex = /Percent of Apex Used:\s*(\d+(?:\.\d+)?)%/i;
          const apexMatch = allText.match(apexPercentRegex);

          if (apexMatch) {
            console.log(`Found Apex usage pattern: ${apexMatch[0]}`);
            return apexMatch[0];
          }

          // Also check for Classic UI patterns
          const classicPatterns = [
            /(\d+(?:\.\d+)?)%.*?of.*?Apex.*?used/i,
            /Apex.*?usage.*?(\d+(?:\.\d+)?)%/i,
            /(\d+(?:\.\d+)?)%.*?Apex.*?characters/i
          ];

          for (const pattern of classicPatterns) {
            const match = allText.match(pattern);
            if (match) {
              console.log(`Found Classic UI Apex pattern: ${match[0]}`);
              return match[0];
            }
          }

          // Fallback: look for any percentage with "Apex" nearby
          const lines = allText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.toLowerCase().includes('apex') && line.includes('%')) {
              console.log(`Found Apex line: ${line}`);
              return line;
            }

            // Also check next few lines if current line mentions "Percent" or "Used"
            if (line.toLowerCase().includes('percent') && line.toLowerCase().includes('apex')) {
              const nextLines = lines.slice(i, i + 3).join(' ');
              if (nextLines.includes('%')) {
                console.log(`Found Apex usage in multi-line: ${nextLines}`);
                return nextLines;
              }
            }
          }

          return null;
        });

        if (usageText) {
          console.log(`Processing Apex usage text: ${usageText}`);

          // Extract percentage with decimal support (e.g., "14.86%")
          const percentMatch = usageText.match(/(\d+(?:\.\d+)?)%/);
          if (percentMatch) {
            apexUsagePercentage = parseFloat(percentMatch[1]);
            console.log(`Extracted Apex percentage: ${apexUsagePercentage}%`);
          }

          // Look for character count pattern from your screenshot
          // "using 891,308 characters of Apex Code ... out of an allowed limit of 6,000,000 characters"
          const charactersMatch = usageText.match(/using\s+([\d,]+)\s+characters.*?(?:of|out of).*?([\d,]+)\s+characters/i);
          if (charactersMatch) {
            const usedChars = parseInt(charactersMatch[1].replace(/,/g, ''), 10);
            const totalChars = parseInt(charactersMatch[2].replace(/,/g, ''), 10);
            console.log(`Found character usage: ${usedChars} / ${totalChars}`);

            // Estimate classes based on average characters per class (assume ~3000 chars per class)
            usedApexClasses = Math.round(usedChars / 3000);
            totalApexClasses = Math.round(totalChars / 3000);
          }

          // Fallback: look for direct class count pattern
          const classesMatch = usageText.match(/(\d+)\s*(?:of|\/)\s*(\d+)/);
          if (classesMatch && usedApexClasses === 0) {
            usedApexClasses = parseInt(classesMatch[1], 10);
            totalApexClasses = parseInt(classesMatch[2], 10);
          }
        }
      }

      // Final fallback: count classes if no usage info found
      if (totalApexClasses === 0) {
        totalApexClasses = await this.page.evaluate(() => {
          const rows = document.querySelectorAll('table tr, .listRow');
          return Math.max(0, rows.length - 1);
        });

        usedApexClasses = Math.round(totalApexClasses * (apexUsagePercentage / 100));
      }

      console.log(`🎯 Final Apex usage: ${apexUsagePercentage}% (${usedApexClasses}/${totalApexClasses})`);

      return {
        apexUsagePercentage: apexUsagePercentage || 0,
        usedApexClasses: usedApexClasses || 0,
        totalApexClasses: totalApexClasses || 0
      };

    } catch (error) {
      console.error('Error scraping Apex usage directly:', error);
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
      // Navigate to System Overview page as you specified
      const baseUrl = this.page.url().split('/lightning')[0];
      const systemOverviewUrl = `${baseUrl}/lightning/setup/SystemOverview/home`;

      console.log(`Navigating to System Overview: ${systemOverviewUrl}`);
      await this.page.goto(systemOverviewUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log('Looking for Data Storage section...');

      // Wait for the page to load and look for the data storage section
      await new Promise(resolve => setTimeout(resolve, 3000));

      const storageStats = await this.page.evaluate(() => {
        const result = {
          dataStoragePercentage: 0,
          dataStorageUsed: 0,
          dataStorageMax: 0,
          fileStoragePercentage: 0,
          fileStorageUsed: 0,
          fileStorageMax: 0
        };

        // Look for the storage information on the System Overview page
        const allText = document.body.textContent ?? '';
        console.log('Page text preview:', allText.substring(0, 500));

        // Look for data storage section
        const dataStorageRegex = /DATA STORAGE.*?(\d+(?:\.\d+)?)\s*MB.*?\(Approx\)/i;
        const dataMatch = allText.match(dataStorageRegex);

        if (dataMatch) {
          result.dataStorageUsed = parseFloat(dataMatch[1]);
          console.log(`Found data storage: ${result.dataStorageUsed} MB`);
        }

        // Look for storage percentage and limits
        const lines = allText.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0);

        for (const line of lines) {
          // Look for patterns like "997.9 MB (Approx.)"
          if (line.includes('MB') && line.includes('Approx')) {
            const mbMatch = line.match(/(\d+(?:\.\d+)?)\s*MB/);
            if (mbMatch) {
              result.dataStorageUsed = parseFloat(mbMatch[1]);
            }
          }

          // Look for usage percentages
          if (line.includes('%') && (line.includes('USAGE') || line.includes('usage'))) {
            const percentMatch = line.match(/(\d+(?:\.\d+)?)%/);
            if (percentMatch) {
              result.dataStoragePercentage = parseFloat(percentMatch[1]);
            }
          }
        }

        return result;
      });

      console.log('Storage usage scraped from System Overview:', storageStats);

      // Try to click on Data Storage link if found
      try {
        console.log('Looking for Data Storage clickable link...');

        // Look for clickable data storage elements using CSS selector
        const dataStorageClickable = await this.page.$$('a');
        let foundDataStorageLink = false;

        // eslint-disable-next-line no-await-in-loop
        for (const link of dataStorageClickable) {
          // eslint-disable-next-line no-await-in-loop
          const linkText = await this.page.evaluate(el => el.textContent, link);
          if (linkText && (linkText.includes('MB') || linkText.includes('Data Storage'))) {
            console.log('Found Data Storage link, clicking...');
            // eslint-disable-next-line no-await-in-loop
            await link.click();
            // eslint-disable-next-line no-await-in-loop
            await new Promise(resolve => setTimeout(resolve, 3000));
            foundDataStorageLink = true;
            break;
          }
        }

        if (foundDataStorageLink) {

          // After clicking, scrape more detailed storage info
          const detailedStats = await this.page.evaluate(() => {
            const detailed = {
              dataStoragePercentage: 0,
              dataStorageUsed: 0,
              dataStorageMax: 0,
              fileStoragePercentage: 0,
              fileStorageUsed: 0,
              fileStorageMax: 0
            };

            const allText = document.body.textContent ?? '';
            console.log('Detailed storage page text preview:', allText.substring(0, 500));

            // Look for more detailed storage information
            const percentMatches = allText.match(/(\d+(?:\.\d+)?)%/g);
            const mbMatches = allText.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*MB/g);

            if (percentMatches && percentMatches.length > 0) {
              detailed.dataStoragePercentage = parseFloat(percentMatches[0].replace('%', ''));
            }

            if (mbMatches && mbMatches.length >= 2) {
              detailed.dataStorageUsed = parseFloat(mbMatches[0].replace(/[,MB]/g, ''));
              detailed.dataStorageMax = parseFloat(mbMatches[1].replace(/[,MB]/g, ''));
            }

            return detailed;
          });

          // Merge detailed stats with initial stats
          Object.assign(storageStats, detailedStats);
          console.log('Updated storage stats after clicking:', storageStats);
        }
      } catch (clickError) {
        console.log('Could not click Data Storage link:', clickError);
      }

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