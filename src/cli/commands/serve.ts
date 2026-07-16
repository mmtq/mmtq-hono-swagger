import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from '../../config/loader';

export async function serveAction(options: { port?: string }) {
  const config = await loadConfig();
  const port = parseInt(options.port || '8080', 10);
  const serveDir = config.outputDir;

  const server = http.createServer((req, res) => {
    let filePath = path.resolve(path.join(serveDir, req.url === '/' ? 'index.html' : req.url || ''));
    
    // basic security against directory traversal
    if (!filePath.startsWith(path.resolve(serveDir))) {
       res.statusCode = 403;
       res.end('Forbidden');
       return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      
      const ext = path.extname(filePath);
      let contentType = 'text/html';
      if (ext === '.json') contentType = 'application/json';
      if (ext === '.yaml' || ext === '.yml') contentType = 'application/x-yaml';

      res.setHeader('Content-Type', contentType);
      res.end(data);
    });
  });

  server.listen(port, () => {
    console.log(`Swagger UI is being served at http://localhost:${port}`);
  });
}
