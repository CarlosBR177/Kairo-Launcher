package gg.kairo.gui;

import com.mojang.blaze3d.platform.InputConstants;
import gg.kairo.KairoClient;
import gg.kairo.compat.Compat;
import gg.kairo.compat.Gfx;
import gg.kairo.config.KairoConfig;
import gg.kairo.util.Render2D;
import gg.kairo.util.Theme;
import java.util.Arrays;
import net.minecraft.client.KeyMapping;
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
import net.minecraft.client.input.KeyEvent;
//?}

/** Interface do Kairo: tela inicial, menu do ESC, cenário e a tecla do editor de HUD. */
public final class KairoSettingsScreen extends Screen {
	private static final int W = 230;
	private static final int H = 20;
	private static final int GAP = 4;

	private final Screen parent;
	private boolean listening;

	public KairoSettingsScreen(Screen parent) {
		super(Component.literal("Interface do Kairo"));
		this.parent = parent;
	}

	@Override
	protected void init() {
		int x = (this.width - W) / 2;
		int y = Math.max(44, this.height / 2 - 76);

		boolean title = KairoConfig.ui("customTitle", true);
		addRow(x, y, "Tela inicial do Kairo: " + onOff(title, "Ligada", "Desligada"),
				"Troca a tela inicial do Minecraft pela do Kairo.", () -> KairoConfig.setUi("customTitle", !title));
		y += H + GAP;

		boolean pause = KairoConfig.ui("customPause", true);
		addRow(x, y, "Menu do ESC do Kairo: " + onOff(pause, "Ligado", "Desligado"),
				"Troca o menu de pausa pelo do Kairo. O original continua no botão \"Menu original\".",
				() -> KairoConfig.setUi("customPause", !pause));
		y += H + GAP;

		String scene = KairoConfig.uiString("titleScene", "anoitecer");
		addRow(x, y, "Cenário: §d" + cap(scene), "Cenário da tela inicial e cor do logo.", () -> {
			int i = Arrays.asList(KairoScreen.SCENES).indexOf(scene);
			KairoConfig.setUi("titleScene", KairoScreen.SCENES[(i + 1) % KairoScreen.SCENES.length]);
		});
		y += H + GAP + 8;

		String key = listening ? "§e> aperte uma tecla <" : "§d" + KairoClient.keyHudEditor.getTranslatedKeyMessage().getString();
		addRow(x, y, "Tecla do editor de HUD: " + key,
				"Clique e aperte a tecla nova. Esc cancela.", () -> listening = true);
		y += H + GAP;

		boolean hudKey = KairoConfig.ui("hudKey", true);
		addRow(x, y, "Atalho do editor de HUD: " + onOff(hudKey, "Ligado", "Desligado"),
				"Desligado: o editor abre só pelo botão \"Editar HUD\" dos menus.",
				() -> KairoConfig.setUi("hudKey", !hudKey));
		y += H + GAP + 8;

		this.addRenderableWidget(Button.builder(Component.literal("Concluir"), b -> this.onClose())
				.bounds(x, y, W, H).build());
	}

	private void addRow(int x, int y, String label, String tip, Runnable action) {
		this.addRenderableWidget(Button.builder(Component.literal(label), b -> {
			action.run();
			this.rebuildWidgets();
		}).bounds(x, y, W, H).tooltip(Tooltip.create(Component.literal(tip))).build());
	}

	private static String onOff(boolean v, String on, String off) {
		return v ? "§a" + on : "§7" + off;
	}

	private static String cap(String s) {
		return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
	}

	// ---------- captura da tecla ----------

	//? if >=1.21.9 {
	@Override
	public boolean keyPressed(KeyEvent event) {
		if (listening) {
			listening = false;
			if (event.key() != InputConstants.KEY_ESCAPE) setKey(InputConstants.getKey(event));
			this.rebuildWidgets();
			return true;
		}
		return super.keyPressed(event);
	}
	//?} else {
	/*@Override
	public boolean keyPressed(int keyCode, int scanCode, int modifiers) {
		if (listening) {
			listening = false;
			if (keyCode != InputConstants.KEY_ESCAPE) setKey(InputConstants.getKey(keyCode, scanCode));
			this.rebuildWidgets();
			return true;
		}
		return super.keyPressed(keyCode, scanCode, modifiers);
	}
	*///?}

	private void setKey(InputConstants.Key key) {
		KairoClient.keyHudEditor.setKey(key);
		KeyMapping.resetMapping();
		this.minecraft.options.save();
	}

	// ---------- desenho ----------

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
		int y = Math.max(44, this.height / 2 - 76);
		Render2D.centered(g, this.minecraft, "Interface do Kairo", cx, y - 26, Theme.accent());
		Render2D.centered(g, this.minecraft, "Passe o mouse em cada opção para detalhes", cx, y - 14, Theme.MUTED);
	}

	@Override
	public boolean shouldCloseOnEsc() {
		return !listening;
	}

	@Override
	public void onClose() {
		Compat.setScreen(this.parent);
	}
}
