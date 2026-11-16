package gg.kairo.hud;

import gg.kairo.compat.Gfx;
import gg.kairo.module.HudModule;
import gg.kairo.module.ModuleManager;
import gg.kairo.util.FrameStats;
import net.minecraft.client.Minecraft;

public final class HudRenderer {
	private HudRenderer() {}

	/** Chamado uma vez por frame pela camada de HUD registrada em KairoClient. */
	public static void render(Gfx g) {
		Minecraft mc = Minecraft.getInstance();
		FrameStats.frame(mc);
		if (mc.options.hideGui) return;

		int sw = mc.getWindow().getGuiScaledWidth();
		int sh = mc.getWindow().getGuiScaledHeight();
		for (HudModule m : ModuleManager.hud()) {
			if (!m.enabled) continue;
			m.place(sw, sh, mc);
			m.render(g, mc, false);
		}
	}
}
