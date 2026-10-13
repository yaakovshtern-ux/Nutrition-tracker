/* Greenplate — offline-first meal tracker. No third-party runtime dependencies. */
(() => {
  "use strict";
  const DB_NAME = "greenplate-local";
  const DB_VERSION = 1;
  const STORE_FOODS = "foods";
  const STORE_MEALS = "meals";
  const STORE_SETTINGS = "settings";
  const $ = (id) => document.getElementById(id);
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString();
  const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const MEALS = ["Breakfast","Lunch","Dinner","Snack"];
  const MEAL_ICONS = {Breakfast:"☼",Lunch:"☀",Dinner:"☾",Snack:"✳"};
  const STARTER_FOODS = [
    ["Oats, dry","Grains",389,16.9,66.3,6.9,"🥣"],
    ["Banana, raw","Fruit",89,1.1,22.8,0.3,"🍌"],
    ["Apple, raw","Fruit",52,0.3,13.8,0.2,"🍎"],
    ["Blueberries","Fruit",57,0.7,14.5,0.3,"🫐"],
    ["Strawberries","Fruit",32,0.7,7.7,0.3,"🍓"],
    ["Egg, whole","Protein",143,12.6,0.7,9.5,"🥚"],
    ["Chicken breast, cooked","Protein",165,31,0,3.6,"🍗"],
    ["Salmon, cooked","Protein",206,22.1,0,12.4,"🐟"],
    ["Tofu, firm","Protein",144,17.3,2.8,8.7,"🧊"],
    ["Greek yogurt, plain 2%","Dairy",73,10,3.9,2,"🥣"],
    ["Milk, 2%","Dairy",50,3.3,4.8,2,"🥛"],
    ["Cheddar cheese","Dairy",403,25,1.3,33.1,"🧀"],
    ["White rice, cooked","Grains",130,2.7,28.2,0.3,"🍚"],
    ["Brown rice, cooked","Grains",123,2.7,25.6,1,"🍚"],
    ["Whole-wheat bread","Grains",247,13,41,4.2,"🍞"],
    ["Pasta, cooked","Grains",158,5.8,30.9,0.9,"🍝"],
    ["Potato, baked","Vegetables",93,2.5,21.2,0.1,"🥔"],
    ["Broccoli, cooked","Vegetables",35,2.4,7.2,0.4,"🥦"],
    ["Spinach, raw","Vegetables",23,2.9,3.6,0.4,"🥬"],
    ["Avocado","Fruit",160,2,8.5,14.7,"🥑"],
    ["Almonds","Nuts & seeds",579,21.2,21.6,49.9,"🥜"],
    ["Peanut butter","Nuts & seeds",588,25,20,50,"🥜"],
    ["Olive oil","Oils",884,0,0,100,"🫒"],
    ["Black beans, cooked","Legumes",132,8.9,23.7,0.5,"🫘"],
    ["Lentils, cooked","Legumes",116,9,20.1,0.4,"🫘"],
    ["Chickpeas, cooked","Legumes",164,8.9,27.4,2.6,"🫘"],
    ["Ground beef, cooked 90% lean","Protein",217,26.1,0,11.8,"🥩"],
    ["Turkey breast, cooked","Protein",135,29,0,1.6,"🍗"],
    ["Whey protein powder","Supplements",400,80,8,5,"🥤"],
    ["Dark chocolate 70–85%","Treats",598,7.8,45.9,42.6,"🍫"],
    ["Honey","Sweeteners",304,0.3,82.4,0,"🍯"],
    ["Orange","Fruit",47,0.9,11.8,0.1,"🍊"],
    ["Carrots, raw","Vegetables",41,0.9,9.6,0.2,"🥕"],
    ["Cucumber, raw","Vegetables",15,0.7,3.6,0.1,"🥒"],
    ["Tomato, raw","Vegetables",18,0.9,3.9,0.2,"🍅"],
    ["Tuna, canned in water, drained","Protein",116,25.5,0,0.8,"🐟"]
  ].map(([name,category,calories,protein,carbs,fat,emoji]) => ({id:"seed-"+name.toLowerCase().replace(/[^a-z0-9]+/g,"-"),name,category,calories,protein,carbs,fat,emoji,custom:false,createdAt:0}));

  let db;
  let selectedFood = null;
  let selectedDate = todayISO();
  let editingEntry = null;
  let toastTimer;

  function openDB() {
    return new Promise((resolve,reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const d = request.result;
        if (!d.objectStoreNames.contains(STORE_FOODS)) d.createObjectStore(STORE_FOODS,{keyPath:"id"});
        if (!d.objectStoreNames.contains(STORE_MEALS)) {
          const s = d.createObjectStore(STORE_MEALS,{keyPath:"id"});
          s.createIndex("date","date",{unique:false});
        }
        if (!d.objectStoreNames.contains(STORE_SETTINGS)) d.createObjectStore(STORE_SETTINGS,{keyPath:"key"});
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  function store(name, mode="readonly") { return db.transaction(name,mode).objectStore(name); }
  function getAll(name) { return new Promise((resolve,reject) => { const r=store(name).getAll(); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); }); }
  function getOne(name,key) { return new Promise((resolve,reject) => { const r=store(name).get(key); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); }); }
  function put(name,value) { return new Promise((resolve,reject) => { const r=store(name,"readwrite").put(value); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); }); }
  function remove(name,key) { return new Promise((resolve,reject) => { const r=store(name,"readwrite").delete(key); r.onsuccess=()=>resolve(); r.onerror=()=>reject(r.error); }); }
  function clearStore(name) { return new Promise((resolve,reject) => { const r=store(name,"readwrite").clear(); r.onsuccess=()=>resolve(); r.onerror=()=>reject(r.error); }); }
  async function seed() {
    const foods = await getAll(STORE_FOODS);
    if (!foods.length) {
      const tx = db.transaction(STORE_FOODS,"readwrite");
      STARTER_FOODS.forEach(f=>tx.objectStore(STORE_FOODS).put(f));
      await new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});
    }
    const defaults = {calories:2000,protein:140,carbs:220,fat:65};
    for (const [key,value] of Object.entries(defaults)) {
      if (!(await getOne(STORE_SETTINGS,key))) await put(STORE_SETTINGS,{key,value});
    }
  }
  async function goals() {
    const out={};
    for (const k of ["calories","protein","carbs","fat"]) out[k]=(await getOne(STORE_SETTINGS,k))?.value ?? ({calories:2000,protein:140,carbs:220,fat:65}[k]);
    return out;
  }
  async function setGoals(g) { for (const [key,value] of Object.entries(g)) await put(STORE_SETTINGS,{key,value:Number(value)||0}); }
  async function foods() { return (await getAll(STORE_FOODS)).sort((a,b)=>a.name.localeCompare(b.name)); }
  async function entriesFor(date) { return (await getAll(STORE_MEALS)).filter(e=>e.date===date).sort((a,b)=>a.createdAt-b.createdAt); }
  function nutrition(food,grams) { const m=(Number(grams)||0)/100; return {calories:(food.calories||0)*m,protein:(food.protein||0)*m,carbs:(food.carbs||0)*m,fat:(food.fat||0)*m}; }
  function totals(entries) { return entries.reduce((t,e)=>{for(const k of ["calories","protein","carbs","fat"])t[k]+=(Number(e[k])||0);return t;},{calories:0,protein:0,carbs:0,fat:0}); }
  function percent(n,g) { return g>0 ? Math.min(100,Math.round(n/g*100)) : 0; }
  function showToast(message) { const t=$("toast");t.textContent=message;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2500); }
  function niceDate(iso,options={weekday:"long",month:"short",day:"numeric"}) { return new Date(iso+"T12:00:00").toLocaleDateString(undefined,options); }
  function setWidth(id,p) { $(id).style.width=`${Math.max(0,Math.min(100,p))}%`; }
  function updateConnection() {
    const online=navigator.onLine;
    $("connection-label").textContent=online?"Offline-ready":"Offline mode";
    $("storage-status").textContent=online?"Local database ready · no account":"Offline · local database ready";
  }
  async function renderToday() {
    $("selected-date").value=selectedDate;
    $("today-label").textContent=selectedDate===todayISO()?"YOUR DAY":niceDate(selectedDate,{weekday:"short",month:"short",day:"numeric"}).toUpperCase();
    const [entries,g]=await Promise.all([entriesFor(selectedDate),goals()]);
    const t=totals(entries);
    $("calorie-total").textContent=fmt(t.calories);
    $("calorie-percent").textContent=`${percent(t.calories,g.calories)}% of goal`;
    $("calorie-remaining").textContent=t.calories<=g.calories?`${fmt(g.calories-t.calories)} kcal remaining`:`${fmt(t.calories-g.calories)} kcal over goal`;
    setWidth("calorie-progress",percent(t.calories,g.calories));
    for(const k of ["protein","carbs","fat"]){
      $(`${k}-total`).textContent=round1(t[k]);
      $(`${k}-goal`).textContent=`Goal ${fmt(g[k])} g`;
      $(`${k}-pct`).textContent=`${percent(t[k],g[k])}%`;
      setWidth(`${k}-progress`,percent(t[k],g[k]));
    }
    const list=$("meal-list");list.innerHTML="";
    $("empty-meals").classList.toggle("hidden",entries.length>0);
    list.classList.toggle("hidden",entries.length===0);
    $("add-first-meal").classList.toggle("hidden",entries.length===0);
    for(const meal of MEALS){
      const group=entries.filter(e=>e.meal===meal);
      if(!group.length)continue;
      const groupKcal=group.reduce((n,e)=>n+e.calories,0);
      const section=document.createElement("section");section.className="meal-group";
      section.innerHTML=`<div class="meal-group-header"><div class="meal-group-title"><span class="meal-emoji">${MEAL_ICONS[meal]}</span>${meal}</div><span class="meal-group-kcal">${fmt(groupKcal)} kcal</span></div>`;
      group.forEach(e=>{
        const row=document.createElement("div");row.className="entry-row";
        row.innerHTML=`<div class="entry-info"><div class="entry-name">${esc(e.foodName)}</div><div class="entry-sub">${round1(e.grams)} g · P ${round1(e.protein)} · C ${round1(e.carbs)} · F ${round1(e.fat)} g</div></div><div class="entry-cal">${fmt(e.calories)} kcal</div><button class="entry-edit" aria-label="Edit ${esc(e.foodName)}" title="Edit entry">···</button>`;
        row.querySelector("button").addEventListener("click",()=>openEditEntry(e));
        section.appendChild(row);
      });
      list.appendChild(section);
    }
  }
  async function renderFoodLibrary(query="") {
    const all=await foods(), q=query.trim().toLowerCase();
    const result=all.filter(f=>!q||`${f.name} ${f.category||""}`.toLowerCase().includes(q));
    $("food-count").textContent=`${result.length} food${result.length===1?"":"s"} available offline`;
    $("food-results").innerHTML="";
    result.forEach(f=>{
      const card=document.createElement("article");card.className="food-card";
      card.innerHTML=`<div class="food-symbol">${esc(f.emoji||"🍽️")}</div><div class="food-card-info"><div class="food-card-name">${esc(f.name)}</div><div class="food-card-meta">${esc(f.category||"Custom")} · per 100 g · P ${round1(f.protein)} g</div></div><div class="food-card-kcal">${fmt(f.calories)} kcal</div><button class="add-food-button" aria-label="Add ${esc(f.name)}">＋</button>`;
      card.querySelector("button").addEventListener("click",()=>openFoodPicker(f));
      $("food-results").appendChild(card);
    });
    if(!result.length)$("food-results").innerHTML='<div class="empty-state"><h3>No foods found</h3><p>Try another search or create a custom food.</p><button class="primary-button" id="no-food-custom">Create custom food</button></div>';
    $("no-food-custom")?.addEventListener("click",openCustomFood);
  }
  async function renderPicker(query="") {
    const all=await foods(),q=query.trim().toLowerCase();
    const result=all.filter(f=>!q||`${f.name} ${f.category||""}`.toLowerCase().includes(q)).slice(0,60);
    $("picker-results").innerHTML="";
    result.forEach(f=>{
      const b=document.createElement("button");b.type="button";b.className="picker-food";
      b.innerHTML=`<span class="food-symbol">${esc(f.emoji||"🍽️")}</span><span class="picker-food-info"><strong>${esc(f.name)}</strong><small>${fmt(f.calories)} kcal · P ${round1(f.protein)} · C ${round1(f.carbs)} · F ${round1(f.fat)} g / 100 g</small></span><span class="plus">＋</span>`;
      b.addEventListener("click",()=>chooseFood(f));
      $("picker-results").appendChild(b);
    });
    if(!result.length)$("picker-results").innerHTML='<p class="form-help">No matches. Create a custom food to add it to your library.</p>';
  }
  function openFoodPicker(food=null) {
    selectedFood=null;
    $("food-picker-step").classList.remove("hidden");$("food-portion-step").classList.add("hidden");$("custom-food-step").classList.add("hidden");
    $("food-dialog-title").textContent="Choose a food";$("food-dialog-kicker").textContent="ADD TO MEAL";
    $("picker-search").value="";$("entry-meal").value="Snack";$("food-dialog").showModal();
    renderPicker("").then(()=>{if(food)chooseFood(food);});
  }
  function chooseFood(food) {
    selectedFood=food;
    $("food-picker-step").classList.add("hidden");$("food-portion-step").classList.remove("hidden");$("custom-food-step").classList.add("hidden");
    $("food-dialog-title").textContent="Serving size";
    $("selected-food-summary").innerHTML=`<strong>${esc(food.emoji||"🍽️")} ${esc(food.name)}</strong><p>Nutrition values per 100 g · ${fmt(food.calories)} kcal</p>`;
    $("portion-grams").value=100;
    $("portion-meal").value=$("entry-meal").value||"Snack";
    renderPortionPreview();
  }
  function renderPortionPreview() {
    if(!selectedFood)return;
    const n=nutrition(selectedFood,Number($("portion-grams").value));
    $("portion-preview").innerHTML=[["kcal",fmt(n.calories)],["Protein",`${round1(n.protein)} g`],["Carbs",`${round1(n.carbs)} g`],["Fat",`${round1(n.fat)} g`]].map(([l,v])=>`<div><strong>${v}</strong><span>${l}</span></div>`).join("");
  }
  function openCustomFood() {
    $("food-picker-step").classList.add("hidden");$("food-portion-step").classList.add("hidden");$("custom-food-step").classList.remove("hidden");
    $("food-dialog-title").textContent="Create a food";$("food-dialog-kicker").textContent="YOUR LIBRARY";
    $("custom-name").value="";["calories","protein","carbs","fat"].forEach(k=>$(`custom-${k}`).value=0);
    $("food-dialog").showModal();
  }
  async function saveCustomFood() {
    const name=$("custom-name").value.trim();
    if(!name){$("custom-name").focus();return;}
    const f={id:uid(),name,category:"Custom",emoji:"🍽️",custom:true,createdAt:Date.now()};
    for(const k of ["calories","protein","carbs","fat"]){const v=Number($(`custom-${k}`).value);if(!Number.isFinite(v)||v<0){showToast("Enter valid nutrition values.");return;}f[k]=v;}
    await put(STORE_FOODS,f);selectedFood=f;
    $("custom-food-step").classList.add("hidden");$("food-portion-step").classList.remove("hidden");
    $("selected-food-summary").innerHTML=`<strong>🍽️ ${esc(f.name)}</strong><p>Custom food · nutrition values per 100 g</p>`;
    $("portion-grams").value=100;$("portion-meal").value=$("entry-meal").value||"Snack";
    $("food-dialog-title").textContent="Serving size";renderPortionPreview();
    await renderFoodLibrary($("food-search").value);
    showToast("Food saved to your library");
  }
  async function saveEntry(event) {
    event.preventDefault();
    if(!selectedFood)return;
    const grams=Number($("portion-grams").value);
    if(!(grams>0)){showToast("Enter a serving amount greater than zero.");return;}
    const n=nutrition(selectedFood,grams);
    await put(STORE_MEALS,{id:uid(),date:selectedDate,meal:$("portion-meal").value,foodId:selectedFood.id,foodName:selectedFood.name,grams,...Object.fromEntries(Object.entries(n).map(([k,v])=>[k,round1(v)])),createdAt:Date.now()});
    $("food-dialog").close();await refreshAll();showToast("Added to your diary");
  }
  function openEditEntry(entry) {
    editingEntry=entry;$("edit-entry-id").value=entry.id;$("edit-entry-title").textContent=entry.foodName;
    $("edit-entry-grams").value=entry.grams;$("edit-entry-meal").value=entry.meal;
    $("edit-entry-dialog").showModal();
  }
  async function saveEditedEntry(event) {
    event.preventDefault();if(!editingEntry)return;
    const grams=Number($("edit-entry-grams").value);
    if(!(grams>0)){showToast("Enter a valid amount.");return;}
    const food=await getOne(STORE_FOODS,editingEntry.foodId);
    let n;
    if(food)n=nutrition(food,grams);
    else {const factor=grams/(editingEntry.grams||1);n={calories:editingEntry.calories*factor,protein:editingEntry.protein*factor,carbs:editingEntry.carbs*factor,fat:editingEntry.fat*factor};}
    await put(STORE_MEALS,{...editingEntry,grams,meal:$("edit-entry-meal").value,...Object.fromEntries(Object.entries(n).map(([k,v])=>[k,round1(v)]))});
    $("edit-entry-dialog").close();editingEntry=null;await refreshAll();showToast("Entry updated");
  }
  async function deleteEditedEntry() {
    if(!editingEntry)return;
    if(!confirm(`Delete ${editingEntry.foodName} from this day?`))return;
    await remove(STORE_MEALS,editingEntry.id);$("edit-entry-dialog").close();editingEntry=null;await refreshAll();showToast("Entry deleted");
  }
  async function renderHistory() {
    const all=await getAll(STORE_MEALS);
    const days=[...new Set(all.map(e=>e.date))].sort((a,b)=>b.localeCompare(a)).slice(0,90);
    const g=await goals();const target=g.calories||1;
    $("history-list").innerHTML="";
    if(!days.length){$("history-list").innerHTML='<div class="empty-state"><div class="empty-icon">▤</div><h3>Your history starts here</h3><p>Once you log a meal, your daily totals will appear here.</p></div>';return;}
    days.forEach(date=>{
      const entries=all.filter(e=>e.date===date),t=totals(entries);
      const card=document.createElement("button");card.type="button";card.className="history-day";card.style.textAlign="left";card.style.color="inherit";
      card.innerHTML=`<div class="history-day-top"><span class="history-date">${esc(date===todayISO()?"Today":niceDate(date,{weekday:"short",month:"short",day:"numeric",year:"numeric"}))}</span><span class="history-kcal">${fmt(t.calories)} <small style="font:500 10px 'DM Sans';color:#8fa595">kcal</small></span></div><div class="history-sub">${entries.length} item${entries.length===1?"":"s"} · P ${round1(t.protein)} g · C ${round1(t.carbs)} g · F ${round1(t.fat)} g</div><div class="history-bar"><span style="width:${percent(t.calories,target)}%"></span></div>`;
      card.addEventListener("click",()=>{selectedDate=date;switchView("today");});
      $("history-list").appendChild(card);
    });
  }
  async function refreshAll() { await Promise.all([renderToday(),renderFoodLibrary($("food-search").value),renderHistory(),fillGoalInputs()]); }
  async function fillGoalInputs() {const g=await goals();for(const k of ["calories","protein","carbs","fat"])$(`goal-${k}`).value=g[k];}
  function switchView(name) {
    document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${name}`));
    document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.view===name));
    if(name==="today")renderToday();if(name==="foods")renderFoodLibrary($("food-search").value);if(name==="history")renderHistory();
    window.scrollTo({top:0,behavior:"smooth"});
  }
  async function exportData() {
    const payload={app:"Greenplate",schemaVersion:1,exportedAt:new Date().toISOString(),foods:await getAll(STORE_FOODS),meals:await getAll(STORE_MEALS),goals:await goals()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`greenplate-backup-${todayISO()}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);showToast("Backup exported");
  }
  async function importData(file) {
    if(!file)return;
    try{
      const data=JSON.parse(await file.text());
      if(!data||!Array.isArray(data.foods)||!Array.isArray(data.meals)||!data.goals)throw new Error("This file doesn't look like a Greenplate backup.");
      for(const f of data.foods){if(f&&f.id&&f.name)await put(STORE_FOODS,f);}
      for(const m of data.meals){if(m&&m.id&&m.date&&m.foodName)await put(STORE_MEALS,m);}
      await setGoals(data.goals);await refreshAll();showToast("Backup imported");
    }catch(e){alert(`Could not import backup: ${e.message||"invalid file"}`);}
    $("import-file").value="";
  }
  async function clearData() {
    if(!confirm("Delete all meals, custom foods, and goals from this device? This cannot be undone unless you exported a backup."))return;
    await Promise.all([clearStore(STORE_FOODS),clearStore(STORE_MEALS),clearStore(STORE_SETTINGS)]);
    await seed();selectedDate=todayISO();await refreshAll();showToast("Local data cleared");
  }
  function bindEvents() {
    document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.view)));
    $("prev-day").addEventListener("click",()=>{const d=new Date(selectedDate+"T12:00:00");d.setDate(d.getDate()-1);selectedDate=d.toISOString().slice(0,10);renderToday();});
    $("next-day").addEventListener("click",()=>{const d=new Date(selectedDate+"T12:00:00");d.setDate(d.getDate()+1);selectedDate=d.toISOString().slice(0,10);renderToday();});
    $("go-today").addEventListener("click",()=>{selectedDate=todayISO();renderToday();});
    $("selected-date").addEventListener("change",e=>{if(e.target.value){selectedDate=e.target.value;renderToday();}});
    ["add-first-meal","empty-add"].forEach(id=>$(id).addEventListener("click",()=>openFoodPicker()));
    $("add-custom-food").addEventListener("click",()=>{openFoodPicker();openCustomFood();});
    $("create-food-from-picker").addEventListener("click",openCustomFood);
    $("food-search").addEventListener("input",e=>renderFoodLibrary(e.target.value));
    $("show-all-foods").addEventListener("click",()=>{$("food-search").value="";renderFoodLibrary("");});
    $("picker-search").addEventListener("input",e=>renderPicker(e.target.value));
    $("portion-grams").addEventListener("input",renderPortionPreview);
    $("food-form").addEventListener("submit",saveEntry);
    $("save-custom-food").addEventListener("click",saveCustomFood);
    $("custom-cancel").addEventListener("click",()=>{if(selectedFood){$("custom-food-step").classList.add("hidden");$("food-picker-step").classList.remove("hidden");$("food-dialog-title").textContent="Choose a food";}else{$("food-dialog").close();}});
    $("portion-back").addEventListener("click",()=>{$("food-portion-step").classList.add("hidden");$("food-picker-step").classList.remove("hidden");$("food-dialog-title").textContent="Choose a food";renderPicker($("picker-search").value);});
    $("edit-goals").addEventListener("click",()=>switchView("settings"));
    $("goals-form").addEventListener("submit",async e=>{e.preventDefault();const g={};for(const k of ["calories","protein","carbs","fat"])g[k]=Math.max(0,Number($(`goal-${k}`).value)||0);await setGoals(g);await refreshAll();showToast("Daily goals saved");});
    $("edit-entry-form").addEventListener("submit",saveEditedEntry);
    $("delete-entry").addEventListener("click",deleteEditedEntry);
    document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>$(b.dataset.close).close()));
    $("export-data").addEventListener("click",exportData);
    $("import-file").addEventListener("change",e=>importData(e.target.files?.[0]));
    $("clear-data").addEventListener("click",clearData);
    window.addEventListener("online",updateConnection);window.addEventListener("offline",updateConnection);
  }
  async function init() {
    if(!("indexedDB" in window)){alert("This browser does not support IndexedDB, which Greenplate needs to save your data.");return;}
    try{db=await openDB();await seed();bindEvents();selectedDate=todayISO();await refreshAll();updateConnection();
      if("serviceWorker" in navigator && location.protocol!=="file:"){navigator.serviceWorker.register("./service-worker.js").catch(()=>{ $("connection-label").textContent="Offline cache unavailable"; });}
    }catch(e){console.error(e);alert("Greenplate couldn't start its local database. Try opening it in Safari or another modern browser.");}
  }
  init();
})();