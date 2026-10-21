(()=>{
  const postJson=(url,payload,timeoutMs=8000)=>new Promise((resolve,reject)=>{
    const request=new XMLHttpRequest();request.open('POST',url,true);request.timeout=timeoutMs;request.setRequestHeader('Content-Type','application/json');
    request.onload=()=>{let data={};try{data=JSON.parse(request.responseText||'{}')}catch(_error){}resolve({ok:request.status>=200&&request.status<300,status:request.status,data});};
    request.onerror=()=>reject(new Error('network'));request.ontimeout=()=>{const error=new Error('timeout');error.name='TimeoutError';reject(error);};request.send(JSON.stringify(payload));
  });
  const form=document.getElementById('f');if(!form)return;
  const code=document.getElementById('code'),name=document.getElementById('name'),msg=document.getElementById('msg');
  if(code&&name&&msg){
    const fmt=value=>{const raw=String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);return raw.length>4?raw.slice(0,4)+'-'+raw.slice(4):raw;};
    code.value=fmt(code.value);code.addEventListener('input',()=>{code.value=fmt(code.value);});if(location.search)history.replaceState(null,'','/connect');
    const platform=navigator.userAgentData?.platform||navigator.platform||'Browser';if(!name.value)name.value=platform+' Owner device';
    form.addEventListener('submit',async event=>{
      event.preventDefault();const button=form.querySelector('button[type="submit"]');if(button)button.disabled=true;msg.textContent='Connecting…';
      try{const response=await postJson('/api/owner-enrollment/redeem',{code:code.value,deviceName:name.value}),data=response.data||{};if(response.ok&&data.ok){msg.textContent='Connected. Opening Settings…';location.href=data.redirect||'/settings';return;}msg.textContent=data.error||'Could not connect this device.';}
      catch(error){msg.textContent=error?.name==='TimeoutError'?'Connection timed out. Check that this device is on the same LAN/private VPN.':'Could not reach LibreDisplay. Check that this device is on the same LAN/private VPN.';}
      finally{if(button)button.disabled=false;}
    });
    return;
  }
  const user=document.getElementById('u'),password=document.getElementById('p'),message=document.getElementById('e');if(!user||!password||!message)return;
  form.addEventListener('submit',async event=>{
    event.preventDefault();const button=form.querySelector('button[type="submit"]');if(button)button.disabled=true;message.textContent='';
    try{const response=await postJson('/api/login',{username:user.value,password:password.value},8000),data=response.data||{};if(response.ok&&data.ok){location.href=data.role==='viewer'?'/dashboard.html?display=1&endpoint='+(data.endpoint||'main'):'/settings?endpoint='+(data.endpoint||'main');return;}message.textContent=data.error||'Sign-in failed';}
    catch(error){message.textContent=error?.name==='TimeoutError'?'Sign-in timed out. Check the LibreDisplay connection and try again.':'Could not reach LibreDisplay. Try again.';}
    finally{if(button)button.disabled=false;}
  });
})();
