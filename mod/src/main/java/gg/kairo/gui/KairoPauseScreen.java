package gg.kairo.gui;

import gg.kairo.KairoClient;
import gg.kairo.compat.Compat;
import gg.kairo.compat.Gfx;
import gg.kairo.config.KairoConfig;
import gg.kairo.util.Theme;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.client.multiplayer.ServerData;

/**
 * Menu do ESC do Kairo. Os botões que mexem com o jogo (desconectar, conquistas,
 * estatísticas, LAN) apertam o botão do menu original por baixo, então a lógica é a do jogo.
 */
public final class KairoPauseScreen extends KairoScreen {
	/** Menu original aberto de propósito pelo jogador (não é trocado). */
	public static PauseScreen allowedVanilla;

	private int panelW;

	public KairoPauseScreen() {
		super("Jogo pausado");
	}

	@Override
	protected void layout() {
		panelW = Math.max(150, Math.min(200, Math.round(this.width * 0.32f)));
		int pad = 14;
		int bw = panelW - pad * 2;
		int y = Math.min(62, this.height / 5);

		ServerData server = this.minecraft.getCurrentServer();
		boolean local = this.minecraft.isLocalServer();
		String where = local ? "Mundo local" : server != null ? server.name : "Servidor";

		add(new KButton(pad, y, bw, 30, Style.PRIMARY, "Voltar ao jogo", this::onClose).sub(where));
		y += 36;
		add(new KButton(pad, y, bw, 20, Style.ITEM, "Módulos do Kairo",
				() -> Compat.setScreen(new KairoMenuScreen(this)))
				.hint(KairoClient.keyMenu.getTranslatedKeyMessage().getString()));
		y += 22;
		KButton hud = add(new KButton(pad, y, bw, 20, Style.ITEM, "Editar HUD",
				() -> Compat.setScreen(new HudEditorScreen(this))));
		if (KairoConfig.ui("hudKey", true)) hud.hint(KairoClient.keyHudEditor.getTranslatedKeyMessage().getString());
		y += 22;
		add(new KButton(pad, y, bw, 20, Style.ITEM, "Opções",
				() -> Compat.setScreen(new OptionsScreen(this, this.minecraft.options))));
		y += 22;
		add(new KButton(pad, y, bw, 20, Style.ITEM, "Conquistas", () -> vanilla("gui.advancements")));
		y += 22;
		add(new KButton(pad, y, bw, 20, Style.ITEM, "Estatísticas", () -> vanilla("gui.stats")));
		y += 22;
		if (this.minecraft.hasSingleplayerServer() && !this.minecraft.getSingleplayerServer().isPublished()) {
			add(new KButton(pad, y, bw, 20, Style.ITEM, "Abrir para LAN", () -> vanilla("menu.shareToLan")));
			y += 22;
		}
		add(new KButton(pad, y, bw, 20, Style.ITEM, "Menu original", () -> {
			PauseScreen p = new PauseScreen(true);
			allowedVanilla = p;
			Compat.setScreen(p);
		}));

		add(new KButton(pad, this.height - 32, bw, 20, Style.DANGER, local ? "Salvar e sair" : "Desconectar",
				() -> vanilla("menu.returnToMenu", "menu.disconnect")));
	}

	/** Abre o menu original por baixo e aperta o botão dele. */
	private void vanilla(String... keys) {
		PauseScreen p = new PauseScreen(true);
		allowedVanilla = p;
		Compat.setScreen(p);
		Compat.pressInVanillaPause(p, keys);
		// voltando de Conquistas/Estatísticas, o menu original é trocado de novo pelo do Kairo
		allowedVanilla = null;
	}

	@Override
	protected void draw(Gfx g, int mx, int my) {
		Scene sc = scene(KairoConfig.uiString("titleScene", "anoitecer"));
		g.fill(panelW, 0, this.width, this.height, 0x55000000);
		leftPanel(g, panelW);

		int pad = 14;
		int top = Math.max(10, Math.min(18, this.height / 16));
		logo(g, pad, top, 2, sc.gem());
		g.textScaled(this.font, "§lKAIRO", pad + 38, top + 3, 2.0f, TEXT, false);
		g.textScaled(this.font, "J O G O   P A U S A D O", pad + 39, top + 23, 0.7f, MUTED, false);

		drawSession(g);
		drawButtons(g, mx, my);
	}

	private void drawSession(Gfx g) {
		int w = Math.min(170, this.width - panelW - 24);
		if (w < 110) return;
		int x = this.width - 12 - w, y = 12;
		ServerData server = this.minecraft.getCurrentServer();
		String[][] rows = {
			{"Onde", this.minecraft.isLocalServer() ? "Mundo local" : server != null ? server.ip : "—"},
			{"FPS", String.valueOf(this.minecraft.getFps())},
			{"Hora", LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm"))},
		};
		int h = 18 + rows.length * 11 + 4;
		g.fill(x, y, x + w, y + h, 0xD907070C);
		g.outline(x, y, w, h, 0x24FFFFFF);
		label(g, "Sessão", x + 8, y + 7);
		for (int i = 0; i < rows.length; i++) {
			int ly = y + 18 + i * 11;
			g.text(this.font, rows[i][0], x + 8, ly, MUTED, false);
			String v = fit(rows[i][1], w - 56, 1f);
			g.text(this.font, v, x + w - 8 - this.font.width(v), ly, TEXT, false);
		}
		g.fill(x, y + h, x + w, y + h + 1, Theme.withAlpha(Theme.accent(), 0x80));
	}

	@Override
	public void onClose() {
		Compat.setScreen(null);
	}
}
