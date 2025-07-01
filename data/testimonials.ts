export interface Testimonial {
  id: string;
  name: string;
  role: string;
  avatar: string;
  content: string;
  rating: number;
}

export const testimonials: Testimonial[] = [
  {
    id: '1',
    name: 'Dr. Marie Dubois',
    role: 'Résidente en médecine interne, Montréal',
    avatar: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150',
    content: 'NOMAQbank m\'a permis de réussir l\'EACMC du premier coup ! Les questions sont très représentatives de l\'examen et les explications détaillées m\'ont aidée à combler mes lacunes. Je recommande vivement cette plateforme à tous les candidats francophones.',
    rating: 5
  },
  {
    id: '2',
    name: 'Dr. Ahmed Benali',
    role: 'Diplômé international, Ottawa',
    avatar: 'https://images.pexels.com/photos/6749778/pexels-photo-6749778.jpeg?auto=compress&cs=tinysrgb&w=150',
    content: 'En tant que diplômé international, j\'avais besoin d\'une préparation adaptée au contexte canadien. Cette plateforme m\'a donné la confiance nécessaire pour réussir. L\'interface est intuitive et le contenu de qualité exceptionnelle.',
    rating: 5
  },
  {
    id: '3',
    name: 'Dr. Sophie Tremblay',
    role: 'Médecin de famille, Québec',
    avatar: 'https://images.pexels.com/photos/5452293/pexels-photo-5452293.jpeg?auto=compress&cs=tinysrgb&w=150',
    content: 'J\'étais vraiment inquiète d\'utiliser une application en ligne que je ne connaissais pas. Cependant, après avoir essayé NOMAQbank, j\'ai pu apprendre les bases en environ 10 minutes. La banque de questions est très simple et facile à utiliser.',
    rating: 5
  },
  {
    id: '4',
    name: 'Dr. Jean-François Côté',
    role: 'Résident en chirurgie, Sherbrooke',
    avatar: 'https://images.pexels.com/photos/6749777/pexels-photo-6749777.jpeg?auto=compress&cs=tinysrgb&w=150',
    content: 'La qualité des questions et des explications est remarquable. NOMAQbank m\'a aidé à identifier mes points faibles et à les améliorer systématiquement. C\'est un outil indispensable pour la préparation à l\'EACMC.',
    rating: 5
  }
];