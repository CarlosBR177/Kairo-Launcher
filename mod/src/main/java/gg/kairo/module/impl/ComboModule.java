package gg.kairo.module.impl;

import gg.kairo.compat.Compat;
import gg.kairo.compat.Gfx;
import com.google.gson.JsonObject;
import gg.kairo.config.Opt;
import gg.kairo.module.HudModule;
import gg.kairo.util.Render2D;
import gg.kairo.util.Theme;
import net.minecraft.client.Minecraft;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

/**
 * Combo (hits seguidos sem levar dano) e a distância do último hit.
 * Só mede e mostra: não altera alcance nem ataque.
 */
public final class ComboModule extends HudModule {
	private static final int PAD_X = 5;
	private static final int PAD_Y = 4;
	private static final long COMBO_TIMEOUT = 2500;

	private int combo;
	private double lastReach = -1;
	private long lastHit;
	private int lastTargetId = -1;
	private int prevHurtTime;

	private boolean showCombo = true;
	private boolean showReach = true;

	public ComboModule() {
		super("combo", "Combo e distância", "Hits seguidos e a distância do último hit (só mostra).", true, 4, 58);
		defaultAnchor(0.5, 0.58);
	}

	public void onAttack(Minecraft mc, Entity target) {
		if (mc.player == null) return;
		long now = Compat.millis();
		combo = target.getId() == lastTargetId && now - lastHit < COMBO_TIMEOUT ? combo + 1 : 1;
		lastTargetId = target.getId();
		lastHit = now;
		lastReach = distanceToBox(mc.player.getEyePosition(), target.getBoundingBox());
	}

	private static double distanceToBox(Vec3 p, AABB b) {
		double dx = Math.max(Math.max(b.minX - p.x, 0), p.x - b.maxX);
		double dy = Math.max(Math.max(b.minY - p.y, 0), p.y - b.maxY);
		double dz = Math.max(Math.max(b.minZ - p.z, 0), p.z - b.maxZ);
		return Math.sqrt(dx * dx + dy * dy + dz * dz);
	}

	@Override
	public void tick(Minecraft mc) {
		if (mc.player == null) {
			combo = 0;
			return;
		}
		int hurt = mc.player.hurtTime;
		if (hurt > prevHurtTime) combo = 0; // levou dano: combo quebra
		prevHurtTime = hurt;
		if (combo > 0 && Compat.millis() - lastHit > COMBO_TIMEOUT) combo = 0;
	}

	private String text(boolean preview) {
		StringBuilder sb = new StringBuilder();
		int c = preview && combo == 0 ? 4 : combo;
		double r = preview && lastReach < 0 ? 2.87 : lastReach;
		if (showCombo) sb.append("Combo ").append(c);
		if (showReach) {
			if (!sb.isEmpty()) sb.append("  ");
			sb.append(r < 0 ? "-" : String.format("%.2fm", r));
		}
		return sb.toString();
	}

	@Override
	public int width(Minecraft mc) {
		return mc.font.width(text(true)) + PAD_X * 2 + 2;
	}

	@Override
	public int height(Minecraft mc) {
		return mc.font.lineHeight + PAD_Y * 2 - 1;
	}

	@Override
	public void draw(Gfx g, Minecraft mc, int x, int y, boolean preview) {
		String t = text(preview);
		Render2D.panel(g, x, y, mc.font.width(t) + PAD_X * 2 + 2, height(mc));
		int tx = x + PAD_X + 2;
		if (showCombo) {
			Render2D.text(g, mc, "Combo", tx, y + PAD_Y, Theme.accent());
			tx += mc.font.width("Combo ");
			String rest = t.substring("Combo ".length());
			Render2D.text(g, mc, rest, tx, y + PAD_Y, Theme.TEXT);
		} else {
			Render2D.text(g, mc, t, tx, y + PAD_Y, Theme.TEXT);
		}
	}

	@Override
	public void readOptions(JsonObject o) {
		showCombo = Opt.b(o, "showCombo", showCombo);
		showReach = Opt.b(o, "showReach", showReach);
		if (!showCombo && !showReach) showCombo = true;
	}

	@Override
	public void writeOptions(JsonObject o) {
		o.addProperty("showCombo", showCombo);
		o.addProperty("showReach", showReach);
	}
}
