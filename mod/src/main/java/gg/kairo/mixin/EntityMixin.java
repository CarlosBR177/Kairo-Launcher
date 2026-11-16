package gg.kairo.mixin;

import gg.kairo.module.impl.FreelookModule;
import net.minecraft.client.Minecraft;
import net.minecraft.world.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(Entity.class)
public abstract class EntityMixin {
	/** Com o freelook ativo, o mouse gira a câmera em vez do jogador. */
	@Inject(method = "turn", at = @At("HEAD"), cancellable = true)
	private void kairo$freelookTurn(double yRot, double xRot, CallbackInfo ci) {
		if (FreelookModule.active && (Object) this == Minecraft.getInstance().player) {
			FreelookModule.turn(yRot, xRot);
			ci.cancel();
		}
	}

	@Inject(method = "getViewXRot", at = @At("HEAD"), cancellable = true)
	private void kairo$freelookPitch(float partialTick, CallbackInfoReturnable<Float> cir) {
		if (FreelookModule.active && (Object) this == Minecraft.getInstance().player) {
			cir.setReturnValue(FreelookModule.pitch);
		}
	}
}
