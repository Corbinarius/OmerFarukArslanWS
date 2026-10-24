import { getStore } from '@netlify/blobs';
import { verifyRequestOrigin } from '@netlify/identity';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export default async(request:Request)=>{
 try{
  if(request.method!=='POST')return reply({error:'Yöntem desteklenmiyor.'},405);
  verifyRequestOrigin(request);
  const raw=await request.text();if(raw.length>100)return reply({error:'Geçersiz oturum.'},400);
  const {id}=JSON.parse(raw);if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return reply({error:'Geçersiz oturum.'},400);
  const store=getStore({name:'portfolio-presence',consistency:'strong'}),now=Date.now();
  // Minute buckets avoid reading every visitor blob. No IP or identifying profile is stored.
  const minute=Math.floor(now/60000);await store.set(`online/${minute}/${id}`,'');
  const lists=await Promise.all([minute,minute-1].map(m=>store.list({prefix:`online/${m}/`})));
  const ids=new Set(lists.flatMap(l=>l.blobs.map(b=>b.key.split('/').pop())));
  return reply({count:ids.size,windowSeconds:120});
 }catch{return reply({error:'Sayaç şu anda kullanılamıyor.'},503);}
};
