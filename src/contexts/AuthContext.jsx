import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    
    // Flag to prevent race conditions between getSession and onAuthStateChange
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        // 1. Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (session?.user) {
          if (isMounted) await fetchProfile(session.user);
        } else {
          // No session found
          if (isMounted) {
             setUser(null);
             setLoading(false);
          }
        }
      } catch (error) {
        console.error("Auth init error:", error);
        if (isMounted) {
            setUser(null);
            setLoading(false);
        }
      }
    };

    initializeAuth();

    // 2. Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      // Handle specific events
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      } else if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        // Only fetch profile if we don't have the user or if it's a fresh sign-in
        await fetchProfile(session.user);
      } else if (event === 'INITIAL_SESSION') {
        // This event runs on startup. If session is null here, we are done loading.
        if (!session) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      mounted.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (authUser) => {
    if (!mounted.current) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) throw error;

      if (mounted.current) {
        const userData = {
          id: authUser.id,
          email: authUser.email,
          name: data?.name || authUser.email.split('@')[0],
          role: data?.role || 'seller' 
        };
        setUser(userData);
      }
    } catch (error) {
      console.error("Profile fetch error:", error);
      // Even if profile fetch fails, we allow login with basic auth data
      if (mounted.current) {
        setUser({
          id: authUser.id,
          email: authUser.email,
          name: authUser.email.split('@')[0],
          role: 'seller'
        });
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      if (mounted.current) setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const value = {
    user,
    loading,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};