package gg.kairo.mixin;

import com.llamalad7.mixinextras.injector.ModifyReturnValue;
import gg.kairo.KairoClient;
import net.minecraft.client.Minecraft;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

/**
 * Título da janela do jogo com o nome do launcher:
 * "Minecraft* 1.21.4 - Multiplayer" → "Kairo Launcher 1.21.4 - Multiplayer".
 * require = 0: se o método mudar numa versão nova, o KairoClient põe o título na abertura.
 */
@Mixin(Minecraft.class)
public class WindowTitleMixin {
	@ModifyReturnValue(method = "createTitle", at = @At("RETURN"), require = 0)
	private String kairo$title(String title) {
		KairoClient.titleMixinActive = true;
		return KairoClient.windowTitle(title);
	}
}
