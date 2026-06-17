const fs=require('fs'),path=require('path');const{JSDOM}=require('jsdom');
let html=fs.readFileSync('app/index.html','utf8')
  .replace(/<script src="config\.js"><\/script>/,'')
  .replace(/<script src="app\.js"><\/script>/,'')
  .replace(/<link rel="stylesheet" href="app\.css">/,'');
const dom=new JSDOM(html,{url:'http://localhost/app/index.html',runScripts:'dangerously',pretendToBeVisual:true});
dom.window.eval(fs.readFileSync('app/app.js','utf8'));
const {document}=dom.window;
const IMMERSIVE={home:1,onboard:1,login:1,role:1,prescreen:1};
const SHOW_NAV={home:1,calc:1,status:1,repay:1,me:1};
const views=[...document.querySelectorAll('.view')].map(v=>v.dataset.view);
console.log('views:',views.length);
for(const v of views){
  const sec=document.querySelector(`[data-view="${v}"]`);
  const goers=[...sec.querySelectorAll('[data-go]')].map(e=>e.dataset.go);
  const hasBack=!IMMERSIVE[v];      // top-bar back arrow shown on non-immersive
  const hasNav=!!SHOW_NAV[v];
  const exits=[];
  if(hasBack)exits.push('back');
  if(hasNav)exits.push('nav');
  if(goers.length)exits.push('go:['+[...new Set(goers)].join(',')+']');
  const ok = hasBack||hasNav||goers.length>0;
  console.log((ok?'OK  ':'DEAD')+' '+v.padEnd(10)+' -> '+(exits.join(' | ')||'NONE'));
}
