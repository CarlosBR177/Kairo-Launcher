package gg.kairo.util;

import gg.kairo.compat.Gfx;
import net.minecraft.client.Minecraft;
import net.minecraft.world.item.ItemStack;

/**
 * Atalhos de desenho com o visual do Kairo.
 * Se algum nome da API de desenho mudar numa versão nova do jogo, o ajuste fica só aqui.
 */
public final class Render2D {
	private Render2D() {}

	/** Painel translúcido com uma barra de destaque à esquerda. */
	public static void panel(Gfx g, int x, int y, int w, int h) {
		g.fill(x, y, x + w, y + h, Theme.PANEL);
		g.fill(x, y, x + 2, y + h, Theme.accent());
	}

	public static void text(Gfx g, Minecraft mc, String s, int x, int y, int color) {
		g.text(mc.font, s, x, y, color, true);
	}

	public static void centered(Gfx g, Minecraft mc, String s, int cx, int y, int color) {
		g.text(mc.font, s, cx - mc.font.width(s) / 2, y, color, true);
	}

	/** Ícone do item (16×16). */
	public static void item(Gfx g, ItemStack stack, int x, int y) {
		g.item(stack, x, y);
	}

	/** Barra de durabilidade e contador do item, como na hotbar. */
	public static void itemDecorations(Gfx g, Minecraft mc, ItemStack stack, int x, int y) {
		g.itemDecorations(mc.font, stack, x, y);
	}

	/** Retângulo preenchido a partir de um ponto e tamanho. */
	public static void rect(Gfx g, int x, int y, int w, int h, int color) {
		g.fill(x, y, x + w, y + h, color);
	}

	/** Anel aproximado por pixels (usado na mira em círculo). */
	public static void ring(Gfx g, int cx, int cy, int radius, int thickness, int color) {
		int outer = radius * radius;
		int innerR = Math.max(0, radius - thickness);
		int inner = innerR * innerR;
		for (int dy = -radius; dy <= radius; dy++) {
			for (int dx = -radius; dx <= radius; dx++) {
				int d = dx * dx + dy * dy;
				if (d <= outer && d > inner) g.fill(cx + dx, cy + dy, cx + dx + 1, cy + dy + 1, color);
			}
		}
	}

	/** Cor da durabilidade: verde → amarelo → vermelho. */
	public static int durabilityColor(float fraction) {
		fraction = Math.max(0f, Math.min(1f, fraction));
		if (fraction > 0.5f) return Theme.mix(0xFFFFD84D, 0xFF3DFFA2, (fraction - 0.5f) * 2f);
		return Theme.mix(0xFFFF5470, 0xFFFFD84D, fraction * 2f);
	}
}
