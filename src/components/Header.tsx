'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from './LanguageContext';
import { useTheme } from './ThemeContext';
import { SEEDED_USERS, DEMO_COOKIE_NAME } from '@/lib/auth-types';

export default function Header() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  const [currentUser, setCurrentUser] = useState<string>('officer_farhan');

  useEffect(() => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${DEMO_COOKIE_NAME}=([^;]*)`));
    if (match) {
      setCurrentUser(decodeURIComponent(match[1]));
    }
  }, []);

  const handleUserChange = (username: string) => {
    setCurrentUser(username);
    document.cookie = `${DEMO_COOKIE_NAME}=${encodeURIComponent(username)}; path=/; max-age=86400`;
    window.location.reload();
  };

  const navLinks = [
    { href: '/', label: t('nav_home') },
    { href: '/dashboard', label: t('nav_dashboard') },
    { href: '/transfers/new', label: t('nav_submit') },
    { href: '/integrity', label: t('nav_integrity') },
    { href: '/demo', label: t('nav_demo') },
  ];

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-lg bg-emerald-700 dark:bg-emerald-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
                MG
              </div>
              <div>
                <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  MutationGuard
                </span>
                <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  {t('demo_badge')}
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex space-x-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Controls: Language, Theme & Demo User Switcher */}
          <div className="flex items-center space-x-3">
            {/* Demo User Switcher */}
            <div className="flex items-center space-x-1.5 text-xs bg-slate-100 dark:bg-slate-800 p-1 rounded-md border border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400 hidden sm:inline pl-1">
                {t('role_label')}
              </span>
              <select
                value={currentUser}
                onChange={(e) => handleUserChange(e.target.value)}
                className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded px-2 py-1 font-medium border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer text-xs"
              >
                {Object.values(SEEDED_USERS).map((user) => (
                  <option key={user.username} value={user.username}>
                    {user.fullName} ({user.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Toggle Language"
            >
              {language === 'bn' ? 'English' : 'বাংলা'}
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Toggle Dark Mode"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
