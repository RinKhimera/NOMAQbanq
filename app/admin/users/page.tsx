"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Users,
  Search,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Crown,
  Mail,
  Download,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// Mock users data
const mockUsers = [
  {
    id: "1",
    name: "Dr. Marie Dubois",
    email: "marie.dubois@example.com",
    type: "premium",
    status: "active",
    joinDate: "2024-01-15",
    lastActive: "2024-12-20",
    questionsAnswered: 1250,
    averageScore: 85,
    avatar:
      "https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=60",
  },
  {
    id: "2",
    name: "Dr. Ahmed Benali",
    email: "ahmed.benali@example.com",
    type: "free",
    status: "active",
    joinDate: "2024-02-20",
    lastActive: "2024-12-19",
    questionsAnswered: 450,
    averageScore: 70,
    avatar:
      "https://images.pexels.com/photos/6749778/pexels-photo-6749778.jpeg?auto=compress&cs=tinysrgb&w=60",
  },
  {
    id: "3",
    name: "Dr. Sophie Tremblay",
    email: "sophie.tremblay@example.com",
    type: "premium",
    status: "inactive",
    joinDate: "2024-03-10",
    lastActive: "2024-12-18",
    questionsAnswered: 890,
    averageScore: 78,
    avatar:
      "https://images.pexels.com/photos/5452293/pexels-photo-5452293.jpeg?auto=compress&cs=tinysrgb&w=60",
  },
  {
    id: "4",
    name: "Dr. Jean-François Côté",
    email: "jf.cote@example.com",
    type: "free",
    status: "active",
    joinDate: "2024-04-05",
    lastActive: "2024-12-17",
    questionsAnswered: 320,
    averageScore: 65,
    avatar:
      "https://images.pexels.com/photos/6749777/pexels-photo-6749777.jpeg?auto=compress&cs=tinysrgb&w=60",
  },
  {
    id: "5",
    name: "Dr. Sarah Martin",
    email: "sarah.martin@example.com",
    type: "premium",
    status: "active",
    joinDate: "2024-05-12",
    lastActive: "2024-12-20",
    questionsAnswered: 2100,
    averageScore: 92,
    avatar:
      "https://images.pexels.com/photos/5327921/pexels-photo-5327921.jpeg?auto=compress&cs=tinysrgb&w=60",
  },
];

export default function UsersManagement() {
  const [users, setUsers] = useState(mockUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    type: "free",
    status: "active",
  });

  // Filter users based on search and filters
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || user.type === filterType;
    const matchesStatus =
      filterStatus === "all" || user.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  const handleAddUser = () => {
    const user = {
      id: Date.now().toString(),
      ...newUser,
      joinDate: new Date().toISOString().split("T")[0],
      lastActive: new Date().toISOString().split("T")[0],
      questionsAnswered: 0,
      averageScore: 0,
      avatar:
        "https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=60",
    };

    setUsers([...users, user]);
    setNewUser({ name: "", email: "", type: "free", status: "active" });
    setIsAddUserOpen(false);
  };

  const handleDeleteUser = (userId: string) => {
    setUsers(users.filter((user) => user.id !== userId));
  };

  const stats = [
    {
      title: "Total utilisateurs",
      value: users.length.toString(),
      icon: Users,
      color: "from-blue-500 to-indigo-600",
    },
    {
      title: "Utilisateurs Premium",
      value: users.filter((u) => u.type === "premium").length.toString(),
      icon: Crown,
      color: "from-yellow-500 to-orange-600",
    },
    {
      title: "Utilisateurs actifs",
      value: users.filter((u) => u.status === "active").length.toString(),
      icon: Users,
      color: "from-green-500 to-emerald-600",
    },
    {
      title: "Nouveaux ce mois",
      value: users
        .filter(
          (u) => new Date(u.joinDate).getMonth() === new Date().getMonth()
        )
        .length.toString(),
      icon: UserPlus,
      color: "from-purple-500 to-pink-600",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Gestion des utilisateurs
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Gérez tous les comptes utilisateurs de la plateforme
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>

          <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                <Plus className="h-4 w-4 mr-2" />
                Ajouter utilisateur
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter un nouvel utilisateur</DialogTitle>
                <DialogDescription>
                  Créez un nouveau compte utilisateur sur la plateforme.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nom complet</Label>
                  <Input
                    id="name"
                    value={newUser.name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, name: e.target.value })
                    }
                    placeholder="Dr. Jean Dupont"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser({ ...newUser, email: e.target.value })
                    }
                    placeholder="jean.dupont@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="type">Type de compte</Label>
                  <Select
                    value={newUser.type}
                    onValueChange={(value) =>
                      setNewUser({ ...newUser, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Gratuit</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Statut</Label>
                  <Select
                    value={newUser.status}
                    onValueChange={(value) =>
                      setNewUser({ ...newUser, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="inactive">Inactif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddUser} className="w-full">
                  Créer l&#39;utilisateur
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center shadow-lg`}
              >
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              {stat.title}
            </h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher par nom ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Type de compte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="free">Gratuit</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="inactive">Inactif</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Utilisateur
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Type
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Statut
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Questions
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Score moyen
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Dernière activité
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-white">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-4">
                      <Image
                        src={user.avatar}
                        alt={user.name}
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-full object-cover"
                        unoptimized
                      />
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {user.name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        user.type === "premium"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      }`}
                    >
                      {user.type === "premium" ? "Premium" : "Gratuit"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        user.status === "active"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      }`}
                    >
                      {user.status === "active" ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                    {user.questionsAnswered}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`font-semibold ${
                        user.averageScore >= 80
                          ? "text-green-600"
                          : user.averageScore >= 60
                          ? "text-blue-600"
                          : "text-orange-600"
                      }`}
                    >
                      {user.averageScore}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {new Date(user.lastActive).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="cursor-pointer">
                          <Eye className="mr-2 h-4 w-4" />
                          Voir le profil
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer">
                          <Edit className="mr-2 h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer">
                          <Mail className="mr-2 h-4 w-4" />
                          Envoyer email
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer text-red-600"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results summary */}
      <div className="text-center text-gray-600 dark:text-gray-400">
        Affichage de {filteredUsers.length} utilisateur(s) sur {users.length} au
        total
      </div>
    </div>
  );
}
