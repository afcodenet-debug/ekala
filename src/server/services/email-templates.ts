// =============================================================================
// Email Templates — Centralisés pour tout le système voucher
// =============================================================================

// Coordonnées de paiement manuel Mobile Money (Zambie)
export const MOBILE_MONEY_NUMBERS = ['+260573769091', '+260972934542'];
export const PAYMENT_CONFIRMATION_PHONE = '+260767043875';

function formatAmount(cents: number, currency: string): string {
  const value = (Number(cents) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
  return `${currency} ${value}`;
}

/**
 * Email envoyé AU LOCATAIRE immédiatement après la soumission d'une demande
 * d'abonnement. Il détaille la procédure de paiement MANUEL (Mobile Money)
 * et invite le locataire à appeler pour confirmer. Aucun code de bon
 * (voucher) n'est encore communiqué : il sera envoyé après validation admin.
 */
export function buildManualPaymentInstructionsEmail(params: {
  referenceCode: string;
  planName: string;
  amountCents: number;
  currency: string;
  businessName: string;
}): string {
  const { referenceCode, planName, amountCents, currency, businessName } = params;
  const mmNumbers = MOBILE_MONEY_NUMBERS.map(
    (n) => `<li style="font-size:14px;color:#111;font-weight:600">${n}</li>`,
  ).join('');
  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f0ede8;padding:32px 16px">
    <div style="max-width:560px;margin:0 auto">
      <div style="background:#1a1a1f;border-radius:16px 16px 0 0;padding:22px 28px">
        <div style="font-size:18px;font-weight:700;color:#c9a84c;letter-spacing:.04em">${businessName.toUpperCase()}</div>
        <div style="font-size:10px;color:#6a6a80;letter-spacing:.14em;margin-top:3px;font-weight:500">DEMANDE D'ABONNEMENT REÇUE</div>
      </div>
      <div style="background:#fff;padding:28px;border-left:1px solid #e8e2d9;border-right:1px solid #e8e2d9">
        <div style="font-size:22px;font-weight:700;color:#111;margin-bottom:8px">Votre demande est enregistrée</div>
        <div style="font-size:13px;color:#666;line-height:1.6;margin-bottom:20px">
          Merci pour votre demande d'abonnement au forfait <strong>${planName}</strong>.
          Pour activer votre abonnement, veuillez procéder au paiement manuel ci-dessous.
        </div>

        <div style="margin:18px 0;padding:18px;background:#fafaf8;border:1px solid #e8e2d9;border-radius:12px">
          <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Montant à transférer</div>
          <div style="font-size:26px;font-weight:900;color:#111">${formatAmount(amountCents, currency)}</div>
          <div style="font-size:12px;color:#888;margin-top:8px">Référence de demande : <strong style="font-family:monospace;color:#111">${referenceCode}</strong></div>
        </div>

        <div style="font-size:14px;font-weight:700;color:#111;margin:20px 0 10px">1. Transférez les fonds via Mobile Money</div>
        <ul style="margin:0 0 8px;padding-left:20px">${mmNumbers}</ul>

        <div style="font-size:14px;font-weight:700;color:#111;margin:20px 0 10px">2. Confirmez la transaction par téléphone</div>
        <div style="font-size:13px;color:#333;line-height:1.6">
          Après le transfert, appelez le <strong>${PAYMENT_CONFIRMATION_PHONE}</strong> pour confirmer votre paiement
          et communiquer votre référence de demande <strong style="font-family:monospace">${referenceCode}</strong>.
        </div>

        <div style="margin-top:22px;padding:16px;background:#fff8e6;border:1px solid #f3e2b3;border-radius:10px">
          <div style="font-size:12px;color:#8a6d1f;line-height:1.6">
            Un administrateur vérifiera la réception des fonds, activera votre formule et vous enverra
            votre <strong>code de bon (voucher)</strong> par email et dans l'application. Aucune action de votre part n'est requise ensuite.
          </div>
        </div>
      </div>
      <div style="background:#f7f4ef;border-radius:0 0 16px 16px;padding:14px 28px;border:1px solid #e8e2d9;border-top:none;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:10px;color:#bbb;letter-spacing:.08em">${businessName.toUpperCase()} · LUSAKA</div>
        <div style="font-size:10px;color:#bbb">Procédure automatique</div>
      </div>
    </div>
  </div>`;
}

/**
 * Email envoyé AU LOCATAIRE après validation du paiement par l'administrateur.
 * Contient le code de bon (voucher) définitif permettant d'activer l'abonnement.
 */
export function buildVoucherActivatedEmail(params: {
  voucherCode: string;
  planName: string;
  businessName: string;
  activatedAt: string;
}): string {
  const { voucherCode, planName, businessName, activatedAt } = params;
  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f0ede8;padding:32px 16px">
    <div style="max-width:560px;margin:0 auto">
      <div style="background:#1a1a1f;border-radius:16px 16px 0 0;padding:22px 28px">
        <div style="font-size:18px;font-weight:700;color:#c9a84c;letter-spacing:.04em">${businessName.toUpperCase()}</div>
        <div style="font-size:10px;color:#6a6a80;letter-spacing:.14em;margin-top:3px;font-weight:500">ABONNEMENT ACTIVÉ</div>
      </div>
      <div style="background:#fff;padding:28px;border-left:1px solid #e8e2d9;border-right:1px solid #e8e2d9">
        <div style="font-size:22px;font-weight:700;color:#111;margin-bottom:8px">Paiement validé — abonnement actif</div>
        <div style="font-size:13px;color:#666;line-height:1.6;margin-bottom:18px">
          Votre paiement pour le forfait <strong>${planName}</strong> a été confirmé par notre équipe.
          Votre abonnement est désormais actif.
        </div>
        <div style="margin:18px 0;padding:18px;background:#eef9f1;border:1px solid #bfe6cb;border-radius:12px;text-align:center">
          <div style="font-size:12px;color:#1f7a43;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Votre code de bon (voucher)</div>
          <div style="font-size:28px;font-weight:900;color:#111;letter-spacing:.08em;font-family:monospace">${voucherCode}</div>
        </div>
        <p style="font-size:13px;color:#333;line-height:1.6">
          Conservez ce code. Vous pouvez l'utiliser pour réactiver ou transférer votre formule si nécessaire.
          Connectez-vous à votre tableau de bord pour profiter de votre abonnement.
        </p>
      </div>
      <div style="background:#f7f4ef;border-radius:0 0 16px 16px;padding:14px 28px;border:1px solid #e8e2d9;border-top:none;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:10px;color:#bbb;letter-spacing:.08em">${businessName.toUpperCase()} · LUSAKA</div>
        <div style="font-size:10px;color:#bbb">${new Date(activatedAt).toLocaleString('fr-FR')}</div>
      </div>
    </div>
  </div>`;
}

export function buildVoucherGeneratedEmail(
  code: string,
  plan: any,
  amountCents: number,
  currency: string,
  verificationDeadline: Date,
  expiresAt: Date,
  businessName: string,
): string {
  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f0ede8;padding:32px 16px">
    <div style="max-width:520px;margin:0 auto">
      <div style="background:#1a1a1f;border-radius:16px 16px 0 0;padding:22px 28px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:18px;font-weight:700;color:#c9a84c;letter-spacing:.04em">${businessName.toUpperCase()}</div>
          <div style="font-size:10px;color:#6a6a80;letter-spacing:.14em;margin-top:3px;font-weight:500">VOUCHER DE PAIEMENT</div>
        </div>
      </div>
      <div style="background:#fff;padding:28px;border-left:1px solid #e8e2d9;border-right:1px solid #e8e2d9">
        <div style="font-size:22px;font-weight:700;color:#111;margin-bottom:8px">Code de paiement généré</div>
        <div style="font-size:12px;color:#888;margin-bottom:20px">Plan : <strong>${plan.name}</strong></div>
        <div style="margin:20px 0;padding:18px;background:#fafaf8;border:1px solid #e8e2d9;border-radius:12px;text-align:center">
          <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Votre code</div>
          <div style="font-size:28px;font-weight:900;color:#111;letter-spacing:.08em">${code}</div>
        </div>
        <div style="font-size:13px;color:#333;line-height:1.6;margin-bottom:16px">
          <strong>Montant :</strong> ${currency} ${(amountCents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}<br/>
          <strong>Validité demande :</strong> ${verificationDeadline.toLocaleString('fr-FR')}<br/>
          <strong>Expiration du code :</strong> ${expiresAt.toLocaleString('fr-FR')}
        </div>
        <p style="font-size:12px;color:#666;line-height:1.5">Veuillez utiliser ce code pour votre paiement. Après réception, un administrateur validera votre abonnement.</p>
      </div>
      <div style="background:#f7f4ef;border-radius:0 0 16px 16px;padding:14px 28px;border:1px solid #e8e2d9;border-top:none;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:10px;color:#bbb;letter-spacing:.08em">${businessName.toUpperCase()} · LUSAKA</div>
        <div style="font-size:10px;color:#bbb">Automatique</div>
      </div>
    </div>
  </div>`;
}

export function buildVoucherExpiredEmail(code: string, plan: any, expiredAt: Date, businessName: string): string {
  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f0ede8;padding:32px 16px">
    <div style="max-width:520px;margin:0 auto">
      <div style="background:#1a1a1f;border-radius:16px 16px 0 0;padding:22px 28px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:18px;font-weight:700;color:#c9a84c;letter-spacing:.04em">${businessName.toUpperCase()}</div>
          <div style="font-size:10px;color:#6a6a80;letter-spacing:.14em;margin-top:3px;font-weight:500">DEMANDE EXPIRÉE</div>
        </div>
      </div>
      <div style="background:#fff;padding:28px;border-left:1px solid #e8e2d9;border-right:1px solid #e8e2d9">
        <div style="font-size:22px;font-weight:700;color:#111;margin-bottom:8px">Votre demande de paiement a expiré</div>
        <div style="font-size:12px;color:#888;margin-bottom:20px">Plan : <strong>${plan.name}</strong></div>
        <div style="margin:20px 0;padding:18px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;text-align:center">
          <div style="font-size:12px;color:#991b1b;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Code expiré</div>
          <div style="font-size:28px;font-weight:900;color:#111;letter-spacing:.08em">${code}</div>
        </div>
        <p style="font-size:13px;color:#333;line-height:1.6">Le délai de paiement pour ce code a expiré. Votre compte reste en attente de paiement.</p>
        <p style="font-size:13px;color:#333;line-height:1.6;margin-top:12px">Vous pouvez soumettre une nouvelle demande depuis votre espace facturation.</p>
      </div>
      <div style="background:#f7f4ef;border-radius:0 0 16px 16px;padding:14px 28px;border:1px solid #e8e2d9;border-top:none;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:10px;color:#bbb;letter-spacing:.08em">${businessName.toUpperCase()} · LUSAKA</div>
        <div style="font-size:10px;color:#bbb">${expiredAt.toLocaleString('fr-FR')}</div>
      </div>
    </div>
  </div>`;
}

export function buildPaymentVerifiedEmailHTML(voucherCode: string, verifiedAt: string, businessName: string): string {
  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f0ede8;padding:32px 16px">
    <div style="max-width:520px;margin:0 auto">
      <div style="background:#1a1a1f;border-radius:16px 16px 0 0;padding:22px 28px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:18px;font-weight:700;color:#c9a84c;letter-spacing:.04em">${businessName.toUpperCase()}</div>
          <div style="font-size:10px;color:#6a6a80;letter-spacing:.14em;margin-top:3px;font-weight:500">PAIEMENT VALIDÉ</div>
        </div>
      </div>
      <div style="background:#fff;padding:28px;border-left:1px solid #e8e2d9;border-right:1px solid #e8e2d9">
        <div style="font-size:22px;font-weight:700;color:#111;margin-bottom:8px">Votre paiement a été validé</div>
        <div style="font-size:12px;color:#888;margin-bottom:20px">Code : <strong>${voucherCode}</strong></div>
        <p style="font-size:13px;color:#333;line-height:1.6">Votre abonnement est désormais actif. Connectez-vous à votre tableau de bord pour continuer.</p>
      </div>
      <div style="background:#f7f4ef;border-radius:0 0 16px 16px;padding:14px 28px;border:1px solid #e8e2d9;border-top:none;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:10px;color:#bbb;letter-spacing:.08em">${businessName.toUpperCase()} · LUSAKA</div>
        <div style="font-size:10px;color:#bbb">${new Date(verifiedAt).toLocaleString('fr-FR')}</div>
      </div>
    </div>
  </div>`;
}

export function buildPaymentRejectedEmailHTML(voucherCode: string, reason: string, rejectedAt: string, businessName: string): string {
  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f0ede8;padding:32px 16px">
    <div style="max-width:520px;margin:0 auto">
      <div style="background:#1a1a1f;border-radius:16px 16px 0 0;padding:22px 28px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:18px;font-weight:700;color:#c9a84c;letter-spacing:.04em">${businessName.toUpperCase()}</div>
          <div style="font-size:10px;color:#6a6a80;letter-spacing:.14em;margin-top:3px;font-weight:500">PAIEMENT REJETÉ</div>
        </div>
      </div>
      <div style="background:#fff;padding:28px;border-left:1px solid #e8e2d9;border-right:1px solid #e8e2d9">
        <div style="font-size:22px;font-weight:700;color:#111;margin-bottom:8px">Votre demande a été rejetée</div>
        <div style="font-size:12px;color:#888;margin-bottom:20px">Code : <strong>${voucherCode}</strong></div>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px;margin-bottom:16px">
          <div style="font-size:12px;color:#991b1b;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Raison</div>
          <div style="font-size:13px;color:#333">${reason}</div>
        </div>
        <p style="font-size:13px;color:#333;line-height:1.6">Votre compte reste en attente de paiement. Veuillez contacter le support ou soumettre une nouvelle demande.</p>
      </div>
      <div style="background:#f7f4ef;border-radius:0 0 16px 16px;padding:14px 28px;border:1px solid #e8e2d9;border-top:none;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:10px;color:#bbb;letter-spacing:.08em">${businessName.toUpperCase()} · LUSAKA</div>
        <div style="font-size:10px;color:#bbb">${new Date(rejectedAt).toLocaleString('fr-FR')}</div>
      </div>
    </div>
  </div>`;
}