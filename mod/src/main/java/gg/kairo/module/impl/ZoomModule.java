package gg.kairo.module.impl;

import gg.kairo.KairoClient;
import gg.kairo.compat.Compat;
import gg.kairo.module.Module;
import net.minecraft.client.Minecraft;
import net.minecraft.util.Mth;

/** Zoom suave segurando C; a rodinha do mouse ajusta o nível. Mixins: Camera/GameRenderer e MouseHandler. */
public final class ZoomModule extends Module {
	public static boolean zooming;
	private static double level = 4.0;
	private static double current = 1.0;
	private static long last;
	private static boolean moduleOn = true;

	public ZoomModule() {
		super("zoom", "Zoom", "Segure C para dar zoom; role o mouse para ajustar.", true);
	}

	@Override
	public void tick(Minecraft mc) {
		moduleOn = enabled;
		boolean wants = enabled && mc.player != null && KairoClient.keyZoom.isDown();
		if (zooming && !wants) level = 4.0; // volta ao padrão ao soltar
		zooming = wants;
	}

	/** Chamado a cada frame pelo cálculo de FOV da câmera. */
	public static float applyFov(float fov) {
		long now = Compat.millis();
		double dt = last == 0 ? 0 : Math.min(0.1, (now - last) / 1000.0);
		last = now;
		double target = moduleOn && zooming ? level : 1.0;
		current += (target - current) * (1.0 - Math.exp(-dt * 14.0));
		if (Math.abs(current - target) < 0.001) current = target;
		return (float) (fov / current);
	}

	/** Divisor atual (1 = sem zoom). Usado para baixar a sensibilidade do mouse. */
	public static double divisor() {
		return current;
	}

	/** @return true se a rolagem foi usada pelo zoom. */
	public static boolean onScroll(int delta) {
		if (!zooming || delta == 0) return false;
		level = Mth.clamp(level * (delta > 0 ? 1.25 : 0.8), 1.5, 50.0);
		return true;
	}
}
