/**
 * Runtime Tracer - Debugging temporaire pour le problème d'affichage du tenant.
 * À SUPPRIMER après résolution.
 * 
 * Usage :
 *   import { trace } from '../lib/runtime-tracer';
 *   trace.login('7A2F91', { tenant_name: 'MAKUTANO' });
 *   trace.render('Sidebar', 1, { tenant_name: 'MAKUTANO' });
 */

let startTime = Date.now();

function ts(): string {
  const elapsed = Date.now() - startTime;
  return `T+${elapsed}ms`;
}

function cid(): string {
  return sessionStorage.getItem('tenant_trace_cid') || 'NO_CID';
}

export const trace = {
  /** Initialiser le Correlation ID au login */
  initCID: (id: string) => {
    sessionStorage.setItem('tenant_trace_cid', id);
    startTime = Date.now();
    console.log(`[TENANT][${id}][${ts()}] ═══════════════════════════════`);
    console.log(`[TENANT][${id}][${ts()}] TRACE INITIALISÉE`);
    console.log(`[TENANT][${id}][${ts()}] ═══════════════════════════════`);
  },

  /** Login réussi */
  login: (data: any) => {
    const id = cid();
    console.log(`[TENANT][${id}][${ts()}] 🔐 LOGIN`);
    console.log(`[TENANT][${id}][${ts()}]   tenant_name = "${data?.tenant_name}"`);
    console.log(`[TENANT][${id}][${ts()}]   tenant_slug = "${data?.tenant_slug}"`);
    console.log(`[TENANT][${id}][${ts()}]   tenant_id   = ${data?.tenant_id}`);
    console.log(`[TENANT][${id}][${ts()}]   full_name   = "${data?.full_name}"`);
    console.log(`[TENANT][${id}][${ts()}]   role        = "${data?.role}"`);
  },

  /** setUser() appelé */
  setUser: (source: string, user: any) => {
    const id = cid();
    console.log(`[TENANT][${id}][${ts()}] 📦 setUser(${source})`);
    console.log(`[TENANT][${id}][${ts()}]   user        =`, user ? JSON.stringify({
      id: user.id,
      username: user.username,
      role: user.role,
      tenant_id: user.tenant_id,
      tenant_name: user.tenant_name,
      tenant_slug: user.tenant_slug,
    }) : 'null');
    console.log(`[TENANT][${id}][${ts()}]   tenant_name = "${user?.tenant_name ?? '(undefined)'}"`);
    if (!user?.tenant_name && user) {
      console.log(`[TENANT][${id}][${ts()}] ⚠️ tenant_name ABSENT du user !`);
    }
  },

  /** Persist save */
  persistSave: (state: any) => {
    const id = cid();
    console.log(`[TENANT][${id}][${ts()}] 💾 PERSIST SAVE`);
    console.log(`[TENANT][${id}][${ts()}]   tenant_name persisté = "${state?.user?.tenant_name ?? '(undefined)'}"`);
  },

  /** Persist rehydrate */
  persistHydrate: (state: any) => {
    const id = cid();
    console.log(`[TENANT][${id}][${ts()}] 🔄 PERSIST HYDRATE`);
    console.log(`[TENANT][${id}][${ts()}]   tenant_name restauré = "${state?.user?.tenant_name ?? '(undefined)'}"`);
    if (!state?.user?.tenant_name && state?.user) {
      console.log(`[TENANT][${id}][${ts()}] ⚠️ tenant_name PERDU pendant la rehydration !`);
    }
  },

  /** refreshProfile */
  refreshProfile: (action: 'start' | 'response' | 'error', data?: any) => {
    const id = cid();
    if (action === 'start') {
      console.log(`[TENANT][${id}][${ts()}] 🔄 REFRESH PROFILE (début)`);
    } else if (action === 'response') {
      console.log(`[TENANT][${id}][${ts()}] 🔄 REFRESH PROFILE (réponse)`);
      console.log(`[TENANT][${id}][${ts()}]   tenant_name reçu = "${data?.tenant_name ?? '(undefined)'}"`);
      if (!data?.tenant_name) {
        console.log(`[TENANT][${id}][${ts()}] ⚠️ /me N'A PAS RENVOYÉ tenant_name !`);
      }
    } else if (action === 'error') {
      console.log(`[TENANT][${id}][${ts()}] 🔄 REFRESH PROFILE (ERREUR)`);
      console.log(`[TENANT][${id}][${ts()}]   user sera null → APP_NAME affiché`);
    }
  },

  /** Render d'un composant */
  render: (component: string, renderNum: number, user: any) => {
    const id = cid();
    const displayValue = user?.tenant_name || 'APP_NAME';
    const reason = !user ? 'user=null' : !user.tenant_name ? 'tenant_name=undefined' : 'tenant_name OK';
    console.log(`[TENANT][${id}][${ts()}] 🖼️ RENDER #${renderNum} [${component}]`);
    console.log(`[TENANT][${id}][${ts()}]   tenant_name = "${user?.tenant_name ?? '(undefined)'}"`);
    console.log(`[TENANT][${id}][${ts()}]   tenant_slug = "${user?.tenant_slug ?? '(undefined)'}"`);
    console.log(`[TENANT][${id}][${ts()}]   tenant_id   = ${user?.tenant_id ?? '(undefined)'}`);
    console.log(`[TENANT][${id}][${ts()}]   user        = ${user ? 'non-null' : 'null'}`);
    console.log(`[TENANT][${id}][${ts()}]   AFFICHAGE   = "${displayValue}"`);
    console.log(`[TENANT][${id}][${ts()}]   RAISON      = ${reason}`);
  },

  /** DataLoader */
  dataLoader: (action: string, data?: any) => {
    const id = cid();
    console.log(`[TENANT][${id}][${ts()}] 📂 DATALOADER ${action}`);
    if (data) console.log(`[TENANT][${id}][${ts()}]   ${JSON.stringify(data)}`);
  },

  /** Logout */
  logout: () => {
    const id = cid();
    console.log(`[TENANT][${id}][${ts()}] 🚪 LOGOUT`);
    sessionStorage.removeItem('tenant_trace_cid');
  },

  /** Message générique */
  log: (msg: string, data?: any) => {
    const id = cid();
    console.log(`[TENANT][${id}][${ts()}] ${msg}`);
    if (data) console.log(`[TENANT][${id}][${ts()}]   ${JSON.stringify(data)}`);
  },
};