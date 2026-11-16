package gg.kairo.compat;

import net.minecraft.client.gui.Font;
import net.minecraft.world.item.ItemStack;
//? if >=26.1 {
import net.minecraft.client.gui.GuiGraphicsExtractor;
//?} else {
/*import net.minecraft.client.gui.GuiGraphics;
*///?}

/**
 * Envelope do objeto de desenho do jogo. Os módulos só falam com esta classe,
 * então a diferença entre versões (GuiGraphics nas 1.21.x, GuiGraphicsExtractor na 26.x)
 * fica toda aqui.
 */
public final class Gfx {
	//? if >=26.1 {
	public final GuiGraphicsExtractor raw;

	public Gfx(GuiGraphicsExtractor raw) {
		this.raw = raw;
	}
	//?} else {
	/*public final GuiGraphics raw;

	public Gfx(GuiGraphics raw) {
		this.raw = raw;
	}
	*///?}

	/** Retângulo preenchido de (x1, y1) até (x2, y2), cor ARGB. */
	public void fill(int x1, int y1, int x2, int y2, int color) {
		raw.fill(x1, y1, x2, y2, color);
	}

	public void text(Font font, String s, int x, int y, int color, boolean shadow) {
		//? if >=26.1 {
		raw.text(font, s, x, y, color, shadow);
		//?} else {
		/*raw.drawString(font, s, x, y, color, shadow);
		*///?}
	}

	/** Ícone do item (16×16). */
	public void item(ItemStack stack, int x, int y) {
		//? if >=26.1 {
		raw.item(stack, x, y);
		//?} else {
		/*raw.renderItem(stack, x, y);
		*///?}
	}

	/** Barra de durabilidade e contador do item, como na hotbar. */
	public void itemDecorations(Font font, ItemStack stack, int x, int y) {
		//? if >=26.1 {
		raw.itemDecorations(font, stack, x, y);
		//?} else {
		/*raw.renderItemDecorations(font, stack, x, y);
		*///?}
	}

	// ---------- transformações (posição/tamanho dos elementos da HUD) ----------
	// 1.21.6+: pose() é um Matrix3x2fStack (2D). Antes: PoseStack (3D).

	public void push() {
		//? if >=1.21.6 {
		raw.pose().pushMatrix();
		//?} else {
		/*raw.pose().pushPose();
		*///?}
	}

	public void pop() {
		//? if >=1.21.6 {
		raw.pose().popMatrix();
		//?} else {
		/*raw.pose().popPose();
		*///?}
	}

	public void translate(float x, float y) {
		//? if >=1.21.6 {
		raw.pose().translate(x, y);
		//?} else {
		/*raw.pose().translate(x, y, 0f);
		*///?}
	}

	public void scale(float s) {
		//? if >=1.21.6 {
		raw.pose().scale(s, s);
		//?} else {
		/*raw.pose().scale(s, s, 1f);
		*///?}
	}

	/** Contorno de 1 px (feito com fill, igual em todas as versões). */
	public void outline(int x, int y, int w, int h, int color) {
		fill(x, y, x + w, y + 1, color);
		fill(x, y + h - 1, x + w, y + h, color);
		fill(x, y + 1, x + 1, y + h - 1, color);
		fill(x + w - 1, y + 1, x + w, y + h - 1, color);
	}
}
