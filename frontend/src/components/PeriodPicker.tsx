import { useState } from "react";
import { Calendar } from "lucide-react";

interface PeriodPickerProps {
  startDate: string;
  endDate: string;
  onApply: (startDate: string, endDate: string) => void;
}

const formatPtBr = (value: string) => {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

export const PeriodPicker = ({
  startDate,
  endDate,
  onApply,
}: PeriodPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [startDraft, setStartDraft] = useState(startDate);
  const [endDraft, setEndDraft] = useState(endDate);

  const openPicker = () => {
    setStartDraft(startDate);
    setEndDraft(endDate);
    setIsOpen(true);
  };

  const applyPeriod = () => {
    if (!startDraft || !endDraft) return;
    onApply(startDraft, endDraft);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : openPicker())}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold border border-border hover:bg-secondary transition-colors"
      >
        <Calendar className="h-3.5 w-3.5" />
        {formatPtBr(startDate)} — {formatPtBr(endDate)}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-2 w-64 border border-border rounded-lg bg-card p-3 shadow-lg space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider">
                De
              </label>
              <input
                type="date"
                value={startDraft}
                onChange={(e) => setStartDraft(e.target.value)}
                className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider">
                Até
              </label>
              <input
                type="date"
                value={endDraft}
                onChange={(e) => setEndDraft(e.target.value)}
                className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={applyPeriod}
                className="px-3 py-1.5 text-xs font-bold rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Aplicar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
