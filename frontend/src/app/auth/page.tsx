'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import AuthModal from '@/components/AuthModal';

export default function AuthPage() {
  const { user } = useAuth();
  const router   = useRouter();

  useEffect(() => {
    if (user) router.replace('/profile');
  }, [user, router]);

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
      <AuthModal onClose={() => router.push('/')} />
    </div>
  );
}
