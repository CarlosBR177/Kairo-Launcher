package gg.kairo.module;

import gg.kairo.compat.Gfx;
import gg.kairo.util.Render2D;
import gg.kairo.util.Theme;
import net.minecraft.client.Minecraft;

/** Módulo de uma linha no formato "RÓTULO valor", dentro de um painel. */
public abstract class TextHudModule extends HudModule {
	private static final int PAD_X = 5;
	private static final int PAD_Y = 4;

	protected TextHudModule(String id, String name, String description, boolean enabledByDefault, int x, int y) {
		super(id, name, description, enabledByDefault, x, y);
	}

	protected abstract String label();

	protected abstract String value(Minecraft mc, boolean preview);

	@Override
	public int width(Minecraft mc) {
		return mc.font.width(label() + " " + value(mc, true)) + PAD_X * 2 + 2;
	}

	@Override
	public int height(Minecraft mc) {
		return mc.font.lineHeight + PAD_Y * 2 - 1;
	}

	@Override
	public void draw(Gfx g, Minecraft mc, int x, int y, boolean preview) {
		String label = label();
		String value = value(mc, preview);
		int w = mc.font.width(label + " " + value) + PAD_X * 2 + 2;
		Render2D.panel(g, x, y, w, height(mc));
		int tx = x + PAD_X + 2;
		Render2D.text(g, mc, label, tx, y + PAD_Y, Theme.accent());
		Render2D.text(g, mc, value, tx + mc.font.width(label + " "), y + PAD_Y, Theme.TEXT);
	}
}
