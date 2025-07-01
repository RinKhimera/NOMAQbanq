export interface Question {
  id: string;
  imageSrc: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  domain: string;
}

export const mockQuestions: Question[] = [
  {
    id: '1',
    imageSrc: 'https://images.pexels.com/photos/4386466/pexels-photo-4386466.jpeg?auto=compress&cs=tinysrgb&w=600',
    question: 'Un patient de 65 ans présente une douleur thoracique constrictive irradiant vers le bras gauche depuis 2 heures. L\'ECG montre des ondes Q en D2, D3 et aVF. Quel est le diagnostic le plus probable ?',
    options: [
      'Infarctus du myocarde antérieur',
      'Infarctus du myocarde inférieur',
      'Péricardite aiguë',
      'Embolie pulmonaire'
    ],
    correctAnswer: 1,
    explanation: 'Les ondes Q en D2, D3 et aVF sont caractéristiques d\'un infarctus du myocarde de la face inférieure, généralement causé par une occlusion de l\'artère coronaire droite.',
    domain: 'cardiologie'
  }
];