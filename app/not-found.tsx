import Link from 'next/link';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-[#0a0618] px-4 py-16">
      <div className="glass-panel p-8 rounded-[20px] max-w-md text-center border border-white/10 shadow-2xl space-y-4">
        <div className="text-5xl font-heading font-extrabold text-cyan-400">404</div>
        <h2 className="font-heading font-bold text-xl text-white">Page Not Found</h2>
        <p className="text-xs text-slate-400">
          The requested URL does not exist on the AI Hackathon portal.
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-[10px] bg-[#6d3df5] hover:bg-[#5b2bd5] text-white text-xs font-bold flex items-center gap-2 mx-auto"
        >
          <Home className="w-4 h-4" />
          <span>Return to Homepage</span>
        </Link>
      </div>
    </div>
  );
}
