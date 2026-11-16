package gg.kairo.mixin;

import gg.kairo.module.impl.FreelookModule;
import net.minecraft.client.player.LocalPlayer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(LocalPlayer.class)
public abstract class LocalPlayerMixin {
	/** LocalPlayer sobrescreve getViewYRot, então precisa de um mixin próprio. */
	@Inject(method = "getViewYRot", at = @At("HEAD"), cancellable = true)
	private void kairo$freelookYaw(float partialTick, CallbackInfoReturnable<Float> cir) {
		if (FreelookModule.active) {
			cir.setReturnValue(FreelookModule.yaw);
		}
	}
}
