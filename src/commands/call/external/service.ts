import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import got from 'got';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf_workbook', 'call.external.service');

export type CallExternalServiceResult = {
  text: string;
  number: number;
  found: boolean;
  type: string;
};

export default class CallExternalService extends SfCommand<CallExternalServiceResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    name: Flags.string({
      summary: messages.getMessage('flags.name.summary'),
      description: messages.getMessage('flags.name.description'),
      char: 'n',
      required: false,
    }),
  };

  public async run(): Promise<CallExternalServiceResult> {
    const result = await got<CallExternalServiceResult>(
      'http://numbersapi.com/random/trivia?json'
    ).json<CallExternalServiceResult>();

    this.log(result.text);

    return result;
  }
}
