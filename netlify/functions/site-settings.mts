import { getStore } from '@netlify/blobs';
import { getUser, refreshSession, verifyRequestOrigin } from '@netlify/identity';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default async(request:Request)=>{
 try{
  const store=getStore({name:'portfolio-settings',consistency:'strong'});
  if(request.method==='GET')return reply({settings:await store.get('profile',{type:'json'})});
  if(request.method!=='PUT')return reply({error:'Yöntem desteklenmiyor.'},405);
  verifyRequestOrigin(request);await refreshSession();const user=await getUser();
  if(!user?.roles?.includes('admin'))return reply({error:'Yönetici girişi gerekiyor.'},403);
  const raw=await request.text();if(raw.length>12000)return reply({error:'İçerik çok uzun.'},413);
  const data=JSON.parse(raw);const result:Record<string,string>={};
  for(const [key,max] of Object.entries({about:2500,aboutTags:500,work:2500,workTags:500,linkedin:350})){
   if(typeof data[key]!=='string'||data[key].length>max)return reply({error:'Alanlar geçersiz veya çok uzun.'},400);
   result[key]=data[key].trim();
  }
  if(result.linkedin){const u=new URL(result.linkedin);if(u.protocol!=='https:'||!['linkedin.com','www.linkedin.com'].includes(u.hostname)||!u.pathname.startsWith('/in/')||u.username||u.password)return reply({error:'Geçerli bir HTTPS LinkedIn profil adresi girin.'},400);}
  await store.setJSON('profile',result);return reply({settings:result});
 }catch{return reply({error:'Ayarlar kaydedilemedi veya alınamadı.'},400);}
};
