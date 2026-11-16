package gg.kairo.module.impl;

import gg.kairo.module.Module;
import net.minecraft.client.Minecraft;

/** Mantém a corrida sempre ativa enquanto o módulo estiver ligado. */
public final class ToggleSprintModule extends Module {
	public ToggleSprintModule() {
		super("togglesprint", "Auto Sprint", "Corre automaticamente, sem segurar Ctrl.", false);
	}

	@Override
	public void tick(Minecraft mc) {
		if (enabled && mc.player != null) {
			mc.options.keySprint.setDown(true);
		}
	}

	@Override
	protected void onToggle(Minecraft mc) {
		if (!enabled) mc.options.keySprint.setDown(false);
	}
}
