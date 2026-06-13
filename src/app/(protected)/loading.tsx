export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--background)]">
      {/* Glow ring behind cat */}
      <div className="relative">
        <div
          className="absolute inset-0 rounded-full blur-3xl opacity-20 animate-pulse"
          style={{ background: 'radial-gradient(circle, #dc2626 0%, transparent 70%)', transform: 'scale(1.8)' }}
        />
        <img
          src="/devil-cat.png"
          alt="Loading"
          className="cat-animate relative z-10"
          style={{ width: 200, height: 200, objectFit: 'contain' }}
        />
      </div>

      {/* Dots */}
      <div className="dot-pulse flex items-center gap-2 mt-8">
        <span className="block w-2 h-2 rounded-full bg-[var(--primary)]" />
        <span className="block w-2 h-2 rounded-full bg-[var(--primary)]" />
        <span className="block w-2 h-2 rounded-full bg-[var(--primary)]" />
      </div>
    </div>
  );
}
