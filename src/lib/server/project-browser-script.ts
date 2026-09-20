// This program runs only in a disposable VM with no application credentials.
export const projectBrowserScript = String.raw`
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const input = JSON.parse(await fs.readFile('/vercel/sandbox/input.json', 'utf8'));
const browser = await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage']});
const context = await browser.newContext({viewport:{width:1280,height:900},locale:'ko-KR',serviceWorkers:'block',acceptDownloads:false});
let requests=0;
await context.route('**/*', async route=>{
  const r=route.request(); let u;
  try {u=new URL(r.url())} catch {return route.abort()}
  if (++requests>400 || !['GET','HEAD'].includes(r.method()) || u.protocol!=='https:' || u.username || u.password || u.port || ['media'].includes(r.resourceType())) return route.abort();
  if (r.isNavigationRequest() && r.frame().parentFrame()) return route.abort();
  return route.continue();
});
await context.routeWebSocket('**/*',socket=>socket.close());
const page=await context.newPage();
page.setDefaultTimeout(4000);
const pages=[]; const failures=[]; const queue=[input.url]; const visited=new Set();
const deadline=Date.now()+26000;
try {
  while(queue.length && pages.length<3 && Date.now()<deadline-3000){
    const url=queue.shift(); if(visited.has(url))continue; visited.add(url);
    try {
      const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:Math.min(9000,deadline-Date.now())});
      if (!response?.ok()) throw Error('http');
      await page.waitForLoadState('networkidle',{timeout:2000}).catch(()=>{});
      // Give client-rendered and scroll-revealed content a bounded chance to appear.
      await page.waitForTimeout(800);
      const height=await page.evaluate(()=>document.documentElement.scrollHeight);
      const steps=Math.min(14,Math.ceil(height/800));
      for(let i=0;i<=steps && Date.now()<deadline-2000;i++){
        await page.evaluate(y=>window.scrollTo(0,y),Math.round(height*i/steps));await page.waitForTimeout(120);
      }
      // Native disclosure text is public content; reveal it without running click handlers.
      await page.evaluate(()=>document.querySelectorAll('details').forEach(el=>el.open=true));
      const result=await page.evaluate(()=>{
        const visible=el=>el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&!el.closest('[aria-hidden="true"],[hidden],script,style,template,noscript');
        const text=Array.from(document.querySelectorAll('h1,h2,h3,h4,p,li,dt,dd,label,button,summary,a,td,th')).filter(visible).map(el=>el.innerText.trim()).filter(Boolean);
        const body=document.body.innerText.trim();
        return {title:document.title.slice(0,160),text:(text.join('\n').length>150?Array.from(new Set(text)).join('\n'):body).slice(0,10000),links:Array.from(document.querySelectorAll('a[href]')).filter(visible).map(a=>({url:a.href,label:a.innerText})).slice(0,100)};
      });
      const current=new URL(page.url());
      if(current.protocol!=='https:' || current.search || current.hash || current.username || current.password) throw Error('unsupported redirect');
      await page.evaluate(()=>window.scrollTo(0,0)); await page.waitForTimeout(200);
      const jpeg=await page.screenshot({type:'jpeg',quality:55,timeout:2500,animations:'disabled'});
      pages.push({url:current.href,title:result.title,text:result.text,screenshot:jpeg.length<=200000?jpeg.toString('base64'):undefined});
      if(pages.length===1) for(const link of result.links){
        try { const u=new URL(link.url); if(u.origin!==current.origin||u.search||u.hash||u.pathname===current.pathname||/login|signin|logout|delete|remove|auth|checkout|subscribe|download|signout|privacy|terms|\/(new|create|edit)(\/|$)|\.(zip|dmg|exe|pdf)$/i.test(u.pathname))continue;
          if(link.label.trim())queue.push(u.href);
        }catch{}
      }
    }catch{failures.push(url)}
  }
  await fs.writeFile('/vercel/sandbox/result.json',JSON.stringify({pages,failures}));
} finally {await browser.close()}
`;
