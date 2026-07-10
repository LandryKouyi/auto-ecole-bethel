// Helper WhatsApp : construit des liens wa.me pré-remplis (gratuit, aucune API).
// Le numéro doit être au format international sans '+' ni espaces, ex: 24177000000.
export function normalizePhone(tel) {
  let t = String(tel || '').replace(/[^0-9]/g, '');
  // Numéro gabonais local (8 ou 9 chiffres) → préfixer 241.
  if (t.length && !t.startsWith('241') && t.length <= 9) t = '241' + t;
  return t;
}

export function whatsappLink(tel, message) {
  const num = normalizePhone(tel);
  const txt = encodeURIComponent(message || '');
  return `https://wa.me/${num}?text=${txt}`;
}

// Modèles de messages prêts à l'emploi.
export const modeles = {
  rappelPaiement: (eleve, montant) =>
    `Bonjour ${eleve.prenom}, votre auto-école vous rappelle un solde de ${montant} FCFA à régler. Merci de passer au bureau ou de payer par Mobile Money.`,
  confirmationLecon: (eleve, dateHeure) =>
    `Bonjour ${eleve.prenom}, votre leçon de conduite est confirmée pour le ${dateHeure}. Soyez ponctuel(le). Bonne route !`,
  resultatExamen: (eleve, reussi) =>
    reussi
      ? `Félicitations ${eleve.prenom} ! Vous avez RÉUSSI votre examen. Bravo pour votre travail.`
      : `Bonjour ${eleve.prenom}, votre examen n'a pas été validé cette fois. Ne vous découragez pas, on programme votre prochaine tentative.`,
};
