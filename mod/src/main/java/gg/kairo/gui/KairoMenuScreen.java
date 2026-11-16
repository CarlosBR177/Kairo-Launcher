package gg.kairo.gui;

import gg.kairo.KairoClient;
import gg.kairo.config.KairoConfig;
import gg.kairo.module.Module;
import gg.kairo.module.ModuleManager;
import gg.kairo.util.Render2D;
import gg.kairo.util.Theme;
import gg.kairo.compat.Compat;
import gg.kairo.compat.Gfx;
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

/**
 * Menu principal (Shift direito): liga/desliga módulos, troca o perfil de HUD e abre o editor.
 * As opções finas de cada módulo (estilo da mira, tamanho do item na mão…) ficam na aba Client do launcher.
 */
public final class KairoMenuScreen extends Screen {
	private static final int BTN_W = 124;
	private static final int BTN_H = 20;
	private static final int GAP = 4;

	private final Screen parent;

	public KairoMenuScreen(Screen parent) {
		super(Component.literal("Kairo Client"));
		this.parent = parent;
	}

	@Override
	protected void init() {
		List<Module> modules = ModuleManager.all();
		int cols = this.width >= 3 * BTN_W + 2 * GAP + 20 ? 3 : 2;
		int rows = (modules.size() + cols - 1) / cols;
		int gridW = cols * BTN_W + (cols - 1) * GAP;
		int left = (this.width - gridW) / 2;
		int top = Math.max(44, (this.height - rows * (BTN_H + GAP) - 80) / 2 + 22);

		for (int i = 0; i < modules.size(); i++) {
			Module m = modules.get(i);
			int bx = left + (i % cols) * (BTN_W + GAP);
			int by = top + (i / cols) * (BTN_H + GAP);
			String tip = m.blocked ? m.description + "\n§cDesligado pelas regras deste servidor." : m.description;
			Button b = Button.builder(label(m), btn -> {
				m.toggle();
				btn.setMessage(label(m));
			}).bounds(bx, by, BTN_W, BTN_H).tooltip(Tooltip.create(Component.literal(tip))).build();
			b.active = !m.blocked;
			this.addRenderableWidget(b);
		}

		int footerY = top + rows * (BTN_H + GAP) + 8;
		int half = (gridW - GAP) / 2;
		int footerY2 = footerY + BTN_H + GAP;
		String hudKey = KairoConfig.ui("hudKey", true)
				? " (" + KairoClient.keyHudEditor.getTranslatedKeyMessage().getString() + ")" : "";
		Button hudBtn = Button.builder(Component.literal("✥ Editar HUD" + hudKey),
				btn -> Compat.setScreen(new HudEditorScreen(this)))
				.bounds(left, footerY, half, BTN_H)
				.tooltip(Tooltip.create(Component.literal(this.minecraft.player == null
						? "Entre num mundo para editar a HUD." : "Mover e redimensionar os elementos da HUD.")))
				.build();
		hudBtn.active = this.minecraft.player != null;
		this.addRenderableWidget(hudBtn);
		this.addRenderableWidget(Button.builder(profileLabel(), btn -> {
			List<String> names = KairoConfig.profileNames();
			if (names.isEmpty()) return;
			int idx = names.indexOf(KairoConfig.activeProfile());
			KairoConfig.applyProfile(names.get((idx + 1) % names.size()));
			this.rebuildWidgets();
		}).bounds(left + half + GAP, footerY, gridW - half - GAP, BTN_H)
				.tooltip(Tooltip.create(Component.literal("Perfis são criados na aba Client do launcher.")))
				.build());
		this.addRenderableWidget(Button.builder(Component.literal("Interface…"),
				btn -> Compat.setScreen(new KairoSettingsScreen(this)))
				.bounds(left, footerY2, half, BTN_H)
				.tooltip(Tooltip.create(Component.literal("Tela inicial, menu do ESC e tecla do editor de HUD.")))
				.build());
		this.addRenderableWidget(Button.builder(Component.literal("Concluir"), btn -> this.onClose())
				.bounds(left + half + GAP, footerY2, gridW - half - GAP, BTN_H).build());
	}

	private static Component profileLabel() {
		List<String> names = KairoConfig.profileNames();
		if (names.isEmpty()) return Component.literal("§7Sem perfis");
		String active = KairoConfig.activeProfile();
		return Component.literal("Perfil: §d" + (active != null && names.contains(active) ? active : "—"));
	}

	private static Component label(Module m) {
		if (m.blocked) return Component.literal("§c⛔ §7" + m.name);
		return Component.literal((m.enabled ? "§a● " : "§8○ §7") + m.name);
	}

	//? if >=26.1 {
	@Override
	public void extractRenderState(GuiGraphicsExtractor raw, int mouseX, int mouseY, float delta) {
		super.extractRenderState(raw, mouseX, mouseY, delta);
		drawHeader(new Gfx(raw));
	}
	//?} else {
	/*@Override
	public void render(GuiGraphics raw, int mouseX, int mouseY, float delta) {
		super.render(raw, mouseX, mouseY, delta);
		drawHeader(new Gfx(raw));
	}
	*///?}

	private void drawHeader(Gfx g) {
		int cx = this.width / 2;
		Render2D.centered(g, this.minecraft, "K A I R O", cx, 16, Theme.accent());
		Render2D.centered(g, this.minecraft, "Clique para ligar/desligar · passe o mouse para detalhes", cx, 28, Theme.MUTED);
	}

	@Override
	public void onClose() {
		KairoConfig.save();
		Compat.setScreen(this.parent);
	}
}
