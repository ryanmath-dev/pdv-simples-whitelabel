/** Página placeholder para seções implementadas em fases posteriores. */
export function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h2 className="text-2xl font-semibold text-slate-700">{title}</h2>
      <p className="text-slate-500">Em construção — {phase}.</p>
    </div>
  );
}
