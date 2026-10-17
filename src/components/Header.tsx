'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLanguage } from './LanguageContext';
import { useTheme } from './ThemeContext';
import { SEEDED_USERS, DEMO_COOKIE_NAME } from '@/lib/auth-types';
import { localName } from '@/lib/i18n/translations';

export default function Header() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  const [currentUsername, setCurrentUsername] = useState<string | null>(null);

  useEffect(() => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${DEMO_COOKIE_NAME}=([^;]*)`));
    if (match && match[1]) {
      setCurrentUsername(decodeURIComponent(match[1]));
    } else {
      setCurrentUsername(null);
    }
  }, [pathname]);

  const handleUserChange = async (username: string) => {
    if (username === '__logout__') {
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUsername(null);
      window.location.href = '/login';
      return;
    }

    await fetch('/api/auth/demo-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    setCurrentUsername(username);
    window.location.reload();
  };

  const navLinks = [
    { href: '/', label: t('nav_home') },
    { href: '/dashboard', label: t('nav_dashboard') },
    { href: '/transfers/new', label: t('nav_submit') },
    { href: '/integrity', label: t('nav_integrity') },
    { href: '/demo', label: t('nav_demo') },
  ];

  const currentUserObj = currentUsername ? SEEDED_USERS[currentUsername] : null;

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-700 dark:bg-emerald-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
                MG
              </div>
              <div>
                <span className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {language === 'bn' ? 'মিউটেশনগার্ড' : 'MutationGuard'}
                </span>
                <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
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
                  className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
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

          {/* Controls: User Switcher / Login, Language, Theme */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* User Session Switcher or Login button */}
            {currentUserObj ? (
              <div className="flex items-center space-x-1.5 text-xs bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 hidden lg:inline pl-1">
                  👤
                </span>
                <select
                  value={currentUsername || ''}
                  onChange={(e) => handleUserChange(e.target.value)}
                  className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg px-2 py-1 font-semibold border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer text-xs"
                >
                  {Object.values(SEEDED_USERS).map((user) => (
                    <option key={user.username} value={user.username}>
                      {language === 'bn' ? localName(user.fullName, 'bn') : user.fullName} (
                      {user.role === 'reviewer' ? (language === 'bn' ? 'কর্মকর্তা' : 'Reviewer') : (language === 'bn' ? 'আবেদনকারী' : 'Applicant')}
                      )
                    </option>
                  ))}
                  <option value="__logout__">🚪 {language === 'bn' ? 'লগআউট' : 'Sign Out'}</option>
                </select>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm"
              >
                {language === 'bn' ? 'লগইন করুন →' : 'Sign In →'}
              </Link>
            )}

            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
              className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Toggle Language"
            >
              {language === 'bn' ? 'ENG' : 'বাংলা'}
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
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
