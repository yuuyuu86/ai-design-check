import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = http.createServer(async (req,res) => {
  if (req.method === 'GET' && req.url === '/') { res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); res.end(await readFile(path.join(root,'gui/index.html'))); return; }
  if (req.method !== 'POST' || req.url !== '/check' || req.headers.origin !== `http://127.0.0.1:${server.address().port}`) { res.writeHead(403); res.end(); return; }
  let body=''; for await (const chunk of req) { body+=chunk; if(body.length>10000){res.writeHead(413);res.end();return;} }
  try {
    const {mode,target}=JSON.parse(body);
    if (!['file','scan'].includes(mode) || typeof target !== 'string' || !target.trim() || target.startsWith('-')) throw Error('入力を確認してください');
    if(mode==='scan' && !/^https?:\/\//i.test(target)) throw Error('http:// または https:// から始まるURLを入力してください');
    const args=mode==='scan'?['scan',target]:[path.resolve(target)];
    const child=spawn(process.execPath,[path.join(root,'bin/ai-design-check.js'),...args,'--json'],{cwd:root});
    let output=''; child.stdout.on('data',c=>output+=c); child.stderr.on('data',c=>output+=c);
    child.on('error',e=>{res.writeHead(500);res.end(e.message)});
    child.on('close',code=>{if(!res.writableEnded){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({code,output}));}});
  } catch(e){res.writeHead(400);res.end(e.message)}
});
server.listen(0,'127.0.0.1',()=>console.log(`GUI: http://127.0.0.1:${server.address().port}`));
