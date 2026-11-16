package gg.kairo.module.impl;

import gg.kairo.compat.Gfx;
import com.google.gson.JsonObject;
import gg.kairo.config.Opt;
import gg.kairo.module.Module;
import gg.kairo.util.Render2D;
import gg.kairo.util.Theme;
import net.minecraft.client.Minecraft;

/**
 * Mira personalizada no lugar da vanilla (ver KairoClient: replaceElement do CROSSHAIR).
 * Estilos: cross (com espaço no meio), plus (fechada), dot, circle, t (sem a haste de cima).
 */
public final class CrosshairModule extends Module {
	public String style = "cross";
	public int size = 5;
	public int gap = 2;
	public int thickness = 1;
	public String color = "accent";
	public boolean outline = true;
	public boolean dot = false;
	public boolean attackIndicator = true;

	public CrosshairModule() {
		super("crosshair", "Mira personalizada", "Troca a mira: estilo, tamanho, espaço, espessura e cor.", false);
	}

	/** Desenha a mira centrada. Chamado no lugar do elemento vanilla. */
	public void render(Gfx g, Minecraft mc) {
		if (!mc.options.getCameraType().isFirstPerson()) return;
		int cx = mc.getWindow().getGuiScaledWidth() / 2;
		int cy = mc.getWindow().getGuiScaledHeight() / 2;
		int c = Opt.color(color, Theme.accent());
		if (outline) shape(g, cx, cy, 0xC0000000, 1);
		shape(g, cx, cy, c, 0);

		if (attackIndicator && mc.player != null) {
			float s = mc.player.getAttackStrengthScale(0f);
			if (s < 1f) {
				int w = 16;
				int y = cy + size + gap + 4;
				Render2D.rect(g, cx - w / 2, y, w, 2, 0x80000000);
				Render2D.rect(g, cx - w / 2, y, Math.round(w * s), 2, c);
			}
		}
	}

	/** grow = 1 desenha o contorno (cada retângulo 1 px maior em volta). */
	private void shape(Gfx g, int cx, int cy, int col, int grow) {
		int t = thickness;
		int h = t / 2;
		switch (style) {
			case "dot" -> box(g, cx - h - 1, cy - h - 1, t + 2, t + 2, col, grow);
			case "circle" -> {
				Render2D.ring(g, cx, cy, size + grow, t + grow * 2, col);
				if (dot) box(g, cx - h, cy - h, t, t, col, grow);
			}
			default -> {
				int sp = style.equals("plus") ? 0 : gap;
				box(g, cx - sp - size, cy - h, size, t, col, grow); // esquerda
				box(g, cx + sp + (sp == 0 ? t - h : 1), cy - h, size, t, col, grow); // direita
				box(g, cx - h, cy + sp + (sp == 0 ? t - h : 1), t, size, col, grow); // baixo
				if (!style.equals("t")) box(g, cx - h, cy - sp - size, t, size, col, grow); // cima
				if (sp == 0 || dot) box(g, cx - h, cy - h, t, t, col, grow); // centro
			}
		}
	}

	private static void box(Gfx g, int x, int y, int w, int hgt, int col, int grow) {
		Render2D.rect(g, x - grow, y - grow, w + grow * 2, hgt + grow * 2, col);
	}

	@Override
	public void readOptions(JsonObject o) {
		style = Opt.s(o, "style", style);
		size = Opt.i(o, "size", size, 1, 16);
		gap = Opt.i(o, "gap", gap, 0, 8);
		thickness = Opt.i(o, "thickness", thickness, 1, 4);
		color = Opt.s(o, "color", color);
		outline = Opt.b(o, "outline", outline);
		dot = Opt.b(o, "dot", dot);
		attackIndicator = Opt.b(o, "attackIndicator", attackIndicator);
	}

	@Override
	public void writeOptions(JsonObject o) {
		o.addProperty("style", style);
		o.addProperty("size", size);
		o.addProperty("gap", gap);
		o.addProperty("thickness", thickness);
		o.addProperty("color", color);
		o.addProperty("outline", outline);
		o.addProperty("dot", dot);
		o.addProperty("attackIndicator", attackIndicator);
	}
}
