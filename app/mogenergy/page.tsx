import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MOG Energy | Mango Orange Guava',
  description: 'MOG Energy drink product landing page for Mango Orange Guava.',
};

const productStats = [
  ['67', 'Energy'],
  ['0', 'NPC Behavior'],
  ['16oz', 'Can'],
  ['MOG', 'Mode'],
];

const cultureTags = ['Sigma', 'MOG', 'Mewing', 'Rizz', 'Main Character', 'Brainrot', 'No NPC'];

export default function MogEnergyPage() {
  return (
    <main className="min-h-[100dvh] overflow-hidden bg-black text-white">
      <section className="relative min-h-[100dvh]">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-45"
          style={{ backgroundImage: "url('/mogenergy/mog-energy-background.png')" }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,0,128,0.35),transparent_35%),linear-gradient(90deg,rgba(0,0,0,0.92),rgba(0,0,0,0.35),rgba(0,0,0,0.92))]" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent" />

        <div className="relative z-10 mx-auto grid min-h-[100dvh] w-full max-w-7xl items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-12">
          <div className="pt-16 lg:pt-0">
            <div className="mb-5 flex flex-wrap gap-2">
              {cultureTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-fuchsia-400/35 bg-fuchsia-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-fuchsia-100 shadow-[0_0_24px_-10px_rgba(255,0,180,0.95)]"
                >
                  {tag}
                </span>
              ))}
            </div>

            <p className="mb-3 text-sm font-black uppercase tracking-[0.34em] text-lime-300 drop-shadow-[0_0_16px_rgba(163,230,53,0.7)]">
              Mind over greatness
            </p>
            <h1 className="max-w-4xl text-balance text-[clamp(4rem,13vw,10rem)] font-black uppercase leading-[0.78] tracking-[-0.09em]">
              <span className="block bg-gradient-to-br from-yellow-300 via-orange-500 to-fuchsia-500 bg-clip-text text-transparent drop-shadow-[0_0_32px_rgba(255,0,128,0.65)]">
                MOG
              </span>
              <span className="block text-[0.26em] tracking-[0.08em] text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.45)]">
                Sigma + MOG Energy
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-balance text-xl font-extrabold uppercase leading-tight text-white sm:text-2xl">
              Mango Orange Guava energy drink for main character momentum.
            </p>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/68 sm:text-lg">
              Loud flavor. Neon attitude. Built for the ones who stay focused, stay original, and refuse NPC energy.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#buy"
                className="inline-flex h-14 items-center justify-center rounded-full bg-gradient-to-r from-yellow-300 via-orange-500 to-fuchsia-500 px-8 text-base font-black uppercase tracking-wide text-black shadow-[0_0_40px_-8px_rgba(255,0,128,0.85)] transition-transform hover:scale-[1.03]"
              >
                Buy the can
              </a>
              <a
                href="#flavor"
                className="inline-flex h-14 items-center justify-center rounded-full border border-lime-300/45 bg-lime-300/10 px-8 text-base font-black uppercase tracking-wide text-lime-100 transition-colors hover:bg-lime-300/20"
              >
                Taste the chaos
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[34rem]">
            <div className="absolute inset-8 rounded-full bg-fuchsia-500/45 blur-[80px]" aria-hidden />
            <div className="absolute -left-10 top-16 h-56 w-56 rounded-full bg-orange-500/35 blur-[70px]" aria-hidden />
            <div className="absolute -right-10 bottom-20 h-52 w-52 rounded-full bg-lime-400/25 blur-[70px]" aria-hidden />
            <img
              src="/mogenergy/mog-energy-can.png"
              alt="MOG Energy Mango Orange Guava can"
              className="relative z-10 mx-auto max-h-[78dvh] w-auto object-contain drop-shadow-[0_40px_80px_rgba(0,0,0,0.9)]"
            />
          </div>
        </div>
      </section>

      <section id="flavor" className="relative border-y border-white/10 bg-[#08050b] px-5 py-20 sm:px-8 lg:px-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,0,128,0.2),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(255,128,0,0.18),transparent_38%),radial-gradient(circle_at_50%_100%,rgba(163,230,53,0.12),transparent_40%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-fuchsia-300">Flavor profile</p>
            <h2 className="mt-3 text-4xl font-black uppercase leading-none tracking-[-0.05em] sm:text-6xl">
              Mango. Orange. Guava.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {['Mango blast', 'Orange spark', 'Guava punch'].map((flavor) => (
              <div
                key={flavor}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_0_40px_-24px_rgba(255,0,128,0.9)] backdrop-blur"
              >
                <p className="text-2xl font-black uppercase text-white">{flavor}</p>
                <p className="mt-3 text-sm leading-relaxed text-white/58">
                  Bright, tropical, and chaotic in the best possible way.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-black px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {productStats.map(([value, label]) => (
              <div
                key={label}
                className="rounded-3xl border border-fuchsia-400/25 bg-gradient-to-br from-fuchsia-500/15 via-orange-500/10 to-lime-400/10 p-6 text-center"
              >
                <p className="bg-gradient-to-r from-yellow-300 via-fuchsia-400 to-lime-300 bg-clip-text text-5xl font-black text-transparent">
                  {value}
                </p>
                <p className="mt-2 text-xs font-black uppercase tracking-[0.22em] text-white/55">{label}</p>
              </div>
            ))}
          </div>

          <div id="buy" className="mt-16 rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 text-center shadow-[0_0_80px_-35px_rgba(255,0,128,0.9)] sm:p-10">
            <p className="text-sm font-black uppercase tracking-[0.28em] text-lime-300">Single product drop</p>
            <h2 className="mx-auto mt-4 max-w-4xl text-balance text-4xl font-black uppercase leading-none tracking-[-0.05em] sm:text-6xl">
              MOG Energy Mango Orange Guava
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/62 sm:text-lg">
              One can. One flavor. Maximum main character energy.
            </p>
            <button
              type="button"
              className="mt-8 inline-flex h-14 items-center justify-center rounded-full bg-gradient-to-r from-yellow-300 via-orange-500 to-fuchsia-500 px-10 text-base font-black uppercase tracking-wide text-black shadow-[0_0_40px_-8px_rgba(255,0,128,0.85)]"
            >
              Coming soon
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
