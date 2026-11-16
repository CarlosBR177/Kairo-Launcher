package gg.kairo.module.impl;

import gg.kairo.module.Module;
import net.minecraft.client.Minecraft;

/** Aperte a tecla de agachar uma vez para ficar agachado; aperte de novo para levantar. */
public final class ToggleSneakModule extends Module {
	private boolean sneaking;

	public ToggleSneakModule() {
		super("togglesneak", "Toggle Sneak", "Agachar alterna com um toque, sem segurar Shift.", false);
	}

	@Override
	public void tick(Minecraft mc) {
		if (!enabled || mc.player == null) return;
		// cada toque físico na tecla conta um clique, mesmo com o setDown abaixo
		while (mc.options.keyShift.consumeClick()) sneaking = !sneaking;
		mc.options.keyShift.setDown(sneaking);
	}

	public boolean isSneaking() {
		return enabled && sneaking;
	}

	@Override
	protected void onToggle(Minecraft mc) {
		sneaking = false;
		if (!enabled) mc.options.keyShift.setDown(false);
	}
}
