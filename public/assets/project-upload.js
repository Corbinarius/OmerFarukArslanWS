/* Fixed-size, hash-verified chunks keep every upload request below 512 KiB. */
(() => {
  const CHUNK=512*1024, MAX=100*1024*1024, endpoint='/.netlify/functions/projects';
  let pending=null;
  const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  async function call(url,options){
    for(let attempt=0;;attempt++){
      try{
        const response=await fetch(url,{credentials:'same-origin',signal:AbortSignal.timeout(45000),...options});
        const data=await response.json();
        if(!response.ok)throw Object.assign(Error(data.error||'Yükleme başarısız.'),{status:response.status});
        return data;
      }catch(error){
        if(attempt>=3 || (error.status && error.status!==429 && error.status<500))throw error;
        await new Promise(resolve=>setTimeout(resolve,500*2**attempt));
      }
    }
  }
  async function publish(files,metadata,progress){
    if(files.length>10000)throw Error('En fazla 10000 dosya seçilebilir.');
    const manifest=[];let size=0;
    for(const {file,path} of files){manifest.push({path,size:file.size,offset:size});size+=file.size;}
    if(size>MAX)throw Error('Toplam kaynak boyutu 100 MB sınırını aşıyor.');
    // Validate each file incrementally; never decode the entire project in memory.
    for(let i=0;i<files.length;i++){
      progress(`Dosyalar kontrol ediliyor: ${i+1}/${files.length}`);
      const decoder=new TextDecoder('utf-8',{fatal:true});const reader=files[i].file.stream().getReader();
      try{while(true){const {value,done}=await reader.read();if(done)break;if(decoder.decode(value,{stream:true}).includes('\0'))throw Error('İkili dosya');}decoder.decode();}
      catch{await reader.cancel();throw Error(`UTF-8 metin olmayan dosya: ${files[i].path}`);}
    }
    const blob=new Blob(files.map(x=>x.file));const hashes=[];
    for(let start=0;start<size;start+=CHUNK){progress(`Parçalar hazırlanıyor: %${Math.round(start/Math.max(size,1)*100)}`);hashes.push(await hash(await blob.slice(start,start+CHUNK).arrayBuffer()));}
    const fingerprint=await hash(new TextEncoder().encode(JSON.stringify({manifest,hashes,metadata:[...metadata]})));
    if(pending?.fingerprint!==fingerprint){
      const data=new FormData();for(const [key,value] of metadata)data.set(key,value);
      data.set('manifest',JSON.stringify(manifest));data.set('chunkHashes',JSON.stringify(hashes));
      if(new TextEncoder().encode(JSON.stringify(manifest)).byteLength>2500000)throw Error('Dosya yolları listesi çok büyük. Klasör adlarını kısaltın veya alt klasör seçin.');
      const begun=await call(`${endpoint}?action=begin`,{method:'POST',body:data});
      pending={id:begun.id,fingerprint};
    }
    const id=pending.id;
    let status;
    try{status=await call(`${endpoint}?action=status&id=${id}`,{method:'POST'});}
    catch(error){if(error.status===404||error.status===410)pending=null;throw error;}
    if(status.complete){pending=null;return {project:status.project};}
    let completed=size-status.missing.reduce((sum,i)=>sum+Math.min(CHUNK,size-i*CHUNK),0);
    progress(`Yükleniyor: %${Math.floor(completed/Math.max(size,1)*100)} (${(completed/1048576).toFixed(1)} / ${(size/1048576).toFixed(1)} MB)`);
    // Sequential chunks bound server concurrency; many small files share a chunk.
    for(const part of status.missing){
      const body=blob.slice(part*CHUNK,Math.min(size,(part+1)*CHUNK));
      await call(`${endpoint}?action=part&id=${id}&part=${part}`,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body});
      completed+=body.size;progress(`Yükleniyor: %${Math.floor(completed/Math.max(size,1)*100)} (${(completed/1048576).toFixed(1)} / ${(size/1048576).toFixed(1)} MB)`);
    }
    progress('Tüm parçalar doğrulanıyor ve proje yayımlanıyor…');
    const result=await call(`${endpoint}?action=complete&id=${id}`,{method:'POST'});pending=null;return result;
  }
  window.ProjectUpload={publish};
})();
