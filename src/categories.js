const CATEGORIES = [
  'Transport & véhicules',
  'Bâtiment & réparation',
  'Maison & entretien',
  'Beauté & bien-être',
  'Couture & artisanat',
  'Éducation & cours',
  'Événements & cérémonies',
  'Digital & technologie',
  'Agriculture & artisanat rural',
  'Administratif & services pro',
  'Autre'
];

const PACKS = {
  standard: { rank: 0, label: 'Standard' },
  business: { rank: 1, label: 'Business' },
  premium: { rank: 2, label: 'Premium' },
  sponsor_cat: { rank: 3, label: 'Sponsorisé catégorie' },
  sponsor_ville: { rank: 3, label: 'Sponsorisé ville' },
  sponsor_max: { rank: 4, label: 'Sponsorisé max' }
};

const FREE_CONNEXIONS = 3;

module.exports = { CATEGORIES, PACKS, FREE_CONNEXIONS };
