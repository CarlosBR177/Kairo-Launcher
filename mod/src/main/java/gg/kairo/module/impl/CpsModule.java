package gg.kairo.module.impl;

import gg.kairo.module.TextHudModule;
import gg.kairo.util.FrameStats;
import net.minecraft.client.Minecraft;

public final class CpsModule extends TextHudModule {
	public CpsModule() {
		super("cps", "CPS", "Cliques por segundo (esquerdo | direito).", true, 4, 22);
	}

	@Override
	protected String label() {
		return "CPS";
	}

	@Override
	protected String value(Minecraft mc, boolean preview) {
		return FrameStats.leftCps() + " | " + FrameStats.rightCps();
	}
}
