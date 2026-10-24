/* Read-only source adapters. Uploaded source content remains in Netlify Blobs. */
(() => {
 const LIMIT=16*1024*1024, FILE_LIMIT=256*1024;
 const supported=/(?:\.(?:c|h|cpp|hpp|cc|cxx|hxx|hh|v|sv|svh|vhd|vhdl|tcl|s|asm|ld|ioc|ini|txt|md|json|yaml|yml|xml|py|sh|cmake|cfg|sdc|xdc|launch|project|cproject|map|hex|csv)|(?:^|\/)(?:Makefile|README|LICENSE))$/i;
 const safe=p=>!p.startsWith('/')&&p.split('/').every(x=>x&&x!=='.'&&x!=='..'&&!/[\\\x00-\x1f]/.test(x)&&!['.git','.env','.ssh','node_modules','secrets'].includes(x.toLowerCase()));
 async function request(url){const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(r.status===403||r.status===429?'GitHub erişim sınırına ulaşıldı. Daha sonra deneyin.':`Kaynak alınamadı (${r.status}). Deponun herkese açık olduğunu kontrol edin.`);return r;}
 async function bounded(stream,limit){const reader=stream.getReader(),chunks=[];let size=0;while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('Dosya boyutu sınırı aşıldı.');}chunks.push(value);}return new Uint8Array(await new Blob(chunks).arrayBuffer());}
 async function github(project){
  const url=new URL(project.repoUrl),parts=url.pathname.split('/').filter(Boolean);
  if(url.hostname!=='github.com'||parts.length!==2)throw Error('Depo kök adresini kullanın: https://github.com/kullanici/depo');
  const base=`https://api.github.com/repos/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1].replace(/\.git$/,''))}`;
  const repo=await(await request(base)).json();
  const tree=await(await request(`${base}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`)).json();
  if(tree.truncated)throw Error('Depo ağacı GitHub sınırını aşıyor. Kaynak klasörünü yükleyin.');
  project.sourceFiles=tree.tree.filter(f=>f.type==='blob'&&safe(f.path)&&supported.test(f.path)).map(f=>({path:f.path,size:f.size,sha:f.sha,remoteBase:base}));
 }
 async function zip(project){
  const r=await request(`/.netlify/functions/projects?download=${encodeURIComponent(project.id)}`);
  const bytes=await bounded(r.body,LIMIT),v=new DataView(bytes.buffer);let end=-1;
  for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(v.getUint32(p,true)===0x06054b50){end=p;break;}
  if(end<0)throw Error('Geçerli ZIP dizini bulunamadı.');
  const count=v.getUint16(end+10,true);let at=v.getUint32(end+16,true),expanded=0;const files=[];
  if(count>10000)throw Error('ZIP çok fazla dosya içeriyor.');
  for(let n=0;n<count;n++){
   if(v.getUint32(at,true)!==0x02014b50)throw Error('ZIP dizini desteklenmiyor.');
   const flags=v.getUint16(at+8,true),method=v.getUint16(at+10,true),packed=v.getUint32(at+20,true),size=v.getUint32(at+24,true),len=v.getUint16(at+28,true),extra=v.getUint16(at+30,true),comment=v.getUint16(at+32,true),offset=v.getUint32(at+42,true);
   const path=new TextDecoder().decode(bytes.subarray(at+46,at+46+len));at+=46+len+extra+comment;
   if(!safe(path)||!supported.test(path))continue;
   expanded+=size;if(expanded>LIMIT||files.length>=2000)throw Error('ZIP kaynak sınırı aşıldı.');
   files.push({path,size,zip:{bytes,offset,packed,method,flags}});
  }project.sourceFiles=files;
 }
 const cache=new WeakMap();
 async function content(project,file,index){
  if(cache.has(file))return cache.get(file);if(!project.chunked && file.size>FILE_LIMIT)throw Error('Dosya 256 KB görüntüleme sınırını aşıyor.');let text;
  if(project.chunked){
   const bytes=await chunkedBytes(project,file,Math.min(file.size,FILE_LIMIT));
   const decoder=new TextDecoder('utf-8',{fatal:true});text=decoder.decode(bytes,{stream:file.size>FILE_LIMIT});
  }else if(file.remoteBase){const data=await(await request(`${file.remoteBase}/git/blobs/${encodeURIComponent(file.sha)}`)).json();if(data.encoding!=='base64')throw Error('Kodlama desteklenmiyor.');text=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(data.content.replace(/\s/g,'')),c=>c.charCodeAt(0)));}
  else if(file.zip){
   const {bytes,offset,packed,method,flags}=file.zip,v=new DataView(bytes.buffer);
   if(flags&1)throw Error('Şifreli ZIP desteklenmiyor.');if(v.getUint32(offset,true)!==0x04034b50)throw Error('ZIP başlığı bozuk.');
   const start=offset+30+v.getUint16(offset+26,true)+v.getUint16(offset+28,true);if(start+packed>bytes.length)throw Error('ZIP dosyası eksik.');
   let stream=new Blob([bytes.subarray(start,start+packed)]).stream();if(method===8)stream=stream.pipeThrough(new DecompressionStream('deflate-raw'));else if(method!==0)throw Error('ZIP sıkıştırma yöntemi desteklenmiyor.');
   const raw=await bounded(stream,FILE_LIMIT);if(raw.length!==file.size)throw Error('ZIP dosya boyutu tutarsız.');text=new TextDecoder('utf-8',{fatal:true}).decode(raw);
  }else{const data=await(await request(`/.netlify/functions/projects?source=${encodeURIComponent(project.id)}&index=${index}`)).json();if(typeof data.content!=='string')throw Error('Dosya okunamadı.');text=data.content;}
  if(text.includes('\0'))throw Error('İkili dosyalar metin olarak görüntülenemez.');cache.set(file,text);return text;
 }
 async function chunkedBytes(project,file,length){
  const chunks=[];const end=file.offset+length;
  for(let part=Math.floor(file.offset/project.chunkSize);part*project.chunkSize<end;part++){
   const r=await request(`/.netlify/functions/projects?chunks=${encodeURIComponent(project.id)}&part=${part}`);
   const bytes=await bounded(r.body,project.chunkSize);
   chunks.push(bytes.slice(Math.max(0,file.offset-part*project.chunkSize),Math.min(bytes.length,end-part*project.chunkSize)));
  }
  const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());if(bytes.length!==length)throw Error('Dosya parçaları eksik.');return bytes;
 }
 window.SourceBrowser={async load(project){if(project.sourceFiles?.length)return;if(project.chunked){const data=await(await request(`/.netlify/functions/projects?manifest=${encodeURIComponent(project.id)}`)).json();project.sourceFiles=data.sourceFiles;return;}if(project.archive)await zip(project);else if(project.repoUrl)await github(project);},content,async download(project,file,index){return project.chunked?new Blob([await chunkedBytes(project,file,file.size)],{type:'application/octet-stream'}):new Blob([await content(project,file,index)],{type:'text/plain;charset=utf-8'});}};
})();
