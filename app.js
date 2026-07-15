// ═══════════ LOGIN ═══════════
const LOGIN_EMAIL = 'jandervries1997@outlook.com';
const LOGIN_PW    = 'adeefsfdeadwadafscfaeda';

function checkLogin() {
  return sessionStorage.getItem('iv_auth') === 'ok';
}

function doLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pw    = document.getElementById('login-pw').value;
  if (email === LOGIN_EMAIL && pw === LOGIN_PW) {
    sessionStorage.setItem('iv_auth', 'ok');
    document.getElementById('login-screen').classList.add('hidden');
    document.querySelector('[data-tab="config"]').style.display = 'block';
    init();
  } else {
    const err = document.getElementById('login-err');
    err.style.display = 'block';
    setTimeout(() => err.style.display = 'none', 3000);
  }
}

// ═══════════ LOCKED SECTION ═══════════
const GATE_PW = 'adeefsfdeadwadafscfaeda';

function toggleLockedSection() {
  const content = document.getElementById('lock-content');
  if (content.style.display === 'none') {
    document.getElementById('gate-pw').focus();
  }
}

function unlockSection() {
  const pw = document.getElementById('gate-pw').value;
  if (pw === GATE_PW) {
    document.getElementById('lock-gate').style.display = 'none';
    document.getElementById('lock-content').style.display = 'block';
    document.getElementById('lock-icon').textContent = '🔓';
    document.getElementById('lock-toggle-hint').textContent = 'Ontgrendeld';
    // Vul huidige waarden in
    document.getElementById('hc-provider').value = localStorage.getItem('iv_provider') || HC.provider;
    document.getElementById('hc-model').value    = localStorage.getItem('iv_model')    || HC.model;
    document.getElementById('hc-apikey').value   = localStorage.getItem('iv_api_key')  || HC.api_key;
    document.getElementById('hc-worker').value   = localStorage.getItem('iv_worker_url')|| HC.worker_url;
    document.getElementById('hc-sburl').value    = localStorage.getItem('iv_sb_url')   || HC.sb_url;
    document.getElementById('hc-sbkey').value    = localStorage.getItem('iv_sb_key')   || HC.sb_key;
  } else {
    const err = document.getElementById('gate-err');
    err.style.display = 'block';
    setTimeout(() => err.style.display = 'none', 2500);
    document.getElementById('gate-pw').value = '';
  }
}

function lockSection() {
  document.getElementById('lock-gate').style.display = 'block';
  document.getElementById('lock-content').style.display = 'none';
  document.getElementById('lock-icon').textContent = '🔒';
  document.getElementById('lock-toggle-hint').textContent = 'Klik om te ontgrendelen';
  document.getElementById('gate-pw').value = '';
}

// Bij providerwissel: vul automatisch het aanbevolen model in als het huidige
// model bij de andere provider hoort (of leeg is)
function hcProviderChanged() {
  const provider = document.getElementById('hc-provider').value;
  const modelEl  = document.getElementById('hc-model');
  const huidige  = (modelEl.value || '').trim();
  const hoortBijProvider = provider === 'anthropic' ? /^claude/ : /^gemini/;
  if (!huidige || !hoortBijProvider.test(huidige)) {
    modelEl.value = provider === 'anthropic' ? 'claude-fable-5' : 'gemini-2.5-flash';
  }
}

async function saveLockedSettings() {
  const provider  = document.getElementById('hc-provider').value;
  const model     = document.getElementById('hc-model').value.trim();
  const apiKey    = document.getElementById('hc-apikey').value.trim();
  const workerUrl = document.getElementById('hc-worker').value.trim();
  const sbUrl     = document.getElementById('hc-sburl').value.trim();
  const sbKey     = document.getElementById('hc-sbkey').value.trim();

  localStorage.setItem('iv_provider',   provider);
  localStorage.setItem('iv_model',      model);
  localStorage.setItem('iv_api_key',    apiKey);
  localStorage.setItem('iv_worker_url', workerUrl);
  localStorage.setItem('iv_sb_url',     sbUrl);
  localStorage.setItem('iv_sb_key',     sbKey);

  // Herverbind Supabase en sla op
  await initSupabase();
  if (SB.ok) {
    await SB.saveApiInstellingen(provider, model, workerUrl, apiKey);
  }

  // Update API settings UI
  _currentProvider = provider;
  loadApiSettingsUI();

  const ok = document.getElementById('lock-save-ok');
  ok.style.display = 'inline';
  setTimeout(() => ok.style.display = 'none', 2500);
}

// ═══════════ HARDCODED CONFIG ═══════════
const HC = {
  sb_url:     'https://yrnrnmwtjsxgzanbunur.supabase.co',
  sb_key:     'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlybnJubXd0anN4Z3phbmJ1bnVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3OTAwOTUsImV4cCI6MjA5NTM2NjA5NX0.dhYAnifSdCHLIqm6FB-c28HX3r6jFN6WtGS_DpvHoT4',
  provider:   'anthropic',
  api_key:    '',  // Vul in via Configureer → Beveiligde instellingen
  worker_url: 'https://mute-wildflower-c45bdwa.jan-devries.workers.dev',
  model:      'claude-fable-5',
};

// Zet hardcoded waarden alleen in localStorage als er nog niets is ingesteld.
// (Voorheen werd dit bij elke page-load overschreven, waardoor opgeslagen
// instellingen — inclusief de API key — telkens gewist werden.)
const HC_MAP = {
  iv_sb_url:     HC.sb_url,
  iv_sb_key:     HC.sb_key,
  iv_provider:   HC.provider,
  iv_api_key:    HC.api_key,
  iv_worker_url: HC.worker_url,
  iv_model:      HC.model,
};
for (const [k, v] of Object.entries(HC_MAP)) {
  if (v && !localStorage.getItem(k)) localStorage.setItem(k, v);
}

// ═══════════ SUPABASE DATABASE LAAG ═══════════
// Transparante laag: gebruikt Supabase als geconfigureerd, anders localStorage

const SB = {
  _client: null,

  // Initialiseer met URL en key uit instellingen
  init(url, key) {
    if (!url || !key) { this._client = null; return false; }
    try {
      // Supabase UMD kan exporteren als window.supabase of window.supabaseJs
      const lib = window.supabase || window.supabaseJs;
      if (!lib || !lib.createClient) {
        console.error('Supabase SDK niet geladen — window.supabase:', window.supabase);
        this._client = null;
        return false;
      }
      this._client = lib.createClient(url, key);
      console.log('✓ Supabase client aangemaakt voor:', url);
      return true;
    } catch(e) {
      console.error('Supabase init fout:', e);
      this._client = null;
      return false;
    }
  },

  get ok() { return !!this._client; },

  // ── Artikelen ──
  async saveArtikel(site, onderwerp, type, artikel) {
    if (this.ok) {
      const { error } = await this._client.from('artikelen').insert({ site, onderwerp, type, artikel });
      if (error) console.error('SB saveArtikel:', error);
    }
    // Altijd ook lokaal (snelle UI)
    const key = 'iv_dag_history_' + site;
    const hist = JSON.parse(localStorage.getItem(key)||'[]');
    hist.unshift({ date: new Date().toISOString(), onderwerp, type, artikel });
    localStorage.setItem(key, JSON.stringify(hist.slice(0,50)));
  },

  async getArtikelen(site) {
    if (this.ok) {
      const { data, error } = await this._client
        .from('artikelen').select('*').eq('site', site)
        .order('datum', { ascending: false }).limit(50);
      if (!error && data) return data.map(r => ({
        date: r.datum, onderwerp: r.onderwerp, type: r.type, artikel: r.artikel
      }));
    }
    return JSON.parse(localStorage.getItem('iv_dag_history_' + site)||'[]');
  },

  // ── Site config ──
  async saveSiteConfig(site, config) {
    // Eerst lokaal (synchroon), zodat code direct na deze aanroep de nieuwe
    // config leest — de Supabase-write hieronder is asynchroon
    localStorage.setItem('iv_site_cfg_' + site, JSON.stringify(config));
    if (this.ok) {
      const { error } = await this._client.from('site_config')
        .upsert({ site, config }, { onConflict: 'site' });
      if (error) console.error('SB saveSiteConfig:', error);
    }
  },

  async getSiteConfig(site) {
    if (this.ok) {
      const { data, error } = await this._client
        .from('site_config').select('config').eq('site', site).single();
      if (!error && data) return data.config;
    }
    const saved = localStorage.getItem('iv_site_cfg_' + site);
    return saved ? JSON.parse(saved) : null;
  },

  // ── Agent prompts ──
  async saveAgents(site, agentsArr) {
    if (this.ok) {
      const rows = agentsArr.map(a => ({ site, agent_id: a.id, prompt: a }));
      const { error } = await this._client.from('agent_prompts')
        .upsert(rows, { onConflict: 'site,agent_id' });
      if (error) console.error('SB saveAgents:', error);
    }
    localStorage.setItem('iv_ag6_' + site, JSON.stringify(agentsArr));
  },

  async getAgents(site) {
    if (this.ok) {
      const { data, error } = await this._client
        .from('agent_prompts').select('prompt').eq('site', site);
      if (!error && data?.length) return data.map(r => r.prompt);
    }
    const saved = localStorage.getItem('iv_ag6_' + site);
    return saved ? JSON.parse(saved) : null;
  },

  // ── Blacklist ──
  async saveBlacklist(site, tekst) {
    if (this.ok) {
      const { error } = await this._client.from('dag_blacklist')
        .upsert({ site, onderwerpen: tekst }, { onConflict: 'site' });
      if (error) console.error('SB saveBlacklist:', error);
    }
    localStorage.setItem('iv_dag_blacklist_' + site, tekst);
  },

  async getBlacklist(site) {
    if (this.ok) {
      const { data, error } = await this._client
        .from('dag_blacklist').select('onderwerpen').eq('site', site).single();
      if (!error && data) return data.onderwerpen || '';
    }
    return localStorage.getItem('iv_dag_blacklist_' + site) || '';
  },

  // ── API instellingen (inclusief api key) ──
  async saveApiInstellingen(provider, model, workerUrl, apiKey) {
    console.log('saveApiInstellingen aangeroepen, SB.ok:', this.ok, 'client:', !!this._client);
    if (this.ok) {
      const row = { id: 'global', provider, model, worker_url: workerUrl, api_key: apiKey };
      console.log('Opslaan naar api_instellingen:', {...row, api_key: '***'});
      const { data, error } = await this._client.from('api_instellingen')
        .upsert(row, { onConflict: 'id' });
      if (error) {
        console.error('SB saveApiInstellingen fout:', JSON.stringify(error));
        // Fallback: directe REST aanroep
        await this._directUpsertApiSettings(row);
      } else {
        console.log('✓ api_instellingen opgeslagen:', data);
      }
    } else {
      console.warn('SB niet ok, sla op via directe REST...');
      const sbUrl = localStorage.getItem('iv_sb_url');
      const sbKey = localStorage.getItem('iv_sb_key');
      if (sbUrl && sbKey) {
        await this._directUpsertApiSettings({ id:'global', provider, model, worker_url: workerUrl, api_key: apiKey }, sbUrl, sbKey);
      }
    }
  },

  async _directUpsertApiSettings(row, sbUrl, sbKey) {
    const url = (sbUrl || localStorage.getItem('iv_sb_url')) + '/rest/v1/api_instellingen';
    const key = sbKey || localStorage.getItem('iv_sb_key');
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
          'Authorization': 'Bearer ' + key,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(row)
      });
      const txt = await r.text();
      console.log('Direct REST upsert status:', r.status, txt);
    } catch(e) {
      console.error('Direct REST upsert fout:', e);
    }
  },

  async getApiInstellingen() {
    if (this.ok) {
      const { data, error } = await this._client
        .from('api_instellingen').select('*').eq('id','global').single();
      if (!error && data) return data;
    }
    return null;
  },

  // ── Verbinding testen ──
  async testVerbinding() {
    if (!this._client) return false;
    const { error } = await this._client.from('api_instellingen').select('id').limit(1);
    return !error;
  }
};

// SDK is geladen via script tag in head — deze functie checkt alleen of het gelukt is
function loadSupabaseSDK() {
  return new Promise((resolve) => {
    // Geef de browser even tijd als de script tag nog niet klaar is
    if (window.supabase || window.supabaseJs) { resolve(true); return; }
    let tries = 0;
    const check = setInterval(() => {
      tries++;
      if (window.supabase || window.supabaseJs) { clearInterval(check); resolve(true); }
      else if (tries > 20) { clearInterval(check); console.error('Supabase SDK niet beschikbaar na wachten'); resolve(false); }
    }, 100);
  });
}

async function initSupabase() {
  const url = localStorage.getItem('iv_sb_url') || '';
  const key = localStorage.getItem('iv_sb_key') || '';
  if (!url || !key) return;
  await loadSupabaseSDK();
  const ok = SB.init(url, key);
  if (ok) {
    updateSbStatusPill('verbonden');
    // Sync provider/model/workerUrl vanuit DB (nooit de API key)
    const apiDb = await SB.getApiInstellingen();
    if (apiDb) {
      if (apiDb.provider)    localStorage.setItem('iv_provider',   apiDb.provider);
      if (apiDb.worker_url)  localStorage.setItem('iv_worker_url', apiDb.worker_url);
      if (apiDb.model)       localStorage.setItem('iv_model',      apiDb.model);
      if (apiDb.api_key)     localStorage.setItem('iv_api_key',    apiDb.api_key);
      if (typeof updateModelBadge === 'function') updateModelBadge();
    }
  }
}

function updateSbStatusPill(state) {
  const pill = document.getElementById('sb-status-pill');
  if (!pill) return;
  if (state === 'verbonden') {
    pill.textContent = '✓ Verbonden'; pill.style.background='var(--gl)';
    pill.style.color='var(--g)'; pill.style.borderColor='#b8deca';
  } else if (state === 'fout') {
    pill.textContent = '✗ Verbinding mislukt'; pill.style.background='#fde8e8';
    pill.style.color='#c0392b'; pill.style.borderColor='#f5b7b1';
  } else if (state === 'bezig') {
    pill.textContent = '⏳ Verbinden...'; pill.style.background='#fff8ec';
    pill.style.color='#b86a10'; pill.style.borderColor='#e8c07a';
  } else {
    pill.textContent = 'Niet geconfigureerd'; pill.style.background='var(--sand)';
    pill.style.color='var(--mut)'; pill.style.borderColor='var(--bdr)';
  }
}

async function saveSupabaseSettings() {
  const url = document.getElementById('sb-url-input').value.trim();
  const key = document.getElementById('sb-key-input').value.trim();
  if (!url || !key) {
    updateSbStatusPill('fout');
    alert('Vul zowel de Project URL als de Anon Key in.');
    return;
  }
  localStorage.setItem('iv_sb_url', url);
  localStorage.setItem('iv_sb_key', key);
  updateSbStatusPill('bezig');

  await loadSupabaseSDK();
  console.log('Supabase SDK beschikbaar:', !!(window.supabase || window.supabaseJs));

  const ok = SB.init(url, key);
  console.log('SB.init resultaat:', ok, 'client:', SB._client);

  if (ok) {
    const test = await SB.testVerbinding();
    console.log('Verbindingstest:', test);
    if (test) {
      updateSbStatusPill('verbonden');
      const okEl = document.getElementById('sb-ok');
      okEl.style.display='inline'; setTimeout(()=>okEl.style.display='none',3000);
    } else {
      updateSbStatusPill('fout');
      alert('Supabase bereikbaar maar kan geen data ophalen. Check je URL en key.');
    }
  } else {
    updateSbStatusPill('fout');
    alert('Supabase SDK kon niet initialiseren. Zie console (F12) voor details.');
  }
}

// ═══════════ SITE CONFIGS ═══════════
const SITE_DEFAULTS = {
  iv: {
    name: 'ImpactVandaag',
    domain: 'impactvandaag.nl',
    logoSpan: 'Vandaag',
    doelgroep: 'Ervaren professionals, 5+ jaar werkervaring, die in loondienst bij de overheid willen werken via impactvandaag.nl',
    jargon: 'detachering\nin loondienst via impactvandaag\nWet toelating terbeschikkingstelling (WTZA)\nABU CAO\nStiPP pensioen\narbeidsonzekerheid\nmaatschappelijke relevantie\noverheidsopdrachtgever\nvaste werkgever\nbegeleid in loondienst',
    verboden: 'maak het verschil\nzinvol werk\nbovendien\ndaarnaast\nvervullen\nontdek hoe\nin een wereld waar\nhet is belangrijk dat',
    tov: 'Warm maar professioneel. Spreekt professionals aan als gelijken die een serieuze loopbaankeuze maken. Concrete feiten, geen hype. Persoonlijk maar niet informeel.',
    accentColor: '#5ecfa0',
    headerBg: '#1c1c1a',
    badgeText: 'Artikel Agents'
  },
  oo: {
    name: 'OpdrachtOverheid',
    domain: 'opdrachtoverheid.nl',
    logoSpan: 'Overheid',
    doelgroep: 'ZZP\'ers, freelancers en interim professionals die overheidsopdrachten willen uitvoeren via opdrachtoverheid.nl. Zelfstandig, resultaatgericht, zakelijk.',
    jargon: 'inhuuropdracht\naanbesteding\nEuropees aanbesteed\nDAS (Dynamisch Aankoopsysteem)\nraamovereenkomst\nmanifestgemeenten\nRijk, provincie of gemeente\ntarief per uur\ninschrijven op een opdracht\nKvK-nummer\nwerkverklaring\nreferentieopdracht\nbijlage bij offerte\ngunningscriteria\nBIGS / OT2\nSimpliCity',
    verboden: 'in loondienst\ndetachering\nmaak het verschil\nbovendien\ndaarnaast\nontdek hoe\nin een wereld waar',
    tov: 'Zakelijk, direct en to-the-point. ZZP\'ers hebben geen tijd voor wollige teksten. Schrijf als een vakgenoot die weet hoe aanbesteden werkt. Concrete tips, tarieven en deadlines zijn welkom.',
    accentColor: '#60a5fa',
    headerBg: '#0f2d5e',
    badgeText: 'Artikel Agents'
  }
};

// ═══════════ DEFAULT AGENTS — per site ═══════════
// Verhoog dit nummer als de standaard-prompts inhoudelijk verbeteren:
// opgeslagen (oudere) prompts worden dan automatisch vervangen door de nieuwe.
const PROMPT_VERSIE = 2;

function makeAgents(site) {
  // Neem opgeslagen website-instellingen mee (doelgroep, jargon, verboden, tov)
  // — voorheen werden alleen de hardcoded defaults gebruikt.
  const key = site === 'oo' ? 'oo' : 'iv';
  const savedCfg = localStorage.getItem('iv_site_cfg_' + key);
  const s = {...SITE_DEFAULTS[key], ...(savedCfg ? JSON.parse(savedCfg) : {})};
  return [
  {
    id:'intake', emoji:'💬', name:'Intake Agent', role:'Briefing interviewer', outputLabel:'Gespreksverslag', pv:PROMPT_VERSIE,
    systemPrompt:`Je bent de Intake Agent van ${s.domain} — ${s.doelgroep}.

Jouw taak: voer een gericht gesprek om voldoende input te verzamelen voor een sterk artikel. Stel ÉÉN vraag tegelijk. Wees conversationeel, niet als een formulier.

Tone of voice van ${s.name}: ${s.tov}

Relevante onderwerpen om te verkennen:
- Wat is het kernonderwerp of de kernboodschap?
- Voor wie schrijven we precies? (welke professionals, welke situatie, welke twijfels)
- Welke emotie of transformatie moet het artikel teweegbrengen?
- Zijn er concrete voorbeelden, cases, cijfers of eigen ervaringen beschikbaar? Vraag hierop dóór — één echt voorbeeld of concreet getal maakt het artikel sterker dan drie algemene wensen.
- Wat maakt ${s.domain} uniek voor dit verhaal?
- Zijn er veelgehoorde bezwaren bij de doelgroep?
- Is er een gewenste call-to-action?

Vat af en toe kort samen wat je al hebt, zodat de gebruiker kan bijsturen. Scoor eerlijk: geef pas ready=true als er écht genoeg concreets ligt voor een goed artikel (onderwerp + invalshoek + minstens iets concreets zoals een voorbeeld, cijfer of duidelijke boodschap).

Na elke reactie eindig je met exact deze JSON op een nieuwe regel:
SCORE:{"score":X,"ready":false,"summary":"..."}
- score: 0-100
- ready: true zodra score >= 75
- summary: maximaal 2-3 zinnen

Begin met een vriendelijke opening en je eerste vraag.
Als de gebruiker een URL meestuurt: verwerk de inhoud als extra context.`
  },
  {
    id:'bronnen', emoji:'🌐', name:'Bronnen Agent', role:'Overheids-researcher', outputLabel:'Bronnen & feiten', pv:PROMPT_VERSIE,
    systemPrompt:`Je bent de Bronnen Agent van ${s.domain}.

Op basis van de intake-briefing verzamel je feiten en context voor een artikel gericht aan: ${s.doelgroep}.

Belangrijk: je hebt GEEN live internettoegang. Put uitsluitend uit feiten die je met grote zekerheid kent uit betrouwbare bronnen zoals CBS, Rijksoverheid, UWV, TenderNed, PIANOo, Binnenlands Bestuur, CAO Rijk.

${site === 'oo' ? `Let extra op: aanbestedingsvolumes, DAS-statistieken, marktontwikkelingen voor ZZP'ers bij de overheid, inhuurtarieven, inkoopbeleid.` : `Let extra op: arbeidsmarktcijfers overheid, detacheringsstatistieken, CAO-ontwikkelingen, salarisschalen, WTZA-regelgeving.`}

Spelregels:
- Alleen feiten die je vrijwel zeker weet. Twijfel je aan een cijfer? Laat het weg of formuleer het als orde van grootte ("ruim honderdduizend", niet "112.406").
- Cijfers zijn goud: bedragen, percentages, aantallen, termijnen. Noem altijd het jaar waaruit een cijfer stamt.
- Verzin NOOIT URLs, cijfers, citaten of onderzoeken.

Formaat:
- 4-8 regels: [BRON] Naam bron (jaar) | Feit, zo concreet mogelijk | Zekerheid: hoog/middel
- Daarna "MEEST BRUIKBAAR:" — de 2-3 feiten die dit artikel het sterkst maken, met één zin waarom.
- Sluit af met "CHECK VOOR PUBLICATIE:" — welke feiten de redactie nog moet verifiëren.`
  },
  {
    id:'researcher', emoji:'🔍', name:'Researcher', role:'Strategisch anker', outputLabel:'Strategische briefing', pv:PROMPT_VERSIE,
    systemPrompt:`Je bent contentstrateeg van ${s.domain}.

Doelgroep: ${s.doelgroep}
Tone of voice: ${s.tov}

Op basis van de intake en bronnen geef je een strategische briefing:
1. KERNBOODSCHAP: één zin die de lezer na het lezen moet onthouden.
2. DE LEZER: welke twijfel, ambitie of frustratie van deze doelgroep raakt dit onderwerp precies?
3. INVALSHOEK: wat maakt dít artikel anders dan de tien andere artikelen over dit onderwerp? Kies ÉÉN scherpe invalshoek en benoem waarom die werkt voor deze lezer.
4. ARGUMENTATIELIJN: 3-5 punten in logische volgorde, elk waar mogelijk gekoppeld aan een concreet feit uit de bronnen.
5. OPENING: een concrete suggestie — een herkenbare situatie, prikkelende vraag of verrassend feit. Geen algemene inleiding.
6. STRUCTUUR: werktitel + 3-5 tussenkoppen die inhoud beloven en nieuwsgierig maken.
7. VALKUILEN: 2-3 dingen die de Writer bij dit onderwerp moet vermijden (clichés, te veel jargon, onbewezen claims).
8. PROPOSITIE: hoe ${s.domain} natuurlijk in dit verhaal past, zonder dat het een reclametekst wordt.

Wees scherp en kies. Een briefing met tien opties is geen briefing.`
  },
  {
    id:'writer', emoji:'✍️', name:'Writer', role:'Content creator', outputLabel:'Concept artikel', pv:PROMPT_VERSIE,
    systemPrompt:`Je bent contentschrijver van ${s.domain}.

Doelgroep: ${s.doelgroep}
Tone of voice: ${s.tov}

Schrijf een volledig artikel op basis van de intake, bronnen en strategische briefing. Volg de gekozen invalshoek uit de briefing — wijk er niet vanaf.

LENGTE: {wordcount} woorden (marge ±10%). Toon: {tone}.

STRUCTUUR:
- <h1>: specifieke, prikkelende kop met een concreet element (cijfer, vraag of belofte). Geen generieke kop als "Alles wat je moet weten over...".
- Intro (2-4 zinnen): begin midden in de werkelijkheid van de lezer — een herkenbare situatie, scherpe vraag of verrassend feit. Nooit een definitie, geschiedenisles of "In dit artikel lees je...".
- 3-5 secties met <h2>-tussenkoppen die inhoud beloven (niet "Voordelen" maar bijvoorbeeld "Wat je pensioen erop vooruitgaat").
- Minstens één passage met direct toepasbare inhoud: concrete stappen, bedragen, termijnen of een voorbeeld uit de praktijk.
- Afsluiter: geen samenvatting van wat er al stond, maar een vooruitblik of aansporing met een natuurlijke CTA richting ${s.domain}.

INHOUD:
- Verwerk de feiten uit de bronnen en noem de bron in de lopende tekst ("volgens het CBS", "de CAO Rijk regelt...").
- Verzin geen feiten, cijfers of quotes die niet in de bronnen of intake staan. Liever één hard feit goed gebruikt dan vijf vage beweringen.
- Concreet wint van abstract: schrijf "schaal 12, ruim € 5.000 bruto" in plaats van "een marktconform salaris".
- Eén doordacht voorbeeld of mini-scenario overtuigt meer dan drie algemene beweringen.

STIJL:
- Spreek de lezer aan met "je".
- Actieve zinnen; wissel korte en lange zinnen af.
- Geen opsommingen met bullets in de lopende tekst — schrijf uit in zinnen.
- Gebruik deze merkwoorden waar ze natuurlijk passen:
  ${s.jargon.split('\n').slice(0,10).join(', ')}
- Vermijd ALTIJD deze woorden/zinnen:
  ${s.verboden.split('\n').join(', ')}

Lever op met <h1>, <h2> en <p> tags. Alleen het artikel, geen toelichting.`
  },
  {
    id:'reviewer', emoji:'✅', name:'Reviewer', role:'Kwaliteitsredacteur', outputLabel:'Review & verbeterd artikel', pv:PROMPT_VERSIE,
    systemPrompt:`Je bent eindredacteur van ${s.domain}. Wees streng — een artikel dat "prima" is, is niet goed genoeg.

Beoordeel het concept op deze punten en geef per punt een score (1-10) met één zin toelichting:
1. KOP & OPENING: maakt de kop nieuwsgierig met iets concreets? Begint de intro midden in de werkelijkheid van de lezer?
2. TOON: past het bij "${s.tov}"?
3. CONCREETHEID: staan er feiten, cijfers en voorbeelden in — of blijft het abstract?
4. FEITEN: kloppen de beweringen met de aangeleverde bronnen en intake? Markeer élke bewering die daar niet uit komt.
5. STRUCTUUR & LENGTE: logische opbouw, tussenkoppen die inhoud beloven, lengte binnen de afgesproken marge?
6. JARGON & VERBODEN: juiste merkwoorden gebruikt (${s.jargon.split('\n').slice(0,5).join(', ')})? Verboden woorden (${s.verboden.split('\n').join(', ')}) moeten eruit.
7. CTA: verwijst het artikel op een natuurlijke manier naar ${s.domain}?

Herschrijf daarna het artikel volledig en verwerk AL je eigen feedback. Pak vooral aan: de zwakste sectie, elke abstracte passage en elke bewering zonder onderbouwing (afzwakken of schrappen). Behoud de <h1>/<h2>/<p>-structuur.

Output in twee delen:
A) FEEDBACKPUNTEN: genummerde scores met toelichting
B) Verbeterd artikel, volledig — begin altijd met: "===ARTIKEL==="`
  },
  {
    id:'humanizer', emoji:'🧑', name:'Humanizer', role:'Anti-AI schrijver', outputLabel:'Gehumaniseerd artikel', pv:PROMPT_VERSIE,
    systemPrompt:`Je bent de Humanizer van ${s.domain}. Herschrijf het artikel zodat het klinkt als een echte ${site === 'oo' ? 'vakjournalist die ZZP-ers in de overheidsmarkt kent' : 'journalist die de overheidsarbeidsmarkt kent'} — niet als AI.

HERKEN EN VERWIJDER deze AI-patronen:
1. Opsommingstekens (-, •, *) in doorlopende tekst — herschrijf als zinnen
2. Deze woorden/zinnen: ${s.verboden.split('\n').join(', ')}
3. Formules als "niet alleen X, maar ook Y", drieklanken ("snel, makkelijk en betrouwbaar") en paragrafen die eindigen met een mini-conclusie
4. Afsluiters die beginnen met "Kortom", "Samengevat" of "Al met al", en koppen met dubbele punt + samenvatting
5. Perfecte symmetrie: paragrafen van gelijke lengte met steeds dezelfde opbouw

VOEG TOE wat een menselijke schrijver doet:
6. Variatie in ritme: wissel korte en lange zinnen af. Af en toe een heel korte.
7. Eén plek waar de schrijver kleur bekent: een lichte mening, relativering of terzijde die past bij de toon
8. Onverwachte maar natuurlijke overgangen tussen secties in plaats van gladde brugzinnen

BEHOUD volledig: alle feiten, cijfers, bronvermeldingen, merkwoorden, de CTA en de HTML-structuur (<h1>/<h2>/<p>). Verzin geen nieuwe feiten. De lengte blijft ongeveer gelijk (±10%).

Lever ALLEEN de herschreven tekst, geen toelichting.`
  }
  ];
}

// ═══════════ STATE ═══════════
let currentSite = localStorage.getItem('iv_current_site') || 'iv';

function getSiteConfig() {
  const saved = localStorage.getItem('iv_site_cfg_' + currentSite);
  return saved ? JSON.parse(saved) : {...SITE_DEFAULTS[currentSite]};
}

function getAgents() {
  const saved = localStorage.getItem('iv_ag6_' + currentSite);
  if (saved) {
    try {
      const arr = JSON.parse(saved);
      // Opgeslagen prompts van een oudere generatie? Vervang ze door de
      // verbeterde standaard-prompts (eigen aanpassingen daarna blijven bewaard).
      if (Array.isArray(arr) && arr.length && (arr[0].pv || 1) >= PROMPT_VERSIE) return arr;
      const vers = makeAgents(currentSite);
      localStorage.setItem('iv_ag6_' + currentSite, JSON.stringify(vers));
      return vers;
    } catch(e) { /* corrupt — val terug op defaults */ }
  }
  return makeAgents(currentSite);
}

let agents = getAgents();
let tone = 'professioneel inspirerend';
let wordCount = 600;
let iHist = [];
let iScore = 0; let iSum = ''; let iReady = false;
let running = false;
let OUT = {};
let catRatings = {};
let globalRating = 0;
let regenPlan = [];

function saveAgents(){ SB.saveAgents(currentSite, agents); }

// ═══════════ SITE SWITCHER ═══════════
function switchSite(site) {
  if (site === currentSite) return;
  currentSite = site;
  localStorage.setItem('iv_current_site', site);
  agents = getAgents();

  // Update visual theme
  document.body.className = site === 'oo' ? 'site-oo' : '';
  const cfg = getSiteConfig();
  const sd = SITE_DEFAULTS[site];

  // Logo
  document.querySelector('.logo').childNodes[0].textContent = site === 'oo' ? 'Opdracht' : 'Impact';
  document.getElementById('logo-span').textContent = sd.logoSpan;

  // Active button
  document.querySelectorAll('.site-btn').forEach(b => b.classList.toggle('active', b.dataset.site === site));

  // Reset all state
  iHist=[]; iScore=0; iSum=''; iReady=false; OUT={};
  globalRating=0; catRatings={}; regenPlan=[];
  document.querySelectorAll('.star').forEach(s=>s.classList.remove('on'));
  document.querySelectorAll('.bcat-star').forEach(s=>s.classList.remove('on'));
  const bt = document.getElementById('btext'); if(bt) bt.value='';
  const bp = document.getElementById('bregen-plan'); if(bp) bp.style.display='none';
  document.getElementById('aempty').style.display='flex';
  document.getElementById('acontent').style.display='none';
  document.getElementById('fstat').textContent='Wacht op intake...';

  renderSidebar();
  renderFlow();
  renderConfig();
  loadSiteConfigUI();
  switchTab('intake');
  startIntake();
}

function loadSiteConfigUI() {
  const cfg = getSiteConfig();
  const sd = SITE_DEFAULTS[currentSite];
  document.getElementById('cfg-sitename').value = cfg.domain || sd.domain;
  document.getElementById('cfg-doelgroep').value = cfg.doelgroep || sd.doelgroep;
  document.getElementById('cfg-jargon').value = cfg.jargon || sd.jargon;
  document.getElementById('cfg-verboden').value = cfg.verboden || sd.verboden;
  document.getElementById('cfg-tov').value = cfg.tov || sd.tov;
  document.getElementById('cfg-site-name').textContent = (cfg.name || sd.name) + ' — website instellingen';
  document.getElementById('cfg-site-sub').textContent = cfg.domain || sd.domain;
  document.getElementById('cfg-site-icon').textContent = currentSite === 'oo' ? '🔷' : '🟢';
}

function saveSiteConfig() {
  const cfg = getSiteConfig();
  cfg.domain = document.getElementById('cfg-sitename').value;
  cfg.doelgroep = document.getElementById('cfg-doelgroep').value;
  cfg.jargon = document.getElementById('cfg-jargon').value;
  cfg.verboden = document.getElementById('cfg-verboden').value;
  cfg.tov = document.getElementById('cfg-tov').value;
  SB.saveSiteConfig(currentSite, cfg);

  // Bouw de agent-prompts opnieuw op met de nieuwe instellingen, zodat
  // doelgroep/jargon/verboden/tone of voice direct in de prompts terechtkomen
  agents = makeAgents(currentSite);
  saveAgents();
  renderSidebar(); renderFlow();

  const ok = document.getElementById('cfg-site-ok');
  ok.style.display='inline'; setTimeout(()=>ok.style.display='none',2000);
  renderConfig();
}

// ═══════════ CONFIG EXPORT/IMPORT ═══════════
function exportConfig() {
  const config = {
    version: 1,
    iv_sb_url:     localStorage.getItem('iv_sb_url') || '',
    iv_sb_key:     localStorage.getItem('iv_sb_key') || '',
    iv_provider:   localStorage.getItem('iv_provider') || 'anthropic',
    iv_api_key:    localStorage.getItem('iv_api_key') || '',
    iv_worker_url: localStorage.getItem('iv_worker_url') || '',
    iv_model:      localStorage.getItem('iv_model') || '',
  };
  const blob = new Blob([JSON.stringify(config, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'impactvandaag-config.json';
  a.click();
}

function importConfig(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const cfg = JSON.parse(e.target.result);
      if (cfg.iv_sb_url)     localStorage.setItem('iv_sb_url',     cfg.iv_sb_url);
      if (cfg.iv_sb_key)     localStorage.setItem('iv_sb_key',     cfg.iv_sb_key);
      if (cfg.iv_provider)   localStorage.setItem('iv_provider',   cfg.iv_provider);
      if (cfg.iv_api_key)    localStorage.setItem('iv_api_key',    cfg.iv_api_key);
      if (cfg.iv_worker_url) localStorage.setItem('iv_worker_url', cfg.iv_worker_url);
      if (cfg.iv_model)      localStorage.setItem('iv_model',      cfg.iv_model);
      await initSupabase();
      loadApiSettingsUI();
      const sbUrl = document.getElementById('sb-url-input');
      const sbKey = document.getElementById('sb-key-input');
      if (sbUrl) sbUrl.value = cfg.iv_sb_url || '';
      if (sbKey) sbKey.value = cfg.iv_sb_key || '';
      alert('✓ Configuratie geladen!');
    } catch(err) { alert('Fout: ' + err.message); }
  };
  reader.readAsText(file);
}

// ═══════════ INIT ═══════════
async function init(){
  // Apply saved site theme on load
  if(currentSite === 'oo') {
    document.body.className = 'site-oo';
    document.querySelector('.logo').childNodes[0].textContent = 'Opdracht';
    document.getElementById('logo-span').textContent = 'Overheid';
    document.querySelectorAll('.site-btn').forEach(b => b.classList.toggle('active', b.dataset.site === 'oo'));
  }
  renderSidebar(); renderFlow(); renderConfig(); setupTabs(); setupTone(); setupStars(); setupUX();
  loadSiteConfigUI();
  loadApiSettingsUI();

  // Init Supabase first, then load data
  await initSupabase();

  // Herlaad API instellingen UI na Supabase sync
  // (provider/model/workerUrl kunnen nu vanuit DB zijn ingevuld)
  loadApiSettingsUI();

  // Load SB credentials into UI
  const sbUrl = document.getElementById('sb-url-input');
  const sbKey = document.getElementById('sb-key-input');
  if (sbUrl) sbUrl.value = localStorage.getItem('iv_sb_url') || '';
  if (sbKey) sbKey.value = localStorage.getItem('iv_sb_key') || '';


  // Warn if API not configured
  const s = getApiSettings();
  if (!s.apiKey || !s.workerUrl) {
    setTimeout(() => { switchTab('config'); }, 800);
  } else {
    startIntake();
  }
}

// ═══════════ SIDEBAR ═══════════
function renderSidebar(){
  document.getElementById('sb-agents').innerHTML = agents.map((a,i)=>`
    <div class="apill" style="padding-right:6px">
      <div class="aemoji" onclick="goConfig(${i})" style="cursor:pointer">${a.emoji}</div>
      <div class="ameta" onclick="goConfig(${i})" style="cursor:pointer;flex:1"><div class="aname">${a.name}</div><div class="arole">${a.role}</div></div>
      <div class="adot" id="dot-${a.id}"></div>
      ${a.id!=='intake'?`<label title="Gebruik deze agent" style="display:flex;align-items:center;cursor:pointer;margin-left:4px">
        <input type="checkbox" data-agent="${a.id}" ${activeAgents.has(a.id)?'checked':''} onchange="toggleAgent('${a.id}',this.checked)"
          style="width:14px;height:14px;accent-color:var(--g);cursor:pointer">
      </label>`:''}
    </div>`).join('');
}
function setDot(id,s){ const d=document.getElementById('dot-'+id); if(d) d.className='adot '+s; }

// ── Agent selector ──
let activeAgents = new Set(['bronnen','researcher','writer','reviewer','humanizer']);
function toggleAgent(id, on) {
  if(on) activeAgents.add(id); else activeAgents.delete(id);
  // Altijd minstens writer aan
  if(!activeAgents.has('writer')) { activeAgents.add('writer'); renderSidebar(); }
}

// ═══════════ TABS ═══════════
function setupTabs(){
  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>switchTab(t.dataset.tab)));
}
function switchTab(n){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===n));
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id==='panel-'+n));
  if(n==='archief') loadArchief();
}
function goConfig(i){ switchTab('config'); setTimeout(()=>{ const el=document.getElementById('cfg-'+agents[i].id); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); },60); }

// ═══════════ TONE ═══════════
function setupTone(){
  document.querySelectorAll('.tbtn').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.tbtn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); tone=b.dataset.tone;
  }));
}

// ═══════════ WORD COUNT ═══════════
function updateWordCount(v){
  wordCount = +v;
  document.getElementById('wc-display').textContent = v;
}
function setupStars(){
  // Global
  document.querySelectorAll('#stars .star').forEach(s=>s.addEventListener('click',()=>{
    globalRating=+s.dataset.v;
    document.querySelectorAll('#stars .star').forEach(x=>x.classList.toggle('on',+x.dataset.v<=globalRating));
  }));
  // Category
  document.querySelectorAll('.bcat-stars').forEach(row=>{
    const cat=row.dataset.cat;
    row.querySelectorAll('.bcat-star').forEach(s=>s.addEventListener('click',()=>{
      catRatings[cat]=+s.dataset.v;
      row.querySelectorAll('.bcat-star').forEach(x=>x.classList.toggle('on',+x.dataset.v<=catRatings[cat]));
    }));
  });
}

// ═══════════ UX EXTRAS ═══════════
function setupUX(){
  // Lange agent-output: klik om volledig uit te klappen (en weer in)
  const fsteps=document.getElementById('fsteps');
  if(fsteps){
    fsteps.addEventListener('click',(e)=>{
      const out=e.target.closest('.sout');
      if(out && out.classList.contains('overflowing')) out.classList.toggle('expanded');
    });
  }
  // Chat-invoer groeit mee met de tekst
  const ta=document.getElementById('iinput');
  if(ta){
    ta.addEventListener('input',()=>{
      ta.style.height='auto';
      ta.style.height=Math.min(ta.scrollHeight,110)+'px';
    });
  }
}

// ═══════════ INTAKE ═══════════
function startIntake(){
  iHist=[]; iScore=0; iSum=''; iReady=false;
  document.getElementById('ichat').innerHTML='';
  updateProg(0,false);
  setDot('intake','thinking');
  callIntake('Start het gesprek met een vriendelijke begroeting en je eerste vraag.');
}

function appendMsg(role,txt){
  const chat=document.getElementById('ichat');
  const isU=role==='user';
  const t=new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});
  const d=document.createElement('div');
  d.className='cmsg'+(isU?' u':'');
  d.innerHTML=`<div class="cav">${isU?'JIJ':agents[0].emoji}</div>
    <div class="cbub">
      <div class="bin">${txt.replace(/\n/g,'<br>')}</div>
      <div class="bmeta">${isU?'Jij':agents[0].name} · ${t}</div>
    </div>`;
  chat.appendChild(d); chat.scrollTop=chat.scrollHeight;
}

function appendTyping(){
  const chat=document.getElementById('ichat');
  const d=document.createElement('div');
  d.className='cmsg typing-bub'; d.id='tind';
  d.innerHTML=`<div class="cav">${agents[0].emoji}</div>
    <div class="cbub"><div class="bin"><span class="tdot"></span><span class="tdot"></span><span class="tdot"></span></div></div>`;
  chat.appendChild(d); chat.scrollTop=chat.scrollHeight;
}
function rmTyping(){ const t=document.getElementById('tind'); if(t)t.remove(); }

function updateProg(sc,ready){
  iScore=sc; iReady=ready;
  document.getElementById('pfill').style.width=sc+'%';
  document.getElementById('ppct').textContent=sc+'%';
  document.getElementById('rdy-btn').disabled=!ready;
}

async function callIntake(userMsg){
  const msgs=[...iHist];
  if(userMsg) msgs.push({role:'user',content:userMsg});
  appendTyping(); setDot('intake','thinking');
  document.getElementById('snd-btn').disabled=true;
  try{
    const raw=await apiCall(agents[0].systemPrompt, msgs.length?msgs:[{role:'user',content:userMsg}]);
    const m=raw.match(/SCORE:(\{[^}]+\})/);
    let disp=raw.replace(/\nSCORE:\{[^}]+\}/,'').trim();
    if(m){ try{ const p=JSON.parse(m[1]); updateProg(Math.min(100,p.score||0),p.ready||false); if(p.summary) iSum=p.summary; }catch(e){} }
    rmTyping(); appendMsg('assistant',disp);
    iHist.push({role:'user',content:userMsg||'Start'});
    iHist.push({role:'assistant',content:raw});
    setDot('intake',iReady?'done':'active');
  }catch(e){ rmTyping(); appendMsg('assistant','⚠️ Fout: '+e.message); setDot('intake','idle'); }
  document.getElementById('snd-btn').disabled=false;
  document.getElementById('iinput').focus();
}

function handleKey(e){ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendMsg(); } }

// ═══════════ FLOW STEPS (agents 1-5) ═══════════
function renderFlow(){
  const prod=agents.slice(1);
  document.getElementById('fsteps').innerHTML=prod.map((a,i)=>`
    ${i>0?'<div class="fcon">↓</div>':''}
    <div class="fstep waiting" id="fs-${a.id}">
      <div class="shd">
        <div class="snum">${i+1}</div>
        <span style="font-size:15px">${a.emoji}</span>
        <div class="san">${a.name}</div>
        <div class="sbadge" id="sb-${a.id}">Wacht</div>
      </div>
      <div class="ssub">${a.role} · ${a.outputLabel}</div>
      <div class="sout m" id="so-${a.id}">Output verschijnt hier...</div>
      ${a.id==='bronnen'?'<div class="src-list" id="srclist" style="display:none"></div>':''}
    </div>`).join('');
}

// Live timer per stap: Fable 5 denkt grondiger na, dus laat zien dat er
// gewerkt wordt en hoe lang een stap duurde.
const _stepTimers = {};
function _startStepTimer(id, badge){
  _stopStepTimer(id);
  const start = Date.now();
  _stepTimers[id] = {
    start,
    iv: setInterval(() => {
      const sec = Math.round((Date.now() - start) / 1000);
      badge.textContent = `Bezig... ${sec}s`;
    }, 1000)
  };
}
function _stopStepTimer(id){
  const t = _stepTimers[id];
  if (!t) return 0;
  clearInterval(t.iv);
  delete _stepTimers[id];
  return Math.round((Date.now() - t.start) / 1000);
}

function setStep(id,state,txt){
  const s=document.getElementById('fs-'+id);
  const b=document.getElementById('sb-'+id);
  const o=document.getElementById('so-'+id);
  if(!s) return;
  s.classList.remove('act','done','waiting');
  if(state==='thinking'){ s.classList.add('act'); b.textContent='Bezig...'; _startStepTimer(id,b); }
  if(state==='done'){ s.classList.add('done'); const sec=_stopStepTimer(id); b.textContent='Klaar ✓'+(sec?` · ${sec}s`:''); }
  if(state==='idle'){ s.classList.add('waiting'); _stopStepTimer(id); b.textContent='Wacht'; }
  if(txt!==undefined){
    o.className='sout'+(txt?'':' m');
    o.textContent=txt||'Output verschijnt hier...';
    o.classList.remove('expanded');
    // Toon "klik om alles te tonen" alleen als de output daadwerkelijk afgekapt is
    requestAnimationFrame(()=>o.classList.toggle('overflowing', o.scrollHeight > o.clientHeight + 8));
  }
  updateWfProgress();
}

// Totale workflow-voortgang bovenin het workflow-paneel
function updateWfProgress(){
  const wrap=document.getElementById('wf-prog');
  if(!wrap) return;
  // Overgeslagen agents tellen niet mee in de voortgang
  const steps=[...document.querySelectorAll('.fstep')].filter(s=>{
    const o=s.querySelector('.sout');
    return !(o && o.textContent.trim()==='Overgeslagen');
  });
  if(!steps.length){ wrap.style.display='none'; return; }
  const done=steps.filter(s=>s.classList.contains('done')).length;
  const bezig=steps.some(s=>s.classList.contains('act'));
  if(!done && !bezig){ wrap.style.display='none'; return; }
  wrap.style.display='flex';
  const pct=Math.round((done + (bezig?0.5:0)) / steps.length * 100);
  document.getElementById('wf-prog-fill').style.width=pct+'%';
  document.getElementById('wf-prog-pct').textContent=pct+'%';
  document.getElementById('wf-prog-lbl').textContent=
    done===steps.length ? '✓ Alle stappen klaar' : `Stap ${Math.min(done+1,steps.length)} van ${steps.length}`;
}

// ═══════════ LAUNCH ═══════════
async function launchAgents(extraInstructions){
  if(running) return;
  running=true; OUT={};
  document.getElementById('rdy-btn').disabled=true;
  document.getElementById('fstat').textContent='Agents aan het werk...';

  // Build intake context
  const iCtx=iHist.filter(m=>m.role==='user').map(m=>m.content).join('\n---\n');
  const iBase=`Intake samenvatting: ${iSum}\n\nVolledige gebruikersinput:\n${iCtx}\n\nToon: ${tone}`;
  const extra=extraInstructions?`\n\nEXTRA INSTRUCTIES OP BASIS VAN FEEDBACK:\n${extraInstructions}`:'';

  // Reset flow
  agents.slice(1).forEach(a=>{ setStep(a.id,'idle',''); setDot(a.id,'idle'); });
  document.getElementById('aempty').style.display='flex';
  document.getElementById('acontent').style.display='none';
  switchTab('workflow');

  try{
    // 1. Bronnen Agent
    let bronnen = '';
    if(activeAgents.has('bronnen')) {
      setStep('bronnen','thinking','Bronnen zoeken bij overheidswebsites...');
      setDot('bronnen','thinking');
      bronnen=await apiCall(agents[1].systemPrompt+extra, [{role:'user',content:iBase}]);
      OUT.bronnen=bronnen;
      setStep('bronnen','done',bronnen);
      setDot('bronnen','done');
      renderSources(bronnen);
    } else { setStep('bronnen','idle','Overgeslagen'); }

    // 2. Researcher
    let research = '';
    if(activeAgents.has('researcher')) {
      setStep('researcher','thinking','Strategie bepalen...');
      setDot('researcher','thinking');
      research=await apiCall(agents[2].systemPrompt+extra, [{role:'user',content:`${iBase}${bronnen?'\n\nGevonden bronnen:\n'+bronnen:''}`}]);
      OUT.research=research;
      setStep('researcher','done',research);
      setDot('researcher','done');
    } else { setStep('researcher','idle','Overgeslagen'); }

    // 3. Writer
    setStep('writer','thinking','Artikel schrijven...');
    setDot('writer','thinking');
    const wSys=agents[3].systemPrompt
      .replace('{tone}', tone)
      .replace('{wordcount}', wordCount)
      + extra;
    const writerMaxT = 32000; // ruim budget: bij Fable 5 telt het denkwerk mee in de output
    const ctx=[iBase, bronnen?'Bronnen:\n'+bronnen:'', research?'Strategische briefing:\n'+research:''].filter(Boolean).join('\n\n');
    const draft=await apiCall(wSys, [{role:'user',content:ctx}], writerMaxT);
    OUT.draft=draft;
    setStep('writer','done',draft);
    setDot('writer','done');

    // 4. Reviewer
    let reviewed = draft;
    if(activeAgents.has('reviewer')) {
      setStep('reviewer','thinking','Reviewen...');
      setDot('reviewer','thinking');
      const reviewerMaxT = 32000;
      const review=await apiCall(agents[4].systemPrompt+extra, [{role:'user',content:`${iBase}\n\nConcept artikel:\n${draft}`}], reviewerMaxT);
      OUT.review=review;
      setStep('reviewer','done',review);
      setDot('reviewer','done');
      const marker='===ARTIKEL===';
      const idx=review.indexOf(marker);
      reviewed=idx!==-1?review.substring(idx+marker.length).trim():draft;
    } else { setStep('reviewer','idle','Overgeslagen'); }
    OUT.reviewed=reviewed;

    // 5. Humanizer
    let final = reviewed;
    if(activeAgents.has('humanizer')) {
      setStep('humanizer','thinking','AI-schrijfpatronen verwijderen...');
      setDot('humanizer','thinking');
      const humanizerMaxT = 32000;
      final=await apiCall(agents[5].systemPrompt, [{role:'user',content:`Herschrijf dit artikel:\n\n${reviewed}`}], humanizerMaxT);
      setStep('humanizer','done',final);
      setDot('humanizer','done');
    } else { setStep('humanizer','idle','Overgeslagen'); }

    // Lengte-bewaking: corrigeer als het artikel te ver van het doel afwijkt
    document.getElementById('fstat').textContent='Lengte controleren...';
    final = await bewaakLengte(final, wordCount);
    OUT.final=final;

    // ── Auto-save naar Supabase ──
    const onderwerp = iSum ? iSum.split('.')[0].trim().substring(0,120) : 'Handmatig artikel';
    await SB.saveArtikel(currentSite, onderwerp, 'handmatig', final);

    renderArticle(OUT.final);
    document.getElementById('fstat').textContent='✓ Klaar!';
    setDot('intake','done');
    showToast('Artikel klaar!','🎉');

  }catch(e){
    document.getElementById('fstat').textContent='Fout: '+e.message;
    showToast('Er ging iets mis: '+e.message,'⚠️');
    console.error(e);
  }
  running=false;
  document.getElementById('rdy-btn').disabled=false;
}

// ═══════════ API INSTELLINGEN ═══════════
const MODELS = {
  anthropic: [
    { id: 'claude-fable-5',   label: 'Claude Fable 5 (slimste, aanbevolen)' },
    { id: 'claude-opus-4-8',  label: 'Claude Opus 4.8 (sterk, voordeliger)' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (snelst, goedkoopst)' },
  ],
  google: [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (aanbevolen)' },
    { id: 'gemini-2.5-pro',   label: 'Gemini 2.5 Pro (slimmer)' },
  ]
};

// Oude/verlopen model-IDs automatisch upgraden naar de huidige generatie
const MODEL_MIGRATIE = {
  'claude-sonnet-4-20250514':        'claude-fable-5',
  'claude-opus-4-5':                 'claude-fable-5',
  'claude-opus-4-5-20251101':        'claude-fable-5',
  'claude-haiku-4-5-20251001':       'claude-haiku-4-5',
  'gemini-2.5-flash-preview-05-20':  'gemini-2.5-flash',
  'gemini-2.5-pro-preview-05-06':    'gemini-2.5-pro',
  'gemini-2.0-flash':                'gemini-2.5-flash',
};

function getApiSettings() {
  let model = localStorage.getItem('iv_model') || 'claude-fable-5';
  if (MODEL_MIGRATIE[model]) {
    model = MODEL_MIGRATIE[model];
    localStorage.setItem('iv_model', model);
  }
  return {
    provider:   localStorage.getItem('iv_provider')   || 'anthropic',
    apiKey:     localStorage.getItem('iv_api_key')    || '',
    workerUrl:  localStorage.getItem('iv_worker_url') || '',
    model,
  };
}

async function saveApiSettings() {
  // Gebruik _currentProvider als fallback (betrouwbaarder dan hidden input)
  const provider  = _currentProvider || document.getElementById('api-provider').value || 'anthropic';
  const apiKey    = document.getElementById('api-key-input').value.trim();
  const workerUrl = document.getElementById('api-worker-url').value.trim();
  const model     = document.getElementById('api-model').value;

  localStorage.setItem('iv_provider',   provider);
  localStorage.setItem('iv_api_key',    apiKey);
  localStorage.setItem('iv_worker_url', workerUrl);
  localStorage.setItem('iv_model',      model);

  console.log('saveApiSettings:', {provider, model, workerUrl, hasKey: !!apiKey, SBok: SB.ok});

  if (!SB.ok) { await initSupabase(); }

  if (SB.ok) {
    await SB.saveApiInstellingen(provider, model, workerUrl, apiKey);
    console.log('✓ Opgeslagen in Supabase');
  } else {
    console.warn('Supabase niet actief — alleen lokaal opgeslagen. SB.ok:', SB.ok, '_client:', SB._client);
  }

  const ok = document.getElementById('api-settings-ok');
  ok.style.display='inline'; setTimeout(()=>ok.style.display='none', 2000);
  updateModelOptions();
  updateApiStatusPill();
  if (document.getElementById('ichat').children.length === 0) {
    switchTab('intake');
    startIntake();
  }
}

function updateModelOptions() {
  const provider = document.getElementById('api-provider')?.value || getApiSettings().provider;
  const sel = document.getElementById('api-model');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = MODELS[provider].map(m =>
    `<option value="${m.id}" ${m.id===current?'selected':''}>${m.label}</option>`
  ).join('');
}

function loadApiSettingsUI() {
  const s = getApiSettings();

  // Set radio buttons via visual labels
  setProviderUI(s.provider);

  // Wire up radio-style label clicks
  document.getElementById('prov-anthropic').addEventListener('click', () => setProviderUI('anthropic'));
  document.getElementById('prov-google').addEventListener('click',    () => setProviderUI('google'));

  const keyEl = document.getElementById('api-key-input');
  const wrkEl = document.getElementById('api-worker-url');
  if (keyEl) keyEl.value = s.apiKey;
  if (wrkEl) wrkEl.value = s.workerUrl;
  updateModelOptions();
  const sel = document.getElementById('api-model');
  if (sel) sel.value = s.model;
  updateApiStatusPill();
}

let _currentProvider = 'anthropic';
function setProviderUI(p) {
  _currentProvider = p;
  // Visual state
  document.getElementById('prov-anthropic').style.borderColor = p==='anthropic' ? 'var(--g)' : 'var(--bdr)';
  document.getElementById('prov-anthropic').style.background  = p==='anthropic' ? 'var(--gl)' : 'var(--sand)';
  document.getElementById('prov-google').style.borderColor    = p==='google'    ? '#4285f4'   : 'var(--bdr)';
  document.getElementById('prov-google').style.background     = p==='google'    ? '#e8f0fe'   : 'var(--sand)';
  // Hidden input for reading
  document.getElementById('api-provider').value = p;
  // Key hint
  const hint = document.getElementById('api-key-hint');
  if (p === 'anthropic') {
    hint.innerHTML = 'Haal je key op via <a href="https://console.anthropic.com/keys" target="_blank" style="color:var(--g)">console.anthropic.com/keys</a>';
  } else {
    hint.innerHTML = 'Haal je key op via <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:#4285f4">aistudio.google.com/app/apikey</a> — gratis tier beschikbaar';
  }
  updateModelOptions();
}

// Toon het actieve model in de header, met een nette label-naam
function updateModelBadge() {
  const badge = document.getElementById('model-badge');
  if (!badge) return;
  const s = getApiSettings();
  const alle = [...MODELS.anthropic, ...MODELS.google];
  const gevonden = alle.find(m => m.id === s.model);
  badge.textContent = '🤖 ' + (gevonden ? gevonden.label.split(' (')[0] : s.model);
}

function updateApiStatusPill() {
  updateModelBadge();
  const s = getApiSettings();
  const pill = document.getElementById('api-status-pill');
  if (!pill) return;
  if (s.apiKey && s.workerUrl) {
    const provLabel = s.provider === 'google' ? 'Google Gemini' : 'Anthropic Claude';
    pill.textContent = `✓ ${provLabel}`;
    pill.style.background = s.provider === 'google' ? '#e8f0fe' : 'var(--gl)';
    pill.style.color = s.provider === 'google' ? '#1a4b9e' : 'var(--g)';
    pill.style.borderColor = s.provider === 'google' ? '#b8cef4' : '#b8deca';
  } else {
    pill.textContent = '⚠ Niet geconfigureerd';
    pill.style.background = '#fff8ec';
    pill.style.color = '#b86a10';
    pill.style.borderColor = '#e8c07a';
  }
}

function toggleKeyVis() {
  const inp = document.getElementById('api-key-input');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

async function testApiConnection() {
  const result = document.getElementById('api-test-result');
  result.style.display = 'inline';
  result.style.color = 'var(--mut)';
  result.textContent = '⏳ Verbinding testen...';

  // Save current values first
  const provider  = document.getElementById('api-provider').value;
  const apiKey    = document.getElementById('api-key-input').value.trim();
  const workerUrl = document.getElementById('api-worker-url').value.trim();
  const model     = document.getElementById('api-model').value;

  if (!apiKey || !workerUrl) {
    result.textContent = '⚠ Vul eerst API key en Worker URL in';
    result.style.color = '#b86a10';
    return;
  }

  // Temporarily save for the test call
  localStorage.setItem('iv_provider',   provider);
  localStorage.setItem('iv_api_key',    apiKey);
  localStorage.setItem('iv_worker_url', workerUrl);
  localStorage.setItem('iv_model',      model);

  try {
    // Ruim budget nodig: bij Fable 5 telt het interne denkwerk mee in max_tokens
    const resp = await apiCall('Antwoord alleen met: OK', [{role:'user',content:'Test'}], 500);
    result.textContent = `✓ Verbinding werkt! (${provider === 'google' ? 'Google Gemini' : 'Anthropic Claude'})`;
    result.style.color = 'var(--g)';
    updateApiStatusPill();
  } catch(e) {
    result.textContent = `✗ Fout: ${e.message}`;
    result.style.color = '#c0392b';
  }
}

// ═══════════ API CALL ═══════════
// Slimme API-laag: automatische retries bij overbelasting (429/5xx) en een
// fallback naar Claude Opus 4.8 als de veiligheidsfilters van Fable 5 een
// verzoek onterecht weigeren (stop_reason: "refusal").
async function apiCall(system, messages, maxT=20000){
  const s = getApiSettings();

  if (!s.apiKey) throw new Error('Geen API key ingesteld — ga naar Configureer → Beveiligde instellingen');
  if (!s.workerUrl) throw new Error('Geen Worker URL ingesteld — ga naar Configureer → Beveiligde instellingen');

  const workerUrl = s.workerUrl.replace(/\/$/, '');

  const doFetch = async (model) => {
    const r = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       s.apiKey,
        'x-provider':      s.provider,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens: maxT, system, messages })
    });
    let d = null;
    try { d = await r.json(); } catch(e) { /* geen JSON — status hieronder afhandelen */ }
    return { r, d };
  };

  const MAX_POGINGEN = 3;
  let model = s.model;
  let laatsteFout = null;

  for (let poging = 1; poging <= MAX_POGINGEN; poging++) {
    let r, d;
    try {
      ({ r, d } = await doFetch(model));
    } catch(netErr) {
      laatsteFout = new Error('Netwerkfout: ' + netErr.message);
      await new Promise(res => setTimeout(res, 1500 * poging));
      continue;
    }

    // Tijdelijke fouten (rate limit / overbelast / serverfout): opnieuw proberen
    if (r.status === 429 || r.status === 529 || r.status >= 500) {
      laatsteFout = new Error(`API tijdelijk niet beschikbaar (${r.status}) — opnieuw geprobeerd`);
      await new Promise(res => setTimeout(res, 2000 * poging));
      continue;
    }

    if (d && d.error) throw new Error(d.error.message || 'Onbekende API-fout');
    if (!r.ok) throw new Error(`API-fout (HTTP ${r.status})`);
    if (!d || !Array.isArray(d.content)) throw new Error('Onverwacht antwoord van de API — controleer je Worker URL');

    // Fable 5: veiligheidsfilter kan weigeren — probeer dan Opus 4.8 met dezelfde opdracht
    if (d.stop_reason === 'refusal' && model === 'claude-fable-5') {
      console.warn('Fable 5 weigerde dit verzoek — fallback naar claude-opus-4-8');
      model = 'claude-opus-4-8';
      poging--; // fallback telt niet als mislukte poging
      continue;
    }

    const tekst = d.content.filter(b => b.type === 'text' || b.text).map(b => b.text || '').join('');
    if (d.stop_reason === 'max_tokens') console.warn('Let op: antwoord afgekapt (max_tokens bereikt)');
    if (!tekst.trim() && d.stop_reason === 'refusal') throw new Error('Het model weigerde dit verzoek (veiligheidsfilter). Pas de opdracht aan en probeer opnieuw.');
    return tekst;
  }

  throw (laatsteFout || new Error('API-aanroep mislukt na meerdere pogingen'));
}

// ═══════════ LENGTE-BEWAKING ═══════════
// Telt woorden in (HTML-)tekst en corrigeert het artikel met één extra
// redactieslag als het meer dan 15% afwijkt van het gewenste aantal woorden.
function telWoorden(html){
  return String(html||'').replace(/<[^>]+>/g,' ').trim().split(/\s+/).filter(Boolean).length;
}

async function bewaakLengte(artikel, doel){
  const wc = telWoorden(artikel);
  if (!wc || !doel || Math.abs(wc - doel) / doel <= 0.15) return artikel;
  const richting = wc > doel
    ? 'Kort het artikel in: schrap de zwakste passages en herhalingen, behoud alle feiten en de kern.'
    : 'Breid het artikel uit met concrete inhoud (voorbeelden, cijfers, praktische details) — geen vulling of herhaling.';
  try {
    const fixed = await apiCall(
      `Je bent eindredacteur. Het artikel telt ${wc} woorden, het doel is ${doel} woorden (±10%). ${richting} Behoud de tone of voice, alle bronvermeldingen en de HTML-structuur (<h1>/<h2>/<p>). Lever alleen het aangepaste artikel, geen toelichting.`,
      [{role:'user',content:artikel}], 32000
    );
    return telWoorden(fixed) > 50 ? fixed : artikel;
  } catch(e) {
    console.warn('Lengte-correctie mislukt, origineel behouden:', e.message);
    return artikel;
  }
}

// ═══════════ RENDER SOURCES ═══════════
function renderSources(txt){
  const list=document.getElementById('srclist');
  if(!list) return;
  const lines=txt.split('\n').filter(l=>l.includes('[BRON]'));
  if(!lines.length){ list.style.display='none'; return; }
  list.style.display='flex';
  list.innerHTML=lines.slice(0,6).map(l=>{
    const clean=l.replace('[BRON]','').trim();
    const parts=clean.split('|');
    return `<div class="src-item"><span class="src-tag">🔗</span><span class="src-txt">${parts.map(p=>p.trim()).join(' — ')}</span></div>`;
  }).join('');
}

// ═══════════ RENDER ARTICLE ═══════════
function renderArticle(html){
  // Strip markdown bold/italic that slipped through
  let c = html
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g,'<em>$1</em>');

  // If no HTML structure, convert newlines
  if(!c.includes('<h1>')&&!c.includes('<p>')){
    c = c.split('\n\n').map(p=>`<p>${p.replace(/\n/g,'<br>')}</p>`).join('');
  }

  // Store clean html for downloads
  OUT.articleHtml = c;

  document.getElementById('acontent').innerHTML=`
    <div class="abox">
      <div style="font-size:10px;color:var(--mut);margin-bottom:1rem;text-transform:uppercase;letter-spacing:.5px;display:flex;justify-content:space-between;align-items:center">
        <span>📄 Finaal artikel · impactvandaag.nl</span>
        <span id="art-wc" style="background:var(--gl);color:var(--g);border:1px solid #b8deca;border-radius:10px;padding:2px 8px;font-size:10px;letter-spacing:0"></span>
      </div>
      ${c}
      <div style="margin-top:1.4rem;padding-top:1rem;border-top:1px solid var(--bdr);display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="cbtn dl-btn primary" onclick="copyArt()">📋 Kopieer tekst</button>
        <button class="cbtn dl-btn" onclick="dlHTML()">⬇ HTML</button>
        <button class="cbtn dl-btn" onclick="dlWord()">⬇ Word</button>
        <button class="cbtn dl-btn" onclick="dlPDF()">⬇ PDF</button>
        <button class="cbtn dl-btn" onclick="mailNaarJan()" style="background:#fff8ec;border-color:#e8a530;color:#7a4e0a">✉ Mail naar Jan</button>
        <button class="cbtn dl-btn" style="margin-left:auto" onclick="switchTab('beoordeling')">⭐ Beoordeel &amp; verbeter</button>
      </div>
    </div>`;
  document.getElementById('aempty').style.display='none';
  document.getElementById('acontent').style.display='block';

  // Count words in rendered article
  const artText = document.getElementById('acontent').innerText || '';
  const wc = artText.trim().split(/\s+/).filter(w=>w.length>0).length;
  const wcEl = document.getElementById('art-wc');
  if(wcEl) wcEl.textContent = wc + ' woorden';

  setTimeout(()=>switchTab('artikel'),600);
}

// ═══════════ TOASTS ═══════════
// Vriendelijke melding onderin beeld i.p.v. een blokkerende alert()
function showToast(msg, emoji='✓'){
  const wrap=document.getElementById('toast-wrap');
  if(!wrap){ alert(msg); return; }
  const t=document.createElement('div');
  t.className='toast';
  t.innerHTML=`<span>${emoji}</span><span>${msg}</span>`;
  wrap.appendChild(t);
  setTimeout(()=>{ t.classList.add('uit'); setTimeout(()=>t.remove(), 320); }, 2400);
}

function copyArt(){
  navigator.clipboard.writeText(document.getElementById('acontent').innerText)
    .then(()=>showToast('Artikel gekopieerd naar klembord'))
    .catch(()=>showToast('Kopiëren mislukt — selecteer de tekst handmatig','⚠️'));
}

// ── DOWNLOAD HTML ──
function getArtikelHTML() {
  // Gebruik articleHtml als beschikbaar, anders final
  return OUT.articleHtml || OUT.final || '';
}

function getArtikelTitel() {
  const html = getArtikelHTML();
  return html.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1]?.trim() || 'artikel-impactvandaag';
}

// ── DOWNLOAD HTML ──
function dlHTML(){
  const title = getArtikelTitel();
  const html = getArtikelHTML();
  if(!html){ alert('Geen artikel beschikbaar om te downloaden.'); return; }
  const full = `<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><title>${title}</title>
<style>body{font-family:Georgia,serif;max-width:700px;margin:2rem auto;line-height:1.8;color:#1c1c1a;}
h1{font-size:28px;margin-bottom:.5rem;}h2{font-size:20px;margin:1.5rem 0 .5rem;}
p{margin-bottom:1rem;}</style></head><body>${html}</body></html>`;
  const blob = new Blob([full],{type:'text/html;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = slug(title)+'.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ── DOWNLOAD WORD ──
function dlWord(){
  const title = getArtikelTitel();
  const html = getArtikelHTML();
  if(!html){ alert('Geen artikel beschikbaar om te downloaden.'); return; }
  const body = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:w="urn:schemas-microsoft-com:office:word"
    xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="UTF-8">
  <style>
    body{font-family:Calibri,sans-serif;font-size:11pt;line-height:1.8;}
    h1{font-size:20pt;font-weight:bold;margin-bottom:6pt;}
    h2{font-size:14pt;font-weight:bold;margin-top:12pt;margin-bottom:4pt;}
    p{margin-bottom:8pt;}
  </style></head>
  <body>${html}</body></html>`;
  const blob = new Blob(['\ufeff'+body],{type:'application/vnd.ms-word;charset=utf-8'});
  const _wurl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display='none';
  a.href = _wurl;
  a.download = slug(title)+'.doc';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(_wurl); }, 300);
}

// ── DOWNLOAD PDF (via browser print) ──
function dlPDF(){
  const title = getArtikelTitel();
  const html = getArtikelHTML();
  if(!html){ alert('Geen artikel beschikbaar om te downloaden.'); return; }
  const w = window.open('','_blank');
  if(!w){ alert('Sta pop-ups toe voor PDF download.'); return; }
  w.document.write(`<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><title>${title}</title>
<style>
  @media print { @page{margin:2cm;} }
  body{font-family:Georgia,serif;font-size:11pt;max-width:100%;line-height:1.8;color:#1c1c1a;}
  h1{font-size:22pt;margin-bottom:.4rem;}
  h2{font-size:14pt;margin:1.2rem 0 .4rem;}
  p{margin-bottom:.8rem;}
  .meta{font-size:9pt;color:#888;margin-bottom:1.5rem;border-bottom:1px solid #ddd;padding-bottom:.5rem;}
</style></head><body>
<div class="meta">impactvandaag.nl — ${new Date().toLocaleDateString('nl-NL',{day:'numeric',month:'long',year:'numeric'})}</div>
${html}
</body></html>`);
  w.document.close();
  setTimeout(()=>{ w.focus(); w.print(); },600);
}

// ── MAIL NAAR JAN ──
function mailNaarJan(){
  if(!OUT.articleHtml && !OUT.final){ alert('Genereer eerst een artikel.'); return; }

  // Extract title
  const titleMatch = (OUT.articleHtml||'').match(/<h1[^>]*>([^<]+)<\/h1>/);
  const titel = titleMatch ? titleMatch[1].trim() : 'Nieuw artikel ImpactVandaag';
  const datum = new Date().toLocaleDateString('nl-NL',{day:'numeric',month:'long',year:'numeric'});

  // Plain text body for mailto
  const plainText = document.getElementById('acontent').innerText
    .replace(/\n{3,}/g,'\n\n').trim();

  const subject = encodeURIComponent(`Nieuw artikel ImpactVandaag — ${datum}: ${titel}`);
  const body = encodeURIComponent(
    `Hoi Jan,\n\nHierbij het nieuwe artikel voor impactvandaag.nl, gegenereerd op ${datum}.\n\n` +
    `──────────────────────────\n${plainText}\n──────────────────────────\n\n` +
    `Dit artikel is gegenereerd door de ImpactVandaag Artikel Agents.\n\nGroet`
  );

  // Open mail client
  const mailto = `mailto:jan.devries@kbenp.nl?subject=${subject}&body=${body}`;
  window.location.href = mailto;

  // Also trigger PDF download so they can attach it
  setTimeout(()=>{
    if(confirm('Je e-mailprogramma is geopend. Wil je ook de PDF downloaden om als bijlage toe te voegen?')){
      dlPDF();
    }
  }, 800);
}

// ── URL DETECTION IN INTAKE ──
const intakeUrls = [];

function detectUrl(ta){
  const val = ta.value;
  const urlRe = /(https?:\/\/[^\s]+)/g;
  const found = val.match(urlRe);
  if(found){
    found.forEach(url=>{
      if(!intakeUrls.includes(url)){
        intakeUrls.push(url);
        addUrlChip(url);
      }
    });
    ta.value = val.replace(urlRe,'').trim();
  }
  ta.style.height='auto';
  ta.style.height=Math.min(ta.scrollHeight,110)+'px';
}

function addUrlChip(url){
  const wrap = document.getElementById('url-chips');
  wrap.style.display='flex';
  const chip = document.createElement('div');
  chip.className='url-chip';
  chip.dataset.url=url;
  const display = url.replace(/^https?:\/\//,'').substring(0,40)+(url.length>46?'…':'');
  chip.innerHTML=`<span class="url-chip-txt" title="${url}">🔗 ${display}</span><span class="url-chip-rm" onclick="removeUrl(this,'${url.replace(/'/g,"\\'")}')">×</span>`;
  wrap.appendChild(chip);
}

function removeUrl(el, url){
  const i=intakeUrls.indexOf(url);
  if(i>-1) intakeUrls.splice(i,1);
  el.parentElement.remove();
  if(!intakeUrls.length) document.getElementById('url-chips').style.display='none';
}

async function sendMsg(){
  const inp=document.getElementById('iinput');
  let msg=inp.value.trim();
  if(!msg && !intakeUrls.length) return;

  // Build display message
  let displayMsg = msg;
  if(intakeUrls.length && !msg) displayMsg = '🔗 '+intakeUrls.map(u=>u.replace(/^https?:\/\//,'').substring(0,40)).join(', ');
  else if(intakeUrls.length) displayMsg = msg + '\n🔗 '+intakeUrls.join('\n');

  // Build API message with URLs
  let apiMsg = msg;
  if(intakeUrls.length){
    apiMsg = (msg?msg+'\n\n':'')+'URL(s) voor extra context:\n'+intakeUrls.join('\n');
  }

  inp.value=''; inp.style.height='auto';
  // Clear chips
  intakeUrls.length=0;
  document.getElementById('url-chips').innerHTML='';
  document.getElementById('url-chips').style.display='none';

  appendMsg('user', displayMsg);
  await callIntake(apiMsg);
}

// ═══════════ BEOORDELING ═══════════
async function submitBeoordeling(){
  if(!OUT.final){ alert('Genereer eerst een artikel.'); return; }
  const feedback=document.getElementById('btext').value.trim();
  const btn=document.getElementById('bsubmit');
  btn.disabled=true; btn.textContent='Analyseren...';

  // Build feedback summary
  const catSummary=Object.entries(catRatings).map(([k,v])=>`${k}: ${v}/5`).join(', ');
  const fbMsg=`
Artikel: ${OUT.final.substring(0,800)}...

Beoordeling van de gebruiker:
- Algemene score: ${globalRating}/5
- Per categorie: ${catSummary||'niet ingevuld'}
- Specifieke feedback: ${feedback||'geen'}

Analyseer welke agents aangepast moeten worden. Geef je antwoord als JSON:
{"plan":[{"id":"agent_id","emoji":"emoji","name":"naam","action":"update|skip|extra_info","reason":"korte reden","instruction":"wat de agent moet doen of aanpassen"}]}

Agent IDs: bronnen, researcher, writer, reviewer, humanizer
action=update: agent krijgt extra instructies
action=extra_info: agent krijgt meer context uit de feedback
action=skip: agent hoeft niets te veranderen

Geef alleen JSON terug, geen toelichting.`;

  try{
    const raw=await apiCall(
      'Je bent een workflow-coördinator. Analyseer feedback en verdeel instructies naar de juiste agents. Geef alleen valide JSON terug.',
      [{role:'user',content:fbMsg}], 4000
    );
    let parsed;
    try{ parsed=JSON.parse(raw.replace(/```json|```/g,'').trim()); }
    catch(e){ parsed={plan:agents.slice(1).map(a=>({id:a.id,emoji:a.emoji,name:a.name,action:'update',reason:'Feedback verwerken',instruction:feedback}))}; }

    regenPlan=parsed.plan||[];
    renderRegenPlan(regenPlan, feedback);
  }catch(e){
    alert('Fout bij analyseren: '+e.message);
  }
  btn.disabled=false; btn.textContent='↺ Regenereer op basis van feedback';
}

function renderRegenPlan(plan, feedback){
  const container=document.getElementById('bregen-actions');
  container.innerHTML=plan.map(p=>`
    <div class="agent-feedback-row">
      <div class="af-emoji">${p.emoji}</div>
      <div class="af-body">
        <div class="af-name">${p.name} <span class="af-badge ${p.action==='skip'?'skip':p.action==='extra_info'?'extra':'update'}">${p.action==='skip'?'Geen wijziging':p.action==='extra_info'?'Extra context':'Aanpassen'}</span></div>
        <div class="af-action">${p.reason}${p.instruction&&p.action!=='skip'?` — <em>${p.instruction}</em>`:''}</div>
      </div>
    </div>`).join('');
  document.getElementById('bregen-plan').style.display='block';
  document.getElementById('bregen-plan').scrollIntoView({behavior:'smooth'});
  // Store feedback for regen
  document.getElementById('bregen-go').dataset.feedback=feedback;
}

function regenAgents(){
  const feedback=document.getElementById('btext').value.trim();
  // Build combined extra instructions from plan
  const extra=regenPlan
    .filter(p=>p.action!=='skip')
    .map(p=>`[Voor ${p.name}]: ${p.instruction}`)
    .join('\n');
  document.getElementById('bregen-plan').style.display='none';
  launchAgents(extra);
}

// ═══════════ RESET ═══════════
function resetAll(){
  if(!confirm('Nieuw artikel starten? Het huidige gesprek wordt gewist.')) return;
  OUT={}; globalRating=0; catRatings={}; regenPlan=[];
  document.querySelectorAll('.star').forEach(s=>s.classList.remove('on'));
  document.querySelectorAll('.bcat-star').forEach(s=>s.classList.remove('on'));
  document.getElementById('btext').value='';
  document.getElementById('bregen-plan').style.display='none';
  switchTab('intake'); renderFlow();
  agents.forEach(a=>setDot(a.id,'idle'));
  document.getElementById('aempty').style.display='flex';
  document.getElementById('acontent').style.display='none';
  document.getElementById('fstat').textContent='Wacht op intake...';
  startIntake();
}

// ═══════════ CONFIG ═══════════
function renderConfig(){
  document.getElementById('cgrid').innerHTML=agents.map((a,i)=>`
    <div class="ccard" id="cfg-${a.id}">
      <div class="cchead">
        <span style="font-size:20px">${a.emoji}</span>
        <div><div style="font-weight:500;font-size:14px">${a.name}</div><div style="font-size:11px;color:var(--mut)">${a.role}</div></div>
        <div style="margin-left:auto;display:flex;gap:5px;flex-wrap:wrap">
          ${i===0?'<span style="font-size:10px;background:var(--ol);color:#8a3a18;padding:2px 7px;border-radius:10px;border:1px solid #f0c4aa">Intake</span>':''}
          ${a.id==='bronnen'?'<span style="font-size:10px;background:#e8f0fe;color:#1a4b8a;padding:2px 7px;border-radius:10px;border:1px solid #b8cef4">Bronnen</span>':''}
          ${a.id==='humanizer'?'<span style="font-size:10px;background:#f3e8fe;color:#5a1a8a;padding:2px 7px;border-radius:10px;border:1px solid #ceb8f4">Humanizer</span>':''}
        </div>
      </div>
      <div class="ccbody">
        <div class="frow">
          <div><div class="flbl">Naam</div><input class="finp" id="cn-${a.id}" value="${esc(a.name)}"></div>
          <div><div class="flbl">Emoji</div><input class="finp" id="ce-${a.id}" value="${a.emoji}" style="text-align:center"></div>
        </div>
        <div><div class="flbl">Rol</div><input class="finp" id="cr-${a.id}" value="${esc(a.role)}"></div>
        <div><div class="flbl">Output label</div><input class="finp" id="cl-${a.id}" value="${esc(a.outputLabel)}"></div>
        <div><div class="flbl">System prompt</div><textarea class="fta" id="cp-${a.id}">${esc(a.systemPrompt)}</textarea></div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <button class="saveb" onclick="saveAgent('${a.id}')">Opslaan</button>
          <span class="saok" id="sok-${a.id}">✓ Opgeslagen!</span>
          <button class="rlink" onclick="resetAgent('${a.id}')">Reset naar standaard</button>
        </div>
      </div>
    </div>`).join('');
}

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function saveAgent(id){
  const i=agents.findIndex(a=>a.id===id);
  agents[i].name=document.getElementById('cn-'+id).value;
  agents[i].emoji=document.getElementById('ce-'+id).value;
  agents[i].role=document.getElementById('cr-'+id).value;
  agents[i].outputLabel=document.getElementById('cl-'+id).value;
  agents[i].systemPrompt=document.getElementById('cp-'+id).value;
  saveAgents(); renderSidebar(); renderFlow(); renderConfig();
  const ok=document.getElementById('sok-'+id);
  ok.style.display='inline'; setTimeout(()=>ok.style.display='none',2000);
}

function resetAgent(id){
  if(!confirm(`Reset "${id}" naar standaard voor ${SITE_DEFAULTS[currentSite].name}?`)) return;
  const fresh = makeAgents(currentSite);
  const def = fresh.find(a=>a.id===id);
  const i = agents.findIndex(a=>a.id===id);
  agents[i]={...def};
  saveAgents(); renderSidebar(); renderFlow(); renderConfig();
}

// ═══════════ DAGELIJKSE WORKFLOW ═══════════

const NIEUWS_PROMPT = `Je bent de Nieuws Agent van impactvandaag.nl — een platform dat ervaren professionals koppelt aan overheidswerk.

Vandaag is het {datum}. Analyseer wat er de afgelopen 48 uur relevant is voor onze doelgroep: ervaren professionals (managers, specialisten, 5+ jaar werkervaring) die overwegen bij de overheid te gaan werken.

Scan mentaal de volgende bronnen:
- Rijksoverheid.nl (nieuwe vacatures, beleidsontwikkelingen, reorganisaties)
- CBS.nl (arbeidsmarktcijfers, sectorrapportages)
- Binnenlandsbestuur.nl (overheidsnieuws)
- Gemeentebanenmarkt, werkenvoornederland.nl
- Algemene arbeidsmarkttrends voor hoger opgeleiden

Geef je analyse in dit exacte formaat:

NIEUWS_GEVONDEN: ja/nee
RELEVANTIE_SCORE: 0-10
NIEUWS_ITEM: [korte beschrijving van het meest relevante item, of "geen" als niets relevant]
REDENERING: [waarom dit wel/niet relevant is voor de doelgroep]
ONDERWERP_VOORSTEL: [concrete onderwerpstitel voor een artikel]

Wees eerlijk. Als je geen actueel nieuws kent dat relevant genoeg is (score < 6), zeg dan "nee".`;

const EVERGREEN_PROMPT = `Je bent een contentstrateeg voor impactvandaag.nl.

Vandaag is er geen urgent nieuws. Kies het beste evergreen onderwerp voor een artikel gericht aan ervaren professionals die overwegen bij de overheid te werken.

AL GESCHREVEN ONDERWERPEN (vermijd deze volledig, ook vergelijkbare invalshoeken):
{blacklist}

BESCHIKBARE THEMA-CATEGORIEËN:
1. Arbeidsvoorwaarden & rechtspositie overheid
2. Carrière-transitie van privaat naar publiek
3. Specifieke overheidsrollen (beleidsadviseur, projectmanager, inkoper, etc.)
4. Werk-privébalans bij de overheid
5. Salarisschalen en pensioen rijksoverheid
6. Cultuurverschil overheid vs. bedrijfsleven
7. Hoe impactvandaag.nl werkt en wat het biedt
8. Succesverhalen van professionals bij de overheid
9. Actuele uitdagingen waarvoor de overheid professionals zoekt
10. Flexibiliteit, thuiswerken en hybride werken bij de overheid

Kies het onderwerp dat:
- Nog NIET in de lijst staat
- Het meest waardevol is voor de doelgroep op dit moment
- Concreet genoeg is voor een sterk artikel

Geef je antwoord in dit exacte formaat:
ONDERWERP: [titel]
CATEGORIE: [nummer uit lijst]
INVALSHOEK: [1-2 zinnen over de specifieke insteek]
BRIEFING: [3-5 zinnen strategische context voor de writers]`;

// Dagelijks state
let dagHistory = [];
let dagBlacklist = '';
let dagRunning = false;

async function initDagelijks(){
  dagHistory  = await SB.getArtikelen(currentSite);
  dagBlacklist = await SB.getBlacklist(currentSite);
  renderDagHistory();
  const blEl = document.getElementById('dag-blacklist');
  if (blEl) blEl.value = dagBlacklist;
  const last = dagHistory[0];
  const lastEl = document.getElementById('dag-last-run');
  if (lastEl) lastEl.textContent = last ? formatDate(last.date) : 'Nog nooit gedraaid';
  const dagMailDiv = document.getElementById('dag-mail-row');
  if(dagMailDiv) dagMailDiv.style.display='none';
}

function formatDate(iso){
  return new Date(iso).toLocaleDateString('nl-NL',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

function saveBlacklist(){
  dagBlacklist = document.getElementById('dag-blacklist').value;
  SB.saveBlacklist(currentSite, dagBlacklist);
  const ok = document.getElementById('dag-bl-ok');
  ok.style.display='inline'; setTimeout(()=>ok.style.display='none',2000);
}

function clearHistory(){
  if(!confirm('Alle artikel-geschiedenis wissen voor ' + SITE_DEFAULTS[currentSite].name + '?')) return;
  dagHistory=[];
  localStorage.removeItem('iv_dag_history_' + currentSite);
  dagBlacklist='';
  SB.saveBlacklist(currentSite, '');
  localStorage.removeItem('iv_dag_blacklist_' + currentSite);
  document.getElementById('dag-blacklist').value='';
  renderDagHistory();
}

function renderDagHistory(){
  const list = document.getElementById('dag-history-list');
  const count = document.getElementById('dag-art-count');
  count.textContent = dagHistory.length + ' artikel' + (dagHistory.length!==1?'en':'');
  if(!dagHistory.length){
    list.innerHTML='<div style="font-size:12px;color:var(--mut);font-style:italic;padding:4px 0">Nog geen artikelen gegenereerd.</div>';
    return;
  }
  list.innerHTML = dagHistory.map((item,i)=>`
    <div class="dag-hist-item" onclick="loadHistoryItem(${i})">
      <div style="font-size:20px">${item.type==='nieuws'?'📰':'🌿'}</div>
      <div class="dag-hist-meta">
        <div class="dag-hist-title">${item.onderwerp}</div>
        <div class="dag-hist-sub">${formatDate(item.date)}</div>
      </div>
      <span class="dag-hist-type ${item.type}">${item.type==='nieuws'?'Nieuws':'Evergreen'}</span>
    </div>`).join('');
}

function loadHistoryItem(i){
  const item = dagHistory[i];
  if(!item||!item.artikel) return;
  OUT.final = item.artikel;
  OUT.articleHtml = item.artikel;
  renderArticle(item.artikel);
}

async function startDagelijkseRun(){
  if(dagRunning||running) return;
  dagRunning = true;
  const btn = document.getElementById('dag-run-btn');
  btn.disabled = true; btn.textContent = '⏳ Bezig...';

  // Show progress
  const progEl = document.getElementById('dag-progress');
  progEl.style.display='block';
  const steps = [
    {id:'s1', label:'Nieuws Agent — overheidsnieuws scannen'},
    {id:'s2', label:'Onderwerp bepalen'},
    {id:'s3', label:'Bronnen Agent'},
    {id:'s4', label:'Researcher'},
    {id:'s5', label:'Writer'},
    {id:'s6', label:'Reviewer'},
    {id:'s7', label:'Humanizer'},
  ];
  document.getElementById('dag-prog-steps').innerHTML = steps.map(s=>`
    <div class="dag-step-row">
      <div class="dag-step-dot" id="ds-${s.id}"></div>
      <span id="dl-${s.id}" style="color:var(--mut)">${s.label}</span>
    </div>`).join('');

  function setDS(id,state,label){
    const d=document.getElementById('ds-'+id); if(d) d.className='dag-step-dot '+state;
    const l=document.getElementById('dl-'+id); if(l&&label){ l.textContent=label; l.style.color=state==='ok'?'var(--dark)':'var(--mut)'; }
  }

  // Show nieuws card
  document.getElementById('dag-nieuws-card').style.display='block';
  document.getElementById('dag-onderwerp-card').style.display='none';

  try {
    // ── STAP 1: Nieuws Agent ──
    setDS('s1','run');
    const datum = new Date().toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    const bestaandeOnderwerpen = dagHistory.map(h=>h.onderwerp).join('\n') + '\n' + dagBlacklist;

    // Ruim tokenbudget: bij Fable 5 telt het denkwerk mee in max_tokens —
    // met een krap budget wordt de output afgekapt
    const nieuwsRaw = await apiCall(
      'Je bent een nauwkeurige nieuws-analist. Geef altijd je antwoord in het gevraagde formaat.',
      [{role:'user', content: NIEUWS_PROMPT.replace('{datum}',datum)}],
      8000
    );
    document.getElementById('dag-nieuws-out').textContent = nieuwsRaw;
    document.getElementById('dag-nieuws-badge').textContent = 'Klaar ✓';
    document.getElementById('dag-nieuws-badge').className = 'dag-badge ok';
    setDS('s1','ok','Nieuws Agent — klaar');

    // Parse nieuws output
    const nieuwsGevonden = /NIEUWS_GEVONDEN:\s*ja/i.test(nieuwsRaw);
    const relevantieMatch = nieuwsRaw.match(/RELEVANTIE_SCORE:\s*(\d+)/);
    const relevantie = relevantieMatch ? +relevantieMatch[1] : 0;
    const onderwerpMatch = nieuwsRaw.match(/ONDERWERP_VOORSTEL:\s*(.+)/);
    let nieuwsOnderwerp = onderwerpMatch ? onderwerpMatch[1].trim() : '';

    const gebruikNieuws = nieuwsGevonden && relevantie >= 6;

    // Show beslissing
    const beslissEl = document.getElementById('dag-beslissing');
    beslissEl.style.display='block';
    document.getElementById('dag-beslissing-icon').textContent = gebruikNieuws ? '📰' : '🌿';
    document.getElementById('dag-beslissing-txt').textContent = gebruikNieuws
      ? `Relevant nieuws gevonden (score ${relevantie}/10) — schrijven we een nieuwsartikel.`
      : `Geen urgent nieuws (score ${relevantie}/10) — we schrijven een evergreen artikel.`;

    // ── STAP 2: Onderwerp bepalen ──
    setDS('s2','run');
    let briefing = '';
    let artikelType = gebruikNieuws ? 'nieuws' : 'evergreen';
    let gekozenOnderwerp = '';

    if(gebruikNieuws){
      gekozenOnderwerp = nieuwsOnderwerp;
      briefing = nieuwsRaw; // full nieuws context is the briefing
    } else {
      // Call evergreen agent
      const evergreenRaw = await apiCall(
        'Je bent een contentstrateeg. Geef altijd je antwoord in het gevraagde formaat.',
        [{role:'user', content: EVERGREEN_PROMPT.replace('{blacklist}', bestaandeOnderwerpen || 'Geen')}],
        8000
      );
      const evOnderwerp = evergreenRaw.match(/ONDERWERP:\s*(.+)/)?.[1]?.trim() || 'Overheidswerk voor professionals';
      const evBriefing = evergreenRaw.match(/BRIEFING:\s*([\s\S]+)/)?.[1]?.trim() || evergreenRaw;
      gekozenOnderwerp = evOnderwerp;
      briefing = evergreenRaw;
    }

    document.getElementById('dag-onderwerp-card').style.display='block';
    document.getElementById('dag-onderwerp-out').textContent = `📌 ${gekozenOnderwerp}\n\n${briefing}`;
    setDS('s2','ok','Onderwerp bepaald: ' + gekozenOnderwerp.substring(0,50));

    // ── STAP 3-7: Productie-agents ──
    const iBase = `Dagelijkse run — ${datum}\nType: ${artikelType}\nOnderwerp: ${gekozenOnderwerp}\nToon: ${tone}\nAantal woorden: ${wordCount}\n\nBriefing:\n${briefing}`;

    setDS('s3','run');
    const bronnen = await apiCall(agents[1].systemPrompt, [{role:'user',content:iBase}], 12000);
    setDS('s3','ok');

    setDS('s4','run');
    const research = await apiCall(agents[2].systemPrompt, [{role:'user',content:`${iBase}\n\nGevonden bronnen:\n${bronnen}`}], 12000);
    setDS('s4','ok');

    setDS('s5','run');
    const wSys = agents[3].systemPrompt.replace('{tone}',tone).replace('{wordcount}',wordCount);
    const writerMaxT = 32000; // ruim budget: bij Fable 5 telt het denkwerk mee in de output
    const draft = await apiCall(wSys, [{role:'user',content:`${iBase}\n\nBronnen:\n${bronnen}\n\nStrategische briefing:\n${research}`}], writerMaxT);
    setDS('s5','ok');

    setDS('s6','run');
    const reviewerMaxT = 20000;
    const review = await apiCall(agents[4].systemPrompt, [{role:'user',content:`${iBase}\n\nConcept artikel:\n${draft}`}], reviewerMaxT);
    const marker='===ARTIKEL===';
    const idx=review.indexOf(marker);
    const reviewed = idx!==-1 ? review.substring(idx+marker.length).trim() : draft;
    setDS('s6','ok');

    setDS('s7','run');
    const humMaxT = 20000;
    let final = await apiCall(agents[5].systemPrompt, [{role:'user',content:`Herschrijf dit artikel:\n\n${reviewed}`}], humMaxT);
    // Lengte-bewaking: corrigeer als het artikel te ver van het doel afwijkt
    final = await bewaakLengte(final, wordCount);
    setDS('s7','ok');

    // ── Opslaan in geschiedenis ──
    const histItem = {
      date: new Date().toISOString(),
      onderwerp: gekozenOnderwerp,
      type: artikelType,
      artikel: final
    };
    dagHistory.unshift(histItem);
    await SB.saveArtikel(currentSite, gekozenOnderwerp, artikelType, final);

    // Update blacklist
    dagBlacklist = (dagBlacklist ? dagBlacklist + '\n' : '') + gekozenOnderwerp;
    await SB.saveBlacklist(currentSite, dagBlacklist);
    document.getElementById('dag-blacklist').value = dagBlacklist;

    // Render article and history
    OUT.final = final; OUT.articleHtml = final;
    renderDagHistory();
    renderArticle(final);
    // Show mail button in dagelijks tab
    const dagMailDiv = document.getElementById('dag-mail-row');
    if(dagMailDiv) dagMailDiv.style.display='flex';

    document.getElementById('dag-last-run').textContent = formatDate(histItem.date);

  } catch(e) {
    document.getElementById('dag-nieuws-out').textContent = '⚠️ Fout: ' + e.message;
    console.error(e);
  }

  dagRunning = false;
  btn.disabled = false; btn.textContent = '▶ Start dagelijkse run';
}

// ═══════════ ARCHIEF ═══════════
let archiefData = [];

async function loadArchief() {
  document.getElementById('arch-list').innerHTML = '<div class="arch-empty">Laden...</div>';
  // Load from both sites
  const iv = await SB.getArtikelen('iv');
  const oo = await SB.getArtikelen('oo');
  archiefData = [...iv, ...oo].sort((a,b) => new Date(b.date) - new Date(a.date));
  renderArchief();
}

function renderArchief() {
  const filterSite = document.getElementById('arch-filter-site')?.value || 'all';
  const filterType = document.getElementById('arch-filter-type')?.value || 'all';
  const list = document.getElementById('arch-list');

  let items = archiefData;
  if(filterSite !== 'all') items = items.filter(i => i.site === filterSite || !i.site);
  if(filterType !== 'all') items = items.filter(i => i.type === filterType);

  if(!items.length) {
    list.innerHTML = '<div class="arch-empty">Geen artikelen gevonden.</div>';
    return;
  }

  const countEl = document.getElementById('arch-count');
  if(countEl) countEl.textContent = items.length + ' artikel' + (items.length !== 1 ? 'en' : '');

  list.innerHTML = items.map((item, idx) => {
    const siteLabel = item.site === 'oo' ? 'OpdrachtOverheid' : 'ImpactVandaag';
    const siteColor = item.site === 'oo' ? '#e8eef8' : 'var(--gl)';
    const siteTxtColor = item.site === 'oo' ? '#1a4b9e' : 'var(--g)';
    const type = item.type || 'handmatig';
    const typeLabel = type === 'handmatig' ? '✍ handmatig' : type === 'nieuws' ? '📰 nieuws' : '🌿 evergreen';
    const rawText = (item.artikel || '').replace(/<[^>]+>/g,'');
    const titel = (item.onderwerp || rawText.substring(0,60) || 'Zonder titel');
    const preview = rawText.substring(0,160).trim() + (rawText.length > 160 ? '...' : '');
    const datum = item.date ? new Date(item.date).toLocaleDateString('nl-NL',{day:'numeric',month:'short',year:'numeric'}) : '';
    const tijd = item.date ? new Date(item.date).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'}) : '';
    const wc = rawText.trim().split(/\s+/).filter(w=>w.length>0).length;
    return `
      <div class="arch-item" onclick="openArchiefItem(${idx})">
        <div class="arch-item-top">
          <div class="arch-item-title">${titel}</div>
          <div class="arch-item-badges">
            <span class="arch-type ${type}">${typeLabel}</span>
            <span class="arch-site-badge" style="background:${siteColor};color:${siteTxtColor}">${siteLabel}</span>
          </div>
        </div>
        <div class="arch-item-preview">${preview}</div>
        <div class="arch-item-footer">
          <div class="arch-item-meta">📅 ${datum} ${tijd} &nbsp;·&nbsp; ${wc} woorden</div>
          <button class="arch-open-btn" onclick="event.stopPropagation();openArchiefItem(${idx})">Lees artikel →</button>
        </div>
      </div>`;
  }).join('');
}

function openArchiefItem(idx) {
  const items = archiefData;
  const filterSite = document.getElementById('arch-filter-site')?.value || 'all';
  const filterType = document.getElementById('arch-filter-type')?.value || 'all';
  let filtered = items;
  if(filterSite !== 'all') filtered = filtered.filter(i => i.site === filterSite || !i.site);
  if(filterType !== 'all') filtered = filtered.filter(i => i.type === filterType);
  const item = filtered[idx];
  if(!item) return;
  OUT.final = item.artikel;
  OUT.articleHtml = item.artikel;
  renderArticle(item.artikel);
}

// ═══════════ STARTUP ═══════════
init();
