(async function(){
  'use strict';
  const $=id=>document.getElementById(id),args=new URLSearchParams(location.hash.slice(1)),opener=window.opener;
  history.replaceState(null,'',location.pathname);
  let accepted=false,used=false,stream=null,jpeg='',timer;
  function stop(){if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;}
  function error(text){$('status').textContent=text;$('start').disabled=true;stop();}
  function decode(s){return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
  let payload;
  try{
    const ticket=args.get('ticket'),signature=args.get('signature'),jwk=(window.GTK_CAMERA_KEYS||{})[args.get('kid')];
    if(!opener||!ticket||!signature||!jwk)throw new Error('invalid');
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(signature),new TextEncoder().encode(ticket)))throw new Error('signature');
    payload=JSON.parse(new TextDecoder().decode(decode(ticket)));
    if(payload.v!==1||!/^([a-f0-9]{32})$/.test(payload.nonce)||typeof payload.origin!=='string'||payload.expiresAt<=Date.now()||payload.expiresAt>Date.now()+310000)throw new Error('expired');
  }catch(_){error('Halaman ini harus dibuka dari formulir resmi yang telah dikonfigurasi.');return;}
  const nonce=payload.nonce,origin=payload.origin;
  const deadline=payload.expiresAt;
  function receive(ev){if(ev.source!==opener||ev.origin!==origin||ev.data?.nonce!==nonce||ev.data?.type!=='GTK_CAMERA_ACCEPT'||Date.now()>deadline)return;accepted=true;$('status').textContent='Formulir terhubung. Silakan buka kamera depan.';$('start').disabled=false;clearInterval(timer);}
  addEventListener('message',receive);
  timer=setInterval(()=>{if(Date.now()>deadline){clearInterval(timer);error('Waktu pengambilan foto habis. Buka kembali kamera dari formulir.');return;}opener.postMessage({type:'GTK_CAMERA_READY',nonce},origin);},300);
  $('start').onclick=async()=>{try{if(!accepted||Date.now()>deadline)throw new Error('Sambungan kamera tidak berlaku.');stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:1280}},audio:false});$('video').srcObject=stream;$('video').hidden=false;$('start').hidden=true;$('capture').hidden=false;$('status').textContent='Pastikan wajah terlihat jelas, lalu ambil foto.';}catch(e){$('status').textContent='Kamera tidak dapat dibuka. Periksa izin kamera dan gunakan browser langsung, bukan browser dalam aplikasi.';}};
  $('capture').onclick=()=>{const v=$('video'),c=$('canvas');if(!v.videoWidth)return;const scale=Math.min(1,1280/Math.max(v.videoWidth,v.videoHeight));c.width=Math.round(v.videoWidth*scale);c.height=Math.round(v.videoHeight*scale);c.getContext('2d').drawImage(v,0,0,c.width,c.height);let quality=.85;jpeg=c.toDataURL('image/jpeg',quality);while(jpeg.length>1398000&&quality>.25){quality-=.1;jpeg=c.toDataURL('image/jpeg',quality);}if(jpeg.length>1398000){error('Foto terlalu besar. Coba kembali dengan resolusi lebih rendah.');return;}stop();$('preview').src=jpeg;$('preview').hidden=false;$('video').hidden=true;$('capture').hidden=true;$('retake').hidden=false;$('send').hidden=false;$('status').textContent='Periksa foto sebelum menggunakannya.';};
  $('retake').onclick=()=>{$('preview').hidden=true;$('send').hidden=true;$('retake').hidden=true;$('start').hidden=false;jpeg='';$('start').click();};
  $('send').onclick=()=>{if(!accepted||used||!jpeg||Date.now()>deadline){error('Sambungan kedaluwarsa. Ambil kembali foto dari formulir.');return;}used=true;opener.postMessage({type:'GTK_SELFIE',nonce,dataUrl:jpeg},origin);jpeg='';$('send').disabled=true;$('status').textContent='Foto dikembalikan ke formulir. Lanjutkan pengiriman penilaian di halaman sebelumnya.';stop();};
  addEventListener('beforeunload',stop);
})();
