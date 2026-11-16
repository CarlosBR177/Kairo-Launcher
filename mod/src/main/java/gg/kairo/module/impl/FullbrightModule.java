package gg.kairo.module.impl;

import gg.kairo.mixin.OptionInstanceAccessor;
import gg.kairo.module.Module;
import net.minecraft.client.Minecraft;

/**
 * Brilho máximo: sobe o gama além do limite do menu enquanto ligado e devolve o valor ao desligar
 * (ou ao fechar o jogo, para o options.txt nunca guardar o valor alto).
 */
public final class FullbrightModule extends Module {
	private static final double BRIGHT = 15.0;
	private Double previous;

	public FullbrightModule() {
		super("fullbright", "Brilho máximo", "Enxerga em cavernas e à noite sem tocha.", false);
	}

	@Override
	public void tick(Minecraft mc) {
		if (!enabled) return;
		Object current = mc.options.gamma().get();
		if (current instanceof Double d && d < BRIGHT) {
			if (previous == null) previous = d;
			((OptionInstanceAccessor) (Object) mc.options.gamma()).kairo$setValue(BRIGHT);
		}
	}

	@Override
	protected void onToggle(Minecraft mc) {
		if (!enabled) restore(mc);
	}

	public void restore(Minecraft mc) {
		if (previous != null) {
			((OptionInstanceAccessor) (Object) mc.options.gamma()).kairo$setValue(previous);
			previous = null;
		}
	}
}
