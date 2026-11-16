import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { useStore } from "../store";

export function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.kind === "ok" ? <CheckCircle2 size={16} /> : t.kind === "error" ? <TriangleAlert size={16} /> : <Info size={16} />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
