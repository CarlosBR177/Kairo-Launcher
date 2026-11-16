package gg.kairo.module;

import gg.kairo.compat.Gfx;
import net.minecraft.client.Minecraft;

/**
 * Módulo que desenha algo na tela. A posição é relativa à tela (rx, ry de 0 a 1):
 * 0 = encostado à esquerda/topo, 0.5 = centro, 1 = direita/baixo. Assim o layout
 * continua igual em qualquer resolução ou escala de GUI. Cada elemento tem seu tamanho (scale).
 */
public abstract class HudModule extends Module {
	public static final float MIN_SCALE = 0.5f;
	public static final float MAX_SCALE = 3.0f;

	/** true enquanto o editor de HUD está aberto: módulos vazios (sem poções, sem armadura) mostram exemplo. */
	public static boolean editing;

	/** Posição calculada em pixels da GUI (canto superior esquerdo). Atualizada por {@link #place}. */
	public int x;
	public int y;

	/** Posição relativa; -1 = ainda não definida (usa o padrão). */
	public double rx = -1;
	public double ry = -1;
	public float scale = 1f;

	private final int defX;
	private final int defY;
	private double defRx = -1;
	private double defRy = -1;

	protected HudModule(String id, String name, String description, boolean enabledByDefault, int x, int y) {
		super(id, name, description, enabledByDefault);
		this.x = this.defX = x;
		this.y = this.defY = y;
	}

	/** Posição padrão relativa (ex.: 1, 0 = canto superior direito) em vez de pixels. */
	protected final void defaultAnchor(double rx, double ry) {
		this.defRx = rx;
		this.defRy = ry;
	}

	/** Largura sem escala. */
	public abstract int width(Minecraft mc);

	/** Altura sem escala. */
	public abstract int height(Minecraft mc);

	/** Desenha a partir de (x, y) sem escala — quem chama aplica posição e tamanho. */
	public abstract void draw(Gfx g, Minecraft mc, int x, int y, boolean preview);

	public int scaledWidth(Minecraft mc) {
		return Math.max(1, Math.round(width(mc) * scale));
	}

	public int scaledHeight(Minecraft mc) {
		return Math.max(1, Math.round(height(mc) * scale));
	}

	/** Calcula x/y na tela atual a partir da posição relativa (ou converte o padrão em pixels). */
	public void place(int screenW, int screenH, Minecraft mc) {
		int freeW = Math.max(1, screenW - scaledWidth(mc));
		int freeH = Math.max(1, screenH - scaledHeight(mc));
		if (rx < 0 || ry < 0) {
			if (defRx >= 0) {
				rx = defRx;
				ry = defRy;
			} else {
				rx = clamp01(x / (double) freeW);
				ry = clamp01(y / (double) freeH);
			}
		}
		x = (int) Math.round(rx * freeW);
		y = (int) Math.round(ry * freeH);
	}

	/** Move o canto superior esquerdo para (px, py) e guarda como posição relativa. */
	public void moveTo(int px, int py, int screenW, int screenH, Minecraft mc) {
		int freeW = Math.max(1, screenW - scaledWidth(mc));
		int freeH = Math.max(1, screenH - scaledHeight(mc));
		rx = clamp01(px / (double) freeW);
		ry = clamp01(py / (double) freeH);
		place(screenW, screenH, mc);
	}

	public void setScale(float s) {
		scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.round(s * 20f) / 20f));
	}

	/** Volta para posição e tamanho padrão. */
	public void resetLayout() {
		rx = -1;
		ry = -1;
		x = defX;
		y = defY;
		scale = 1f;
	}

	/** Desenha com posição e escala aplicadas. */
	public void render(Gfx g, Minecraft mc, boolean preview) {
		g.push();
		g.translate(x, y);
		if (scale != 1f) g.scale(scale);
		draw(g, mc, 0, 0, preview);
		g.pop();
	}

	/** Compatibilidade: garante que está dentro da tela. */
	public void clamp(int screenW, int screenH, Minecraft mc) {
		place(screenW, screenH, mc);
	}

	private static double clamp01(double v) {
		return Double.isNaN(v) ? 0 : Math.max(0, Math.min(1, v));
	}
}
