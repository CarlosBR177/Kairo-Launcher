package gg.kairo.mixin;

import net.minecraft.client.renderer.GameRenderer;
import org.spongepowered.asm.mixin.Mixin;
//? if <26.1 {
/*import com.llamalad7.mixinextras.injector.ModifyReturnValue;
import gg.kairo.module.impl.ZoomModule;
import org.spongepowered.asm.mixin.injection.At;
*///?}

/**
 * Zoom nas 1.21.x: GameRenderer#getFov. Devolve double na 1.21.1 e float a partir da 1.21.2.
 * require = 0: se o método mudar, o zoom para de funcionar mas o jogo abre normalmente.
 */
@Mixin(GameRenderer.class)
public class GameRendererMixin {
	//? if <1.21.2 {
	/*@ModifyReturnValue(method = "getFov", at = @At("RETURN"), require = 0)
	private double kairo$zoom(double fov) {
		return ZoomModule.applyFov((float) fov);
	}
	*///?} else if <26.1 {
	/*@ModifyReturnValue(method = "getFov", at = @At("RETURN"), require = 0)
	private float kairo$zoom(float fov) {
		return ZoomModule.applyFov(fov);
	}
	*///?}
}
