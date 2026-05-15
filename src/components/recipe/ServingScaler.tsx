import { useState } from 'react';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ServingScalerProps {
  originalServings: string | null;
  multiplier: number;
  onChange: (multiplier: number) => void;
}

const PRESETS: Array<{ label: string; value: number }> = [
  { label: '½×', value: 0.5 },
  { label: '1×', value: 1 },
  { label: '2×', value: 2 },
  { label: '3×', value: 3 },
];

export function ServingScaler({ originalServings, multiplier, onChange }: ServingScalerProps) {
  const [custom, setCustom] = useState('');

  const handleCustom = (raw: string) => {
    setCustom(raw);
    const n = parseFloat(raw);
    if (isFinite(n) && n > 0 && n <= 100) onChange(n);
  };

  return (
    <div className="bg-muted/30 border border-border rounded-xl p-4 mb-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>
            Original: <span className="text-foreground font-medium">{originalServings || '1 serving'}</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => {
            const active = multiplier === p.value;
            return (
              <Button
                key={p.label}
                type="button"
                size="sm"
                variant={active ? 'default' : 'outline'}
                onClick={() => {
                  onChange(p.value);
                  setCustom('');
                }}
                className={`min-h-[44px] min-w-[44px] px-3 ${active ? 'btn-cookbook' : ''}`}
                aria-pressed={active}
              >
                {p.label}
              </Button>
            );
          })}
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              inputMode="decimal"
              min={0.1}
              max={100}
              step={0.5}
              value={custom}
              onChange={(e) => handleCustom(e.target.value)}
              placeholder="Custom"
              className="w-24 h-11"
              aria-label="Custom multiplier"
            />
            <span className="text-sm text-muted-foreground">×</span>
          </div>
        </div>

        {multiplier !== 1 && (
          <span className="text-sm text-primary font-medium">
            Scaled to {multiplier}× original
          </span>
        )}
      </div>
    </div>
  );
}
