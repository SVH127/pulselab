import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { dataClient } from '@/api/dataClient';
import { appParams } from '@/lib/app-params';
import { firebaseAuth, googleProvider, isFirebaseConfigured } from '@/api/firebaseClient';
import { supabase, isSupabaseConfigured } from '@/api/supabaseClient';

const AuthContext = createContext();
const GOOGLE_SCRIPT_ID = 'google-identity-services';

const loadGoogleScript = () =>
  new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve(window.google);
      return;
    }

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.google), { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = reject;
    document.head.appendChild(script);
  });

const decodeGoogleCredential = (credential) => {
  const [, payload] = credential.split('.');
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
};

const getRoleForEmail = (email) => {
  const adminEmails = appParams.adminEmails
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(email.toLowerCase()) ? 'admin' : 'student';
};

const isConfiguredAdmin = (email) => getRoleForEmail(email) === 'admin';

const buildUserFromGoogleProfile = async (profile) => {
  const email = profile.email.trim().toLowerCase();
  const uid = profile.uid || profile.sub || profile.id;
  let existingUser = null;
  let pendingUser = null;

  if (uid) {
    existingUser = await dataClient.entities.User.get(uid).catch(() => null);
  }

  if (!existingUser) {
    const existingUsers = await dataClient.entities.User.filter({ email }).catch(() => []);
    existingUser = existingUsers[0] || null;
  }

  pendingUser = await dataClient.entities.PendingUser.get(email).catch(() => null);

  if (!existingUser && !pendingUser && !isConfiguredAdmin(email)) {
    const error = new Error('User is not registered');
    error.type = 'user_not_registered';
    throw error;
  }

  if (existingUser?.is_active === false || pendingUser?.is_active === false) {
    const error = new Error('User is inactive');
    error.type = 'user_not_registered';
    throw error;
  }

  const nextUser = {
    id: existingUser?.id || uid || email,
    email,
    full_name:
      existingUser?.full_name ||
      pendingUser?.full_name ||
      profile.displayName ||
      profile.user_metadata?.full_name ||
      profile.name ||
      email,
    name:
      profile.displayName ||
      profile.user_metadata?.full_name ||
      profile.name ||
      existingUser?.full_name ||
      email,
    picture:
      profile.photoURL ||
      profile.user_metadata?.avatar_url ||
      profile.picture,
    role: existingUser?.role || pendingUser?.role || getRoleForEmail(email),
    is_active: existingUser?.is_active !== false,
    provider: 'google',
  };

  await dataClient.entities.User.create(nextUser);

  await dataClient.auth.setSession(nextUser);
  return nextUser;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [authError, setAuthError] = useState(null);

  const googleClientId = appParams.googleClientId;

  useEffect(() => {
    // 1. Si Supabase Auth está configurado, escuchar cambios de sesión de Supabase
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session?.user) {
          await checkUserAuth();
          return;
        }
        try {
          setIsLoadingAuth(true);
          const nextUser = await buildUserFromGoogleProfile(session.user);
          setUser(nextUser);
          setIsAuthenticated(true);
          setAuthError(null);
        } catch (error) {
          setUser(null);
          setIsAuthenticated(false);
          setAuthError({
            type: error.type || 'auth_error',
            message: error.message || 'No se pudo iniciar sesión',
          });
        } finally {
          setIsLoadingAuth(false);
        }
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!session?.user) return;
        try {
          const nextUser = await buildUserFromGoogleProfile(session.user);
          setUser(nextUser);
          setIsAuthenticated(true);
          setAuthError(null);
        } catch (error) {
          setUser(null);
          setIsAuthenticated(false);
          setAuthError({
            type: error.type || 'auth_error',
            message: error.message || 'No se pudo iniciar sesión',
          });
        }
      });

      return () => subscription.unsubscribe();
    }

    // 2. Si Firebase Auth está configurado
    if (!isFirebaseConfigured) {
      checkUserAuth();
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      try {
        setIsLoadingAuth(true);
        if (!firebaseUser) {
          setUser(null);
          setIsAuthenticated(false);
          setAuthError(null);
          localStorage.removeItem('virtual_beat_user');
          return;
        }

        const nextUser = await buildUserFromGoogleProfile(firebaseUser);
        setUser(nextUser);
        setIsAuthenticated(true);
        setAuthError(null);
      } catch (error) {
        setUser(null);
        setIsAuthenticated(false);
        setAuthError({
          type: error.type || 'auth_error',
          message: error.message || 'No se pudo iniciar sesión',
        });
      } finally {
        setIsLoadingAuth(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured || isFirebaseConfigured) {
      setIsGoogleReady(true);
      return;
    }

    if (!googleClientId) {
      setIsGoogleReady(false);
      return;
    }

    loadGoogleScript()
      .then((google) => {
        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredential,
        });
        setIsGoogleReady(true);
      })
      .catch((error) => {
        console.error('Google login failed to load:', error);
        setAuthError({
          type: 'google_unavailable',
          message: 'Google login could not be loaded',
        });
      });
  }, [googleClientId]);

  const handleGoogleCredential = async ({ credential }) => {
    try {
      const profile = decodeGoogleCredential(credential);
      const nextUser = await buildUserFromGoogleProfile(profile);
      setUser(nextUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({
        type: error.type || 'auth_error',
        message: error.message || 'No se pudo iniciar sesión',
      });
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await dataClient.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const signInWithGoogle = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      return;
    }

    if (isFirebaseConfigured) {
      await signInWithPopup(firebaseAuth, googleProvider);
      return;
    }

    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    }
  };

  const renderGoogleButton = (element, options = {}) => {
    if (isSupabaseConfigured || isFirebaseConfigured || !window.google?.accounts?.id || !element) return;

    window.google.accounts.id.renderButton(element, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      ...options,
    });
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut().catch(() => null);
    } else if (isFirebaseConfigured) {
      await signOut(firebaseAuth);
    } else if (user?.email && window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
    await dataClient.auth.logout();
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  const value = useMemo(() => ({
    user,
    isAuthenticated,
    isLoadingAuth,
    isLoadingPublicSettings: false,
    isGoogleReady,
    authError,
    appPublicSettings: null,
    authChecked: !isLoadingAuth,
    googleClientId,
    isFirebaseConfigured,
    isSupabaseConfigured,
    logout,
    navigateToLogin,
    checkUserAuth,
    renderGoogleButton,
    signInWithGoogle,
    promptGoogleLogin: signInWithGoogle,
  }), [user, isAuthenticated, isLoadingAuth, isGoogleReady, authError, googleClientId]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
