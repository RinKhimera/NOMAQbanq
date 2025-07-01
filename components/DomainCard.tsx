'use client';

import Link from 'next/link';
import { Domain } from '@/data/domains';
import { Heart, Sun as Lung, Brain, Activity, Baby, Users, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const iconMap = {
  Heart,
  Lung,
  Brain,
  Activity,
  Baby,
  Users,
};

interface DomainCardProps {
  domain: Domain;
}

export default function DomainCard({ domain }: DomainCardProps) {
  const IconComponent = iconMap[domain.icon as keyof typeof iconMap];

  return (
    <div className="group relative card-modern p-8 hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3 overflow-hidden">
      {/* Background gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      
      <div className="relative z-10">
        <div className="flex items-center space-x-6 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
            <IconComponent className="h-8 w-8 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2 font-display group-hover:text-blue-600 transition-colors duration-300">{domain.title}</h3>
            <p className="text-sm text-blue-600 font-semibold bg-blue-50 px-3 py-1 rounded-full">
              {domain.questionsCount} questions
            </p>
          </div>
        </div>
        
        <p className="text-gray-600 mb-8 leading-relaxed text-lg">{domain.description}</p>
        
        {/* Action button */}
        <div className="opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
          <Link href={`/domaines/${domain.slug}`}>
            <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 btn-modern">
              Commencer l'évaluation
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-4 right-4 w-20 h-20 bg-gradient-to-br from-blue-400/10 to-indigo-600/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      <div className="absolute bottom-4 left-4 w-12 h-12 bg-gradient-to-br from-indigo-400/10 to-purple-600/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{transitionDelay: '100ms'}}></div>
    </div>
  );
}