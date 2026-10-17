// Alerta sonora de la central (WebAudio, sin archivos de audio).
// Se activa con la primera interacción del usuario (política del navegador).

let ctx: AudioContext | null = null;

export function playAlarm(): void {
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    if (ctx.state === "suspended") void ctx.resume();

    const now = ctx.currentTime;
    // Doble tono de sirena: 660 Hz / 880 Hz
    [0, 0.26, 0.52].forEach((t, i) => {
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = i % 2 === 0 ? 660 : 880;
      gain.gain.setValueAtTime(0.0001, now + t);
      gain.gain.exponentialRampToValueAtTime(0.16, now + t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.24);
    });
  } catch {
    /* audio no disponible */
  }
}

/** Desbloquea el audio con un gesto del usuario */
export function primeAudio(): void {
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* ignorar */
  }
}
