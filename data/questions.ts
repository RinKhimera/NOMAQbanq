export interface Question {
  id: string;
  imageSrc: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  domain: string;
  difficulty: 'Débutant' | 'Intermédiaire' | 'Avancé';
  tags: string[];
}

export const mockQuestions: Question[] = [
  {
    id: '1',
    imageSrc: 'https://images.pexels.com/photos/4386466/pexels-photo-4386466.jpeg?auto=compress&cs=tinysrgb&w=600',
    question: 'Un patient de 65 ans présente une douleur thoracique constrictive irradiant vers le bras gauche depuis 2 heures. L\'ECG montre des ondes Q en D2, D3 et aVF avec sus-décalage du segment ST. Quel est le diagnostic le plus probable ?',
    options: [
      'Infarctus du myocarde antérieur',
      'Infarctus du myocarde inférieur',
      'Péricardite aiguë',
      'Embolie pulmonaire'
    ],
    correctAnswer: 1,
    explanation: 'Les ondes Q en D2, D3 et aVF avec sus-décalage du segment ST sont caractéristiques d\'un infarctus du myocarde de la face inférieure (STEMI inférieur), généralement causé par une occlusion de l\'artère coronaire droite ou de l\'artère circonflexe.',
    domain: 'cardiologie',
    difficulty: 'Intermédiaire',
    tags: ['ECG', 'STEMI', 'Urgence cardiologique']
  },
  {
    id: '2',
    imageSrc: 'https://images.pexels.com/photos/4386467/pexels-photo-4386467.jpeg?auto=compress&cs=tinysrgb&w=600',
    question: 'Une femme de 28 ans enceinte de 32 semaines présente une dyspnée d\'effort progressive, des œdèmes des membres inférieurs et une orthopnée. L\'échocardiographie révèle une fraction d\'éjection à 35%. Quel est le diagnostic le plus probable ?',
    options: [
      'Cardiomyopathie du péripartum',
      'Embolie pulmonaire',
      'Prééclampsie',
      'Anémie physiologique de la grossesse'
    ],
    correctAnswer: 0,
    explanation: 'La cardiomyopathie du péripartum est une forme d\'insuffisance cardiaque qui survient pendant le dernier mois de grossesse ou dans les 5 mois suivant l\'accouchement, caractérisée par une dysfonction systolique du ventricule gauche (FEVG < 45%).',
    domain: 'cardiologie',
    difficulty: 'Avancé',
    tags: ['Grossesse', 'Insuffisance cardiaque', 'Cardiomyopathie']
  },
  {
    id: '3',
    imageSrc: 'https://images.pexels.com/photos/4386468/pexels-photo-4386468.jpeg?auto=compress&cs=tinysrgb&w=600',
    question: 'Un patient de 45 ans consulte pour une toux sèche persistante depuis 6 semaines, accompagnée de dyspnée d\'effort et de fièvre vespérale. La radiographie thoracique montre des opacités réticulonodulaires bilatérales. Quel examen complémentaire est le plus approprié en première intention ?',
    options: [
      'Scanner thoracique haute résolution',
      'Fibroscopie bronchique avec lavage bronchoalvéolaire',
      'Test à la tuberculine',
      'Recherche de BK dans les crachats'
    ],
    correctAnswer: 3,
    explanation: 'Devant un tableau clinique évocateur de tuberculose pulmonaire (toux persistante, fièvre vespérale, opacités réticulonodulaires), la recherche de BK dans les crachats (examen direct et culture) est l\'examen de première intention le plus approprié.',
    domain: 'pneumologie',
    difficulty: 'Intermédiaire',
    tags: ['Tuberculose', 'Toux chronique', 'Radiologie thoracique']
  },
  {
    id: '4',
    imageSrc: 'https://images.pexels.com/photos/4386469/pexels-photo-4386469.jpeg?auto=compress&cs=tinysrgb&w=600',
    question: 'Un enfant de 3 ans présente depuis 48h une fièvre élevée (39,5°C), un refus alimentaire et une hypersalivation. L\'examen révèle une dysphagie importante et un trismus. Quel est le diagnostic le plus probable ?',
    options: [
      'Angine streptococcique',
      'Épiglottite aiguë',
      'Laryngite sous-glottique',
      'Abcès rétropharyngé'
    ],
    correctAnswer: 1,
    explanation: 'L\'épiglottite aiguë se caractérise par une fièvre élevée, une dysphagie importante, une hypersalivation et un trismus chez l\'enfant. C\'est une urgence ORL nécessitant une prise en charge immédiate en raison du risque d\'obstruction des voies aériennes.',
    domain: 'pediatrie',
    difficulty: 'Avancé',
    tags: ['Urgence pédiatrique', 'ORL', 'Obstruction respiratoire']
  },
  {
    id: '5',
    imageSrc: 'https://images.pexels.com/photos/4386470/pexels-photo-4386470.jpeg?auto=compress&cs=tinysrgb&w=600',
    question: 'Un patient de 70 ans diabétique de type 2 présente des troubles de la marche avec instabilité, des troubles cognitifs légers et une incontinence urinaire d\'apparition progressive sur 6 mois. L\'IRM cérébrale montre une dilatation ventriculaire. Quel est le diagnostic le plus probable ?',
    options: [
      'Maladie d\'Alzheimer',
      'Hydrocéphalie à pression normale',
      'Maladie de Parkinson',
      'Démence vasculaire'
    ],
    correctAnswer: 1,
    explanation: 'L\'hydrocéphalie à pression normale se caractérise par la triade de Hakim : troubles de la marche (apraxie de la marche), troubles cognitifs et incontinence urinaire, associés à une dilatation ventriculaire à l\'imagerie. Elle est plus fréquente chez le sujet âgé.',
    domain: 'neurologie',
    difficulty: 'Avancé',
    tags: ['Triade de Hakim', 'Hydrocéphalie', 'Troubles cognitifs']
  }
];