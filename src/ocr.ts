import got from 'got';
import _ from 'lodash';

/**
 * image/url/pdf_file 三选一
 */
export interface VatInvoiceParams {
  /**
   * 图像数据，base64编码后进行urlencode，要求base64编码和urlencode后大小不超过4M，最短边至少15px，最长边最大4096px,支持jpg/jpeg/png/bmp格式
   */
  image?: string;
  /**
   * 图片完整URL，URL长度不超过1024字节，URL对应的图片base64编码后大小不超过4M，最短边至少15px，最长边最大4096px,支持jpg/jpeg/png/bmp格式，当image字段存在时url字段失效
   * 请注意关闭URL防盗链
   */
  url?: string;
  /**
   * base 64 或者 url
   * 注：目前仅支持单页PDF识别，如上传的为多页PDF，仅识别第一页
   */
  pdf_file?: string;
  /**
   * 进行识别的增值税发票类型，默认为 normal，可缺省
   * - normal：可识别增值税普票、专票、电子发票
   * - roll：可识别增值税卷票
   */
  type?: 'normal' | 'roll';
}

export interface VatInvoice extends BaiduError {
  /**
   * 发票类型
   */
  invoiceType: string;
  /**
   * 机器编码
   */
  machineCode: string;
  /**
   * 发票代码
   */
  invoiceCode: string;
  /**
   * 发票号码
   */
  invoiceNum: string;
  /**
   * 开票日期
   */
  invoiceDate: string;
  /**
   * 校验码
   */
  checkCode: string;
  /**
   * 密码区
   */
  password: string;

  /**
   * 购买方名称
   */
  purchaserName: string;
  /**
   * 购买方纳税人识别号
   */
  purchaserRegisterNum: string;
  /**
   * 购买方地址、电话
   */
  purchaserAddress: string;
  /**
   * 购买方开户行及账号
   */
  purchaserBank: string;
  /**
   * 购买方名称
   */
  sellerName: string;
  /**
   * 销售方纳税人识别号
   */
  sellerRegisterNum: string;
  /**
   * 销售方地址、电话
   */
  sellerAddress: string;
  /**
   * 销售方开户行及账号
   */
  sellerBank: string;
  /**
   * 总金额
   */
  totalAmount: string;
  /**
   * 总税额
   */
  totalTax: string;
  /**
   * 价税合计
   */
  totalAmountAndTax: string;
  /**
   * 收款人
   */
  payee: string;
  /**
   * 开票人
   */
  noteDrawer: string;
  /**
   * 商品名称
   */
  commodityName: string;
  /**
   * 备注
   */
  remark: string;
}

export interface BaiduError {
  logId: number;
  errorMsg: string;
  errorCode: number;
}

class Ocr {
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

  async vatInvoice(data: VatInvoiceParams): Promise<VatInvoice | BaiduError> {
    const token = await this.getAccessToken();
    if (data.pdf_file && data.pdf_file.startsWith('http')) {
      const { body } = await got.get(data.pdf_file, { responseType: 'buffer' });
      data.pdf_file = body.toString('base64');
    }
    const { body } = await got.post<any>('https://aip.baidubce.com/rest/2.0/ocr/v1/vat_invoice', {
      searchParams: { access_token: token },
      form: data,
      responseType: 'json',
    });
    Object.keys(body).forEach((key) => {
      body[_.camelCase(key)] = body[key];
      delete body[key];
    });
    if (body.wordsResult) {
      const res: any = {};
      Object.keys(body.wordsResult).forEach((key) => {
        res[_.camelCase(key)] = body.wordsResult[key];
        delete body.wordsResult[key];
      });
      if (res.commodityName) {
        res.commodityName = res.commodityName.map((p) => p.word).join('\n');
      }
      res.totalAmountAndTax = res.amountInFiguers;
      res.invoiceDate = res.invoiceDate.replace(/[年月]/g, '-').replace(/[日]/g, '');
      res.remark = res.remarks;
      res.totalTax = parseFloat(res.totalTax);
      if (isNaN(res.totalTax)) {
        res.totalTax = 0;
      }
      return res;
    }
    return body;
  }
}

export default Ocr;
