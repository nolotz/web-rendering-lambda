import { handler } from './render';
import * as http from 'http';
import * as url from 'url';

const PORT = 8008;

http
  .createServer(function(request, response) {
    let bodyChunks = [];

    request.on('data', (chunk) => {
      bodyChunks.push(chunk);
    }).on('end', () => {
      let requestUrl = url.parse(request.url, true);
      let body = Buffer.concat(bodyChunks).toString();

      let event = {
        body,
        isBase64Encoded: false,
        httpMethod: request.method.toUpperCase(),
        path: requestUrl.pathname,
        headers: { },
        queryStringParameters: requestUrl.query,
        requestContext: {
          httpMethod: request.method.toUpperCase(),
          path: requestUrl.pathname
        }
      };
  
      handler(event as any, {}, (error, responseObj) => {
        if (error) {
          response.end(error);
          return;
        }
  
        response.writeHead(responseObj.statusCode, responseObj.headers);
        let buf = Buffer.from(responseObj.body, "base64");
        response.write(buf);
        response.end();
      });
    });
  })
  .listen(PORT);

console.log(`Server started on http://localhost:${PORT}`);
