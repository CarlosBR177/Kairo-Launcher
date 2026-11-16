package gg.kairo.mixin;

import com.llamalad7.mixinextras.injector.ModifyExpressionValue;
import gg.kairo.module.impl.ZoomModule;
import net.minecraft.client.MouseHandler;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
//? if >=26.1 {
import com.llamalad7.mixinextras.sugar.Local;
import org.joml.Vector2i;
//?}

@Mixin(MouseHandler.class)
public class MouseHandlerMixin {
	/** Durante o zoom, a rodinha ajusta o nível em vez de trocar o slot da hotbar. */
	//? if >=26.1 {
	@Inject(method = "onScroll",
			at = @At(value = "INVOKE", target = "Lnet/minecraft/client/player/LocalPlayer;isSpectator()Z"),
			cancellable = true)
	private void kairo$scrollZoom(CallbackInfo ci, @Local Vector2i scroll) {
		if (ZoomModule.onScroll(scroll.y + scroll.x)) ci.cancel();
	}
	//?} else {
	/*@Inject(method = "onScroll", at = @At("HEAD"), cancellable = true)
	private void kairo$scrollZoom(long window, double xOffset, double yOffset, CallbackInfo ci) {
		int delta = (int) Math.signum(yOffset != 0 ? yOffset : xOffset);
		if (ZoomModule.onScroll(delta)) ci.cancel();
	}
	*///?}

	/** Sensibilidade proporcional ao zoom, para a mira não ficar "nervosa". */
	@ModifyExpressionValue(method = "turnPlayer",
			at = @At(value = "INVOKE", target = "Lnet/minecraft/client/OptionInstance;get()Ljava/lang/Object;", ordinal = 0))
	private Object kairo$zoomSensitivity(Object value) {
		double divisor = ZoomModule.divisor();
		if (divisor <= 1.0001) return value;
		return (Double) value / divisor;
	}
}
