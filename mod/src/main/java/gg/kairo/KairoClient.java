package gg.kairo;

import com.mojang.blaze3d.platform.InputConstants;
import gg.kairo.combat.CombatEvents;
import gg.kairo.compat.Compat;
import gg.kairo.compat.Gfx;
import gg.kairo.config.KairoConfig;
import gg.kairo.config.ServerRules;
import gg.kairo.gui.HudEditorScreen;
import gg.kairo.gui.KairoMenuScreen;
import gg.kairo.gui.KairoPauseScreen;
import gg.kairo.gui.KairoTitleScreen;
import gg.kairo.hud.HudRenderer;
import gg.kairo.module.ModuleManager;
import gg.kairo.module.impl.CrosshairModule;
import gg.kairo.module.impl.FullbrightModule;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
//? if >=1.21.11 {
import net.minecraft.resources.Identifier;
//?} else {
/*import net.minecraft.resources.ResourceLocation;
*///?}
//? if >=1.21.6 {
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
//?} else {
/*import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
*///?}

public final class KairoClient implements ClientModInitializer {
	public static final String MOD_ID = "kairo";
	public static final Logger LOG = LoggerFactory.getLogger("Kairo");

	public static KeyMapping keyMenu;
	public static KeyMapping keyFreelook;
	public static KeyMapping keyZoom;
	public static KeyMapping keyHudEditor;

	/** Novidades mostradas na tela inicial do Kairo. */
	public static final String[] NEWS = {
		"Tela inicial e menu do ESC novos",
		"Tecla do editor de HUD configurável",
		"Janela de atualização no launcher",
	};

	/** Tela do jogo que vai ser trocada pela do Kairo no próximo tick. */
	private static Screen pendingSwap;

	//? if >=1.21.11 {
	public static Identifier id(String path) {
		return Identifier.fromNamespaceAndPath(MOD_ID, path);
	}
	//?} else {
	/*public static ResourceLocation id(String path) {
		return ResourceLocation.fromNamespaceAndPath(MOD_ID, path);
	}
	*///?}

	@Override
	public void onInitializeClient() {
		ModuleManager.init();
		KairoConfig.load();

		// a categoria das teclas virou um objeto na 1.21.9; antes era só o texto
		//? if >=1.21.9 {
		KeyMapping.Category category = KeyMapping.Category.register(id("main"));
		//?} else {
		/*String category = "key.category.kairo.main";
		*///?}
		keyMenu = Compat.registerKey(new KeyMapping(
				"key.kairo.menu", Compat.KEY_TYPE, InputConstants.KEY_RSHIFT, category));
		keyFreelook = Compat.registerKey(new KeyMapping(
				"key.kairo.freelook", Compat.KEY_TYPE, InputConstants.KEY_LALT, category));
		keyZoom = Compat.registerKey(new KeyMapping(
				"key.kairo.zoom", Compat.KEY_TYPE, InputConstants.KEY_C, category));
		keyHudEditor = Compat.registerKey(new KeyMapping(
				"key.kairo.hud_editor", Compat.KEY_TYPE, InputConstants.KEY_H, category));

		ClientTickEvents.END_CLIENT_TICK.register(mc -> {
			while (keyMenu.consumeClick()) {
				Compat.setScreen(new KairoMenuScreen(null));
			}
			while (keyHudEditor.consumeClick()) {
				// a tecla pode ser desligada no menu do Kairo (aí só pelo botão "Editar HUD")
				if (KairoConfig.ui("hudKey", true) && mc.player != null) Compat.setScreen(new HudEditorScreen(null));
			}
			if (pendingSwap != null) {
				Screen from = pendingSwap;
				pendingSwap = null;
				Compat.setScreen(from instanceof TitleScreen ? new KairoTitleScreen() : new KairoPauseScreen());
			}
			ModuleManager.tick(mc);
		});

		// HUD do Kairo (antes do chat). A mira personalizada:
		//  - 26.x: substitui o elemento CROSSHAIR da Fabric API (abaixo)
		//  - 1.21.x: GuiMixin cancela a mira vanilla e desenha a do Kairo
		//? if >=1.21.6 {
		HudElementRegistry.attachElementBefore(VanillaHudElements.CHAT, id("hud"), (g, delta) -> HudRenderer.render(new Gfx(g)));
		//?} else {
		/*HudRenderCallback.EVENT.register((g, delta) -> HudRenderer.render(new Gfx(g)));
		*///?}

		//? if >=26.1 {
		HudElementRegistry.replaceElement(VanillaHudElements.CROSSHAIR, vanilla -> (g, delta) -> {
			Minecraft mc = Minecraft.getInstance();
			if (ModuleManager.get("crosshair") instanceof CrosshairModule c && c.enabled) {
				if (!Compat.hudHidden(mc)) c.render(new Gfx(g), mc);
			} else {
				vanilla.extractRenderState(g, delta);
			}
		});
		//?}

		// Tela inicial e menu do ESC do Kairo: troca a tela do jogo logo depois que ela abre.
		// (Por evento + tick, sem mixin, para funcionar igual em todas as versões.)
		ScreenEvents.AFTER_INIT.register((client, screen, w, h) -> {
			boolean swap = screen instanceof TitleScreen t
					? t != KairoTitleScreen.allowedVanilla && KairoConfig.ui("customTitle", true)
					: screen instanceof PauseScreen p && p != KairoPauseScreen.allowedVanilla && KairoConfig.ui("customPause", true);
			if (!swap) return;
			pendingSwap = screen;
			ScreenEvents.remove(screen).register(s -> {
				if (pendingSwap == s) pendingSwap = null;
			});
		});

		CombatEvents.register();
		ClientPlayConnectionEvents.JOIN.register((handler, sender, mc) -> mc.execute(() -> ServerRules.onJoin(mc)));
		ClientPlayConnectionEvents.DISCONNECT.register((handler, mc) -> mc.execute(ServerRules::onLeave));

		// título da janela: o WindowTitleMixin cuida disso; se o método mudou nesta versão, põe na abertura
		ClientLifecycleEvents.CLIENT_STARTED.register(mc -> {
			if (!titleMixinActive) mc.getWindow().setTitle(windowTitle("Minecraft " + gameVersion()));
		});

		ClientLifecycleEvents.CLIENT_STOPPING.register(mc -> {
			// o gama alto do Brilho máximo nunca vai para o options.txt
			if (ModuleManager.get("fullbright") instanceof FullbrightModule f) f.restore(mc);
			KairoConfig.save();
		});

		LOG.info("Kairo Client carregado com {} módulos", ModuleManager.all().size());
	}
	/** true quando o WindowTitleMixin aplicou nesta versão do jogo. */
	public static volatile boolean titleMixinActive;

	/** Troca o "Minecraft" (ou "Minecraft*", de jogo modificado) do título pelo nome do launcher. */
	public static String windowTitle(String vanilla) {
		if (vanilla == null || vanilla.isBlank()) return "Kairo Launcher " + gameVersion();
		return vanilla.replaceFirst("^Minecraft\\*?", "Kairo Launcher");
	}

	/** Versão do Kairo Client (sem o sufixo +versão-do-jogo). */
	public static String version() {
		return modVersion(MOD_ID);
	}

	public static String gameVersion() {
		return modVersion("minecraft");
	}

	private static String modVersion(String id) {
		String v = FabricLoader.getInstance().getModContainer(id)
				.map(c -> c.getMetadata().getVersion().getFriendlyString()).orElse("?");
		int plus = v.indexOf('+');
		return plus > 0 ? v.substring(0, plus) : v;
	}
}
