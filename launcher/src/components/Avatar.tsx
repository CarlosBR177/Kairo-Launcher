import { useState } from "react";

/** Cabeça da skin (API gratuita mc-heads.net) com inicial como reserva offline. */
export function Avatar({ uuid, name, size }: { uuid: string; name: string; size: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className="avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.45 }}>{name.slice(0, 1).toUpperCase()}</span>;
  }
  return <img className="avatar" width={size} height={size} src={`https://mc-heads.net/avatar/${uuid}/${size * 2}`} alt="" onError={() => setFailed(true)} />;
}
