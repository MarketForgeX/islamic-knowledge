const API_BASE='https://sunnah.amanahagent.cloud/api/v1';
const API_KEY=window.AMANAH_API_KEY||'';
const toast=document.getElementById('toast');
const input=document.getElementById('searchInput');
const backdrop=document.getElementById('modalBackdrop');
const modalBody=document.getElementById('modalBody');
const modalClose=document.getElementById('modalClose');

function showToast(message){
  toast.textContent=message;
  toast.classList.add('show');
  clearTimeout(window._toast);
  window._toast=setTimeout(()=>toast.classList.remove('show'),2600);
}
function openModal(title,html){
  modalBody.innerHTML='<h2 id="modalTitle">'+title+'</h2>'+html;
  backdrop.classList.add('show');
  document.body.classList.add('modal-open');
}
function closeModal(){
  backdrop.classList.remove('show');
  document.body.classList.remove('modal-open');
}
modalClose.onclick=closeModal;
backdrop.onclick=e=>{if(e.target===backdrop)closeModal()};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});

async function api(path,options={}){
  if(!API_KEY) throw new Error('API configuration is not available yet.');
  const res=await fetch(API_BASE+path,{
    ...options,
    headers:{'Content-Type':'application/json','X-API-Key':API_KEY,...(options.headers||{})}
  });
  let data={}; try{data=await res.json()}catch{}
  if(!res.ok) throw new Error(data.error||'Unable to load Islamic knowledge.');
  return data;
}
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function loading(title){openModal(title,'<div class="loading">Loading Islamic knowledge…</div>')}
function errorBox(err){openModal('Unable to load', '<div class="error-box">'+esc(err.message||err)+'</div>')}

async function searchKnowledge(q){
  loading('Search results');
  try{
    const data=await api('/search',{method:'POST',body:JSON.stringify({q,type:'',limit:10})});
    const results=data.results||[];
    const html=results.length?'<div class="result-list">'+results.map((r,i)=>{
      const type=r._type||'result', title=r.collection_name||r.surah_name_en||type;
      const text=r.text_arabic||r.text_indonesian||r.text||r.name||'';
      return '<article class="result-item"><span class="result-type">'+esc(type)+'</span><h3>'+esc(title)+'</h3><p class="arabic-result">'+esc(r.text_arabic||'')+'</p><p>'+esc(text)+'</p><small>'+esc(r.hadith_key||r.ayah_key||'')+'</small></article>'
    }).join('')+'</div>':'<div class="empty-state">No matching references were found.</div>';
    openModal('Search: '+esc(q),html);
  }catch(e){errorBox(e)}
}
async function loadQuran(key='2:255'){
  loading('Quran');
  try{
    // Arabic text + Hindi translation from established Quran editions.
    // No machine translation is performed here.
    const [arabicRes,hindiRes]=await Promise.all([
      api('/quran/'+encodeURIComponent(key)),
      fetch('https://api.alquran.cloud/v1/surah/'+encodeURIComponent(key.split(':')[0])+'/hi.hindi')
        .then(r=>{if(!r.ok) throw new Error('Hindi Quran translation source is unavailable.'); return r.json()})
    ]);
    const surahData=hindiRes.data||{};
    const ayahNo=Number(key.split(':')[1]);
    const h=(surahData.ayahs||[]).find(a=>a.numberInSurah===ayahNo)||{};
    const d=arabicRes;
    openModal((d.surah_name_en||'Quran')+' — '+esc(d.ayah_key||key),
      '<div class="detail-card"><div class="arabic-large">'+esc(d.text_arabic||h.text||'')+'</div><p>'+esc(h.text||'Hindi translation unavailable for this ayah.')+'</p><small>Surah '+esc(d.surah_name_en||h.surah?.englishName||'')+' ('+esc(d.ayah_key||key)+') · Hindi edition: hi.hindi</small></div>');
  }catch(e){errorBox(e)}
}
async function loadHadith(key='bukhari:1'){
  loading('Hadith');
  try{
    const d=await api('/hadith/'+encodeURIComponent(key));
    openModal(esc(d.collection_name||'Hadith')+' — '+esc(d.hadith_number||key),
      '<div class="detail-card"><div class="arabic-large">'+esc(d.text_arabic||'')+'</div><p>'+esc(d.text_indonesian||'')+'</p><div class="source-line">'+esc((d.grades||[]).map(x=>x.grade).join(', ')||'Reference available')+'</div></div>');
  }catch(e){errorBox(e)}
}
async function loadList(endpoint,title,mapper){
  loading(title);
  try{
    const d=await api(endpoint);
    const arr=Array.isArray(d)?d:(d.results||d.data||d.items||d.names||d.duas||d.amalan||[]);
    const html=arr.length?'<div class="result-list">'+arr.map(mapper).join('')+'</div>':'<div class="empty-state">No content available.</div>';
    openModal(title,html);
  }catch(e){errorBox(e)}
}
const simpleMapper=item=>{
  const name=item.name||item.name_en||item.title||item.name_arabic||'';
  const ar=item.arabic||item.text_arabic||item.arabic_text||'';
  const en=item.meaning||item.translation||item.text_indonesian||item.description||item.benefit||'';
  return '<article class="result-item"><h3>'+esc(name)+'</h3><p class="arabic-result">'+esc(ar)+'</p><p>'+esc(en)+'</p></article>'
};

async function loadDuas(){await loadList('/doa','Daily Duas',simpleMapper)}
async function loadNames(){await loadList('/asmaul-husna','99 Names of Allah',simpleMapper)}
async function loadSunnah(){await loadList('/amalan','Sunnah Practices',simpleMapper)}
async function loadCalendar(){
  loading('Islamic Calendar');
  try{
    const d=await api('/sunnah-calendar?date='+new Date().toISOString().slice(0,10));
    const events=(d.events||[]).map(x=>'<li><b>'+esc(x.label)+'</b><small>'+esc(x.dalil||'')+'</small></li>').join('');
    openModal('Islamic Calendar','<div class="detail-card"><h3>'+esc(d.hijri?.day||'')+' '+esc(d.hijri?.monthName||'')+' '+esc(d.hijri?.year||'')+' AH</h3><p>'+esc(d.date||'')+'</p><ul class="event-list">'+(events||'<li>No special event listed for today.</li>')+'</ul></div>');
  }catch(e){errorBox(e)}
}

document.getElementById('searchForm').addEventListener('submit',e=>{
  e.preventDefault();
  const q=input.value.trim();
  if(q) searchKnowledge(q); else input.focus();
});
document.getElementById('focusSearch').onclick=()=>{
  input.focus();window.scrollTo({top:0,behavior:'smooth'});
};
document.querySelectorAll('.popular button').forEach(b=>b.onclick=()=>{
  input.value=b.textContent.trim();searchKnowledge(input.value.trim());
});
document.getElementById('menuBtn').onclick=()=>document.querySelector('.nav').classList.toggle('open');
document.querySelectorAll('.nav a').forEach(a=>a.onclick=()=>document.querySelector('.nav').classList.remove('open'));

document.querySelectorAll('.feature').forEach(card=>card.addEventListener('click',e=>{
  const target=card.getAttribute('href');
  if(target==='#quran'){e.preventDefault();loadQuran()}
  else if(target==='#hadith'){e.preventDefault();loadHadith()}
  else if(target==='#duas'){e.preventDefault();loadDuas()}
  else if(target==='#names'){e.preventDefault();loadNames()}
  else if(target==='#sunnah'){e.preventDefault();loadSunnah()}
}));

document.querySelectorAll('.quick a').forEach(a=>a.addEventListener('click',e=>{
  const t=a.textContent.toLowerCase();
  if(t.includes('duas')){e.preventDefault();loadDuas()}
  else if(t.includes('calendar')){e.preventDefault();loadCalendar()}
  else if(t.includes('figures')){e.preventDefault();loadList('/figures','Islamic Figures',simpleMapper)}
  else if(t.includes('namaz')||t.includes('fasting')||t.includes('hajj')){e.preventDefault();searchKnowledge(a.textContent.trim())}
}));

document.querySelectorAll('.topic').forEach(a=>a.addEventListener('click',e=>{
  e.preventDefault();searchKnowledge(a.querySelector('b')?.textContent||a.textContent.trim());
}));

document.querySelector('.verse-card .card-head a')?.addEventListener('click',e=>{e.preventDefault();loadQuran()});
document.querySelector('.hadith-card .card-head a')?.addEventListener('click',e=>{e.preventDefault();loadHadith()});

document.querySelector('.verse-card .play')?.addEventListener('click',()=>showToast('Audio playback will be added when an audio source is available.'));
document.querySelector('.verse-card .card-foot button:nth-of-type(2)')?.addEventListener('click',()=>showToast('Audio playback will be added when an audio source is available.'));
document.querySelector('.verse-card .card-foot button:nth-of-type(4)')?.addEventListener('click',()=>loadQuran());
document.querySelector('.hadith-card .card-foot button:first-child')?.addEventListener('click',()=>loadHadith());

document.querySelectorAll('.card-foot button:last-child').forEach(btn=>btn.addEventListener('click',async()=>{
  try{
    await navigator.clipboard.writeText(location.href);
    showToast('Link copied.');
  }catch{showToast('Share link: '+location.href)}
}));

document.querySelector('.calendar .today')?.addEventListener('click',loadCalendar);
document.querySelector('.calendar-row')?.addEventListener('click',e=>{e.preventDefault();loadCalendar()});

document.querySelector('.lang')?.addEventListener('click',()=>showToast('English is currently selected. More languages can be added later.'));

if(!API_KEY) console.warn('AMANAH_API_KEY is not available. GitHub Pages deployment must generate runtime-config.js from the repository secret.');
