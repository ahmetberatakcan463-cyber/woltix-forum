import './globals.css';
import { Toaster } from 'react-hot-toast';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'Woltix Forum',
  description: 'Hacker community forum',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body className="bg-bg-primary text-text-primary min-h-screen flex flex-col">
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: { background: '#111', border: '1px solid #1e1e1e', color: '#e0e0e0', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' },
            success: { iconTheme: { primary: '#00ff41', secondary: '#080808' } },
            error: { iconTheme: { primary: '#ff4444', secondary: '#080808' } },
          }}
        />
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
