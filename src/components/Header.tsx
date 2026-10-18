'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  ClipboardList,
  FilePlus2,
  ScrollText,
  FlaskConical,
  LogIn,
  LogOut,
  User,
  Sun,
  Moon,
  Menu,
  X,
} from 'lucide-react';
import Logo from './Logo';
import { useLanguage } from './LanguageContext';
import { useTheme } from './ThemeContext';
import { SEEDED_USERS } from '@/lib/auth-types';
import { useCurrentUser } from '@/lib/use-current-user';
import { localName } from '@/lib/i18n/translations';

export default function Header() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Handle escape key to close mobile menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Session state from server
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

  // Role-aware navigation links
  const getNavLinks = () => {
    if (!sessionUser) {
      return [
        { href: '/', label: t('nav_home'), Icon: Home },
        { href: '/login', label: t('nav_login'), Icon: LogIn },
      ];
    }

    if (sessionUser.role === 'applicant') {
      return [
        { href: '/', label: t('nav_home'), Icon: Home },
        {
          href: '/dashboard',
          label: language === 'bn' ? 'আমার আবেদনসমূহ' : 'My Applications',
          Icon: ClipboardList,
        },
        { href: '/transfers/new', label: t('nav_submit'), Icon: FilePlus2 },
      ];
    }

    // Reviewer role
    const links = [
      { href: '/', label: t('nav_home'), Icon: Home },
      {
        href: '/dashboard',
        label: language === 'bn' ? 'পর্যালোচনা কিউ' : 'Review Queue',
        Icon: ClipboardList,
      },
      { href: '/integrity', label: t('nav_integrity'), Icon: ScrollText },
    ];

    if (demoMode) {
      links.push({ href: '/demo', label: t('nav_demo'), Icon: FlaskConical });
    }

    return links;
  };

  const navLinks = getNavLinks();

  // Demo user switcher options (never list the system user)
  const switcherUsers = demoMode
    ? Object.values(SEEDED_USERS).filter((u) => u.role !== 'system')
    : [];
  if (sessionUser && !switcherUsers.some((u) => u.username === sessionUser.username)) {
    switcherUsers.unshift(sessionUser);
  }

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-50 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-16 gap-3">
          {/* Left: Brand Logo (clean, no demo badge pill) */}
          <div className="flex items-center shrink-0">
            <Link href="/" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded">
              <Logo size={32} />
            </Link>
          </div>

          {/* Centre: Desktop Role-Aware Navigation */}
          <nav className="hidden lg:flex items-center h-full space-x-1" aria-label="Main Navigation">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.Icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center gap-2 h-16 px-3.5 text-sm transition-colors border-b-2 font-medium ${
                    isActive
                      ? 'text-emerald-700 dark:text-emerald-400 font-semibold border-emerald-600'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border-transparent hover:border-slate-300'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right: Language switch, Theme toggle, User chip/Login, Mobile Hamburger */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Language Segmented Control: বাং | EN */}
            <div
              className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800 text-xs"
              role="group"
              aria-label="Language selection"
            >
              <button
                type="button"
                onClick={() => setLanguage('bn')}
                aria-pressed={language === 'bn'}
                className={`px-2.5 py-1 min-h-[32px] font-medium rounded transition-colors ${
                  language === 'bn'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                বাং
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                aria-pressed={language === 'en'}
                className={`px-2.5 py-1 min-h-[32px] font-medium rounded transition-colors ${
                  language === 'en'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                EN
              </button>
            </div>

            {/* Theme Toggle (Sun / Moon) */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 min-h-[44px] min-w-[44px] rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-500" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" strokeWidth={1.75} aria-hidden="true" />
              )}
            </button>

            {/* Desktop User Session / Login Button */}
            <div className="hidden sm:flex items-center">
              {sessionUser ? (
                <div className="flex items-center gap-1.5 text-xs bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 min-h-[36px]">
                  <User className="w-3.5 h-3.5 text-slate-500 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  {demoMode ? (
                    <select
                      value={currentUsername || ''}
                      onChange={(e) => handleUserChange(e.target.value)}
                      className="bg-transparent text-slate-800 dark:text-slate-200 font-medium focus:outline-none cursor-pointer text-xs max-w-[130px] sm:max-w-[190px] truncate"
                      aria-label={t('role_label')}
                    >
                      {switcherUsers.map((u) => (
                        <option
                          key={u.username}
                          value={u.username}
                          className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        >
                          {language === 'bn' ? localName(u.fullName, 'bn') : u.fullName} (
                          {u.role === 'reviewer'
                            ? language === 'bn'
                              ? 'কর্মকর্তা'
                              : 'Reviewer'
                            : language === 'bn'
                            ? 'আবেদনকারী'
                            : 'Applicant'}
                          )
                        </option>
                      ))}
                      <option
                        value="__logout__"
                        className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      >
                        {language === 'bn' ? 'লগআউট' : 'Sign Out'}
                      </option>
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                        {language === 'bn' ? localName(sessionUser.fullName, 'bn') : sessionUser.fullName}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUserChange('__logout__')}
                        className="text-slate-500 hover:text-rose-600 transition p-1"
                        title={language === 'bn' ? 'লগআউট' : 'Sign Out'}
                        aria-label="Sign out"
                      >
                        <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <LogIn className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                  <span>{t('nav_login')}</span>
                </Link>
              )}
            </div>

            {/* Mobile Hamburger Button (Below 1024px) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 min-h-[44px] min-w-[44px] rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Menu className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer (Below 1024px) */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 space-y-2">
          {/* Role-Aware Mobile Links (44px rows) */}
          <nav className="flex flex-col space-y-1" aria-label="Mobile Navigation">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.Icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 font-semibold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0 text-emerald-700 dark:text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Mobile User / Auth Section */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            {sessionUser ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 py-1">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                    <span>{language === 'bn' ? 'বর্তমান ব্যবহারকারী:' : 'Signed in as:'}</span>
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {language === 'bn' ? localName(sessionUser.fullName, 'bn') : sessionUser.fullName}
                  </span>
                </div>

                {demoMode && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      {language === 'bn' ? 'ব্যবহারকারী পরিবর্তন (ডেমো)' : 'Switch User (Demo)'}
                    </label>
                    <select
                      value={currentUsername || ''}
                      onChange={(e) => handleUserChange(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                    >
                      {switcherUsers.map((u) => (
                        <option key={u.username} value={u.username}>
                          {language === 'bn' ? localName(u.fullName, 'bn') : u.fullName} (
                          {u.role === 'reviewer'
                            ? language === 'bn'
                              ? 'কর্মকর্তা'
                              : 'Reviewer'
                            : language === 'bn'
                            ? 'আবেদনকারী'
                            : 'Applicant'}
                          )
                        </option>
                      ))}
                      <option value="__logout__">{language === 'bn' ? 'লগআউট' : 'Sign Out'}</option>
                    </select>
                  </div>
                )}

                {!demoMode && (
                  <button
                    type="button"
                    onClick={() => handleUserChange('__logout__')}
                    className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 transition"
                  >
                    <LogOut className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                    <span>{language === 'bn' ? 'লগআউট' : 'Sign Out'}</span>
                  </button>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition"
              >
                <LogIn className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                <span>{t('nav_login')}</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
