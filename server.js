// UrbanIQ Anmoldeep - plot viewer backend. Node 18+, no dependencies:  node server.js
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000, PASS=process.env.ADMIN_PASSWORD||'change-me';
const ROOT=__dirname, PUB=path.join(ROOT,'public'), DATA=path.join(ROOT,'data'), GAL=path.join(PUB,'uploads','gallery');
const SECRET=process.env.SECRET||(()=>{const f=path.join(DATA,'.secret');try{return fs.readFileSync(f,'utf8')}catch{const s=crypto.randomBytes(32).toString('hex');fs.writeFileSync(f,s);return s}})();
if(PASS==='change-me')console.warn('\n  !! Set ADMIN_PASSWORD before going live (default is "change-me")\n');
const rd=n=>JSON.parse(fs.readFileSync(path.join(DATA,n),'utf8')), wr=(n,o)=>{const t=path.join(DATA,n+'.tmp');fs.writeFileSync(t,JSON.stringify(o,null,1));fs.renameSync(t,path.join(DATA,n))};
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.mp4':'video/mp4','.woff2':'font/woff2'};
const sign=p=>{const b=Buffer.from(JSON.stringify(p)).toString('base64url');return b+'.'+crypto.createHmac('sha256',SECRET).update(b).digest('base64url')};
const verify=t=>{try{const[b,s]=String(t).split('.');const want=crypto.createHmac('sha256',SECRET).update(b).digest('base64url');const ok=s.length===want.length&&crypto.timingSafeEqual(Buffer.from(s),Buffer.from(want));return ok&&JSON.parse(Buffer.from(b,'base64url')).exp>Date.now()}catch{return false}};
const tries=new Map();
const send=(res,code,obj,h={})=>{const b=JSON.stringify(obj);res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store',...h});res.end(b)};
const body=(req,max=30e6)=>new Promise((ok,no)=>{let n=0,c=[];req.on('data',d=>{n+=d.length;if(n>max){no(Object.assign(new Error('Too large'),{code:413}));req.destroy()}else c.push(d)});req.on('end',()=>{try{ok(c.length?JSON.parse(Buffer.concat(c)):{})}catch{no(Object.assign(new Error('Bad JSON'),{code:400}))}});req.on('error',no)});
const publicConfig=()=>{const c=rd('config.json');return{whatsapp:c.whatsapp,plots:c.plots,gallery:c.gallery.map(g=>({caption:g.caption,url:'uploads/gallery/'+g.file})),amenities:rd('amenities.json')}};
const STATUS=['available','booked','sold'];
async function api(req,res,u){
  const m=req.method,p=u.pathname;
  if(m==='GET'&&p==='/api/config')return send(res,200,publicConfig());
  if(m==='POST'&&p==='/api/login'){const ip=(process.env.TRUST_PROXY&&String(req.headers['x-forwarded-for']||'').split(',')[0].trim())||req.socket.remoteAddress,now=Date.now(),r=(tries.get(ip)||[]).filter(x=>now-x<6e5);
    if(r.length>=8)return send(res,429,{error:'Too many attempts. Try again in 10 minutes.'});
    const b=await body(req,1e4),a=Buffer.from(String(b.password||'')),z=Buffer.from(PASS);
    if(a.length===z.length&&crypto.timingSafeEqual(a,z)){tries.delete(ip);return send(res,200,{token:sign({exp:now+12*36e5})})}
    r.push(now);tries.set(ip,r);return send(res,401,{error:'Wrong password'})}
  if(!verify((req.headers.authorization||'').replace(/^Bearer /,'')))return send(res,401,{error:'Not authorised'});
  if(m==='GET'&&p==='/api/admin/config')return send(res,200,{...rd('config.json'),amenities:rd('amenities.json')});
  let mt;
  if(m==='PUT'&&(mt=p.match(/^\/api\/plots\/(\d\d)$/))){const c=rd('config.json'),pl=c.plots[mt[1]];if(!pl)return send(res,404,{error:'No such plot'});const b=await body(req,1e4);
    if(b.status!==undefined){if(!STATUS.includes(b.status))return send(res,400,{error:'Bad status'});pl.status=b.status}
    if(b.price!==undefined)pl.price=b.price===null||b.price===''?null:(Math.max(0,Number(b.price)||0)||null);wr('config.json',c);return send(res,200,pl)}
  if(m==='PUT'&&p==='/api/settings'){const b=await body(req,1e4),c=rd('config.json');if(b.whatsapp!==undefined){const w=String(b.whatsapp).replace(/\D/g,'');if(w.length<10)return send(res,400,{error:'Enter the number with country code, e.g. 919996661797'});c.whatsapp=w}wr('config.json',c);return send(res,200,{whatsapp:c.whatsapp})}
  if(m==='POST'&&p==='/api/gallery'){const b=await body(req),mm=/^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(b.dataUrl||'');if(!mm)return send(res,400,{error:'Image must be png, jpeg or webp'});
    const buf=Buffer.from(mm[2],'base64');if(buf.length>8e6)return send(res,413,{error:'Image too large (max 8 MB)'});
    const file=Date.now().toString(36)+crypto.randomBytes(3).toString('hex')+'.'+(mm[1]==='jpeg'?'jpg':mm[1]);fs.mkdirSync(GAL,{recursive:true});fs.writeFileSync(path.join(GAL,file),buf);
    const c=rd('config.json');c.gallery.push({file,caption:String(b.caption||'').slice(0,80)});wr('config.json',c);return send(res,200,{file})}
  if(m==='PUT'&&p==='/api/gallery'){const b=await body(req,1e6),c=rd('config.json'),have=new Set(c.gallery.map(g=>g.file));
    c.gallery=(b.items||[]).filter(i=>have.has(i.file)).map(i=>({file:i.file,caption:String(i.caption||'').slice(0,80)}));wr('config.json',c);return send(res,200,{ok:1})}
  if(m==='DELETE'&&(mt=p.match(/^\/api\/gallery\/([\w.-]+)$/))){const c=rd('config.json'),f=mt[1];if(!c.gallery.some(g=>g.file===f))return send(res,404,{error:'Not found'});
    c.gallery=c.gallery.filter(g=>g.file!==f);wr('config.json',c);try{fs.unlinkSync(path.join(GAL,f))}catch{}return send(res,200,{ok:1})}
  if(m==='PUT'&&p==='/api/amenities'){const b=await body(req,2e6);if(!Array.isArray(b.items))return send(res,400,{error:'items[] required'});
    const cats=new Set(['roads','transport','shopping','fuel','hospital','school','govt','power','lakes','industry','banks','lifestyle']);
    const items=b.items.map(a=>({n:String(a.n||'').slice(0,80),c:a.c,la:+a.la,ln:+a.ln,km:+a.km||0,...(a.ap?{ap:1}:{})})).filter(a=>a.n&&cats.has(a.c)&&isFinite(a.la)&&isFinite(a.ln)&&Math.abs(a.la)<=90&&Math.abs(a.ln)<=180);
    wr('amenities.json',items);return send(res,200,{saved:items.length})}
  return send(res,404,{error:'Unknown endpoint'})}
function serve(req,res,u){let f;try{f=decodeURIComponent(u.pathname)}catch{res.writeHead(400);return res.end()}if(f.endsWith('/'))f+='index.html';const fp=path.normalize(path.join(PUB,f));
  if(!fp.startsWith(PUB+path.sep)){res.writeHead(403);return res.end('Forbidden')}
  fs.stat(fp,(e,s)=>{if(e||!s.isFile()){res.writeHead(404,{'Content-Type':'text/plain'});return res.end('Not found')}
    const ext=path.extname(fp).toLowerCase(),h={'Content-Type':MIME[ext]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':ext==='.html'?'no-cache':'public, max-age=604800'};
    if(f.endsWith('admin.html'))h['X-Robots-Tag']='noindex';res.writeHead(200,h);fs.createReadStream(fp).pipe(res)})}
http.createServer(async(req,res)=>{const u=new URL(req.url,'http://x');
  try{if(u.pathname.startsWith('/api/'))await api(req,res,u);else if(req.method==='GET'||req.method==='HEAD')serve(req,res,u);else{res.writeHead(405);res.end()}}
  catch(e){send(res,e.code===413||e.code===400?e.code:500,{error:e.message||'Server error'})}
}).listen(PORT,()=>console.log(`Viewer:  http://localhost:${PORT}/\nAdmin:   http://localhost:${PORT}/admin.html`));
