import got from 'got';
import _ from 'lodash';
import { BaiduError } from './interface';

export interface LexerItem {
  byte_length: number;
  byte_offset: number;
  formal: string;
  item: string;
  ne: string;
  pos: string;
  uri: string;
  loc_details: string[];
  basic_words: string[];
}

export interface Lexer extends BaiduError {
  text: string;
  items?: LexerItem[];
}

class NLP {
  private appId: string;
  private apiKey: string;
  private secretKey: string;
  private accessToken?: string;
  private expiresTime = 0;

  constructor(appId: string, apiKey: string, secretKey: string) {
    this.appId = appId;
    this.apiKey = apiKey;
    this.secretKey = secretKey;
  }

  private async getAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    if (!this.accessToken || now > this.expiresTime) {
      const { body } = await got.post<any>('https://aip.baidubce.com/oauth/2.0/token', {
        searchParams: {
          grant_type: 'client_credentials',
          client_id: this.apiKey,
          client_secret: this.secretKey,
        },
        responseType: 'json',
      });
      const { access_token, expires_in } = body;
      this.accessToken = access_token;
      this.expiresTime = now + expires_in;
    }
    return this.accessToken;
  }

  async lexer(text: string, custom = false): Promise<Lexer> {
    const token = await this.getAccessToken();
    const { body } = await got.post<any>(
      `https://aip.baidubce.com/rpc/2.0/nlp/v1/lexer${custom ? '_custom' : ''}`,
      {
        searchParams: { access_token: token, charset: 'UTF-8' },
        json: { text },
        responseType: 'json',
      },
    );
    Object.keys(body).forEach((key) => {
      body[_.camelCase(key)] = body[key];
      if (_.camelCase(key) !== key) {
        delete body[key];
      }
    });
    return body;
  }
}

export default NLP;
