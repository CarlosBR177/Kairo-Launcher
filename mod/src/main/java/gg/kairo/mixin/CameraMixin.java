package gg.kairo.mixin;

import net.minecraft.client.Camera;
import org.spongepowered.asm.mixin.Mixin;
//? if >=26.1 {
import com.llamalad7.mixinextras.injector.ModifyReturnValue;
import gg.kairo.module.impl.ZoomModule;
import org.spongepowered.asm.mixin.injection.At;
//?}

/** Zoom na 26.x (o FOV é calculado na Camera). Nas 1.21.x o zoom fica no GameRendererMixin. */
@Mixin(Camera.class)
public class CameraMixin {
	//? if >=26.1 {
	@ModifyReturnValue(method = "calculateFov", at = @At("RETURN"))
	private float kairo$zoom(float fov) {
		return ZoomModule.applyFov(fov);
	}
	//?}
}
