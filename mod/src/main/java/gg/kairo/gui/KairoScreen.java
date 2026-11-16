package gg.kairo.gui;

import gg.kairo.compat.Compat;
import gg.kairo.compat.Gfx;
import gg.kairo.util.Theme;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.resources.sounds.SimpleSoundInstance;
import net.minecraft.network.chat.Component;
import net.minecraft.sounds.SoundEvents;
//? if >=26.1 {
import net.minecraft.client.gui.GuiGraphicsExtractor;
//?} else {
/*import net.minecraft.client.gui.GuiGraphics;
*///?}
//? if >=1.21.9 {
import net.minecraft.client.input.MouseButtonEvent;
//?}

/**
 * Base das telas com o visual do Kairo (tela inicial e menu de pausa):
 * painel à esquerda, cenário em blocos e botões desenhados à mão.
 * As diferenças de versão (desenho e clique) ficam todas aqui.
 */
public abstract class KairoScreen extends Screen {
	protected static final int PANEL_BG = 0xE807070C;
	protected static final int LINE = 0x1FFFFFFF;
	protected static final int TEXT = 0xFFEEEEF5;
	protected static final int MUTED = 0xFFA3A3B8;
	protected static final int YELLOW = 0xFFFFD84D;
	protected static final int DANGER = 0xFFFF6B82;
	protected static final int CYAN = 0xFF3DDCFF;

	protected enum Style { PRIMARY, ITEM, CARD, DANGER, SMALL }

	protected static final class KButton {
		final int x, y, w, h;
		final Style style;
		final String label;
		String sub = "";
		String hint = "";
		int iconColor = 0;
		boolean enabled = true;
		final Runnable action;

		KButton(int x, int y, int w, int h, Style style, String label, Runnable action) {
			this.x = x;
			this.y = y;
			this.w = w;
			this.h = h;
			this.style = style;
			this.label = label;
			this.action = action;
		}

		boolean contains(double mx, double my) {
			return mx >= x && mx < x + w && my >= y && my < y + h;
		}

		KButton sub(String s) { this.sub = s; return this; }
		KButton hint(String s) { this.hint = s; return this; }
		KButton icon(int color) { this.iconColor = color; return this; }
	}

	protected final List<KButton> buttons = new ArrayList<>();

	protected KairoScreen(String title) {
		super(Component.literal(title));
	}

	@Override
	protected final void init() {
		buttons.clear();
		layout();
	}

	/** Monta os botões (chamado de novo quando a janela muda de tamanho). */
	protected abstract void layout();

	/** Desenha a tela inteira. */
	protected abstract void draw(Gfx g, int mouseX, int mouseY);

	protected KButton add(KButton b) {
		buttons.add(b);
		return b;
	}

	// ---------- versões: desenho e clique ----------

	//? if >=26.1 {
	@Override
	public void extractRenderState(GuiGraphicsExtractor raw, int mouseX, int mouseY, float delta) {
		super.extractRenderState(raw, mouseX, mouseY, delta);
		draw(new Gfx(raw), mouseX, mouseY);
	}
	//?} else {
	/*@Override
	public void render(GuiGraphics raw, int mouseX, int mouseY, float delta) {
		super.render(raw, mouseX, mouseY, delta);
		draw(new Gfx(raw), mouseX, mouseY);
	}
	*///?}

	//? if >=1.21.9 {
	@Override
	public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
		if (event.button() == 0 && click(event.x(), event.y())) return true;
		return super.mouseClicked(event, doubleClick);
	}
	//?} else {
	/*@Override
	public boolean mouseClicked(double mx, double my, int button) {
		if (button == 0 && click(mx, my)) return true;
		return super.mouseClicked(mx, my, button);
	}
	*///?}

	private boolean click(double mx, double my) {
		for (KButton b : buttons) {
			if (b.enabled && b.contains(mx, my)) {
				this.minecraft.getSoundManager().play(SimpleSoundInstance.forUI(SoundEvents.UI_BUTTON_CLICK, 1.0F));
				b.action.run();
				return true;
			}
		}
		return false;
	}

	// ---------- peças de desenho ----------

	protected void drawButtons(Gfx g, int mx, int my) {
		for (KButton b : buttons) drawButton(g, b, b.enabled && b.contains(mx, my));
	}

	protected void drawButton(Gfx g, KButton b, boolean hover) {
		var font = this.font;
		int textY = b.y + (b.h - 8) / 2;
		switch (b.style) {
			case PRIMARY -> {
				int base = Theme.accent();
				g.fill(b.x, b.y, b.x + b.w, b.y + b.h, hover ? Theme.mix(base, 0xFFFFFFFF, 0.14f) : base);
				g.outline(b.x, b.y, b.w, b.h, 0x40FFFFFF);
				if (b.sub.isEmpty()) {
					g.text(font, "§l" + b.label, b.x + 10, textY, 0xFFFFFFFF, true);
				} else {
					g.text(font, "§l" + b.label, b.x + 10, b.y + b.h / 2 - 9, 0xFFFFFFFF, true);
					g.textScaled(font, fit(b.sub, b.w - 20, 0.75f), b.x + 10, b.y + b.h / 2 + 2, 0.75f, 0xFFEDE6FF, false);
				}
			}
			case ITEM -> {
				int dx = hover ? 2 : 0;
				if (hover) g.fill(b.x, b.y, b.x + b.w, b.y + b.h, 0x16FFFFFF);
				int color = b.enabled ? TEXT : 0xFF5C5C72;
				g.text(font, b.label, b.x + 8 + dx, textY, color, false);
				if (!b.hint.isEmpty()) {
					int hw = (int) (font.width(b.hint) * 0.75f);
					g.textScaled(font, b.hint, b.x + b.w - 8 - hw, textY + 1, 0.75f, MUTED, false);
				}
				if (hover) g.text(font, "›", b.x + b.w - 8 - (b.hint.isEmpty() ? 0 : (int) (font.width(b.hint) * 0.75f) + 8) - font.width("›"), textY, Theme.accent(), false);
			}
			case DANGER -> {
				if (hover) g.fill(b.x, b.y, b.x + b.w, b.y + b.h, 0x26FF5470);
				g.outline(b.x, b.y, b.w, b.h, hover ? 0x80FF5470 : 0x40FF5470);
				g.text(font, b.label, b.x + (b.w - font.width(b.label)) / 2, textY, DANGER, false);
			}
			case SMALL -> {
				if (hover) g.fill(b.x, b.y, b.x + b.w, b.y + b.h, 0x16FFFFFF);
				g.outline(b.x, b.y, b.w, b.h, hover ? 0x60FFFFFF : 0x30FFFFFF);
				g.text(font, b.label, b.x + (b.w - font.width(b.label)) / 2, textY, TEXT, false);
			}
			case CARD -> {
				g.fill(b.x, b.y, b.x + b.w, b.y + b.h, 0xD907070C);
				g.outline(b.x, b.y, b.w, b.h, hover ? 0x66FFFFFF : 0x24FFFFFF);
				int s = b.h - 12;
				int ix = b.x + 6, iy = b.y + 6;
				g.fill(ix, iy, ix + s, iy + s, b.iconColor);
				String initial = b.label.isEmpty() ? "?" : b.label.substring(0, 1).toUpperCase();
				g.text(font, initial, ix + (s - font.width(initial)) / 2, iy + (s - 8) / 2, 0xFF07070C, false);
				int tx = ix + s + 6, tw = b.x + b.w - tx - 6;
				g.text(font, fit(b.label, tw, 1f), tx, b.y + b.h / 2 - 9, TEXT, false);
				g.textScaled(font, fit(b.sub, tw, 0.75f), tx, b.y + b.h / 2 + 2, 0.75f, MUTED, false);
			}
		}
	}

	/** Corta o texto com "…" para caber na largura (já considerando a escala). */
	protected String fit(String s, int maxW, float scale) {
		if (s == null) return "";
		int limit = (int) (maxW / scale);
		if (this.font.width(s) <= limit) return s;
		String dots = "…";
		while (!s.isEmpty() && this.font.width(s + dots) > limit) s = s.substring(0, s.length() - 1);
		return s + dots;
	}

	/** Painel escuro da esquerda com a linha de borda. */
	protected void leftPanel(Gfx g, int w) {
		g.fill(0, 0, w, this.height, PANEL_BG);
		g.fill(w - 1, 0, w, this.height, LINE);
	}

	/** Rótulo pequeno em maiúsculas (títulos de seção). */
	protected void label(Gfx g, String s, int x, int y) {
		g.textScaled(this.font, s.toUpperCase(), x, y, 0.75f, MUTED, false);
	}

	// ---------- logo em pixel art (o "K" do Kairo) ----------

	private static final String[] LOGO = {
		"..###.....#####.",
		"..###....#####..",
		"..###...#####...",
		"..###..#####....",
		"..###.####......",
		"..###**##.......",
		"..###**##.......",
		"..###.####......",
		"..###..#####....",
		"..###...#####...",
		"..###....#####..",
		"..###.....#####.",
	};

	/** Desenha o logo com `px` pixels de tela por pixel do desenho (12 linhas × 16 colunas). */
	protected void logo(Gfx g, int x, int y, int px, int gem) {
		for (int r = 0; r < LOGO.length; r++) {
			String row = LOGO[r];
			for (int c = 0; c < row.length(); c++) {
				char ch = row.charAt(c);
				if (ch == '.') continue;
				int color = ch == '*' ? gem : TEXT;
				g.fill(x + c * px, y + r * px, x + (c + 1) * px, y + (r + 1) * px, color);
			}
		}
	}

	// ---------- cenário em blocos ----------

	protected record Scene(int skyTop, int skyBottom, int far, int near, int grass, int moon, int gem) {}

	protected static Scene scene(String id) {
		return switch (id == null ? "" : id) {
			case "noite" -> new Scene(0xFF05050B, 0xFF1A1433, 0xFF16122A, 0xFF0B0A14, 0xFF231C3D, 0xFFE9E6D6, 0xFF8B5CFF);
			case "aurora" -> new Scene(0xFF03060C, 0xFF0F3B4A, 0xFF0C2A34, 0xFF060D12, 0xFF0F3D3A, 0xFFDFF7FF, 0xFF3DDCFF);
			default -> new Scene(0xFF1B1240, 0xFFC2577A, 0xFF3A1F45, 0xFF120B1C, 0xFF4A2650, 0xFFFFD8A8, 0xFFFF8FB8);
		};
	}

	public static final String[] SCENES = {"anoitecer", "noite", "aurora"};

	/** Céu em faixas, estrelas piscando, lua e dois planos de terreno andando devagar. */
	protected void panorama(Gfx g, Scene s, int fromX) {
		int w = this.width, h = this.height;
		long t = Compat.millis();

		int bands = 36;
		for (int i = 0; i < bands; i++) {
			int y0 = h * i / bands, y1 = h * (i + 1) / bands;
			float k = Math.min(1f, i / (bands * 0.8f));
			g.fill(fromX, y0, w, y1, Theme.mix(s.skyTop(), s.skyBottom(), k));
		}

		for (int i = 0; i < 70; i++) {
			int sx = fromX + (int) (hash(i * 3 + 1) * (w - fromX));
			int sy = (int) (hash(i * 3 + 2) * h * 0.55f);
			float tw = 0.45f + 0.55f * (float) Math.abs(Math.sin(t / 900.0 + i * 1.7));
			int size = hash(i * 3 + 3) > 0.85f ? 2 : 1;
			g.fill(sx, sy, sx + size, sy + size, Theme.withAlpha(0xFFEEEEF5, (int) (tw * 200)));
		}

		int ms = Math.max(10, h / 18);
		int mx = w - (int) (w * 0.13f), my = (int) (h * 0.12f);
		g.fill(mx - 4, my - 4, mx + ms + 4, my + ms + 4, Theme.withAlpha(s.moon(), 0x26));
		g.fill(mx, my, mx + ms, my + ms, s.moon());
		g.fill(mx + ms / 5, my + ms / 4, mx + ms / 5 + ms / 5, my + ms / 4 + ms / 5, 0x14000000);

		int cw = Math.max(6, h / 34);
		terrain(g, fromX, cw, t / 110.0, h * 0.40f, 2.4, s.far(), 0);
		terrain(g, fromX, cw, t / 55.0, h * 0.20f, 1.6, s.near(), s.grass());
	}

	private void terrain(Gfx g, int fromX, int cw, double offset, float base, double amp, int color, int grass) {
		int w = this.width, h = this.height;
		int shift = (int) Math.floor(offset % cw);
		long first = (long) Math.floor(offset / cw);
		for (int x = fromX - shift - cw, i = 0; x < w; x += cw, i++) {
			long col = first + i;
			int steps = (int) Math.round(Math.sin(col * 0.21) * amp + Math.sin(col * 0.057 + 2) * amp * 1.4 + Math.sin(col * 0.6 + 1) * 0.5);
			int top = h - (int) base - steps * cw;
			int x0 = Math.max(x, fromX);
			if (x + cw <= x0) continue;
			g.fill(x0, top, x + cw, h, color);
			if (grass != 0) g.fill(x0, top, x + cw, top + 2, grass);
		}
	}

	private static float hash(int n) {
		int x = n * 374761393;
		x = (x ^ (x >>> 13)) * 1274126177;
		x ^= x >>> 16;
		return (x & 0xFFFFFF) / (float) 0x1000000;
	}

	/** Frase amarela pulsando e inclinada, no estilo das frases da tela inicial do jogo. */
	protected void splash(Gfx g, String text, int x, int y) {
		float pulse = 1.0f + 0.05f * (float) Math.abs(Math.sin(Compat.millis() / 160.0));
		g.push();
		g.translate(x, y);
		g.rotate(-12f);
		g.scale(pulse);
		g.text(this.font, text, -this.font.width(text) / 2, -4, YELLOW, true);
		g.pop();
	}
}
