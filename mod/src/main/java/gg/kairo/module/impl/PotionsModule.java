package gg.kairo.module.impl;

import gg.kairo.compat.Gfx;
import com.google.gson.JsonObject;
import gg.kairo.config.Opt;
import gg.kairo.module.HudModule;
import gg.kairo.util.Render2D;
import gg.kairo.util.Theme;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.Minecraft;
import net.minecraft.world.effect.MobEffectInstance;

/** Efeitos ativos (força, velocidade, resistência ao fogo…) com o tempo restante. */
public final class PotionsModule extends HudModule {
	private static final int PAD = 5;
	private static final String[] ROMAN = {"", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"};

	private boolean blinkWhenEnding = true;

	public PotionsModule() {
		super("potions", "Efeitos de poção", "Efeitos ativos com o tempo que falta.", true, 4, 100);
		defaultAnchor(1.0, 0.0);
	}

	private record Line(String name, String time, int color, boolean ending) {}

	private List<Line> lines(Minecraft mc) {
		List<Line> out = new ArrayList<>();
		if (mc.player == null || (editing && mc.player.getActiveEffects().isEmpty())) {
			out.add(new Line("Força II", "1:24", 0xFFFFC700, false));
			out.add(new Line("Velocidade II", "0:07", 0xFF33EBFF, true));
			return out;
		}
		for (MobEffectInstance e : mc.player.getActiveEffects()) {
			String name = e.getEffect().value().getDisplayName().getString();
			int level = e.getAmplifier() + 1;
			if (level > 1) name += " " + (level < ROMAN.length ? ROMAN[level] : String.valueOf(level));
			String time;
			boolean ending = false;
			if (e.isInfiniteDuration()) {
				time = "∞";
			} else {
				int secs = e.getDuration() / 20;
				time = secs / 60 + ":" + String.format("%02d", secs % 60);
				ending = secs <= 10;
			}
			out.add(new Line(name, time, 0xFF000000 | e.getEffect().value().getColor(), ending));
		}
		return out;
	}

	@Override
	public int width(Minecraft mc) {
		int w = mc.font.width("Velocidade II 0:00");
		for (Line l : lines(mc)) w = Math.max(w, mc.font.width(l.name() + "  " + l.time()));
		return w + PAD * 2 + 4;
	}

	@Override
	public int height(Minecraft mc) {
		int n = lines(mc).size();
		return n == 0 ? 0 : n * (mc.font.lineHeight + 2) + PAD * 2 - 2;
	}

	@Override
	public void draw(Gfx g, Minecraft mc, int x, int y, boolean preview) {
		List<Line> lines = lines(mc);
		if (lines.isEmpty()) return;
		int w = width(mc);
		Render2D.panel(g, x, y, w, height(mc));
		int ty = y + PAD;
		boolean blinkOff = blinkWhenEnding && (System.currentTimeMillis() / 400) % 2 == 0;
		for (Line l : lines) {
			Render2D.rect(g, x + PAD, ty + 1, 2, mc.font.lineHeight - 2, l.color());
			Render2D.text(g, mc, l.name(), x + PAD + 5, ty, Theme.TEXT);
			int timeColor = l.ending() && blinkOff ? 0xFFFF5470 : Theme.MUTED;
			Render2D.text(g, mc, l.time(), x + w - PAD - mc.font.width(l.time()), ty, timeColor);
			ty += mc.font.lineHeight + 2;
		}
	}

	@Override
	public void readOptions(JsonObject o) {
		blinkWhenEnding = Opt.b(o, "blink", blinkWhenEnding);
	}

	@Override
	public void writeOptions(JsonObject o) {
		o.addProperty("blink", blinkWhenEnding);
	}
}
