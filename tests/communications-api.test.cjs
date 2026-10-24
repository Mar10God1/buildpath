const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { readFileSync } = require('node:fs');
const { NextRequest } = require('next/server');
let currentAuth = null;
const root = path.resolve(__dirname, '..');
const serverPath = path.join(root,'lib/supabase/server.ts');
require.cache[serverPath] = { id:serverPath, filename:serverPath, loaded:true, exports:{supabaseForRequest:async()=>currentAuth} };
require.extensions['.ts'] = (mod, filename) => {
  const source=readFileSync(filename,'utf8').replace(/from "@\/(.*?)"/g,(_,name)=>`from ${JSON.stringify(path.join(root,name+'.ts'))}`);
  mod._compile(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
};
const imports = require('../app/api/communications/import/route.ts');
const actions = require('../app/api/communications/actions/route.ts');
const records = [{kind:'sms',contact:'Client',phone:'+15125551234',direction:'inbound',occurredAt:'2026-10-24T14:00:00Z',text:'Please send an estimate'}];
const request = (body) => new NextRequest('http://localhost/api/communications/import',{method:'POST',body:JSON.stringify(body)});
const body = {projectId:'11111111-1111-4111-a111-111111111111',device:'iphone',records};

test('unauthenticated and forbidden phone imports cannot write evidence',async()=>{
  currentAuth=null; assert.equal((await imports.POST(request(body))).status,401);
  currentAuth={user:{id:'user'},supabase:{rpc:async()=>({data:{view_documents:true,upload_documents:false}}),from:()=>{throw new Error('must not write')}}};
  assert.equal((await imports.POST(request(body))).status,403);
});
test('selected phone import IDs are stable within a project and isolated across projects',async()=>{
  const seen=new Set(); let captured=[];
  currentAuth={user:{id:'user'},supabase:{rpc:async()=>({data:{view_documents:true,upload_documents:true}}),from:(table)=>{
    assert.equal(table,'evidence'); return {upsert:(rows,opts)=>{assert.equal(opts.ignoreDuplicates,true);captured=rows;return {select:async()=>({data:rows.filter(r=>{if(seen.has(r.id))return false;seen.add(r.id);return true}).map(r=>({id:r.id}))})}}};
  }}};
  const first=await imports.POST(request(body)); assert.equal(first.status,200); assert.equal((await first.json()).imported,1);
  const firstId=captured[0].id; assert.equal(captured[0].project_id,body.projectId);
  const second=await imports.POST(request(body)); assert.equal((await second.json()).skipped,1);
  await imports.POST(request({...body,projectId:'22222222-2222-4222-a222-222222222222'})); assert.notEqual(captured[0].id,firstId);
});
test('timeline suggestions require separate edit permission',async()=>{
  currentAuth={user:{id:'user'},supabase:{rpc:async()=>({data:{view_documents:true,edit_timeline:false}}),from:()=>{throw new Error('must not write')}}};
  assert.equal((await actions.POST(request({projectId:body.projectId,evidenceId:'evidence',index:0}))).status,403);
});
