"use client"

import {
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Stethoscope,
  Twitter,
} from "lucide-react"
import Link from "next/link"

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
          {/* Logo and description */}
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="mb-8 flex items-center space-x-3">
              <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-3 shadow-lg">
                <Stethoscope className="h-8 w-8 text-white" />
              </div>
              <span className="font-display text-2xl font-bold">NOMAQbanq</span>
            </Link>
            <p className="text-body mb-8 max-w-md leading-relaxed text-gray-300">
              La première plateforme francophone de préparation à l&apos;EACMC
              Partie I. Votre succès commence ici.
            </p>
            <div className="flex space-x-4">
              {[Facebook, Twitter, Linkedin, Instagram].map((Icon, index) => (
                <a
                  key={index}
                  href="#"
                  className="flex h-12 w-12 transform items-center justify-center rounded-2xl bg-gray-800 transition-all duration-300 hover:scale-110 hover:bg-gradient-to-br hover:from-blue-600 hover:to-indigo-600"
                >
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-display mb-8 text-lg font-semibold">
              Liens rapides
            </h3>
            <ul className="space-y-4">
              {[
                { name: "Accueil", href: "/" },
                { name: "Domaines", href: "/domaines" },
                { name: "Évaluation", href: "/evaluation" },
                { name: "À propos", href: "/a-propos" },
                { name: "Tarifs", href: "#" },
                { name: "FAQ", href: "#" },
              ].map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-gray-300 underline-offset-4 transition-colors duration-200 hover:text-blue-400 hover:underline"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-display mb-8 text-lg font-semibold">Contact</h3>
            <ul className="space-y-6">
              <li className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20">
                  <Mail className="h-5 w-5 text-blue-400" />
                </div>
                <span className="text-gray-300">contact@nomaqbanq.ca</span>
              </li>
              <li className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20">
                  <Phone className="h-5 w-5 text-blue-400" />
                </div>
                <span className="text-gray-300">+1 (514) 123-4567</span>
              </li>
              <li className="flex items-start space-x-3">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20">
                  <MapPin className="h-5 w-5 text-blue-400" />
                </div>
                <span className="text-gray-300">
                  Montréal, QC
                  <br />
                  Canada
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-center justify-between border-t border-gray-800 pt-8 md:flex-row">
          <p className="text-sm text-gray-400">
            © 2024 NOMAQbanq. Tous droits réservés.
          </p>
          <div className="mt-4 flex space-x-8 md:mt-0">
            {[
              "Politique de confidentialité",
              "Conditions d'utilisation",
              "Mentions légales",
            ].map((link) => (
              <a
                key={link}
                href="#"
                className="text-sm text-gray-400 underline-offset-4 transition-colors duration-200 hover:text-blue-400 hover:underline"
              >
                {link}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
