// Intégration E-Billing / SHAP (Digitech Africa) — Mobile Money Gabon
// (Airtel Money, Moov Money). C'est le rail de paiement RÉEL au Gabon.
// Adapté du service éprouvé d'EduSpeed-V2 (bout-en-bout avec de vrais paiements).
//
// API marchand :
//   • POST  {SERVER_URL}              -> crée une facture « e_bill », renvoie un bill_id
//   • POST  {SERVER_URL}/{bill_id}/ussd_push -> pousse la demande USSD au téléphone client
//   • GET   {SERVER_URL}/{bill_id}    -> état réel de la facture (source de vérité)
//   Authentification : HTTP Basic base64(username:shared_key).
//   États : 'paid'/'processed' = encaissé ; 'expired'/'cancelled' = échec ;
//           'ready'/'created' = en attente du paiement client.
//
// PRINCIPE ANTI-BUG : on ne considère JAMAIS un paiement acquis sur la seule
// notification. On CONFIRME toujours via GET /{bill_id}, et la réconciliation
// périodique rattrape les notifications perdues.

const USERNAME = () => process.env.EBILLING_USERNAME || '';
const SHARED_KEY = () => process.env.EBILLING_SHARED_KEY || '';
const SERVER_URL = () => (process.env.EBILLING_SERVER_URL || 'https://stg.billing-easy.com/api/v1/merchant/e_bills').replace(/\/+$/, '');
const POST_URL = () => (process.env.EBILLING_POST_URL || 'https://staging.billing-easy.net').replace(/\/+$/, '');
const CURRENCY = 'XAF';

export function ebillingConfigure() {
  return Boolean(USERNAME() && SHARED_KEY() && SERVER_URL());
}

function entete() {
  const cred = Buffer.from(`${USERNAME()}:${SHARED_KEY()}`).toString('base64');
  return { Authorization: `Basic ${cred}`, 'Content-Type': 'application/json', Accept: 'application/json' };
}

// Numéro Gabon au format local 0XXXXXXXX attendu par E-Billing.
export function normaliserMsisdn(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (d.startsWith('241')) d = d.slice(3);
  if (d.length === 8) d = '0' + d;
  return d;
}

const ETATS_PAYE = new Set(['paid', 'processed']);
const ETATS_ATTENTE = new Set(['ready', 'created', 'pending', 'in_progress', 'scheduled', 'partially_paid']);
const OPERATEURS = {
  airtel: 'airtelmoney', airtelmoney: 'airtelmoney',
  moov: 'moovmoney4', moovmoney: 'moovmoney4', moovmoney4: 'moovmoney4',
};

// Préfixe Gabon : 07x = Airtel, 06x = Moov.
export function operateurDepuisMsisdn(tel) {
  const d = normaliserMsisdn(tel);
  if (/^07/.test(d)) return 'airtelmoney';
  if (/^06/.test(d)) return 'moovmoney4';
  return '';
}

function normaliserOperateur(op, msisdn) {
  return OPERATEURS[String(op || '').toLowerCase()] || operateurDepuisMsisdn(msisdn);
}

// Pousse une demande de paiement USSD vers le téléphone du client.
export async function pousserUssd(billId, msisdn, operateur) {
  if (!ebillingConfigure()) throw new Error('E-Billing non configuré');
  const ps = normaliserOperateur(operateur, msisdn);
  const r = await fetch(`${SERVER_URL()}/${encodeURIComponent(billId)}/ussd_push`, {
    method: 'POST', headers: entete(),
    body: JSON.stringify({ payer_msisdn: normaliserMsisdn(msisdn), payment_system_name: ps }),
  });
  const data = await r.json().catch(() => ({}));
  return { accepte: r.status === 202 || r.ok, operateur: ps, message: data.message || '', brut: data };
}

// Crée une facture e_bill puis pousse aussitôt l'USSD au client.
export async function initPayment({ transaction_id, montant, description, client = {} }) {
  if (!ebillingConfigure()) throw new Error('E-Billing non configuré (EBILLING_USERNAME / EBILLING_SHARED_KEY manquants)');
  const corps = {
    payer_email: client.email || 'client@autoecole.ga',
    payer_msisdn: normaliserMsisdn(client.telephone),
    payer_name: `${client.prenom || ''} ${client.nom || ''}`.trim(),
    amount: Math.round(montant),
    currency: CURRENCY,
    short_description: (description || 'Paiement auto-école').slice(0, 120),
    external_reference: String(transaction_id),
    due_date: new Date().toISOString().slice(0, 10),
    expiry_period: 60,
  };
  const r = await fetch(SERVER_URL(), { method: 'POST', headers: entete(), body: JSON.stringify(corps) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`E-Billing création refusée : ${data.message || data.error || `HTTP ${r.status}`}`);
  const bill = data.e_bill || data.bill || data;
  const billId = bill.bill_id || bill.id || data.bill_id;
  if (!billId) throw new Error('E-Billing : réponse sans bill_id');

  const operateur = normaliserOperateur(client.operateur, corps.payer_msisdn);
  let ussdPousse = false;
  if (operateur && corps.payer_msisdn) {
    try { ussdPousse = (await pousserUssd(billId, corps.payer_msisdn, operateur)).accepte; }
    catch { /* la veille rattrapera */ }
  }
  return {
    bill_id: String(billId),
    ussd_pousse: ussdPousse,
    operateur,
    payment_url: bill.payment_url || bill.url || data.payment_url || `${POST_URL()}/${billId}`,
    montant: Math.round(montant),
  };
}

// Vérifie l'état réel d'un e_bill (source de vérité).
export async function checkPayment(billId) {
  if (!ebillingConfigure()) throw new Error('E-Billing non configuré');
  if (!billId) return { paye: false, enAttente: true, statut: 'SANS_BILL_ID' };
  const r = await fetch(`${SERVER_URL()}/${encodeURIComponent(billId)}`, { headers: entete() });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`E-Billing statut indisponible (HTTP ${r.status})`);
  const bill = data.e_bill || data.bill || data;
  const etat = String(bill.state || '').toLowerCase();
  const du = Number(bill.amount) || 0;
  const paye = Number(bill.amount_paid) || 0;
  return {
    paye: ETATS_PAYE.has(etat) && paye >= du && du > 0,
    enAttente: ETATS_ATTENTE.has(etat),
    statut: etat || 'INCONNU',
    montant: paye,
    raw: bill,
  };
}
