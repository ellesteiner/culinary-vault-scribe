import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authClient, apiFetch } from '@/integrations/neon/client';
import { toast } from 'sonner';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
}

interface AuthUser {
  id: string;
  email: string;
}

interface WhoamiResponse {
  userId: string;
  email: string;
  profile: Profile;
  isAdmin: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: Profile | null;
  isAdmin: boolean;
  isLoading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  const sessionUser = session?.user ?? null;

  useEffect(() => {
    if (!sessionUser) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }
    setProfileLoading(true);
    apiFetch<WhoamiResponse>('/whoami')
      .then((data) => {
        setProfile(data.profile);
        setIsAdmin(data.isAdmin);
      })
      .catch((err) => {
        console.error('Failed to load profile:', err);
      })
      .finally(() => setProfileLoading(false));
  }, [sessionUser?.id]);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await authClient.signUp.email({ email, password, name: fullName });
    if (error) {
      toast.error(error.message || 'Failed to create account');
      throw error;
    }
    toast.success('Account created! Welcome to My Cookbook.');
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      toast.error(error.message || 'Failed to sign in');
      throw error;
    }
    toast.success('Welcome back!');
  };

  const signOut = async () => {
    const { error } = await authClient.signOut();
    if (error) {
      toast.error(error.message || 'Failed to sign out');
      throw error;
    }
    toast.success('Signed out');
  };

  const user: AuthUser | null = sessionUser ? { id: sessionUser.id, email: sessionUser.email } : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAdmin,
        isLoading: sessionPending || profileLoading,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
