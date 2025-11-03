import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { requireAuth } from '../utils/authManager';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check authentication first
    requireAuth();
    router.replace('/setup');
  }, [router]);

  return (
    <div style={{ 
      textAlign: 'center', 
      padding: '4rem',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <p>Redirecting...</p>
    </div>
  );
}
