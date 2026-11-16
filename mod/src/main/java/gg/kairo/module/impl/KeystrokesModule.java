package gg.kairo.module.impl;

import gg.kairo.compat.Compat;
import gg.kairo.compat.Gfx;
import gg.kairo.module.HudModule;
import gg.kairo.util.FrameStats;
import gg.kairo.util.Render2D;
import gg.kairo.util.Theme;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;

/** WASD + mouse + espaço, com animação suave ao pressionar. */
public final class KeystrokesModule extends HudModule {
	private static final int KEY = 22;
	private static final int GAP = 2;
	private static final int MOUSE_H = 18;
	private static final int SPACE_H = 10;

	// brilho atual de cada tecla (0..1): W A S D LMB RMB SPACE
	private final float[] glow = new float[7];
	private long lastFrame;

	public KeystrokesModule() {
		super("keystrokes", "Keystrokes", "Mostra WASD, cliques e espaço na tela.", true, 4, 136);
		defaultAnchor(1.0, 1.0);
	}

	@Override
	public int width(Minecraft mc) {
		return KEY * 3 + GAP * 2;
	}

	@Override
	public int height(Minecraft mc) {
		return KEY * 2 + MOUSE_H + SPACE_H + GAP * 3;
	}

	@Override
	public void draw(Gfx g, Minecraft mc, int x, int y, boolean preview) {
		long now = Compat.millis();
		float dt = lastFrame == 0 ? 0 : Math.min(0.1f, (now - lastFrame) / 1000f);
		lastFrame = now;

		KeyMapping[] keys = {
				mc.options.keyUp, mc.options.keyLeft, mc.options.keyDown, mc.options.keyRight,
				mc.options.keyAttack, mc.options.keyUse, mc.options.keyJump
		};
		for (int i = 0; i < keys.length; i++) {
			float target = keys[i].isDown() ? 1f : 0f;
			glow[i] += (target - glow[i]) * (1f - (float) Math.exp(-dt * 18f));
		}

		int row2 = y + KEY + GAP;
		int row3 = row2 + KEY + GAP;
		int row4 = row3 + MOUSE_H + GAP;
		int half = (width(mc) - GAP) / 2;

		key(g, mc, x + KEY + GAP, y, KEY, KEY, "W", glow[0]);
		key(g, mc, x, row2, KEY, KEY, "A", glow[1]);
		key(g, mc, x + KEY + GAP, row2, KEY, KEY, "S", glow[2]);
		key(g, mc, x + (KEY + GAP) * 2, row2, KEY, KEY, "D", glow[3]);
		key(g, mc, x, row3, half, MOUSE_H, FrameStats.leftCps() + " CPS", glow[4]);
		key(g, mc, x + half + GAP, row3, width(mc) - half - GAP, MOUSE_H, FrameStats.rightCps() + " CPS", glow[5]);

		int spaceColor = Theme.mix(Theme.KEY_IDLE, Theme.withAlpha(Theme.accent(), 0xE6), glow[6]);
		g.fill(x, row4, x + width(mc), row4 + SPACE_H, spaceColor);
		int barW = 18;
		int bx = x + (width(mc) - barW) / 2;
		g.fill(bx, row4 + SPACE_H / 2, bx + barW, row4 + SPACE_H / 2 + 1, Theme.TEXT);
	}

	private static void key(Gfx g, Minecraft mc, int x, int y, int w, int h, String label, float t) {
		int bg = Theme.mix(Theme.KEY_IDLE, Theme.withAlpha(Theme.accent(), 0xE6), t);
		g.fill(x, y, x + w, y + h, bg);
		int fg = Theme.mix(Theme.TEXT, 0xFF0A0C14, t * 0.85f);
		Render2D.centered(g, mc, label, x + w / 2, y + (h - mc.font.lineHeight) / 2 + 1, fg);
	}
}
