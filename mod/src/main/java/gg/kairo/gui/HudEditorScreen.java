package gg.kairo.gui;

import gg.kairo.compat.Compat;
import gg.kairo.compat.Gfx;
import gg.kairo.config.KairoConfig;
import gg.kairo.module.HudModule;
import gg.kairo.module.ModuleManager;
import gg.kairo.util.Render2D;
import gg.kairo.util.Theme;
import java.util.List;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.Tooltip;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
//? if >=26.1 {
import net.minecraft.client.gui.GuiGraphicsExtractor;
//?} else {
/*import net.minecraft.client.gui.GuiGraphics;
*///?}
//? if >=1.21.9 {
import net.minecraft.client.input.MouseButtonEvent;
//?}

/**
 * Editor de HUD (tecla H ou "Editar HUD" no menu do Kairo).
 * Clique seleciona · arraste move · rodinha ou alça do canto redimensiona.
 * Barra de ferramentas: tamanho, posições rápidas (cantos, centro), ocultar e redefinir.
 */
public final class HudEditorScreen extends Screen {
	private static final int SNAP = 6;
	private static final int MARGIN = 4;
	private static final int HANDLE = 6;
	private static final int BTN_H = 18;
	private static final int GAP = 3;

	private final Screen parent;
	private HudModule selected;
	private HudModule dragging;
	private boolean resizing;
	private int offX;
	private int offY;
	private boolean snapX;
	private boolean snapY;

	public HudEditorScreen(Screen parent) {
		super(Component.literal("Editar HUD"));
		this.parent = parent;
	}

	// ---------- barra de ferramentas ----------

	@Override
	protected void init() {
		HudModule.editing = true;
		placeAll();
		boolean top = selected != null && selected.y + selected.scaledHeight(this.minecraft) / 2 > this.height / 2;
		int rows = selected != null ? 3 : 1;
		int y0 = top ? 22 : this.height - rows * (BTN_H + GAP) - 4;
		int cx = this.width / 2;

		if (selected != null) {
			HudModule m = selected;
			// linha 1: tamanho + ocultar + redefinir este
			int w1 = 20 + GAP + 48 + GAP + 20 + GAP * 3 + 64 + GAP + 64;
			int x = cx - w1 / 2;
			add(Button.builder(Component.literal("−"), b -> resize(m, m.scale - 0.1f)).bounds(x, y0, 20, BTN_H)
					.tooltip(Tooltip.create(Component.literal("Diminuir (ou role o mouse sobre o elemento)"))).build());
			x += 20 + GAP;
			add(Button.builder(Component.literal(Math.round(m.scale * 100) + "%"), b -> resize(m, 1f)).bounds(x, y0, 48, BTN_H)
					.tooltip(Tooltip.create(Component.literal("Clique para voltar a 100%"))).build());
			x += 48 + GAP;
			add(Button.builder(Component.literal("+"), b -> resize(m, m.scale + 0.1f)).bounds(x, y0, 20, BTN_H)
					.tooltip(Tooltip.create(Component.literal("Aumentar (ou arraste a alça no canto)"))).build());
			x += 20 + GAP * 3;
			add(Button.builder(Component.literal(m.enabled ? "Ocultar" : "Mostrar"), b -> {
				m.toggle();
				this.rebuildWidgets();
			}).bounds(x, y0, 64, BTN_H).build());
			x += 64 + GAP;
			add(Button.builder(Component.literal("Redefinir"), b -> {
				m.resetLayout();
				this.rebuildWidgets();
			}).bounds(x, y0, 64, BTN_H).tooltip(Tooltip.create(Component.literal("Posição e tamanho padrão deste elemento"))).build());

			// linha 2: posições rápidas (cantos, bordas e centro)
			String[] icons = {"↖", "↑", "↗", "←", "•", "→", "↙", "↓", "↘"};
			String[] tips = {"Canto superior esquerdo", "Topo, centralizado", "Canto superior direito",
					"Esquerda, no meio", "Centro da tela", "Direita, no meio",
					"Canto inferior esquerdo", "Embaixo, centralizado", "Canto inferior direito"};
			int bw = 22;
			int w2 = 9 * bw + 8 * GAP;
			int y1 = y0 + BTN_H + GAP;
			for (int i = 0; i < 9; i++) {
				final int col = i % 3;
				final int row = i / 3;
				add(Button.builder(Component.literal(icons[i]), b -> snapTo(m, col, row))
						.bounds(cx - w2 / 2 + i * (bw + GAP), y1, bw, BTN_H)
						.tooltip(Tooltip.create(Component.literal(tips[i]))).build());
			}
		}

		// última linha: redefinir tudo + concluir
		int yl = y0 + (rows - 1) * (BTN_H + GAP);
		add(Button.builder(Component.literal("Redefinir tudo"), b -> {
			for (HudModule h : ModuleManager.hud()) h.resetLayout();
			selected = null;
			this.rebuildWidgets();
		}).bounds(cx - 102, yl, 100, BTN_H).build());
		add(Button.builder(Component.literal("Concluir"), b -> this.onClose()).bounds(cx + 2, yl, 100, BTN_H).build());
	}

	private void add(Button b) {
		this.addRenderableWidget(b);
	}

	private void placeAll() {
		for (HudModule m : ModuleManager.hud()) m.place(this.width, this.height, this.minecraft);
	}

	/** Muda o tamanho mantendo o canto superior esquerdo no lugar. */
	private void resize(HudModule m, float scale) {
		int px = m.x;
		int py = m.y;
		m.setScale(scale);
		m.moveTo(px, py, this.width, this.height, this.minecraft);
		this.rebuildWidgets();
	}

	/** col/row: 0 = esquerda/topo, 1 = centro, 2 = direita/baixo. */
	private void snapTo(HudModule m, int col, int row) {
		int w = m.scaledWidth(this.minecraft);
		int h = m.scaledHeight(this.minecraft);
		int px = col == 0 ? MARGIN : col == 1 ? (this.width - w) / 2 : this.width - w - MARGIN;
		int py = row == 0 ? MARGIN : row == 1 ? (this.height - h) / 2 : this.height - h - MARGIN;
		m.moveTo(px, py, this.width, this.height, this.minecraft);
		this.rebuildWidgets();
	}

	// ---------- desenho ----------

	//? if >=26.1 {
	@Override
	public void extractRenderState(GuiGraphicsExtractor raw, int mouseX, int mouseY, float delta) {
		super.extractRenderState(raw, mouseX, mouseY, delta);
		Gfx g = new Gfx(raw);
		drawHud(g, mouseX, mouseY);
		drawHelp(g);
	}
	//?} else {
	/*@Override
	public void render(GuiGraphics raw, int mouseX, int mouseY, float delta) {
		super.render(raw, mouseX, mouseY, delta);
		Gfx g = new Gfx(raw);
		drawHud(g, mouseX, mouseY);
		drawHelp(g);
	}
	*///?}

	private void drawHud(Gfx g, int mouseX, int mouseY) {
		updateDrag(mouseX, mouseY);

		// guias centrais (mais fortes quando o elemento encaixou no centro)
		g.fill(this.width / 2, 0, this.width / 2 + 1, this.height, snapX ? Theme.withAlpha(Theme.accent(), 0xAA) : 0x18FFFFFF);
		g.fill(0, this.height / 2, this.width, this.height / 2 + 1, snapY ? Theme.withAlpha(Theme.accent(), 0xAA) : 0x18FFFFFF);

		List<HudModule> hud = ModuleManager.hud();
		for (HudModule m : hud) {
			m.place(this.width, this.height, this.minecraft);
			int w = m.scaledWidth(this.minecraft);
			int h = m.scaledHeight(this.minecraft);
			boolean hover = inside(m, mouseX, mouseY);
			if (m.enabled) {
				m.render(g, this.minecraft, true);
			} else {
				// oculto: só a moldura e o nome, para poder mostrar de novo
				g.fill(m.x, m.y, m.x + w, m.y + h, 0x30000000);
				Render2D.centered(g, this.minecraft, m.name, m.x + w / 2, m.y + (h - 8) / 2, Theme.MUTED);
			}
			int color = m == selected ? Theme.accent() : hover ? 0xCCFFFFFF : m.enabled ? 0x55FFFFFF : 0x33FFFFFF;
			g.outline(m.x - 1, m.y - 1, w + 2, h + 2, color);
		}

		if (selected != null) {
			HudModule m = selected;
			int w = m.scaledWidth(this.minecraft);
			int h = m.scaledHeight(this.minecraft);
			// alça de redimensionar no canto inferior direito
			g.fill(m.x + w - HANDLE + 1, m.y + h - HANDLE + 1, m.x + w + 1, m.y + h + 1, Theme.accent());
			String label = m.name + " · " + Math.round(m.scale * 100) + "%";
			int ly = m.y - 11 < 0 ? m.y + h + 3 : m.y - 11;
			int lw = this.minecraft.font.width(label) + 6;
			int lx = Math.max(0, Math.min(m.x, this.width - lw));
			g.fill(lx, ly - 1, lx + lw, ly + 9, 0xCC0A0C14);
			Render2D.text(g, this.minecraft, label, lx + 3, ly, Theme.TEXT);
		}
	}

	private void drawHelp(Gfx g) {
		boolean toolbarTop = selected != null && selected.y + selected.scaledHeight(this.minecraft) / 2 > this.height / 2;
		int y = toolbarTop ? this.height - 12 : 6;
		String help = selected == null
				? "Clique num elemento para editar · arraste para mover · Esc salva"
				: "Arraste para mover · rodinha ou alça do canto para redimensionar · Esc salva";
		Render2D.centered(g, this.minecraft, help, this.width / 2, y, Theme.MUTED);
	}

	private void updateDrag(int mouseX, int mouseY) {
		snapX = false;
		snapY = false;
		if (dragging == null) return;
		HudModule m = dragging;
		if (resizing) {
			float s = (mouseX - m.x) / (float) Math.max(1, m.width(this.minecraft));
			int px = m.x;
			int py = m.y;
			m.setScale(s);
			m.moveTo(px, py, this.width, this.height, this.minecraft);
			return;
		}
		int w = m.scaledWidth(this.minecraft);
		int h = m.scaledHeight(this.minecraft);
		int px = mouseX - offX;
		int py = mouseY - offY;
		int cx = (this.width - w) / 2;
		int cy = (this.height - h) / 2;
		if (Math.abs(px - cx) < SNAP) { px = cx; snapX = true; }
		else if (Math.abs(px - MARGIN) < SNAP) px = MARGIN;
		else if (Math.abs(px + w - (this.width - MARGIN)) < SNAP) px = this.width - MARGIN - w;
		if (Math.abs(py - cy) < SNAP) { py = cy; snapY = true; }
		else if (Math.abs(py - MARGIN) < SNAP) py = MARGIN;
		else if (Math.abs(py + h - (this.height - MARGIN)) < SNAP) py = this.height - MARGIN - h;
		m.moveTo(px, py, this.width, this.height, this.minecraft);
	}

	// ---------- mouse ----------

	private boolean inside(HudModule m, double mx, double my) {
		return mx >= m.x && my >= m.y
				&& mx <= m.x + m.scaledWidth(this.minecraft) && my <= m.y + m.scaledHeight(this.minecraft);
	}

	private boolean onHandle(HudModule m, double mx, double my) {
		int rx = m.x + m.scaledWidth(this.minecraft);
		int ry = m.y + m.scaledHeight(this.minecraft);
		return mx >= rx - HANDLE && mx <= rx + 2 && my >= ry - HANDLE && my <= ry + 2;
	}

	private HudModule moduleAt(double mx, double my) {
		List<HudModule> hud = ModuleManager.hud();
		for (int i = hud.size() - 1; i >= 0; i--) {
			if (inside(hud.get(i), mx, my)) return hud.get(i);
		}
		return null;
	}

	private boolean press(double mx, double my) {
		if (selected != null && onHandle(selected, mx, my)) {
			dragging = selected;
			resizing = true;
			return true;
		}
		HudModule m = moduleAt(mx, my);
		if (m != selected) {
			selected = m;
			this.rebuildWidgets();
		}
		if (m == null) return false;
		dragging = m;
		resizing = false;
		offX = (int) mx - m.x;
		offY = (int) my - m.y;
		return true;
	}

	private void release() {
		boolean wasDragging = dragging != null;
		dragging = null;
		resizing = false;
		// a barra pode mudar de lado (topo/baixo) conforme o elemento foi solto
		if (wasDragging) this.rebuildWidgets();
	}

	//? if >=1.21.9 {
	@Override
	public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
		if (super.mouseClicked(event, doubleClick)) return true;
		return press(event.x(), event.y());
	}

	@Override
	public boolean mouseReleased(MouseButtonEvent event) {
		release();
		return super.mouseReleased(event);
	}
	//?} else {
	/*@Override
	public boolean mouseClicked(double mx, double my, int button) {
		if (super.mouseClicked(mx, my, button)) return true;
		return press(mx, my);
	}

	@Override
	public boolean mouseReleased(double mx, double my, int button) {
		release();
		return super.mouseReleased(mx, my, button);
	}
	*///?}

	@Override
	public boolean mouseScrolled(double mx, double my, double scrollX, double scrollY) {
		HudModule m = moduleAt(mx, my);
		if (m == null) m = selected;
		if (m == null || scrollY == 0) return super.mouseScrolled(mx, my, scrollX, scrollY);
		if (m != selected) selected = m;
		resize(m, m.scale + (scrollY > 0 ? 0.1f : -0.1f));
		return true;
	}

	@Override
	public boolean isPauseScreen() {
		return false;
	}

	@Override
	public void onClose() {
		HudModule.editing = false;
		KairoConfig.save();
		Compat.setScreen(this.parent);
	}

	@Override
	public void removed() {
		HudModule.editing = false;
		super.removed();
	}
}
