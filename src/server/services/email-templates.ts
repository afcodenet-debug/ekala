// =============================================================================
// Email Templates — Centralisés pour tout le système voucher
// =============================================================================

export function buildVoucherGeneratedEmail(
  code: string,
  plan: any,
  amountCents: number,
  currency: string,
  verificationDeadline: Date,
  expiresAt: Date
): string {
  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f0ede8;padding:32px 16px">
    <div style="max-width:520px;margin:0 auto">
      <div style="background:#1a1a1f;border-radius:16px 16px 0 0;padding:22px 28px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:18px;font-weight:700;color:#c9a84c;letter-spacing:.04em">GREAT OLIVE</div>
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
        <div style="font-size:10px;color:#bbb;letter-spacing:.08em">GREAT OLIVE · LUSAKA</div>
        <div style="font-size:10px;color:#bbb">Automatique</div>
      </div>
    </div>
  </div>`;
}

export function buildVoucherExpiredEmail(code: string, plan: any, expiredAt: Date): string {
  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f0ede8;padding:32px 16px">
    <div style="max-width:520px;margin:0 auto">
      <div style="background:#1a1a1f;border-radius:16px 16px 0 0;padding:22px 28px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:18px;font-weight:700;color:#c9a84c;letter-spacing:.04em">GREAT OLIVE</div>
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
        <div style="font-size:10px;color:#bbb;letter-spacing:.08em">GREAT OLIVE · LUSAKA</div>
        <div style="font-size:10px;color:#bbb">${expiredAt.toLocaleString('fr-FR')}</div>
      </div>
    </div>
  </div>`;
}

export function buildPaymentVerifiedEmailHTML(voucherCode: string, verifiedAt: string): string {
  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f0ede8;padding:32px 16px">
    <div style="max-width:520px;margin:0 auto">
      <div style="background:#1a1a1f;border-radius:16px 16px 0 0;padding:22px 28px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:18px;font-weight:700;color:#c9a84c;letter-spacing:.04em">GREAT OLIVE</div>
          <div style="font-size:10px;color:#6a6a80;letter-spacing:.14em;margin-top:3px;font-weight:500">PAIEMENT VALIDÉ</div>
        </div>
      </div>
      <div style="background:#fff;padding:28px;border-left:1px solid #e8e2d9;border-right:1px solid #e8e2d9">
        <div style="font-size:22px;font-weight:700;color:#111;margin-bottom:8px">Votre paiement a été validé</div>
        <div style="font-size:12px;color:#888;margin-bottom:20px">Code : <strong>${voucherCode}</strong></div>
        <p style="font-size:13px;color:#333;line-height:1.6">Votre abonnement est désormais actif. Connectez-vous à votre tableau de bord pour continuer.</p>
      </div>
      <div style="background:#f7f4ef;border-radius:0 0 16px 16px;padding:14px 28px;border:1px solid #e8e2d9;border-top:none;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:10px;color:#bbb;letter-spacing:.08em">GREAT OLIVE · LUSAKA</div>
        <div style="font-size:10px;color:#bbb">${new Date(verifiedAt).toLocaleString('fr-FR')}</div>
      </div>
    </div>
  </div>`;
}

export function buildPaymentRejectedEmailHTML(voucherCode: string, reason: string, rejectedAt: string): string {
  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f0ede8;padding:32px 16px">
    <div style="max-width:520px;margin:0 auto">
      <div style="background:#1a1a1f;border-radius:16px 16px 0 0;padding:22px 28px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:18px;font-weight:700;color:#c9a84c;letter-spacing:.04em">GREAT OLIVE</div>
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
        <div style="font-size:10px;color:#bbb;letter-spacing:.08em">GREAT OLIVE · LUSAKA</div>
        <div style="font-size:10px;color:#bbb">${new Date(rejectedAt).toLocaleString('fr-FR')}</div>
      </div>
    </div>
  </div>`;
}