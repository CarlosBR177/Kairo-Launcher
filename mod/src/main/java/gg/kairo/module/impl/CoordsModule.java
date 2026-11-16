package gg.kairo.module.impl;

import gg.kairo.compat.Gfx;
import gg.kairo.module.HudModule;
import gg.kairo.util.Render2D;
import gg.kairo.util.Theme;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.core.Direction;

public final class CoordsModule extends HudModule {
	private static final int PAD = 5;

	public CoordsModule() {
		super("coords", "Coordenadas", "Posição X/Y/Z e para onde você está olhando.", true, 4, 80);
	}

	private String[] lines(Minecraft mc) {
		LocalPlayer p = mc.player;
		if (p == null) return new String[] {"X 128.5", "Y 64", "Z -42.0", "Norte (-Z)"};
		return new String[] {
				String.format("X %.1f", p.getX()),
				String.format("Y %d", (int) Math.floor(p.getY())),
				String.format("Z %.1f", p.getZ()),
				facing(p.getDirection())
		};
	}

	private static String facing(Direction d) {
		return switch (d) {
			case NORTH -> "Norte (-Z)";
			case SOUTH -> "Sul (+Z)";
			case EAST -> "Leste (+X)";
			case WEST -> "Oeste (-X)";
			default -> d.getName();
		};
	}

	@Override
	public int width(Minecraft mc) {
		int w = 0;
		for (String s : lines(mc)) w = Math.max(w, mc.font.width(s));
		return Math.max(w, 64) + PAD * 2 + 2;
	}

	@Override
	public int height(Minecraft mc) {
		return 4 * (mc.font.lineHeight + 1) + PAD * 2 - 2;
	}

	@Override
	public void draw(Gfx g, Minecraft mc, int x, int y, boolean preview) {
		Render2D.panel(g, x, y, width(mc), height(mc));
		String[] lines = lines(mc);
		int ty = y + PAD;
		for (int i = 0; i < lines.length; i++) {
			String line = lines[i];
			int tx = x + PAD + 2;
			if (i < 3) {
				Render2D.text(g, mc, line.substring(0, 1), tx, ty, Theme.accent());
				Render2D.text(g, mc, line.substring(1), tx + mc.font.width("X"), ty, Theme.TEXT);
			} else {
				Render2D.text(g, mc, line, tx, ty, Theme.MUTED);
			}
			ty += mc.font.lineHeight + 1;
		}
	}
}
