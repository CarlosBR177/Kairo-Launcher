package gg.kairo.module.impl;

import gg.kairo.module.TextHudModule;
import gg.kairo.util.FrameStats;
import net.minecraft.client.Minecraft;

public final class FpsModule extends TextHudModule {
	public FpsModule() {
		super("fps", "FPS", "Mostra os quadros por segundo.", true, 4, 4);
	}

	@Override
	protected String label() {
		return "FPS";
	}

	@Override
	protected String value(Minecraft mc, boolean preview) {
		int fps = FrameStats.fps();
		return String.valueOf(preview && fps == 0 ? 144 : fps);
	}
}
