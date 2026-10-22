/* Códigos das Fotos — Calçados 24h
   App de página única com rotas (#/escritorio, #/painel/...). Mesmo banco do site antigo:
   tabela "itens" (id, doc), "fins", "perfis" e o bucket de fotos "fotos" no Supabase.
   Sem Supabase, funciona em modo local (localStorage), igual à versão anterior. */
(() => {
'use strict';

/* ============ constantes e utilidades ============ */
const KEY = 'codigos-fotos-v1', KEY_FIM = 'codigos-fotos-fim-v1', KEY_VISTO = 'codigos-fotos-esc-visto-v1', KEY_USERS = 'codigos-fotos-usuarios-v1', KEY_SESSAO = 'codigos-fotos-sessao-v1';
const USUARIOS_PADRAO = [{ u: 'danilolira', h: 'b26de416ecf3ff85', papel: 'admin' }];
const JA_TENHO = 'Já tenho as fotos';
const MOTIVOS = [JA_TENHO, 'Falta o escritório mandar as fotos', 'Falta receber as fotos', 'Não tenho fotos', 'Somente foto de capa', 'Foto de baixa qualidade'];
const MARCAS_ALIAS = { 'MARIAS SHOES': "MARIA'S SHOES", "MARIA'S SHOES": "MARIA'S SHOES" };

const esperar = (fn, ms) => new Promise(res => { const t0 = Date.now(); const tick = () => { const v = fn(); if (v) return res(v); if (Date.now() - t0 > ms) return res(null); setTimeout(tick, 100); }; tick(); });
const limpaUser = u => u.trim().toLowerCase().replace(/\s+/g, '');
function hashTxt(t) { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16); }
const hoje = () => new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const hm = t => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const hora = t => t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
const diaKey = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const uid = () => Math.random().toString(36).slice(2, 10);
const ler = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, s, p) => n === 1 ? `1 ${s}` : `${n} ${p || s + 's'}`;
const normMarca = m => { const k = (m || '').trim().toUpperCase().replace(/[’']/g, "'"); return MARCAS_ALIAS[k] || (m || '').trim(); };
const fotoOk = u => typeof u === 'string' && u.length > 0 && !u.startsWith('{{');
const fotosDe = i => (i.fotos || []).filter(fotoOk);
const ehPF = i => !!(i.motivoFoto && i.motivoFoto !== JA_TENHO);   // tem pendência de foto
const porMarca = l => { const m = new Map(); l.forEach(i => { const k = i.marca || '—'; if (!m.has(k)) m.set(k, []); m.get(k).push(i); }); return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')); };

function parseLista(txt) {
  let marca = '', data = hoje(); const out = [];
  for (const raw of txt.split(/\r?\n/)) {
    const l = raw.trim(); if (!l) continue;
    const d = l.match(/^fotos iniciadas em (.+)$/i); if (d) { data = d[1].replace(/\.$/, ''); continue; }
    if (/^(c[óo]digos|total)/i.test(l)) continue;
    const s = l.match(/^(.+?)\s+[—–-]\s+(.*)$/);
    if (s && /falta/i.test(s[2])) {
      const o = s[2].match(/observa[çc][ãa]o:\s*(.+)$/i);
      out.push({ marca: marca || '—', ref: s[1].trim(), nota: o ? o[1].trim() : '', data });
      continue;
    }
    marca = l.replace(/:$/, '').toUpperCase();
  }
  return out;
}
const novoItem = p => ({ id: uid(), marca: normMarca(p.marca), ref: p.ref, nota: p.nota || '', motivoFoto: p.motivoFoto || '', valores: p.valores || [], data: p.data || hoje(), fotos: p.fotos || [], status: p.status || 'pendente', origem: p.origem || 'avulso', cadastradoEm: p.cadastradoEm || Date.now(), codigo: '', obs: '', criado: Date.now(), visto: true });
function loadLocal() { const v = ler(KEY, null); return Array.isArray(v) ? v : []; }

function resize(file) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 800 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => res(null);
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

/* ============ estado ============ */
const qMode = new URLSearchParams(location.search).get('modo');
const FIXO = qMode === 'escritorio' || qMode === 'dono' ? 'escritorio' : qMode === 'painel' ? 'painel' : null;
const S = {
  itens: [], fim: [], user: null, usuarios: [], pronto: false,
  online: navigator.onLine !== false, toast: '', copiado: null,
  sel: {}, edit: null, editCod: null, modal: null, modalIdx: 0, zoom: false, confirm: null,
  novasFotos: [], novosValores: [''], dropOver: null, entrando: false, criando: false, loginErro: '',
  catPagina: 40, vistoAte: ler(KEY_VISTO, 0),
  notifPerm: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
};
const D = {};               // rascunhos de campos (não re-renderizam ao digitar)
let sb = null, cfg = null, canal = null, cur = [], pend = { up: {}, del: {} }, syncT = null, toastT = null, copyT = null;

/* ============ rotas ============ */
function rota() {
  const h = (location.hash || '').replace(/^#/, '');
  const [p, qs] = h.split('?');
  return { path: p || '', q: Object.fromEntries(new URLSearchParams(qs || '')) };
}
const ir = h => { if (location.hash !== h) location.hash = h; else render(); };
const modoAtual = () => rota().path.startsWith('/painel') || rota().path === '/login' ? 'painel' : 'escritorio';

/* ============ dados derivados ============ */
function calc() {
  const it = S.itens, ativo = i => i.status !== 'feito' && i.status !== 'rascunho';
  const oCod = it.filter(i => i.status === 'pendente');
  const oFotos = it.filter(i => ativo(i) && ehPF(i) && !i.fotosEnviadas);
  const oConf = it.filter(i => ativo(i) && ehPF(i) && i.fotosEnviadas);
  const aguard = it.filter(i => ['rascunho', 'pendente', 'naosei'].includes(i.status) && !ehPF(i));
  const rasc = it.filter(i => i.status === 'rascunho');
  const receb = it.filter(i => i.status === 'respondido' && !ehPF(i) && !(i.enviadoSite && !i.enviadoAtacado));
  const lembretes = it.filter(i => i.enviadoSite && !i.enviadoAtacado);
  const fazer = it.filter(i => i.status !== 'feito' && ehPF(i));
  const feitos = it.filter(i => i.status === 'feito' && i.feitoEm).sort((a, b) => b.feitoEm - a.feitoEm);
  const hk = diaKey(Date.now());
  const feitosHoje = feitos.filter(i => diaKey(i.feitoEm) === hk);
  const oTotalRefs = new Set([...oCod, ...oFotos].map(i => i.id)).size;
  return { oCod, oFotos, oConf, oTotalRefs, aguard, rasc, receb, lembretes, fazer, feitos, feitosHoje,
    fazerResp: fazer.filter(i => i.status === 'respondido'), conferir: fazer.filter(i => i.fotosEnviadas),
    nNovos: receb.filter(i => !i.visto).length };
}

/* ============ inicialização e sincronização ============ */
async function init() {
  cfg = await esperar(() => window.CF_CONFIG, 2500);
  if (cfg && cfg.supabaseUrl && cfg.supabaseAnonKey) {
    const lib = await esperar(() => window.supabase, 8000);
    if (lib) sb = lib.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  }
  let usou = false;
  if (sb) {
    try {
      const { data } = await sb.auth.getSession();
      if (data && data.session) await carregarPerfil(data.session.user);
      await carregarDados();
      usou = true;
    } catch (e) { sb = null; toast('Sem conexão com o servidor — usando dados salvos neste dispositivo'); }
  }
  if (!usou) {
    cur = loadLocal(); S.itens = cur; S.fim = ler(KEY_FIM, []);
    const u = ler(KEY_SESSAO, null), x = u && usuariosLocais().find(y => y.u === u);
    if (x) entrou({ u: x.u, papel: 'admin' });
  }
  S.pronto = true;
  if (!rota().path) location.replace('#' + (FIXO === 'painel' || (!FIXO && S.user) ? '/painel' : '/escritorio'));
  render();
}
const emailDe = u => u + '@' + ((cfg && cfg.dominioEmail) || 'calcados24h.app');
const usuariosLocais = () => ler(KEY_USERS, null) || USUARIOS_PADRAO;
async function carregarPerfil(authUser) {
  const { data } = await sb.from('perfis').select('id,usuario,papel').eq('id', authUser.id).maybeSingle();
  if (!data) { await sb.auth.signOut(); return false; }
  entrou({ u: data.usuario, papel: 'admin', id: data.id });
  return true;
}
async function carregarDados() {
  const { data, error } = await sb.from('itens').select('id,doc');
  if (error) throw error;
  cur = data.map(r => r.doc).filter(Boolean).sort((a, b) => (a.criado || 0) - (b.criado || 0));
  S.itens = cur;
  const fr = await sb.from('fins').select('em');
  S.fim = (fr.data || []).map(r => +r.em);
  if (canal) sb.removeChannel(canal);
  canal = sb.channel('cf-itens')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'itens' }, p => {
      let l = cur.slice();
      if (p.eventType === 'DELETE') l = l.filter(i => i.id !== (p.old && p.old.id));
      else { const d = p.new.doc, k = l.findIndex(i => i.id === d.id); if (k >= 0) l[k] = d; else l.push(d); }
      aplicarRemoto(mesclarPendentes(l));
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fins' }, p => { S.fim = [...S.fim, +p.new.em]; })
    .subscribe();
}
function entrou(user) { S.user = user; S.loginErro = ''; setTimeout(carregarUsuarios, 0); }
async function entrar() {
  const u = limpaUser(D['l-u'] || ''), senha = D['l-s'] || '';
  if (!u || !senha) { S.loginErro = 'Preencha usuário e senha.'; return render(); }
  const destino = rota().q.next || '/painel';
  if (sb) {
    S.entrando = true; S.loginErro = ''; render();
    const { data, error } = await sb.auth.signInWithPassword({ email: emailDe(u), password: senha });
    S.entrando = false; D['l-s'] = '';
    if (error) { S.loginErro = 'Usuário ou senha incorretos.'; return render(); }
    const ok = await carregarPerfil(data.user);
    if (!ok) { S.loginErro = 'Este usuário não tem acesso liberado.'; return render(); }
    return ir('#' + destino);
  }
  const x = usuariosLocais().find(y => y.u === u && y.h === hashTxt(u + ':' + senha));
  D['l-s'] = '';
  if (!x) { S.loginErro = 'Usuário ou senha incorretos.'; return render(); }
  localStorage.setItem(KEY_SESSAO, JSON.stringify(u));
  entrou({ u: x.u, papel: 'admin' });
  ir('#' + destino);
}
async function sair() {
  await flush();
  if (sb) { await sb.auth.signOut(); }
  else localStorage.removeItem(KEY_SESSAO);
  S.user = null; S.usuarios = [];
  ir('#/escritorio');
}
async function carregarUsuarios() {
  if (sb) { const { data } = await sb.from('perfis').select('id,usuario,papel').order('usuario'); S.usuarios = (data || []).map(r => ({ u: r.usuario, papel: r.papel, id: r.id })); }
  else S.usuarios = usuariosLocais().map(x => ({ u: x.u, papel: x.papel }));
  render();
}
async function criarUsuario() {
  const u = limpaUser(D['nu'] || ''), senha = D['ns'] || '';
  if (!/^[a-z0-9._-]{3,}$/.test(u)) return toast('Usuário: mínimo 3 letras, sem espaço nem acento');
  if (senha.length < 6) return toast('A senha precisa ter pelo menos 6 caracteres');
  if (S.usuarios.some(x => x.u === u)) return toast('Esse usuário já existe');
  S.criando = true; render();
  try {
    if (sb) {
      const tmp = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'cf-tmp' } });
      const { data, error } = await tmp.auth.signUp({ email: emailDe(u), password: senha });
      if (error) throw error;
      if (!data.user || (data.user.identities && data.user.identities.length === 0)) throw new Error('Esse usuário já existe no Supabase');
      const r = await sb.from('perfis').insert({ id: data.user.id, usuario: u, papel: 'admin' });
      if (r.error) throw r.error;
    } else gravar(KEY_USERS, [...usuariosLocais(), { u, h: hashTxt(u + ':' + senha), papel: 'admin' }]);
    D['nu'] = ''; D['ns'] = '';
    await carregarUsuarios();
    toast('Acesso criado: ' + u);
  } catch (e) { toast('Erro: ' + (e.message || e)); }
  S.criando = false; render();
}
async function removerUsuario(x) {
  if (sb) { const r = await sb.from('perfis').delete().eq('id', x.id); if (r.error) return toast('Erro: ' + r.error.message); }
  else gravar(KEY_USERS, usuariosLocais().filter(y => y.u !== x.u));
  carregarUsuarios(); toast('Acesso removido');
}
function mesclarPendentes(itens) { return Object.keys(pend.up).length ? itens.map(i => pend.up[i.id] || i) : itens; }
function aplicarRemoto(itens) {
  const antes = new Set(cur.filter(i => i.status === 'respondido').map(i => i.id));
  const feitosAntes = new Set(cur.filter(i => i.status === 'feito').map(i => i.id));
  const pendAntes = cur.filter(i => i.status === 'pendente').length;
  const fotosAntes = new Set(cur.filter(i => i.fotosEnviadas).map(i => i.id));
  const chegou = itens.filter(i => i.status === 'respondido' && !antes.has(i.id));
  const novosFeitos = itens.filter(i => i.status === 'feito' && !feitosAntes.has(i.id));
  const novosPend = itens.filter(i => i.status === 'pendente').length - pendAntes;
  const fotosChegou = itens.filter(i => i.fotosEnviadas && !fotosAntes.has(i.id));
  cur = itens; S.itens = itens;
  const modo = modoAtual();
  if (modo === 'painel' && S.user && (chegou.length || fotosChegou.length)) {
    const c = chegou[0];
    const msg = chegou.length > 1 ? `${chegou.length} novos códigos chegaram` : c ? `Novo código: ${c.marca} ${c.ref} → ${c.codigo}` : `Escritório enviou fotos de ${fotosChegou[0].marca} ${fotosChegou[0].ref}`;
    toast(msg); beep(); notificar(msg);
  } else if (modo === 'escritorio' && novosFeitos.length) {
    const f = novosFeitos[0];
    toast(novosFeitos.length > 1 ? `${novosFeitos.length} produtos já estão no site` : `${f.marca} ${f.ref} já está no site`); beep();
  } else if (modo === 'escritorio' && novosPend > 0) {
    const msg = novosPend > 1 ? `${novosPend} novos produtos esperando código` : 'Novo produto esperando código';
    toast(msg); beep(); notificar(msg);
  }
  render();
}
function notificar(msg) { try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('Calçados 24h', { body: msg, tag: 'codigos-fotos' }); } catch (e) {} }
function beep() { try { const a = new AudioContext(), o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.15); } catch (e) {} }
function toast(t) { clearTimeout(toastT); S.toast = t; render(); toastT = setTimeout(() => { S.toast = ''; render(); }, 3200); }
function confirmar(msg, sim, nao, simTxt) { S.confirm = { msg, sim, nao, simTxt }; render(); }
function gravar(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); }
  catch (e) { toast('Memória cheia: apague itens antigos com fotos no histórico'); }
}
function upd(fn) {
  const antes = cur, depois = fn(antes);
  cur = depois; S.itens = depois; render();
  if (!sb) return gravar(KEY, depois);
  const mA = new Map(antes.map(i => [i.id, i])), mD = new Map(depois.map(i => [i.id, i]));
  depois.forEach(i => { if (mA.get(i.id) !== i) { pend.up[i.id] = i; delete pend.del[i.id]; } });
  antes.forEach(i => { if (!mD.has(i.id)) { pend.del[i.id] = 1; delete pend.up[i.id]; } });
  clearTimeout(syncT); syncT = setTimeout(flush, 350);
}
async function flush() {
  if (!sb) return;
  clearTimeout(syncT);
  const up = Object.values(pend.up), del = Object.keys(pend.del);
  pend = { up: {}, del: {} };
  try {
    if (up.length) {
      if (S.user) { const r = await sb.from('itens').upsert(up.map(d => ({ id: d.id, doc: d }))); if (r.error) throw r.error; }
      else for (const d of up) { const r = await sb.from('itens').update({ doc: d, atualizado: new Date().toISOString() }).eq('id', d.id); if (r.error) throw r.error; }
    }
    if (del.length) { const r = await sb.from('itens').delete().in('id', del); if (r.error) throw r.error; }
  } catch (e) { toast('Erro ao salvar: ' + (e.message || e)); }
}
const setItem = (id, patch) => upd(l => l.map(i => i.id === id ? { ...i, ...patch } : i));
const item = id => S.itens.find(i => i.id === id);
async function subirFoto(dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  const path = Date.now() + '-' + uid() + '.jpg';
  const r = await sb.storage.from('fotos').upload(path, blob, { contentType: 'image/jpeg' });
  if (r.error) { toast('Erro ao enviar foto: ' + r.error.message); return null; }
  return sb.storage.from('fotos').getPublicUrl(path).data.publicUrl;
}
async function lerFotos(files) {
  const out = [];
  for (const f of Array.from(files || [])) { if (!f.type.startsWith('image/')) continue; let d = await resize(f); if (d && sb) d = await subirFoto(d); if (d) out.push(d); }
  return out;
}
function copiar(txt, key) {
  const ok = () => { S.copiado = key; render(); clearTimeout(copyT); copyT = setTimeout(() => { S.copiado = null; render(); }, 1500); };
  const fallback = () => {
    const t = document.createElement('textarea');
    t.value = txt; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
    document.body.appendChild(t); t.select(); t.setSelectionRange(0, txt.length);
    let done = false; try { done = document.execCommand('copy'); } catch (e) {}
    t.remove(); if (done) ok(); else window.prompt('Copie:', txt);
  };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(ok, fallback); else fallback();
}
function baixarFotos(i) {
  const fotos = fotosDe(i); if (!fotos.length) return toast('Esse item não tem foto');
  const nome = idx => `${i.marca}_${i.ref}${fotos.length > 1 ? '_' + (idx + 1) : ''}.jpg`.replace(/[\\/:*?"<>|]/g, '_');
  fotos.forEach((src, idx) => {
    const a = document.createElement('a');
    if (src.startsWith('data:')) { a.href = src; a.download = nome(idx); document.body.appendChild(a); a.click(); a.remove(); return; }
    fetch(src).then(r => r.blob()).then(blob => { a.href = URL.createObjectURL(blob); a.download = nome(idx); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }).catch(() => window.open(src, '_blank', 'noopener'));
  });
  toast(fotos.length > 1 ? `Baixando ${fotos.length} fotos` : 'Baixando foto');
}

/* ============ regras de negócio (ações) ============ */
function enviarCodigo(id) {
  const i = item(id); if (!i) return;
  const cod = (D['cod:' + id] || '').trim().toUpperCase(), obs = (D['obs:' + id] || '').trim();
  if (!cod) return toast('Digite o código antes de enviar');
  setItem(id, { status: 'respondido', codigo: cod, obs, respondidoEm: Date.now(), visto: false });
  delete D['cod:' + id]; delete D['obs:' + id];
  if (!cur.some(x => x.status === 'pendente')) {
    const t = Date.now();
    if (sb) sb.from('fins').insert({ em: t }).then(() => {}); else { S.fim = [...S.fim, t].slice(-200); gravar(KEY_FIM, S.fim); }
  }
  toast(ehPF(i) ? 'Código enviado ✓ — ainda faltam as fotos' : 'Código enviado ✓');
}
function marcarEnviadoSite(i, v) {
  if (!v) return setItem(i.id, { enviadoSite: false });
  setItem(i.id, { enviadoSite: true });
  if (i.status === 'feito' || i.enviadoAtacado) return;
  confirmar(`${i.marca} ${i.ref} — também foi enviado ao site do Atacado?`,
    () => { setItem(i.id, { enviadoAtacado: true, status: 'feito', feitoEm: Date.now(), visto: true }); toast(`✅ ${i.marca} ${i.ref} já está nos dois sites`); },
    () => toast(`Lembrete criado: falta enviar ${i.marca} ${i.ref} ao Atacado`), 'Sim, nos dois');
}
function marcarEnviadoAtacado(i, v) {
  if (!v) return setItem(i.id, { enviadoAtacado: false });
  const patch = { enviadoSite: true, enviadoAtacado: true, visto: true };
  if (i.status !== 'feito') { patch.status = 'feito'; patch.feitoEm = Date.now(); }
  setItem(i.id, patch); toast(`✅ ${i.marca} ${i.ref} já está nos dois sites`);
}
const limparPendFoto = { motivoFoto: '', nota: '', notaPainel: '', fotosEnviadas: false, conferidoNaoRecebido: false };
function adicionar() {
  const marca = (D['n-marca'] || '').trim().toUpperCase(), ref = (D['n-ref'] || '').trim();
  if (!marca || !ref) return toast('Preencha marca e referência');
  const criar = () => {
    const valores = S.novosValores.map(v => v.trim()).filter(Boolean);
    upd(l => [...l, novoItem({ marca, ref, nota: (D['n-nota'] || '').trim(), motivoFoto: D['n-motivo'] || JA_TENHO, valores, fotos: S.novasFotos.slice(), status: 'rascunho', origem: 'avulso' })]);
    D['n-ref'] = ''; D['n-nota'] = ''; S.novosValores = ['']; S.novasFotos = [];
    toast('Adicionado ao rascunho'); render();
    setTimeout(() => { const r = document.querySelector('[data-k="n-ref"]'); if (r) r.focus(); }, 30);
  };
  const dup = S.itens.find(i => i.marca.toUpperCase() === marca && i.ref.toUpperCase() === ref.toUpperCase());
  if (dup) {
    const st = { pendente: 'está com o escritório', naosei: 'o escritório marcou "não sei"', respondido: 'já foi respondida', feito: 'já foi concluída', rascunho: 'está em rascunho' }[dup.status] || '';
    confirmar(`${marca} ${ref} já existe (${st}). Adicionar de novo assim mesmo?`, criar);
  } else criar();
}
function importar() {
  const parsed = parseLista(D['import'] || '');
  if (!parsed.length) return toast('Nenhuma referência encontrada no texto');
  const { aguard } = calc();
  const k = p => (normMarca(p.marca) + '|' + p.ref).toUpperCase();
  const ativos = new Set(aguard.map(k)), existentes = new Set(S.itens.map(k));
  const semDup = parsed.filter(p => !ativos.has(k(p)));
  const novos = semDup.filter(p => !existentes.has(k(p))).map(p => novoItem({ ...p, status: 'rascunho', origem: 'lista' }));
  const repetidos = semDup.filter(p => existentes.has(k(p)));
  upd(l => [...l, ...novos]);
  D['import'] = '';
  toast(`${novos.length} adicionados ao rascunho` + (parsed.length - novos.length ? ` · ${parsed.length - novos.length} já estavam na lista` : ''));
  if (repetidos.length) confirmar(`${repetidos.length} referência(s) já foram concluídas antes (estão no histórico). Adicionar de novo?`, () => {
    upd(l => [...l, ...repetidos.map(p => novoItem({ ...p, status: 'rascunho', origem: 'lista' }))]);
    toast(`${repetidos.length} repetida(s) adicionada(s)`);
  });
}

/* ============ impressão ============ */
function janela(titulo, corpo, css, imprimir) {
  const win = window.open('', '_blank');
  if (!win) return toast('Permita pop-ups para imprimir.');
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
body{font-family:Arial,Helvetica,sans-serif;color:#171717;max-width:980px;margin:28px auto;padding:0 18px}
h1{font-size:22px;margin:0 0 4px;letter-spacing:-.5px}.sub{color:#666;font-size:13px;margin-bottom:20px}
.pb{margin-bottom:16px;height:36px;padding:0 16px;border:0;border-radius:8px;background:#171717;color:#fff;font-size:13px;font-weight:700;cursor:pointer}
h2{font-size:15px;margin:22px 0 10px;display:flex;gap:8px;align-items:center}
h2 .n{background:#f3f3f3;border-radius:999px;font-size:12px;padding:2px 9px}
.mono{font-family:'Courier New',monospace;font-weight:700}
@media print{.pb{display:none}body{margin:0}}
${css || ''}</style></head><body><h1>${esc(titulo)}</h1>${corpo}</body></html>`);
  win.document.close(); win.focus();
  if (imprimir) setTimeout(() => win.print(), 400);
}
function listaFotosPendentes(motivo) {
  let l = S.itens.filter(i => i.status !== 'feito' && (i.nota || ehPF(i)));
  if (motivo) l = l.filter(i => i.motivoFoto === motivo);
  if (!l.length) return toast('Nenhuma referência com pendência de foto');
  const corpo = `<div class="sub">Gerado em ${esc(new Date().toLocaleString('pt-BR'))} · ${plural(l.length, 'referência')}</div><button class="pb" onclick="print()">Imprimir / Salvar PDF</button>` +
    porMarca(l).map(([m, it]) => `<h2>${esc(m)}<span class="n">${it.length}</span></h2>` + it.map(i => `<div class="row"><span class="mono">${esc(i.ref)}</span><span>${i.motivoFoto ? `<span class="tag">${esc(i.motivoFoto)}</span>` : ''}</span><span class="nt">${esc(i.nota || i.notaPainel || '')}</span></div>`).join('')).join('');
  janela('Referências aguardando fotos' + (motivo ? ' — ' + motivo : ''), corpo, `.row{display:grid;grid-template-columns:130px 230px 1fr;gap:14px;padding:8px 0;border-top:1px solid #eee;font-size:14px;align-items:center}.tag{background:#fdecee;color:#b10a14;border-radius:999px;font-size:12px;font-weight:700;padding:3px 10px}.nt{color:#666;font-size:13px}`);
}
function catalogoImpressao(lista, titulo) {
  if (!lista.length) return toast('Nenhuma referência para esse filtro.');
  const st = i => i.status === 'feito' ? 'No site' : ehPF(i) ? (i.codigo ? 'Código ok · faltam fotos' : 'Falta código e fotos') : i.codigo ? 'Código recebido' : 'Falta código';
  const corpo = `<div class="sub">Calçados 24h · ${esc(hora(Date.now()))} · ${plural(lista.length, 'referência')}</div><button class="pb" onclick="print()">Imprimir / Salvar PDF</button>` +
    porMarca(lista).map(([m, it]) => `<h2>${esc(m)}<span class="n">${it.length}</span></h2><div class="g">` + it.map(i => { const f = fotosDe(i)[0]; return `<div class="c"><div class="f">${f ? `<img src="${esc(f)}">` : 'sem foto'}</div><div class="i"><span class="mono">${esc(i.ref)}</span><span class="mono cod">${esc(i.codigo || '—')}</span><span class="st">${st(i)}</span></div></div>`; }).join('') + '</div>').join('');
  janela(titulo, corpo, `.g{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.c{border:1px solid #e5e5e5;border-radius:10px;overflow:hidden;break-inside:avoid}.f{aspect-ratio:1/1;background:#f5f5f5;display:flex;align-items:center;justify-content:center;font-size:11px;color:#999}.f img{width:100%;height:100%;object-fit:cover}.i{padding:8px 10px;display:flex;flex-direction:column;gap:3px;font-size:14px}.cod{color:#0d8a55}.st{font-size:11px;color:#666}`);
}
function relatorioFeitos(lista) {
  if (!lista.length) return toast('Nada no histórico para esse filtro.');
  const l = lista.slice().sort((a, b) => a.feitoEm - b.feitoEm);
  const corpo = `<div class="sub">Calçados 24h · gerado em ${esc(hora(Date.now()))} · ${plural(l.length, 'item', 'itens')}</div>` +
    porMarca(l).map(([m, it]) => `<h2>${esc(m)}<span class="n">${it.length}</span></h2><div class="g">` + it.map(i => { const f = fotosDe(i)[0]; return `<div class="c"><div class="f">${f ? `<img src="${esc(f)}">` : 'sem foto'}</div><div class="i"><span class="mono">${esc(i.ref)}</span><span class="mono cod">${esc(i.codigo)}</span></div></div>`; }).join('') + '</div>').join('');
  janela('Relatório de códigos preenchidos', corpo, `.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px}.c{border:1px solid #eee;border-radius:10px;overflow:hidden;break-inside:avoid}.f{aspect-ratio:1/1;background:#f5f5f5;display:flex;align-items:center;justify-content:center;font-size:11px;color:#999}.f img{width:100%;height:100%;object-fit:cover}.i{padding:8px 10px;display:flex;flex-direction:column;gap:3px;font-size:14px}`, true);
}

/* ============ peças de interface ============ */
const IC = {
  home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', inbox: '<path d="M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4"/>',
  archive: '<path d="M3 5h18v4H3zM5 9v10h14V9M10 13h4"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  check: '<path d="m5 12 5 5L20 7"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', pencil: '<path d="m4 20 1-5L16 4l4 4L9 19z"/>'
};
const ic = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IC[n]}</svg>`;
const val = (k, d = '') => esc(D[k] != null ? D[k] : d);
const thumbBtn = (i, cls = 'th') => { const f = fotosDe(i); return `<button class="${cls}" data-act="ver" data-id="${i.id}" title="Ver fotos">${f.length ? `<img src="${esc(f[0])}" alt="" loading="lazy">` : 'sem foto'}</button>`; };
const ph = i => { const f = fotosDe(i); return `<button class="oc-ph" data-act="ver" data-id="${i.id}">${f.length ? `<img src="${esc(f[0])}" alt="" loading="lazy">${f.length > 1 ? `<span class="nf">${f.length} fotos</span>` : ''}` : '<span class="ph-none">sem foto · confira pela referência</span>'}</button>`; };
const motivoSel = (i, field = 'motivoFoto', ph2 = 'Situação da foto') => `<select class="sel sm" data-field="${field}" data-id="${i.id}"><option value="">${ph2}</option>${MOTIVOS.map(m => `<option${i.motivoFoto === m ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select>`;
const codebox = (i, key) => `<button class="codebox${S.copiado === key ? ' copied' : ''}" data-act="copiar" data-txt="${esc(i.codigo)}" data-key="${key}" data-id="${i.id}" title="Copiar código"><b>${esc(i.codigo || '—')}</b><span>${S.copiado === key ? 'Copiado ✓' : 'Copiar'}</span></button>`;
const notasLoja = i => [i.nota && `<div class="note${ehPF(i) ? ' red' : ''}"><b>Obs. da loja:</b> ${esc(i.nota)}</div>`, i.notaPainel && `<div class="note${ehPF(i) ? ' red' : ''}"><b>Obs. da loja:</b> ${esc(i.notaPainel)}</div>`].filter(Boolean).join('');
const valoresTxt = i => { const v = (i.valores || []).filter(Boolean); return v.length ? `<span class="pill green">💲 ${esc(v.join(' · '))}</span>` : ''; };
const vazio = (t, s) => `<div class="box empty"><div class="ic">✓</div><b>${esc(t)}</b>${s ? `<span>${esc(s)}</span>` : ''}</div>`;
const marcaChips = (lista, q, base) => {
  const g = porMarca(lista); if (g.length < 2) return '';
  return `<div class="chips"><a class="chip${!q.m ? ' on' : ''}" href="#${base}">Todas <span class="cnt">${lista.length}</span></a>${g.map(([m, l]) => `<a class="chip${q.m === m ? ' on' : ''}" href="#${base}?m=${encodeURIComponent(m)}">${esc(m)} <span class="cnt">${l.length}</span></a>`).join('')}</div>`;
};
const filtraMarca = (l, q) => q.m ? l.filter(i => i.marca === q.m) : l;

/* ---------- topo ---------- */
function topo(C, modo) {
  const nOffice = C.oTotalRefs;
  const modes = FIXO ? '' : `<nav class="modes"><a href="#/escritorio" class="${modo === 'escritorio' ? 'on' : ''}">Escritório${nOffice ? ` <span class="dot-n">${nOffice}</span>` : ''}</a><a href="#/painel" class="${modo === 'painel' ? 'on' : ''}">Meu painel${S.user && C.nNovos ? ` <span class="dot-n" style="background:var(--blue)">${C.nNovos}</span>` : ''}</a></nav>`;
  return `<header class="top"><div class="top-in"><a class="brand" href="#/${modo === 'painel' ? 'painel' : 'escritorio'}"><img src="https://acdn-us.mitiendanube.com/stores/001/682/645/themes/common/logo-1707774246-1740764394-ec7e9dd0f42891352d1ab5c0a549e7871740764394-480-0.webp" alt="Calçados 24h"><span class="brand-sep"></span><span class="brand-name">Códigos das Fotos</span></a><span class="top-sp"></span>${modes}${S.user && modo === 'painel' ? '<button class="btn-sair" data-act="sair">Sair</button>' : ''}</div></header>`;
}

/* ============ ESCRITÓRIO ============ */
function escritorio(C, r) {
  const parts = r.path.split('/'), sub = parts[2] || '';
  const tab = (k, t, n, c) => `<a href="#/escritorio${k ? '/' + k : ''}" class="${(sub === k || (k === '' && sub === 'marca')) ? 'on' : ''}">${t}${n ? ` <span class="of-cnt ${c || ''}">${n}</span>` : ''}</a>`;
  const nav = `<nav class="of-nav"><div class="of-nav-in">${tab('', 'Marcas', C.oTotalRefs)}${tab('fotos', 'Faltam fotos', C.oFotos.length)}${tab('enviadas', 'Fotos enviadas', C.oConf.length, 'amber')}${tab('feitos', 'Já no site')}</div></nav>`;
  let body;
  if (sub === 'marca') body = escMarca(C, decodeURIComponent(parts.slice(3).join('/')));
  else if (sub === 'codigos') body = escCodigos(C, r.q);
  else if (sub === 'fotos') body = escFotos(C, r.q);
  else if (sub === 'enviadas') body = escEnviadas(C);
  else if (sub === 'feitos') body = escFeitos(C);
  else body = escHome(C);
  return `<div class="of">${nav}<main class="of-wrap">${body}</main></div>`;
}
const linkMarca = m => '#/escritorio/marca/' + encodeURIComponent(m);
function colagem(lista) {
  const fs = lista.map(i => fotosDe(i)[0]).filter(Boolean).slice(0, 4);
  if (!fs.length) return `<div class="bt-col n0"><span>sem fotos</span></div>`;
  return `<div class="bt-col n${fs.length}">${fs.map(f => `<img src="${esc(f)}" alt="" loading="lazy">`).join('')}</div>`;
}
function tileMarca(m, cod, fot) {
  const l = cod.length ? cod : fot, n = l.length;
  const refs = l.slice(0, 3).map(i => `<span>${esc(i.ref)}</span>`).join('') + (n > 3 ? `<span class="mais">+${n - 3}</span>` : '');
  const extra = cod.length && fot.length ? `<div class="bt-x">⚠ ${plural(fot.length, 'foto pendente', 'fotos pendentes')}</div>` : '';
  return `<a class="bt${cod.length ? '' : ' red'}" href="${linkMarca(m)}">${colagem(l)}<div class="bt-b">
    <div class="bt-h"><span class="bt-name">${esc(m)}</span><span class="bt-num">${n}</span></div>
    <div class="bt-t">${cod.length ? (n === 1 ? 'modelo esperando código' : 'modelos esperando código') : (n === 1 ? 'modelo sem foto' : 'modelos sem foto')}</div>
    <div class="bt-refs">${refs}</div>${extra}
    <span class="bt-go">Abrir marca <i>→</i></span></div></a>`;
}
function escHome(C) {
  const nCod = C.oCod.length, nFot = C.oFotos.length;
  const novos = C.oCod.filter(i => (i.criado || 0) > (S.vistoAte || 0));
  const data = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const partes = [nCod && `<em>${plural(nCod, 'código')}</em>`, nFot && `<em>${plural(nFot, 'foto', 'fotos')}</em>`].filter(Boolean);
  const titulo = partes.length ? `Faltam ${partes.join(' e ')} para a loja.` : 'Tudo em dia. <span class="ok">Nada pendente.</span>';
  const meta = [C.oConf.length && `<a href="#/escritorio/enviadas"><b>${C.oConf.length}</b> ${C.oConf.length === 1 ? 'foto enviada' : 'fotos enviadas'} aguardando a loja</a>`, `<span><b>${C.feitosHoje.length}</b> ${C.feitosHoje.length === 1 ? 'produto foi' : 'produtos foram'} para o site hoje</span>`].filter(Boolean).join('');
  const head = `<header class="of-head"><div class="of-date">${esc(data)}</div><h1 class="of-title">${titulo}</h1><div class="of-meta">${meta}</div>
    ${S.notifPerm === 'default' ? `<button class="of-notif" data-act="notif">🔔 Avisar neste aparelho quando chegar produto novo</button>` : ''}</header>`;
  const alerta = novos.length ? `<div class="of-new"><span class="of-pulse"></span><div><b>${novos.length === 1 ? 'Chegou 1 produto novo' : `Chegaram ${novos.length} produtos novos`}</b><span>${esc([...new Set(novos.map(i => i.marca))].join(' · '))}</span></div><a href="${linkMarca(novos[0].marca)}" data-act="visto">Ver agora</a><button data-act="visto" title="Dispensar">×</button></div>` : '';
  const gCod = porMarca(C.oCod);
  const secCod = gCod.length ? `<section class="of-sec"><div class="of-sec-h"><h2>Marcas esperando código</h2><span>Toque na marca para ver os modelos e digitar os códigos</span></div><div class="bt-grid">${gCod.map(([m, l]) => tileMarca(m, l, C.oFotos.filter(i => i.marca === m))).join('')}</div></section>` : '';
  const soFoto = porMarca(C.oFotos.filter(i => !C.oCod.some(c => c.marca === i.marca)));
  const secFot = soFoto.length ? `<section class="of-sec"><div class="of-sec-h"><h2>Marcas com fotos pendentes</h2><span>O código já foi, falta mandar as fotos</span></div><div class="bt-grid">${soFoto.map(([m, l]) => tileMarca(m, [], l)).join('')}</div></section>` : '';
  const vaz = !gCod.length && !soFoto.length ? `<div class="of-empty"><div class="of-empty-i">✓</div><b>Nenhuma marca esperando</b><span>Quando a loja cadastrar um produto novo, a marca aparece aqui.</span></div>` : '';
  const rec = C.feitos.slice(0, 10);
  const strip = rec.length ? `<section class="of-sec"><div class="of-sec-h"><h2>Já foram para o site</h2><a href="#/escritorio/feitos">Ver todos →</a></div><div class="of-strip">${rec.map(i => { const f = fotosDe(i)[0]; return `<button class="of-mini" data-act="ver" data-id="${i.id}"><span class="ph">${f ? `<img src="${esc(f)}" alt="" loading="lazy">` : ''}</span><b>${esc(i.ref)}</b><small>${esc(i.marca)}</small></button>`; }).join('')}</div></section>` : '';
  return head + alerta + secCod + secFot + vaz + strip;
}
function modelo(i, n, tipo) {
  const f = fotosDe(i), pf = ehPF(i);
  const obs = [i.nota, i.notaPainel].filter(Boolean);
  const temCod = i.status === 'respondido' && i.codigo;
  const fotosHtml = `<div class="mc-ph"><button class="mc-main" data-act="ver" data-id="${i.id}">${f.length ? `<img src="${esc(f[0])}" alt="" loading="lazy">` : '<span class="ph-none">sem foto<br>confira pela referência</span>'}${f.length > 1 ? `<span class="mc-nf">${f.length} fotos</span>` : ''}</button>${f.length > 1 ? `<div class="mc-thumbs">${f.slice(1, 5).map(s => `<button data-act="ver" data-id="${i.id}"><img src="${esc(s)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}</div>`;
  const codigoForm = `<div class="mc-code"><label>Código das fotos</label><div class="row2"><input class="in code big" data-draft="cod:${i.id}" data-k="cod:${i.id}" data-enter="enviar" data-id="${i.id}" data-upper value="${val('cod:' + i.id)}" placeholder="Digite o código" autocomplete="off" autocapitalize="characters" enterkeyhint="send"><button class="btn dark lg" data-act="enviar" data-id="${i.id}">Enviar</button></div>
    <input class="in sm" data-draft="obs:${i.id}" data-k="obs:${i.id}" data-enter="enviar" data-id="${i.id}" value="${val('obs:' + i.id)}" placeholder="Sua observação para a loja (opcional)"></div>`;
  let acoes;
  if (tipo === 'codigo') acoes = codigoForm + `<button class="lnk mute" data-act="naosei" data-id="${i.id}" style="align-self:flex-start">Não sei o código</button>`;
  else acoes = (temCod ? `<div class="code-ok"><span>✓ Código já enviado</span><b>${esc(i.codigo)}</b></div>` : i.status === 'pendente' ? '<div class="ri-sub">O código deste modelo está na lista de cima.</div>' : '') + `<button class="btn red lg" data-act="jaEnviei" data-id="${i.id}">${ic('check')} Já enviei as fotos</button>`;
  return `<article class="mc${tipo === 'foto' ? ' foto' : ''}">${fotosHtml}<div class="mc-b">
    <div class="mc-top"><span class="mc-idx">${String(n).padStart(2, '0')}</span><span>Fotos de ${esc(i.data)}</span>${valoresTxt(i)}</div>
    <div class="mc-ref">${esc(i.ref)}</div>
    ${pf ? `<div class="mc-flag">⚠ ${esc(i.motivoFoto)}</div>` : ''}
    ${i.conferidoNaoRecebido && tipo === 'foto' ? `<div class="mc-flag dark">A loja conferiu e ainda não recebeu as fotos. Envie de novo.</div>` : ''}
    ${obs.length ? `<div class="mc-obs"><span>Observação da loja</span>${obs.map(o => `<p>${esc(o)}</p>`).join('')}</div>` : ''}
    ${acoes}
  </div></article>`;
}
function escMarca(C, m) {
  const cod = C.oCod.filter(i => i.marca === m), fot = C.oFotos.filter(i => i.marca === m);
  const back = `<a class="of-back" href="#/escritorio">← Todas as marcas</a>`;
  const outras = porMarca(C.oCod).map(([x]) => x).filter(x => x !== m);
  if (!cod.length && !fot.length) return back + `<div class="of-empty"><div class="of-empty-i">✓</div><b>${esc(m)} concluída</b><span>Não falta mais nada desta marca.</span>${outras.length ? `<a class="btn dark lg" href="${linkMarca(outras[0])}">Próxima marca: ${esc(outras[0])} →</a>` : `<a class="btn lg" href="#/escritorio">Voltar ao início</a>`}</div>`;
  const resumo = [cod.length && plural(cod.length, 'modelo esperando código', 'modelos esperando código'), fot.length && plural(fot.length, 'modelo sem foto', 'modelos sem foto')].filter(Boolean).join(' · ');
  return back + `<header class="mk-head"><h1>${esc(m)}</h1><p>${resumo}</p></header>` +
    (cod.length ? `<section class="of-sec"><div class="of-sec-h"><h2>Esperando código</h2><span>Confira pela foto e digite o código de cada modelo</span></div><div class="mc-list">${cod.map((i, k) => modelo(i, k + 1, 'codigo')).join('')}</div></section>` : '') +
    (fot.length ? `<section class="of-sec"><div class="of-sec-h"><h2 class="red">Faltam fotos</h2><span>Mande as fotos para a loja e marque como enviado</span></div><div class="mc-list">${fot.map((i, k) => modelo(i, k + 1, 'foto')).join('')}</div></section>` : '') +
    (outras.length ? `<div class="mk-next"><span>Outras marcas esperando:</span>${outras.map(x => `<a href="${linkMarca(x)}">${esc(x)} <b>${C.oCod.filter(i => i.marca === x).length}</b></a>`).join('')}</div>` : '');
}
function cardCodigo(i) {
  const pf = ehPF(i);
  return `<article class="oc${pf ? ' alert' : ''}">${pf ? `<div class="oc-flag">⚠ Também falta foto · ${esc(i.motivoFoto)}</div>` : ''}${ph(i)}<div class="oc-b">
    <div><div class="oc-mk">${esc(i.marca)}</div><div class="oc-ref">${esc(i.ref)}</div></div>
    ${notasLoja(i)}${valoresTxt(i)}
    <div class="row2"><input class="in code big" data-draft="cod:${i.id}" data-k="cod:${i.id}" data-enter="enviar" data-id="${i.id}" data-upper value="${val('cod:' + i.id)}" placeholder="Código das fotos" autocomplete="off" autocapitalize="characters" enterkeyhint="send"><button class="btn dark lg" data-act="enviar" data-id="${i.id}">Enviar</button></div>
    <input class="in sm" data-draft="obs:${i.id}" data-k="obs:${i.id}" data-enter="enviar" data-id="${i.id}" value="${val('obs:' + i.id)}" placeholder="Observação (opcional)">
    <div class="oc-foot"><span class="ri-sub">Fotos de ${esc(i.data)}</span><button class="lnk mute" data-act="naosei" data-id="${i.id}">Não sei o código</button></div>
  </div></article>`;
}
function escCodigos(C, q) {
  const l = filtraMarca(C.oCod, q);
  const head = `<div class="ph"><div><h1>Falta o código</h1><p>Digite o código das fotos e toque em Enviar. Ele chega na hora para a loja.</p></div></div>`;
  if (!C.oCod.length) return head + vazio('Nenhum código pendente', 'Quando a loja cadastrar um produto novo, ele aparece aqui.');
  return head + marcaChips(C.oCod, q, '/escritorio/codigos') + porMarca(l).map(([m, it]) => `<section class="grp"><div class="grp-h">${esc(m)} <span class="cnt red">${it.length}</span><span class="ln"></span></div><div class="cards">${it.map(cardCodigo).join('')}</div></section>`).join('');
}
function cardFoto(i) {
  const temCod = i.status === 'respondido' && i.codigo;
  return `<article class="oc alert"><div class="oc-flag">⚠ ${esc(i.motivoFoto)}</div>${ph(i)}<div class="oc-b">
    <div><div class="oc-mk">${esc(i.marca)}</div><div class="oc-ref">${esc(i.ref)}</div></div>
    ${i.conferidoNaoRecebido ? `<div class="note red"><b>A loja conferiu e ainda não recebeu as fotos.</b> Envie de novo, por favor.</div>` : ''}
    ${notasLoja(i)}
    ${temCod ? `<div class="code-ok"><span>✓ Código já enviado</span><b>${esc(i.codigo)}</b></div>` : i.status === 'pendente' ? `<div class="row2"><input class="in code" data-draft="cod:${i.id}" data-k="cod:${i.id}" data-enter="enviar" data-id="${i.id}" data-upper value="${val('cod:' + i.id)}" placeholder="Código (também falta)" autocomplete="off"><button class="btn dark" data-act="enviar" data-id="${i.id}">Enviar</button></div>` : ''}
    <button class="btn red lg" data-act="jaEnviei" data-id="${i.id}">${ic('check')} Já enviei as fotos</button>
  </div></article>`;
}
function escFotos(C, q) {
  const head = `<header class="mk-head"><h1>Faltam fotos</h1><p>Mande as fotos para a loja e toque em <b>Já enviei as fotos</b>. A loja confirma quando receber.</p></header>`;
  if (!C.oFotos.length) return head + `<div class="of-empty"><div class="of-empty-i">✓</div><b>Nenhuma foto pendente</b></div>`;
  return head + porMarca(C.oFotos).map(([m, it]) => `<section class="of-sec"><div class="of-sec-h"><h2><a href="${linkMarca(m)}">${esc(m)}</a></h2><span>${plural(it.length, 'modelo')}</span></div><div class="mc-list">${it.map((i, k) => modelo(i, k + 1, 'foto')).join('')}</div></section>`).join('');
}
function escEnviadas(C) {
  const head = `<header class="mk-head"><h1>Fotos enviadas</h1><p>Você marcou que enviou. Falta a loja confirmar que recebeu.</p></header>`;
  if (!C.oConf.length) return head + vazio('Nada aguardando confirmação');
  return head + `<div class="list">${C.oConf.map(i => `<div class="ri nochk">${thumbBtn(i)}<div class="ri-b"><div class="ri-t"><span class="ri-ref">${esc(i.ref)}</span><span class="ri-mk">${esc(i.marca)}</span><span class="pill amber">Aguardando a loja</span></div><span class="ri-sub">${esc(i.motivoFoto)} · enviado em ${esc(hora(i.fotosEnviadasEm))}</span></div><div class="ri-a"><button class="lnk mute" data-act="desfazerEnvio" data-id="${i.id}">Desfazer</button></div></div>`).join('')}</div>`;
}
function escFeitos(C) {
  const head = `<header class="mk-head"><h1>Já no site</h1><p>Produtos que a loja já publicou com os seus códigos.</p></header>`;
  if (!C.feitos.length) return head + vazio('Nenhum produto concluído ainda');
  return head + `<div class="hist">${C.feitos.slice(0, 60).map(i => `<div class="hc2">${ph(i)}<div class="hc2-b"><span class="oc-mk">${esc(i.marca)}</span><span class="ri-ref">${esc(i.ref)}</span><span class="pill green" style="width:fit-content">${esc(i.codigo)}</span><span class="ri-sub">${esc(hora(i.feitoEm))}</span></div></div>`).join('')}</div>`;
}

/* ============ LOGIN ============ */
function login() {
  return `<main class="login"><div class="box"><div><h1>Entrar no painel</h1><p>Acesso restrito. Use seu usuário e senha.</p></div>
    <label class="lbl">Usuário<input class="in" data-draft="l-u" data-k="l-u" data-enter="entrar" value="${val('l-u')}" autocomplete="username" autocapitalize="none" style="height:44px"></label>
    <label class="lbl">Senha<input class="in" type="password" data-draft="l-s" data-k="l-s" data-enter="entrar" value="${val('l-s')}" autocomplete="current-password" style="height:44px"></label>
    ${S.loginErro ? `<div class="err">${esc(S.loginErro)}</div>` : ''}
    <button class="btn dark lg" data-act="entrar" ${S.entrando ? 'disabled' : ''}>${S.entrando ? 'Entrando…' : 'Entrar'}</button>
    ${FIXO ? '' : '<a class="btn lg" href="#/escritorio">← Voltar para o escritório</a>'}
  </div></main>`;
}

/* ============ MEU PAINEL ============ */
function painel(C, r) {
  const sub = r.path.split('/')[2] || '';
  const L = (k, t, icn, n, cls, extra) => `<a href="#/painel${k ? '/' + k : ''}" class="${sub === k ? 'on' : ''}">${ic(icn)}${t}${extra || ''}${n != null ? `<span class="cnt ${n ? cls || '' : ''}">${n}</span>` : ''}</a>`;
  const side = `<aside class="side">
    <a href="#/painel/novo" class="side-cta">${ic('plus')} Cadastrar produto</a>
    ${L('', 'Visão geral', 'home')}
    <div class="side-h">Fluxo</div>
    ${L('esperando', 'Esperando código', 'clock', C.aguard.length)}
    ${L('recebidos', 'Códigos recebidos', 'inbox', C.receb.length, 'green', C.nNovos ? '<span class="nv"></span>' : '')}
    ${L('pendencias', 'Pendências de fotos', 'camera', C.fazer.length, 'red')}
    ${L('lembretes', 'Falta Atacado', 'bell', C.lembretes.length, 'amber')}
    <div class="side-h">Registro</div>
    ${L('historico', 'Histórico', 'archive', C.feitos.length)}
    ${L('acessos', 'Acessos', 'users', S.usuarios.length || null)}
  </aside>`;
  const views = { '': pVisao, novo: pNovo, esperando: pEsperando, recebidos: pRecebidos, pendencias: pPendencias, lembretes: pLembretes, historico: pHistorico, acessos: pAcessos };
  return `<div class="shell">${side}<main class="main">${(views[sub] || pVisao)(C, r.q)}</main></div>`;
}
function bannerRascunho(C) {
  if (!C.rasc.length) return '';
  return `<div class="banner amber"><div class="bx"><b>${plural(C.rasc.length, 'referência em rascunho', 'referências em rascunho')}</b><span>O escritório ainda não está vendo. Envie quando terminar de cadastrar.</span></div><button class="btn dark" data-act="enviarRascunho">Enviar para o escritório</button></div>`;
}
function pVisao(C) {
  const linkEsc = location.origin + location.pathname + '?modo=escritorio#/escritorio';
  const kpi = (href, n, t, s, cls, bd) => `<a class="kpi ${n ? cls : 'mutek'}" href="#/painel/${href}">${bd || ''}<span class="n">${n}</span><span class="t">${t}</span><span class="s">${s}</span></a>`;
  const conf = C.conferir.length ? `<div class="list"><div class="list-h">${ic('camera')} O escritório diz que enviou fotos — confira <span class="cnt amber">${C.conferir.length}</span></div>${C.conferir.map(i => `<div class="ri nochk">${thumbBtn(i)}<div class="ri-b"><div class="ri-t"><span class="ri-ref">${esc(i.ref)}</span><span class="ri-mk">${esc(i.marca)}</span></div><span class="ri-sub">${esc(i.motivoFoto)} · enviado ${esc(hora(i.fotosEnviadasEm))}</span></div><div class="ri-a"><div class="h"><button class="btn sm green" data-act="recebi" data-id="${i.id}">Recebi</button><button class="btn sm" data-act="naoRecebi" data-id="${i.id}">Não recebi</button></div></div></div>`).join('')}</div>` : '';
  const ult = C.receb.slice().sort((a, b) => (b.respondidoEm || 0) - (a.respondidoEm || 0)).slice(0, 5);
  const ultimos = ult.length ? `<div class="list"><div class="list-h">${ic('inbox')} Últimos códigos recebidos<span class="sp" style="flex:1"></span><a class="lnk" href="#/painel/recebidos">Ver todos</a></div>${ult.map(i => linhaRecebido(i, true)).join('')}</div>` : '';
  return `<div class="ph"><div><h1>Olá${S.user ? ', ' + esc(S.user.u) : ''}</h1><p>${esc(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }))}</p></div><div class="ph-act"><button class="btn" data-act="copiar" data-txt="${esc(linkEsc)}" data-key="linkesc">${S.copiado === 'linkesc' ? 'Link copiado ✓' : 'Copiar link do escritório'}</button></div></div>
  ${bannerRascunho(C)}
  <div class="kpis">
    ${kpi('recebidos', C.receb.length, 'Códigos recebidos', C.nNovos ? `${C.nNovos} ${C.nNovos === 1 ? 'novo' : 'novos'} para conferir` : 'Prontos para subir no site', 'green', C.nNovos ? `<span class="bd dot-n" style="background:var(--blue)">${C.nNovos}</span>` : '')}
    ${kpi('esperando', C.aguard.length, 'Esperando código', `${C.oCod.length} com o escritório`, '')}
    ${kpi('pendencias', C.fazer.length, 'Pendências de fotos', `${C.fazerResp.length} já ${C.fazerResp.length === 1 ? 'tem' : 'têm'} código`, 'red')}
    ${kpi('lembretes', C.lembretes.length, 'Falta Atacado', 'Já no site, falta o Atacado', 'amber')}
    ${kpi('historico?hoje=1', C.feitosHoje.length, 'Feitos hoje', `${C.feitos.length} no histórico`, '')}
  </div>
  ${conf}${ultimos}`;
}
function pNovo(C) {
  const parsed = parseLista(D['import'] || '');
  const marcas = [...new Set(S.itens.map(i => i.marca))].filter(m => m && m !== '—').sort();
  return `<div class="ph"><div><h1>Cadastrar produto</h1><p>Tudo fica em rascunho até você enviar para o escritório.</p></div></div>
  ${bannerRascunho(C)}
  <div class="two">
    <section class="box box-p form">
      <h3 style="margin:0;font-size:15px;font-weight:600">Novo produto</h3>
      <label class="drop${S.dropOver === 'novo' ? ' over' : ''}" data-drop="novo"><input type="file" accept="image/*" multiple data-upload="novo" hidden><b>+ Adicionar fotos</b><span>Clique ou arraste as fotos aqui</span></label>
      ${S.novasFotos.length ? `<div class="thumbs">${S.novasFotos.map((src, k) => `<div class="t"><img src="${esc(src)}" alt=""><button data-act="tirarFoto" data-idx="${k}" title="Remover">×</button></div>`).join('')}</div>` : ''}
      <div class="grid2">
        <label class="lbl">Marca<input class="in" list="marcas" data-draft="n-marca" data-k="n-marca" data-upper value="${val('n-marca')}" placeholder="Ex.: VIZZANO" autocomplete="off"></label>
        <label class="lbl">Referência<input class="in mono" data-draft="n-ref" data-k="n-ref" data-enter="adicionar" value="${val('n-ref')}" placeholder="Ex.: 6576.104" autocomplete="off"></label>
      </div>
      <datalist id="marcas">${marcas.map(m => `<option value="${esc(m)}">`).join('')}</datalist>
      <label class="lbl">Situação das fotos<select class="sel" data-draft="n-motivo" data-k="n-motivo">${MOTIVOS.map(m => `<option${(D['n-motivo'] || JA_TENHO) === m ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
      <div class="lbl">Valor no Bling${S.novosValores.map((v, k) => `<div class="row2"><input class="in" data-valor="${k}" data-k="valor:${k}" value="${esc(v)}" placeholder="Ex.: R$ 129,90">${S.novosValores.length > 1 ? `<button class="btn icon" data-act="tirarValor" data-idx="${k}" title="Remover">×</button>` : ''}</div>`).join('')}<button class="lnk" data-act="addValor" style="align-self:flex-start">+ adicionar outro valor</button></div>
      <label class="lbl">Observação para o escritório<input class="in" data-draft="n-nota" data-k="n-nota" value="${val('n-nota')}" placeholder="Opcional"></label>
      <button class="btn dark lg" data-act="adicionar">Adicionar à lista</button>
    </section>
    <section class="box box-p form">
      <h3 style="margin:0;font-size:15px;font-weight:600">Colar lista de texto</h3>
      <p class="ri-sub" style="margin:-6px 0 0">Formato: nome da marca numa linha e, embaixo, “referência — Falta código das fotos.”</p>
      <textarea class="ta mono" rows="14" data-draft="import" data-k="import" placeholder="Fotos iniciadas em 22/10/26&#10;VIZZANO&#10;6576.104 — Falta código das fotos.&#10;1206.1025 — Falta código das fotos. Observação: falta a cor preta.">${val('import')}</textarea>
      <div class="toolbar"><span class="ri-sub" id="import-info">${parsed.length ? plural(parsed.length, 'referência encontrada', 'referências encontradas') : 'Nenhuma referência ainda'}</span><span class="sp"></span><button class="btn dark" data-act="importar">Adicionar ao rascunho</button></div>
    </section>
  </div>`;
}
const STATUS_AG = { naosei: ['Escritório não sabe', 'amber'], rascunho: ['Rascunho', 'gray'], pendente: ['Com o escritório', 'blue'] };
function linhaEsperando(i) {
  const [st, sc] = STATUS_AG[i.status] || ['', 'gray'];
  const ed = S.edit === i.id;
  const sel = !!S.sel[i.id];
  const f = fotosDe(i);
  const th = f.length ? thumbBtn(i) : `<label class="th add${S.dropOver === 'item:' + i.id ? ' drop' : ''}" data-drop="item:${i.id}" title="Adicionar foto"><input type="file" accept="image/*" multiple data-upload="item:${i.id}" hidden>+<br>foto</label>`;
  const corpo = ed ? `<div class="edit-g">
      <input class="in sm" data-draft="e-marca" data-k="e-marca" data-upper value="${val('e-marca')}" placeholder="Marca">
      <input class="in sm mono" data-draft="e-ref" data-k="e-ref" value="${val('e-ref')}" placeholder="Referência">
      <input class="in sm" data-draft="e-valor" data-k="e-valor" value="${val('e-valor')}" placeholder="Valor no Bling">
      <select class="sel sm" data-draft="e-motivo" data-k="e-motivo"><option value="">Situação da foto</option>${MOTIVOS.map(m => `<option${D['e-motivo'] === m ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select>
    </div><div class="ri-t"><button class="btn sm dark" data-act="salvarEdit" data-id="${i.id}">Salvar</button><button class="btn sm" data-act="cancelarEdit">Cancelar</button></div>`
    : `<div class="ri-f">${motivoSel(i)}<input class="in sm" data-field="nota" data-id="${i.id}" data-k="nota:${i.id}" value="${esc(i.nota || '')}" placeholder="+ observação para o escritório"></div>`;
  return `<div class="ri${sel ? ' sel' : ''}"><label class="chk"><input type="checkbox" data-chk="sel" data-id="${i.id}"${sel ? ' checked' : ''}></label>${th}<div class="ri-b">
    <div class="ri-t"><span class="ri-ref">${esc(i.ref)}</span><span class="pill ${sc}">${st}</span>${valoresTxt(i)}${ed ? '' : `<button class="lnk" data-act="editar" data-id="${i.id}">editar</button>`}</div>
    ${i.status === 'naosei' && i.obs ? `<div class="note"><b>Escritório:</b> ${esc(i.obs)}</div>` : ''}
    ${corpo}</div>
    <div class="ri-a">${i.status === 'naosei' ? `<button class="btn sm" data-act="reenviar" data-id="${i.id}">Reenviar ao escritório</button>` : ''}${f.length ? `<label class="lnk" style="cursor:pointer"><input type="file" accept="image/*" multiple data-upload="item:${i.id}" hidden>+ foto</label>` : ''}<button class="lnk red" data-act="excluir" data-id="${i.id}">Excluir</button></div></div>`;
}
function pEsperando(C, q) {
  const fm = q.s || '';
  const l = fm ? C.aguard.filter(i => i.motivoFoto === fm) : C.aguard;
  const nSel = C.aguard.filter(i => S.sel[i.id]).length;
  const todos = C.aguard.length > 0 && nSel === C.aguard.length;
  const head = `<div class="ph"><div><h1>Esperando código</h1><p>Produtos com o escritório (ou em rascunho) aguardando o código das fotos.</p></div><div class="ph-act"><a class="btn dark" href="#/painel/novo">${ic('plus')} Cadastrar</a></div></div>`;
  if (!C.aguard.length) return head + bannerRascunho(C) + vazio('Nada esperando o escritório');
  return head + bannerRascunho(C) + `<div class="toolbar"><label class="chk"><input type="checkbox" data-chk="todos"${todos ? ' checked' : ''}> Selecionar todos</label>${nSel ? `<span class="ri-sub">${plural(nSel, 'selecionado')}</span><button class="btn sm red" data-act="apagarSel">Apagar selecionados</button>` : ''}<span class="sp"></span>
    <select class="sel sm" style="width:auto" data-nav="/painel/esperando" data-param="s"><option value="">Todas as situações</option>${MOTIVOS.map(m => `<option${fm === m ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select></div>` +
    porMarca(l).map(([m, it]) => { const all = it.every(i => S.sel[i.id]); return `<div class="list"><div class="list-h"><label class="chk"><input type="checkbox" data-chk="grupo" data-ids="${it.map(i => i.id).join(',')}"${all ? ' checked' : ''}></label>${esc(m)} <span class="cnt">${it.length}</span></div>${it.map(linhaEsperando).join('')}</div>`; }).join('');
}
function linhaRecebido(i, simples) {
  const key = 'r' + i.id, ec = S.editCod === i.id;
  const code = ec ? `<div class="h"><input class="in sm code" style="width:170px" data-draft="codedit" data-k="codedit" data-enter="salvarCod" data-id="${i.id}" data-upper value="${val('codedit')}"><button class="btn sm dark" data-act="salvarCod" data-id="${i.id}">OK</button></div>` : codebox(i, key);
  return `<div class="ri nochk${!i.visto ? ' novo' : ''}">${thumbBtn(i)}<div class="ri-b">
    <div class="ri-t"><span class="ri-ref">${esc(i.ref)}</span>${simples ? `<span class="ri-mk">${esc(i.marca)}</span>` : ''}${!i.visto ? '<span class="pill blue">novo</span>' : ''}${valoresTxt(i)}</div>
    <span class="ri-sub">Respondido ${esc(hora(i.respondidoEm))} · fotos de ${esc(i.data)}</span>
    ${i.obs ? `<div class="note"><b>Escritório:</b> ${esc(i.obs)}</div>` : ''}
    ${simples ? '' : `<div class="ri-f">${motivoSel(i)}<input class="in sm" data-field="notaPainel" data-id="${i.id}" data-k="np:${i.id}" value="${esc(i.notaPainel || '')}" placeholder="+ minha observação (aparece pro escritório)"></div>
    <div class="checks"><label class="chk"><input type="checkbox" data-chk="site" data-id="${i.id}"${i.enviadoSite ? ' checked' : ''}> Enviado ao site</label><label class="chk"><input type="checkbox" data-chk="atacado" data-id="${i.id}"${i.enviadoAtacado ? ' checked' : ''}> Enviado ao Atacado</label></div>`}
  </div><div class="ri-a"><div class="h">${code}${ec ? '' : `<button class="btn icon" data-act="editarCod" data-id="${i.id}" title="Corrigir código">${ic('pencil')}</button>`}</div>${simples ? '' : `<button class="btn dark" data-act="feito" data-id="${i.id}">${ic('check')} Feito</button>`}</div></div>`;
}
function pRecebidos(C, q) {
  const l = filtraMarca(C.receb, q);
  const head = `<div class="ph"><div><h1>Códigos recebidos</h1><p>Códigos que o escritório mandou. Suba no site e marque <b>Feito</b>.</p></div>${C.receb.length ? `<div class="ph-act"><button class="btn" data-act="copiarTodos">${S.copiado === 'todos' ? 'Copiado ✓' : 'Copiar todos'}</button><button class="btn dark" data-act="feitoTodos">Marcar todos como feito</button></div>` : ''}</div>`;
  if (!C.receb.length) return head + vazio('Nenhum código novo ainda', 'Quando o escritório responder, aparece aqui e você recebe um aviso.');
  return head + marcaChips(C.receb, q, '/painel/recebidos') + porMarca(l).map(([m, it]) => `<div class="list"><div class="list-h">${esc(m)} <span class="cnt">${it.length}</span></div>${it.sort((a, b) => (b.respondidoEm || 0) - (a.respondidoEm || 0)).map(i => linhaRecebido(i)).join('')}</div>`).join('');
}
function linhaPendencia(i) {
  const tag = i.status === 'rascunho' ? ['RASCUNHO', 'gray'] : !i.codigo ? ['FALTA CÓDIGO E FOTO', 'red'] : i.conferidoNaoRecebido ? ['NÃO RECEBIDO AINDA', 'dark'] : i.fotosEnviadas ? ['CONFERIR RECEBIMENTO', 'amber'] : ['CÓDIGO OK · FALTA FOTO', 'green'];
  const acao = i.fotosEnviadas ? `<div class="h"><button class="btn sm green" data-act="recebi" data-id="${i.id}">Recebi as fotos</button><button class="btn sm" data-act="naoRecebi" data-id="${i.id}">Não recebi</button></div>` : `<button class="btn sm" data-act="fotosRecebidas" data-id="${i.id}">${ic('check')} Fotos recebidas</button>`;
  return `<div class="ri nochk warn${!i.visto && i.status === 'respondido' ? ' novo' : ''}">${thumbBtn(i)}<div class="ri-b">
    <div class="ri-t"><span class="ri-ref">${esc(i.ref)}</span><span class="pill ${tag[1]}">${tag[0]}</span>${i.status === 'naosei' ? '<span class="pill amber">Escritório não sabe</span>' : ''}</div>
    ${i.fotosEnviadas ? `<span class="ri-sub">Escritório marcou como enviado em ${esc(hora(i.fotosEnviadasEm))}</span>` : ''}
    ${i.obs ? `<div class="note"><b>Escritório:</b> ${esc(i.obs)}</div>` : ''}
    <div class="ri-f">${motivoSel(i)}<input class="in sm" data-field="notaPainel" data-id="${i.id}" data-k="np:${i.id}" value="${esc(i.notaPainel || '')}" placeholder="+ minha observação (aparece pro escritório)"></div>
  </div><div class="ri-a">${i.codigo ? codebox(i, 'fz' + i.id) : ''}${acao}</div></div>`;
}
function pPendencias(C, q) {
  const f = q.f || '';
  const grupos = { '': C.fazer, sem: C.fazer.filter(i => !i.codigo), com: C.fazer.filter(i => i.codigo && !i.fotosEnviadas), conf: C.conferir };
  const l = filtraMarca(grupos[f] || C.fazer, q);
  const seg = [['', 'Todas'], ['sem', 'Falta código e foto'], ['com', 'Código ok, falta foto'], ['conf', 'Conferir recebimento']]
    .map(([k, t]) => `<a class="${f === k ? 'on' : ''}" href="#/painel/pendencias${k ? '?f=' + k : ''}">${t} <span class="cnt${k === 'conf' && grupos.conf.length ? ' amber' : ''}">${grupos[k].length}</span></a>`).join('');
  const head = `<div class="ph"><div><h1>Pendências de fotos</h1><p>Isto é o que o escritório vê em vermelho. Quando as fotos chegarem, marque <b>Fotos recebidas</b>.</p></div><div class="ph-act"><button class="btn" data-act="listaFotos">Lista para imprimir</button><button class="btn dark" data-act="relPendencias">Relatório com fotos</button></div></div>`;
  if (!C.fazer.length) return head + vazio('Nenhuma pendência de fotos');
  return head + `<div class="seg">${seg}</div>` + (l.length ? porMarca(l).map(([m, it]) => `<div class="list"><div class="list-h">${esc(m)} <span class="cnt red">${it.length}</span></div>${it.map(linhaPendencia).join('')}</div>`).join('') : vazio('Nada neste filtro'));
}
function pLembretes(C) {
  const head = `<div class="ph"><div><h1>Falta enviar ao Atacado</h1><p>Já estão no site, mas ainda não foram para o site do Atacado.</p></div></div>`;
  if (!C.lembretes.length) return head + vazio('Nenhum lembrete');
  return head + porMarca(C.lembretes).map(([m, it]) => `<div class="list"><div class="list-h">${esc(m)} <span class="cnt amber">${it.length}</span></div>${it.map(i => `<div class="ri nochk">${thumbBtn(i)}<div class="ri-b"><div class="ri-t"><span class="ri-ref">${esc(i.ref)}</span><span class="pill amber">⚠ Falta o Atacado</span></div><span class="ri-sub">${esc(i.motivoFoto && i.motivoFoto !== JA_TENHO ? i.motivoFoto : 'Fotos de ' + i.data)}</span></div><div class="ri-a"><div class="h">${codebox(i, 'lb' + i.id)}<button class="btn green" data-act="atacado" data-id="${i.id}">Enviado ao Atacado</button></div></div></div>`).join('')}</div>`).join('');
}
function pHistorico(C, q) {
  const busca = (q.b || '').trim().toUpperCase(), fm = q.m || '', soHoje = q.hoje === '1';
  const base = soHoje ? C.feitosHoje : C.feitos;
  const full = base.filter(i => (!busca || i.ref.toUpperCase().includes(busca) || i.marca.toUpperCase().includes(busca) || (i.codigo || '').toUpperCase().includes(busca)) && (!fm || normMarca(i.marca) === fm));
  const pag = full.slice(0, S.catPagina);
  const marcas = [...new Set(base.map(i => normMarca(i.marca)))].sort();
  const lnk = p => '#/painel/historico?' + new URLSearchParams(Object.entries({ b: q.b || '', m: fm, hoje: soHoje ? '1' : '', ...p }).filter(([, v]) => v)).toString();
  const head = `<div class="ph"><div><h1>Histórico</h1><p>${plural(C.feitos.length, 'produto concluído', 'produtos concluídos')} · ${C.feitosHoje.length} hoje</p></div><div class="ph-act"><button class="btn" data-act="relFeitos">Imprimir relatório</button><button class="btn dark" data-act="catFeitos">Catálogo com fotos</button></div></div>`;
  const bar = `<div class="toolbar"><div class="seg"><a class="${!soHoje ? 'on' : ''}" href="${lnk({ hoje: '' })}">Tudo <span class="cnt">${C.feitos.length}</span></a><a class="${soHoje ? 'on' : ''}" href="${lnk({ hoje: '1' })}">Feitos hoje <span class="cnt">${C.feitosHoje.length}</span></a></div>
    <input class="in sm" style="flex:1 1 220px;width:auto" data-draft="busca" data-k="busca" data-enter="buscar" value="${val('busca', q.b || '')}" placeholder="Buscar por referência, marca ou código (Enter)">
    <select class="sel sm" style="width:auto" data-nav="/painel/historico" data-param="m" data-keep="b,hoje"><option value="">Todas as marcas</option>${marcas.map(m => `<option${fm === m ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select></div>`;
  if (!C.feitos.length) return head + vazio('O histórico aparece aqui', 'Conforme você marca os produtos como feitos.');
  return head + bar + `<span class="ri-sub">${plural(full.length, 'resultado')}</span>` + (pag.length ? `<div class="hist">${pag.map(i => { const k = 'cat' + i.id; return `<div class="hc2">${ph(i)}<div class="hc2-b"><span class="oc-mk">${esc(i.marca)}</span><span class="ri-ref">${esc(i.ref)}</span><button class="hc2-cb${S.copiado === k ? ' copied' : ''}" data-act="copiar" data-txt="${esc(i.codigo)}" data-key="${k}">${S.copiado === k ? 'Copiado ✓' : esc(i.codigo)}</button><span class="ri-sub">${esc(hora(i.feitoEm))}</span>
      <div class="checks"><label class="chk"><input type="checkbox" data-chk="site" data-id="${i.id}"${i.enviadoSite ? ' checked' : ''}> Site</label><label class="chk"><input type="checkbox" data-chk="atacado" data-id="${i.id}"${i.enviadoAtacado ? ' checked' : ''}> Atacado</label></div>
      <div class="hc2-l"><button class="lnk" data-act="baixar" data-id="${i.id}">baixar</button><button class="lnk" data-act="restaurar" data-id="${i.id}">restaurar</button><button class="lnk red" data-act="excluir" data-id="${i.id}">apagar</button></div></div></div>`; }).join('')}</div>` : vazio('Nada encontrado')) +
    (full.length > pag.length ? `<button class="btn" style="align-self:center" data-act="maisCat">Carregar mais (${full.length - pag.length})</button>` : '');
}
function pAcessos() {
  return `<div class="ph"><div><h1>Acessos</h1><p>Quem pode entrar no Meu painel. O escritório não precisa de senha.</p></div><span class="conn"><i style="background:${sb ? 'var(--green)' : 'var(--amber)'}"></i>${sb ? 'Online · dados salvos no Supabase' : 'Modo local · dados só neste navegador'}</span></div>
  <div class="two"><div class="list"><div class="list-h">${ic('users')} Usuários <span class="cnt">${S.usuarios.length}</span></div>${S.usuarios.map(x => `<div class="ri nochk" style="grid-template-columns:36px minmax(0,1fr) auto;align-items:center"><span class="th" style="width:36px;height:36px;border-radius:50%;font-family:var(--font);font-weight:600;font-size:13px;color:var(--ink);cursor:default">${esc(x.u.slice(0, 2).toUpperCase())}</span><div class="ri-t"><b>${esc(x.u)}</b>${S.user && x.u === S.user.u ? '<span class="pill gray">você</span>' : ''}</div><div>${S.user && x.u === S.user.u ? '' : `<button class="lnk red" data-act="removerUser" data-u="${esc(x.u)}">Remover</button>`}</div></div>`).join('') || '<div class="empty">Nenhum usuário</div>'}</div>
  <div class="box box-p form"><h3 style="margin:0;font-size:15px;font-weight:600">Novo acesso</h3>
    <label class="lbl">Usuário<input class="in" data-draft="nu" data-k="nu" value="${val('nu')}" autocapitalize="none" autocomplete="off" placeholder="mínimo 3 letras, sem espaço"></label>
    <label class="lbl">Senha<input class="in" type="password" data-draft="ns" data-k="ns" value="${val('ns')}" autocomplete="new-password" placeholder="mínimo 6 caracteres"></label>
    <button class="btn dark" data-act="criarUser" ${S.criando ? 'disabled' : ''}>${S.criando ? 'Criando…' : 'Criar acesso'}</button></div></div>`;
}

/* ---------- camadas ---------- */
function modalHtml() {
  const i = S.modal && item(S.modal); if (!i) return '';
  const f = fotosDe(i), idx = Math.min(S.modalIdx, Math.max(0, f.length - 1)), k = 'm' + i.id;
  return `<div class="ov" data-act="fecharModal"><div class="lb" data-stop>
    <div class="lb-ph">${f.length ? `<div class="lb-main${S.zoom ? ' z' : ''}" data-act="zoom"><img src="${esc(f[idx])}" alt=""></div>${f.length > 1 ? `<div class="lb-strip">${f.map((s, n) => `<button class="${n === idx ? 'on' : ''}" data-act="fotoIdx" data-idx="${n}"><img src="${esc(s)}" alt=""></button>`).join('')}</div>` : ''}` : '<div class="lb-main"><span class="ph-none" style="padding:80px">sem foto</span></div>'}</div>
    <div class="lb-i"><button class="lb-x" data-act="fecharModal">×</button><div><div class="oc-mk">${esc(i.marca)}</div><div class="oc-ref">${esc(i.ref)}</div></div>
      ${i.codigo ? `<button class="codebox${S.copiado === k ? ' copied' : ''}" style="height:56px" data-act="copiar" data-txt="${esc(i.codigo)}" data-key="${k}"><b style="font-size:18px">${esc(i.codigo)}</b><span>${S.copiado === k ? 'Copiado ✓' : 'Copiar código'}</span></button>` : ''}
      ${ehPF(i) ? `<div class="note red"><b>Situação:</b> ${esc(i.motivoFoto)}</div>` : ''}${notasLoja(i)}${i.obs ? `<div class="note"><b>Escritório:</b> ${esc(i.obs)}</div>` : ''}
      <span class="ri-sub">Fotos de ${esc(i.data)}${f.length ? ' · ' + plural(f.length, 'foto') : ''}</span>
      ${S.user && f.length ? `<button class="btn" data-act="baixar" data-id="${i.id}">Baixar fotos</button>` : ''}
    </div></div></div>`;
}
function confirmHtml() {
  if (!S.confirm) return '';
  return `<div class="ov"><div class="dlg" role="dialog"><p>${esc(S.confirm.msg)}</p><div class="acts"><button class="btn" data-act="confNao">${S.confirm.nao ? 'Não' : 'Cancelar'}</button><button class="btn dark" data-act="confSim">${esc(S.confirm.simTxt || 'Sim')}</button></div></div></div>`;
}

/* ============ render ============ */
let raf = 0;
function render() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; desenhar(); }); }
function desenhar() {
  const app = document.getElementById('app');
  const a = document.activeElement, fk = a && a.dataset && a.dataset.k, s0 = a && a.selectionStart, s1 = a && a.selectionEnd;
  const sy = window.scrollY;
  const C = calc(), r = rota();
  let html;
  if (!S.pronto) html = topo(C, 'escritorio') + '<div class="loading">Carregando…</div>';
  else {
    let modo = r.path.startsWith('/painel') || r.path === '/login' ? 'painel' : 'escritorio';
    if (FIXO === 'escritorio' && modo === 'painel') { location.replace('#/escritorio'); return; }
    if (FIXO === 'painel' && modo === 'escritorio') { location.replace('#/painel'); return; }
    let main;
    if (r.path === '/login') { if (S.user) { location.replace('#' + (r.q.next || '/painel')); return; } main = login(); }
    else if (modo === 'painel') { if (!S.user) { location.replace('#/login?next=' + encodeURIComponent(r.path)); return; } main = painel(C, r); }
    else main = escritorio(C, r);
    html = (S.online ? '' : '<div class="offline">Sem internet — as alterações serão enviadas quando a conexão voltar</div>') + topo(C, modo) + main;
  }
  html += modalHtml() + confirmHtml() + (S.toast ? `<div class="toast">${esc(S.toast)}</div>` : '');
  app.innerHTML = html;
  if (fk) { const el = app.querySelector(`[data-k="${CSS.escape(fk)}"]`); if (el) { el.focus({ preventScroll: true }); try { if (s0 != null) el.setSelectionRange(s0, s1); } catch (e) {} } }
  if (window.scrollY !== sy) window.scrollTo(0, sy);
  // título e selo do app
  const n = C.oTotalRefs;
  if (modoAtual() === 'escritorio') { document.title = n ? `(${n}) Códigos das Fotos` : 'Códigos das Fotos'; try { if (navigator.setAppBadge) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); } catch (e) {} }
  else document.title = (C.nNovos ? `(${C.nNovos}) ` : '') + 'Meu painel · Códigos das Fotos';
}

/* ============ eventos ============ */
const ACT = {
  sair: () => sair(),
  entrar: () => entrar(),
  visto: () => { S.vistoAte = Date.now(); gravar(KEY_VISTO, S.vistoAte); render(); },
  notif: () => { try { Notification.requestPermission().then(p => { S.notifPerm = p; render(); if (p === 'granted') notificar('Avisos ativados. Você será avisado quando chegar produto novo.'); }); } catch (e) {} },
  enviar: el => enviarCodigo(el.dataset.id),
  naosei: el => { const i = item(el.dataset.id); confirmar(`Marcar ${i.marca} ${i.ref} como “não sei o código”? Volta para a loja.`, () => { setItem(i.id, { status: 'naosei', obs: (D['obs:' + i.id] || '').trim(), respondidoEm: Date.now() }); toast('Marcado como “não sei”'); }); },
  jaEnviei: el => { setItem(el.dataset.id, { fotosEnviadas: true, fotosEnviadasEm: Date.now(), conferidoNaoRecebido: false, visto: false }); toast('Marcado como enviado — aguardando a loja confirmar'); },
  desfazerEnvio: el => setItem(el.dataset.id, { fotosEnviadas: false }),
  ver: el => { S.modal = el.dataset.id; S.modalIdx = 0; S.zoom = false; const i = item(el.dataset.id); if (S.user && i && !i.visto && i.status === 'respondido') setItem(i.id, { visto: true }); render(); },
  fecharModal: () => { S.modal = null; S.zoom = false; render(); },
  zoom: () => { S.zoom = !S.zoom; render(); },
  fotoIdx: el => { S.modalIdx = +el.dataset.idx; S.zoom = false; render(); },
  confSim: () => { const c = S.confirm; S.confirm = null; render(); if (c && c.sim) c.sim(); },
  confNao: () => { const c = S.confirm; S.confirm = null; render(); if (c && c.nao) c.nao(); },
  copiar: el => { copiar(el.dataset.txt || '', el.dataset.key); const i = el.dataset.id && item(el.dataset.id); if (i && !i.visto && S.user) setItem(i.id, { visto: true }); },
  adicionar: () => adicionar(),
  importar: () => importar(),
  addValor: () => { S.novosValores.push(''); render(); },
  tirarValor: el => { S.novosValores.splice(+el.dataset.idx, 1); render(); },
  tirarFoto: el => { S.novasFotos.splice(+el.dataset.idx, 1); render(); },
  enviarRascunho: () => { const n = calc().rasc.length; upd(l => l.map(i => i.status === 'rascunho' ? { ...i, status: 'pendente', criado: Date.now() } : i)); toast(n === 1 ? '1 referência enviada para o escritório' : `${n} referências enviadas para o escritório`); },
  editar: el => { const i = item(el.dataset.id); S.edit = i.id; D['e-marca'] = i.marca; D['e-ref'] = i.ref; D['e-valor'] = (i.valores || [])[0] || ''; D['e-motivo'] = i.motivoFoto || ''; render(); },
  cancelarEdit: () => { S.edit = null; render(); },
  salvarEdit: el => { const nm = (D['e-marca'] || '').trim().toUpperCase(), nr = (D['e-ref'] || '').trim(), nv = (D['e-valor'] || '').trim(); if (!nm || !nr) return toast('Preencha marca e referência'); S.edit = null; setItem(el.dataset.id, { marca: normMarca(nm), ref: nr, valores: nv ? [nv] : [], motivoFoto: D['e-motivo'] || '' }); toast('Alterações salvas'); },
  reenviar: el => { setItem(el.dataset.id, { status: 'pendente', obs: '', criado: Date.now() }); toast('Reenviado ao escritório'); },
  excluir: el => { const i = item(el.dataset.id); confirmar(`Apagar ${i.marca} ${i.ref}?${i.status === 'feito' ? ' Sai do histórico.' : ''}`, () => { upd(x => x.filter(y => y.id !== i.id)); toast('Apagado'); }, null, 'Apagar'); },
  apagarSel: () => { const ids = Object.keys(S.sel).filter(k => S.sel[k] && item(k)); confirmar(`Apagar ${plural(ids.length, 'referência')}?`, () => { const set = new Set(ids); upd(l => l.filter(i => !set.has(i.id))); S.sel = {}; toast(`${plural(ids.length, 'referência apagada', 'referências apagadas')}`); }, null, 'Apagar'); },
  editarCod: el => { S.editCod = el.dataset.id; D['codedit'] = item(el.dataset.id).codigo; render(); setTimeout(() => { const e = document.querySelector('[data-k="codedit"]'); if (e) e.focus(); }, 30); },
  salvarCod: el => { const v = (D['codedit'] || '').trim().toUpperCase(); S.editCod = null; if (v) { setItem(el.dataset.id, { codigo: v }); toast('Código corrigido'); } else render(); },
  feito: el => { const i = item(el.dataset.id); confirmar(`Marcar ${i.marca} ${i.ref} como feito? Vai para o histórico.`, () => { setItem(i.id, { status: 'feito', feitoEm: Date.now(), visto: true }); toast(`✅ ${i.marca} ${i.ref} já está no site`); }); },
  copiarTodos: () => { const { receb } = calc(); copiar(porMarca(receb).map(([m, l]) => m + '\n' + l.map(i => `${i.ref} — ${i.codigo}${i.obs ? ' (' + i.obs + ')' : ''}`).join('\n')).join('\n\n'), 'todos'); const ids = new Set(receb.map(i => i.id)); upd(l => l.map(i => ids.has(i.id) && !i.visto ? { ...i, visto: true } : i)); },
  feitoTodos: () => { const { receb } = calc(); confirmar(`Marcar os ${receb.length} códigos recebidos como feitos?`, () => { const ids = new Set(receb.map(i => i.id)), t = Date.now(); upd(l => l.map(i => ids.has(i.id) ? { ...i, status: 'feito', feitoEm: t, visto: true } : i)); toast(`✅ ${plural(receb.length, 'produto')} no histórico`); }); },
  atacado: el => marcarEnviadoAtacado(item(el.dataset.id), true),
  fotosRecebidas: el => { const i = item(el.dataset.id); confirmar(`Recebeu as fotos de ${i.marca} ${i.ref}? ${i.codigo ? 'Vai para Códigos recebidos.' : 'Volta para Esperando código.'}`, () => { setItem(i.id, limparPendFoto); toast(`${i.marca} ${i.ref} ${i.codigo ? 'foi para Códigos recebidos' : 'voltou para Esperando código'}`); }); },
  recebi: el => { setItem(el.dataset.id, limparPendFoto); toast('Fotos confirmadas ✓'); },
  naoRecebi: el => { setItem(el.dataset.id, { fotosEnviadas: false, conferidoNaoRecebido: true, conferidoEm: Date.now() }); toast('O escritório vai ver que as fotos não chegaram'); },
  listaFotos: () => listaFotosPendentes(),
  relPendencias: () => catalogoImpressao(calc().fazer, 'Pendências de fotos — foto, código e situação'),
  relFeitos: () => { const q = rota().q; const C = calc(); relatorioFeitos((q.hoje === '1' ? C.feitosHoje : C.feitos).filter(i => !q.m || normMarca(i.marca) === q.m)); },
  catFeitos: () => { const q = rota().q; const C = calc(); catalogoImpressao((q.hoje === '1' ? C.feitosHoje : C.feitos).filter(i => !q.m || normMarca(i.marca) === q.m), 'Catálogo de produtos concluídos'); },
  buscar: () => { const q = rota().q; const p = new URLSearchParams(Object.entries({ b: (D['busca'] || '').trim(), m: q.m || '', hoje: q.hoje || '' }).filter(([, v]) => v)); S.catPagina = 40; ir('#/painel/historico' + (p.toString() ? '?' + p : '')); },
  maisCat: () => { S.catPagina += 40; render(); },
  baixar: el => baixarFotos(item(el.dataset.id)),
  restaurar: el => { const i = item(el.dataset.id); confirmar(`Restaurar ${i.marca} ${i.ref} para Códigos recebidos? Sai do histórico.`, () => { setItem(i.id, { status: 'respondido', feitoEm: null, enviadoSite: false, enviadoAtacado: false, visto: false }); toast('Restaurado para Códigos recebidos'); }); },
  criarUser: () => criarUsuario(),
  removerUser: el => { const x = S.usuarios.find(y => y.u === el.dataset.u); if (x) confirmar(`Remover o acesso de ${x.u}?`, () => removerUsuario(x), null, 'Remover'); }
};

document.addEventListener('click', e => {
  const tr = e.target.closest('tr[data-href]'); if (tr) return ir(tr.dataset.href);
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (el.closest('[data-stop]') && el.dataset.act === 'fecharModal' && el.classList.contains('ov')) return;
  if (el.classList.contains('ov') && e.target !== el) return;  // clique dentro do modal não fecha
  if (el.tagName === 'A' && el.getAttribute('href')) { const f = ACT[el.dataset.act]; if (f) f(el, e); return; }
  e.preventDefault();
  const f = ACT[el.dataset.act]; if (f) f(el, e);
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.draft != null) {
    if (el.dataset.upper != null && el.value !== el.value.toUpperCase()) { const p = el.selectionStart; el.value = el.value.toUpperCase(); try { el.setSelectionRange(p, p); } catch (x) {} }
    D[el.dataset.draft] = el.value;
    if (el.dataset.draft === 'import') { const n = parseLista(el.value).length, t = document.getElementById('import-info'); if (t) t.textContent = n ? plural(n, 'referência encontrada', 'referências encontradas') : 'Nenhuma referência ainda'; }
  }
  if (el.dataset.valor != null) S.novosValores[+el.dataset.valor] = el.value;
});
document.addEventListener('change', async e => {
  const el = e.target, d = el.dataset;
  if (d.field && d.id) { const v = el.value; const i = item(d.id); if (i && (i[d.field] || '') !== v) setItem(d.id, { [d.field]: v }); return; }
  if (d.nav) {
    const q = rota().q, p = new URLSearchParams();
    (d.keep || '').split(',').filter(Boolean).forEach(k => q[k] && p.set(k, q[k]));
    if (d.nav === '/painel/esperando' && q.m) p.set('m', q.m);
    if (el.value) p.set(d.param, el.value);
    S.catPagina = 40;
    return ir('#' + d.nav + (p.toString() ? '?' + p : ''));
  }
  if (d.chk) {
    const v = el.checked;
    if (d.chk === 'sel') { if (v) S.sel[d.id] = true; else delete S.sel[d.id]; return render(); }
    if (d.chk === 'grupo') { d.ids.split(',').forEach(id => { if (v) S.sel[id] = true; else delete S.sel[id]; }); return render(); }
    if (d.chk === 'todos') { S.sel = {}; if (v) calc().aguard.forEach(i => { S.sel[i.id] = true; }); return render(); }
    if (d.chk === 'site') return marcarEnviadoSite(item(d.id), v);
    if (d.chk === 'atacado') return marcarEnviadoAtacado(item(d.id), v);
  }
  if (d.upload) {
    const files = el.files; if (!files || !files.length) return;
    toast('Enviando foto…');
    const f = await lerFotos(files); el.value = '';
    if (!f.length) return;
    if (d.upload === 'novo') { S.novasFotos.push(...f); render(); }
    else { const id = d.upload.slice(5); upd(x => x.map(y => y.id === id ? { ...y, fotos: [...(y.fotos || []), ...f] } : y)); }
    toast(f.length > 1 ? `${f.length} fotos adicionadas` : 'Foto adicionada');
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (S.confirm) return ACT.confNao(); if (S.modal) return ACT.fecharModal(); }
  if (e.key !== 'Enter') return;
  const el = e.target; if (!el.dataset || !el.dataset.enter) return;
  e.preventDefault();
  const f = ACT[el.dataset.enter]; if (f) f(el, e);
});
// arrastar fotos
document.addEventListener('dragover', e => { e.preventDefault(); const z = e.target.closest && e.target.closest('[data-drop]'); const k = z ? z.dataset.drop : null; if (S.dropOver !== k) { S.dropOver = k; render(); } });
document.addEventListener('dragleave', e => { if (!e.relatedTarget && S.dropOver) { S.dropOver = null; render(); } });
document.addEventListener('drop', async e => {
  e.preventDefault();
  const z = e.target.closest && e.target.closest('[data-drop]'); S.dropOver = null; render();
  if (!z) return;
  const fs = Array.from(e.dataTransfer.files || []).filter(x => x.type.startsWith('image/'));
  if (!fs.length) return toast('Arraste um arquivo de imagem (jpg, png).');
  toast('Enviando foto…');
  const f = await lerFotos(fs); if (!f.length) return;
  if (z.dataset.drop === 'novo') { S.novasFotos.push(...f); render(); }
  else { const id = z.dataset.drop.slice(5); upd(x => x.map(y => y.id === id ? { ...y, fotos: [...(y.fotos || []), ...f] } : y)); }
  toast(f.length > 1 ? `${f.length} fotos adicionadas` : 'Foto adicionada');
});
window.addEventListener('hashchange', () => { S.modal = null; S.edit = null; S.editCod = null; if (!rota().path.startsWith('/painel/historico')) delete D['busca']; render(); window.scrollTo(0, 0); });
window.addEventListener('pagehide', () => flush());
window.addEventListener('online', () => { S.online = true; render(); });
window.addEventListener('offline', () => { S.online = false; render(); });
window.addEventListener('storage', e => {
  if (sb) return;
  if (e.key === KEY) aplicarRemoto(loadLocal());
  if (e.key === KEY_FIM) S.fim = ler(KEY_FIM, []);
  if (e.key === KEY_USERS) carregarUsuarios();
});

render();
init();
})();
