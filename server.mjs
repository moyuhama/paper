import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(import.meta.dirname, 'dist');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.mp3':'audio/mpeg','.wav':'audio/wav'};
const server = http.createServer(async (req,res) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    if (path.startsWith(resolve(root,'admin') + sep) || path === resolve(root,'admin')) {
      const remote=req.socket.remoteAddress;
      if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote)){res.writeHead(403).end('Local authoring only');return;}
    }
    const file = path === root ? resolve(root,'index.html') : path;
    const body = await readFile(file); res.writeHead(200, {'Content-Type':mime[extname(file)] || 'application/octet-stream','Cache-Control':'no-store'}).end(body);
  } catch { res.writeHead(404).end('Not found'); }
});
const host=process.env.HOST||'127.0.0.1';
server.listen(Number(process.env.PORT || 4173),host,()=>console.log('Listening: http://' + host + ':' + server.address().port));
