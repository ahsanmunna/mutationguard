'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from './LanguageContext';
import { useTheme } from './ThemeContext';
import { SEEDED_USERS } from '@/lib/auth-types';
import { useCurrentUser } from '@/lib/use-current-user';
import { localName } from '@/lib/i18n/translations';

export default function Header() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  // Who is logged in comes from the server (signed httpOnly session cookie).
  const { user: sessionUser, demoMode } = useCurrentUser(pathname);
  const currentUsername = sessionUser?.username ?? null;

  const handleUserChange = async (username: string) => {
    if (username === '__logout__') {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
      return;
    }

    await fetch('/api/auth/demo-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    window.location.reload();
  };

  const navLinks = [
    { href: '/', label: t('nav_home'), icon: '🏠' },
    { href: '/dashboard', label: t('nav_dashboard'), icon: '📋' },
    { href: '/transfers/new', label: t('nav_submit'), icon: '➕' },
    { href: '/integrity', label: t('nav_integrity'), icon: '🛡️' },
    { href: '/demo', label: t('nav_demo'), icon: '🎮' },
  ];

  const currentUserObj = sessionUser;

  // The one-click persona switcher only exists in demo mode (and never lists the system user).
  // Outside demo mode the menu shows just the current user and "Sign Out".
  const switcherUsers = demoMode ? Object.values(SEEDED_USERS).filter((u) => u.role !== 'system') : [];
  if (currentUserObj && !switcherUsers.some((u) => u.username === currentUserObj.username)) {
    switcherUsers.unshift(currentUserObj);
  }

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-2">
          {/* Logo & Title */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-700 dark:bg-emerald-600 flex items-center justify-center text-white font-bold text-lg sm:text-xl shadow-md">
                MG
              </div>
              <div>
                <span className="text-sm sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight block leading-tight">
                  {language === 'bn' ? 'মিউটেশনগার্ড' : 'MutationGuard'}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hidden sm:inline-block">
                  {t('demo_badge')}
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex space-x-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Controls: User Switcher / Login, Language, Theme */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {/* User Session Switcher or Login button */}
            {currentUserObj ? (
              <div className="flex items-center space-x-1 text-xs bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 hidden xl:inline pl-1">
                  👤
                </span>
                <select
                  value={currentUsername || ''}
                  onChange={(e) => handleUserChange(e.target.value)}
                  className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg px-2 py-1.5 font-semibold border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer text-xs max-w-[125px] sm:max-w-[200px] truncate min-h-[36px]"
                  aria-label={t('role_label')}
                >
                  {switcherUsers.map((user) => (
                    <option key={user.username} value={user.username}>
                      {language === 'bn' ? localName(user.fullName, 'bn') : user.fullName} (
                      {user.role === 'reviewer'
                        ? language === 'bn'
                          ? 'কর্মকর্তা'
                          : 'Reviewer'
                        : language === 'bn'
                        ? 'আবেদনকারী'
                        : 'Applicant'}
                      )
                    </option>
                  ))}
                  <option value="__logout__">
                    🚪 {language === 'bn' ? 'লগআউট' : 'Sign Out'}
                  </option>
                </select>
              </div>
            ) : (
              <Link
                href="/login"
                className="min-h-[44px] inline-flex items-center px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm"
              >
                {language === 'bn' ? 'লগইন →' : 'Sign In →'}
              </Link>
            )}

            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
              className="min-h-[44px] min-w-[44px] px-2.5 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center"
              title="Toggle Language / ভাষা পরিবর্তন"
              aria-label="Toggle Language"
            >
              {language === 'bn' ? 'ENG' : 'বাংলা'}
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="min-h-[44px] min-w-[44px] p-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center"
              title="Toggle Dark Mode"
              aria-label="Toggle Dark Mode"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar (visible on screens below md) */}
        <div className="flex md:hidden overflow-x-auto py-2 gap-1.5 border-t border-slate-100 dark:border-slate-800/80 -mx-1 px-1 scrollbar-none text-xs">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`min-h-[36px] px-2.5 py-1.5 rounded-lg whitespace-nowrap font-medium transition inline-flex items-center gap-1 ${
                  isActive
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
