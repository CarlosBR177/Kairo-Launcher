package gg.kairo.gui;

import gg.kairo.KairoClient;
import gg.kairo.compat.Compat;
import gg.kairo.compat.Gfx;
import gg.kairo.config.KairoConfig;
import gg.kairo.util.Theme;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.client.multiplayer.ServerList;

/** Tela inicial do Kairo (conceito "B · Menu lateral"). Liga e desliga no menu do Kairo. */
public final class KairoTitleScreen extends KairoScreen {
	/** Tela inicial original aberta de propósito pelo jogador (não é trocada). */
	public static TitleScreen allowedVanilla;

	private final List<ServerData> servers = new ArrayList<>();
	private int panelW;

	public KairoTitleScreen() {
		super("Kairo");
	}

	@Override
	protected void layout() {
		loadServers();
		panelW = Math.max(150, Math.min(210, Math.round(this.width * 0.34f)));
		int pad = 14;
		int bw = panelW - pad * 2;
		int y = Math.min(70, this.height / 4);

		String last = servers.isEmpty() ? "Encontre um servidor" : "Favorito: " + servers.get(0).name;
		add(new KButton(pad, y, bw, 30, Style.PRIMARY, "Multijogador",
				() -> Compat.setScreen(new JoinMultiplayerScreen(this))).sub(last));
		y += 36;
		add(new KButton(pad, y, bw, 20, Style.ITEM, "Um jogador",
				() -> Compat.setScreen(new SelectWorldScreen(this))));
		y += 22;
		add(new KButton(pad, y, bw, 20, Style.ITEM, "Módulos do Kairo",
				() -> Compat.setScreen(new KairoMenuScreen(this)))
				.hint(KairoClient.keyMenu.getTranslatedKeyMessage().getString()));
		y += 22;
		add(new KButton(pad, y, bw, 20, Style.ITEM, "Opções",
				() -> Compat.setScreen(new OptionsScreen(this, this.minecraft.options))));
		y += 22;
		add(new KButton(pad, y, bw, 20, Style.ITEM, "Tela original do jogo", () -> {
			TitleScreen vanilla = new TitleScreen();
			allowedVanilla = vanilla;
			Compat.setScreen(vanilla);
		}));

		add(new KButton(panelW - pad - 40, this.height - 32, 40, 20, Style.SMALL, "Sair",
				() -> this.minecraft.stop()));

		// servidores favoritos (a lista do Multijogador), entrar com um clique
		int x0 = panelW + 12, x1 = this.width - 12;
		int n = Math.min(servers.size(), (x1 - x0) >= 3 * 96 + 16 ? 3 : 2);
		if (n > 0) {
			int gap = 8, cardW = (x1 - x0 - gap * (n - 1)) / n, cardH = 34;
			int cy = this.height - 12 - cardH;
			int[] colors = {Theme.accent(), CYAN, YELLOW};
			for (int i = 0; i < n; i++) {
				ServerData s = servers.get(i);
				add(new KButton(x0 + i * (cardW + gap), cy, cardW, cardH, Style.CARD, s.name,
						() -> Compat.connect(this, s)).sub(s.ip).icon(colors[i % colors.length]));
			}
		} else {
			add(new KButton(x0, this.height - 12 - 34, Math.min(180, x1 - x0), 34, Style.CARD, "Adicionar servidor",
					() -> Compat.setScreen(new JoinMultiplayerScreen(this))).sub("Seus favoritos aparecem aqui").icon(Theme.accent()));
		}
	}

	private void loadServers() {
		servers.clear();
		try {
			ServerList list = new ServerList(this.minecraft);
			list.load();
			for (int i = 0; i < list.size(); i++) servers.add(list.get(i));
		} catch (RuntimeException e) {
			KairoClient.LOG.warn("Não consegui ler a lista de servidores", e);
		}
	}

	@Override
	protected void draw(Gfx g, int mx, int my) {
		Scene sc = scene(KairoConfig.uiString("titleScene", "anoitecer"));
		panorama(g, sc, panelW);
		leftPanel(g, panelW);

		int pad = 14;
		int top = Math.max(10, Math.min(18, this.height / 16));
		logo(g, pad, top, 2, sc.gem());
		g.textScaled(this.font, "§lKAIRO", pad + 38, top + 3, 2.0f, TEXT, false);
		g.textScaled(this.font, "P V P   C L I E N T", pad + 39, top + 23, 0.7f, MUTED, false);

		// conta
		String name = this.minecraft.getUser().getName();
		int ay = this.height - 32;
		g.fill(pad, ay, pad + 20, ay + 20, Theme.accent());
		String initial = name.isEmpty() ? "?" : name.substring(0, 1).toUpperCase();
		g.text(this.font, initial, pad + (20 - this.font.width(initial)) / 2, ay + 6, 0xFFFFFFFF, false);
		g.text(this.font, fit(name, panelW - pad * 2 - 74, 1f), pad + 26, ay + 2, TEXT, false);
		g.textScaled(this.font, "Conectado", pad + 26, ay + 12, 0.75f, MUTED, false);

		// lado do cenário
		String ver = "Kairo " + KairoClient.version() + " · Minecraft " + KairoClient.gameVersion();
		g.textScaled(this.font, ver, this.width - 8 - this.font.width(ver) * 0.75f, 8, 0.75f, 0xFFC3C3D4, false);

		drawNews(g);
		splash(g, "Agora com HUD editável!", panelW + (this.width - panelW) / 4 + 10, Math.max(40, this.height / 5));

		if (!servers.isEmpty()) label(g, "Servidores favoritos", panelW + 12, this.height - 12 - 34 - 10);
		drawButtons(g, mx, my);
	}

	private void drawNews(Gfx g) {
		String[] news = KairoClient.NEWS;
		int w = Math.min(180, this.width - panelW - 24);
		if (w < 110 || news.length == 0) return;
		int x = this.width - 12 - w, y = 22;
		int h = 18 + news.length * 11 + 4;
		g.fill(x, y, x + w, y + h, 0xD907070C);
		g.outline(x, y, w, h, 0x24FFFFFF);
		label(g, "Novidades · " + KairoClient.version(), x + 8, y + 7);
		for (int i = 0; i < news.length; i++) {
			int ly = y + 18 + i * 11;
			g.fill(x + 9, ly + 3, x + 11, ly + 5, Theme.accent());
			g.text(this.font, fit(news[i], w - 24, 1f), x + 15, ly, TEXT, false);
		}
	}

	@Override
	public boolean shouldCloseOnEsc() {
		return false;
	}

	@Override
	public boolean isPauseScreen() {
		return false;
	}
}
