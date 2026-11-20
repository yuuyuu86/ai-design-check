import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cli=path.join(root,'bin/ai-design-check.js');
function run(args, timeout=90000){return new Promise(resolve=>{const child=spawn(process.execPath,[cli,...args],{cwd:root});let stdout='',stderr='';const timer=setTimeout(()=>child.kill(),timeout);child.stdout.on('data',c=>stdout+=c);child.stderr.on('data',c=>stderr+=c);child.on('error',e=>{clearTimeout(timer);resolve({code:2,stdout,stderr:e.message})});child.on('close',code=>{clearTimeout(timer);resolve({code:code??2,stdout,stderr:stderr||(code===null?'処理がタイムアウトしました':'')})})})}
const server=http.createServer(async(req,res)=>{
 if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(await readFile(path.join(root,'gui/index.html')));return}
 if(req.method!=='POST'||req.url!=='/check'||req.headers.origin!==`http://127.0.0.1:${server.address().port}`){res.writeHead(403);res.end();return}
 let body='';let dir;try{for await(const chunk of req){body+=chunk;if(body.length>12_000_000)throw Error('ファイルは8MB以下にしてください')}
 const {mode,target,upload}=JSON.parse(body);if(!['file','scan'].includes(mode))throw Error('対象を選択してください');let input=typeof target==='string'?target.trim():'';
 if(upload){if(mode!=='file'||typeof upload.name!=='string'||typeof upload.content!=='string')throw Error('ファイルを確認してください');const name=path.basename(upload.name);if(!/\.(html?|css|jsx?|tsx?|vue|svelte|swift|kt|dart|php)$/i.test(name))throw Error('対応するファイルを選択してください');dir=await mkdtemp(path.join(os.tmpdir(),'design-check-'));input=path.join(dir,name);await writeFile(input,Buffer.from(upload.content,'base64'))}
 if(!input||input.startsWith('-'))throw Error('URLまたはファイルのパスを入力してください');if(mode==='scan'&&!/^https?:\/\//i.test(input))throw Error('http:// または https:// から始まるURLを入力してください');
 const result=await run(mode==='scan'?['scan',input,'--json']:[path.resolve(input),'--json']);let data;try{data=JSON.parse(result.stdout)}catch{}let screenshot=null,previewError=null;
 if(mode==='scan'&&data?.pages?.[0]&&!data.pages[0].error){dir=await mkdtemp(path.join(os.tmpdir(),'design-check-'));const image=path.join(dir,'preview.png');const shot=await run(['shot',input,'--out',image],45000);try{if(shot.code===0)screenshot=(await readFile(image)).toString('base64');else previewError=shot.stderr||'プレビューを取得できませんでした'}catch{previewError='プレビューを取得できませんでした'}}
 res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({code:result.code,output:result.stdout||result.stderr,stderr:result.stderr,data,screenshot,previewError,uploaded:!!upload}));
 }catch(e){res.writeHead(400);res.end(e.message)}finally{if(dir)await rm(dir,{recursive:true,force:true})}
});server.listen(0,'127.0.0.1',()=>console.log(`GUI: http://127.0.0.1:${server.address().port}`));
