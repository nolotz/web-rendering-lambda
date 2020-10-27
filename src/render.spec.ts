import type { APIGatewayProxyResult, APIGatewayProxyEvent, Context } from 'aws-lambda';
import { Duplex } from 'stream';
import unzip from 'unzip-stream';
import { imageSize } from 'image-size';
import { handler, RenderConfig } from './render';
import { closeBrowser } from './chrome';

declare global {
  // eslint-disable-next-line
  namespace jest {
    interface Matchers<R, T> {
      toStartWith: (prefix: string) => R;
    }
  }
}

jest.setTimeout(30000);

const dummyContext: Context = {} as Context;

afterAll(() => {
  return closeBrowser();
});

function toStartWith(this: jest.MatcherUtils, received: string, prefix: string): any {
  const pass = received.startsWith(prefix);
  if (pass) {
    return {
      message: () => `expected ${received.substring(0, 100)} not to start with ${prefix}`,
      pass: true,
    };
  } else {
    return {
      message: () => `expected ${received.substring(0, 100)} to start with ${prefix}`,
      pass: false,
    };
  }
}

expect.extend({ toStartWith });

function generateEvent(
  httpMethod: string,
  queryParams: { [key: string]: string },
  body: RenderConfig | null
): APIGatewayProxyEvent {
  const event: any = {
    body: body ? JSON.stringify(body) : null,
    isBase64Encoded: false,
    httpMethod: httpMethod,
    path: '/render',
    headers: {},
    queryStringParameters: queryParams,
    requestContext: {
      httpMethod: httpMethod,
      path: '/render',
    },
  };

  return event;
}

describe('handler with get', () => {
  it('warms up chrome', async () => {
    const event = generateEvent('GET', { warm: '1' }, null);

    let response: APIGatewayProxyResult | undefined;
    let error;
    try {
      response = await handler(event, dummyContext);
    } catch (err) {
      error = err;
    }

    expect(response).not.toBeFalsy();
    expect(response?.body).not.toBeFalsy();
    expect(error).toBeFalsy();
    expect(response?.isBase64Encoded).toBe(true);
    expect(response?.statusCode).toBe(200);
    expect(Buffer.from(response?.body || '', 'base64').toString()).toStartWith('Warmed up chrome');
  });

  it('render google with GET', async () => {
    const event = generateEvent('GET', { url: 'https://www.google.com.au/', type: 'png' }, null);

    let response: APIGatewayProxyResult | undefined;
    let error;
    try {
      response = await handler(event, dummyContext);
    } catch (err) {
      error = err;
    }

    expect(response).not.toBeFalsy();
    expect(response?.body).not.toBeFalsy();
    expect(error).toBeFalsy();
    expect(response?.isBase64Encoded).toBe(true);
    expect(response?.statusCode).toBe(200);
  });

  it('errors when no params with GET', async () => {
    const event = generateEvent('GET', {}, null);

    let response: APIGatewayProxyResult | undefined;
    let error;
    try {
      response = await handler(event, dummyContext);
    } catch (err) {
      error = err;
    }

    expect(response).not.toBeFalsy();
    expect(response?.body).not.toBeFalsy();
    expect(error).toBeFalsy();
    expect(response?.isBase64Encoded).toBe(true);
    expect(response?.statusCode).toBe(400);
  });

  it('errors when missing type with GET', async () => {
    const event = generateEvent('GET', {}, null);

    let response: APIGatewayProxyResult | undefined;
    let error;

    try {
      response = await handler(event, dummyContext);
    } catch (err) {
      error = err;
    }

    expect(response).not.toBeFalsy();
    expect(response?.body).not.toBeFalsy();
    expect(error).toBeFalsy();
    expect(response?.isBase64Encoded).toBe(true);
    expect(response?.statusCode).toBe(400);
  });
});

describe('handler with POST', () => {
  it('render google with POST', async () => {
    const event = generateEvent(
      'POST',
      {},
      {
        url: 'https://www.google.com.au/',
        type: 'png',
        fullPage: false,
        viewport: { width: 800, height: 600 },
      }
    );

    let response: APIGatewayProxyResult | undefined;
    let error;
    try {
      response = await handler(event, dummyContext);
    } catch (err) {
      error = err;
    }

    expect(response).not.toBeFalsy();
    expect(response?.body).not.toBeFalsy();
    expect(error).toBeFalsy();
    expect(response?.isBase64Encoded).toBe(true);
    expect(response?.statusCode).toBe(200);
  });

  it('outputs base64', async () => {
    const event = generateEvent(
      'POST',
      {},
      {
        url: 'https://www.google.com.au/',
        type: 'png',
        fullPage: false,
        viewport: { width: 800, height: 600 },
        encoding: 'base64',
      }
    );

    let response: APIGatewayProxyResult | undefined;
    let error;
    try {
      response = await handler(event, dummyContext);
    } catch (err) {
      error = err;
    }

    expect(response).not.toBeFalsy();
    expect(response?.body).not.toBeFalsy();
    expect(error).toBeFalsy();
    expect(response?.isBase64Encoded).toBe(false);
    expect(response?.statusCode).toBe(200);
  });

  it('render google full page jpg with POST', async () => {
    const event = generateEvent(
      'POST',
      {},
      {
        url: 'https://www.google.com.au/',
        type: 'jpeg',
        jpegQuality: 50,
        fullPage: true,
        viewport: { width: 1280, height: 600 },
      }
    );

    let response: APIGatewayProxyResult | undefined;
    let error;
    try {
      response = await handler(event, dummyContext);
    } catch (err) {
      error = err;
    }

    expect(response).not.toBeFalsy();
    expect(response?.body).not.toBeFalsy();
    expect(error).toBeFalsy();
    expect(response?.isBase64Encoded).toBe(true);
    expect(response?.statusCode).toBe(200);
  });

  it('render google image with script', async () => {
    const event = generateEvent(
      'POST',
      {},
      {
        url: 'https://www.google.com.au/',
        type: 'jpeg',
        jpegQuality: 50,
        viewport: { width: 1280, height: 600 },
        script: 'page.setViewport({ width: 720, height: 1024 })',
      }
    );

    let response: APIGatewayProxyResult | undefined;
    let error;
    try {
      response = await handler(event, dummyContext);
    } catch (err) {
      error = err;
    }

    const dimension = imageSize(Buffer.from(response?.body || '', 'base64'));
    expect(dimension.height).toBe(1024);
    expect(dimension.width).toBe(720);

    expect(response).not.toBeFalsy();
    expect(response?.body).not.toBeFalsy();
    expect(error).toBeFalsy();
    expect(response?.isBase64Encoded).toBe(true);
    expect(response?.statusCode).toBe(200);
  });

  it('render google selector with POST', async () => {
    const event = generateEvent(
      'POST',
      {},
      {
        url: 'https://www.google.com.au/',
        type: 'png',
        selector: 'body',
        viewport: { width: 1280, height: 600 },
      }
    );

    let response: APIGatewayProxyResult | undefined;
    let error;
    try {
      response = await handler(event, dummyContext);
    } catch (err) {
      error = err;
    }

    expect(response).not.toBeFalsy();
    expect(response?.body).not.toBeFalsy();
    expect(error).toBeFalsy();
    expect(response?.isBase64Encoded).toBe(true);
    expect(response?.statusCode).toBe(200);
  });

  it('render google pdf with POST', async () => {
    const event = generateEvent(
      'POST',
      {},
      {
        url: 'https://www.google.com.au/',
        type: 'pdf',
      }
    );

    let response: APIGatewayProxyResult | undefined;
    let error;
    try {
      response = await handler(event, dummyContext);
    } catch (err) {
      error = err;
    }

    expect(response).not.toBeFalsy();
    expect(response?.body).not.toBeFalsy();

    const pdfString = Buffer.from(response?.body || '', 'base64').toString();

    expect(pdfString).toStartWith('%PDF-');
    expect(error).toBeFalsy();
    expect(response?.isBase64Encoded).toBe(true);
    expect(response?.statusCode).toBe(200);
  });

  it('render content pdf with POST', async () => {
    const event = generateEvent(
      'POST',
      {},
      {
        content: '<h1>Hello</h1><p>world</p>',
        type: 'pdf',
      }
    );

    let response: APIGatewayProxyResult | undefined;
    let error;
    try {
      response = await handler(event, dummyContext);
    } catch (err) {
      error = err;
    }

    expect(response).not.toBeFalsy();
    expect(response?.body).not.toBeFalsy();

    const pdfString = Buffer.from(response?.body || '', 'base64').toString();

    expect(pdfString).toStartWith('%PDF-');
    expect(error).toBeFalsy();
    expect(response?.isBase64Encoded).toBe(true);
    expect(response?.statusCode).toBe(200);
  });

  it('render multiple files zipped', async () => {
    const event = generateEvent(
      'POST',
      {},
      {
        type: 'zip',
        pages: [
          { url: 'https://www.yahoo.co.jp/', type: 'png', jpegQuality: 50, fullPage: true, saveFilename: 'yahoo.png' },
          {
            url: 'https://www.amazon.co.jp/',
            type: 'jpeg',
            jpegQuality: 50,
            fullPage: true,
            saveFilename: 'amazon.jpg',
          },
          {
            url: 'https://www.google.com.au/',
            type: 'pdf',
            jpegQuality: 50,
            fullPage: true,
            saveFilename: 'google.pdf',
          },
        ],
      }
    );

    let response: APIGatewayProxyResult | undefined;
    let error;
    try {
      response = await handler(event, dummyContext);
    } catch (err) {
      error = err;
    }

    expect(response).not.toBeFalsy();
    expect(response?.body).not.toBeFalsy();

    const zipBuffer = Buffer.from(response?.body || '', 'base64');
    const stream = new Duplex();
    stream.push(zipBuffer);
    stream.push(null);

    const fileNames = ['yahoo.png', 'amazon.jpg', 'google.pdf'];
    let i = 0;
    await new Promise(resolve => {
      stream
        .pipe(unzip.Parse())
        .on('entry', (entry: any) => {
          const filePath = entry.path;

          expect(filePath).toBe(fileNames[i]);
          i++;
        })
        .on('end', () => {
          resolve();
        });
    });

    expect(error).toBeFalsy();
    expect(response?.isBase64Encoded).toBe(true);
    expect(response?.statusCode).toBe(200);
  });

  it('errors when no body with POST', async () => {
    const event = generateEvent('POST', {}, null);

    let response: APIGatewayProxyResult | undefined;
    let error;
    try {
      response = await handler(event, dummyContext);
    } catch (err) {
      error = err;
    }

    expect(response).not.toBeFalsy();
    expect(response?.body).not.toBeFalsy();
    expect(error).toBeFalsy();
    expect(response?.isBase64Encoded).toBe(true);
    expect(response?.statusCode).toBe(400);
  });

  it('errors when missing type with POST', async () => {
    const event = generateEvent(
      'POST',
      {
        url: 'https://www.google.com.au/',
      },
      null
    );

    let response: APIGatewayProxyResult | undefined;
    let error;
    try {
      response = await handler(event, dummyContext);
    } catch (err) {
      error = err;
    }

    expect(response).not.toBeFalsy();
    expect(response?.body).not.toBeFalsy();
    expect(error).toBeFalsy();
    expect(response?.isBase64Encoded).toBe(true);
    expect(response?.statusCode).toBe(400);
  });
});
