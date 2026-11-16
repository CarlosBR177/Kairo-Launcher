package gg.kairo;

import com.mojang.blaze3d.platform.InputConstants;
import gg.kairo.combat.CombatEvents;
import gg.kairo.compat.Compat;
import gg.kairo.compat.Gfx;
import gg.kairo.config.KairoConfig;
import gg.kairo.config.ServerRules;
import gg.kairo.gui.HudEditorScreen;
import gg.kairo.gui.KairoMenuScreen;
import gg.kairo.hud.HudRenderer;
import gg.kairo.module.ModuleManager;
import gg.kairo.module.impl.CrosshairModule;
import gg.kairo.module.impl.FullbrightModule;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
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
				if (mc.player != null) Compat.setScreen(new HudEditorScreen(null));
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

		CombatEvents.register();
		ClientPlayConnectionEvents.JOIN.register((handler, sender, mc) -> mc.execute(() -> ServerRules.onJoin(mc)));
		ClientPlayConnectionEvents.DISCONNECT.register((handler, mc) -> mc.execute(ServerRules::onLeave));

		ClientLifecycleEvents.CLIENT_STOPPING.register(mc -> {
			// o gama alto do Brilho máximo nunca vai para o options.txt
			if (ModuleManager.get("fullbright") instanceof FullbrightModule f) f.restore(mc);
			KairoConfig.save();
		});

		LOG.info("Kairo Client carregado com {} módulos", ModuleManager.all().size());
	}
}
