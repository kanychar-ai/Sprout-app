const fs=require('fs'),path=require('path');const{JSDOM,VirtualConsole}=require('jsdom');
const APP=path.join(process.cwd(),'app');
let html=fs.readFileSync(path.join(APP,'index.html'),'utf8')
 .replace(/<script src="(config|id-verify|app|kyc|docs)\.js(?:\?[^"]*)?"><\/script>/g,'')
 .replace(/<link rel="stylesheet" href="app\.css(?:\?[^"]*)?">/,'');
const vc=new VirtualConsole(); vc.sendTo(console,{omitJSDOMErrors:true});
const dom=new JSDOM(html,{url:'http://localhost/app/index.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
['id-verify.js','app.js','kyc.js','docs.js'].forEach(f=>dom.window.eval(fs.readFileSync(path.join(APP,f),'utf8')));
const w=dom.window,d=w.document;
console.log('toggles found:', d.querySelectorAll('[data-view="tax"] .seg.toggle').length);
const ans=[]; d.querySelectorAll('[data-view="tax"] .seg.toggle').forEach(s=>{const on=s.querySelector('button.on');ans.push(on?on.textContent.trim():'NONE');});
console.log('default compliance answers:', ans);
w.SproutPrescreen.setRules([{key:'fatca',config:{allowed:['Yes']}}]);
console.log('evaluate:', JSON.stringify(w.SproutPrescreen.evaluate()));
