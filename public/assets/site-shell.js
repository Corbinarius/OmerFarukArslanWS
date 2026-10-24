(() => {
 const $=id=>document.getElementById(id),dialog=$('admin-dialog');
 window.openAdminPanel=()=>{if(!dialog.open)dialog.showModal();$('project-manager').hidden=false;$('open-project-manager').setAttribute('aria-expanded','true');};
 window.closeAdminPanel=()=>{dialog.close();$('open-project-manager').setAttribute('aria-expanded','false');};
 dialog.addEventListener('close',()=>{$('open-project-manager').setAttribute('aria-expanded','false');$('project-login-password').value='';});
 $('admin-documents').append($('manage-documents'),$('document-management'));
 // Keep existing invite/recovery workflow available inside the administrator dialog.
 const observer=new MutationObserver(()=>{if(!$('document-management').hidden&&!dialog.open)window.openAdminPanel();});
 observer.observe($('document-management'),{attributes:true,attributeFilter:['hidden']});
 function theme(value){document.documentElement.dataset.theme=value;$('theme-toggle').textContent=value==='dark'?'Açık tema':'Koyu tema';$('theme-toggle').setAttribute('aria-pressed',String(value==='light'));try{localStorage.setItem('portfolio-theme',value);}catch{}}
 let saved;try{saved=localStorage.getItem('portfolio-theme');}catch{}
 theme(saved==='light'?'light':'dark');$('theme-toggle').onclick=()=>theme(document.documentElement.dataset.theme==='light'?'dark':'light');
 const form=$('profile-form');
 const defaults={about:$('hakkimda').querySelector('p').textContent,aboutTags:[...$('hakkimda').querySelectorAll('.stack-list span')].map(x=>x.textContent).join(', '),work:$('stack').querySelector('p').textContent,workTags:[...$('stack').querySelectorAll('.stack-list span')].map(x=>x.textContent).join(', '),linkedin:''};
 function apply(settings){
  const value={...defaults,...settings};
  for(const key of Object.keys(defaults))form.elements.namedItem(key).value=value[key];
  for(const [id,text,tags] of [['hakkimda','about','aboutTags'],['stack','work','workTags']]){
   $(id).querySelector('p').textContent=value[text];
   $(id).querySelector('.stack-list').replaceChildren(...value[tags].split(',').map(s=>s.trim()).filter(Boolean).map(s=>{const span=document.createElement('span');span.textContent=s;return span;}));
  }
  const link=$('profile-linkedin');let url;
  try{url=new URL(value.linkedin);}catch{}
  if(url&&url.protocol==='https:'&&['www.linkedin.com','linkedin.com'].includes(url.hostname)&&url.pathname.startsWith('/in/')){link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.removeAttribute('aria-disabled');link.title='LinkedIn profilim';}
  else{link.removeAttribute('href');link.setAttribute('aria-disabled','true');}
 }
 apply(defaults);
 async function api(url,options={}){const r=await fetch(url,{credentials:'same-origin',...options});const data=await r.json();if(!r.ok)throw Error(data.error||'İşlem tamamlanamadı.');return data;}
 api('/.netlify/functions/site-settings').then(data=>{if(data.settings)apply(data.settings);}).catch(()=>{$('profile-status').textContent='Kayıtlı ayarlar alınamadı. Kaydetmeden önce sayfayı yenileyin.';form.querySelector('button').disabled=true;});
 form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;
  try{const settings=Object.fromEntries(new FormData(form));const data=await api('/.netlify/functions/site-settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(settings)});apply(data.settings);$('profile-status').textContent='Ana sayfa içeriği kaydedildi.';}
  catch(error){$('profile-status').textContent=error.message;}finally{button.disabled=false;}
 };
 window.addEventListener('portfolio:session',event=>{$('profile-editor').hidden=!event.detail?.admin;$('admin-logout').hidden=!event.detail?.authenticated;});
 $('admin-logout').onclick=async()=>{try{await window.portfolioIdentity.logout();await api('/.netlify/functions/document-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});window.dispatchEvent(new CustomEvent('portfolio:session',{detail:{admin:false,authenticated:false}}));window.dispatchEvent(new Event('portfolio:refresh-auth'));window.closeAdminPanel();}catch(error){$('profile-status').textContent=error.message;}};
 let visitor;try{visitor=localStorage.getItem('portfolio-visitor');if(!/^[0-9a-f-]{36}$/i.test(visitor||'')){visitor=crypto.randomUUID();localStorage.setItem('portfolio-visitor',visitor);}}catch{visitor=crypto.randomUUID();}
 let busy=false;
 async function heartbeat(){if(document.hidden||busy)return;busy=true;try{const data=await api('/.netlify/functions/presence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:visitor}),signal:AbortSignal.timeout(15000)});$('online-count').textContent=`● ${data.count} aktif`;}
 catch{$('online-count').textContent='● Aktif: —';}finally{busy=false;}}
 heartbeat();setInterval(heartbeat,45000);document.addEventListener('visibilitychange',heartbeat);
})();
