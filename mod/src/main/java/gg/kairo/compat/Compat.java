package gg.kairo.compat;

import com.mojang.blaze3d.platform.InputConstants;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;
//? if >=26.1 {
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
//?} else {
/*import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
*///?}

/** Pequenas diferenças de API entre as versões do jogo, num lugar só. */
public final class Compat {
	private Compat() {}

	/** Abre uma tela (ou fecha, com null). Na 26.2+ isso passou para Minecraft#gui. */
	public static void setScreen(Screen screen) {
		//? if >=26.2 {
		Minecraft.getInstance().gui.setScreen(screen);
		//?} else {
		/*Minecraft.getInstance().setScreen(screen);
		*///?}
	}

	/** Relógio em milissegundos para animações (monotônico, não depende do Util do jogo). */
	public static long millis() {
		return System.nanoTime() / 1_000_000L;
	}

	/** Registra uma tecla na tela de Controles. A Fabric API renomeou o helper na 26.1. */
	public static KeyMapping registerKey(KeyMapping key) {
		//? if >=26.1 {
		return KeyMappingHelper.registerKeyMapping(key);
		//?} else {
		/*return KeyBindingHelper.registerKeyBinding(key);
		*///?}
	}

	/** Tipo de tecla do teclado. Na 26.3 o jogo trocou GLFW por SDL e KEYSYM virou KEYBOARD. */
	public static final InputConstants.Type KEY_TYPE =
	//? if >=26.3 {
		InputConstants.Type.KEYBOARD;
	//?} else {
	/*InputConstants.Type.KEYSYM;
	*///?}

	/** HUD escondida (F1). Na 26.2 Options#hideGui passou para Hud#isHidden. */
	public static boolean hudHidden(Minecraft mc) {
		//? if >=26.2 {
		return mc.gui.hud.isHidden();
		//?} else {
		/*return mc.options.hideGui;
		*///?}
	}
}
