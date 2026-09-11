// Never keep candidate details in the browser address bar.
if (window.location.search || window.location.hash) {
  window.history.replaceState(null, '', window.location.pathname);
}

const f=document.getElementById('form');
const success=document.getElementById('success');
f.addEventListener('submit',async e=>{
 e.preventDefault();
 const btn=f.querySelector('.submit');
 btn.disabled=true;
 btn.textContent='Submitting…';
 try{
  const r=await fetch('/api/applications',{method:'POST',body:new FormData(f)});
  const data=await r.json();
  if(!r.ok) throw new Error(data.error||'Submission failed');

  // Remove any old query string before showing the confirmation.
  window.history.replaceState(null, '', window.location.pathname);

  f.querySelectorAll('input, select, textarea, button').forEach(el=>el.disabled=true);
  success.innerHTML='';
  const check=document.createElement('div'); check.className='check'; check.textContent='✓';
  const thanks=document.createElement('div'); thanks.className='thanks'; thanks.textContent='Thank you for joining us!';
  const hindi=document.createElement('div'); hindi.className='hindi'; hindi.textContent='हमसे जुड़ने के लिए धन्यवाद!';
  const appno=document.createElement('div'); appno.className='appno'; appno.textContent='Application No.: '+(data.applicationNo||'Generated');
  success.append(check,thanks,hindi,appno);
  success.style.display='block';
  success.scrollIntoView({behavior:'smooth',block:'center'});
 }catch(err){
  alert(err.message);
  btn.disabled=false;
  btn.textContent='आवेदन जमा करें / Submit Application';
 }
});
