interface DifferenceCardProps {
  label: string;
  value: number;
  unit: string;
  color: 'cyan' | 'purple' | 'green' | 'red';
  showSign?: boolean;
}

const colorMap = {
  cyan: 'border-cyan-800/50 bg-cyan-900/20 text-cyan-300',
  purple: 'border-purple-800/50 bg-purple-900/20 text-purple-300',
  green: 'border-green-800/50 bg-green-900/20 text-green-300',
  red: 'border-red-800/50 bg-red-900/20 text-red-300',
};

export function DifferenceCard({ label, value, unit, color, showSign }: DifferenceCardProps) {
  const sign = showSign && value > 0 ? '+' : '';

  return (
    <div className={`rounded-lg border p-3 ${colorMap[color]}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-60">{label}</p>
      <p className="mt-1 text-xl font-bold">
        {sign}{value.toFixed(2)}
      </p>
      <p className="text-[10px] opacity-50">{unit}</p>
    </div>
  );
}
