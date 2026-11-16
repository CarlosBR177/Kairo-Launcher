package gg.kairo.mixin;

//? if >=26.3 {
import net.minecraft.client.renderer.GameRenderer;
import org.spongepowered.asm.mixin.Mixin;

/**
 * Na 26.3 a Mojang trocou ItemInHandRenderer por FirstPersonHandsAndItemsRenderer
 * (não é uma troca 1:1). Até mapear a nova classe, o módulo "Mão" fica sem efeito
 * nessa versão; este mixin vazio só mantém a lista do kairo.mixins.json igual em todas.
 */
@Mixin(GameRenderer.class)
public class ItemInHandRendererMixin {
}
//?} else {
/*import com.llamalad7.mixinextras.sugar.Local;
import com.mojang.blaze3d.vertex.PoseStack;
import gg.kairo.module.impl.HandViewModule;
import net.minecraft.client.renderer.ItemInHandRenderer;
import net.minecraft.world.InteractionHand;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

// Item na mão: escala e posição. require = 0 pelo mesmo motivo do fogo baixo.
@Mixin(ItemInHandRenderer.class)
public class ItemInHandRendererMixin {
	@Inject(method = "renderArmWithItem", at = @At("HEAD"), require = 0)
	private void kairo$handStart(CallbackInfo ci, @Local(argsOnly = true) PoseStack pose,
			@Local(argsOnly = true) InteractionHand hand) {
		HandViewModule m = HandViewModule.INSTANCE;
		if (m == null || !m.enabled) return;
		pose.pushPose();
		double extraY = hand == InteractionHand.OFF_HAND ? m.offhandY : 0.0;
		pose.translate(m.x, m.y + extraY, m.z);
		float s = (float) m.scale;
		pose.scale(s, s, s);
	}

	@Inject(method = "renderArmWithItem", at = @At("RETURN"), require = 0)
	private void kairo$handEnd(CallbackInfo ci, @Local(argsOnly = true) PoseStack pose) {
		HandViewModule m = HandViewModule.INSTANCE;
		if (m != null && m.enabled) pose.popPose();
	}
}
*///?}
