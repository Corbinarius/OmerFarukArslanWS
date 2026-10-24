import { getStore } from '@netlify/blobs';
export default async()=>{
 const store=getStore({name:'portfolio-presence',consistency:'strong'});
 const threshold=Math.floor(Date.now()/60000)-3;
 const listed=await store.list({prefix:'online/'});
 const keys=listed.blobs.filter(b=>Number(b.key.split('/')[1])<threshold).slice(0,200).map(b=>b.key);
 for(let i=0;i<keys.length;i+=20)await Promise.all(keys.slice(i,i+20).map(key=>store.delete(key)));
};
export const config={schedule:'*/5 * * * *'};
