if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const CATEGORIES = [
  'Transport & véhicules','Bâtiment & réparation','Maison & entretien','Beauté & bien-être',
  'Couture & artisanat','Éducation & cours','Événements & cérémonies','Digital & technologie',
  'Agriculture & artisanat rural','Administratif & services pro','Autre'
];
const PACK_LABEL = { business:'Business', premium:'Premium', sponsor_cat:'Sponsorisé', sponsor_ville:'Sponsorisé', sponsor_max:'Sponsorisé max' };

let state = {
  token: localStorage.getItem('baara_token') || null,
  user: null,
  view: 'home',
  activeCategory: 'Tout',
  listings: [],
  ownListings: [],
  missions: [],
  authMode: 'login' // 'login' | 'signup'
};

// ---------- API wrapper ----------
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch('/api' + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur.');
  return data;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- Bootstrap ----------
async function boot() {
  if (state.token) {
    try {
      const { user } = await api('/auth/me');
      state.user = user;
    } catch (e) {
      state.token = null;
      localStorage.removeItem('baara_token');
    }
  }
  await loadListings();
  await loadMissions();
  if (state.user) await loadOwnListings();
  render();
}

async function loadListings() {
  const params = new URLSearchParams();
  if (state.activeCategory && state.activeCategory !== 'Tout') params.set('categorie', state.activeCategory);
  const q = document.getElementById('searchInput')?.value?.trim();
  if (q) params.set('q', q);
  const { listings } = await api('/listings?' + params.toString());
  state.listings = listings;
}

async function loadOwnListings() {
  const { listings } = await api('/listings/mine');
  state.ownListings = listings;
}

async function loadMissions() {
  const { missions } = await api('/missions');
  state.missions = missions;
}

// ---------- Render root ----------
function render() {
  const app = document.getElementById('app');
  if (!state.user) {
    app.innerHTML = renderAuth();
    return;
  }
  app.innerHTML = `
    ${renderHeader()}
    <div class="motif"></div>
    <main>${renderView()}</main>
    ${renderFab()}
    ${renderModals()}
  `;
  const search = document.getElementById('searchInput');
  if (search) search.addEventListener('input', async () => { await loadListings(); render(); });
}

function renderHeader() {
  const tabs = [
    { id: 'home', label: 'Prestataires' },
    { id: 'profiles', label: 'Mes profils' },
    { id: 'missions', label: 'Missions' },
    { id: 'boost', label: 'Booster' },
    { id: 'wallet', label: 'Mes crédits' }
  ];
  if (state.user.isAdmin) tabs.push({ id: 'admin', label: 'Admin' });

  return `
    <header>
      <div class="userbar">
        <span>👤 ${escapeHtml(state.user.nom)}${state.user.isAdmin ? ' <span class="admin-badge" style="margin-left:6px;">Admin</span>' : ''}</span>
        <a onclick="logout()">Déconnexion</a>
      </div>
      <div class="brand"><h1>Baara</h1><span>bêta</span></div>
      <p class="tag">Zéro commission — Baara se rémunère uniquement via la visibilité et la mise en relation.</p>
      <div class="tabnav">
        ${tabs.map(t => `<div class="tab ${t.id==='admin'?'admin-tab':''} ${state.view===t.id?'active':''}" onclick="switchView('${t.id}')">${t.label}</div>`).join('')}
      </div>
    </header>
  `;
}

function switchView(view) {
  state.view = view;
  render();
  if (view === 'admin') loadAdminData();
}

function renderFab() {
  if (state.view === 'home' || state.view === 'profiles') return `<button class="fab" onclick="openCreateListingModal()">+ Proposer mon service</button>`;
  if (state.view === 'missions') return `<button class="fab" onclick="openModal('createMission')">+ Publier une mission</button>`;
  return '';
}

// ---------- Auth view ----------
function renderAuth() {
  const isLogin = state.authMode === 'login';
  return `
    <header>
      <div class="brand"><h1>Baara</h1><span>bêta</span></div>
      <p class="tag">« Baara » veut dire travail en bambara. Trouve quelqu'un qui sait faire, ou fais-toi trouver.</p>
    </header>
    <div class="motif"></div>
    <main>
      <div class="auth-box">
        <h2 style="font-family:'Space Grotesk',sans-serif; margin-bottom:14px;">${isLogin ? 'Connexion' : 'Créer un compte'}</h2>
        <div id="authError" style="color:var(--terracotta); font-size:13px; margin-bottom:10px;"></div>
        ${!isLogin ? `<div class="field"><label>Nom complet</label><input id="a_nom" type="text" placeholder="Ex : Awa Traoré"></div>` : ''}
        <div class="field"><label>Numéro de téléphone</label><input id="a_tel" type="text" placeholder="Ex : +223 7X XX XX XX"></div>
        ${!isLogin ? `<div class="field"><label>Email (optionnel)</label><input id="a_email" type="email" placeholder="Ex : awa@email.com"></div>` : ''}
        <div class="field"><label>Mot de passe</label><input id="a_pass" type="password" placeholder="Au moins 6 caractères"></div>
        <button class="submit-btn" onclick="${isLogin ? 'doLogin()' : 'doSignup()'}">${isLogin ? 'Se connecter' : "S'inscrire"}</button>
        <div class="auth-switch">
          ${isLogin ? `Pas encore de compte ? <a onclick="state.authMode='signup'; render();">Inscris-toi</a>` : `Déjà un compte ? <a onclick="state.authMode='login'; render();">Connecte-toi</a>`}
        </div>
      </div>
    </main>
  `;
}

async function doSignup() {
  const nom = document.getElementById('a_nom').value.trim();
  const telephone = document.getElementById('a_tel').value.trim();
  const email = document.getElementById('a_email').value.trim();
  const password = document.getElementById('a_pass').value;
  try {
    const { token, user } = await api('/auth/signup', { method: 'POST', body: JSON.stringify({ nom, telephone, email, password }) });
    state.token = token; state.user = user;
    localStorage.setItem('baara_token', token);
    await loadListings(); await loadMissions(); await loadOwnListings();
    render();
    showToast('Bienvenue sur Baara !');
  } catch (e) { document.getElementById('authError').textContent = e.message; }
}

async function doLogin() {
  const telephone = document.getElementById('a_tel').value.trim();
  const password = document.getElementById('a_pass').value;
  try {
    const { token, user } = await api('/auth/login', { method: 'POST', body: JSON.stringify({ telephone, password }) });
    state.token = token; state.user = user;
    localStorage.setItem('baara_token', token);
    await loadListings(); await loadMissions(); await loadOwnListings();
    render();
    showToast('Connecté !');
  } catch (e) { document.getElementById('authError').textContent = e.message; }
}

function logout() {
  state.token = null; state.user = null;
  localStorage.removeItem('baara_token');
  render();
}

// ---------- Main views ----------
function renderView() {
  if (state.view === 'home') return renderHome();
  if (state.view === 'profiles') return renderMyProfiles();
  if (state.view === 'missions') return renderMissions();
  if (state.view === 'boost') return renderBoost();
  if (state.view === 'wallet') return renderWallet();
  if (state.view === 'admin') return renderAdmin();
  return '';
}

function renderHome() {
  return `
    <div class="search-box"><input id="searchInput" type="text" placeholder="Ex : plombier, cours de maths..." value="${escapeHtml(document.getElementById('searchInput')?.value||'')}"><button onclick="loadListings().then(render)">→</button></div>
    <div class="chips">${['Tout', ...CATEGORIES].map(c => `<div class="chip ${state.activeCategory===c?'active':''}" onclick="selectCategory('${c.replace(/'/g,"\\'")}')">${c}</div>`).join('')}</div>
    <div class="section-label">${state.listings.length} profil(s)</div>
    ${state.listings.length === 0 ? `<div class="empty">Aucun profil pour cette recherche.<br>Sois le premier à proposer ce service !</div>` : state.listings.map(renderListingCard).join('')}
  `;
}

async function selectCategory(c) { state.activeCategory = c; await loadListings(); render(); }

function renderListingCard(l) {
  const avg = l.reviewCount ? (l.ratingSum / l.reviewCount).toFixed(1) : null;
  const waNum = (l.telephone || '').replace(/\D/g, '');
  const pack = l.pack || 'standard';
  let badgeHtml = '';
  if (l.verified) badgeHtml += '<div class="badge badge-verifie">Vérifié</div>';
  if (pack === 'business') badgeHtml += '<div class="badge badge-business">Business</div>';
  else if (pack === 'premium') badgeHtml += '<div class="badge badge-premium">Premium</div>';
  else if (['sponsor_cat','sponsor_ville','sponsor_max'].includes(pack)) badgeHtml += `<div class="badge badge-sponsor">${PACK_LABEL[pack]}</div>`;

  let contactBtn;
  if (!l.contactLocked && waNum) {
    contactBtn = `<button class="btn-contact" onclick="window.open('https://wa.me/223${waNum}')">WhatsApp</button>`;
  } else {
    contactBtn = `<button class="btn-lock" onclick="unlockContact('${l.id}')">🔒 Débloquer le contact (1 crédit)</button>`;
  }

  return `
    <div class="card ${pack==='sponsor_max'?'is-sponsor-max':''}">
      <div class="card-top">
        <div><h3>${escapeHtml(l.nom)}</h3><div class="skill">${escapeHtml(l.competence)}</div></div>
        <div class="badges">${badgeHtml}</div>
      </div>
      <div class="card-meta">
        <span>📍 ${escapeHtml(l.quartier)}</span>
        ${l.tarif ? `<span>💰 ${escapeHtml(l.tarif)}</span>` : ''}
        <span>🔁 ${Math.max(0,(l.connexionsLimit||3)-(l.connexionsUsed||0))} connexions restantes</span>
      </div>
      ${l.description ? `<div class="card-desc">${escapeHtml(l.description)}</div>` : ''}
      <div class="card-rating">${avg ? `★ ${avg} (${l.reviewCount} avis)` : "Pas encore d'avis"}</div>
      <div class="card-actions">
        ${contactBtn}
        <button class="btn-review" onclick="openReviewModal('${l.id}','${escapeHtml(l.nom).replace(/'/g,"\\'")}')">Noter</button>
      </div>
    </div>
  `;
}

async function unlockContact(listingId) {
  try {
    await api(`/listings/${listingId}/unlock-contact`, { method: 'POST' });
    showToast('Contact débloqué !');
    await loadListings();
    render();
  } catch (e) {
    if (e.message.includes('crédits')) { showToast(e.message); switchView('wallet'); }
    else showToast(e.message);
  }
}

function renderMyProfiles() {
  return `
    <div class="section-label">${state.ownListings.length} profil(s) prestataire</div>
    ${state.ownListings.length === 0 ? `<div class="empty">Tu n'as pas encore de profil prestataire.<br>Clique sur "+ Proposer mon service" pour en créer un.</div>` : state.ownListings.map(renderOwnListingCard).join('')}
  `;
}

function renderOwnListingCard(l) {
  const avg = l.reviewCount ? (l.ratingSum / l.reviewCount).toFixed(1) : null;
  const pack = l.pack || 'standard';
  let badgeHtml = '';
  if (l.verified) badgeHtml += '<div class="badge badge-verifie">Vérifié</div>';
  if (pack !== 'standard') badgeHtml += `<div class="badge badge-premium">${PACK_LABEL[pack] || pack}</div>`;
  if (l.status === 'hidden') badgeHtml += '<div class="badge badge-sponsor">Masqué par l\'admin</div>';

  return `
    <div class="card">
      <div class="card-top">
        <div><h3>${escapeHtml(l.nom)}</h3><div class="skill">${escapeHtml(l.competence)}</div></div>
        <div class="badges">${badgeHtml}</div>
      </div>
      <div class="card-meta">
        <span>📍 ${escapeHtml(l.quartier)}</span>
        ${l.tarif ? `<span>💰 ${escapeHtml(l.tarif)}</span>` : ''}
        <span>🔁 ${Math.max(0,(l.connexionsLimit||3)-(l.connexionsUsed||0))} connexions restantes</span>
      </div>
      ${l.description ? `<div class="card-desc">${escapeHtml(l.description)}</div>` : ''}
      <div class="card-rating">${avg ? `★ ${avg} (${l.reviewCount} avis)` : "Pas encore d'avis"}</div>
      <div class="card-actions">
        <button class="btn-outline" onclick="openEditListingModal('${l.id}')">Modifier</button>
        <button class="btn-reject" onclick="confirmDeleteListing('${l.id}')">Supprimer</button>
      </div>
    </div>
  `;
}

function renderMissions() {
  return `
    <div class="section-label">Missions publiées par des clients</div>
    ${state.missions.length === 0 ? `<div class="empty">Aucune mission publiée pour le moment.</div>` :
      state.missions.map(m => `
        <div class="mission-card">
          <h3>${escapeHtml(m.titre)}</h3>
          <div class="mission-cat">${escapeHtml(m.categorie)}</div>
          <div class="mission-meta"><span>📍 ${escapeHtml(m.quartier)}</span>${m.budget?`<span>💰 ${escapeHtml(m.budget)}</span>`:''}</div>
          <div class="mission-desc">${escapeHtml(m.description)}</div>
          <div class="mission-props">${(m.proposals||[]).length} proposition(s) reçue(s)</div>
          ${(m.proposals||[]).map(p => `<div class="prop-item"><span class="prop-name">${escapeHtml(p.nom)}</span> — <span class="prop-price">${escapeHtml(p.prix)}</span><br>${escapeHtml(p.message)}</div>`).join('')}
          <div style="margin-top:12px;"><button class="btn-outline" onclick="openPropModal('${m.id}','${escapeHtml(m.titre).replace(/'/g,"\\'")}')">Envoyer une proposition</button></div>
        </div>
      `).join('')}
  `;
}

function renderBoost() {
  const packs = [
    { key:'business', label:'Business', old:'3 000', price:'2 000', features:['Numéro affiché directement, sans crédit client','Affichage prioritaire dans votre catégorie'] },
    { key:'premium', label:'Premium', old:'5 000', price:'3 500', popular:true, features:['Tout Business, plus badge Premium','Priorité supérieure dans les résultats','6 photos de portfolio'] },
    { key:'sponsor_cat', label:'Sponsorisé catégorie', old:'10 000', price:'7 500', features:['Premier de liste sur votre catégorie','Tout Premium inclus'] },
    { key:'sponsor_ville', label:'Sponsorisé ville', old:'10 000', price:'7 500', features:['Premier de liste sur votre ville','Tout Premium inclus'] },
    { key:'sponsor_max', label:'Sponsorisé max', old:'18 000', price:'14 000', features:['Priorité absolue partout',"Mise en avant page d'accueil"] }
  ];
  return `
    <div class="section-label">Nos packs de visibilité</div>
    <p class="boost-intro">Profil de base gratuit à vie. Ces packs boostent ta visibilité — validation manuelle sous 24h après paiement Mobile Money.</p>
    <div class="pack-card"><div class="pack-name">Standard</div><div class="pack-price"><span class="new">Gratuit</span></div>
      <ul class="pack-list"><li>Profil visible dans les résultats classiques</li><li>Numéro caché — le client doit débloquer</li></ul></div>
    ${packs.map(p => `
      <div class="pack-card ${p.popular?'popular':''}">
        <div class="pack-name">${p.label}</div>
        <div class="pack-price"><span class="old">${p.old} FCFA</span><span class="new">${p.price} FCFA</span><span class="per">/mois</span></div>
        <ul class="pack-list">${p.features.map(f=>`<li>${f}</li>`).join('')}</ul>
        <button class="btn-pack" onclick="openBoostModal('${p.key}','${p.label}',${p.price.replace(/\s/g,'')})">Choisir</button>
      </div>
    `).join('')}
    <div class="payflow"><strong>Comment payer ?</strong><br>Envoie le montant via Orange Money/Wave, renseigne ta référence de transaction, un admin valide sous 24h.</div>
  `;
}

function renderWallet() {
  const unlockedIds = state.user.unlockedContacts || [];
  const unlockedListings = state.listings.filter(l => unlockedIds.includes(l.id));
  return `
    <div class="section-label">Mon portefeuille</div>
    <div class="wallet-card">
      <div class="wallet-row"><span>🔓 Crédits contact</span><strong>${state.user.creditsContact||0}</strong></div>
      <div class="wallet-row"><span>💬 Crédits message</span><strong>${state.user.creditsMessage||0}</strong></div>
    </div>
    <div class="section-label">Acheter des crédits contact</div>
    <div class="mini-pack-row">
      <div class="mini-pack" onclick="openCreditRequestModal('contact',1,500)"><div class="qty">1</div><div class="price">500 FCFA</div></div>
      <div class="mini-pack" onclick="openCreditRequestModal('contact',5,2000)"><div class="qty">5</div><div class="price">2 000 FCFA</div></div>
      <div class="mini-pack" onclick="openCreditRequestModal('contact',20,6000)"><div class="qty">20</div><div class="price">6 000 FCFA</div></div>
    </div>
    <div class="section-label">Acheter des crédits message</div>
    <div class="mini-pack-row">
      <div class="mini-pack" onclick="openCreditRequestModal('message',10,500)"><div class="qty">10</div><div class="price">500 FCFA</div></div>
      <div class="mini-pack" onclick="openCreditRequestModal('message',50,2000)"><div class="qty">50</div><div class="price">2 000 FCFA</div></div>
    </div>
    <div class="section-label">Contacts débloqués</div>
    ${unlockedListings.length ? unlockedListings.map(l => `<div class="card" style="padding:12px;"><strong>${escapeHtml(l.nom)}</strong> — ${escapeHtml(l.competence)}</div>`).join('') : `<div class="empty">Aucun contact débloqué.</div>`}
  `;
}

// ---------- Admin ----------
let adminData = { stats:null, pendingListings:[], packRequests:[], creditRequests:[], flaggedReviews:[] };

async function loadAdminData() {
  const [stats, pv, pr, cr, fr] = await Promise.all([
    api('/admin/stats'),
    api('/admin/listings/pending-verification'),
    api('/admin/pack-requests'),
    api('/admin/credit-requests'),
    api('/admin/reviews/flagged')
  ]);
  adminData.stats = stats;
  adminData.pendingListings = pv.listings;
  adminData.packRequests = pr.requests.filter(r => r.status === 'pending');
  adminData.creditRequests = cr.requests.filter(r => r.status === 'pending');
  adminData.flaggedReviews = fr.reviews;
  render();
}

function renderAdmin() {
  if (!adminData.stats) return `<div class="loading">Chargement de l'espace admin…</div>`;
  const s = adminData.stats;
  return `
    <div class="admin-badge">Espace admin — accès restreint à ton compte</div>
    <div class="stat-grid">
      <div class="stat-box"><div class="num">${s.totalUsers}</div><div class="label">Utilisateurs</div></div>
      <div class="stat-box"><div class="num">${s.totalListings}</div><div class="label">Profils</div></div>
      <div class="stat-box"><div class="num">${s.totalMissions}</div><div class="label">Missions</div></div>
      <div class="stat-box"><div class="num">${s.pendingPackRequests + s.pendingCreditRequests}</div><div class="label">Demandes en attente</div></div>
    </div>

    <div class="section-label">Profils à vérifier (${adminData.pendingListings.length})</div>
    ${adminData.pendingListings.length ? adminData.pendingListings.map(l => `
      <div class="admin-row">
        <div class="admin-row-top"><span class="admin-row-title">${escapeHtml(l.nom)}</span></div>
        <div class="admin-row-meta">${escapeHtml(l.competence)} — ${escapeHtml(l.quartier)}</div>
        <div class="admin-actions"><button class="btn-approve" onclick="adminVerifyListing('${l.id}')">Vérifier ✓</button></div>
      </div>
    `).join('') : `<div class="empty">Rien à vérifier.</div>`}

    <div class="section-label">Demandes de packs de visibilité (${adminData.packRequests.length})</div>
    ${adminData.packRequests.length ? adminData.packRequests.map(r => `
      <div class="admin-row">
        <div class="admin-row-top"><span class="admin-row-title">${PACK_LABEL[r.pack]||r.pack}</span></div>
        <div class="admin-row-meta">Réf : ${escapeHtml(r.reference)}${r.amount?` — ${escapeHtml(String(r.amount))} FCFA`:''}</div>
        <div class="admin-actions">
          <button class="btn-approve" onclick="adminApprovePack('${r.id}')">Activer</button>
          <button class="btn-reject" onclick="adminRejectPack('${r.id}')">Rejeter</button>
        </div>
      </div>
    `).join('') : `<div class="empty">Aucune demande en attente.</div>`}

    <div class="section-label">Demandes de crédits (${adminData.creditRequests.length})</div>
    ${adminData.creditRequests.length ? adminData.creditRequests.map(r => `
      <div class="admin-row">
        <div class="admin-row-top"><span class="admin-row-title">${r.qty} crédits ${r.type}</span></div>
        <div class="admin-row-meta">Réf : ${escapeHtml(r.reference)}${r.amount?` — ${escapeHtml(String(r.amount))} FCFA`:''}</div>
        <div class="admin-actions">
          <button class="btn-approve" onclick="adminApproveCredit('${r.id}')">Activer</button>
          <button class="btn-reject" onclick="adminRejectCredit('${r.id}')">Rejeter</button>
        </div>
      </div>
    `).join('') : `<div class="empty">Aucune demande en attente.</div>`}

    <div class="section-label">Avis signalés (${adminData.flaggedReviews.length})</div>
    ${adminData.flaggedReviews.length ? adminData.flaggedReviews.map(r => `
      <div class="admin-row">
        <div class="admin-row-top"><span class="admin-row-title">★ ${r.rating} — ${escapeHtml(r.reviewerNom)}</span></div>
        <div class="admin-row-meta">${escapeHtml(r.comment||'(pas de commentaire)')}</div>
        <div class="admin-actions">
          <button class="btn-reject" onclick="adminHideReview('${r.id}')">Masquer</button>
          <button class="btn-approve" onclick="adminRestoreReview('${r.id}')">Garder visible</button>
        </div>
      </div>
    `).join('') : `<div class="empty">Aucun avis signalé.</div>`}
  `;
}

async function adminVerifyListing(id){ await api(`/admin/listings/${id}/verify`,{method:'POST'}); showToast('Profil vérifié.'); await loadAdminData(); await loadListings(); }
async function adminApprovePack(id){ await api(`/admin/pack-requests/${id}/approve`,{method:'POST'}); showToast('Pack activé.'); await loadAdminData(); await loadListings(); }
async function adminRejectPack(id){ await api(`/admin/pack-requests/${id}/reject`,{method:'POST'}); showToast('Demande rejetée.'); await loadAdminData(); }
async function adminApproveCredit(id){ await api(`/admin/credit-requests/${id}/approve`,{method:'POST'}); showToast('Crédits activés.'); await loadAdminData(); }
async function adminRejectCredit(id){ await api(`/admin/credit-requests/${id}/reject`,{method:'POST'}); showToast('Demande rejetée.'); await loadAdminData(); }
async function adminHideReview(id){ await api(`/admin/reviews/${id}/hide`,{method:'POST'}); showToast('Avis masqué.'); await loadAdminData(); }
async function adminRestoreReview(id){ await api(`/admin/reviews/${id}/restore`,{method:'POST'}); showToast('Avis restauré.'); await loadAdminData(); }

// ---------- Modals ----------
let modalState = { reviewTargetId:null, propTargetMissionId:null, boostPack:null, boostAmount:0, boostListingId:null, creditType:null, creditQty:0, creditAmount:0, editingListingId:null, confirmAction:null };

function renderModals() {
  return `
  <div class="modal-overlay" id="modal-createListing"><div class="modal">
    <button class="close-btn" onclick="closeModal('createListing')">✕</button>
    <h2 id="listingModalTitle">Propose ton service</h2><p class="sub">Toujours gratuit.</p>
    <div class="field"><label>Catégorie</label><select id="f_categorie">${CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>
    <div class="field"><label>Ta compétence</label><input id="f_competence" type="text" placeholder="Ex : Plomberie, Chauffeur mariage..."></div>
    <div class="field-row">
      <div class="field"><label>Quartier / ville</label><input id="f_quartier" type="text" placeholder="Ex : Badalabougou"></div>
      <div class="field">
        <label>Tarif indicatif</label>
        <input id="f_tarif" type="text" placeholder="Ex : 5 000 FCFA, 5 000–15 000, à partir de 5 000...">
        <div style="font-size:11px; color:#8a7c68; margin-top:4px;">Texte libre : fourchette, "à partir de", "négociable"... ce que tu veux.</div>
      </div>
    </div>
    <div class="field"><label>Numéro WhatsApp</label><input id="f_tel" type="text" placeholder="Ex : 7X XX XX XX"></div>
    <div class="field"><label>Description</label><textarea id="f_desc"></textarea></div>
    <button class="submit-btn" id="listingSubmitBtn" onclick="submitListing()">Publier mon profil</button>
  </div></div>

  <div class="modal-overlay" id="modal-review"><div class="modal">
    <button class="close-btn" onclick="closeModal('review')">✕</button>
    <h2>Laisser un avis</h2><p class="sub" id="reviewTarget"></p>
    <div class="star-picker" id="starPicker">${[1,2,3,4,5].map(v=>`<span data-v="${v}">★</span>`).join('')}</div>
    <div class="field"><textarea id="r_comment" placeholder="Ton commentaire (optionnel)"></textarea></div>
    <button class="submit-btn" onclick="submitReview()">Envoyer l'avis</button>
  </div></div>

  <div class="modal-overlay" id="modal-createMission"><div class="modal">
    <button class="close-btn" onclick="closeModal('createMission')">✕</button>
    <h2>Publie ta mission</h2><p class="sub">Gratuit.</p>
    <div class="field"><label>Titre</label><input id="m_titre" type="text"></div>
    <div class="field"><label>Catégorie</label><select id="m_categorie">${CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>
    <div class="field"><label>Description</label><textarea id="m_desc"></textarea></div>
    <div class="field-row">
      <div class="field"><label>Quartier / ville</label><input id="m_quartier" type="text"></div>
      <div class="field"><label>Budget</label><input id="m_budget" type="text"></div>
    </div>
    <button class="submit-btn" onclick="submitMission()">Publier</button>
  </div></div>

  <div class="modal-overlay" id="modal-prop"><div class="modal">
    <button class="close-btn" onclick="closeModal('prop')">✕</button>
    <h2>Envoyer une proposition</h2><p class="sub" id="propTarget"></p>
    <div class="field"><label>Ton profil prestataire</label><select id="p_provider">${myListings().map(l=>`<option value="${l.id}">${escapeHtml(l.nom)} — ${escapeHtml(l.competence)}</option>`).join('') || "<option value=''>Crée un profil d'abord</option>"}</select></div>
    <div class="field"><label>Ton prix</label><input id="p_prix" type="text"></div>
    <div class="field"><label>Message</label><textarea id="p_msg"></textarea></div>
    <button class="submit-btn" onclick="submitProposal()">Envoyer</button>
  </div></div>

  <div class="modal-overlay" id="modal-boost"><div class="modal">
    <button class="close-btn" onclick="closeModal('boost')">✕</button>
    <h2 id="boostTitle">Activer un pack</h2><p class="sub">Choisis ton profil à booster.</p>
    <div class="field"><label>Quel profil ?</label><select id="b_profile">${myListings().map(l=>`<option value="${l.id}">${escapeHtml(l.nom)} — ${escapeHtml(l.competence)}</option>`).join('') || "<option value=''>Crée un profil d'abord</option>"}</select></div>
    <div class="payflow" style="margin-bottom:14px;">Envoie <strong id="boostAmountLabel"></strong> au <strong>+223 XX XX XX XX (Orange Money)</strong>, puis colle ta référence.</div>
    <div class="field"><label>Référence de transaction</label><input id="b_ref" type="text"></div>
    <button class="submit-btn" onclick="submitBoostRequest()">Envoyer la demande</button>
  </div></div>

  <div class="modal-overlay" id="modal-credit"><div class="modal">
    <button class="close-btn" onclick="closeModal('credit')">✕</button>
    <h2 id="creditTitle">Acheter des crédits</h2>
    <div class="payflow" style="margin-bottom:14px;">Envoie <strong id="creditAmountLabel"></strong> au <strong>+223 XX XX XX XX (Orange Money)</strong>, puis colle ta référence.</div>
    <div class="field"><label>Référence de transaction</label><input id="c_ref" type="text"></div>
    <button class="submit-btn" onclick="submitCreditRequest()">Envoyer la demande</button>
  </div></div>

  <div class="modal-overlay" id="modal-confirm"><div class="modal">
    <button class="close-btn" onclick="closeModal('confirm')">✕</button>
    <h2>Confirmer</h2><p class="sub" id="confirmMessage"></p>
    <button class="submit-btn" style="background:var(--terracotta);" onclick="runConfirmedAction()">Confirmer</button>
    <button class="btn-outline" style="margin-top:8px;" onclick="closeModal('confirm')">Annuler</button>
  </div></div>
  `;
}

function openConfirmModal(message, action) {
  modalState.confirmAction = action;
  document.getElementById('confirmMessage').textContent = message;
  openModal('confirm');
}

async function runConfirmedAction() {
  const action = modalState.confirmAction;
  modalState.confirmAction = null;
  closeModal('confirm');
  if (action) await action();
}

function myListings() { return state.ownListings; }

function openModal(name) { document.getElementById('modal-' + name).classList.add('open'); }
function closeModal(name) { document.getElementById('modal-' + name).classList.remove('open'); }

function openCreateListingModal() {
  modalState.editingListingId = null;
  document.getElementById('listingModalTitle').textContent = 'Propose ton service';
  document.getElementById('listingSubmitBtn').textContent = 'Publier mon profil';
  document.getElementById('f_categorie').value = CATEGORIES[0];
  document.getElementById('f_competence').value = '';
  document.getElementById('f_quartier').value = '';
  document.getElementById('f_tarif').value = '';
  document.getElementById('f_tel').value = '';
  document.getElementById('f_desc').value = '';
  openModal('createListing');
}

function openEditListingModal(id) {
  const l = state.ownListings.find(x => x.id === id);
  if (!l) return;
  modalState.editingListingId = id;
  document.getElementById('listingModalTitle').textContent = 'Modifier ton profil';
  document.getElementById('listingSubmitBtn').textContent = 'Enregistrer les modifications';
  document.getElementById('f_categorie').value = l.categorie;
  document.getElementById('f_competence').value = l.competence;
  document.getElementById('f_quartier').value = l.quartier;
  document.getElementById('f_tarif').value = l.tarif || '';
  document.getElementById('f_tel').value = l.telephone || '';
  document.getElementById('f_desc').value = l.description || '';
  openModal('createListing');
}

async function submitListing() {
  const body = {
    categorie: document.getElementById('f_categorie').value,
    competence: document.getElementById('f_competence').value.trim(),
    quartier: document.getElementById('f_quartier').value.trim(),
    tarif: document.getElementById('f_tarif').value.trim(),
    telephone: document.getElementById('f_tel').value.trim(),
    description: document.getElementById('f_desc').value.trim()
  };
  if (!body.competence || !body.quartier) { showToast('Compétence et quartier sont obligatoires.'); return; }
  try {
    if (modalState.editingListingId) {
      await api(`/listings/${modalState.editingListingId}`, { method:'PUT', body: JSON.stringify(body) });
      showToast('Profil mis à jour !');
    } else {
      await api('/listings', { method:'POST', body: JSON.stringify(body) });
      showToast('Profil publié !');
    }
    closeModal('createListing');
    await loadListings();
    await loadOwnListings();
    render();
  } catch(e){ showToast(e.message); }
}

function confirmDeleteListing(id) {
  openConfirmModal('Supprimer définitivement ce profil ?', async () => {
    try {
      await api(`/listings/${id}`, { method:'DELETE' });
      showToast('Profil supprimé.');
      await loadListings();
      await loadOwnListings();
      render();
    } catch(e){ showToast(e.message); }
  });
}

function openReviewModal(id, nom) {
  modalState.reviewTargetId = id;
  document.getElementById('reviewTarget') && (document.getElementById('reviewTarget').textContent = 'Pour : ' + nom);
  openModal('review');
  document.querySelectorAll('#starPicker span').forEach(s => {
    s.classList.remove('on');
    s.onclick = () => {
      const v = parseInt(s.dataset.v);
      modalState.selectedRating = v;
      document.querySelectorAll('#starPicker span').forEach(x => x.classList.toggle('on', parseInt(x.dataset.v) <= v));
    };
  });
}
async function submitReview() {
  if (!modalState.selectedRating) { showToast('Choisis une note.'); return; }
  try {
    await api('/reviews', { method:'POST', body: JSON.stringify({ listingId: modalState.reviewTargetId, rating: modalState.selectedRating, comment: document.getElementById('r_comment').value.trim() }) });
    showToast('Merci pour ton avis !');
    closeModal('review');
    modalState.selectedRating = 0;
    await loadListings();
    render();
  } catch(e){ showToast(e.message); }
}

async function submitMission() {
  const body = {
    titre: document.getElementById('m_titre').value.trim(),
    categorie: document.getElementById('m_categorie').value,
    description: document.getElementById('m_desc').value.trim(),
    quartier: document.getElementById('m_quartier').value.trim(),
    budget: document.getElementById('m_budget').value.trim()
  };
  if (!body.titre || !body.description || !body.quartier) { showToast('Titre, description et quartier sont obligatoires.'); return; }
  try {
    await api('/missions', { method:'POST', body: JSON.stringify(body) });
    showToast('Mission publiée !');
    closeModal('createMission');
    await loadMissions();
    render();
  } catch(e){ showToast(e.message); }
}

function openPropModal(missionId, titre) {
  modalState.propTargetMissionId = missionId;
  openModal('prop');
  document.getElementById('propTarget').textContent = 'Pour : ' + titre;
}
async function submitProposal() {
  const providerId = document.getElementById('p_provider').value;
  const prix = document.getElementById('p_prix').value.trim();
  const message = document.getElementById('p_msg').value.trim();
  if (!providerId) { showToast("Crée un profil prestataire d'abord."); return; }
  try {
    await api(`/missions/${modalState.propTargetMissionId}/proposals`, { method:'POST', body: JSON.stringify({ listingId: providerId, prix, message }) });
    showToast('Proposition envoyée !');
    closeModal('prop');
    await loadMissions(); await loadListings();
    render();
  } catch(e){ showToast(e.message); }
}

function openBoostModal(pack, label, amount) {
  modalState.boostPack = pack; modalState.boostAmount = amount;
  document.getElementById('boostTitle').textContent = 'Activer le pack ' + label;
  document.getElementById('boostAmountLabel').textContent = amount.toLocaleString('fr-FR') + ' FCFA';
  openModal('boost');
}
async function submitBoostRequest() {
  const listingId = document.getElementById('b_profile').value;
  const reference = document.getElementById('b_ref').value.trim();
  if (!listingId) { showToast("Crée un profil d'abord."); return; }
  if (!reference) { showToast('Renseigne ta référence de transaction.'); return; }
  try {
    await api('/packs', { method:'POST', body: JSON.stringify({ listingId, pack: modalState.boostPack, amount: modalState.boostAmount, reference }) });
    showToast('Demande envoyée — un admin va la valider sous 24h.');
    closeModal('boost');
  } catch(e){ showToast(e.message); }
}

function openCreditRequestModal(type, qty, amount) {
  modalState.creditType = type; modalState.creditQty = qty; modalState.creditAmount = amount;
  document.getElementById('creditTitle').textContent = `Acheter ${qty} crédits ${type === 'contact' ? 'contact' : 'message'}`;
  document.getElementById('creditAmountLabel').textContent = amount.toLocaleString('fr-FR') + ' FCFA';
  openModal('credit');
}
async function submitCreditRequest() {
  const reference = document.getElementById('c_ref').value.trim();
  if (!reference) { showToast('Renseigne ta référence de transaction.'); return; }
  try {
    await api('/credits', { method:'POST', body: JSON.stringify({ type: modalState.creditType, qty: modalState.creditQty, amount: modalState.creditAmount, reference }) });
    showToast('Demande envoyée — un admin va la valider sous 24h.');
    closeModal('credit');
  } catch(e){ showToast(e.message); }
}

boot();
