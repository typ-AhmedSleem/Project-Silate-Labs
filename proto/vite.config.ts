import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

export default defineConfig({
  publicDir: 'assets',
  server: {
    port: 5173,
    open: false,
  },
  plugins: [
    {
      name: 'serve-assets-prefix',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/assets/')) {
            const cleanUrl = req.url.split('?')[0];
            const relativePath = cleanUrl.replace(/^\/assets\//, '');
            const filePath = path.resolve(__dirname, 'assets', relativePath);
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              const contentType = cleanUrl.endsWith('.glb') ? 'model/gltf-binary' :
                                  cleanUrl.endsWith('.gltf') ? 'model/gltf+json' :
                                  cleanUrl.endsWith('.json') ? 'application/json' : 'application/octet-stream';
              res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-cache'
              });
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }
          next();
        });
      }
    }
  ]
});
