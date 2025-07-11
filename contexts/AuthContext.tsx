"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  avatar?: string;
  createdAt: string;
  lastLogin?: string;
  subscription?: {
    type: "free" | "premium";
    expiresAt?: string;
  };
  stats?: {
    questionsAnswered: number;
    correctAnswers: number;
    averageScore: number;
    timeSpent: number; // in minutes
  };
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users database
const mockUsers: User[] = [
  {
    id: "1",
    name: "Dr. Marie Dubois",
    email: "marie.dubois@example.com",
    role: "user",
    avatar:
      "https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150",
    createdAt: "2024-01-15",
    lastLogin: "2024-12-20",
    subscription: {
      type: "premium",
      expiresAt: "2025-01-15",
    },
    stats: {
      questionsAnswered: 1250,
      correctAnswers: 1062,
      averageScore: 85,
      timeSpent: 2340,
    },
  },
  {
    id: "2",
    name: "Dr. Ahmed Benali",
    email: "ahmed.benali@example.com",
    role: "user",
    avatar:
      "https://images.pexels.com/photos/6749778/pexels-photo-6749778.jpeg?auto=compress&cs=tinysrgb&w=150",
    createdAt: "2024-02-20",
    lastLogin: "2024-12-19",
    subscription: {
      type: "free",
    },
    stats: {
      questionsAnswered: 450,
      correctAnswers: 315,
      averageScore: 70,
      timeSpent: 890,
    },
  },
  {
    id: "3",
    name: "Administrateur",
    email: "admin@nomaqbank.com",
    role: "admin",
    avatar:
      "https://images.pexels.com/photos/5327921/pexels-photo-5327921.jpeg?auto=compress&cs=tinysrgb&w=150",
    createdAt: "2024-01-01",
    lastLogin: "2024-12-20",
    subscription: {
      type: "premium",
    },
    stats: {
      questionsAnswered: 0,
      correctAnswers: 0,
      averageScore: 0,
      timeSpent: 0,
    },
  },
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for saved user in localStorage
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string): Promise<boolean> => {
    setIsLoading(true);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock authentication - accept any password for demo users
    const foundUser = mockUsers.find((u) => u.email === email);

    if (foundUser) {
      const updatedUser = {
        ...foundUser,
        lastLogin: new Date().toISOString().split("T")[0],
      };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setIsLoading(false);
      return true;
    }

    setIsLoading(false);
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, login, logout, isLoading, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
