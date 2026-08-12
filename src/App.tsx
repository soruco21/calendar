/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { ClientInterface } from './components/ClientInterface';
import { AdminInterface } from './components/AdminInterface';

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      setIsAdmin(window.location.hash === '#karolt');
    };
    
    // Check initially
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (isAdmin) {
    return <AdminInterface onLogout={() => {
      window.location.hash = '';
    }} />;
  }

  return (
    <ClientInterface />
  );
}

