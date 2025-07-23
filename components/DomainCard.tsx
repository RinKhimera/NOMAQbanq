"use client";

import {
  Activity,
  ArrowRight,
  Baby,
  Brain,
  Heart,
  Sun as Lung,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Domain } from "@/data/domains";

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
    <div className="group card-modern relative transform overflow-hidden p-8 transition-all duration-500 hover:-translate-y-3 hover:shadow-2xl">
      {/* Background gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-indigo-600/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100"></div>

      <div className="relative z-10">
        <div className="mb-6 flex items-center space-x-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl">
            <IconComponent className="h-8 w-8 text-white" />
          </div>
          <div>
            <h3 className="font-display mb-2 text-2xl font-bold transition-colors duration-300 group-hover:text-blue-600">
              {domain.title}
            </h3>
            <p className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-600">
              {domain.questionsCount} questions
            </p>
          </div>
        </div>

        <p className="mb-8 text-lg leading-relaxed text-gray-600">
          {domain.description}
        </p>

        {/* Action button */}
        <div className="translate-y-4 transform opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <Link href={`/domaines/${domain.slug}`}>
            <Button className="btn-modern w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-4 font-semibold text-white shadow-lg transition-all duration-300 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl">
              Commencer l&apos;évaluation
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-4 right-4 h-20 w-20 rounded-full bg-gradient-to-br from-blue-400/10 to-indigo-600/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"></div>
      <div
        className="absolute bottom-4 left-4 h-12 w-12 rounded-full bg-gradient-to-br from-indigo-400/10 to-purple-600/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ transitionDelay: "100ms" }}
      ></div>
    </div>
  );
}
