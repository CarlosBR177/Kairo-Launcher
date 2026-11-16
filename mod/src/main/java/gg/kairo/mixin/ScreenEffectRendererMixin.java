package gg.kairo.mixin;

import com.llamalad7.mixinextras.sugar.Local;
import com.mojang.blaze3d.vertex.PoseStack;
import gg.kairo.module.impl.LowFireModule;
import net.minecraft.client.renderer.ScreenEffectRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Fogo baixo. require = 0: se o método mudar de nome, o efeito some mas o jogo abre normalmente. */
@Mixin(ScreenEffectRenderer.class)
public class ScreenEffectRendererMixin {
	@Inject(method = "renderFire", at = @At("HEAD"), cancellable = true, require = 0)
	private static void kairo$lowFireStart(CallbackInfo ci, @Local(argsOnly = true) PoseStack pose) {
		LowFireModule m = LowFireModule.INSTANCE;
		if (m == null || !m.enabled) return;
		if (m.hide) {
			ci.cancel();
			return;
		}
		pose.pushPose();
		pose.translate(0.0, -m.offset, 0.0);
	}

	@Inject(method = "renderFire", at = @At("RETURN"), require = 0)
	private static void kairo$lowFireEnd(CallbackInfo ci, @Local(argsOnly = true) PoseStack pose) {
		LowFireModule m = LowFireModule.INSTANCE;
		if (m != null && m.enabled && !m.hide) pose.popPose();
	}
}
